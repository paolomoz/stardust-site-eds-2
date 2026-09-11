# EDS conversion log — stardust.style v2 home page

Source: `/Users/paolo/stardust/2026-09/prototype-2/index.html` (content v10, design 2026-09-11).
Target: `paolomoz/stardust-site-eds-2`, content at `paolomoz/stardust-site-eds-2` on da.live.

## Locked decisions (2026-09-11)

- Single page. Block name = prototype section, kebab-cased, unless reserved.
- `nav` -> `header` block fed by `/nav`; `footer` -> `footer` block fed by `/footer` (D12).
- `hero` -> `hero` block (template-slotted, bespoke). Rows: version tag, kicker, seed line, h1, scroll link.
  The brand mark and wordmark are fixed brand assets in block JS. The seed hash is generated at load.
- `spot` -> `spotlight` block. Row 1 = h2 + lede. One row per door (h3, description, route as `<code>`,
  optional `<strong>` label + `<code>` shortcut + small line, plain link = door target). The route diagram
  is drawn from the doors' route lines; the warp shader lives in `blocks/spotlight/warp.js`.
- `chapters.lane-a` / `lane-b` -> ONE `chapters` block with variants `redesign` / `migrate` (same pattern,
  different skin: the D9 collapse). Row 1 = intro (h2+lede | quote+attribution | optional flow list).
  Rows 2..n = chapters, 3 cells: head (h3 name + `<code>` command) | intro (h4 + p) | covers
  (`<strong>` label, ul, plain link = CTA bar). Chapter number = row index. Panel theme sequence and the
  mock illustration are keyed by variant / chapter name in block JS (illustrations are design, not copy).
- `showcase` -> `showcase` block. Row 1 = h2 | p + `<em>` link. Row 2 = two cells, picture + caption p.
  Images rehosted to DA `media/showcase/`.
- `install` -> `install` block. 3 cells: copy (h2, lede, `<strong>` link = copy button, `<em>` link,
  credit p) | quote + attribution | `<pre>` terminal script (lines ending `›` = prompt, starting `/` =
  typed command, others = output; the copy button copies the `/plugin` lines).
- Decode tier: hero, spotlight, install, showcase = template-slotted; chapters = reconstructive rows.
- Section anchors (`#ways`, `#redesign`, `#migrate`, `#install`) are set by each block on its section.
- Fonts: system stacks only (SF Pro Display / SF Pro Text / SF Mono), by design. No webfonts, no CLS.
- Chrome is an overlay (#108): `--nav-height: 0`, nav is `position: fixed`.
- Cube layer (scripts/cube*.js, styles/cube*.css) stays as loaded from head.html; palettes re-expressed
  on the prototype tokens (`--page --navy --glow --gold --coral --text --text-72/55/40/15/08 --gold-tint`).
- Shared `/scripts/`: `palette.js` (token reader for shaders), `seed.js` (md5 date seed), `motion.js`
  (reveal observer, stagger, line splitting, plus icon), `lenis.min.js` + `site.js` (smooth wheel).
- Prototype-only pages: `docs.html` is not deployed in this pass (nav links point at the README).

## Anti-patterns avoided
- No `<header>` emitted from block DOM (#107). No `head.html` font lines. Favicon link is the one edit.
- Reveal `opacity: 0` is re-wired in block JS (motion.js), never left dead (#14/#16).
- Mock illustrations and diagrams are code, not authored HTML (D15).

## Lint notes
- `davids-model-lint` 🔴 D15 on `/stardust:extract <url>`: a CLI placeholder inside `<code>`, the
  prototype's own copy, not leaked markup. Kept on purpose (false positive of the regex).
- 🟡 D1 on `spotlight`: genuine bespoke widget (pinned stage, warp shader, route diagram, sliding doors);
  its rows are its structure.

## Verification (2026-09-11, localhost code vs prototype, Playwright + Chrome/WebGL)
- 15 scroll targets at 1440×900: 13 ≥ 99.9 %, spotlight pinned 98.3 %, hero 95.6 % — the hero and the
  spotlight approach differ only by the live shaders (with canvases hidden: 99.94 % / 99.94 %).
- Same targets at 390×844 with canvases hidden: all ≥ 98.9 %, document heights identical (11609 px).
- 1920×1080 box check: 16 text-bearing elements identical in x / width / height on both sides.
- CLS 0.000 (the prototype's grid-row intro animation is a layout shift of 0.10; the block moves the
  same sequence onto transforms). Zero page errors, zero failed requests.
- Cube: `window.cube.rotate('left')` recolours the page (P10 → Espresso) and back; both canvases on WebGL.
- Cascade quirks reproduced from the prototype's render, not its source: `.tight` beats `.install`
  (top padding 7vw), `.doors` pads the tile column (tiles sit at 440 px min), the ≤900 footer rules beat
  the ≤640 ones (2 columns, 22vw), `.hero-text .bottom` keeps 28 px bottom padding on phones.
- Fixed en route: a duplicate `id="redesign"` (pipeline slug of the door heading) is stripped by the
  spotlight block so the nav anchor lands on the series.
