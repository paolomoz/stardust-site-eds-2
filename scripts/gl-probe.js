/*
 * Worker for scripts/gl.js: reports the WebGL renderer name from a context created off the main
 * thread. On software renderers (SwiftShader and friends) creating a context takes hundreds of
 * milliseconds, which is exactly the cost the page must not pay on its main thread.
 */

let name = '';
try {
  const gl = new OffscreenCanvas(1, 1).getContext('webgl');
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
} catch (e) {
  // no WebGL in this worker: the page decides on its own context
}
postMessage(name);
