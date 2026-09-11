/**
 * footer — full-viewport footer fed by the /footer document.
 *
 * /footer sections:
 *   1–2. link columns (<ul>), one column each
 *   3.   the right column: first p, then a generated seed hash line, then the remaining ps
 *   4.   the bottom band: first p = foot line, the <strong>-only p = the big wordmark,
 *        last p = the meta line
 * Authored elements move into the layout; only the seed hash is generated.
 */
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { reveal, plus, onlyChild } from '../../scripts/motion.js';
import { seedHash, todayISO } from '../../scripts/seed.js';

const el = (tag, className) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
};

export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  if (!fragment) return;

  const sections = [...fragment.querySelectorAll(':scope > .section')]
    .map((s) => s.querySelector('.default-content-wrapper') || s);
  const [colA, colB, colRight, bottom] = sections;

  const container = el('div', 'container');
  const meta = el('div', 'meta top');

  [colA, colB].forEach((col) => {
    const div = el('div');
    if (col) {
      col.querySelectorAll('a').forEach((a) => a.append(plus()));
      div.append(...col.children);
    }
    meta.append(div);
  });

  const right = el('div', 'right');
  if (colRight) {
    const kids = [...colRight.children];
    const first = kids.shift();
    if (first) right.append(first);
    const hash = el('span', 'hash');
    hash.textContent = `md5("stardust" · ${todayISO()}) → ${seedHash('stardust')}`;
    right.append(hash, ...kids);
  }
  meta.append(right);

  const foot = el('div', 'foot-bottom');
  if (bottom) {
    const ps = [...bottom.querySelectorAll('p')];
    const big = ps.find((p) => onlyChild(p, 'strong'));
    ps.forEach((p, i) => {
      if (p === big) {
        const wrap = el('div', 'big');
        wrap.setAttribute('aria-label', p.textContent.trim());
        const strong = p.firstElementChild;
        const letters = [...strong.textContent].map((c) => {
          const s = el('span');
          s.textContent = c;
          return s;
        });
        strong.replaceChildren(...letters);
        wrap.append(p);
        foot.append(wrap);
      } else if (i === 0) {
        p.classList.add('foot-line');
        p.setAttribute('data-reveal', '');
        foot.append(p);
      } else {
        const wrap = el('div', 'foot-meta mono');
        wrap.append(p);
        foot.append(wrap);
      }
    });
  }

  container.append(meta, foot);
  block.replaceChildren(container);
  reveal(block);
}
