/**
 * showcase — Frescopa before and after.
 *
 * Authoring:
 *   row 1: [h2, lines split on <br>] [p, <em><a> = secondary button]
 *   row 2: one cell per shot: picture + caption paragraph (rendered as the badge)
 * Authored elements are moved into the layout; the CTA paragraph is moved, never cloned.
 */
import {
  reveal, stagger, splitLines, plus,
} from '../../scripts/motion.js';

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const [headRow, ...shotRows] = rows;

  const head = document.createElement('div');
  head.className = 'show-head';
  const heading = headRow.querySelector('h2, h3');
  if (heading) {
    heading.classList.add('t-xl');
    head.append(splitLines(heading));
  }
  const right = document.createElement('div');
  [...headRow.querySelectorAll('p')].forEach((p) => {
    const btn = p.querySelector('a.button');
    if (btn) {
      btn.setAttribute('data-reveal', 'fade');
      btn.style.setProperty('--i', 2);
      btn.append(plus());
    } else {
      p.setAttribute('data-reveal', '');
      p.style.setProperty('--i', 1);
    }
    right.append(p);
  });
  head.append(right);

  const pair = document.createElement('div');
  pair.className = 'pair';
  pair.setAttribute('data-stagger', '');
  shotRows.forEach((row) => {
    [...row.children].forEach((cell) => {
      const pic = cell.querySelector('picture, img');
      if (!pic) return;
      const fig = document.createElement('figure');
      fig.className = 'shot';
      fig.setAttribute('data-reveal', 'scale');
      const caption = [...cell.querySelectorAll('p')].find((p) => !p.querySelector('picture, img') && p.textContent.trim());
      if (caption) {
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.append(caption);
        fig.append(badge);
      }
      fig.append(pic);
      pair.append(fig);
    });
  });

  const container = document.createElement('div');
  container.className = 'container';
  container.append(head, pair);
  block.replaceChildren(container);
  stagger(block);
  reveal(block);
}
