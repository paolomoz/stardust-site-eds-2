/**
 * chapters — a series of stacked full-viewport panels behind an intro (prototype sections
 * "7 · SERIES A · REDESIGN" and "7 · SERIES B · MIGRATE"). Same pattern, two skins: variants
 * `redesign` and `migrate`.
 *
 * Authoring rows (container shape):
 *   1. intro — 3 cells: [h2 (two lines, <br>) + lede p] [quote p (<em>) + attribution p]
 *      [optional <ul> of flow boxes: <li><strong>Title</strong> description</li>; empty otherwise]
 *   2..n chapter — 3 cells: [h3 name + p><code> command] [h4 title (<br>) + paragraph]
 *      [p><strong> label + <ul> bullets + p><a> CTA bar]
 *
 * Chapter numbers come from the row index. Panel themes and the mock illustrations are design,
 * keyed by variant and by the lowercased chapter name (extract, direct, prototype, replica,
 * deploy, rollout). Authored elements are moved, never rebuilt.
 *
 * @ew-exempt none — every authored text is moved into the layout.
 */

import {
  reveal, stagger, splitLines, observe, onlyChild, reduced,
} from '../../scripts/motion.js';
import { todayISO } from '../../scripts/seed.js';

const THEMES = {
  redesign: ['light', 'blue', 'gold'],
  migrate: ['navy', 'light', 'gold'],
};

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const cells = (row) => [...row.children];
const isCodeP = (p) => onlyChild(p, 'code');
const isStrongP = (p) => onlyChild(p, 'strong');
const isEmP = (p) => onlyChild(p, 'em');
const hasLink = (p) => p.querySelector('a');

/* ---------------------------------------------------------------- mocks (design, not copy) */

const BAR = '<i></i><i></i><i></i>';

const MOCKS = {
  extract() {
    const m = el('div', 'mock mock-capture');
    m.setAttribute('data-reveal', 'scale');
    m.style.setProperty('--i', 2);
    m.innerHTML = `<div class="bar">${BAR}<span class="url">https://www.example.com/</span><span class="end">5 pages</span></div>
      <div class="stage">
        <span class="label">Brand surface</span>
        <div class="swatches" data-stagger><i style="background:#0b1f3a"></i><i style="background:#1c3f6e"></i><i style="background:#8fa9c9"></i><i style="background:#e9e4d8"></i><i style="background:#c8552d"></i></div>
        <div class="type"><div class="aa">Aa</div><div class="rows" data-stagger><span style="width:90%"></span><span style="width:70%"></span><span style="width:80%"></span><span style="width:45%"></span></div></div>
        <div class="tags" data-stagger><b>serif display</b><b>1.25 scale</b><b>radius 12px</b><b>voice: assured</b><b>5 pages</b><b>gradient blob hero</b></div>
      </div>`;
    return m;
  },
  direct() {
    const m = el('div', 'mock mock-seed');
    m.setAttribute('data-reveal', 'scale');
    m.style.setProperty('--i', 2);
    m.innerHTML = `<div class="bar">${BAR}<span class="url">/stardust:direct</span><span class="end">seed &middot; <span data-date>${todayISO()}</span></span></div>
      <div class="stage">
        <span class="label">md5("example.com" &middot; today)</span>
        <div class="hash" data-hash><span data-final="a3f7c92e">a3f7c92e</span><span data-final="8b1d488a">8b1d488a</span><span data-final="0c5ef691">0c5ef691</span><span data-final="3427bbd1">3427bbd1</span></div>
        <div class="eq">&rarr; resolves to</div>
        <div class="roll" data-stagger>
          <div><span class="k">decade</span><span class="v"><span>1970s</span></span><span class="p">a3</span></div>
          <div><span class="k">craft</span><span class="v"><span>letterpress</span></span><span class="p">f7</span></div>
          <div><span class="k">register</span><span class="v"><span>editorial</span></span><span class="p">c9</span></div>
          <div><span class="k">ground</span><span class="v"><span>inherited</span></span><span class="p">&mdash;</span></div>
        </div>
        <i class="core" aria-hidden="true"></i>
      </div>`;
    return m;
  },
  prototype() {
    const m = el('div', 'mock mock-ba');
    m.setAttribute('data-reveal', 'scale');
    m.setAttribute('data-ba', '');
    m.style.setProperty('--i', 2);
    m.innerHTML = `<div class="bar"><span class="tabs"><b class="on">Before</b><b>After</b><i class="ind"></i></span><span class="end">6 viewports</span></div>
      <div class="stage">
        <div class="page before">
          <div class="nav"></div><div class="hero"><span></span><span></span></div><div class="row"><span></span><span></span><span></span></div><div class="txt"><span></span><span></span><span></span></div>
        </div>
        <div class="page after">
          <div class="nav"></div><div class="hero big"><span></span><span class="gold"></span></div><div class="row"><span></span><span></span></div><div class="txt"><span></span><span></span></div>
        </div>
      </div>`;
    return m;
  },
  replica() {
    const m = el('div', 'mock mock-replica');
    m.setAttribute('data-reveal', 'scale');
    m.style.setProperty('--i', 2);
    const pg = '<div class="pg"><div class="n"></div><div class="h"></div><div class="r"><span></span><span></span><span></span></div><div class="t"><span></span><span></span></div></div>';
    m.innerHTML = `<div class="bar">${BAR}<span class="url">gate &middot; 2 breakpoints</span><span class="pass end">diff &lt; 2% &#10003;</span></div>
      <div class="stage">
        <div class="pair">
          <div class="thumb"><span class="label">live</span>${pg}</div>
          <div class="thumb"><span class="label">replica</span>${pg}<i class="scan" aria-hidden="true"></i></div>
        </div>
        <div class="gates" data-stagger><b>structure &#10003;</b><b>visuals &#10003;</b><b>pixel diff &#10003;</b></div>
      </div>`;
    return m;
  },
  deploy() {
    const m = el('div', 'mock mock-blocks');
    m.setAttribute('data-reveal', 'scale');
    m.style.setProperty('--i', 2);
    m.innerHTML = `<div class="bar">${BAR}<span class="url">index.html &rarr; blocks</span><span class="end">preview &middot; publish &middot; check</span></div>
      <div class="stage" data-stagger>
        <div class="blk hero"><span class="name">hero</span></div>
        <div class="blk cards"><span class="name">cards</span><i></i><i></i><i></i></div>
        <div class="blk text"><span class="name">text</span><i></i><i></i></div>
        <div class="blk quote"><span class="name">quote</span></div>
      </div>`;
    return m;
  },
  rollout() {
    const m = el('div', 'mock mock-ledger');
    m.setAttribute('data-reveal', 'scale');
    m.style.setProperty('--i', 2);
    m.innerHTML = `<div class="bar">${BAR}<span class="url">stardust/rollout/ledger.json</span><span class="end">delivered 112 / 134</span></div>
      <div class="stage">
        <div class="meter"><i style="--w:83.6%"></i></div>
        <div class="rows" data-stagger>
          <div><span>/</span><span class="st ok">delivered</span></div>
          <div><span>/about</span><span class="st ok">delivered</span></div>
          <div><span>/products</span><span class="st ok">delivered</span></div>
          <div><span>/products/beans</span><span class="st ok">delivered</span></div>
          <div><span>/news/2026</span><span class="st run">deploying</span></div>
          <div><span>/contact</span><span class="st wait">pending</span></div>
        </div>
        <div class="foot mono-line">shared blocks &#10003; &middot; sitemap &#10003; &middot; redirects &#10003; &middot; links &#10003;</div>
      </div>`;
    return m;
  },
};

/* ---------------------------------------------------------------- mock behaviours */

/** scrambles hex glyphs, settles left→right */
function rollHash(hash) {
  const hex = '0123456789abcdef';
  [...hash.querySelectorAll('span')].forEach((sp, gi) => {
    const final = sp.getAttribute('data-final') || sp.textContent;
    const settleAt = reduced ? 0 : 500 + gi * 260;
    const start = performance.now();
    const tick = (now) => {
      const t = now - start;
      if (t >= settleAt) { sp.textContent = final; return; }
      sp.textContent = [...final].map((ch, i) => (t > settleAt - (final.length - i) * 55
        ? ch : hex[Math.floor(Math.random() * 16)])).join('');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** before / after mock: cycle tabs once revealed, click to pick */
function wireBeforeAfter(mock) {
  const tabs = [...mock.querySelectorAll('.tabs b')];
  let cycle = 0;
  const set = (after) => {
    mock.classList.toggle('after', after);
    tabs[0].classList.toggle('on', !after);
    tabs[1].classList.toggle('on', after);
  };
  tabs.forEach((t, k) => t.addEventListener('click', () => { set(k === 1); clearInterval(cycle); }));
  if (!reduced) {
    observe(mock, () => {
      setTimeout(() => {
        let after = false;
        cycle = setInterval(() => { after = !after; set(after); }, 2600);
      }, 1200);
    });
  }
}

/* ---------------------------------------------------------------- intro */

function buildIntro(row, variant) {
  const [copyCell, quoteCell, flowCell] = cells(row);
  const intro = el('div', 'container ch-intro-block');

  const h2 = copyCell && copyCell.querySelector('h2, h3');
  if (h2) {
    h2.classList.add('t-xl');
    splitLines(h2);
    const second = h2.querySelector('.line:nth-child(2) > span');
    if (second) second.classList.add('lane-ink');
    intro.append(h2);
  }

  const two = el('div', 'two');
  two.style.marginTop = '28px';
  const lede = copyCell && [...copyCell.querySelectorAll('p')].find((p) => !hasLink(p) && !isEmP(p));
  if (lede) {
    lede.classList.add('t-lede');
    lede.setAttribute('data-reveal', '');
    lede.style.setProperty('--i', 2);
    two.append(lede);
  }
  if (quoteCell && quoteCell.querySelector('p')) {
    const aside = el('aside', 'aside-quote');
    aside.setAttribute('data-reveal', '');
    aside.style.setProperty('--i', 3);
    aside.append(...quoteCell.querySelectorAll('p'));
    two.append(aside);
  }
  intro.append(two);

  const list = flowCell && flowCell.querySelector('ul, ol');
  if (list) {
    const flow = el('div', 'flow');
    flow.setAttribute('data-stagger', '');
    [...list.children].forEach((li, i) => {
      if (i) {
        const arr = el('div', 'arr', '<span>&rarr;</span>');
        arr.setAttribute('data-reveal', 'fade');
        flow.append(arr);
      }
      const box = el('div', 'box');
      box.setAttribute('data-reveal', '');
      const title = li.querySelector('strong');
      const desc = el('span');
      [...li.childNodes].forEach((n) => { if (n !== title) desc.append(n); });
      if (title) box.append(title);
      box.append(desc);
      flow.append(box);
    });
    intro.append(flow);
  }
  intro.dataset.variant = variant;
  return intro;
}

/* ---------------------------------------------------------------- chapters */

function digits(n) {
  return String(n).padStart(2, '0').split('').map((d) => `<span class="d">${d}</span>`)
    .join('');
}

function buildChapter(row, index, theme) {
  const [headCell, introCell, coversCell] = cells(row);
  const article = el('article', 'chapter');
  article.dataset.theme = theme;
  const inner = el('div', 'ch-inner');
  const head = el('div', 'ch-head');
  const foot = el('div', 'ch-foot');

  // head: number, name, command
  const no = el('div', 'ch-no');
  no.append(el('div', 'num-display', digits(index)));
  const h3 = headCell && headCell.querySelector('h3, h4, h2');
  const name = (h3 && h3.textContent.trim().toLowerCase()) || '';
  if (h3) no.append(el('div', 'ch-name').appendChild(splitLines(h3)).parentElement);
  const cmdP = headCell && [...headCell.querySelectorAll('p')].find(isCodeP);
  if (cmdP) {
    const cmd = el('div', 'cmd');
    cmd.setAttribute('data-reveal', 'fade');
    cmd.style.setProperty('--i', 2);
    cmd.append(cmdP);
    no.append(cmd);
  }
  head.append(no);

  // intro: title + paragraph
  const intro = el('div', 'ch-intro');
  const h4 = introCell && introCell.querySelector('h4, h3, h5');
  if (h4) intro.append(splitLines(h4, '120ms'));
  if (introCell) {
    [...introCell.querySelectorAll('p')].forEach((p) => {
      p.setAttribute('data-reveal', '');
      p.style.setProperty('--i', 3);
      intro.append(p);
    });
  }
  head.append(intro);

  // foot: mock + covers
  const media = el('div', 'ch-media');
  const mock = MOCKS[name];
  if (mock) media.append(mock());
  foot.append(media);

  const covers = el('div', 'ch-covers');
  covers.setAttribute('data-reveal', '');
  covers.style.setProperty('--i', 3);
  if (coversCell) {
    const ps = [...coversCell.querySelectorAll('p')];
    const labelP = ps.find(isStrongP);
    if (labelP) covers.append(el('div', 'label').appendChild(labelP).parentElement);
    const list = coversCell.querySelector('ul, ol');
    if (list) covers.append(list);
    const ctaP = ps.find(hasLink);
    if (ctaP) {
      const a = ctaP.querySelector('a');
      const cta = el('a', 'ch-cta');
      cta.href = a.href;
      if (a.target) cta.target = a.target;
      const label = el('span');
      label.append(...a.childNodes);
      cta.append(label, el('span', 'arr', '&rarr;'));
      covers.append(cta);
    }
    // leftovers: anything not consumed stays visible
    [...coversCell.children].forEach((c) => { if (c !== ctaP) covers.append(c); });
  }
  foot.append(covers);

  inner.append(head, foot);
  article.append(inner);
  return article;
}

/* ---------------------------------------------------------------- scroll behaviours */

function stackedUnfold(panels) {
  if (reduced || panels.length < 2) return;
  const update = () => {
    const vh = window.innerHeight;
    panels.forEach((p, k) => {
      if (k === 0) return;
      const prevTop = panels[k - 1].getBoundingClientRect().top;
      const t = Math.min(1, Math.max(0, -prevTop / vh));
      if (t >= 1 || prevTop > vh) { p.style.transform = ''; p.style.filter = ''; return; }
      p.style.transform = `scale(${(0.94 + t * 0.06).toFixed(4)}) translateY(${((1 - t) * 28).toFixed(1)}px)`;
      p.style.filter = `brightness(${(0.72 + t * 0.28).toFixed(3)})`;
    });
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function railStep(step, panels, laneTheme) {
  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56;
  const y = navH + 51;
  const upd = () => {
    const k = panels.findIndex((p) => {
      const b = p.getBoundingClientRect();
      return b.top <= y && b.bottom > y;
    });
    if (k < 0) { step.classList.remove('on'); return; }
    step.classList.add('on');
    step.classList.toggle('inverted', panels[k].dataset.theme === laneTheme);
  };
  window.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  upd();
}

/* ---------------------------------------------------------------- decorate */

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const variant = Object.keys(THEMES).find((v) => block.classList.contains(v)) || 'redesign';
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  const themes = THEMES[variant];

  const section = block.closest('.section');
  if (section && !section.id) section.id = variant;

  const rail = el('div', 'rail-overlay', `<i class="line"></i><i class="node step"><b>${label}</b></i>`);
  rail.setAttribute('aria-hidden', 'true');
  const laneIn = el('i', 'lane-in');
  laneIn.setAttribute('aria-hidden', 'true');
  const laneTab = el('i', 'lane-tab', `<b>${label}</b>`);
  laneTab.setAttribute('aria-hidden', 'true');

  const intro = buildIntro(rows[0], variant);
  const stack = el('div', 'stack');
  rows.slice(1).forEach((row, i) => {
    stack.append(buildChapter(row, i + 1, themes[i % themes.length]));
  });

  block.replaceChildren(rail, laneIn, laneTab, intro, stack);

  stagger(block);
  reveal(block);
  observe(block);
  const panels = [...stack.querySelectorAll('.chapter')];
  panels.forEach((p) => observe(p));
  block.querySelectorAll('[data-hash]').forEach((h) => observe(h, () => rollHash(h)));
  block.querySelectorAll('[data-ba]').forEach(wireBeforeAfter);

  stackedUnfold(panels);
  const step = rail.querySelector('.step');
  railStep(step, panels, variant === 'migrate' ? 'light' : 'gold');
}
