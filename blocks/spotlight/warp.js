/*
 * stardust warp — onboard camera through a starfield (WebGL). Stars stream toward the viewer
 * from a vanishing point (the mark), streaking with speed; soft sky objects drift past in
 * parallax. Contract:
 *   mountWarp(canvas, opts) -> { destroy(), setFocus(x, y), setSpeed(v) }
 * Falls back to a static navy gradient when WebGL is missing. Colours come from the P10 tokens
 * through scripts/palette.js, so the cube layer recolours the field when it changes face.
 */

import { subscribePalette } from '../../scripts/palette.js';
import { reduced } from '../../scripts/motion.js';

const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_focus;   // vanishing point, 0..1 (y up)
uniform float u_speed;   // 0.4 cruise … 2.5 jump
uniform float u_fade;    // 0..1 overall intensity

uniform vec3 PAGE, NAVY, GLOW, GOLD, TEXT, CORAL;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+7.1; a*=.5; } return v; }

void main(){
  vec2 uv = (gl_FragCoord.xy - u_focus * u_res) / u_res.y;
  float r = length(uv);
  vec2 dir = uv / max(r, 1e-4);
  float t = u_time;

  vec3 col = mix(PAGE, NAVY, 0.55);
  col = mix(col, GLOW, exp(-r*r*3.2) * 0.9);

  for (int k = 0; k < 2; k++){
    float fk = float(k);
    vec2 c = vec2(0.55 - fk*1.1, 0.25 - fk*0.5) + vec2(sin(t*0.05 + fk), cos(t*0.04 + fk*2.)) * 0.08;
    vec2 q = (uv - c) * (1.6 + fk*0.6);
    float n = fbm(q*2.0 + t*0.03*(1.+fk));
    float blob = smoothstep(0.9, 0.2, length(q)) * smoothstep(0.35, 0.75, n);
    col = mix(col, mix(GLOW, GOLD*0.55, fk), blob * 0.55);
  }

  float speed = u_speed;
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    float z = fract(fi/9.0 + t*0.22*speed);
    float depth = mix(7.0, 0.7, z);
    vec2 p = uv * depth;
    float a = fi*0.7; mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
    p = R*p + fi*13.1;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = hash(id + fi);
    if (h < 0.94) continue;
    vec2 o = (vec2(hash(id+0.1), hash(id+0.2)) - 0.5) * 0.7;
    vec2 d = f - o;
    vec2 rd = R*dir;
    float along = dot(d, rd), across = dot(d, vec2(-rd.y, rd.x));
    float len = mix(0.015, 0.22, z) * speed;
    float core = exp(-across*across*2600.0) * exp(-(along*along)/(len*len+1e-4)) * smoothstep(-len*1.3, 0.0, along) ;
    float dot_ = exp(-dot(d,d)*2200.0);
    float b = (core*0.9 + dot_) * smoothstep(0.0, 0.25, z) * (1.0 - smoothstep(0.85, 1.0, z)) * (0.6 + 0.4*hash(id+0.3));
    vec3 sc = h > 0.995 ? CORAL : (h > 0.975 ? GOLD : TEXT);
    col += sc * b * 1.4;
  }

  float haze = exp(-r*1.4) * 0.08 * speed;
  col += mix(GLOW, TEXT, 0.3) * haze;

  col *= 1.0 - smoothstep(0.8, 1.6, r) * 0.55;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.02;
  gl_FragColor = vec4(mix(PAGE, col, u_fade), 1.0);
}`;

const UNIFORMS = ['u_res', 'u_time', 'u_focus', 'u_speed', 'u_fade', 'PAGE', 'NAVY', 'GLOW', 'GOLD', 'TEXT', 'CORAL'];

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ speed?: number }} [opts]
 */
export default function mountWarp(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  const state = {
    focus: [0.3, 0.55], speed: opts.speed || 0.9, targetSpeed: opts.speed || 0.9, fade: 1,
  };
  if (!gl) {
    canvas.style.background = 'radial-gradient(ellipse at 30% 45%, var(--glow), var(--page) 70%)';
    canvas.dataset.renderer = '2d';
    return { destroy() {}, setFocus() {}, setSpeed() {} };
  }
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  UNIFORMS.forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  const unsub = subscribePalette((p) => {
    gl.uniform3fv(U.PAGE, p.page);
    gl.uniform3fv(U.NAVY, p.navy);
    gl.uniform3fv(U.GLOW, p.glow);
    gl.uniform3fv(U.GOLD, p.gold);
    gl.uniform3fv(U.TEXT, p.text);
    gl.uniform3fv(U.CORAL, p.coral);
  });
  canvas.dataset.renderer = 'webgl';

  let raf = 0;
  let running = true;
  let visible = true;
  const t0 = performance.now();
  const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.7;

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function frame(now) {
    if (!running) return;
    if (visible) {
      resize();
      state.speed += (state.targetSpeed - state.speed) * 0.04;
      gl.uniform2f(U.u_res, canvas.width, canvas.height);
      gl.uniform1f(U.u_time, reduced ? 0 : (now - t0) / 1000);
      gl.uniform2f(U.u_focus, state.focus[0], state.focus[1]);
      gl.uniform1f(U.u_speed, state.speed);
      gl.uniform1f(U.u_fade, state.fade);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '20% 0px' });
  io.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  raf = requestAnimationFrame(frame);

  return {
    /** vanishing point in canvas pixels (top-left origin) */
    setFocus(cx, cy) {
      state.focus = [cx / canvas.clientWidth, 1 - cy / canvas.clientHeight];
      if (reduced) frame(performance.now());
    },
    setSpeed(v) { state.targetSpeed = v; },
    destroy() {
      running = false;
      unsub();
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}
