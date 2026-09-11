/*
 * Cube layer — engine
 *
 * The visible page is one face of a cube. Rotating the cube brings in another face that
 * shows exactly the same content, at the same scroll position, with a different colour
 * palette. Palettes live in styles/cube-palettes.css as `[data-cube-face="<name>"]` rules
 * that only set CSS custom properties; the stage styles live in styles/cube.css. Triggers
 * and discoverability live in scripts/cube-ui.js.
 *
 * This file is independent from the page design: it never reads or edits the page DOM
 * beyond cloning `document.body` children into the faces needed for a turn, and it only
 * writes the `data-cube-face` attribute on <html>. It has no imports or exports so it runs
 * both as a module (head.html) and as a classic script (prototypes over file://).
 *
 * API (`window.cube`):
 *   - `rotate(direction)` one quarter turn; direction is where the current content goes:
 *     `left` slides the page off to the left and the face on the right comes in, `up`
 *     slides it up and the bottom face comes in. Resolves with the new front face.
 *   - `begin()` starts a scrubbable session with the front face and its four neighbours.
 *     Resolves with `{ update({ rotateX, rotateY, pull }), finish(direction | null),
 *     rotateX, rotateY, width, height }` or null when a turn is already running. Angles are
 *     cube rotations in degrees, -90..90: rotateY negative is the `left` direction, rotateX
 *     positive is `up`. `pull` is extra camera pull-back in px. `finish` settles on one
 *     axis; the other angle returns to zero.
 *   - `currentFace()`, `getOrientation()`, `isBusy()`, `directionFor(axis, angle)`,
 *     `turnOrientation(orientation, direction)`
 *   - `registerFace(name, { build(faceEl), sync(faceEl) })` renders a face with custom
 *     content instead of a palette snapshot of the page (see scripts/cube-rubik.js). `build`
 *     fills the detached face element, `sync` runs after it is in the DOM to set scroll.
 *   - `clonePage()` returns clones of the body children, offscreen blocks pruned and on-screen
 *     canvases copied; call it inside requestAnimationFrame for WebGL canvases to be readable.
 *     After attaching them call `syncAnimations(container)` so their CSS animations run in
 *     lockstep with the page.
 *   - `settings()` the tuning knobs from styles/cube.css, so other layers can match the motion.
 *
 * Events on `document`:
 *   - `cube:rotate` (in) `{ direction }` requests a turn
 *   - `cube:scrub` `{ rotateX, rotateY }` on every session update
 *   - `cube:turning` `{ direction, face, duration, easing, from, to }` when a session
 *     settles; `face` is the front face once settled
 *   - `cube:settled` `{ direction, face }` when the overlay is gone, direction null if
 *     cancelled
 *   - `cube:rotated` `{ from, to, direction }` after a committed turn
 *
 * Body children carrying `data-cube-exclude` are not cloned into the faces.
 *
 * Geometry: the page is W×H and not square, so the box is W deep. Left and right faces sit
 * at ±W/2 and span the full depth; top and bottom faces sit at ±H/2, are H deep and are
 * shifted so their front edge meets the front face. Every visible seam lines up and each
 * neighbour lands on the viewport at 1:1 after a quarter turn. Rotation about Y pivots at
 * the box centre, rotation about X at the top and bottom faces' own centre depth.
 */

const ATTR = 'data-cube-face';
const STORAGE_KEY = 'cube-orientation';
const POSITIONS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/*
 * Which palette face currently sits at each cube position. Only the front face and its
 * four neighbours are ever rendered, each upright, so a permutation of positions is enough
 * to model the orientation.
 */
let orientation = Object.fromEntries(POSITIONS.map((p) => [p, p]));

const TURNS = {
  // `cycle` lists the positions that rotate into each other: position[i] takes the face that
  // was at position[i + 1]. `angle` is the cube rotation around `axis`.
  left: { axis: 'Y', angle: -90, cycle: ['front', 'right', 'back', 'left'] },
  right: { axis: 'Y', angle: 90, cycle: ['front', 'left', 'back', 'right'] },
  up: { axis: 'X', angle: 90, cycle: ['front', 'bottom', 'back', 'top'] },
  down: { axis: 'X', angle: -90, cycle: ['front', 'top', 'back', 'bottom'] },
};

const faceBuilders = {}; // name → { build, sync }

let pending = null; // session being built
let session = null; // session in progress
let rotating = null; // promise of a running rotate()

const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(resolve); });
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadOrientation() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    const valid = stored
      && POSITIONS.every((p) => POSITIONS.includes(stored[p]))
      && new Set(Object.values(stored)).size === POSITIONS.length;
    if (valid) orientation = { ...stored };
  } catch (e) {
    // no storage, start from the default orientation
  }
}

function saveOrientation() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(orientation));
  } catch (e) {
    // no storage, orientation lives for this page only
  }
}

/**
 * Sets the page palette. Faces with a builder are not palettes, so the attribute comes off
 * and the page falls back to its defaults. While a session overlay is up the attribute also
 * comes off (`face` null): the overlay's faces must not inherit the page's palette, since the
 * default palette has no rule of its own. Transitions are suppressed for a frame so the
 * switch is instant.
 */
function setPalette(face) {
  const root = document.documentElement;
  root.classList.add('cube-switching');
  if (face && !faceBuilders[face]) root.setAttribute(ATTR, face);
  else root.removeAttribute(ATTR);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('cube-switching')));
}

function applyFace() {
  setPalette(orientation.front);
}

function turnOrientation(current, direction) {
  const spec = TURNS[direction];
  if (!spec) throw new Error(`cube: unknown direction "${direction}"`);
  const next = { ...current };
  spec.cycle.forEach((position, i) => {
    next[position] = current[spec.cycle[(i + 1) % spec.cycle.length]];
  });
  return next;
}

/** @returns {string|null} the direction a full turn to `angle` (±90) on `axis` means */
function directionFor(axis, angle) {
  return Object.keys(TURNS).find((d) => TURNS[d].axis === axis && TURNS[d].angle === angle) || null;
}

/** Reads the tuning knobs from styles/cube.css. */
function settings() {
  const style = getComputedStyle(document.documentElement);
  const number = (name, fallback) => {
    const v = parseFloat(style.getPropertyValue(name));
    return Number.isNaN(v) ? fallback : v;
  };
  const durationRaw = style.getPropertyValue('--cube-duration').trim();
  let duration = parseFloat(durationRaw);
  if (Number.isNaN(duration)) duration = 900;
  else if (durationRaw.endsWith('ms')) duration = Math.round(duration);
  else if (durationRaw.endsWith('s')) duration *= 1000;
  return {
    duration,
    easing: style.getPropertyValue('--cube-easing').trim() || 'ease-in-out',
    pullback: number('--cube-pullback', 0.3),
    perspective: number('--cube-perspective', 1.6),
  };
}

const SOURCE_ATTR = 'data-cube-source';
const PRUNE_DEPTH = 3;
const PRUNE_MARGIN = 0.25; // of the viewport, kept around it before a block counts as offscreen

const pageChildren = () => [...document.body.children]
  .filter((child) => child.tagName !== 'SCRIPT'
    && !child.classList.contains('cube-overlay')
    && !child.hasAttribute('data-cube-exclude'));

const onScreen = (rect, mx, my) => rect.bottom > -my && rect.top < window.innerHeight + my
  && rect.right > -mx && rect.left < window.innerWidth + mx;

/**
 * Copies pixels of on-screen canvases in `source` onto their clones. cloneNode leaves
 * canvases blank. Must run in the same frame the canvases were drawn (inside
 * requestAnimationFrame), so WebGL buffers without preserveDrawingBuffer are still readable.
 */
function copyCanvases(source, clone) {
  const targets = clone.querySelectorAll('canvas');
  source.querySelectorAll('canvas').forEach((canvas, i) => {
    if (!onScreen(canvas.getBoundingClientRect(), 0, 0)) return;
    try {
      targets[i].getContext('2d').drawImage(canvas, 0, 0);
    } catch (e) {
      // zero-sized or tainted canvas, leave the clone blank
    }
  });
}

/**
 * Marks blocks of the clone that lie entirely outside the viewport so they keep their box
 * but are not styled, laid out or painted. Walks the live tree a few levels deep alongside
 * the clone; fixed and sticky blocks are always kept.
 */
function pruneOffscreen(source, clone, depth = 0) {
  const mx = window.innerWidth * PRUNE_MARGIN;
  const my = window.innerHeight * PRUNE_MARGIN;
  const live = source.children;
  const copy = clone.children;
  for (let i = 0; i < live.length && i < copy.length; i += 1) {
    const el = live[i];
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'sticky' && style.display !== 'contents') {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (!onScreen(rect, mx, my)) {
          copy[i].style.contentVisibility = 'hidden';
          copy[i].style.containIntrinsicSize = `${rect.width}px ${rect.height}px`;
        } else if (depth < PRUNE_DEPTH && el.children.length) {
          pruneOffscreen(el, copy[i], depth + 1);
        }
      }
    }
  }
}

/**
 * @returns {Element[]} clones of the page's body children, offscreen blocks pruned and
 * on-screen canvases copied. Call inside requestAnimationFrame, then attach them and call
 * `syncAnimations` on their container.
 */
function clonePage() {
  return pageChildren().map((child, index) => {
    const clone = child.cloneNode(true);
    clone.setAttribute(SOURCE_ATTR, index);
    pruneOffscreen(child, clone);
    copyCanvases(child, clone);
    return clone;
  });
}

/**
 * Puts every CSS animation and transition inside attached clones at the same time as its
 * live counterpart, so snapshots run in lockstep with the page instead of restarting.
 * @param {Element} container holds clones made by `clonePage`
 */
function syncAnimations(container) {
  const sources = pageChildren();
  container.querySelectorAll(`[${SOURCE_ATTR}]`).forEach((cloneRoot) => {
    const liveRoot = sources[Number(cloneRoot.getAttribute(SOURCE_ATTR))];
    if (!liveRoot) return;
    const liveAnimations = liveRoot.getAnimations({ subtree: true });
    if (!liveAnimations.length) return;
    const index = (root) => new Map([root, ...root.querySelectorAll('*')].map((el, i) => [el, i]));
    const liveIndex = index(liveRoot);
    const cloneIndex = index(cloneRoot);
    const key = (a, map) => `${map.get(a.effect.target)}|${a.effect.pseudoElement || ''}|`
      + `${a.animationName || a.transitionProperty || ''}`;
    const byKey = new Map(liveAnimations.map((a) => [key(a, liveIndex), a]));
    cloneRoot.getAnimations({ subtree: true }).forEach((a) => {
      const live = byKey.get(key(a, cloneIndex));
      if (!live || live.currentTime === null) return;
      a.currentTime = live.currentTime;
      if (live.playState === 'paused') a.pause();
    });
  });
}

/** Builds a face: a snapshot of the page in the face's palette, or a registered builder. */
function buildFace(face) {
  const el = document.createElement('div');
  el.className = 'cube-face';
  el.setAttribute(ATTR, face);
  if (faceBuilders[face]) {
    faceBuilders[face].build(el);
    return el;
  }
  const page = document.createElement('div');
  page.className = 'cube-face-page';
  page.append(...clonePage());
  el.append(page);
  return el;
}

/** Sets the scroll position of an attached face to match the window. */
function syncFace(el) {
  const face = el.getAttribute(ATTR);
  if (faceBuilders[face]) {
    faceBuilders[face].sync(el);
    return;
  }
  el.scrollTop = window.scrollY;
  el.scrollLeft = window.scrollX;
  syncAnimations(el);
}

/**
 * Renders a face with custom content instead of a palette snapshot.
 * @param {string} face position name
 * @param {{ build: Function, sync: Function }} builder
 */
function registerFace(face, builder) {
  if (!POSITIONS.includes(face)) throw new Error(`cube: unknown face "${face}"`);
  faceBuilders[face] = builder;
}

function lockScroll() {
  // capture phase on window runs before page scroll libraries (Lenis, etc.) see the event
  const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const opts = { capture: true, passive: false };
  ['wheel', 'touchmove'].forEach((t) => window.addEventListener(t, block, opts));
  return () => ['wheel', 'touchmove'].forEach((t) => window.removeEventListener(t, block, opts));
}

// camera pull-back over a turn: quick in, hold through the middle, quick out
const pullCurve = (angle) => Math.sin((Math.PI * clamp(Math.abs(angle), 0, 90)) / 90) ** 0.6;

async function createSession() {
  const knobs = settings();
  const root = document.documentElement;
  const width = root.clientWidth;
  const height = root.clientHeight;
  const halfW = width / 2;
  const halfH = height / 2;
  const pivotX = halfW - halfH; // depth of the X rotation pivot, see geometry note above

  // build in the frame in which the page's own rAF loops have just drawn, see copyCanvases
  await nextFrame();
  const overlay = document.createElement('div');
  overlay.className = 'cube-overlay';
  overlay.style.perspective = `${Math.max(width, height) * knobs.perspective}px`;
  const cube = document.createElement('div');
  cube.className = 'cube';
  const placement = {
    front: `translateZ(${halfW}px)`,
    left: `rotateY(-90deg) translateZ(${halfW}px)`,
    right: `rotateY(90deg) translateZ(${halfW}px)`,
    top: `rotateX(90deg) translateZ(${halfH}px) translateY(${pivotX}px)`,
    bottom: `rotateX(-90deg) translateZ(${halfH}px) translateY(${-pivotX}px)`,
  };
  const faces = Object.entries(placement).map(([position, transform]) => {
    const face = buildFace(orientation[position]);
    face.style.transform = transform;
    return face;
  });
  cube.append(...faces);
  overlay.append(cube);
  setPalette(null);
  document.body.append(overlay);
  faces.forEach(syncFace);
  const unlock = lockScroll();

  const state = { rotateX: 0, rotateY: 0, pull: 0 };
  const transform = (rotateX, rotateY, pull) => {
    const dominantDepth = Math.abs(rotateY) >= Math.abs(rotateX) ? width : height;
    const total = pull + dominantDepth * knobs.pullback
      * pullCurve(Math.max(Math.abs(rotateX), Math.abs(rotateY)));
    return `translateZ(${-total}px) translateZ(${-halfW}px) rotateY(${rotateY}deg) `
      + `translateZ(${pivotX}px) rotateX(${rotateX}deg) translateZ(${-pivotX}px)`;
  };
  cube.style.transform = transform(0, 0, 0);
  let done = false;

  return {
    width,
    height,
    get rotateX() { return state.rotateX; },
    get rotateY() { return state.rotateY; },

    update({ rotateX = state.rotateX, rotateY = state.rotateY, pull = state.pull } = {}) {
      if (done) return;
      state.rotateX = clamp(rotateX, -90, 90);
      state.rotateY = clamp(rotateY, -90, 90);
      state.pull = pull;
      cube.style.transform = transform(state.rotateX, state.rotateY, state.pull);
      emit('cube:scrub', { rotateX: state.rotateX, rotateY: state.rotateY });
    },

    /** Animates to the given direction's face, or back to rest when null, then tears down. */
    async finish(direction = null) {
      if (done) return orientation.front;
      done = true;
      const spec = direction ? TURNS[direction] : null;
      const to = {
        rotateX: spec && spec.axis === 'X' ? spec.angle : 0,
        rotateY: spec && spec.axis === 'Y' ? spec.angle : 0,
      };
      const from = { ...state };
      const distance = Math.max(
        Math.abs(to.rotateX - from.rotateX),
        Math.abs(to.rotateY - from.rotateY),
      ) / 90;
      const duration = Math.max(180, Math.round(knobs.duration * Math.max(distance, 0.2)));
      const steps = 24;
      const keyframes = Array.from({ length: steps + 1 }, (_, i) => {
        const o = i / steps;
        return {
          offset: o,
          transform: transform(
            from.rotateX + (to.rotateX - from.rotateX) * o,
            from.rotateY + (to.rotateY - from.rotateY) * o,
            from.pull * (1 - o),
          ),
        };
      });
      emit('cube:turning', {
        direction: spec ? direction : null,
        face: spec ? turnOrientation(orientation, direction).front : orientation.front,
        duration,
        easing: knobs.easing,
        from: { rotateX: from.rotateX, rotateY: from.rotateY },
        to,
      });
      const animation = cube.animate(keyframes, { duration, easing: knobs.easing, fill: 'forwards' });
      try {
        await animation.finished;
      } catch (e) {
        // animation cancelled, still settle
      }
      const fromFace = orientation.front;
      if (spec) {
        orientation = turnOrientation(orientation, direction);
        saveOrientation();
      }
      await nextFrame();
      applyFace();
      overlay.remove();
      unlock();
      session = null;
      emit('cube:settled', { direction: spec ? direction : null, face: orientation.front });
      if (spec) emit('cube:rotated', { from: fromFace, to: orientation.front, direction });
      return orientation.front;
    },
  };
}

/**
 * Starts a scrubbable session.
 * @returns {Promise<object|null>} the session, or null when the cube is busy
 */
async function begin() {
  if (pending || session) return null;
  pending = createSession();
  try {
    session = await pending;
  } finally {
    pending = null;
  }
  return session;
}

function isBusy() {
  return Boolean(pending || session || rotating);
}

/**
 * Rotates the cube one quarter turn. Calls made while a turn is running are ignored and
 * resolve with the running turn.
 * @param {'left'|'right'|'up'|'down'} direction where the current content moves
 * @returns {Promise<string>} the face now in front
 */
function rotate(direction) {
  const spec = TURNS[direction];
  if (!spec) throw new Error(`cube: unknown direction "${direction}"`);
  if (rotating) return rotating;
  if (pending || session) return Promise.resolve(orientation.front);
  rotating = (async () => {
    if (reduceMotion()) {
      const from = orientation.front;
      orientation = turnOrientation(orientation, direction);
      saveOrientation();
      applyFace();
      emit('cube:settled', { direction, face: orientation.front });
      emit('cube:rotated', { from, to: orientation.front, direction });
      return orientation.front;
    }
    const s = await begin();
    return s.finish(direction);
  })().finally(() => { rotating = null; });
  return rotating;
}

/** @returns {string} the face currently in front */
function currentFace() {
  return orientation.front;
}

/** @returns {Record<string, string>} a copy of the cube orientation, position → face */
function getOrientation() {
  return { ...orientation };
}

loadOrientation();
applyFace();

document.addEventListener('cube:rotate', (e) => {
  const direction = e.detail && e.detail.direction;
  if (TURNS[direction]) rotate(direction);
});

window.cube = {
  rotate,
  begin,
  currentFace,
  getOrientation,
  isBusy,
  directionFor,
  turnOrientation,
  registerFace,
  clonePage,
  syncAnimations,
  settings,
};
