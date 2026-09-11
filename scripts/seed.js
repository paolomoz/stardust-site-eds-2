/* eslint-disable no-bitwise */
/*
 * Today's seed: the real md5 of `<name> · <ISO date>`, first 8 hex chars. The identity motif of
 * the design ("brief + seed = star"). Verified against the RFC 1321 test vectors.
 */

const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const rot = (x, n) => (x << n) | (x >>> (32 - n));
const hex = (n) => Array.from({ length: 4 }, (_, k) => ((n >>> (k * 8)) & 255).toString(16).padStart(2, '0')).join('');

/** @returns {string} md5 hex digest of `str` */
export function md5(str) {
  const bytes = new TextEncoder().encode(str);
  const words = [];
  for (let i = 0; i < bytes.length; i += 1) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) << 4) + 14] = bytes.length * 8;
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  for (let i = 0; i < words.length; i += 16) {
    let A = a;
    let B = b;
    let C = c;
    let D = d;
    for (let j = 0; j < 64; j += 1) {
      let f;
      let g;
      if (j < 16) {
        f = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        f = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      const t = D;
      D = C;
      C = B;
      B = (B + rot((A + f + K[j] + (words[i + g] | 0)) | 0, S[(j >> 4) * 4 + (j % 4)])) | 0;
      A = t;
    }
    a = (a + A) | 0;
    b = (b + B) | 0;
    c = (c + C) | 0;
    d = (d + D) | 0;
  }
  return [a, b, c, d].map(hex).join('');
}

/** @returns {string} today's date as YYYY-MM-DD, local time */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** @returns {string} first 8 hex chars of md5(`<name> · <today>`) */
export function seedHash(name) {
  return md5(`${name} · ${todayISO()}`).slice(0, 8);
}
