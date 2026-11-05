/* Minecraft Mini — survival & creative voxel sandbox for GAME HUB.
 * Infinite chunked terrain, biomes, caves, ores, lighting, day/night, mobs,
 * crafting, smelting, chests, water, TNT. Original procedural textures, raw WebGL 1.
 */


// ───────────────────────────── constants ─────────────────────────────
const CS = 16;            // chunk size (x/z)
const YMIN = -55, WH = 321, HEIGHT = WH - YMIN;            // world height
const SEA = 63;           // sea level
const CVOL = CS * CS * HEIGHT;
const DAY_TICKS = 24000;
const DAY_SECONDS = 1200; // one full day = 20 minutes (like the original)
const REACH = 5;
const GRAVITY = 32;
const TICK = 0.05;        // 20 game ticks per second

// ───────────────────────────── helpers ─────────────────────────────
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const fract = v => v - Math.floor(v);
const ckey = (cx, cz) => cx + ',' + cz;
const bidx = (x, y, z) => ((y - YMIN) * CS + z) * CS + x;   // local chunk index
const pkey = (x, y, z) => x + ',' + y + ',' + z;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// deterministic per-coordinate hash → [0,1)
function hash2(x, z, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z, s) { return hash2(x + Math.imul(y | 0, 912367), z - Math.imul(y | 0, 31337), s); }

// ─────────────────────────── Perlin noise ───────────────────────────
function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const g2 = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  function n2(x, y) {
    const X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y;
    const xi = X & 255, yi = Y & 255, u = fade(x), v = fade(y);
    const a = p[xi] + yi, b = p[xi + 1] + yi;
    return lerp(lerp(g2(p[a], x, y), g2(p[b], x - 1, y), u), lerp(g2(p[a + 1], x, y - 1), g2(p[b + 1], x - 1, y - 1), u), v) * 0.7;
  }
  function g3(h, x, y, z) {
    h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function n3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255, u = fade(x), v = fade(y), w = fade(z);
    const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi, B = p[xi + 1] + yi, BA = p[B] + zi, BB = p[B + 1] + zi;
    return lerp(
      lerp(lerp(g3(p[AA], x, y, z), g3(p[BA], x - 1, y, z), u), lerp(g3(p[AB], x, y - 1, z), g3(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(g3(p[AA + 1], x, y, z - 1), g3(p[BA + 1], x - 1, y, z - 1), u), lerp(g3(p[AB + 1], x, y - 1, z - 1), g3(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm2(x, y, oct) { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; } return s / t; }
  return { n2, n3, fbm2 };
}
