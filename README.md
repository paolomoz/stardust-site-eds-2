# stardust.style v2

The home page of Stardust, the AI skills from Adobe that take a website and bring it back redesigned, fixed, migrated, or all three. Built on AEM Edge Delivery Services with content authored in da.live (`paolomoz/stardust-site-eds-2`).

## Environments

- Preview: https://main--stardust-site-eds-2--paolomoz.aem.page/
- Live: https://main--stardust-site-eds-2--paolomoz.aem.live/
- Content: https://da.live/#/paolomoz/stardust-site-eds-2

## Structure

Every distinct section of the page is one block; prose stays default content. Content shapes are described in each block's JSDoc and in `stardust/eds-conversion-log.md`.

| Block | Section | Content |
|---|---|---|
| `header` | fixed nav + progress bar | `/nav`: brand link, link list (a `<strong>` link is the gold CTA), tools |
| `hero` | shader half + headline half | version tag, kicker, seed line, `<h1>`, scroll link |
| `spotlight` | "Two ways in" pinned stage | head row, one row per door |
| `chapters` (`redesign`, `migrate`) | stacked skill panels | intro row, one row per chapter (head, intro, covers) |
| `showcase` | Frescopa before / after | head row, one image + caption per cell |
| `install` | coral install stage | copy, quote, `<pre>` terminal script |
| `footer` | full-viewport footer | `/footer`: link lists, seed column, wordmark band |

Shared code lives in `scripts/`: `motion.js` (reveal observer, line splitting), `palette.js` (token reader for the shaders), `seed.js` (md5 date seed), `site.js` + `lenis.min.js` (smooth wheel). Type is system stacks by design; every colour is a token on `:root` in `styles/styles.css`.

## Development

```sh
npm i
npx -y @adobe/aem-cli up   # local code, previewed content, on http://localhost:3000
npm run lint
```

## Cube layer

The page is one face of a cube. A turn shows the same content at the same scroll position with the palette of another face. The layer is independent from the page design: it clones the page into cube faces for the duration of a turn and otherwise only sets `data-cube-face` on `<html>`. The scripts have no imports or exports, so they also run as classic scripts in a prototype opened over `file://`.

- `scripts/cube.js` + `styles/cube.css`: the engine and stage. `window.cube.rotate(direction)` for a quarter turn, `window.cube.begin()` for a scrubbable session with the front face and its four neighbours, `cube:rotate` event in, `cube:scrub` / `cube:turning` / `cube:settled` / `cube:rotated` events out. Directions say where the current content goes.
- `styles/cube-palettes.css`: one `[data-cube-face="<front|back|left|right|top|bottom>"]` rule per face, setting custom properties only. `front` is the design's default palette. Whatever the design paints on `<body>` from those properties must also be set on `.cube-face`. The faces are P10 ink (front, default), Espresso (right), Sunbeam ink (left), Bottle (top), Tangerine (bottom) and Aubergine (back, only seen inside the puzzle); candidates and the screenshot harness live outside the repo in `palette-tests/cube-faces-2`.
- `scripts/cube-ui.js` + `styles/cube-ui.css`: triggers and discoverability. Press and hold on the page, or start moving horizontally, and the cube is in your hand on both axes. On release the dominant axis commits past the threshold or on a flick, the other springs back. A plain vertical drag stays a scroll. Drag an edge handle inward on any side. Drag the corner widget, click its arrows, or focus it and use the arrow keys. Alt + arrows work anywhere. Arrows and keys point at the face you want to see. Once per session, two seconds after the top screen shows, the page pulls back into a cube that shrinks to half the page and floats, rocking gently, with the turn arrows blinking around it; drag it or click an arrow to turn, or wait, and it grows back into the page. The corner widget then fades in, floating with the same slow blink on its arrows. Anything the UI adds is marked `data-cube-exclude` and never ends up inside a face.
- `scripts/cube-rubik.js` + `styles/cube-rubik.css`: the back face is a puzzle. The page is split into a 2 by 3 grid of squares, each showing its part of the page in one palette. A row or a column is a layer of the cube: drag it and the whole layer turns as one slab around the cube's axis, like a Rubik's cube layer, and the strip on the neighbouring side comes to the front. Every square keeps seven stickers on the two rings through it, each pool holds all six palettes, and any state is solvable for any palette. Goal: all six squares in one palette. The back palette is only ever seen inside the squares. On this face the page is the puzzle: wheel still scrolls and the squares follow, and the cube is left through edges, widget or keyboard. A status chip counts moves and offers a scramble. `window.cubeRubik` exposes `scramble()`, `reset()`, `fronts()`, `solved()`; events `rubik:moved` and `rubik:solved`. The engine's `registerFace(name, { build, sync })` is how a face gets custom content.
- Tuning: `--cube-duration`, `--cube-easing`, `--cube-pullback`, `--cube-perspective`, `--cube-void` in `styles/cube.css`; `--cube-edge-size`, `--cube-edge-glow`, `--cube-widget-size` in `styles/cube-ui.css`; `--rubik-seam` in `styles/cube-rubik.css`; gesture thresholds at the top of `scripts/cube-ui.js` and `scripts/cube-rubik.js`.
