/*
 * Cube layer — triggers and discoverability
 *
 * Talks to the engine (scripts/cube.js) only through `window.cube` and the `cube:*` events.
 * Everything it adds to the page is marked `data-cube-exclude` so it never ends up inside
 * a cube face.
 *
 *   - Page press: pointer down and hold on the page pulls the cube back a little and tilts
 *     it toward the pointer, showing the neighbouring faces. A horizontal move also starts
 *     the drag; a vertical one is left to scrolling and text selection. Once the cube is in
 *     hand it turns freely on both axes. On release the dominant axis commits past the
 *     threshold or on a flick, the other axis springs back.
 *   - Edge handles: thin strips on the four viewport edges. Drag one inward to pull that
 *     side's face in.
 *   - Widget: a small live cube in the corner mirrors the orientation. Drag it, click an
 *     arrow, or focus it and use the arrow keys. Arrows and keys use "look" semantics: the
 *     right arrow shows the face on the right.
 *     The widget fades in once the page has loaded and is the cube's discoverability element:
 *     the site opens straight into the page, nothing interrupts the first screen.
 *
 * Alt + arrow keys turn as well, with the same look semantics.
 */

(() => {
  const { cube } = window;
  if (!cube) return;

  const SLOP = 6; // px before a press becomes a drag
  const HOLD = 160; // ms before a still press becomes a hold
  const COMMIT_ANGLE = 22; // degrees of drag that commit a turn on release
  const FLICK = 0.5; // px/ms along the axis that commit a turn on release
  const PAGE_GAIN = 2; // a drag of depth / PAGE_GAIN px is a full turn
  const WIDGET_TURN_PX = 140; // widget drag for a full turn
  const PRESS_TILT = 4; // degrees of tilt toward the pointer while pressing
  const PRESS_PULL = 0.03; // camera pull-back while pressing, fraction of depth

  const INTERACTIVE = 'a, button, input, textarea, select, label, summary, [contenteditable], [data-cube-exclude]';
  // arrow pointing at a side shows the face on that side, i.e. content moves the other way
  const LOOK = {
    left: 'right', right: 'left', up: 'down', down: 'up',
  };
  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  };
  const FACE_AT = {
    up: 'top', down: 'bottom', left: 'left', right: 'right',
  };
  const PLACE = {
    front: '',
    back: 'rotateY(180deg)',
    left: 'rotateY(-90deg)',
    right: 'rotateY(90deg)',
    top: 'rotateX(90deg)',
    bottom: 'rotateX(-90deg)',
  };

  const el = (tag, className) => {
    const node = document.createElement(tag);
    node.className = className;
    node.setAttribute('data-cube-exclude', '');
    return node;
  };

  /* ---------------------------------------------------------------- gesture tracking */

  /**
   * Follows one pointer from `e` until release and drives a cube session with it. Both
   * axes are live while dragging; on release the dominant axis may commit a turn and the
   * other one springs back.
   * @param {PointerEvent} e the pointerdown
   * @param {object} opts
   * @param {boolean} [opts.deferred] start on hold or horizontal slop instead of at once
   * @param {boolean} [opts.press] tilt toward the pointer while pressed
   * @param {number} [opts.turnPx] drag length of a full turn, default viewport / PAGE_GAIN
   * @param {object} [opts.session] an already running session to drive instead of a new one
   * @param {number} [opts.pull] constant camera pull-back to keep while dragging
   * @param {Function} [opts.onEnd]
   */
  function track(e, opts) {
    const html = document.documentElement;
    const target = e.currentTarget instanceof Element ? e.currentTarget : e.target;
    const { pointerId } = e;
    const origin = { x: e.clientX, y: e.clientY };
    let latest = { ...origin };
    let last = { ...origin, t: e.timeStamp };
    const velocity = { x: 0, y: 0 }; // px/ms
    let sess = null;
    let starting = false;
    let ended = false;
    let holdTimer = null;
    const handlers = {};

    const cleanup = () => {
      clearTimeout(holdTimer);
      Object.keys(handlers).forEach((t) => target.removeEventListener(t, handlers[t]));
      html.classList.remove('cube-dragging');
      if (opts.onEnd) opts.onEnd();
    };

    // rotateY follows horizontal movement, rotateX vertical; dragging up is the `up` turn
    const angles = () => ({
      rotateY: (90 * (latest.x - origin.x)) / (opts.turnPx || sess.width / PAGE_GAIN),
      rotateX: (-90 * (latest.y - origin.y)) / (opts.turnPx || sess.height / PAGE_GAIN),
    });

    const apply = () => {
      if (!sess) return;
      const a = angles();
      let pull = opts.pull || 0;
      if (opts.press) {
        // pressing a side pushes it away
        const px = (latest.x - window.innerWidth / 2) / (window.innerWidth / 2);
        const py = (latest.y - window.innerHeight / 2) / (window.innerHeight / 2);
        a.rotateY += px * PRESS_TILT;
        a.rotateX += -py * PRESS_TILT;
        pull = sess.width * PRESS_PULL;
      }
      sess.update({ rotateX: a.rotateX, rotateY: a.rotateY, pull });
    };

    const release = () => {
      const a = angles();
      const axis = Math.abs(a.rotateY) >= Math.abs(a.rotateX) ? 'Y' : 'X';
      const angle = axis === 'Y' ? a.rotateY : a.rotateX;
      const v = axis === 'Y' ? velocity.x : -velocity.y;
      const flick = Math.abs(v) > FLICK
        && Math.sign(v) === Math.sign(angle)
        && Math.abs(angle) > 3;
      const commit = Math.abs(angle) > COMMIT_ANGLE || flick;
      sess.finish(commit ? cube.directionFor(axis, angle < 0 ? -90 : 90) : null);
      cleanup();
    };

    const begin = async () => {
      if (starting || sess || ended) return;
      starting = true;
      clearTimeout(holdTimer);
      html.classList.add('cube-dragging');
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      sess = opts.session || await cube.begin();
      starting = false;
      if (!sess) {
        cleanup();
        return;
      }
      if (ended) release();
      else apply();
    };

    Object.assign(handlers, {
      pointermove(ev) {
        if (ev.pointerId !== pointerId) return;
        latest = { x: ev.clientX, y: ev.clientY };
        if (!sess && !starting) {
          const ox = latest.x - origin.x;
          const oy = latest.y - origin.y;
          if (Math.hypot(ox, oy) < SLOP) return;
          if (opts.deferred && Math.abs(oy) > Math.abs(ox)) {
            // vertical intent on the page belongs to scrolling and selection
            ended = true;
            cleanup();
            return;
          }
          begin();
          return;
        }
        const dt = Math.max(1, ev.timeStamp - last.t);
        velocity.x = velocity.x * 0.6 + ((ev.clientX - last.x) / dt) * 0.4;
        velocity.y = velocity.y * 0.6 + ((ev.clientY - last.y) / dt) * 0.4;
        last = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
        apply();
      },
      pointerup(ev) {
        if (ev.pointerId !== pointerId) return;
        ended = true;
        if (sess) release();
        else if (!starting) cleanup();
      },
      pointercancel(ev) {
        // the browser took the pointer, typically to scroll
        if (ev.pointerId !== pointerId) return;
        ended = true;
        velocity.x = 0;
        velocity.y = 0;
        if (sess) release();
        else if (!starting) cleanup();
      },
    });

    Object.keys(handlers).forEach((t) => target.addEventListener(t, handlers[t]));
    try {
      target.setPointerCapture(pointerId);
    } catch (err) {
      // capture is best effort
    }

    if (opts.deferred) holdTimer = setTimeout(begin, HOLD);
    else begin();
  }

  /* ---------------------------------------------------------------- page press and drag */

  function pagePress() {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary || cube.isBusy()) return;
      if (!(e.target instanceof Element) || e.target.closest(INTERACTIVE)) return;
      track(e, { deferred: true, press: true });
    });
  }

  /* ---------------------------------------------------------------- edge handles */

  function edges() {
    ['left', 'right', 'top', 'bottom'].forEach((edge) => {
      const zone = el('div', 'cube-edge');
      zone.dataset.edge = edge;
      zone.setAttribute('aria-hidden', 'true');
      zone.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || cube.isBusy()) return;
        e.preventDefault();
        zone.classList.add('active');
        track(e, { onEnd: () => zone.classList.remove('active') });
      });
      document.body.append(zone);
    });
  }

  /* ---------------------------------------------------------------- widget */

  function widget() {
    const box = el('div', 'cube-widget');
    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Turn the page. Drag the cube, click an arrow or use the arrow keys.');
    box.title = 'Turn the page: drag, click an arrow, or press the arrow keys';

    const scene = el('div', 'cube-widget-scene');
    const sway = el('div', 'cube-widget-sway');
    const bob = el('div', 'cube-widget-bob');
    const mini = el('div', 'cube-widget-cube');
    const faces = {};
    Object.values(cube.getOrientation()).forEach((name) => {
      const face = el('div', 'cube-face');
      face.setAttribute('data-cube-face', name);
      faces[name] = face;
      mini.append(face);
    });
    bob.append(mini);
    sway.append(bob);
    scene.append(sway);
    box.append(scene);

    ['up', 'right', 'down', 'left'].forEach((side) => {
      const arrow = el('button', 'cube-widget-arrow');
      arrow.type = 'button';
      arrow.dataset.side = side;
      arrow.setAttribute('aria-label', `Show the ${FACE_AT[side]} face`);
      arrow.addEventListener('click', () => cube.rotate(LOOK[side]));
      box.append(arrow);
    });

    const BASE = 'rotateX(-22deg) rotateY(-32deg)';
    const place = () => {
      const size = scene.clientWidth;
      Object.entries(cube.getOrientation()).forEach(([position, name]) => {
        faces[name].style.transform = `${PLACE[position]} translateZ(${size / 2}px)`;
      });
    };
    const rest = () => {
      mini.getAnimations().forEach((a) => a.cancel());
      mini.style.transform = BASE;
    };
    // same composition order as the engine: Y outside, X inside
    const pose = (r) => `${BASE} rotateY(${r.rotateY}deg) rotateX(${r.rotateX}deg)`;

    document.addEventListener('cube:scrub', (e) => { mini.style.transform = pose(e.detail); });
    document.addEventListener('cube:turning', (e) => {
      const {
        from, to, duration, easing,
      } = e.detail;
      mini.animate([{ transform: pose(from) }, { transform: pose(to) }], { duration, easing, fill: 'forwards' });
    });
    document.addEventListener('cube:settled', () => { place(); rest(); });

    scene.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || cube.isBusy()) return;
      e.preventDefault();
      track(e, { turnPx: WIDGET_TURN_PX });
    });
    box.addEventListener('keydown', (e) => {
      const side = KEYS[e.key];
      if (!side || e.altKey || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      cube.rotate(LOOK[side]);
    });

    document.body.append(box);
    requestAnimationFrame(() => { place(); rest(); });
    return box;
  }

  /* ---------------------------------------------------------------- keyboard */

  function keyboard() {
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const side = KEYS[e.key];
      if (!side) return;
      e.preventDefault();
      cube.rotate(LOOK[side]);
    });
  }

  /* ---------------------------------------------------------------- init */

  const init = () => {
    pagePress();
    edges();
    const box = widget();
    keyboard();
    const afterLoad = () => box.classList.add('show');
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad);
  };
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
