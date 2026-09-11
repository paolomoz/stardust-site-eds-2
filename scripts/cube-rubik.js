/*
 * Cube layer — Rubik face
 *
 * One face of the cube (RUBIK_FACE) is a puzzle. The page is split into a 2×3 grid of
 * squares, each showing its part of the page in one palette. A row or a column is a layer
 * of the cube: drag it and the whole layer turns as one slab around the cube's axis, the
 * way a Rubik's cube layer does, and the strip on the neighbouring side comes to the front.
 * Goal: all six squares in one palette, whichever you like.
 *
 * Model: a layer is a ring of four strips around the cube, the front strip and three hidden
 * ones. Every square keeps its own stickers on the two rings that pass through it (its row
 * and its column), seven in all: the one in front, three on the row ring and three on the
 * column ring. A turn rotates the ring of every square in the layer by one step. Each pool
 * of seven holds all six palettes, and a column turn followed by a row turn and back moves a
 * single square's stickers without touching the others, so every state is solvable for
 * every palette.
 *
 * The face's own palette (`[data-cube-face="back"]` by default) is only ever seen inside
 * the squares. Talks to the engine through `window.cube` (registerFace, clonePage, settings,
 * directionFor) and the cube:* events; everything it adds to the page is marked
 * data-cube-exclude. Fires `rubik:moved { moves, solved }` and `rubik:solved { palette, moves }`.
 *
 * On the Rubik face the page itself is the puzzle: pointer drags on it turn layers, wheel
 * still scrolls the page underneath (the squares follow), and the cube is left through the
 * edge handles, the widget or the keyboard.
 */

(() => {
  const { cube } = window;
  if (!cube || !cube.registerFace) return;

  const RUBIK_FACE = 'back';
  const ROWS = 2;
  const COLS = 3;
  const PALETTES = ['front', 'back', 'left', 'right', 'top', 'bottom'];
  const STORAGE_KEY = 'rubik-state';
  const SLOP = 6; // px before a press becomes a drag
  const COMMIT_ANGLE = 22; // degrees that commit a turn on release
  const FLICK = 0.5; // px/ms that commit a turn on release
  const GAIN = 2; // a drag of depth / GAIN px is a full turn, as on the big cube
  const ANGLE = {
    left: -90, right: 90, up: 90, down: -90,
  };
  const AXIS = {
    left: 'Y', right: 'Y', up: 'X', down: 'X',
  };
  // hidden ring positions in forward order: the first comes in on `left` / `up`
  const RING = { Y: ['right', 'back', 'left'], X: ['bottom', 'back', 'top'] };
  const PLACEMENT = {
    right: 'rotateY(90deg)',
    left: 'rotateY(-90deg)',
    bottom: 'rotateX(-90deg)',
    top: 'rotateX(90deg)',
  };

  // per square, row-major: { front, Y: [right, back, left], X: [bottom, back, top] }
  let cells = [];
  let moves = 0;
  let stage = null;
  let status = null;
  let turn = null; // layer turn in progress (true while starting)

  const el = (tag, className) => {
    const node = document.createElement(tag);
    node.className = className;
    node.setAttribute('data-cube-exclude', '');
    return node;
  };
  const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(resolve); });
  const pullCurve = (angle) => Math.sin((Math.PI * clamp(Math.abs(angle), 0, 90)) / 90) ** 0.6;
  const viewport = () => ({
    W: document.documentElement.clientWidth,
    H: document.documentElement.clientHeight,
  });
  const cellsOf = (axis, index) => (axis === 'Y'
    ? Array.from({ length: COLS }, (_, c) => [index, c])
    : Array.from({ length: ROWS }, (_, r) => [r, index]));
  const at = (r, c) => cells[r * COLS + c];
  const fronts = () => cells.map((cell) => cell.front);
  const solved = () => new Set(fronts()).size === 1;

  /* ---------------------------------------------------------------- state */

  /** One step of the ring through `cell` on the axis of `direction`. */
  function turnCell(cell, direction) {
    const axis = AXIS[direction];
    const ring = [cell.front, ...cell[axis]];
    if (ANGLE[direction] === (axis === 'Y' ? -90 : 90)) ring.push(ring.shift());
    else ring.unshift(ring.pop());
    return { ...cell, front: ring[0], [axis]: ring.slice(1) };
  }

  function applyTurn(axis, index, direction) {
    cellsOf(axis, index).forEach(([r, c]) => {
      cells[r * COLS + c] = turnCell(at(r, c), direction);
    });
  }

  /** Six different palettes in front; every square's pool holds all six. */
  function reset() {
    cells = Array.from({ length: ROWS * COLS }, (_, i) => {
      const p = (k) => PALETTES[(i + k) % PALETTES.length];
      return { front: p(0), Y: [p(1), p(2), p(3)], X: [p(4), p(5), p(2)] };
    });
    moves = 0;
  }

  function load() {
    reset();
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      const palette = (v) => PALETTES.includes(v);
      const ring = (v) => Array.isArray(v) && v.length === 3 && v.every(palette);
      const validCell = (cell) => cell && palette(cell.front) && ring(cell.Y) && ring(cell.X);
      const valid = stored && Array.isArray(stored.cells) && stored.cells.length === ROWS * COLS
        && stored.cells.every(validCell);
      if (valid) {
        cells = stored.cells.map((cell) => ({
          front: cell.front, Y: [...cell.Y], X: [...cell.X],
        }));
        moves = Number(stored.moves) || 0;
      }
    } catch (e) {
      // no storage, start fresh
    }
  }

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cells, moves }));
    } catch (e) {
      // no storage
    }
  }

  function scramble() {
    const directions = Object.keys(ANGLE);
    do {
      reset();
      for (let i = 0; i < 14; i += 1) {
        const direction = directions[Math.floor(Math.random() * directions.length)];
        const axis = AXIS[direction];
        applyTurn(axis, Math.floor(Math.random() * (axis === 'Y' ? ROWS : COLS)), direction);
      }
    } while (solved());
    moves = 0;
    save();
  }

  /* ---------------------------------------------------------------- rendering */

  /** Width of the plastic gutter around a sticker, from --rubik-gutter. */
  const gutter = () => parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--rubik-gutter')) || 0;

  /**
   * A square: a sticker inset by the gutter, showing the page in `palette` clipped to
   * cell (r, c). The page stays pixel-aligned across stickers; the gutters crop it.
   */
  function buildSquare(palette, r, c) {
    const { W, H } = viewport();
    const g = gutter();
    const square = el('div', 'rubik-square');
    const sticker = el('div', 'rubik-sticker cube-face');
    sticker.setAttribute('data-cube-face', palette);
    const vp = el('div', 'rubik-viewport');
    vp.style.width = `${W}px`;
    vp.style.height = `${H}px`;
    vp.style.left = `${-((c * W) / COLS + g)}px`;
    vp.style.top = `${-((r * H) / ROWS + g)}px`;
    vp.append(...cube.clonePage());
    sticker.append(vp);
    square.append(sticker);
    return square;
  }

  function buildTile(r, c) {
    const tile = el('div', 'rubik-tile');
    tile.dataset.row = r;
    tile.dataset.col = c;
    tile.style.left = `${(c * 100) / COLS}%`;
    tile.style.top = `${(r * 100) / ROWS}%`;
    tile.style.width = `${100 / COLS}%`;
    tile.style.height = `${100 / ROWS}%`;
    tile.append(buildSquare(at(r, c).front, r, c));
    return tile;
  }

  function buildGrid(container) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) container.append(buildTile(r, c));
    }
  }

  function syncScroll(container) {
    container.querySelectorAll('.rubik-viewport').forEach((vp) => {
      vp.scrollTop = window.scrollY;
      vp.scrollLeft = window.scrollX;
    });
  }

  // the big cube renders this face as the grid, both arriving and leaving
  cube.registerFace(RUBIK_FACE, {
    build: (faceEl) => {
      faceEl.classList.add('rubik-composite');
      buildGrid(faceEl);
    },
    sync: (faceEl) => {
      syncScroll(faceEl);
      cube.syncAnimations(faceEl);
    },
  });

  /* ---------------------------------------------------------------- widget mini grid */

  function decorateWidget() {
    const face = document.querySelector(`.cube-widget .cube-face[data-cube-face="${RUBIK_FACE}"]`);
    if (!face) return;
    face.classList.add('rubik-mini');
    face.replaceChildren(...fronts().map((palette) => {
      const cell = el('span', 'rubik-mini-cell cube-face');
      cell.setAttribute('data-cube-face', palette);
      return cell;
    }));
  }

  /* ---------------------------------------------------------------- status chip */

  function updateStatus() {
    if (!status) return;
    const text = status.querySelector('.rubik-status-text');
    const count = `${moves} ${moves === 1 ? 'move' : 'moves'}`;
    if (solved()) text.textContent = `Solved in ${count}. All ${fronts()[0]}.`;
    else if (moves === 0) text.textContent = 'Drag a row sideways or a column up and down. Make all six squares one colour.';
    else text.textContent = count;
    status.classList.toggle('solved', solved());
    if (stage) stage.classList.toggle('solved', solved());
  }

  let renderedAt = -1; // scrollY of the last snapshot

  function rerender() {
    if (!stage || turn) return;
    requestAnimationFrame(() => {
      if (!stage || turn) return;
      stage.replaceChildren();
      buildGrid(stage);
      syncScroll(stage);
      cube.syncAnimations(stage);
      renderedAt = window.scrollY;
      updateStatus();
      decorateWidget();
    });
  }

  let resizeTimer = null;
  let settleTimer = null;
  // squares follow the scroll at once and are re-snapshotted once scrolling settles, since
  // pages change layout, classes and canvases as they scroll
  const onScroll = () => {
    if (!stage) return;
    syncScroll(stage);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (!cube.isBusy() && window.scrollY !== renderedAt) rerender();
    }, 250);
  };
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rerender, 150);
  };

  function mountStatus() {
    status = el('div', 'rubik-status');
    const text = el('span', 'rubik-status-text');
    const button = el('button', 'rubik-scramble');
    button.type = 'button';
    button.textContent = 'Scramble';
    button.addEventListener('click', () => {
      if (turn) return;
      scramble();
      rerender();
    });
    status.append(text, button);
    document.body.append(status);
    updateStatus();
  }

  /* ---------------------------------------------------------------- layer turns */

  function lockScroll() {
    const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
    const opts = { capture: true, passive: false };
    ['wheel', 'touchmove'].forEach((t) => window.addEventListener(t, block, opts));
    return () => ['wheel', 'touchmove'].forEach((t) => window.removeEventListener(t, block, opts));
  }

  /**
   * Lifts a row (axis Y) or column (axis X) into a slab: a band clipped to the layer, with
   * the same perspective as the whole page, holding the front strip and both neighbouring
   * strips of the ring. The slab turns around the cube's axis like the big cube does.
   */
  async function beginTurn(axis, index) {
    const { W, H } = viewport();
    const w = W / COLS;
    const h = H / ROWS;
    const knobs = cube.settings();
    const depth = axis === 'Y' ? W : H;
    const half = depth / 2;
    const list = cellsOf(axis, index);

    const band = el('div', 'rubik-band');
    band.style.perspective = `${Math.max(W, H) * knobs.perspective}px`;
    if (axis === 'Y') {
      Object.assign(band.style, {
        left: '0px', top: `${index * h}px`, width: `${W}px`, height: `${h}px`,
      });
      band.style.perspectiveOrigin = `50% ${H / 2 - index * h}px`;
    } else {
      Object.assign(band.style, {
        left: `${index * w}px`, top: '0px', width: `${w}px`, height: `${H}px`,
      });
      band.style.perspectiveOrigin = `${W / 2 - index * w}px 50%`;
    }
    const slab = el('div', 'rubik-slab');
    const strip = (pick) => {
      const s = el('div', 'rubik-strip');
      list.forEach(([r, c], k) => {
        const square = buildSquare(pick(at(r, c)), r, c);
        Object.assign(square.style, axis === 'Y'
          ? {
            left: `${k * w}px`, top: '0px', width: `${w}px`, height: `${h}px`,
          }
          : {
            left: '0px', top: `${k * h}px`, width: `${w}px`, height: `${h}px`,
          });
        s.append(square);
      });
      return s;
    };

    await nextFrame(); // canvases readable, see cube.clonePage
    const front = strip((cell) => cell.front);
    front.style.transform = `translateZ(${half}px)`;
    const next = strip((cell) => cell[axis][0]);
    next.style.transform = `${PLACEMENT[RING[axis][0]]} translateZ(${half}px)`;
    const prev = strip((cell) => cell[axis][2]);
    prev.style.transform = `${PLACEMENT[RING[axis][2]]} translateZ(${half}px)`;
    slab.append(front, next, prev);
    band.append(slab);
    stage.append(band);
    const lifted = list.map(([r, c]) => stage.querySelector(`.rubik-tile[data-row="${r}"][data-col="${c}"]`));
    lifted.forEach((tile) => tile.classList.add('lifted'));
    syncScroll(band);
    cube.syncAnimations(band);
    const unlock = lockScroll();

    const transform = (angle) => `translateZ(${-depth * knobs.pullback * pullCurve(angle)}px) `
      + `translateZ(${-half}px) rotate${axis}(${angle}deg)`;
    let angle = 0;
    let done = false;
    slab.style.transform = transform(0);

    return {
      depth,
      update(a) {
        if (done) return;
        angle = clamp(a, -90, 90);
        slab.style.transform = transform(angle);
      },
      async finish(direction) {
        if (done) return;
        done = true;
        const target = direction ? ANGLE[direction] : 0;
        const distance = Math.abs(target - angle) / 90;
        const duration = Math.max(180, Math.round(knobs.duration * Math.max(distance, 0.2)));
        const steps = 24;
        const keyframes = Array.from({ length: steps + 1 }, (_, i) => ({
          offset: i / steps,
          transform: transform(angle + ((target - angle) * i) / steps),
        }));
        try {
          await slab.animate(keyframes, { duration, easing: knobs.easing, fill: 'forwards' }).finished;
        } catch (e) {
          // cancelled, still settle
        }
        if (direction) {
          applyTurn(axis, index, direction);
          moves += 1;
          save();
        }
        await nextFrame();
        lifted.forEach((tile, k) => {
          const [r, c] = list[k];
          tile.replaceChildren(buildSquare(at(r, c).front, r, c));
          tile.classList.remove('lifted');
        });
        syncScroll(stage);
        cube.syncAnimations(stage);
        band.remove();
        unlock();
        turn = null;
        updateStatus();
        decorateWidget();
        if (direction) {
          emit('rubik:moved', { moves, solved: solved() });
          if (solved()) emit('rubik:solved', { palette: fronts()[0], moves });
        }
      },
    };
  }

  function onPointerDown(e) {
    if (e.button !== 0 || !e.isPrimary || turn || cube.isBusy()) return;
    if (e.target instanceof Element && e.target.closest('.rubik-status')) return;
    e.preventDefault();
    const html = document.documentElement;
    const { W, H } = viewport();
    const row = clamp(Math.floor(e.clientY / (H / ROWS)), 0, ROWS - 1);
    const col = clamp(Math.floor(e.clientX / (W / COLS)), 0, COLS - 1);
    const { pointerId } = e;
    const origin = { x: e.clientX, y: e.clientY };
    let latest = { ...origin };
    let last = { ...origin, t: e.timeStamp };
    const velocity = { x: 0, y: 0 };
    let axis = null;
    let layer = null;
    let starting = false;
    let ended = false;
    const handlers = {};

    const cleanup = () => {
      Object.keys(handlers).forEach((t) => stage.removeEventListener(t, handlers[t]));
      html.classList.remove('cube-dragging');
    };
    const angleOf = () => (axis === 'Y'
      ? (90 * (latest.x - origin.x) * GAIN) / layer.depth
      : (-90 * (latest.y - origin.y) * GAIN) / layer.depth);
    const release = () => {
      const angle = angleOf();
      const v = axis === 'Y' ? velocity.x : -velocity.y;
      const flick = Math.abs(v) > FLICK && Math.sign(v) === Math.sign(angle) && Math.abs(angle) > 3;
      const commit = Math.abs(angle) > COMMIT_ANGLE || flick;
      layer.finish(commit ? cube.directionFor(axis, angle < 0 ? -90 : 90) : null);
      cleanup();
    };
    const start = async (a) => {
      starting = true;
      axis = a;
      turn = true;
      html.classList.add('cube-dragging');
      layer = await beginTurn(a, a === 'Y' ? row : col);
      turn = layer;
      starting = false;
      if (ended) release();
      else layer.update(angleOf());
    };

    Object.assign(handlers, {
      pointermove(ev) {
        if (ev.pointerId !== pointerId) return;
        latest = { x: ev.clientX, y: ev.clientY };
        if (!layer) {
          if (starting) return;
          const ox = latest.x - origin.x;
          const oy = latest.y - origin.y;
          if (Math.hypot(ox, oy) < SLOP) return;
          start(Math.abs(ox) >= Math.abs(oy) ? 'Y' : 'X');
          return;
        }
        const dt = Math.max(1, ev.timeStamp - last.t);
        velocity.x = velocity.x * 0.6 + ((ev.clientX - last.x) / dt) * 0.4;
        velocity.y = velocity.y * 0.6 + ((ev.clientY - last.y) / dt) * 0.4;
        last = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
        layer.update(angleOf());
      },
      pointerup(ev) {
        if (ev.pointerId !== pointerId) return;
        ended = true;
        if (layer) release();
        else if (!starting) cleanup();
      },
      pointercancel(ev) {
        if (ev.pointerId !== pointerId) return;
        ended = true;
        velocity.x = 0;
        velocity.y = 0;
        if (layer) release();
        else if (!starting) cleanup();
      },
    });
    Object.keys(handlers).forEach((t) => stage.addEventListener(t, handlers[t]));
    try {
      stage.setPointerCapture(pointerId);
    } catch (err) {
      // best effort
    }
  }

  /* ---------------------------------------------------------------- stage */

  async function mount() {
    if (stage) return;
    stage = el('div', 'rubik-stage');
    await nextFrame(); // canvases readable, see cube.clonePage
    buildGrid(stage);
    document.body.append(stage);
    syncScroll(stage);
    cube.syncAnimations(stage);
    renderedAt = window.scrollY;
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    mountStatus();
    decorateWidget();
  }

  function unmount() {
    if (!stage) return;
    clearTimeout(settleTimer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    stage.remove();
    stage = null;
    if (status) status.remove();
    status = null;
  }

  /* ---------------------------------------------------------------- wiring */

  document.addEventListener('cube:turning', (e) => {
    if (e.detail.face === RUBIK_FACE) mount();
  });
  document.addEventListener('cube:settled', (e) => {
    if (e.detail.face === RUBIK_FACE) mount();
    else unmount();
  });

  load();
  const init = () => {
    // late enough for the page to have rendered once, so the squares show real content
    setTimeout(() => {
      decorateWidget();
      if (cube.currentFace() === RUBIK_FACE) mount();
    }, 300);
  };
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.cubeRubik = {
    scramble: () => { if (!turn) { scramble(); rerender(); } },
    reset: () => { if (!turn) { reset(); save(); rerender(); } },
    fronts,
    solved,
  };
})();
