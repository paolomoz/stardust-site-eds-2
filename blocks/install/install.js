/**
 * install — "Install it. Then ask it." on the coral ground, with the live terminal.
 *
 * Authoring (one row, three cells):
 *   1. copy: h2 (lines split on <br>), lede p, <strong><a> = copy button, <em><a> = README link,
 *      a paragraph with an inline link = credit
 *   2. quote p (<em> only) + attribution p
 *   3. <pre><code> terminal script, one line per row: a line ending with › is a prompt, a line
 *      starting with / is a typed command, anything else is output. The copy button copies the
 *      lines that start with /plugin.
 * decorateButtons() has already classed the CTAs; their paragraphs are moved, never cloned.
 */
import {
  reveal, stagger, splitLines, plus, observe, reduced,
} from '../../scripts/motion.js';

const PAUSE = { p: 60, c: 240, d: 160 };

function classify(line) {
  if (/›\s*$/.test(line)) return 'p';
  if (line.startsWith('/')) return 'c';
  return 'd';
}

function parseScript(pre) {
  return pre.textContent.split('\n').filter((l) => l.trim()).map((l) => [classify(l), l, PAUSE[classify(l)]]);
}

function typewriter(pre, script, skipBtn) {
  pre.replaceChildren();
  const cur = document.createElement('span');
  cur.className = 'cursor';
  pre.append(cur);
  let i = 0;
  let skipped = false;
  const finish = () => {
    skipped = true;
    pre.replaceChildren();
    script.forEach(([cls, text]) => {
      const sp = document.createElement('span');
      sp.className = cls;
      sp.textContent = text;
      pre.append(sp, document.createTextNode('\n'));
    });
    pre.append(cur);
    skipBtn.remove();
  };
  skipBtn.addEventListener('click', finish);
  const next = () => {
    if (skipped) return;
    if (i >= script.length) { skipBtn.remove(); return; }
    const [cls, text, pause] = script[i];
    i += 1;
    const span = document.createElement('span');
    span.className = cls;
    pre.insertBefore(span, cur);
    if (reduced || cls !== 'c') {
      span.textContent = text;
      pre.insertBefore(document.createTextNode('\n'), cur);
      setTimeout(next, reduced ? 0 : pause);
    } else {
      let k = 0;
      const type = () => {
        if (skipped) return; // skip rebuilt the pre: a late keystroke must not add a line
        k += 1;
        span.textContent = text.slice(0, k);
        if (k < text.length) setTimeout(type, 14 + Math.random() * 40);
        else { pre.insertBefore(document.createTextNode('\n'), cur); setTimeout(next, pause); }
      };
      type();
    }
  };
  setTimeout(next, 300);
}

function el(tag, className, attrs = {}) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

export default async function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const [copyCell, quoteCell, termCell] = cells;
  if (!copyCell) return;

  const heading = copyCell.querySelector('h2, h3');
  const ps = [...copyCell.querySelectorAll('p')];
  const buttons = ps.filter((p) => p.querySelector('a.button'));
  const credit = ps.find((p) => !p.querySelector('a.button') && p.querySelector('a'));
  const lede = ps.find((p) => !p.querySelector('a'));

  const left = el('div');
  if (heading) {
    heading.classList.add('t-l');
    left.append(splitLines(heading));
  }
  if (lede) {
    lede.setAttribute('data-reveal', '');
    lede.style.setProperty('--i', 2);
    left.append(lede);
  }
  if (buttons.length) {
    const actions = el('div', 'actions', { 'data-stagger': '' });
    buttons.forEach((p) => {
      const a = p.querySelector('a.button');
      a.setAttribute('data-reveal', 'fade');
      if (a.classList.contains('primary')) {
        const txt = el('span', 'txt');
        txt.append(...a.childNodes);
        a.append(txt);
        a.setAttribute('role', 'button');
      }
      a.append(plus());
      actions.append(p);
    });
    left.append(actions);
  }
  if (credit) {
    credit.setAttribute('data-reveal', '');
    credit.style.setProperty('--i', 3);
    const creditWrap = el('div', 'credit');
    creditWrap.append(credit);
    left.append(creditWrap);
  }
  if (quoteCell && quoteCell.querySelector('p')) {
    const aside = el('aside', 'aside-quote small', { 'data-reveal': '' });
    aside.style.setProperty('--i', 4);
    aside.append(...quoteCell.children);
    left.append(aside);
  }

  const two = el('div', 'two');
  two.append(left);

  const pre = termCell && termCell.querySelector('pre');
  let script = [];
  if (pre) {
    script = parseScript(pre);
    // the terminal is typed on reveal from the parsed script: the authored lines leave the DOM
    // now so the stage does not shrink by their height when typing starts (@ew-exempt <pre>
    // terminal script — derived render)
    pre.replaceChildren();
    const terminal = el('div', 'terminal', { 'data-reveal': 'scale' });
    terminal.style.setProperty('--i', 1);
    const bar = el('div', 'bar');
    bar.append(el('i'), el('i'), el('i'));
    const prompt = script.find(([c]) => c === 'p');
    const title = el('span');
    title.textContent = prompt ? prompt[1].replace(/\s*›\s*$/, '') : '';
    const skip = el('button', 'skip mono', { type: 'button', 'data-skip': '' });
    skip.textContent = 'skip';
    bar.append(title, skip);
    terminal.append(bar, pre);
    two.append(terminal);
    observe(terminal, () => typewriter(pre, script, skip));
  }

  // copy button: copies the /plugin lines of the terminal script
  const copyBtn = two.querySelector('a.button.primary');
  if (copyBtn) {
    const lines = script.filter(([, t]) => t.startsWith('/plugin')).map(([, t]) => t);
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const t = copyBtn.querySelector('.txt');
      if (t && t.textContent !== 'Copied') {
        const old = t.textContent;
        t.textContent = 'Copied';
        setTimeout(() => { t.textContent = old; }, 1400);
      }
      try { await navigator.clipboard.writeText(lines.join('\n')); } catch (err) { /* ignore */ }
    });
  }

  const container = el('div', 'container');
  container.append(two);
  block.replaceChildren(container);
  const section = block.closest('.section');
  if (section) section.id = 'install';
  stagger(block);
  reveal(block);
}
