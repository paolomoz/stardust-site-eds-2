/*
 * Hero renderer: a dense nebula (WebGL fragment shader) with a 2D dust-field fallback.
 * Contract (keep it when swapping in another shader):
 *   mountHero(canvas) -> { destroy(), pointer, setLogo(cx, cy), setEnergy(e) }
 * `pointer` is the eased pointer {x, y} in 0..1 so the DOM layer (mark + wordmark) can move
 * with the gas. Colours come from the tokens through scripts/palette.js and follow the cube.
 */

import { subscribePalette } from '../../scripts/palette.js';

const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;   // eased pointer 0..1
uniform float u_scroll;  // 0..1 of first viewport
uniform vec3  u_page, u_navy, u_glow, u_gold, u_text, u_coral;
uniform vec2  u_logo;    // lockup centre in uv space
uniform float u_energy;  // pointer energy 0..1

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
float fbm(vec2 p){
  float v = 0., a = 0.5;
  for (int i = 0; i < 6; i++){ v += a*noise(p); p = R*p*2.02 + 13.7; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  float aspect = u_res.x / u_res.y;
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float t = u_time * 0.045;

  vec2 p = uv * 1.7 + vec2(0.0, u_scroll*0.6);
  p -= m * 0.28;

  vec2 dl = uv - u_logo;
  float infl = exp(-dot(dl, dl) * 7.0) * (0.25 + u_energy);
  float ang = infl * (1.6 + u_energy * 2.4) + u_time * 0.12 * infl;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 lc = u_logo * 1.7;
  p = mix(p, rot * (p - lc) + lc, min(1.0, infl * 1.6));

  vec2 q = vec2(fbm(p + t*1.3), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 2.3*q + vec2(1.7, 9.2) + 0.18*t), fbm(p + 2.3*q + vec2(8.3, 2.8) - 0.13*t));
  float f = fbm(p + 2.8*r);

  float dens = smoothstep(0.30, 0.86, f);
  float wisps = pow(clamp(length(r) * 0.95, 0.0, 1.0), 3.0);
  float veins = smoothstep(0.52, 0.66, f) * (1.0 - smoothstep(0.66, 0.80, f));

  vec3 col = mix(u_page, u_navy, smoothstep(0.15, 0.65, f));
  col = mix(col, u_glow, dens * 0.95);
  col = mix(col, u_gold * 0.82, veins * (0.28 + 0.30*wisps));
  col = mix(col, u_gold * 0.55, wisps * dens * 0.10);

  vec3 stir = mix(u_gold, u_coral, clamp(u_energy * 1.2, 0.0, 1.0));
  col = mix(col, stir * 0.9, infl * (0.22 + u_energy * 0.55) * (0.4 + 0.6*dens));
  col += stir * infl * u_energy * 0.25;

  vec2 c = uv - m * 0.22;
  float rad = dot(c, c);
  col = mix(col, u_gold * 0.9, 0.16 * exp(-rad * 7.0) * (0.55 + 0.45*dens));
  col += u_glow * 0.25 * exp(-rad * 2.2);

  vec2 sp = uv * vec2(aspect, 1.0);
  for (int k = 0; k < 2; k++){
    float sc = k == 0 ? 46.0 : 90.0;
    vec2 g = (sp + m*0.06*float(k+1)) * sc;
    vec2 id = floor(g), fr = fract(g) - 0.5;
    float h = hash(id + float(k)*17.0);
    if (h > 0.985){
      vec2 o = (vec2(hash(id+0.1), hash(id+0.2)) - 0.5) * 0.6;
      float d = length(fr - o);
      float tw = 0.6 + 0.4*sin(u_time*(1.0+h*2.0) + h*40.0);
      float s = smoothstep(0.09, 0.0, d) * tw;
      col += (h > 0.995 ? u_gold : u_text) * s * (k == 0 ? 0.9 : 0.5);
    }
  }

  float vig = smoothstep(1.35, 0.35, length(uv * vec2(0.75, 1.15)));
  col = mix(u_page, col, 0.35 + 0.65*vig);
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`;

const UNIFORMS = ['u_res', 'u_time', 'u_mouse', 'u_scroll', 'u_page', 'u_navy', 'u_glow', 'u_gold', 'u_text', 'u_coral', 'u_logo', 'u_energy'];

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

function mountGL(canvas, pointer, state, reduced) {
  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
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
    gl.uniform3fv(U.u_page, p.page);
    gl.uniform3fv(U.u_navy, p.navy);
    gl.uniform3fv(U.u_glow, p.glow);
    gl.uniform3fv(U.u_gold, p.gold);
    gl.uniform3fv(U.u_text, p.text);
    gl.uniform3fv(U.u_coral, p.coral);
  });

  let raf = 0;
  let running = true;
  let scroll = 0;
  const t0 = performance.now();
  // render at reduced resolution: fbm x5 per pixel is the cost
  const scale = Math.min(window.devicePixelRatio || 1, 2) * (window.innerWidth > 1600 ? 0.6 : 0.75);
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const frame = (now) => {
    if (!running) return;
    resize();
    pointer.tick();
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, reduced ? 0 : (now - t0) / 1000);
    gl.uniform2f(U.u_mouse, pointer.x, 1 - pointer.y);
    gl.uniform1f(U.u_scroll, scroll);
    gl.uniform2f(U.u_logo, state.logo[0], state.logo[1]);
    gl.uniform1f(U.u_energy, state.energy);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!reduced) raf = requestAnimationFrame(frame);
  };
  const onScroll = () => {
    scroll = Math.min(1, window.scrollY / window.innerHeight);
    if (reduced) frame(performance.now());
  };
  const onVis = () => {
    running = !document.hidden;
    if (running && !reduced) raf = requestAnimationFrame(frame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);
  return {
    destroy() {
      running = false;
      unsub();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}

/* 2D fallback: the dust field */
function mount2D(canvas, pointer, reduced) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let w = 0;
  let h = 0;
  let raf = 0;
  let running = true;
  let particles = [];
  const t0 = performance.now();
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: 260 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random(),
      a: 0.15 + Math.random() * 0.5,
      gold: Math.random() < 0.14,
    }));
  };
  const draw = (now) => {
    if (!running) return;
    pointer.tick();
    const px = pointer.x - 0.5;
    const py = pointer.y - 0.5;
    const t = (now - t0) / 1000;
    const cs = getComputedStyle(document.documentElement);
    ctx.fillStyle = cs.getPropertyValue('--page').trim();
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(
      w * (0.5 + px * 0.1),
      h * (0.5 + py * 0.1),
      0,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.6,
    );
    g.addColorStop(0, `color-mix(in srgb, ${cs.getPropertyValue('--glow').trim()} 95%, transparent)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const gold = cs.getPropertyValue('--gold').trim();
    const text = cs.getPropertyValue('--text').trim();
    particles.forEach((p) => {
      if (!reduced) {
        p.y -= 0.03 * (0.3 + p.z);
        if (p.y < -2) p.y = h + 2;
      }
      const alpha = (p.a * (0.6 + 0.4 * Math.sin(t + p.z * 9))) * 100;
      ctx.fillStyle = `color-mix(in srgb, ${p.gold ? gold : text} ${alpha.toFixed(1)}%, transparent)`;
      ctx.beginPath();
      ctx.arc(p.x + px * 40 * p.z, p.y + py * 40 * p.z, 0.4 + p.z * 1.4, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!reduced) raf = requestAnimationFrame(draw);
  };
  window.addEventListener('resize', resize, { passive: true });
  resize();
  raf = requestAnimationFrame(draw);
  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}

/**
 * Mounts the hero renderer on `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {{ force2d?: boolean }} [opts]
 */
export default function mountHero(canvas, opts = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = {
    x: 0.5,
    y: 0.5,
    tx: 0.5,
    ty: 0.5,
    tick() {
      this.x += (this.tx - this.x) * 0.045;
      this.y += (this.ty - this.y) * 0.045;
    },
  };
  const state = { logo: [0, 0], energy: 0 };
  const onMove = (e) => {
    pointer.tx = e.clientX / window.innerWidth;
    pointer.ty = e.clientY / window.innerHeight;
  };
  const onLeave = () => {
    pointer.tx = 0.5;
    pointer.ty = 0.5;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  const gl = opts.force2d ? null : mountGL(canvas, pointer, state, reduced);
  const inner = gl || mount2D(canvas, pointer, reduced);
  canvas.dataset.renderer = gl ? 'webgl' : '2d';
  return {
    pointer,
    /** logo centre in canvas pixels → shader uv space (centred, y up, normalised by height) */
    setLogo(cx, cy) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      state.logo = [(cx - w / 2) / h, (h / 2 - cy) / h];
    },
    setEnergy(e) { state.energy = e; },
    destroy() {
      inner.destroy();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    },
  };
}
