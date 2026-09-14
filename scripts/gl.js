/*
 * WebGL helpers shared by the shader blocks (blocks/hero/nebula.js, blocks/spotlight/warp.js).
 *
 *   - softwareGL(): resolves true when WebGL runs on a CPU rasteriser (SwiftShader, llvmpipe,
 *     Mesa software, the Windows basic renderer). There the fragment shaders take seconds to
 *     compile and draw at a few frames per second while blocking the main thread, so the blocks
 *     use their 2D fallbacks instead. Headless Chrome without a GPU, which is what Lighthouse
 *     and PageSpeed Insights run, is the common case. The renderer name comes from a context
 *     created in a worker (scripts/gl-probe.js): on a software renderer even that first context
 *     costs hundreds of milliseconds, so it never happens on the main thread. The answer is kept
 *     for the session.
 *   - buildProgram(gl, vert, frag): compiles and links, off the main thread where the driver
 *     allows it (KHR_parallel_shader_compile), and resolves with the program once it is ready
 *     or null when it failed. Nothing waits on the compiler synchronously, so a cold shader
 *     cache no longer stalls the page at the start of the intro.
 *   - slowFrames(opts): returns check(now) for a requestAnimationFrame loop. After a warm-up
 *     it samples the frame pacing once and returns true if the median gap is above the limit
 *     (a renderer that cannot hold a usable frame rate); false otherwise. The block then drops
 *     to its fallback.
 */

const SOFTWARE = /swiftshader|llvmpipe|lavapipe|softpipe|software|basic render|mesa offscreen/i;
const STORAGE_KEY = 'gl-software';
const PROBE_TIMEOUT = 600; // ms: a renderer that takes this long to answer is not usable anyway

let probe = null;

/** @returns {Promise<boolean>} whether WebGL is software rendered in this browser */
export function softwareGL() {
  if (probe) return probe;
  probe = new Promise((resolve) => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        resolve(stored === '1');
        return;
      }
    } catch (e) {
      // no storage, probe every page
    }
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      resolve(false);
      return;
    }
    let worker = null;
    const settle = (soft) => {
      if (worker) worker.terminate();
      worker = null;
      try {
        sessionStorage.setItem(STORAGE_KEY, soft ? '1' : '0');
      } catch (e) {
        // fine
      }
      resolve(soft);
    };
    try {
      worker = new Worker(new URL('./gl-probe.js', import.meta.url).href);
    } catch (e) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => settle(true), PROBE_TIMEOUT);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      settle(SOFTWARE.test(String(e.data)));
    };
    worker.onerror = () => {
      clearTimeout(timer);
      settle(false);
    };
  });
  return probe;
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} vert vertex shader source
 * @param {string} frag fragment shader source
 * @returns {Promise<WebGLProgram|null>}
 */
export function buildProgram(gl, vert, frag) {
  return new Promise((resolve) => {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    const parallel = gl.getExtension('KHR_parallel_shader_compile');

    const finish = () => {
      if (gl.isContextLost()) {
        resolve(null);
        return;
      }
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        // eslint-disable-next-line no-console
        console.error(gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs)
          || gl.getProgramInfoLog(prog));
        gl.deleteProgram(prog);
        resolve(null);
        return;
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      resolve(prog);
    };
    const poll = () => {
      const ready = gl.isContextLost()
        || gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR);
      if (ready) finish();
      else requestAnimationFrame(poll);
    };
    // without the extension the status check blocks until the driver is done; at least it
    // runs in its own frame, after the page has painted
    requestAnimationFrame(parallel ? poll : finish);
  });
}

/**
 * @param {{ warmup?: number, sample?: number, limit?: number }} [opts] frames to skip, frames
 *   to measure, and the median frame gap in ms above which the renderer counts as too slow
 * @returns {(now: number) => boolean} check(now) for the frame loop
 */
export function slowFrames({ warmup = 8, sample = 12, limit = 80 } = {}) {
  let last = 0;
  let seen = 0;
  const gaps = [];
  let done = false;
  return (now) => {
    if (done) return false;
    if (last) {
      seen += 1;
      if (seen > warmup) gaps.push(now - last);
    }
    last = now;
    if (gaps.length < sample) return false;
    done = true;
    return gaps.sort((a, b) => a - b)[sample >> 1] > limit; // eslint-disable-line no-bitwise
  };
}
