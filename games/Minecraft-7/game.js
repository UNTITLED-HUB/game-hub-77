/* Minecraft Mini — survival & creative voxel sandbox for GAME HUB.
 * Infinite chunked terrain, biomes, caves, ores, lighting, day/night, mobs,
 * crafting, smelting, chests, water, TNT. Original procedural textures, raw WebGL 1.
 */
(() => {
'use strict';

// ───────────────────────────── constants ─────────────────────────────
const CS = 16;            // chunk size (x/z)
const WH = 64;            // world height
const SEA = 28;           // sea level
const CVOL = CS * CS * WH;
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
const bidx = (x, y, z) => (y * CS + z) * CS + x;   // local chunk index
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

// ─────────────────────────── blocks & items ───────────────────────────
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, BEDROCK = 5, SAND = 6, GRAVEL = 7, LOG = 8, PLANKS = 9,
  LEAVES = 10, GLASS = 11, COAL_ORE = 12, IRON_ORE = 13, GOLD_ORE = 14, DIAMOND_ORE = 15, TABLE = 16, FURNACE = 17,
  CHEST = 18, SANDSTONE = 19, STONE_BRICKS = 20, BRICKS = 21, CLAY = 22, SNOW_GRASS = 23, SNOW = 24, ICE = 25,
  CACTUS = 26, WOOL = 27, TORCH = 28, TALL_GRASS = 29, FLOWER_RED = 30, FLOWER_YELLOW = 31, SAPLING = 32,
  DEAD_BUSH = 33, SPRUCE_LOG = 34, SPRUCE_LEAVES = 35, BIRCH_LOG = 36, BIRCH_LEAVES = 37, GLOWSTONE = 38, TNT = 39,
  WATER = 40; // 41..47 = flowing water level 1..7
const WOOL_COLORS = [['빨간', [0.78, 0.2, 0.18]], ['주황', [0.92, 0.5, 0.16]], ['노란', [0.95, 0.82, 0.22]], ['연두', [0.45, 0.76, 0.2]],
  ['하늘', [0.35, 0.65, 0.92]], ['파란', [0.2, 0.28, 0.72]], ['보라', [0.55, 0.26, 0.72]], ['검은', [0.12, 0.12, 0.14]]];
const COLOR_WOOL = 48; // 48..55
const MOSSY = 56, OBSIDIAN = 57, BOOKSHELF = 58, PUMPKIN = 59, MELON = 60;

const STICK = 256, COAL = 257, IRON = 258, GOLD = 259, DIAMOND = 260, PICK0 = 261, AXE0 = 266, SHOVEL0 = 271, SWORD0 = 276,
  APPLE = 281, PORK = 282, COOKED_PORK = 283, BEEF = 284, STEAK = 285, MUTTON = 286, COOKED_MUTTON = 287, FLESH = 288,
  STRING = 289, BUCKET = 290, WATER_BUCKET = 291, FLINT = 292, FLINT_STEEL = 293, MELON_SLICE = 294, BREAD = 295;

const BLOCK = [];
function B(id, name, tex, o = {}) {
  BLOCK[id] = Object.assign({ id, name, tex, solid: true, opaque: true, render: 'cube', hard: 1, tool: null, tier: 0, drop: id, light: 0, gravity: false, replaceable: false, creative: true, cat: '블록' }, o);
}
const plant = { solid: false, opaque: false, render: 'cross', hard: 0, replaceable: false, cat: '장식' };
B(GRASS, '잔디 블록', { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, { hard: 0.6, tool: 'shovel', drop: DIRT });
B(DIRT, '흙', 'dirt', { hard: 0.5, tool: 'shovel' });
B(STONE, '돌', 'stone', { hard: 1.5, tool: 'pickaxe', tier: 1, drop: COBBLE });
B(COBBLE, '조약돌', 'cobble', { hard: 2, tool: 'pickaxe', tier: 1 });
B(BEDROCK, '기반암', 'bedrock', { hard: -1, creative: true });
B(SAND, '모래', 'sand', { hard: 0.5, tool: 'shovel', gravity: true });
B(GRAVEL, '자갈', 'gravel', { hard: 0.6, tool: 'shovel', gravity: true, drop: r => r() < 0.12 ? FLINT : GRAVEL });
B(LOG, '참나무 원목', { top: 'log_top', bottom: 'log_top', side: 'log_side' }, { hard: 2, tool: 'axe' });
B(PLANKS, '나무 판자', 'planks', { hard: 2, tool: 'axe' });
B(LEAVES, '참나무 잎', 'leaves', { opaque: false, render: 'cutout', hard: 0.2, tool: 'hoe', drop: r => { const v = r(); return v < 0.06 ? SAPLING : v < 0.085 ? APPLE : 0; } });
B(GLASS, '유리', 'glass', { opaque: false, render: 'cutout', hard: 0.3, drop: 0 });
B(COAL_ORE, '석탄 광석', 'coal_ore', { hard: 3, tool: 'pickaxe', tier: 1, drop: COAL });
B(IRON_ORE, '철 광석', 'iron_ore', { hard: 3, tool: 'pickaxe', tier: 2 });
B(GOLD_ORE, '금 광석', 'gold_ore', { hard: 3, tool: 'pickaxe', tier: 3 });
B(DIAMOND_ORE, '다이아몬드 광석', 'diamond_ore', { hard: 3, tool: 'pickaxe', tier: 3, drop: DIAMOND });
B(TABLE, '작업대', { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, { hard: 2.5, tool: 'axe', use: 'table', cat: '기능' });
B(FURNACE, '화로', { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, { hard: 3.5, tool: 'pickaxe', tier: 1, use: 'furnace', facing: true, cat: '기능' });
B(CHEST, '상자', { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, { hard: 2.5, tool: 'axe', use: 'chest', facing: true, cat: '기능' });
B(SANDSTONE, '사암', { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, { hard: 0.8, tool: 'pickaxe', tier: 1 });
B(STONE_BRICKS, '석재 벽돌', 'stone_bricks', { hard: 1.5, tool: 'pickaxe', tier: 1 });
B(BRICKS, '벽돌', 'bricks', { hard: 2, tool: 'pickaxe', tier: 1 });
B(CLAY, '점토', 'clay', { hard: 0.6, tool: 'shovel' });
B(SNOW_GRASS, '눈 덮인 잔디', { top: 'snow', bottom: 'dirt', side: 'snow_side' }, { hard: 0.6, tool: 'shovel', drop: DIRT });
B(SNOW, '눈 블록', 'snow', { hard: 0.2, tool: 'shovel' });
B(ICE, '얼음', 'ice', { opaque: false, render: 'translucent', hard: 0.5, tool: 'pickaxe', drop: 0, slippery: true });
B(CACTUS, '선인장', { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, { opaque: false, render: 'cutout', hard: 0.4, hurts: true, cat: '장식' });
B(WOOL, '흰색 양털', 'wool', { hard: 0.8, tool: 'shears' });
B(TORCH, '횃불', 'torch', { solid: false, opaque: false, render: 'torch', hard: 0, light: 14, cat: '장식', needsFloor: true });
B(TALL_GRASS, '풀', 'tall_grass', Object.assign({}, plant, { replaceable: true, drop: 0, needsSoil: true }));
B(FLOWER_RED, '양귀비', 'flower_red', Object.assign({}, plant, { needsSoil: true }));
B(FLOWER_YELLOW, '민들레', 'flower_yellow', Object.assign({}, plant, { needsSoil: true }));
B(SAPLING, '묘목', 'sapling', Object.assign({}, plant, { needsSoil: true }));
B(DEAD_BUSH, '마른 덤불', 'dead_bush', Object.assign({}, plant, { replaceable: true, drop: r => r() < 0.5 ? STICK : 0, needsSand: true }));
B(SPRUCE_LOG, '가문비나무 원목', { top: 'log_top', bottom: 'log_top', side: 'spruce_log' }, { hard: 2, tool: 'axe' });
B(SPRUCE_LEAVES, '가문비나무 잎', 'spruce_leaves', { opaque: false, render: 'cutout', hard: 0.2, drop: r => r() < 0.05 ? SAPLING : 0 });
B(BIRCH_LOG, '자작나무 원목', { top: 'log_top', bottom: 'log_top', side: 'birch_log' }, { hard: 2, tool: 'axe' });
B(BIRCH_LEAVES, '자작나무 잎', 'birch_leaves', { opaque: false, render: 'cutout', hard: 0.2, drop: r => r() < 0.05 ? SAPLING : 0 });
B(GLOWSTONE, '발광석', 'glowstone', { hard: 0.3, light: 15, cat: '장식' });
B(TNT, 'TNT', { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, { hard: 0, use: 'tnt', cat: '기능' });
for (let l = 0; l < 8; l++) B(WATER + l, l ? '흐르는 물' : '물', 'water', { solid: false, opaque: false, render: 'water', hard: -1, drop: 0, replaceable: true, creative: false, fluid: true, level: l });
WOOL_COLORS.forEach(([n], i) => B(COLOR_WOOL + i, n + ' 양털', 'wool_' + i, { hard: 0.8, cat: '장식' }));
B(MOSSY, '이끼 낀 조약돌', 'mossy', { hard: 2, tool: 'pickaxe', tier: 1 });
B(OBSIDIAN, '흑요석', 'obsidian', { hard: 50, tool: 'pickaxe', tier: 4 });
B(BOOKSHELF, '책장', { top: 'planks', bottom: 'planks', side: 'bookshelf' }, { hard: 1.5, tool: 'axe', drop: PLANKS, cat: '장식' });
B(PUMPKIN, '호박', { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, { hard: 1, tool: 'axe', cat: '장식' });
B(MELON, '수박', { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, { hard: 1, tool: 'axe', drop: () => MELON_SLICE, dropCount: r => 3 + Math.floor(r() * 5), cat: '장식' });
BLOCK[BEDROCK].creative = true;
const isWater = id => id >= WATER && id <= WATER + 7;
const waterLevel = id => id - WATER;
for (let i = 0; i < 256; i++) if (!BLOCK[i]) BLOCK[i] = null;

const ITEM = {};
function I(id, name, icon, o = {}) { ITEM[id] = Object.assign({ id, name, icon, stack: 64, cat: '재료' }, o); }
const TIERS = [
  { key: 'wood', name: '나무', level: 1, speed: 2, dur: 59, mat: PLANKS },
  { key: 'stone', name: '돌', level: 2, speed: 4, dur: 131, mat: COBBLE },
  { key: 'iron', name: '철', level: 3, speed: 6, dur: 250, mat: IRON },
  { key: 'gold', name: '금', level: 1, speed: 12, dur: 32, mat: GOLD },
  { key: 'diamond', name: '다이아몬드', level: 4, speed: 8, dur: 1561, mat: DIAMOND }];
const SWORD_DMG = [4, 5, 6, 4, 7];
I(STICK, '막대기', 'stick'); I(COAL, '석탄', 'coal'); I(IRON, '철 주괴', 'iron_ingot'); I(GOLD, '금 주괴', 'gold_ingot'); I(DIAMOND, '다이아몬드', 'diamond');
TIERS.forEach((t, i) => {
  I(PICK0 + i, t.name + ' 곡괭이', 'pickaxe_' + i, { stack: 1, cat: '도구', tool: { kind: 'pickaxe', level: t.level, speed: t.speed, dur: t.dur, dmg: 2 + Math.min(i, 3) * 0.5 + (i === 4 ? 1 : 0) } });
  I(AXE0 + i, t.name + ' 도끼', 'axe_' + i, { stack: 1, cat: '도구', tool: { kind: 'axe', level: t.level, speed: t.speed, dur: t.dur, dmg: SWORD_DMG[i] - 1 } });
  I(SHOVEL0 + i, t.name + ' 삽', 'shovel_' + i, { stack: 1, cat: '도구', tool: { kind: 'shovel', level: t.level, speed: t.speed, dur: t.dur, dmg: 1.5 + i * 0.4 } });
  I(SWORD0 + i, t.name + ' 검', 'sword_' + i, { stack: 1, cat: '도구', tool: { kind: 'sword', level: t.level, speed: 1.5, dur: t.dur, dmg: SWORD_DMG[i] } });
});
I(APPLE, '사과', 'apple', { cat: '음식', food: [4, 2.4] });
I(PORK, '익히지 않은 돼지고기', 'pork', { cat: '음식', food: [3, 1.8] });
I(COOKED_PORK, '익힌 돼지고기', 'cooked_pork', { cat: '음식', food: [8, 12.8] });
I(BEEF, '익히지 않은 소고기', 'beef', { cat: '음식', food: [3, 1.8] });
I(STEAK, '스테이크', 'steak', { cat: '음식', food: [8, 12.8] });
I(MUTTON, '익히지 않은 양고기', 'mutton', { cat: '음식', food: [2, 1.2] });
I(COOKED_MUTTON, '익힌 양고기', 'cooked_mutton', { cat: '음식', food: [6, 9.6] });
I(FLESH, '썩은 살점', 'flesh', { cat: '음식', food: [4, 0.8], poison: 0.8 });
I(MELON_SLICE, '수박 조각', 'melon_slice', { cat: '음식', food: [2, 1.2] });
I(BREAD, '빵', 'bread', { cat: '음식', food: [5, 6] });
I(STRING, '실', 'string');
I(BUCKET, '양동이', 'bucket', { stack: 16, cat: '도구' });
I(WATER_BUCKET, '물 양동이', 'water_bucket', { stack: 1, cat: '도구' });
I(FLINT, '부싯돌', 'flint');
I(FLINT_STEEL, '부싯돌과 부시', 'flint_steel', { stack: 1, cat: '도구', tool: { kind: 'lighter', level: 0, speed: 1, dur: 64, dmg: 1 } });

function info(id) {
  if (id < 256) { const b = BLOCK[id]; return b ? { id, name: b.name, stack: 64, block: b, cat: b.cat } : null; }
  return ITEM[id] || null;
}
const toolOf = id => (id >= 256 && ITEM[id] && ITEM[id].tool) || null;
const maxStack = id => (info(id) || { stack: 64 }).stack;

// ─────────────────────────── crafting ───────────────────────────
const LOGS = [LOG, SPRUCE_LOG, BIRCH_LOG];
const GROUP = { log: LOGS, planks: [PLANKS], wool: [WOOL, ...WOOL_COLORS.map((_, i) => COLOR_WOOL + i)] };
const RECIPES = [];
function shaped(pattern, keys, out, count = 1) { RECIPES.push({ pattern, keys, out, count }); }
function shapeless(items, out, count = 1) { RECIPES.push({ items, out, count }); }
shapeless(['log'], PLANKS, 4);
shaped(['P', 'P'], { P: PLANKS }, STICK, 4);
shaped(['PP', 'PP'], { P: PLANKS }, TABLE);
shaped(['CCC', 'C C', 'CCC'], { C: COBBLE }, FURNACE);
shaped(['PPP', 'P P', 'PPP'], { P: PLANKS }, CHEST);
shaped(['K', 'S'], { K: COAL, S: STICK }, TORCH, 4);
shaped(['SS', 'SS'], { S: SAND }, SANDSTONE);
shaped(['SS', 'SS'], { S: STONE }, STONE_BRICKS, 4);
shaped(['SS', 'SS'], { S: STRING }, WOOL);
shaped(['I I', ' I '], { I: IRON }, BUCKET);
shapeless([IRON, FLINT], FLINT_STEEL);
shaped(['GSG', 'SGS', 'GSG'], { G: GRAVEL, S: SAND }, TNT);
shaped(['PPP', 'BBB', 'PPP'], { P: PLANKS, B: STRING }, BOOKSHELF);
shaped(['MMM', 'MMM', 'MMM'], { M: MELON_SLICE }, MELON);
shaped(['AAA'], { A: APPLE }, BREAD);
TIERS.forEach((t, i) => {
  const M = t.mat;
  shaped(['MMM', ' S ', ' S '], { M, S: STICK }, PICK0 + i);
  shaped(['MM', 'MS', ' S'], { M, S: STICK }, AXE0 + i);
  shaped(['M', 'S', 'S'], { M, S: STICK }, SHOVEL0 + i);
  shaped(['M', 'M', 'S'], { M, S: STICK }, SWORD0 + i);
});
function matches(key, id) {
  if (typeof key === 'string' && GROUP[key]) return GROUP[key].includes(id);
  return key === id;
}
// grid: array of ids (0 = empty), size w×w
function craft(grid, w) {
  let minx = w, miny = w, maxx = -1, maxy = -1;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  if (maxx < 0) return null;
  const gw = maxx - minx + 1, gh = maxy - miny + 1, cells = [];
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) cells.push(grid[y * w + x]);
  const filled = cells.filter(Boolean);
  for (const r of RECIPES) {
    if (r.items) {
      if (filled.length !== r.items.length) continue;
      const left = [...r.items];
      let ok = true;
      for (const id of filled) { const k = left.findIndex(key => matches(key, id)); if (k < 0) { ok = false; break; } left.splice(k, 1); }
      if (ok) return { id: r.out, count: r.count };
      continue;
    }
    const ph = r.pattern.length, pw = Math.max(...r.pattern.map(s => s.length));
    if (pw !== gw || ph !== gh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < ph && ok; y++) for (let x = 0; x < pw && ok; x++) {
        const ch = (r.pattern[y][mirror ? pw - 1 - x : x] || ' ');
        const id = cells[y * gw + x];
        if (ch === ' ') { if (id) ok = false; } else if (!id || !matches(r.keys[ch], id)) ok = false;
      }
      if (ok) return { id: r.out, count: r.count };
    }
  }
  return null;
}
const SMELT = { [IRON_ORE]: IRON, [GOLD_ORE]: GOLD, [SAND]: GLASS, [COBBLE]: STONE, [PORK]: COOKED_PORK, [BEEF]: STEAK, [MUTTON]: COOKED_MUTTON, [CLAY]: BRICKS, [LOG]: COAL, [SPRUCE_LOG]: COAL, [BIRCH_LOG]: COAL, [CACTUS]: COLOR_WOOL + 3 };
const FUEL = { [COAL]: 80, [PLANKS]: 15, [LOG]: 15, [SPRUCE_LOG]: 15, [BIRCH_LOG]: 15, [STICK]: 5, [SAPLING]: 5, [TABLE]: 15, [CHEST]: 15, [BOOKSHELF]: 15 };
TIERS.forEach((t, i) => { if (i === 0) [PICK0, AXE0, SHOVEL0, SWORD0].forEach(b => FUEL[b + i] = 10); });
const SMELT_TIME = 8;

// ─────────────────────────── procedural texture atlas ───────────────────────────
const ATLAS = 256, TS = 16, TPR = ATLAS / TS;
const T = {}; let tileCount = 0;
let atlasCanvas = null, atlasData = null;
const ICON = {}; // id -> dataURL
const HUDICON = {};

function buildAtlas() {
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = ATLAS;
  const c2 = atlasCanvas.getContext('2d');
  const img = c2.createImageData(ATLAS, ATLAS);
  atlasData = img.data;
  paintAll();
  c2.putImageData(img, 0, 0);
}

function tile(name, fn) {
  const i = tileCount++; T[name] = i;
  const ox = (i % TPR) * TS, oy = Math.floor(i / TPR) * TS;
  const r = mulberry32(hashSeed(name) + 7);
  const t = {
    r, i,
    set(x, y, c, a = 255) {
      if (x < 0 || y < 0 || x >= TS || y >= TS) return;
      const k = ((oy + y) * ATLAS + ox + x) * 4;
      atlasData[k] = clamp(c[0], 0, 255); atlasData[k + 1] = clamp(c[1], 0, 255); atlasData[k + 2] = clamp(c[2], 0, 255); atlasData[k + 3] = a;
    },
    get(x, y) { x = (x + TS) % TS; y = (y + TS) % TS; const k = ((oy + y) * ATLAS + ox + x) * 4; return [atlasData[k], atlasData[k + 1], atlasData[k + 2], atlasData[k + 3]]; },
    noise(base, amt = 0.15) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) this.set(x, y, mul(base, 1 + (r() - 0.5) * 2 * amt)); },
    each(f) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) f(x, y); },
    copy(name2) { const j = T[name2], sx = (j % TPR) * TS, sy = Math.floor(j / TPR) * TS; for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const s = ((sy + y) * ATLAS + sx + x) * 4, d = ((oy + y) * ATLAS + ox + x) * 4; for (let q = 0; q < 4; q++) atlasData[d + q] = atlasData[s + q]; } },
    shade(x, y, f) { const p = this.get(x, y); this.set(x, y, mul(p, f), p[3]); },
  };
  fn(t);
}
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function voronoi(t, n, base, mortar, amt = 0.12, gap = 1.1) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([t.r() * 16, t.r() * 16, 0.78 + t.r() * 0.35]);
  t.each((x, y) => {
    let d1 = 99, d2 = 99, k = 0;
    pts.forEach((p, i) => {
      let dx = Math.abs(x + 0.5 - p[0]), dy = Math.abs(y + 0.5 - p[1]); dx = Math.min(dx, 16 - dx); dy = Math.min(dy, 16 - dy);
      const d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
    });
    if (d2 - d1 < gap) t.set(x, y, mul(mortar, 0.9 + t.r() * 0.2));
    else t.set(x, y, mul(base, pts[k][2] * (1 + (t.r() - 0.5) * amt) * (d1 < 1.5 ? 1.08 : 1)));
  });
}
function ore(t, color, n = 4) {
  t.copy('stone');
  for (let i = 0; i < n; i++) {
    const cx = 2 + t.r() * 12, cy = 2 + t.r() * 12;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const d = Math.hypot(x, y * 1.2); if (d > 1.6 + t.r() * 0.5) continue;
      t.set(Math.floor(cx + x), Math.floor(cy + y), mul(color, d < 0.8 ? 1.15 : 0.8 + t.r() * 0.3));
    }
  }
}
function bricks(t, base, mortar, rows, offsetStep) {
  t.each((x, y) => {
    const row = Math.floor(y / rows), off = (row % 2) * offsetStep;
    const edge = y % rows === rows - 1 || (x + off) % 8 === 7;
    t.set(x, y, edge ? mul(mortar, 0.92 + t.r() * 0.15) : mul(base, 0.88 + t.r() * 0.22 + (y % rows === 0 ? 0.08 : 0)));
  });
}
function mask(t, rows, pal) {
  rows.forEach((s, y) => { for (let x = 0; x < s.length; x++) { const ch = s[x]; if (pal[ch]) t.set(x, y, pal[ch]); } });
}
function shape(t, test, col, amt = 0.12) { t.each((x, y) => { const v = test(x, y); if (v) t.set(x, y, mul(Array.isArray(v) ? v : col, 1 + (t.r() - 0.5) * amt)); }); }
function outline(t, f = 0.4) {
  const filled = []; t.each((x, y) => { if (t.get(x, y)[3] > 0) filled.push(x + ',' + y); });
  const has = new Set(filled), add = [];
  t.each((x, y) => {
    if (has.has(x + ',' + y)) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (has.has(k) && x + dx >= 0 && x + dx < 16 && y + dy >= 0 && y + dy < 16) { add.push([x, y, t.get(x + dx, y + dy)]); break; } }
  });
  add.forEach(([x, y, c]) => t.set(x, y, mul(c, f)));
}
function blob(t, cx, cy, rx, ry, col, amt = 0.2) { shape(t, (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1, col, amt); }
function plantSprite(t, blades, col) {
  for (let i = 0; i < blades; i++) {
    let x = 2 + t.r() * 12; const h = 6 + t.r() * 9, lean = (t.r() - 0.5) * 0.5;
    for (let y = 15; y > 15 - h; y--) { t.set(Math.floor(x), y, mul(col, 0.75 + t.r() * 0.45)); x += lean; }
  }
}
const toolCols = [[156, 117, 64], [128, 128, 128], [222, 222, 222], [240, 210, 60], [90, 226, 212]];
const STICKC = [110, 78, 40];

function paintAll() {
  const G = [96, 160, 64], D = [134, 96, 67], S = [125, 125, 125];
  tile('white', t => t.each((x, y) => t.set(x, y, [255, 255, 255])));
  tile('black', t => t.each((x, y) => t.set(x, y, [16, 16, 16])));
  tile('dirt', t => { t.noise(D, 0.18); for (let i = 0; i < 18; i++) t.shade(Math.floor(t.r() * 16), Math.floor(t.r() * 16), t.r() < 0.5 ? 0.7 : 1.2); });
  tile('grass_top', t => { t.noise(G, 0.22); for (let i = 0; i < 30; i++) t.shade(Math.floor(t.r() * 16), Math.floor(t.r() * 16), 0.8); });
  tile('grass_side', t => { t.copy('dirt'); for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(t.r() * 2.4); for (let y = 0; y < h; y++) t.set(x, y, mul(G, 0.8 + t.r() * 0.3)); } });
  tile('stone', t => { t.noise(S, 0.1); for (let i = 0; i < 9; i++) { const x = Math.floor(t.r() * 14), y = Math.floor(t.r() * 16); t.shade(x, y, 0.8); t.shade(x + 1, y, 0.85); } });
  tile('cobble', t => voronoi(t, 9, [128, 128, 128], [70, 70, 70], 0.12, 1.0));
  tile('mossy', t => { t.copy('cobble'); for (let i = 0; i < 6; i++) blob(t, t.r() * 16, t.r() * 16, 2.2, 1.6, [80, 120, 60], 0.3); });
  tile('bedrock', t => voronoi(t, 12, [90, 90, 90], [30, 30, 30], 0.5, 1.4));
  tile('obsidian', t => { t.noise([24, 18, 38], 0.3); for (let i = 0; i < 12; i++) t.set(Math.floor(t.r() * 16), Math.floor(t.r() * 16), [70, 50, 110]); });
  tile('sand', t => { t.noise([219, 207, 160], 0.06); for (let i = 0; i < 20; i++) t.shade(Math.floor(t.r() * 16), Math.floor(t.r() * 16), 0.9); });
  tile('gravel', t => voronoi(t, 14, [130, 122, 118], [95, 88, 85], 0.35, 0.8));
  tile('clay', t => t.noise([160, 166, 178], 0.05));
  tile('log_side', t => { t.each((x, y) => t.set(x, y, mul([104, 82, 50], 0.85 + 0.15 * Math.sin(x * 2.1) + (t.r() - 0.5) * 0.12))); for (let i = 0; i < 5; i++) { const x = Math.floor(t.r() * 16), y = Math.floor(t.r() * 12); for (let k = 0; k < 4; k++) t.shade(x, y + k, 0.7); } });
  tile('spruce_log', t => { t.each((x, y) => t.set(x, y, mul([62, 44, 26], 0.85 + 0.15 * Math.sin(x * 1.7) + (t.r() - 0.5) * 0.15))); });
  tile('birch_log', t => { t.noise([216, 214, 204], 0.05); for (let i = 0; i < 7; i++) { const x = Math.floor(t.r() * 14), y = Math.floor(t.r() * 16), w = 1 + Math.floor(t.r() * 3); for (let k = 0; k < w; k++) t.set(x + k, y, [45, 42, 38]); } });
  tile('log_top', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 6.9 || x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, mul([104, 82, 50], 0.8 + t.r() * 0.2)); else t.set(x, y, mul([182, 146, 92], (Math.floor(d * 1.3) % 2 ? 0.86 : 1) * (0.95 + t.r() * 0.1))); }));
  tile('planks', t => t.each((x, y) => { const row = Math.floor(y / 4), seam = y % 4 === 3 || x === (row * 7 + 3) % 16; t.set(x, y, seam ? [110, 84, 50] : mul([168, 132, 82], 0.9 + 0.08 * Math.sin(x * 0.9 + row * 3) + t.r() * 0.08)); }));
  const leaf = (base, hole) => t => t.each((x, y) => { if (t.r() < hole) t.set(x, y, [0, 0, 0], 0); else t.set(x, y, mul(base, 0.65 + t.r() * 0.5)); });
  tile('leaves', leaf([62, 128, 40], 0.22));
  tile('spruce_leaves', leaf([46, 92, 58], 0.2));
  tile('birch_leaves', leaf([110, 156, 64], 0.22));
  tile('glass', t => t.each((x, y) => { const edge = x === 0 || y === 0 || x === 15 || y === 15; const streak = (x + y === 10 || x + y === 11 || x + y === 22) && x > 2 && x < 13; t.set(x, y, edge ? [206, 230, 236] : streak ? [236, 246, 250] : [200, 225, 235], edge ? 255 : streak ? 200 : 0); }));
  tile('coal_ore', t => ore(t, [36, 36, 36]));
  tile('iron_ore', t => ore(t, [216, 175, 147]));
  tile('gold_ore', t => ore(t, [250, 220, 70]));
  tile('diamond_ore', t => ore(t, [92, 230, 222]));
  tile('table_top', t => { t.copy('planks'); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [96, 64, 36]); else if (x === 5 || x === 10 || y === 5 || y === 10) t.shade(x, y, 0.72); }); });
  tile('table_side', t => { t.copy('planks'); t.each((x, y) => { if (y < 3) t.set(x, y, mul([120, 84, 48], 0.9 + t.r() * 0.15)); }); for (let y = 5; y < 13; y++) { t.set(3, y, [90, 90, 90]); t.set(4, y, [70, 70, 70]); } for (let x = 9; x < 14; x++) t.set(x, 6, [140, 140, 140]); for (let y = 6; y < 13; y++) t.set(11, y, [92, 64, 36]); });
  tile('table_front', t => { t.copy('table_side'); for (let x = 2; x < 7; x++) for (let y = 8; y < 13; y++) t.set(x, y, mul([150, 150, 150], 0.9 + t.r() * 0.2)); });
  tile('furnace_side', t => { t.noise([118, 118, 118], 0.12); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [82, 82, 82]); }); });
  tile('furnace_top', t => { t.noise([150, 150, 150], 0.08); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [100, 100, 100]); }); });
  const front = lit => t => { t.copy('furnace_side'); for (let x = 3; x < 13; x++) for (let y = 8; y < 14; y++) t.set(x, y, lit ? mix([255, 210, 80], [230, 90, 20], (y - 8) / 6 + t.r() * 0.3) : [24, 24, 24]); for (let x = 3; x < 13; x++) t.set(x, 4, [60, 60, 60]); };
  tile('furnace_front', front(false)); tile('furnace_front_lit', front(true));
  tile('chest_side', t => { t.each((x, y) => t.set(x, y, mul([160, 112, 48], 0.85 + 0.1 * Math.sin(y * 1.3) + t.r() * 0.1))); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15 || y === 5) t.set(x, y, [70, 46, 18]); }); });
  tile('chest_top', t => { t.copy('chest_side'); t.each((x, y) => { if (y === 5) t.set(x, y, mul([160, 112, 48], 0.9)); }); });
  tile('chest_front', t => { t.copy('chest_side'); for (let y = 3; y < 8; y++) for (let x = 7; x < 9; x++) t.set(x, y, y === 3 || y === 7 ? [60, 60, 60] : [190, 190, 190]); });
  tile('sandstone_top', t => t.noise([218, 205, 152], 0.05));
  tile('sandstone_side', t => t.each((x, y) => t.set(x, y, mul([214, 200, 148], (y < 3 ? 1.05 : y === 3 || y === 11 ? 0.82 : 0.96) + (t.r() - 0.5) * 0.06))));
  tile('stone_bricks', t => bricks(t, [122, 122, 122], [80, 80, 80], 8, 4));
  tile('bricks', t => bricks(t, [150, 74, 58], [168, 160, 150], 4, 4));
  tile('snow', t => t.noise([240, 246, 250], 0.03));
  tile('snow_side', t => { t.copy('dirt'); for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(t.r() * 2.4); for (let y = 0; y < h; y++) t.set(x, y, mul([240, 246, 250], 0.95 + t.r() * 0.05)); } });
  tile('ice', t => t.each((x, y) => { const s = (x - y + 16) % 9 === 0; t.set(x, y, s ? [230, 245, 255] : mul([150, 190, 240], 0.95 + t.r() * 0.1), 190); }));
  tile('cactus_side', t => t.each((x, y) => { const edge = x === 1 || x === 14, spine = (x === 4 || x === 11) && y % 4 === 1; t.set(x, y, spine ? [230, 230, 160] : edge ? [40, 90, 30] : mul([70, 140, 50], 0.9 + 0.1 * Math.sin(x * 1.6) + t.r() * 0.08), x === 0 || x === 15 ? 0 : 255); }));
  tile('cactus_top', t => t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, d > 6.5 ? [40, 90, 30] : mul([96, 160, 70], d < 3 ? 1.1 : 0.95), d > 7 ? 0 : 255); }));
  const knit = (col) => t => t.each((x, y) => t.set(x, y, mul(col, 0.86 + 0.08 * ((x + (y % 2) * 2) % 4 < 2 ? 1 : 0) + t.r() * 0.1)));
  tile('wool', knit([234, 234, 234]));
  WOOL_COLORS.forEach(([_, c], i) => tile('wool_' + i, knit(mul(c, 255))));
  tile('torch', t => { for (let y = 6; y < 16; y++) { t.set(7, y, [120, 86, 46]); t.set(8, y, [96, 68, 36]); } t.set(7, 4, [255, 230, 120]); t.set(8, 4, [255, 200, 60]); t.set(7, 5, [255, 170, 40]); t.set(8, 5, [255, 240, 160]); t.set(7, 3, [255, 250, 210]); t.set(8, 3, [255, 220, 90]); });
  tile('tall_grass', t => plantSprite(t, 9, [86, 150, 52]));
  const flower = (petal, center) => t => { for (let y = 8; y < 16; y++) t.set(7, y, [60, 120, 40]); t.set(6, 12, [70, 140, 45]); t.set(5, 11, [70, 140, 45]); t.set(8, 13, [70, 140, 45]); t.set(9, 12, [70, 140, 45]); blob(t, 7.5, 5.5, 3, 2.6, petal, 0.15); t.set(7, 5, center); t.set(8, 5, center); };
  tile('flower_red', flower([210, 30, 30], [40, 20, 20]));
  tile('flower_yellow', flower([248, 220, 50], [255, 245, 150]));
  tile('sapling', t => { for (let y = 9; y < 16; y++) t.set(7, y, [96, 70, 40]); blob(t, 7.5, 6, 4.5, 4, [60, 130, 40], 0.4); t.each((x, y) => { if (t.r() < 0.15 && t.get(x, y)[3]) t.set(x, y, [0, 0, 0], 0); }); });
  tile('dead_bush', t => { const br = (x, y, dx, n) => { for (let i = 0; i < n; i++) { t.set(Math.round(x), Math.round(y), [124, 84, 40]); x += dx; y -= 1; } }; br(7.5, 15, 0, 6); br(7.5, 11, -0.7, 5); br(7.5, 10, 0.8, 6); br(7.5, 13, 1, 3); br(7.5, 12, -1.2, 3); });
  tile('glowstone', t => voronoi(t, 8, [250, 210, 110], [160, 110, 50], 0.25, 1.0));
  tile('tnt_side', t => t.each((x, y) => { t.set(x, y, y >= 5 && y <= 10 ? [236, 236, 230] : mul([210, 50, 40], (x % 4 === 0 ? 0.8 : 1) * (0.95 + t.r() * 0.1))); }));
  tile('tnt_top', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, d < 1.6 ? [40, 40, 40] : d < 5 ? [200, 60, 50] : [170, 40, 34]); }));
  tile('tnt_bottom', t => t.noise([170, 40, 34], 0.08));
  // letters on TNT side
  { const L = { T: ['111', '010', '010', '010'], N: ['101', '111', '111', '101'] }; const word = 'TNT'; const t = { i: T.tnt_side }; let x0 = 2; for (const ch of word) { L[ch].forEach((row, y) => { for (let x = 0; x < 3; x++) if (row[x] === '1') { const ox = (T.tnt_side % TPR) * TS, oy = Math.floor(T.tnt_side / TPR) * TS, k = ((oy + 6 + y) * ATLAS + ox + x0 + x) * 4; atlasData[k] = atlasData[k + 1] = atlasData[k + 2] = 30; } }); x0 += 4; } void t; }
  tile('water', t => t.each((x, y) => { const w = Math.sin(x * 0.8 + y * 0.4) + Math.sin(y * 1.3 - x * 0.3); t.set(x, y, mul([46, 92, 214], 0.92 + w * 0.05 + t.r() * 0.05), 180); }));
  tile('bookshelf', t => { t.copy('planks'); for (let row = 0; row < 2; row++) { let x = 1; const y0 = 2 + row * 7; while (x < 15) { const w = 1 + Math.floor(t.r() * 2), col = [[150, 40, 40], [40, 80, 150], [60, 120, 60], [170, 140, 60], [100, 60, 120]][Math.floor(t.r() * 5)]; for (let k = 0; k < w && x < 15; k++, x++) for (let y = y0; y < y0 + 5; y++) t.set(x, y, mul(col, 0.85 + (k === 0 ? 0.2 : 0))); x++; } } });
  tile('pumpkin_side', t => t.each((x, y) => t.set(x, y, mul([220, 128, 30], (x % 4 === 0 ? 0.78 : 1) * (0.94 + t.r() * 0.08)))));
  tile('pumpkin_top', t => { t.copy('pumpkin_side'); for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) t.set(x, y, [90, 70, 30]); });
  tile('melon_side', t => t.each((x, y) => t.set(x, y, mul((x + Math.floor(y / 5)) % 5 < 2 ? [60, 120, 30] : [110, 170, 40], 0.92 + t.r() * 0.1))));
  tile('melon_top', t => { t.noise([110, 160, 40], 0.08); for (let i = 0; i < 4; i++) t.set(7 + (i % 2), 7 + (i >> 1), [70, 100, 30]); });

  // ── items ──
  tile('stick', t => { for (let x = 3; x < 13; x++) { t.set(x, 15 - x, STICKC); t.set(x + 1, 15 - x, mul(STICKC, 0.7)); } outline(t, 0.5); });
  tile('coal', t => { blob(t, 8, 8.5, 5.2, 4.6, [40, 40, 44], 0.35); for (let i = 0; i < 6; i++) t.set(4 + Math.floor(t.r() * 8), 5 + Math.floor(t.r() * 7), [92, 92, 100]); outline(t, 0.5); });
  const ingot = c => t => { for (let y = 6; y < 11; y++) for (let x = 3 + (10 - y) * 0 ; x < 13; x++) { const off = Math.floor((10 - y) * 0.5); if (x - off < 2 || x - off > 12) continue; t.set(x - off, y, mul(c, y < 8 ? 1.15 : y === 10 ? 0.7 : 0.95)); } outline(t, 0.45); };
  tile('iron_ingot', ingot([210, 210, 214])); tile('gold_ingot', ingot([246, 210, 60]));
  tile('diamond', t => { const rows = [[6, 9], [5, 10], [4, 11], [4, 11], [5, 10], [6, 9], [7, 8]]; rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) t.set(x, 4 + i, mul([96, 232, 222], i < 2 ? 1.2 : x < 8 ? 1 : 0.8)); }); outline(t, 0.4); });
  tile('flint', t => { shape(t, (x, y) => y > 4 && y < 13 && x > 3 && x < 12 && x + y > 12 && x - y < 5, [58, 58, 62], 0.3); outline(t, 0.5); });
  tile('string', t => { for (let x = 2; x < 14; x++) t.set(x, Math.round(8 + 2 * Math.sin(x * 0.9)), [236, 236, 236]); outline(t, 0.35); });
  tile('apple', t => { blob(t, 8, 9.5, 5, 4.8, [214, 34, 34], 0.15); t.set(6, 7, [255, 160, 160]); t.set(8, 3, [100, 70, 30]); t.set(8, 4, [100, 70, 30]); t.set(9, 3, [70, 150, 40]); t.set(10, 3, [70, 150, 40]); outline(t, 0.4); });
  const meat = (c, fat) => t => { shape(t, (x, y) => { const dx = (x + 0.5 - 8) / 5.5, dy = (y + 0.5 - 8.5) / 4; return dx * dx + dy * dy <= 1; }, c, 0.15); for (let x = 4; x < 12; x++) t.set(x, 7 + Math.round(Math.sin(x) * 0.6), fat); outline(t, 0.45); };
  tile('pork', meat([240, 150, 150], [255, 210, 210])); tile('cooked_pork', meat([176, 104, 62], [214, 160, 110]));
  tile('beef', meat([200, 50, 50], [240, 200, 200])); tile('steak', meat([120, 66, 38], [160, 100, 60]));
  tile('mutton', meat([220, 80, 90], [250, 220, 210])); tile('cooked_mutton', meat([160, 90, 60], [200, 150, 100]));
  tile('flesh', t => { blob(t, 8, 8.5, 5.5, 4.5, [128, 112, 60], 0.3); for (let i = 0; i < 8; i++) t.set(4 + Math.floor(t.r() * 8), 6 + Math.floor(t.r() * 5), [80, 90, 40]); outline(t, 0.45); });
  tile('melon_slice', t => { shape(t, (x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 5); return y >= 5 && d <= 7 ? (d > 5.8 ? [70, 140, 40] : d > 5 ? [220, 240, 170] : [220, 60, 60]) : 0; }, null, 0.1); [[6, 7], [9, 8], [8, 10], [5, 9], [11, 6]].forEach(([x, y]) => t.set(x, y, [30, 20, 20])); outline(t, 0.45); });
  tile('bread', t => { blob(t, 8, 9, 6.5, 3.5, [200, 150, 80], 0.15); for (let x = 4; x < 12; x += 3) { t.set(x, 7, [150, 100, 50]); t.set(x + 1, 8, [150, 100, 50]); } outline(t, 0.45); });
  const bucket = water => t => { for (let y = 5; y < 14; y++) { const inset = Math.floor((y - 5) / 4); for (let x = 3 + inset; x <= 12 - inset; x++) t.set(x, y, water && y < 7 ? [60, 100, 230] : y < 7 ? [70, 70, 74] : mul([190, 190, 196], x < 6 ? 1.1 : x > 10 ? 0.8 : 1)); } for (let x = 4; x < 12; x++) t.set(x, 2 + Math.round(Math.abs(x - 7.5) * 0.4), [150, 150, 150]); outline(t, 0.45); };
  tile('bucket', bucket(false)); tile('water_bucket', bucket(true));
  tile('flint_steel', t => { for (let y = 4; y < 12; y++) { t.set(4, y, [200, 200, 200]); t.set(5, y, [170, 170, 170]); } for (let x = 4; x < 9; x++) { t.set(x, 4, [200, 200, 200]); t.set(x, 11, [200, 200, 200]); } blob(t, 11, 10, 2.5, 2.5, [60, 60, 64], 0.3); outline(t, 0.5); });
  for (let i = 0; i < 5; i++) {
    const H = toolCols[i];
    tile('pickaxe_' + i, t => { for (let x = 2; x < 10; x++) t.set(x, 15 - x - 1, STICKC); shape(t, (x, y) => { const d = Math.hypot(x - 2, y - 13); return d >= 10.3 && d <= 12.4 && x >= 3 && y <= 11 && x + y > 8 ? H : 0; }, H, 0.15); outline(t, 0.45); });
    tile('axe_' + i, t => { for (let x = 2; x < 12; x++) t.set(x, 15 - x - 1, STICKC); shape(t, (x, y) => Math.hypot(x - 8, y - 4) <= 3.8 && x + y <= 13 && x + y >= 7 ? H : 0, H, 0.15); outline(t, 0.45); });
    tile('shovel_' + i, t => { for (let x = 2; x < 10; x++) t.set(x, 15 - x - 1, STICKC); shape(t, (x, y) => Math.hypot(x - 11, y - 4) <= 3.2 ? H : 0, H, 0.15); outline(t, 0.45); });
    tile('sword_' + i, t => { for (let x = 5; x < 14; x++) { t.set(x, 15 - x, mul(H, 1.12)); t.set(x, 14 - x, H); t.set(x + 1, 15 - x, mul(H, 0.8)); } for (let k = 0; k < 5; k++) t.set(2 + k, 9 + k, [80, 60, 40]); for (let x = 1; x < 4; x++) t.set(x, 15 - x - 0, STICKC); outline(t, 0.45); });
  }
  // ── mobs ──
  tile('pig_skin', t => t.noise([240, 164, 160], 0.06));
  tile('pig_face', t => { t.copy('pig_skin'); [[3, 5], [12, 5]].forEach(([x, y]) => { t.set(x, y, [255, 255, 255]); t.set(x + (x < 8 ? 1 : -1), y, [20, 20, 20]); }); for (let y = 8; y < 12; y++) for (let x = 5; x < 11; x++) t.set(x, y, [226, 128, 128]); t.set(6, 9, [120, 60, 60]); t.set(9, 9, [120, 60, 60]); });
  tile('cow_skin', t => { const n = makeNoise(77); t.each((x, y) => t.set(x, y, n.n2(x / 4, y / 4) > 0.15 ? [230, 230, 226] : mul([82, 56, 38], 0.9 + t.r() * 0.15))); });
  tile('cow_face', t => { t.noise([82, 56, 38], 0.1); for (let y = 3; y < 9; y++) for (let x = 6; x < 10; x++) t.set(x, y, [230, 230, 226]); [[3, 5], [12, 5]].forEach(([x, y]) => t.set(x, y, [10, 10, 10])); for (let y = 10; y < 15; y++) for (let x = 4; x < 12; x++) t.set(x, y, [200, 160, 150]); t.set(5, 12, [60, 40, 40]); t.set(10, 12, [60, 40, 40]); });
  tile('sheep_face', t => { t.noise([214, 196, 176], 0.05); t.each((x, y) => { if (y < 3 || x < 2 || x > 13) t.set(x, y, mul([234, 234, 234], 0.9 + t.r() * 0.1)); }); [[4, 6], [11, 6]].forEach(([x, y]) => { t.set(x, y, [20, 20, 20]); t.set(x, y - 1, [240, 240, 240]); }); for (let x = 6; x < 10; x++) t.set(x, 11, [190, 140, 140]); });
  tile('zombie_skin', t => t.noise([118, 136, 92], 0.12));
  tile('zombie_face', t => { t.copy('zombie_skin'); for (const x of [3, 4, 11, 12]) { t.set(x, 6, [16, 20, 12]); t.set(x, 7, [16, 20, 12]); } for (let x = 5; x < 11; x++) t.set(x, 11, [50, 60, 36]); t.set(7, 9, [80, 96, 60]); t.set(8, 9, [80, 96, 60]); });
  tile('zombie_shirt', t => { t.noise([110, 80, 52], 0.15); for (let i = 0; i < 6; i++) t.set(Math.floor(t.r() * 16), 13 + Math.floor(t.r() * 3), [0, 0, 0], 0); });
  tile('zombie_pants', t => t.noise([62, 60, 72], 0.12));
  tile('spider_body', t => { t.noise([52, 42, 36], 0.25); for (let i = 0; i < 20; i++) t.set(Math.floor(t.r() * 16), Math.floor(t.r() * 16), [90, 76, 64]); });
  tile('spider_face', t => { t.copy('spider_body'); [[4, 6], [11, 6], [6, 5], [9, 5], [5, 8], [10, 8]].forEach(([x, y]) => t.set(x, y, [220, 20, 20])); });
  tile('player_arm', t => t.noise([214, 168, 128], 0.05));
  tile('sun', t => t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, d < 4 ? [255, 255, 230] : d < 6 ? [255, 240, 150] : [255, 220, 110], d < 6 ? 255 : 150); }));
  tile('moon', t => { t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, [222, 226, 236], d < 6 ? 255 : 0); }); [[5, 5], [9, 9], [10, 5], [6, 10]].forEach(([x, y]) => { t.set(x, y, [170, 175, 190]); t.set(x + 1, y, [180, 185, 200]); }); });
  for (let k = 0; k < 10; k++) tile('crack_' + k, t => { const rr = mulberry32(99); for (let l = 0; l < 2 + k * 1.6; l++) { let x = 8 + (rr() - 0.5) * 4, y = 8 + (rr() - 0.5) * 4; const dx = rr() - 0.5, dy = rr() - 0.5; for (let s = 0; s < 3 + k * 0.6; s++) { t.set(Math.floor(x), Math.floor(y), [30, 30, 30], 220); x += dx * 2 + (rr() - 0.5); y += dy * 2 + (rr() - 0.5); } } });
  // ── HUD ──
  const heartRows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const heart = mode => t => heartRows.forEach((s, y) => { for (let x = 0; x < 7; x++) if (s[x] === '#') { const fill = mode === 'full' || (mode === 'half' && x < 4); const edge = (heartRows[y - 1]?.[x] !== '#') || (heartRows[y + 1]?.[x] !== '#') || s[x - 1] !== '#' || s[x + 1] !== '#'; t.set(4 + x, 5 + y, edge ? [24, 10, 10] : fill ? (y === 1 && x < 3 ? [255, 140, 140] : [220, 20, 30]) : [60, 30, 30]); } });
  tile('heart_full', heart('full')); tile('heart_half', heart('half')); tile('heart_empty', heart('empty'));
  const food = mode => t => { const rows = ['..###..', '.#####.', '.#####.', '..####.', '...##..', '....#..', '.....##']; rows.forEach((s, y) => { for (let x = 0; x < 7; x++) if (s[x] === '#') { const fill = mode === 'full' || (mode === 'half' && x >= 3); t.set(4 + x, 4 + y, y > 4 ? [230, 220, 200] : fill ? (x < 3 && y < 2 ? [220, 140, 80] : [170, 90, 40]) : [60, 40, 30]); } }); outline(t, 0.3); };
  tile('food_full', food('full')); tile('food_half', food('half')); tile('food_empty', food('empty'));
  tile('bubble', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3.5 && d > 2.2) t.set(x, y, [120, 180, 255]); else if (d <= 2.2 && x < 8 && y < 8) t.set(x, y, [230, 240, 255]); }));
}

function tileUV(name) { const i = typeof name === 'number' ? name : T[name]; return [(i % TPR) / TPR, Math.floor(i / TPR) / TPR]; }

// UI icons for items (isometric cube for blocks)
async function applyGeneratedItemIcons() {
  const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
  try {
    const [blocks, items] = await Promise.all([load('textures/blocks.png'), load('textures/items.png')]);
    const icon = (image, index) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; const cw = image.naturalWidth / 8, ch = image.naturalHeight / 8; g.drawImage(image, (index % 8) * cw, Math.floor(index / 8) * ch, cw, ch, 0, 0, 32, 32); return c.toDataURL('image/png'); };
    for (let id = 1; id <= 60; id++) ICON[id] = icon(blocks, id - 1);
    for (let id = 256; id <= 295; id++) ICON[id] = icon(items, id - 256);
    for (let id = 41; id <= 47; id++) ICON[id] = ICON[40];
  } catch { /* The built-in procedural icons remain as an offline fallback. */ }
}

function buildIcons() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const src = name => { const i = T[name]; return [(i % TPR) * TS, Math.floor(i / TPR) * TS]; };
  const face = (name, a, b, cc, d, e, f, dark) => {
    g.setTransform(a, b, cc, d, e, f); const [sx, sy] = src(name);
    g.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (dark) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); g.globalCompositeOperation = 'source-over'; }
  };
  const all = [];
  for (let id = 1; id < 256; id++) if (BLOCK[id] && BLOCK[id].creative !== false) all.push(id);
  for (const id in ITEM) all.push(+id);
  all.push(WATER);
  for (const id of all) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 32, 32);
    const b = id < 256 ? BLOCK[id] : null;
    if (b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent' || b.render === 'water')) {
      const tx = typeof b.tex === 'string' ? { top: b.tex, side: b.tex } : b.tex;
      face(tx.top, 15 / 16, -7.5 / 16, 15 / 16, 7.5 / 16, 1, 8.5, 0);
      face(tx.front || tx.side, 15 / 16, 7.5 / 16, 0, 15.5 / 16, 1, 8.5, 0.22);
      face(tx.side, 15 / 16, -7.5 / 16, 0, 15.5 / 16, 16, 16, 0.42);
    } else {
      const name = b ? b.tex : ITEM[id].icon; const [sx, sy] = src(name);
      g.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 32, 32);
    }
    ICON[id] = c.toDataURL();
  }
  for (const n of ['heart_full', 'heart_half', 'heart_empty', 'food_full', 'food_half', 'food_empty', 'bubble']) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 32, 32); const [sx, sy] = src(n); g.drawImage(atlasCanvas, sx + 3, sy + 3, 9, 9, 0, 0, 32, 32); HUDICON[n] = c.toDataURL();
  }
}

// ─────────────────────────── world: generation, storage, light ───────────────────────────
const OCEAN = 0, BEACH = 1, PLAINS = 2, FOREST = 3, DESERT = 4, SNOWY = 5, MOUNTAIN = 6;
const BIOME_NAME = ['바다', '해변', '평원', '숲', '사막', '설원', '산'];
let W = null;           // active world runtime
let lastChunk = null;

function column(x, z) {
  const n = W.noise, m = W.noise2;
  const cont = n.fbm2(x / 256, z / 256, 4);
  const det = n.fbm2(x / 48 + 31.7, z / 48 - 17.3, 3);
  const mf = Math.max(0, m.fbm2(x / 170 + 9.1, z / 170 - 4.4, 3) - 0.04) * 2.2;
  const temp = m.fbm2(x / 420 + 500.5, z / 420 - 200.5, 2);
  const hum = n.fbm2(x / 360 - 800.5, z / 360 + 300.5, 2);
  let h = SEA + 3 + cont * 26 + det * 5 + mf * mf * 70;
  h = Math.floor(clamp(h, 6, WH - 7));
  let b;
  if (h < SEA) b = OCEAN;
  else if (h <= SEA + 1 && temp > -0.2) b = BEACH;
  else if (mf > 0.42 && h > SEA + 12) b = MOUNTAIN;
  else if (temp < -0.17) b = SNOWY;
  else if (temp > 0.16 && hum < 0.06) b = DESERT;
  else if (hum > 0.02) b = FOREST;
  else b = PLAINS;
  return [h, b];
}

function newChunk(cx, cz) {
  return { cx, cz, blocks: new Uint8Array(CVOL), light: new Uint8Array(CVOL), emit: new Set(), lit: false, needLight: true, needMesh: true, mesh: null, water: null, biomes: new Uint8Array(CS * CS), heights: new Uint8Array(CS * CS) };
}

function generateChunk(cx, cz) {
  const ch = newChunk(cx, cz), B = ch.blocks, seed = W.seed;
  const x0 = cx * CS, z0 = cz * CS, M = 3, SZ = CS + M * 2;
  const hs = new Int16Array(SZ * SZ), bs = new Uint8Array(SZ * SZ);
  for (let lz = 0; lz < SZ; lz++) for (let lx = 0; lx < SZ; lx++) { const [h, b] = column(x0 + lx - M, z0 + lz - M); hs[lz * SZ + lx] = h; bs[lz * SZ + lx] = b; }
  const n3a = W.noise.n3, n3b = W.noise2.n3;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const h = hs[(z + M) * SZ + x + M], b = bs[(z + M) * SZ + x + M], wx = x0 + x, wz = z0 + z;
    ch.biomes[z * CS + x] = b; ch.heights[z * CS + x] = h;
    let top = GRASS, fill = DIRT, deep = STONE;
    if (b === OCEAN) { top = h < SEA - 5 ? GRAVEL : hash2(wx, wz, seed + 3) < 0.08 ? CLAY : SAND; fill = h < SEA - 5 ? GRAVEL : SAND; }
    else if (b === BEACH) { top = SAND; fill = SAND; deep = SANDSTONE; }
    else if (b === DESERT) { top = SAND; fill = SAND; deep = SANDSTONE; }
    else if (b === SNOWY) top = SNOW_GRASS;
    else if (b === MOUNTAIN) { top = h > 47 ? SNOW : h > 39 ? STONE : GRASS; fill = h > 39 ? STONE : DIRT; }
    const caveTop = (b === OCEAN || b === BEACH || h <= SEA + 2) ? h - 6 : h;
    for (let y = 0; y <= Math.max(h, SEA); y++) {
      let id;
      if (y === 0) id = BEDROCK;
      else if (y <= 3 && hash3(wx, y, wz, seed) < 0.75 - y * 0.22) id = BEDROCK;
      else if (y < h - 3) id = (deep === SANDSTONE && y < h - 6) ? STONE : deep;
      else if (y < h) id = fill;
      else if (y === h) id = top;
      else id = (b === SNOWY && y === SEA) ? ICE : WATER;
      if (id !== WATER && id !== ICE && id !== BEDROCK && y > 3 && y <= caveTop) {
        const a = n3a(wx / 26, y / 15, wz / 26), c = n3b(wx / 26, y / 15, wz / 26);
        if (a * a + c * c < 0.0075 || (y < 22 && n3a(wx / 55 + 40, y / 26, wz / 55) > 0.42)) id = AIR;
      }
      B[bidx(x, y, z)] = id;
    }
  }
  // ores
  const rnd = mulberry32(hash2(cx, cz, seed + 5) * 4294967296);
  const vein = (id, count, size, ymin, ymax) => {
    for (let v = 0; v < count; v++) {
      let x = rnd() * 16, y = ymin + rnd() * (ymax - ymin), z = rnd() * 16;
      const n = Math.floor(size * (0.6 + rnd() * 0.6));
      for (let k = 0; k < n; k++) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        if (ix >= 0 && ix < CS && iz >= 0 && iz < CS && iy > 0 && iy < WH && B[bidx(ix, iy, iz)] === STONE) B[bidx(ix, iy, iz)] = id;
        x += rnd() * 2 - 1; y += rnd() * 2 - 1; z += rnd() * 2 - 1;
      }
    }
  };
  vein(COAL_ORE, 14, 10, 5, 58); vein(IRON_ORE, 9, 7, 4, 44); vein(GOLD_ORE, 2, 6, 4, 26); vein(DIAMOND_ORE, 1, 5, 3, 14);
  vein(DIRT, 4, 14, 8, 50); vein(GRAVEL, 3, 12, 5, 50);
  if (rnd() < 0.6) vein(DIAMOND_ORE, 1, 3, 3, 12);
  // surface decoration
  const setL = (lx, y, lz, id, force) => {
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= WH) return;
    const i = bidx(lx, y, lz), cur = B[i];
    if (cur === AIR || (BLOCK[cur] && BLOCK[cur].render === 'cross') || (force && (cur === LEAVES || cur === SPRUCE_LEAVES || cur === BIRCH_LEAVES))) B[i] = id;
  };
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const h = hs[(z + M) * SZ + x + M], b = bs[(z + M) * SZ + x + M], wx = x0 + x, wz = z0 + z;
    if (h <= SEA || h + 1 >= WH) continue;
    const topId = B[bidx(x, h, z)];
    const r = hash2(wx, wz, seed + 21);
    if (b === DESERT && topId === SAND) {
      if (r < 0.005) { const ht = 1 + Math.floor(hash2(wx, wz, seed + 22) * 3); for (let k = 1; k <= ht; k++) setL(x, h + k, z, CACTUS); }
      else if (r < 0.014) setL(x, h + 1, z, DEAD_BUSH);
    } else if (topId === GRASS) {
      const g = b === PLAINS ? 0.2 : b === FOREST ? 0.09 : 0.05;
      if (r < g) setL(x, h + 1, z, TALL_GRASS);
      else if (r < g + 0.018) setL(x, h + 1, z, hash2(wx, wz, seed + 23) < 0.5 ? FLOWER_RED : FLOWER_YELLOW);
      else if (r < g + 0.0195 && b === PLAINS) setL(x, h + 1, z, PUMPKIN);
      else if (r < g + 0.0205 && b === FOREST) setL(x, h + 1, z, MELON);
    }
  }
  // trees (may cross chunk borders, deterministic per column)
  for (let lz = -M; lz < CS + M; lz++) for (let lx = -M; lx < CS + M; lx++) {
    const k = (lz + M) * SZ + lx + M, h = hs[k], b = bs[k], wx = x0 + lx, wz = z0 + lz;
    if (h <= SEA || h > WH - 12) continue;
    const dens = b === FOREST ? 0.05 : b === SNOWY ? 0.022 : b === PLAINS ? 0.005 : (b === MOUNTAIN && h <= 39) ? 0.012 : 0;
    if (!dens || hash2(wx, wz, seed + 11) >= dens) continue;
    if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) { const t = B[bidx(lx, h, lz)]; if (t !== GRASS && t !== SNOW_GRASS && t !== DIRT) continue; }
    const kind = b === SNOWY ? 2 : (b === FOREST && hash2(wx, wz, seed + 12) < 0.3) ? 1 : 0;
    placeTree(setL, lx, h + 1, lz, kind, hash2(wx, wz, seed + 13));
  }
  // apply player modifications
  const mods = W.mods.get(ckey(cx, cz));
  if (mods) for (const [i, id] of mods) B[i] = id;
  for (let i = 0; i < CVOL; i++) { const id = B[i]; if (id && BLOCK[id] && BLOCK[id].light) ch.emit.add(i); }
  return ch;
}

function placeTree(set, x, y, z, kind, r) {
  const log = kind === 1 ? BIRCH_LOG : kind === 2 ? SPRUCE_LOG : LOG;
  const leaf = kind === 1 ? BIRCH_LEAVES : kind === 2 ? SPRUCE_LEAVES : LEAVES;
  if (kind === 2) {
    const ht = 6 + Math.floor(r * 3);
    for (let k = 0; k < ht; k++) set(x, y + k, z, log, true);
    let rad = 0;
    for (let k = ht; k >= 2; k--) {
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad + (rad > 1 ? 1 : 0) && (dx || dz || k >= ht)) set(x + dx, y + k, z + dz, leaf);
      rad = rad >= 2 ? 1 : rad + 1;
    }
    set(x, y + ht, z, leaf); set(x, y + ht + 1, z, leaf);
    return;
  }
  const ht = (kind === 1 ? 5 : 4) + Math.floor(r * 3);
  for (let k = 0; k < ht; k++) set(x, y + k, z, log, true);
  for (let k = ht - 3; k <= ht; k++) {
    const rad = k >= ht - 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && (k === ht || hash3(x + dx, k, z + dz, 7) < 0.5)) continue;
      if (dx === 0 && dz === 0 && k < ht) continue;
      set(x + dx, y + k, z + dz, leaf);
    }
  }
}

function getChunk(cx, cz) {
  if (lastChunk && lastChunk.cx === cx && lastChunk.cz === cz) return lastChunk;
  const c = W.chunks.get(ckey(cx, cz)); if (c) lastChunk = c; return c;
}
function getBlock(x, y, z) {
  if (y < 0) return BEDROCK; if (y >= WH) return AIR;
  const ch = getChunk(x >> 4, z >> 4); if (!ch) return BEDROCK;
  return ch.blocks[bidx(x & 15, y, z & 15)];
}
function getLight(x, y, z) {
  if (y >= WH) return 0xF0; if (y < 0) return 0;
  const ch = getChunk(x >> 4, z >> 4); if (!ch) return 0xF0;
  return ch.light[bidx(x & 15, y, z & 15)];
}
const solidAt = (x, y, z) => { const b = BLOCK[getBlock(x, y, z)]; return !!(b && b.solid); };

function recordMod(cx, cz, i, id) {
  const k = ckey(cx, cz); let m = W.mods.get(k); if (!m) W.mods.set(k, m = new Map()); m.set(i, id);
}
function setBlock(x, y, z, id, opts = {}) {
  if (y < 0 || y >= WH) return false;
  const cx = x >> 4, cz = z >> 4, ch = getChunk(cx, cz); if (!ch) return false;
  const lx = x & 15, lz = z & 15, i = bidx(lx, y, lz), old = ch.blocks[i];
  if (old === id) return false;
  ch.blocks[i] = id; recordMod(cx, cz, i, id);
  const ol = (BLOCK[old] && BLOCK[old].light) || 0, nl = (BLOCK[id] && BLOCK[id].light) || 0;
  if (nl) ch.emit.add(i); else ch.emit.delete(i);
  const k = pkey(x, y, z);
  if (W.te.has(k) && (!BLOCK[id] || !BLOCK[id].use || BLOCK[id].use !== W.te.get(k).type)) W.te.delete(k);
  // relight & remesh this chunk and neighbours that might be affected
  const lightRange = (ol || nl) ? 14 : 1;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const tcx = (x + dx * lightRange) >> 4, tcz = (z + dz * lightRange) >> 4;
    const c = getChunk(tcx, tcz); if (c) { c.needLight = true; c.needMesh = true; c.urgent = true; }
  }
  // neighbours that share faces (AO / culling)
  for (const [ax, az] of [[lx === 0 ? -1 : lx === 15 ? 1 : 0, 0], [0, lz === 0 ? -1 : lz === 15 ? 1 : 0]]) if (ax || az) { const c = getChunk(cx + ax, cz + az); if (c) { c.needMesh = true; c.urgent = true; } }
  if (opts.noUpdate !== true) for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const kk = pkey(x + dx, y + dy, z + dz); W.fluidQ.add(kk); W.gravQ.add(kk); }
  return true;
}

// ── lighting ──
const LQ = new Int32Array(CVOL * 4);
function isOpaqueId(id) { const b = BLOCK[id]; return !!(b && b.opaque); }
function lightChunk(ch) {
  const L = ch.light, B = ch.blocks; L.fill(0);
  const top = new Uint8Array(CS * CS);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let lv = 15, t = WH;
    for (let y = WH - 1; y >= 0; y--) {
      const i = bidx(x, y, z), id = B[i];
      if (id) { const b = BLOCK[id]; if (b.opaque) lv = 0; else if (b.render === 'cutout' || b.render === 'water' || b.render === 'translucent') lv = Math.max(0, lv - (isWater(id) ? 2 : 1)); }
      if (lv < 15 && t === WH) t = y;
      if (lv === 0) break;
      L[i] = lv << 4;
    }
    top[z * CS + x] = Math.min(t, WH - 1);
  }
  let qh = 0, qt = 0;
  const push = (i) => { LQ[qt++] = i; };
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let mt = top[z * CS + x];
    if (x > 0) mt = Math.max(mt, top[z * CS + x - 1]); if (x < 15) mt = Math.max(mt, top[z * CS + x + 1]);
    if (z > 0) mt = Math.max(mt, top[(z - 1) * CS + x]); if (z < 15) mt = Math.max(mt, top[(z + 1) * CS + x]);
    for (let y = Math.min(WH - 1, mt + 1); y >= 0; y--) { const i = bidx(x, y, z); if ((L[i] >> 4) > 1) push(i); }
  }
  // seeds from neighbouring chunks
  const seedFrom = (nc, getN, getOwn) => {
    if (!nc || !nc.lit) return;
    for (let y = 0; y < WH; y++) for (let k = 0; k < CS; k++) {
      const s = nc.light[getN(y, k)] >> 4, i = getOwn(y, k);
      if (s > 1 && !isOpaqueId(B[i]) && (L[i] >> 4) < s - 1) { L[i] = (s - 1) << 4 | (L[i] & 15); push(i); }
    }
  };
  seedFrom(getChunk(ch.cx - 1, ch.cz), (y, k) => bidx(15, y, k), (y, k) => bidx(0, y, k));
  seedFrom(getChunk(ch.cx + 1, ch.cz), (y, k) => bidx(0, y, k), (y, k) => bidx(15, y, k));
  seedFrom(getChunk(ch.cx, ch.cz - 1), (y, k) => bidx(k, y, 15), (y, k) => bidx(k, y, 0));
  seedFrom(getChunk(ch.cx, ch.cz + 1), (y, k) => bidx(k, y, 0), (y, k) => bidx(k, y, 15));
  while (qh < qt) {
    const i = LQ[qh++], v = (L[i] >> 4) - 1; if (v <= 0) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    const tryN = (j) => { if ((L[j] >> 4) < v && !isOpaqueId(B[j])) { L[j] = v << 4 | (L[j] & 15); if (v > 1) push(j); } };
    if (x > 0) tryN(i - 1); if (x < 15) tryN(i + 1);
    if (z > 0) tryN(i - 16); if (z < 15) tryN(i + 16);
    if (y > 0) tryN(i - 256); if (y < WH - 1) tryN(i + 256);
    if (qt > LQ.length - 8) break;
  }
  // block light: emitters in this and neighbouring chunks
  const sources = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const c = (dx || dz) ? getChunk(ch.cx + dx, ch.cz + dz) : ch; if (!c) continue;
    for (const i of c.emit) { const lx = (i & 15) + dx * CS, lz = ((i >> 4) & 15) + dz * CS; if (lx < -14 || lx > 29 || lz < -14 || lz > 29) continue; sources.push([lx, i >> 8, lz, BLOCK[c.blocks[i]] ? BLOCK[c.blocks[i]].light : 0]); }
  }
  if (sources.length) blockLight(ch, sources);
  ch.lit = true; ch.needLight = false;
}
// BFS in a padded region (chunk ± 15 blocks) so light crosses chunk borders
const PAD = 15, RW = CS + PAD * 2, RVOL = RW * RW * WH;
const RL = new Uint8Array(RVOL), RQ = new Int32Array(RVOL);
function blockLight(ch, sources) {
  RL.fill(0);
  const ox = ch.cx * CS - PAD, oz = ch.cz * CS - PAD;
  const ridx = (x, y, z) => (y * RW + z) * RW + x;
  let qh = 0, qt = 0;
  for (const [lx, y, lz, lv] of sources) { const i = ridx(lx + PAD, y, lz + PAD); if (RL[i] < lv) { RL[i] = lv; RQ[qt++] = i; } }
  while (qh < qt) {
    const i = RQ[qh++], v = RL[i] - 1; if (v <= 0) continue;
    const x = i % RW, z = Math.floor(i / RW) % RW, y = Math.floor(i / (RW * RW));
    const tryN = (nx, ny, nz) => {
      if (nx < 0 || nz < 0 || nx >= RW || nz >= RW || ny < 0 || ny >= WH) return;
      const j = ridx(nx, ny, nz); if (RL[j] >= v) return;
      if (isOpaqueId(getBlock(ox + nx, ny, oz + nz))) return;
      RL[j] = v; if (v > 1) RQ[qt++] = j;
    };
    tryN(x - 1, y, z); tryN(x + 1, y, z); tryN(x, y - 1, z); tryN(x, y + 1, z); tryN(x, y, z - 1); tryN(x, y, z + 1);
  }
  const L = ch.light;
  for (let y = 0; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) { const v = RL[ridx(x + PAD, y, z + PAD)]; if (v) { const i = bidx(x, y, z); L[i] = (L[i] & 0xF0) | v; } }
}

// ── fluids, falling blocks, random ticks ──
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function flowable(id) { if (id === AIR) return true; const b = BLOCK[id]; return !!(b && !b.solid && !b.fluid && b.render !== 'water'); }
function washAway(x, y, z) { const id = getBlock(x, y, z); if (id && !isWater(id) && BLOCK[id] && BLOCK[id].render !== 'water') dropBlockItems(x, y, z, id, false); }
function fluidUpdate(x, y, z) {
  const id = getBlock(x, y, z);
  if (!isWater(id)) return;
  const lvl = waterLevel(id);
  if (lvl > 0) {
    let expect = 99, sources = 0;
    if (isWater(getBlock(x, y + 1, z))) expect = 1;
    for (const [dx, dz] of DIRS4) {
      const n = getBlock(x + dx, y, z + dz); if (!isWater(n)) continue;
      const nl = waterLevel(n); if (nl === 0) sources++;
      const sp = (nl === 0 || isWater(getBlock(x + dx, y + 1, z + dz))) ? 1 : nl + 1;
      if (sp < expect) expect = sp;
    }
    const below = getBlock(x, y - 1, z);
    if (sources >= 2 && ((BLOCK[below] && BLOCK[below].solid) || below === WATER)) expect = 0;
    if (expect > 7) { setBlock(x, y, z, AIR); return; }
    if (expect !== lvl) { setBlock(x, y, z, WATER + expect); return; }
  }
  const below = getBlock(x, y - 1, z);
  if (y > 0 && (flowable(below) || (isWater(below) && waterLevel(below) > 1))) { if (!isWater(below)) washAway(x, y - 1, z); setBlock(x, y - 1, z, WATER + 1); return; }
  if (isWater(below)) return;
  const sp = (lvl === 0 || isWater(getBlock(x, y + 1, z))) ? 1 : lvl + 1;
  if (sp > 7) return;
  for (const [dx, dz] of DIRS4) {
    const n = getBlock(x + dx, y, z + dz);
    if (flowable(n)) { washAway(x + dx, y, z + dz); setBlock(x + dx, y, z + dz, WATER + sp); }
    else if (isWater(n) && waterLevel(n) > sp) setBlock(x + dx, y, z + dz, WATER + sp);
  }
}
function gravityUpdate(x, y, z) {
  const id = getBlock(x, y, z), b = BLOCK[id];
  if (!b) return;
  if (b.gravity) {
    const below = getBlock(x, y - 1, z);
    if (y > 0 && (below === AIR || isWater(below) || (BLOCK[below] && BLOCK[below].replaceable))) { setBlock(x, y, z, AIR); setBlock(x, y - 1, z, id); }
    return;
  }
  // plants and torches need support
  if (b.needsSoil || b.needsSand || b.needsFloor) {
    const below = getBlock(x, y - 1, z), bb = BLOCK[below];
    const ok = b.needsSoil ? (below === GRASS || below === DIRT || below === SNOW_GRASS) : b.needsSand ? (below === SAND || below === DIRT || below === GRASS) : !!(bb && bb.solid);
    if (!ok) { setBlock(x, y, z, AIR); dropBlockItems(x, y, z, id, false); }
  }
  if (id === CACTUS) {
    const below = getBlock(x, y - 1, z);
    if (below !== SAND && below !== CACTUS) { setBlock(x, y, z, AIR); dropBlockItems(x, y, z, id, false); }
  }
}
function randomTicks(px, pz) {
  const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const ch = getChunk(pcx + dx, pcz + dz); if (!ch || !ch.lit) continue;
    for (let n = 0; n < 3; n++) {
      const i = Math.floor(Math.random() * CVOL), id = ch.blocks[i];
      if (id !== SAPLING && id !== DIRT && id !== GRASS) continue;
      const x = (i & 15) + ch.cx * CS, z = ((i >> 4) & 15) + ch.cz * CS, y = i >> 8;
      const above = getBlock(x, y + 1, z);
      if (id === SAPLING && Math.random() < 0.12) growTree(x, y, z);
      else if (id === GRASS && isOpaqueId(above)) setBlock(x, y, z, DIRT, { noUpdate: true });
      else if (id === DIRT && !isOpaqueId(above) && !isWater(above) && (getLight(x, y + 1, z) >> 4) >= 9) {
        for (let k = 0; k < 4; k++) { const ax = x + Math.floor(Math.random() * 3) - 1, ay = y + Math.floor(Math.random() * 3) - 1, az = z + Math.floor(Math.random() * 3) - 1; if (getBlock(ax, ay, az) === GRASS) { setBlock(x, y, z, GRASS, { noUpdate: true }); break; } }
      }
    }
  }
}
function growTree(x, y, z) {
  for (let k = 1; k < 6; k++) if (getBlock(x, y + k, z) !== AIR) return;
  const below = getBlock(x, y - 1, z);
  const kind = below === SNOW_GRASS ? 2 : Math.random() < 0.3 ? 1 : 0;
  setBlock(x, y, z, AIR, { noUpdate: true });
  placeTree((lx, ly, lz, id, force) => { const cur = getBlock(lx, ly, lz); if (cur === AIR || (BLOCK[cur] && BLOCK[cur].render === 'cross') || (force && BLOCK[cur] && BLOCK[cur].render === 'cutout')) setBlock(lx, ly, lz, id, { noUpdate: true }); }, x, y, z, kind, Math.random());
}

function findSpawn() {
  for (let r = 0; r < 600; r += 8) for (let a = 0; a < Math.max(1, r / 2); a++) {
    const ang = a / Math.max(1, r / 2) * Math.PI * 2, x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
    const [h, b] = column(x, z);
    if (b !== OCEAN && b !== BEACH && h > SEA + 1 && h < 46) return { x: x + 0.5, y: h + 1, z: z + 0.5 };
  }
  return { x: 0.5, y: WH - 10, z: 0.5 };
}

// ── save encoding ──
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function encodeMods() {
  const out = {};
  for (const [k, m] of W.mods) { if (!m.size) continue; const a = new Uint8Array(m.size * 3); let j = 0; for (const [i, id] of m) { a[j++] = i & 255; a[j++] = i >> 8; a[j++] = id; } out[k] = b64(a); }
  return out;
}
function decodeMods(obj) {
  const mods = new Map();
  for (const k in obj || {}) { try { const a = unb64(obj[k]), m = new Map(); for (let j = 0; j + 2 < a.length; j += 3) m.set(a[j] | a[j + 1] << 8, a[j + 2]); mods.set(k, m); } catch { } }
  return mods;
}

// ─────────────────────────── chunk mesher ───────────────────────────
// vertex: int16 x,y,z (×64) | uint16 u,v (normalized) | uint8 sky, block, shade, flash | 2 pad  = 16 bytes
const PW = CS + 2, PVOL = PW * PW * WH;
const PB = new Uint8Array(PVOL), PL = new Uint8Array(PVOL);
const pidx = (x, y, z) => (y * PW + z) * PW + x;
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.72, side: true },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.72, side: true },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 1.0, top: true },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.5, bottom: true },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.86, side: true },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.86, side: true },
];
const OPP = [1, 0, 3, 2, 5, 4];
// per face, per vertex: padded-index deltas of [side1, side2, corner] relative to the adjacent cell
for (const f of FACES) {
  f.nd = (f.n[1] * PW + f.n[2]) * PW + f.n[0];
  f.ao = f.v.map(c => {
    const t = [0, 1, 2].filter(k => f.n[k] === 0);
    const s = t.map(k => { const o = [0, 0, 0]; o[k] = c[k] ? 1 : -1; return o; });
    const d = o => (o[1] * PW + o[2]) * PW + o[0];
    return [d(s[0]), d(s[1]), d([s[0][0] + s[1][0], s[0][1] + s[1][1], s[0][2] + s[1][2]])];
  });
}

class MeshBuilder {
  constructor(q = 4096) { this.alloc(q); }
  alloc(q) { this.cap = q; this.buf = new ArrayBuffer(q * 64); this.i16 = new Int16Array(this.buf); this.u16 = new Uint16Array(this.buf); this.u8 = new Uint8Array(this.buf); this.quads = 0; }
  reset() { this.quads = 0; }
  grow() { const old = this.u8, n = this.quads; this.alloc(this.cap * 2); this.u8.set(old.subarray(0, n * 64)); this.quads = n; }
  // p: 4 corners [x,y,z] in block units (chunk-local), uv: 4 [u,v] in atlas units, l: 4 [sky,block,shade] 0..255
  quad(p, uv, l, flash = 0) {
    if (this.quads >= this.cap) this.grow();
    const base = this.quads * 4;
    for (let k = 0; k < 4; k++) {
      const v = base + k, w = v * 8;
      this.i16[w] = Math.round(p[k][0] * 64); this.i16[w + 1] = Math.round(p[k][1] * 64); this.i16[w + 2] = Math.round(p[k][2] * 64);
      this.u16[w + 3] = Math.round(uv[k][0] * 65535); this.u16[w + 4] = Math.round(uv[k][1] * 65535);
      const b = v * 16 + 10; this.u8[b] = l[k][0]; this.u8[b + 1] = l[k][1]; this.u8[b + 2] = l[k][2]; this.u8[b + 3] = flash;
    }
    this.quads++;
  }
  bytes() { return this.u8.subarray(0, this.quads * 64); }
}
const MB = new MeshBuilder(8192), MW = new MeshBuilder(2048);

function fillPadded(ch) {
  const near = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near.push(getChunk(ch.cx + dx, ch.cz + dz));
  for (let z = -1; z <= CS; z++) for (let x = -1; x <= CS; x++) {
    const cxo = x < 0 ? 0 : x >= CS ? 2 : 1, czo = z < 0 ? 0 : z >= CS ? 2 : 1, c = near[czo * 3 + cxo];
    const lx = (x + CS) & 15, lz = (z + CS) & 15;
    for (let y = 0; y < WH; y++) {
      const p = pidx(x + 1, y, z + 1);
      if (c) { const i = bidx(lx, y, lz); PB[p] = c.blocks[i]; PL[p] = c.light[i]; } else { PB[p] = STONE; PL[p] = 0; }
    }
  }
}

const OPAQUE = new Uint8Array(256), RTYPE = new Uint8Array(256); // 1 cube 2 cutout 3 translucent 4 water 5 cross 6 torch
const FTILE = []; // [blockId][face] = tile index ; front stored separately
function prepareBlockTables() {
  const rmap = { cube: 1, cutout: 2, translucent: 3, water: 4, cross: 5, torch: 6 };
  for (let id = 0; id < 256; id++) {
    const b = BLOCK[id]; if (!b) continue;
    OPAQUE[id] = b.opaque ? 1 : 0; RTYPE[id] = rmap[b.render];
    const tx = typeof b.tex === 'string' ? { top: b.tex, bottom: b.tex, side: b.tex } : b.tex;
    FTILE[id] = FACES.map(f => T[f.top ? tx.top : f.bottom ? (tx.bottom || tx.top) : tx.side]);
    b.frontTile = tx.front ? T[tx.front] : null;
    b.tiles = tx;
  }
}
const TU = 1 / TPR, EPS = 1 / 4096;
function uvOf(tile, u, v, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  const tx = (tile % TPR) * TU, ty = Math.floor(tile / TPR) * TU;
  return [tx + (u0 + (u1 - u0) * u) * TU * (1 - 2 * EPS * TPR) + EPS, ty + (v0 + (v1 - v0) * v) * TU * (1 - 2 * EPS * TPR) + EPS];
}

const AO_CURVE = [0.5, 0.68, 0.84, 1.0];
function meshChunk(ch) {
  fillPadded(ch);
  MB.reset(); MW.reset();
  const ox = ch.cx * CS, oz = ch.cz * CS;
  const corners = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvs = [[0, 0], [0, 0], [0, 0], [0, 0]], ls = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let y = 0; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const p = pidx(x + 1, y, z + 1), id = PB[p];
    if (!id) continue;
    const rt = RTYPE[id];
    if (rt === 5 || rt === 6) { meshSprite(id, rt, x, y, z, PL[p]); continue; }
    const b = BLOCK[id];
    let front = -1;
    if (b.facing) { const te = W.te.get(pkey(ox + x, y, oz + z)); front = te ? te.facing : 4; }
    let wh = 1;
    if (rt === 4) { const lv = waterLevel(id); wh = isWater(PB[p + PW * PW]) ? 1 : lv === 0 ? 0.875 : (8 - lv) / 9; }
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi], q = p + f.nd;
      if (f.n[1] === -1 && y === 0) continue;
      const nid = y + f.n[1] >= WH ? 0 : PB[q];
      if (rt === 4) {
        if (isWater(nid)) continue;
        if (OPAQUE[nid] && !(f.top && wh < 1)) continue;
        if (f.bottom && nid === ICE) continue;
      } else if (OPAQUE[nid]) continue;
      else if (rt === 3 && nid === id) continue;
      else if (rt === 2 && nid === id && id === GLASS) continue;
      let tile = FTILE[id][fi];
      if (front >= 0 && fi === front && b.frontTile != null) {
        tile = b.frontTile;
        if (id === FURNACE) { const te = W.te.get(pkey(ox + x, y, oz + z)); if (te && te.burn > 0) tile = T.furnace_front_lit; }
      }
      const target = (rt === 4 || rt === 3) ? MW : MB;
      const qq = (y + f.n[1] >= WH) ? -1 : q;
      for (let k = 0; k < 4; k++) {
        const c = f.v[k];
        let cy = c[1];
        if (rt === 4 && cy === 1) cy = wh;
        if (rt === 2 && id === CACTUS && f.side) { corners[k][0] = x + (f.n[0] ? (c[0] ? 15 / 16 : 1 / 16) : c[0]); corners[k][2] = z + (f.n[2] ? (c[2] ? 15 / 16 : 1 / 16) : c[2]); }
        else { corners[k][0] = x + c[0]; corners[k][2] = z + c[2]; }
        corners[k][1] = y + cy;
        const t = uvOf(tile, f.uv[k][0], f.uv[k][1]); uvs[k][0] = t[0]; uvs[k][1] = t[1];
        // smooth light + AO
        if (qq < 0) { ls[k][0] = 255; ls[k][1] = 0; ls[k][2] = Math.round(f.shade * 255); continue; }
        const a = f.ao[k], s1 = qq + a[0], s2 = qq + a[1], cr = qq + a[2];
        const o1 = OPAQUE[PB[s1]] && s1 >= 0 && s1 < PVOL, o2 = OPAQUE[PB[s2]] && s2 >= 0 && s2 < PVOL, oc = OPAQUE[PB[cr]] && cr >= 0 && cr < PVOL;
        const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
        let sky = PL[qq] >> 4, blk = PL[qq] & 15, n = 1;
        if (!o1 && s1 >= 0 && s1 < PVOL) { sky += PL[s1] >> 4; blk += PL[s1] & 15; n++; }
        if (!o2 && s2 >= 0 && s2 < PVOL) { sky += PL[s2] >> 4; blk += PL[s2] & 15; n++; }
        if (!oc && !(o1 && o2) && cr >= 0 && cr < PVOL) { sky += PL[cr] >> 4; blk += PL[cr] & 15; n++; }
        ls[k][0] = Math.round(sky / n * 17); ls[k][1] = Math.round(blk / n * 17);
        ls[k][2] = Math.round(f.shade * (rt === 4 ? 1 : AO_CURVE[ao]) * 255);
      }
      // flip quad diagonal for nicer AO interpolation
      if (ls[0][2] + ls[2][2] < ls[1][2] + ls[3][2]) {
        target.quad([corners[1], corners[2], corners[3], corners[0]], [uvs[1], uvs[2], uvs[3], uvs[0]], [ls[1], ls[2], ls[3], ls[0]]);
      } else target.quad(corners, uvs, ls);
      if (rt === 4 && f.top) { // underside of the surface, visible from below the water
        target.quad([corners[3], corners[2], corners[1], corners[0]], [uvs[3], uvs[2], uvs[1], uvs[0]], [ls[3], ls[2], ls[1], ls[0]]);
      }
    }
  }
  ch.needMesh = false; ch.urgent = false;
  return { opaque: MB.bytes(), oq: MB.quads, water: MW.bytes(), wq: MW.quads };
}
function meshSprite(id, rt, x, y, z, light) {
  const l = [(light >> 4) * 17, (light & 15) * 17, 230];
  const L = [l, l, l, l];
  const tile = FTILE[id][0];
  if (rt === 5) {
    const a = 0.15, b = 0.85;
    const quads = [[[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], [[x + b, y, z + a], [x + a, y, z + b], [x + a, y + 1, z + b], [x + b, y + 1, z + a]]];
    const uv = [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)];
    for (const q of quads) { MB.quad(q, uv, L); MB.quad([q[1], q[0], q[3], q[2]], [uv[0], uv[1], uv[2], uv[3]], L); }
    return;
  }
  // torch: thin post
  const x0 = x + 7 / 16, x1 = x + 9 / 16, z0 = z + 7 / 16, z1 = z + 9 / 16, y1 = y + 10 / 16;
  const u0 = 7 / 16, u1 = 9 / 16, v0 = 3 / 16, v1 = 13 / 16;
  const uv = [uvOf(tile, 0, 1, u0, v0, u1, v1), uvOf(tile, 1, 1, u0, v0, u1, v1), uvOf(tile, 1, 0, u0, v0, u1, v1), uvOf(tile, 0, 0, u0, v0, u1, v1)];
  const bright = [[255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255]];
  MB.quad([[x1, y, z1], [x1, y, z0], [x1, y1, z0], [x1, y1, z1]], uv, bright);
  MB.quad([[x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0]], uv, bright);
  MB.quad([[x0, y, z1], [x1, y, z1], [x1, y1, z1], [x0, y1, z1]], uv, bright);
  MB.quad([[x1, y, z0], [x0, y, z0], [x0, y1, z0], [x1, y1, z0]], uv, bright);
  const ft = uvOf(tile, 0.5, 0.5, 7 / 16, 4 / 16, 8 / 16, 5 / 16);
  MB.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [ft, ft, ft, ft], bright);
}

// ─────────────────────────── WebGL renderer ───────────────────────────
let gl = null, prog = null, U = {}, A = {}, atlasTex = null, indexBuf = null, dynVbo = null, lineVbo = null;
const MAXQ = 16384;
function initGL(canvas) {
  gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) throw Error('이 기기/브라우저에서 WebGL을 사용할 수 없어 3D 월드를 표시할 수 없습니다.');
  const vs = `attribute vec3 aPos;attribute vec2 aUV;attribute vec4 aLight;uniform mat4 uVP;uniform vec3 uOffset;uniform float uScale;uniform vec3 uEye;
varying vec2 vUV;varying vec4 vL;varying float vDist;varying vec3 vW;
void main(){vec3 w=aPos*uScale+uOffset;vW=w;vUV=aUV;vL=aLight;vDist=length(w-uEye);gl_Position=uVP*vec4(w,1.0);}`;
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform float uSky;uniform vec3 uFog;uniform vec2 uFogR;uniform float uBlend;uniform float uTime;uniform float uWater;uniform float uMin;uniform float uAlpha;uniform vec3 uSkyTint;
varying vec2 vUV;varying vec4 vL;varying float vDist;varying vec3 vW;
float cv(float l){return l/(4.0-3.0*l);}
void main(){vec4 t=texture2D(uTex,vUV);
if(uBlend<0.5){if(t.a<0.5)discard;t.a=1.0;}
float s=cv(vL.x)*uSky;float b=cv(vL.y);
vec3 li=max(vec3(s)*uSkyTint,vec3(b)*vec3(1.0,0.87,0.66));li=max(li,vec3(uMin));
vec3 c=t.rgb*li*vL.z;
c=mix(c,vec3(1.0,0.2,0.15),vL.w*0.6);
if(uWater>0.5)c*=0.9+0.1*sin(vW.x*1.9+vW.z*1.4+uTime*2.2)*sin(vW.z*0.8-uTime*1.3);
float f=clamp((vDist-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);
gl_FragColor=vec4(mix(c,uFog,f),t.a*uAlpha);}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('셰이더 오류: ' + gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error('3D 렌더러를 초기화하지 못했습니다.');
  gl.useProgram(prog);
  for (const n of ['uVP', 'uOffset', 'uScale', 'uEye', 'uTex', 'uSky', 'uFog', 'uFogR', 'uBlend', 'uTime', 'uWater', 'uMin', 'uAlpha', 'uSkyTint']) U[n] = gl.getUniformLocation(prog, n);
  for (const n of ['aPos', 'aUV', 'aLight']) { A[n] = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(A[n]); }
  atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uTex, 0);
  const idx = new Uint16Array(MAXQ * 6); for (let q = 0; q < MAXQ; q++) { const v = q * 4, i = q * 6; idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3; }
  indexBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  dynVbo = gl.createBuffer(); lineVbo = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.frontFace(gl.CCW); gl.cullFace(gl.BACK);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
function bindChunkAttribs(off) {
  gl.vertexAttribPointer(A.aPos, 3, gl.SHORT, false, 16, off);
  gl.vertexAttribPointer(A.aUV, 2, gl.UNSIGNED_SHORT, true, 16, off + 6);
  gl.vertexAttribPointer(A.aLight, 4, gl.UNSIGNED_BYTE, true, 16, off + 10);
}
function bindDynAttribs(off) {
  gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, 36, off);
  gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, 36, off + 12);
  gl.vertexAttribPointer(A.aLight, 4, gl.FLOAT, false, 36, off + 20);
}
function uploadMesh(ch, m) {
  if (!ch.vbo) { ch.vbo = gl.createBuffer(); ch.wvbo = gl.createBuffer(); }
  gl.bindBuffer(gl.ARRAY_BUFFER, ch.vbo); gl.bufferData(gl.ARRAY_BUFFER, m.oq ? m.opaque : new Uint8Array(16), gl.STATIC_DRAW); ch.oq = m.oq;
  gl.bindBuffer(gl.ARRAY_BUFFER, ch.wvbo); gl.bufferData(gl.ARRAY_BUFFER, m.wq ? m.water : new Uint8Array(16), gl.STATIC_DRAW); ch.wq = m.wq;
  ch.mesh = true;
}
function freeChunkGL(ch) { if (ch.vbo) { gl.deleteBuffer(ch.vbo); gl.deleteBuffer(ch.wvbo); ch.vbo = ch.wvbo = null; } ch.mesh = null; }
function drawChunkBuffer(vbo, quads) {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  for (let b = 0; b * MAXQ < quads; b++) { bindChunkAttribs(b * MAXQ * 64); gl.drawElements(gl.TRIANGLES, Math.min(MAXQ, quads - b * MAXQ) * 6, gl.UNSIGNED_SHORT, 0); }
}

class DynBuilder {
  constructor() { this.f = new Float32Array(36 * 512); this.quads = 0; }
  reset() { this.quads = 0; }
  quad(p, uv, sky, blk, shade, flash = 0) {
    if ((this.quads + 1) * 36 > this.f.length) { const n = new Float32Array(this.f.length * 2); n.set(this.f); this.f = n; }
    let o = this.quads * 36;
    for (let k = 0; k < 4; k++) { const P = p[k], T2 = uv[k]; this.f[o++] = P[0]; this.f[o++] = P[1]; this.f[o++] = P[2]; this.f[o++] = T2[0]; this.f[o++] = T2[1]; this.f[o++] = sky; this.f[o++] = blk; this.f[o++] = shade; this.f[o++] = flash; }
    this.quads++;
  }
  draw() {
    if (!this.quads) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, dynVbo); gl.bufferData(gl.ARRAY_BUFFER, this.f.subarray(0, this.quads * 36), gl.STREAM_DRAW);
    for (let b = 0; b * MAXQ < this.quads; b++) { bindDynAttribs(b * MAXQ * 144); gl.drawElements(gl.TRIANGLES, Math.min(MAXQ, this.quads - b * MAXQ) * 6, gl.UNSIGNED_SHORT, 0); }
  }
}
const DYN = new DynBuilder(), DYNB = new DynBuilder(), SKY = new DynBuilder(), HAND = new DynBuilder();

// box with per-face tiles; xf maps model-space point → output space
function box(builder, min, max, tiles, xf, sky, blk, flash = 0, shadeMul = 1) {
  for (let fi = 0; fi < 6; fi++) {
    const f = FACES[fi], t = tiles[fi]; if (t == null) continue;
    const tile = Array.isArray(t) ? t[0] : t, sub = Array.isArray(t) ? t : null;
    const p = [], uv = [];
    for (let k = 0; k < 4; k++) {
      const c = f.v[k];
      p.push(xf([c[0] ? max[0] : min[0], c[1] ? max[1] : min[1], c[2] ? max[2] : min[2]]));
      uv.push(sub ? uvOf(tile, f.uv[k][0], f.uv[k][1], sub[1], sub[2], sub[3], sub[4]) : uvOf(tile, f.uv[k][0], f.uv[k][1]));
    }
    builder.quad(p, uv, sky, blk, f.shade * shadeMul, flash);
  }
}
function blockTiles(id) { const t = FTILE[id]; if (!t) return [T.white, T.white, T.white, T.white, T.white, T.white]; const b = BLOCK[id]; const out = t.slice(); if (b.frontTile != null) out[4] = b.frontTile; return out; }

// ── matrices ──
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mat4mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function viewMatrix(eye, yaw, pitch) {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)], r = [Math.cos(yaw), 0, Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -d(r, eye), -d(u, eye), d(f, eye), 1]);
}
function frustumPlanes(m) {
  const p = [];
  const row = r => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]]) p.push([r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]]);
  return p;
}
function boxVisible(planes, x0, y0, z0, x1, y1, z1) {
  for (const p of planes) { const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0; if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false; }
  return true;
}

// ─────────────────────────── physics, entities, mobs ───────────────────────────
function boxHits(x0, y0, z0, x1, y1, z1) {
  for (let by = Math.floor(y0); by <= Math.floor(y1 - 1e-7); by++)
    for (let bz = Math.floor(z0); bz <= Math.floor(z1 - 1e-7); bz++)
      for (let bx = Math.floor(x0); bx <= Math.floor(x1 - 1e-7); bx++) if (solidAt(bx, by, bz)) return true;
  return false;
}
const hitsAt = (e, x, y, z) => boxHits(x - e.w, y, z - e.w, x + e.w, y + e.h, z + e.w);
// moves along one axis, returns true if blocked
function moveAxis(e, axis, d) {
  if (!d) return false;
  if (hitsAt(e, e.x, e.y, e.z)) { e[axis] += d; return false; } // stuck inside: let it escape
  const steps = Math.ceil(Math.abs(d) / 0.4), sd = d / steps;
  for (let i = 0; i < steps; i++) {
    const nx = axis === 'x' ? e.x + sd : e.x, ny = axis === 'y' ? e.y + sd : e.y, nz = axis === 'z' ? e.z + sd : e.z;
    if (!hitsAt(e, nx, ny, nz)) { e.x = nx; e.y = ny; e.z = nz; continue; }
    if (axis === 'x') e.x = sd > 0 ? Math.floor(nx + e.w) - e.w - 1e-4 : Math.floor(nx - e.w) + 1 + e.w + 1e-4;
    else if (axis === 'z') e.z = sd > 0 ? Math.floor(nz + e.w) - e.w - 1e-4 : Math.floor(nz - e.w) + 1 + e.w + 1e-4;
    else e.y = sd > 0 ? Math.floor(ny + e.h) - e.h - 1e-4 : Math.floor(ny) + 1 + 1e-4;
    if (hitsAt(e, e.x, e.y, e.z)) { e.x = axis === 'x' ? e.x - sd : e.x; e.y = axis === 'y' ? e.y - sd : e.y; e.z = axis === 'z' ? e.z - sd : e.z; }
    return true;
  }
  return false;
}
function entityInWater(e, dy = 0.4) { return isWater(getBlock(Math.floor(e.x), Math.floor(e.y + dy), Math.floor(e.z))); }
function lightAt(x, y, z) { const l = getLight(Math.floor(x), Math.floor(y), Math.floor(z)); return [(l >> 4) / 15, (l & 15) / 15]; }

// ── item drops ──
function spawnItem(id, count, x, y, z, dmg = 0, vel) {
  if (!id || count <= 0) return;
  const v = vel || [(Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3];
  W.items.push({ id, count, dmg, x, y, z, vx: v[0], vy: v[1], vz: v[2], w: 0.125, h: 0.25, age: 0, pick: 0.5 });
}
function dropBlockItems(x, y, z, id) {
  const b = BLOCK[id]; if (!b) return;
  const r = Math.random;
  let d = typeof b.drop === 'function' ? b.drop(r) : b.drop;
  const n = b.dropCount ? b.dropCount(r) : 1;
  if (d) spawnItem(d, n, x + 0.5, y + 0.4, z + 0.5);
  const te = W.te.get(pkey(x, y, z));
  if (te) for (const s of te.slots) if (s) spawnItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dmg);
}
function updateItems(dt) {
  for (let i = W.items.length - 1; i >= 0; i--) {
    const e = W.items[i];
    e.age += dt; e.pick -= dt;
    if (e.age > 300 || e.y < -20) { W.items.splice(i, 1); continue; }
    const inW = entityInWater(e, 0.1);
    e.vy -= (inW ? 4 : 18) * dt; if (inW) e.vy = clamp(e.vy, -1.2, 1.5);
    const f = Math.pow(e.onGround ? 0.02 : 0.6, dt);
    e.vx *= f; e.vz *= f;
    moveAxis(e, 'x', e.vx * dt); moveAxis(e, 'z', e.vz * dt);
    e.onGround = false;
    if (moveAxis(e, 'y', e.vy * dt)) { if (e.vy < 0) e.onGround = true; e.vy = 0; }
    // pickup
    if (e.pick <= 0 && !P.dead) {
      const dx = P.x - e.x, dy = (P.y + 0.8) - e.y, dz = P.z - e.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 2.4) {
        const left = addToInventory(e.id, e.count, e.dmg);
        if (left < e.count) { sfx('pop'); invChanged(); }
        if (left <= 0) { W.items.splice(i, 1); continue; } else e.count = left;
      } else if (d2 < 6) { const k = 6 * dt / Math.sqrt(d2); e.x += dx * k; e.z += dz * k; }
    }
  }
}

// ── particles ──
function particles(x, y, z, tile, n, spread = 0.4, speed = 3, life = 0.8) {
  if (W.particles.length > 600) return;
  for (let i = 0; i < n; i++) W.particles.push({ x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread * 2, z: z + (Math.random() - 0.5) * spread * 2, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed, vz: (Math.random() - 0.5) * speed, life: life * (0.5 + Math.random() * 0.6), tile, su: Math.floor(Math.random() * 12) / 16, sv: Math.floor(Math.random() * 12) / 16, size: 0.06 + Math.random() * 0.06, grav: 14 });
}
function blockParticles(x, y, z, id, n = 18) { const t = FTILE[id]; if (t) particles(x + 0.5, y + 0.5, z + 0.5, t[4], n, 0.35, 3.2); }
function updateParticles(dt) {
  for (let i = W.particles.length - 1; i >= 0; i--) {
    const p = W.particles[i]; p.life -= dt;
    if (p.life <= 0) { W.particles.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    if (solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; } else { p.x = nx; p.y = ny; p.z = nz; }
  }
}

// ── TNT & explosions ──
function primeTNT(x, y, z, fuse = 4) { W.tnts.push({ x: x + 0.5, y, z: z + 0.5, vx: (Math.random() - 0.5), vy: 3, vz: (Math.random() - 0.5), w: 0.49, h: 0.98, fuse }); sfx('fuse'); }
function updateTNT(dt) {
  for (let i = W.tnts.length - 1; i >= 0; i--) {
    const t = W.tnts[i]; t.fuse -= dt;
    t.vy -= GRAVITY * 0.6 * dt; t.vx *= Math.pow(0.1, dt); t.vz *= Math.pow(0.1, dt);
    moveAxis(t, 'x', t.vx * dt); moveAxis(t, 'z', t.vz * dt); if (moveAxis(t, 'y', t.vy * dt)) t.vy = 0;
    if (Math.random() < 0.5) particles(t.x, t.y + 1.1, t.z, T.white, 1, 0.05, 0.6, 0.5);
    if (t.fuse <= 0) { W.tnts.splice(i, 1); explode(t.x, t.y + 0.5, t.z, 4); }
  }
}
function explode(x, y, z, power) {
  sfx('boom'); shake = Math.max(shake, 0.6);
  const r = power * 0.9;
  for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
    const d = Math.hypot(dx, dy, dz); if (d > r * (0.7 + Math.random() * 0.45)) continue;
    const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz), id = getBlock(bx, by, bz);
    if (!id || isWater(id) || id === BEDROCK || id === OBSIDIAN) continue;
    if (id === TNT) { setBlock(bx, by, bz, AIR); primeTNT(bx, by, bz, 0.5 + Math.random()); continue; }
    if (Math.random() < 0.25) dropBlockItems(bx, by, bz, id); else { const te = W.te.get(pkey(bx, by, bz)); if (te) for (const s of te.slots) if (s) spawnItem(s.id, s.count, bx + 0.5, by + 0.5, bz + 0.5, s.dmg); }
    setBlock(bx, by, bz, AIR);
  }
  for (let i = 0; i < 40; i++) W.particles.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 3, z: z + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.6 + Math.random() * 0.8, tile: T.white, su: 0, sv: 0, size: 0.3 + Math.random() * 0.4, grav: -1 });
  const hurt = (e, isPlayer) => {
    const ex = e.x - x, ey = (e.y + e.h / 2) - y, ez = e.z - z, d = Math.hypot(ex, ey, ez);
    if (d > power * 2) return;
    const f = 1 - d / (power * 2), dmg = Math.floor(f * f * 26 + f * 6);
    const k = f * 14 / Math.max(0.5, d);
    e.vx += ex * k; e.vy += Math.max(3, ey * k + 5 * f); e.vz += ez * k;
    if (isPlayer) damagePlayer(dmg, 'explosion'); else hurtMob(e, dmg, x, z, true);
  };
  if (!P.dead) hurt(P, true);
  for (const m of W.mobs) hurt(m, false);
  for (const it of W.items) { const d = Math.hypot(it.x - x, it.y - y, it.z - z); if (d < power * 1.5) { it.vx += (it.x - x) * 3; it.vy += 4; it.vz += (it.z - z) * 3; } }
}

// ── mobs ──
const MOBDEF = {
  pig: { name: '돼지', hp: 10, w: 0.45, h: 0.9, speed: 1.3, passive: true, drops: [[PORK, 1, 3]], cooked: COOKED_PORK },
  cow: { name: '소', hp: 10, w: 0.45, h: 1.3, speed: 1.2, passive: true, drops: [[BEEF, 1, 3]], cooked: STEAK },
  sheep: { name: '양', hp: 8, w: 0.45, h: 1.25, speed: 1.2, passive: true, drops: [[WOOL, 1, 1], [MUTTON, 1, 2]] },
  zombie: { name: '좀비', hp: 20, w: 0.3, h: 1.9, speed: 2.3, hostile: true, dmg: 3, drops: [[FLESH, 0, 2]], burns: true },
  spider: { name: '거미', hp: 16, w: 0.65, h: 0.9, speed: 3.1, hostile: true, dmg: 2, drops: [[STRING, 0, 2]], climbs: true },
};
function spawnMob(type, x, y, z) {
  const d = MOBDEF[type];
  const m = { type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, hp: d.hp, yaw: Math.random() * 6.28, bodyYaw: 0, walk: 0, wanderT: 0, moving: false, hurt: 0, panic: 0, attackCd: 0, dead: 0, burn: 0, onGround: false, color: type === 'sheep' ? Math.floor(Math.random() * 10) : 0 };
  m.bodyYaw = m.yaw; W.mobs.push(m); return m;
}
function hurtMob(m, dmg, fx, fz, explosion) {
  if (m.dead || m.hurt > 0.0 && !explosion) return false;
  m.hp -= dmg; m.hurt = 0.5;
  const dx = m.x - fx, dz = m.z - fz, d = Math.hypot(dx, dz) || 1;
  if (!explosion) { m.vx += dx / d * 7; m.vz += dz / d * 7; m.vy = 5.5; }
  if (MOBDEF[m.type].passive) m.panic = 5;
  sfx(m.type === 'zombie' ? 'zhurt' : m.type === 'spider' ? 'shurt' : 'mhurt');
  if (m.hp <= 0) { m.dead = 0.001; }
  return true;
}
function isDay() { return W.daylight > 0.55; }
function updateMobs(dt) {
  const survival = G.mode === 'survival' && !P.dead;
  for (let i = W.mobs.length - 1; i >= 0; i--) {
    const m = W.mobs[i], d = MOBDEF[m.type];
    const pdx = P.x - m.x, pdz = P.z - m.z, pdist = Math.hypot(pdx, pdz), pdy = P.y - m.y;
    if (pdist > 96 || m.y < -30 || (d.hostile && pdist > 72 && Math.random() < dt * 0.5)) { W.mobs.splice(i, 1); continue; }
    if (m.dead) {
      m.dead += dt;
      if (m.dead > 0.9) {
        W.mobs.splice(i, 1);
        particles(m.x, m.y + m.h / 2, m.z, T.white, 14, 0.4, 2, 0.7);
        for (const [id, a, b] of d.drops) { const n = a + Math.floor(Math.random() * (b - a + 1)); const outId = (m.burn > 0 && d.cooked && id !== WOOL) ? d.cooked : (id === WOOL && m.color >= 8 ? COLOR_WOOL + 7 : id); spawnItem(outId, n, m.x, m.y + 0.5, m.z); }
        continue;
      }
    }
    m.hurt = Math.max(0, m.hurt - dt); m.panic = Math.max(0, m.panic - dt); m.attackCd = Math.max(0, m.attackCd - dt);
    const hostileNow = d.hostile && !(m.type === 'spider' && isDay() && !m.angry) && survival && W.difficulty !== 0;
    let tx = 0, tz = 0, speed = 0;
    if (!m.dead && hostileNow && pdist < 18 && Math.abs(pdy) < 10) {
      tx = pdx / (pdist || 1); tz = pdz / (pdist || 1); speed = d.speed; m.yaw = Math.atan2(tx, -tz);
      if (pdist < d.w + 0.75 && pdy > -1.5 && pdy < m.h && m.attackCd <= 0) { m.attackCd = 1; damagePlayer(d.dmg, m.type, m); }
      if (m.type === 'spider' && m.onGround && pdist < 4 && pdist > 1.5 && Math.random() < dt * 2) { m.vy = 6; m.vx += tx * 4; m.vz += tz * 4; }
    } else if (!m.dead && m.panic > 0) {
      m.wanderT -= dt; if (m.wanderT <= 0) { m.yaw = Math.random() * 6.28; m.wanderT = 0.6 + Math.random(); }
      tx = Math.sin(m.yaw); tz = -Math.cos(m.yaw); speed = d.speed * 2.1;
    } else if (!m.dead) {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.moving = Math.random() < 0.55; m.yaw += (Math.random() - 0.5) * 3; m.wanderT = 2 + Math.random() * 5; }
      if (m.moving) { tx = Math.sin(m.yaw); tz = -Math.cos(m.yaw); speed = d.speed * 0.6;
        // avoid cliffs and water while wandering
        const ax = Math.floor(m.x + tx * 0.9), az = Math.floor(m.z + tz * 0.9), fy = Math.floor(m.y);
        if (!solidAt(ax, fy - 1, az) && !solidAt(ax, fy - 2, az) && !solidAt(ax, fy, az) || isWater(getBlock(ax, fy, az))) { m.moving = false; m.yaw += 2; }
      }
    }
    const inW = entityInWater(m, m.h * 0.5);
    const acc = m.onGround ? 10 : 2;
    m.vx += (tx * speed - m.vx) * Math.min(1, acc * dt); m.vz += (tz * speed - m.vz) * Math.min(1, acc * dt);
    if (inW) { m.vy = Math.min(m.vy + 22 * dt, 2.2); m.vy -= 2 * dt; } else m.vy -= GRAVITY * dt;
    m.vy = Math.max(m.vy, -60);
    const bx = moveAxis(m, 'x', m.vx * dt), bz = moveAxis(m, 'z', m.vz * dt);
    const wasGround = m.onGround; m.onGround = false;
    if (moveAxis(m, 'y', m.vy * dt)) { if (m.vy < 0) { m.onGround = true; if (!wasGround && m.vy < -15) hurtMob(m, Math.floor((-m.vy - 14) / 2.2), m.x, m.z, true); } m.vy = 0; }
    if ((bx || bz) && speed > 0) { if (m.onGround) m.vy = 8.4; else if (d.climbs) m.vy = 3.5; }
    // body follows movement direction
    const sp = Math.hypot(m.vx, m.vz);
    if (sp > 0.3) { const want = Math.atan2(m.vx, -m.vz); let dd = want - m.bodyYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.bodyYaw += dd * Math.min(1, 8 * dt); }
    m.walk += sp * dt * 2.2;
    // sunlight burns zombies
    if (d.burns && !m.dead && isDay() && !inW) {
      const l = getLight(Math.floor(m.x), Math.floor(m.y + 1.6), Math.floor(m.z));
      if ((l >> 4) >= 15) { m.burn += dt; if (m.burn > 1) { m.burn = 0.01; hurtMob(m, 1, m.x, m.z, true); m.hurt = 0.2; } if (Math.random() < dt * 8) particles(m.x, m.y + 1.2, m.z, T.furnace_front_lit, 1, 0.3, 1, 0.5); }
    }
    if (!m.dead && d.hostile && Math.random() < dt * 0.06 && pdist < 16) sfx(m.type === 'zombie' ? 'groan' : 'hiss', 0.4);
    if (!m.dead && d.passive && Math.random() < dt * 0.05 && pdist < 12) sfx(m.type, 0.35);
  }
}
let spawnTimer = 0;
function spawnLogic(dt) {
  spawnTimer -= dt; if (spawnTimer > 0) return; spawnTimer = 1;
  let passive = 0, hostile = 0;
  for (const m of W.mobs) MOBDEF[m.type].hostile ? hostile++ : passive++;
  const tryPos = (minR, maxR) => {
    const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
    const x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
    const ch = getChunk(x >> 4, z >> 4); if (!ch || !ch.lit) return null;
    return [x, z];
  };
  if (passive < 10 && Math.random() < 0.3) {
    const p = tryPos(22, 44);
    if (p) {
      let y = WH - 2; while (y > 1 && getBlock(p[0], y, p[1]) === AIR) y--;
      if (getBlock(p[0], y, p[1]) === GRASS && (getLight(p[0], y + 1, p[1]) >> 4) > 9) {
        const types = ['pig', 'cow', 'sheep'], t = types[Math.floor(Math.random() * 3)];
        for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { const ox = p[0] + Math.floor(Math.random() * 3) - 1, oz = p[1] + Math.floor(Math.random() * 3) - 1; if (!solidAt(ox, y + 1, oz) && solidAt(ox, y, oz)) spawnMob(t, ox + 0.5, y + 1, oz + 0.5); }
      }
    }
  }
  if (W.difficulty === 0 || hostile >= 8) return;
  for (let tries = 0; tries < 3; tries++) {
    const p = tryPos(20, 40); if (!p) continue;
    const y0 = Math.floor(P.y);
    for (let y = Math.min(WH - 3, y0 + 14); y > Math.max(1, y0 - 14); y--) {
      if (!solidAt(p[0], y - 1, p[1]) || solidAt(p[0], y, p[1]) || solidAt(p[0], y + 1, p[1]) || isWater(getBlock(p[0], y, p[1]))) continue;
      const l = getLight(p[0], y, p[1]), eff = Math.max(l & 15, (l >> 4) - (15 - W.skyLevel));
      if (eff <= 7 && getBlock(p[0], y - 1, p[1]) !== BEDROCK) { spawnMob(Math.random() < 0.72 ? 'zombie' : 'spider', p[0] + 0.5, y, p[1] + 0.5); return; }
      break;
    }
  }
}

// ── model rendering ──
function drawMobs(B, ox, oy, oz) {
  for (const m of W.mobs) {
    const [sky, blk] = lightAt(m.x, m.y + 0.6, m.z);
    const flash = m.hurt > 0.25 || m.dead ? 1 : 0;
    const cy = Math.cos(m.bodyYaw), sy = Math.sin(m.bodyYaw);
    const roll = m.dead ? Math.min(1, m.dead * 2.5) * Math.PI / 2 : 0;
    const swing = Math.sin(m.walk * 2.8) * Math.min(1, Math.hypot(m.vx, m.vz) / 1.2) * 0.7;
    const part = (min, max, tiles, pivot, rotX, rotZ = 0) => box(B, min, max, tiles, p => {
      let [x, y, z] = p;
      if (rotX) { const dy = y - pivot[1], dz = z - pivot[2], c = Math.cos(rotX), s = Math.sin(rotX); y = pivot[1] + dy * c - dz * s; z = pivot[2] + dy * s + dz * c; }
      if (rotZ) { const dx = x - pivot[0], dy = y - pivot[1], c = Math.cos(rotZ), s = Math.sin(rotZ); x = pivot[0] + dx * c - dy * s; y = pivot[1] + dx * s + dy * c; }
      if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nx = x * c - y * s, ny = x * s + y * c; x = nx; y = ny; }
      return [m.x - ox + x * cy - z * sy, m.y - oy + y, m.z - oz + x * sy + z * cy];
    }, sky, blk, flash);
    const six = t => [t, t, t, t, t, t];
    const withFace = (t, f) => [t, t, t, t, t, f];
    if (m.type === 'zombie') {
      const S = T.zombie_skin, sh = T.zombie_shirt, pa = T.zombie_pants;
      part([-0.25, 0, -0.125], [0, 0.75, 0.125], six(pa), [0, 0.75, 0], swing);
      part([0, 0, -0.125], [0.25, 0.75, 0.125], six(pa), [0, 0.75, 0], -swing);
      part([-0.25, 0.75, -0.125], [0.25, 1.5, 0.125], six(sh), [0, 0, 0], 0);
      part([-0.5, 0.75, -0.125], [-0.25, 1.5, 0.125], [S, S, sh, S, S, S], [0, 1.4, 0], Math.PI / 2 + swing * 0.15);
      part([0.25, 0.75, -0.125], [0.5, 1.5, 0.125], [S, S, sh, S, S, S], [0, 1.4, 0], Math.PI / 2 - swing * 0.15);
      part([-0.25, 1.5, -0.25], [0.25, 2, 0.25], withFace(S, T.zombie_face), [0, 0, 0], 0);
    } else if (m.type === 'spider') {
      const S = T.spider_body;
      part([-0.42, 0.3, -0.1], [0.42, 0.85, 0.75], six(S), [0, 0, 0], 0);
      part([-0.25, 0.32, -0.55], [0.25, 0.72, -0.1], withFace(S, T.spider_face), [0, 0, 0], 0);
      for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
        const z = -0.05 + k * 0.17, a = (-side * 0.5) + Math.sin(m.walk * 3 + k + (side > 0 ? 1.5 : 0)) * 0.25;
        part(side < 0 ? [-0.95, 0.48, z - 0.04] : [0.08, 0.48, z - 0.04], side < 0 ? [-0.08, 0.56, z + 0.04] : [0.95, 0.56, z + 0.04], six(S), [0, 0.52, z], 0, a);
      }
    } else {
      const big = m.type === 'cow', sheep = m.type === 'sheep';
      const woolT = m.color >= 8 ? T.wool_7 : T.wool, skin = m.type === 'pig' ? T.pig_skin : big ? T.cow_skin : woolT, face = m.type === 'pig' ? T.pig_face : big ? T.cow_face : T.sheep_face;
      const legT = m.type === 'pig' ? T.pig_skin : big ? T.cow_skin : T.sheep_face;
      const bw = big ? 0.38 : sheep ? 0.33 : 0.3, by0 = big ? 0.75 : sheep ? 0.6 : 0.38, by1 = big ? 1.3 : sheep ? 1.15 : 0.85, bl = big ? 0.6 : 0.5;
      const lh = by0, lw = big ? 0.13 : 0.12;
      part([-bw, by0, -bl], [bw, by1, bl], six(skin), [0, 0, 0], 0);
      for (const [lx, lz, s] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
        const cx = lx * (bw - lw), cz = lz * (bl - lw - 0.04);
        part([cx - lw, 0, cz - lw], [cx + lw, lh, cz + lw], six(legT), [cx, lh, cz], swing * s);
      }
      const hs = big ? 0.3 : 0.25, hy = big ? 1.05 : sheep ? 0.95 : 0.5;
      part([-hs, hy, -bl - hs * 1.6], [hs, hy + hs * 2, -bl + hs * 0.3], withFace(sheep ? woolT : skin, face), [0, 0, 0], 0);
    }
  }
}
function drawItems(B, ox, oy, oz) {
  for (const e of W.items) {
    const [sky, blk] = lightAt(e.x, e.y + 0.2, e.z);
    const bob = Math.sin(e.age * 2.5) * 0.06 + 0.08, rot = e.age * 1.8;
    const c = Math.cos(rot), s = Math.sin(rot);
    const b = e.id < 256 ? BLOCK[e.id] : null;
    const copies = e.count > 16 ? 3 : e.count > 1 ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const offx = k * 0.07, offy = k * 0.05;
      if (b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent')) {
        const hs = 0.125;
        box(B, [-hs, 0, -hs], [hs, hs * 2, hs], blockTiles(e.id), p => [e.x - ox + offx + p[0] * c - p[2] * s, e.y - oy + bob + offy + p[1], e.z - oz + p[0] * s + p[2] * c], sky, blk);
      } else {
        const tile = b ? T[b.tex] : T[ITEM[e.id].icon], hs = 0.2;
        const P4 = [[-hs, 0, 0], [hs, 0, 0], [hs, hs * 2, 0], [-hs, hs * 2, 0]].map(p => [e.x - ox + offx + p[0] * c, e.y - oy + bob + offy + p[1], e.z - oz + p[0] * s]);
        const uv = [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)];
        B.quad(P4, uv, sky, blk, 0.95);
      }
    }
  }
  for (const t of W.tnts) {
    const [sky, blk] = lightAt(t.x, t.y + 0.5, t.z);
    const flashOn = Math.floor(t.fuse * 4) % 2 === 0;
    const grow = t.fuse < 0.4 ? 1 + (0.4 - t.fuse) * 0.4 : 1;
    box(B, [-0.5 * grow, 0, -0.5 * grow], [0.5 * grow, grow, 0.5 * grow], blockTiles(TNT), p => [t.x - ox + p[0], t.y - oy + p[1], t.z - oz + p[2]], sky, blk, 0, flashOn ? 2.2 : 1);
  }
}
function drawParticles(B, ox, oy, oz, right, up) {
  for (const p of W.particles) {
    const [sky, blk] = p.grav < 0 ? [1, 0] : lightAt(p.x, p.y, p.z);
    const s = p.size, rx = right[0] * s, ry = right[1] * s, rz = right[2] * s, ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
    const x = p.x - ox, y = p.y - oy, z = p.z - oz;
    const q = [[x - rx - ux, y - ry - uy, z - rz - uz], [x + rx - ux, y + ry - uy, z + rz - uz], [x + rx + ux, y + ry + uy, z + rz + uz], [x - rx + ux, y - ry + uy, z - rz + uz]];
    const d = 3 / 16, uv = [uvOf(p.tile, 0, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 0, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 0, 0, p.su, p.sv, p.su + d, p.sv + d)];
    B.quad(q, uv, sky, blk, p.grav < 0 ? Math.min(1, p.life) * 0.9 : 0.9);
  }
}

// ─────────────────────────── player, survival, interaction ───────────────────────────
let G = null, P = null, shake = 0;
const input = { fwd: 0, side: 0, jump: false, sneak: false, sprintKey: false, mine: false, use: false };
const keys = {};

function newPlayer(spawn) {
  return { x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0.6, pitch: -0.15, onGround: false, inWater: false, eyeInWater: false,
    flying: false, sneaking: false, sprinting: false, fallStart: spawn.y, health: 20, hunger: 20, sat: 5, exhaustion: 0, airT: 15, hurt: 0, regenT: 0, starveT: 0, drownT: 0, cactusT: 0, voidT: 0,
    dead: false, swing: 0, bob: 0, eating: 0, mining: null, mineCd: 0, useCd: 0, attackCd: 0, poison: 0, lastJump: 0, lastFwd: 0, jumpCd: 0, stepAcc: 0 };
}
const eyeHeight = () => P.sneaking && !P.flying ? 1.27 : 1.62;
const lookDir = () => [Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)];
const held = () => G.inv[G.sel];

function addToInventory(id, count, dmg = 0) {
  const ms = maxStack(id), inv = G.inv;
  if (ms > 1) for (let i = 0; i < 36; i++) { const s = inv[i]; if (s && s.id === id && s.count < ms) { const k = Math.min(ms - s.count, count); s.count += k; count -= k; if (!count) return 0; } }
  for (let i = 0; i < 36; i++) if (!inv[i]) { const k = Math.min(ms, count); inv[i] = { id, count: k, dmg }; count -= k; if (!count) return 0; }
  return count;
}
function consumeHeld(n = 1) { if (G.mode === 'creative') return; const s = held(); if (!s) return; s.count -= n; if (s.count <= 0) G.inv[G.sel] = null; invChanged(); }
function damageTool(n) {
  if (G.mode === 'creative') return; const s = held(); const t = s && toolOf(s.id); if (!t) return;
  s.dmg = (s.dmg || 0) + n;
  if (s.dmg >= t.dur) { G.inv[G.sel] = null; sfx('toolbreak'); toast(info(s.id).name + '이(가) 부서졌어요!'); }
  invChanged();
}

// ── ray casting ──
function raycast(o, d, maxD, fluids) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
  let tmx = sx ? (sx > 0 ? (x + 1 - o[0]) : (o[0] - x)) * tdx : Infinity, tmy = sy ? (sy > 0 ? (y + 1 - o[1]) : (o[1] - y)) * tdy : Infinity, tmz = sz ? (sz > 0 ? (z + 1 - o[2]) : (o[2] - z)) * tdz : Infinity;
  let t = 0, face = -1, px = x, py = y, pz = z;
  while (t <= maxD) {
    const id = getBlock(x, y, z);
    if (id && (!isWater(id) || (fluids && id === WATER))) {
      if (!(isWater(id) && !fluids)) return { x, y, z, id, face, px, py, pz, t };
    }
    px = x; py = y; pz = z;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 1 : 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 3 : 2; }
    else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 5 : 4; }
    if (y < -1 || y > WH) break;
  }
  return null;
}
function rayMob(o, d, maxD) {
  let best = null, bt = maxD;
  for (const m of W.mobs) {
    if (m.dead) continue;
    const mn = [m.x - m.w, m.y, m.z - m.w], mx = [m.x + m.w, m.y + m.h, m.z + m.w];
    let t0 = 0, t1 = bt, ok = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) { ok = false; break; } continue; }
      let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < bt) { bt = t0; best = m; }
  }
  return best;
}

// ── mining & placing ──
function canHarvest(b, tool) { return !b.tier || (tool && tool.kind === 'pickaxe' && tool.level >= b.tier); }
function breakTime(id) {
  const b = BLOCK[id]; if (!b || b.hard < 0) return Infinity; if (b.hard === 0) return 0.05;
  const s = held(), tool = s && toolOf(s.id);
  let speed = 1;
  if (tool && tool.kind === b.tool) speed = tool.speed;
  if (tool && tool.kind === 'sword' && (id === LEAVES || id === SPRUCE_LEAVES || id === BIRCH_LEAVES || id === MELON || id === PUMPKIN)) speed = 1.5;
  if (P.eyeInWater) speed /= 5;
  if (!P.onGround && !P.flying && !P.inWater) speed /= 5;
  return b.hard * (canHarvest(b, tool) ? 1.5 : 5) / speed;
}
function material(id) {
  const b = BLOCK[id]; if (!b) return 'soft';
  if (id === GLASS || id === ICE || id === GLOWSTONE) return 'glass';
  if (b.tool === 'pickaxe') return 'stone'; if (b.tool === 'axe') return 'wood'; if (b.tool === 'shovel') return id === SAND || id === GRAVEL ? 'sand' : 'dirt';
  return b.render === 'cross' || b.render === 'cutout' ? 'grass' : 'soft';
}
function breakBlock(t) {
  const id = t.id, b = BLOCK[id];
  if (G.mode === 'survival') {
    const s = held(), tool = s && toolOf(s.id);
    if (canHarvest(b, tool)) dropBlockItems(t.x, t.y, t.z, id);
    else { const te = W.te.get(pkey(t.x, t.y, t.z)); if (te) for (const sl of te.slots) if (sl) spawnItem(sl.id, sl.count, t.x + 0.5, t.y + 0.5, t.z + 0.5, sl.dmg); }
    if (tool && b.hard > 0) damageTool(tool.kind === 'sword' ? 2 : 1);
    P.exhaustion += 0.005;
    G.stats.mined++;
  }
  const replace = (id === ICE && G.mode === 'survival' && getBlock(t.x, t.y - 1, t.z) !== AIR) ? WATER : AIR;
  setBlock(t.x, t.y, t.z, replace);
  blockParticles(t.x, t.y, t.z, id);
  sfx('break_' + material(id));
  if (G.ui === 'container' && G.container && G.container.pos === pkey(t.x, t.y, t.z)) closeScreen();
}
function attack(m) {
  const s = held(), tool = s && toolOf(s.id);
  let dmg = tool ? tool.dmg : 1;
  if (P.vy < -1 && !P.onGround && !P.inWater) { dmg *= 1.5; particles(m.x, m.y + m.h * 0.7, m.z, T.white, 8, 0.3, 2, 0.4); }
  if (hurtMob(m, dmg, P.x, P.z)) { if (m.type === 'spider') m.angry = true; if (tool) damageTool(tool.kind === 'sword' ? 1 : 2); P.exhaustion += 0.1; }
  P.swing = 1;
}
function facingFor() { const d = lookDir(); return Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 0) : (d[2] > 0 ? 5 : 4); }
function tryPlace(t, id) {
  const tb = BLOCK[t.id];
  let x = t.px, y = t.py, z = t.pz;
  if (tb && tb.replaceable && !tb.fluid) { x = t.x; y = t.y; z = t.z; }
  if (y < 0 || y >= WH) { toast('여기에는 설치할 수 없어요.'); return false; }
  const cur = getBlock(x, y, z), cb = BLOCK[cur];
  if (cur !== AIR && !(cb && cb.replaceable)) return false;
  const b = BLOCK[id];
  if (b.solid) {
    const hit = e => x + 1 > e.x - e.w && x < e.x + e.w && y + 1 > e.y && y < e.y + e.h && z + 1 > e.z - e.w && z < e.z + e.w;
    if (hit(P) || W.mobs.some(m => !m.dead && hit(m))) return false;
  }
  const below = getBlock(x, y - 1, z);
  if (b.needsSoil && !(below === GRASS || below === DIRT || below === SNOW_GRASS)) { toast(b.name + '은(는) 흙이나 잔디 위에만 심을 수 있어요.'); return false; }
  if (b.needsSand && !(below === SAND || below === DIRT || below === GRASS)) { toast('모래 위에만 심을 수 있어요.'); return false; }
  if (b.needsFloor && !solidAt(x, y - 1, z)) { toast('횃불은 블록 윗면에 설치할 수 있어요.'); return false; }
  if (id === CACTUS && !(below === SAND || below === CACTUS)) { toast('선인장은 모래 위에만 자라요.'); return false; }
  if (b.facing || b.use === 'chest' || b.use === 'furnace') {
    const facing = facingFor();
    if (b.use === 'furnace') W.te.set(pkey(x, y, z), { type: 'furnace', facing, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });
    else if (b.use === 'chest') W.te.set(pkey(x, y, z), { type: 'chest', facing, slots: Array(27).fill(null) });
  }
  if (cur !== AIR && cb && cb.replaceable && !cb.fluid) dropBlockItems(x, y, z, cur);
  setBlock(x, y, z, id);
  if (b.use === 'chest' || b.use === 'furnace') { const ch = getChunk(x >> 4, z >> 4); if (ch) ch.needMesh = true; }
  sfx('place_' + material(id)); P.swing = 1;
  G.stats.placed++;
  return true;
}
function useItem() {
  const t = raycast(eyePos(), lookDir(), REACH, false);
  const s = held(), id = s ? s.id : 0;
  if (t && !P.sneaking) {
    const b = BLOCK[t.id];
    if (b && b.use === 'table') { openScreen('table'); return; }
    if (b && (b.use === 'furnace' || b.use === 'chest')) {
      const k = pkey(t.x, t.y, t.z);
      if (!W.te.has(k)) W.te.set(k, b.use === 'furnace' ? { type: 'furnace', facing: 4, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 } : { type: 'chest', facing: 4, slots: Array(27).fill(null) });
      G.container = { pos: k, te: W.te.get(k) }; openScreen(b.use); sfx('chest'); return;
    }
    if (b && b.use === 'tnt' && id === FLINT_STEEL) { setBlock(t.x, t.y, t.z, AIR); primeTNT(t.x, t.y, t.z); damageTool(1); P.swing = 1; return; }
  }
  if (id === BUCKET) {
    const w = raycast(eyePos(), lookDir(), REACH, true);
    if (w && w.id === WATER) {
      setBlock(w.x, w.y, w.z, AIR); sfx('bucket');
      if (G.mode === 'survival') { if (s.count > 1) { s.count--; if (addToInventory(WATER_BUCKET, 1)) spawnItem(WATER_BUCKET, 1, P.x, P.y + 1, P.z); } else G.inv[G.sel] = { id: WATER_BUCKET, count: 1, dmg: 0 }; invChanged(); }
    }
    return;
  }
  if (id === WATER_BUCKET && t) {
    const tb = BLOCK[t.id]; let x = t.px, y = t.py, z = t.pz;
    if (tb && tb.replaceable) { x = t.x; y = t.y; z = t.z; }
    const cur = getBlock(x, y, z);
    if (cur === AIR || (BLOCK[cur] && BLOCK[cur].replaceable)) {
      if (cur !== AIR && !isWater(cur)) dropBlockItems(x, y, z, cur);
      setBlock(x, y, z, WATER); sfx('bucket');
      if (G.mode === 'survival') { G.inv[G.sel] = { id: BUCKET, count: 1, dmg: 0 }; invChanged(); }
    }
    return;
  }
  if (t && id && id < 256 && BLOCK[id]) { if (tryPlace(t, id)) consumeHeld(1); }
}
function eat(s) {
  const f = ITEM[s.id].food;
  P.hunger = Math.min(20, P.hunger + f[0]); P.sat = Math.min(P.hunger, P.sat + f[1]);
  if (ITEM[s.id].poison && Math.random() < ITEM[s.id].poison) { P.poison = 30; toast('속이 좋지 않아요… 배고픔이 빨리 줄어요.'); }
  consumeHeld(1); sfx('burp');
}
const eyePos = () => [P.x, P.y + eyeHeight(), P.z];

function updateInteraction(dt) {
  P.swing = Math.max(0, P.swing - dt * 4.5);
  P.mineCd = Math.max(0, P.mineCd - dt); P.useCd = Math.max(0, P.useCd - dt); P.attackCd = Math.max(0, P.attackCd - dt);
  const s = held();
  const fluids = s && s.id === BUCKET;
  G.target = raycast(eyePos(), lookDir(), REACH, fluids);
  const tTarget = G.target ? G.target.t : REACH;
  G.targetMob = rayMob(eyePos(), lookDir(), Math.min(REACH - 1, tTarget + 0.01));
  if (input.mine && !P.dead) {
    if (G.targetMob) { if (P.attackCd <= 0) { attack(G.targetMob); P.attackCd = 0.45; } P.mining = null; }
    else if (G.target && !isWater(G.target.id)) {
      const t = G.target;
      if (G.mode === 'creative') { if (P.mineCd <= 0) { if (!(s && toolOf(s.id) && toolOf(s.id).kind === 'sword')) breakBlock(t); P.mineCd = 0.22; P.swing = 1; } }
      else if (P.mineCd <= 0) {
        if (!P.mining || P.mining.x !== t.x || P.mining.y !== t.y || P.mining.z !== t.z || P.mining.id !== t.id) P.mining = { x: t.x, y: t.y, z: t.z, id: t.id, p: 0, snd: 0 };
        const bt = breakTime(t.id);
        P.mining.p += dt / bt; P.mining.snd -= dt; P.swing = Math.max(P.swing, 0.6);
        if (P.mining.snd <= 0) { P.mining.snd = 0.24; sfx('dig_' + material(t.id), 0.5); blockParticles(t.x, t.y, t.z, t.id, 2); }
        if (P.mining.p >= 1) { breakBlock(t); P.mining = null; P.mineCd = 0.12; }
      }
    } else P.mining = null;
  } else P.mining = null;
  if (input.use && !P.dead) {
    const f = s && ITEM[s.id] && ITEM[s.id].food;
    if (f && (P.hunger < 20 || G.mode === 'creative' && false)) {
      if (G.mode === 'survival') { P.eating += dt; if (Math.random() < dt * 6) { sfx('eat', 0.4); particles(P.x + Math.sin(P.yaw) * 0.4, P.y + 1.4, P.z - Math.cos(P.yaw) * 0.4, T[ITEM[s.id].icon], 1, 0.1, 1.5, 0.4); } if (P.eating >= 1.6) { P.eating = 0; eat(s); } }
    } else if (P.useCd <= 0) { useItem(); P.useCd = 0.24; }
  } else P.eating = 0;
}

// ── movement ──
function updatePlayer(dt) {
  if (P.dead) return;
  const creative = G.mode === 'creative';
  if (!creative) P.flying = false;
  P.sneaking = input.sneak && !P.flying;
  const fwd = input.fwd, side = input.side, moving = fwd || side;
  if (fwd <= 0 || P.sneaking || (P.hunger <= 6 && !creative) || P.eating > 0) P.sprinting = false;
  if ((input.sprintKey && fwd > 0) && !P.sneaking && (P.hunger > 6 || creative)) P.sprinting = true;
  P.inWater = entityInWater(P, 0.4); P.eyeInWater = isWater(getBlock(Math.floor(P.x), Math.floor(P.y + eyeHeight()), Math.floor(P.z)));
  let speed = P.flying ? (P.sprinting ? 21.6 : 10.9) : P.sneaking ? 1.31 : P.sprinting ? 5.61 : 4.317;
  if (P.inWater && !P.flying) speed *= 0.45;
  if (P.eating > 0) speed *= 0.35;
  const n = Math.max(1, Math.hypot(fwd, side));
  const wx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) / n * speed, wz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) / n * speed;
  const below = getBlock(Math.floor(P.x), Math.floor(P.y - 0.05), Math.floor(P.z));
  const icy = below === ICE;
  const acc = P.flying ? 6 : P.onGround ? (icy ? 1.6 : 16) : P.inWater ? 6 : 3.5;
  P.vx += (wx - P.vx) * Math.min(1, acc * dt); P.vz += (wz - P.vz) * Math.min(1, acc * dt);
  if (P.flying) {
    const ty = ((input.jump ? 1 : 0) - (input.sneak ? 1 : 0)) * 8.5;
    P.vy += (ty - P.vy) * Math.min(1, 10 * dt);
  } else if (P.inWater) {
    if (input.jump) P.vy = Math.min(P.vy + 26 * dt, 3.4); else P.vy = Math.max(P.vy - 10 * dt, -2.6);
    P.fallStart = P.y;
  } else {
    if (input.jump && P.onGround && P.jumpCd <= 0) {
      P.vy = 8.95; P.jumpCd = 0.08; P.exhaustion += P.sprinting ? 0.2 : 0.05;
      if (P.sprinting) { P.vx += Math.sin(P.yaw) * 2.2; P.vz -= Math.cos(P.yaw) * 2.2; }
    }
    P.vy -= GRAVITY * dt; P.vy = Math.max(P.vy, -78);
  }
  P.jumpCd = Math.max(0, (P.jumpCd || 0) - dt);
  const ox = P.x, oz = P.z;
  // sneaking keeps you on edges
  const edgeSafe = (nx, nz) => !P.sneaking || !P.onGround || boxHits(nx - P.w, P.y - 0.6, nz - P.w, nx + P.w, P.y - 0.01, nz + P.w);
  const dx = P.vx * dt, dz = P.vz * dt;
  let bx = false, bz = false;
  if (edgeSafe(P.x + dx, P.z)) bx = moveAxis(P, 'x', dx); else P.vx = 0;
  if (edgeSafe(P.x, P.z + dz)) bz = moveAxis(P, 'z', dz); else P.vz = 0;
  if (bx) P.vx = 0; if (bz) P.vz = 0;
  if (P.inWater && input.jump && (bx || bz)) P.vy = Math.max(P.vy, 5.2);
  if ((bx || bz) && P.sprinting && !P.flying) P.sprinting = false;
  // auto-jump (touch)
  if ((bx || bz) && G.settings.autoJump && P.onGround && moving && !P.sneaking && !P.flying) {
    const fx = Math.floor(P.x + Math.sin(P.yaw) * 0.6), fz = Math.floor(P.z - Math.cos(P.yaw) * 0.6), fy = Math.floor(P.y);
    if (solidAt(fx, fy, fz) && !solidAt(fx, fy + 1, fz) && !solidAt(fx, fy + 2, fz)) { P.vy = 8.4; }
  }
  const wasGround = P.onGround; P.onGround = false;
  if (moveAxis(P, 'y', P.vy * dt)) {
    if (P.vy < 0) {
      P.onGround = true;
      if (P.flying && creative) P.flying = false;
      if (!wasGround) { const fall = P.fallStart - P.y; if (fall > 3.4 && !P.inWater && !creative) damagePlayer(Math.ceil(fall - 3), 'fall'); if (fall > 1.2) sfx('step_' + material(getBlock(Math.floor(P.x), Math.floor(P.y - 0.1), Math.floor(P.z))), 0.6); }
    }
    P.vy = 0;
  }
  if (P.onGround || P.flying || P.inWater) P.fallStart = P.y; else P.fallStart = Math.max(P.fallStart, P.y);
  // footsteps, bobbing, exhaustion
  const moved = Math.hypot(P.x - ox, P.z - oz);
  if (P.onGround && moved > 0) {
    P.bob += moved; P.stepAcc = (P.stepAcc || 0) + moved;
    if (P.stepAcc > (P.sprinting ? 2.2 : 1.8)) { P.stepAcc = 0; sfx('step_' + material(below), 0.35); }
    if (P.sprinting) P.exhaustion += moved * 0.1;
  }
  if (P.inWater && moved > 0) P.exhaustion += moved * 0.01;
  if (P.y < -64) { P.y = -64; P.vy = 0; }
}

function damagePlayer(amount, cause, src) {
  if (G.mode === 'creative' || P.dead || amount <= 0) return;
  const bypass = cause === 'starve' || cause === 'drown' || cause === 'void' || cause === 'explosion';
  if (P.hurt > 0 && !bypass) return;
  P.health = Math.max(0, P.health - amount); P.hurt = 0.5; G.hurtFlash = 1;
  P.exhaustion += 0.1;
  if (src) { const dx = P.x - src.x, dz = P.z - src.z, d = Math.hypot(dx, dz) || 1; P.vx += dx / d * 6; P.vz += dz / d * 6; P.vy = Math.max(P.vy, 5); }
  sfx('hurt'); shake = Math.max(shake, 0.25);
  if (P.health <= 0) die(cause);
  hudDirty = true;
}
const DEATH_MSG = { fall: '높은 곳에서 떨어졌습니다', zombie: '좀비에게 당했습니다', spider: '거미에게 당했습니다', drown: '익사했습니다', starve: '굶어 죽었습니다', explosion: '폭발에 휘말렸습니다', cactus: '선인장에 찔렸습니다', void: '세상 밖으로 떨어졌습니다', kill: '스스로 목숨을 끊었습니다' };
function die(cause) {
  P.dead = true; P.health = 0; input.mine = input.use = false;
  if (G.mode === 'survival') {
    for (let i = 0; i < 36; i++) { const s = G.inv[i]; if (s) { spawnItem(s.id, s.count, P.x, P.y + 1, P.z, s.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.inv[i] = null; } }
    invChanged();
  }
  G.stats.deaths++;
  showDeath(DEATH_MSG[cause] || '사망했습니다');
  saveSoon();
}
function respawn() {
  const sp = G.spawn;
  Object.assign(P, newPlayer(sp), { yaw: P.yaw });
  P.y = surfaceY(sp.x, sp.z, sp.y);
  hideScreens(); hudDirty = true; capture();
}
function surfaceY(x, z, fallback) {
  const bx = Math.floor(x), bz = Math.floor(z);
  if (!getChunk(bx >> 4, bz >> 4)) return fallback;
  for (let y = WH - 2; y > 0; y--) if (solidAt(bx, y, bz)) { return y + 1; }
  return fallback;
}

function updateSurvival(dt) {
  if (P.dead) return;
  P.hurt = Math.max(0, P.hurt - dt);
  if (G.mode === 'creative') { P.health = 20; P.hunger = 20; P.airT = 15; return; }
  if (W.difficulty === 0) { P.regenT += dt; if (P.regenT > 1) { P.regenT = 0; if (P.health < 20) P.health++; if (P.hunger < 20) P.hunger++; hudDirty = true; } }
  if (P.poison > 0) { P.poison -= dt; P.exhaustion += dt * 0.5; }
  while (P.exhaustion >= 4) { P.exhaustion -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else { P.hunger = Math.max(0, P.hunger - 1); hudDirty = true; } }
  if (P.health < 20 && P.hunger >= 18) {
    P.regenT += dt;
    const fast = P.hunger >= 20 && P.sat > 0;
    if (P.regenT >= (fast ? 0.5 : 4)) { P.regenT = 0; P.health = Math.min(20, P.health + 1); P.exhaustion += fast ? Math.min(P.sat, 6) / 6 * 1.5 + 0.5 : 3; hudDirty = true; }
  } else if (P.hunger <= 0) {
    P.starveT += dt; if (P.starveT >= 4) { P.starveT = 0; if (P.health > 1) damagePlayer(1, 'starve'); }
  } else P.regenT = 0;
  if (P.eyeInWater) {
    P.airT -= dt;
    if (P.airT <= 0) { P.airT = 0; P.drownT += dt; if (P.drownT >= 1) { P.drownT = 0; damagePlayer(2, 'drown'); } }
  } else P.airT = Math.min(15, P.airT + dt * 6);
  // cactus contact
  P.cactusT = Math.max(0, P.cactusT - dt);
  if (P.cactusT <= 0) {
    for (let bx = Math.floor(P.x - P.w - 0.05); bx <= Math.floor(P.x + P.w + 0.05); bx++) for (let bz = Math.floor(P.z - P.w - 0.05); bz <= Math.floor(P.z + P.w + 0.05); bz++) for (let by = Math.floor(P.y - 0.05); by <= Math.floor(P.y + 1.7); by++) {
      if (getBlock(bx, by, bz) === CACTUS && P.cactusT <= 0) { P.cactusT = 0.5; damagePlayer(1, 'cactus'); }
    }
  }
  if (P.y < -8) { P.voidT += dt; if (P.voidT > 0.5) { P.voidT = 0; damagePlayer(4, 'void'); } }
}

// ─────────────────────────── UI: HUD, screens, inventory ───────────────────────────
let root = null, ctx = null, canvas = null;
let hudDirty = true, invDirty = true;
const $ = id => root.querySelector('#' + id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTouch = () => matchMedia('(pointer:coarse)').matches;
function invChanged() { invDirty = true; if (G && G.ui) renderSlots(); }

const CSS = `*{box-sizing:border-box}#mc{position:relative;width:100%;height:100%;overflow:hidden;background:#000;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#fff;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
.hud{position:absolute;inset:0;pointer-events:none}
.cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;mix-blend-mode:difference}
.cross:before,.cross:after{content:"";position:absolute;background:#fff}.cross:before{left:8px;top:0;width:2px;height:18px}.cross:after{top:8px;left:0;height:2px;width:18px}
.flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(200,0,0,.55));opacity:0}
.uw{position:absolute;inset:0;background:rgba(20,50,140,.35);display:none}
.bottom{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center}
.itemname{height:22px;font-size:14px;font-weight:700;text-shadow:2px 2px 0 #000a;transition:opacity .4s}
.bars{display:flex;justify-content:space-between;width:364px;margin-bottom:3px}
.bars .row{display:flex;gap:0}.bars img{width:20px;height:20px;image-rendering:pixelated;margin-right:-2px}.bars .food{flex-direction:row-reverse}
.bars .shake img{animation:shk .25s infinite}@keyframes shk{50%{transform:translateY(-2px)}}
.air{width:364px;display:flex;flex-direction:row-reverse;height:20px;margin-bottom:1px}.air img{width:20px;height:20px;image-rendering:pixelated;margin-left:-2px}
.xp{display:none}
.hotbar{display:flex;background:#0008;border:2px solid #000a;padding:2px;gap:0;pointer-events:auto}
.hs{width:40px;height:40px;border:2px solid #8b8b8b55;position:relative;display:flex;align-items:center;justify-content:center;background:#ffffff0d}
.hs.sel{border:3px solid #fff;outline:2px solid #000;z-index:1;background:#ffffff26}
.ico{width:30px;height:30px;image-rendering:pixelated;pointer-events:none}
.cnt{position:absolute;right:2px;bottom:0;font-size:13px;font-weight:800;text-shadow:2px 2px 0 #3f3f3f;pointer-events:none}
.dur{position:absolute;left:4px;right:4px;bottom:3px;height:3px;background:#000;pointer-events:none}.dur i{display:block;height:2px;background:#4f4}
.eat{position:absolute;left:50%;top:58%;width:120px;height:6px;margin-left:-60px;background:#0008;display:none}.eat i{display:block;height:100%;background:#f9c74f}
.debug{position:absolute;left:6px;top:6px;font:12px/1.5 ui-monospace,monospace;text-shadow:1px 1px #000;white-space:pre;background:#0005;padding:4px 6px;display:none}
.chatlog{position:absolute;left:8px;bottom:120px;width:min(460px,70%);display:flex;flex-direction:column;gap:2px}
.chatlog div{background:#0007;padding:2px 6px;font-size:13px;transition:opacity 1s;text-shadow:1px 1px #000}
.toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);background:#000a;padding:6px 14px;font-size:14px;border-radius:2px;opacity:0;transition:opacity .3s;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}
.tools{position:absolute;right:8px;top:8px;display:flex;gap:6px;pointer-events:auto}
.btn{font:inherit;color:#fff;background:#6b6b6b;border:2px solid #000;box-shadow:inset 2px 2px #ffffff40,inset -2px -2px #00000059;padding:8px 14px;cursor:pointer;font-weight:700;text-shadow:2px 2px #3f3f3f;min-height:38px}
.btn:hover{background:#7c86b8}.btn:focus-visible{outline:2px solid #fff}.btn[disabled]{background:#2c2c2c;color:#a0a0a0;cursor:default}
.btn.sm{padding:4px 9px;font-size:12px;min-height:30px}
.btn.on{background:#4a7d3b}
.screen{position:absolute;inset:0;background:#0009;display:flex;padding:10px;z-index:5;overflow:auto}.screen>*{margin:auto}
.screen[hidden]{display:none}
.screen.dirt{background:#2b1e14 url() repeat;background-size:64px 64px}
.menu{display:flex;flex-direction:column;gap:8px;align-items:stretch;width:min(400px,92vw);text-align:center}
.menu h1{font-size:clamp(30px,6vw,56px);margin:0 0 4px;letter-spacing:1px;color:#ddd;text-shadow:4px 4px 0 #3a3a3a,0 0 18px #0008;font-weight:900}
.menu h2{margin:4px 0 8px;font-size:22px;text-shadow:2px 2px #000}
.menu p{margin:2px 0;font-size:13px;color:#ddd;line-height:1.6;text-shadow:1px 1px #000}
.splash{color:#ff0;font-weight:800;transform:rotate(-8deg);font-size:14px;text-shadow:2px 2px #3f3f00;margin-top:-8px}
.worlds{display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow:auto;background:#0006;border:2px solid #000;padding:6px}
.world{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#ffffff10;border:2px solid transparent;cursor:pointer;text-align:left}
.world:hover,.world.sel{border-color:#fff}.world b{display:block;font-size:15px}.world small{color:#bbb;font-size:12px}
.world .grow{flex:1;min-width:0}.world .grow b,.world .grow small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.field{display:flex;flex-direction:column;gap:4px;text-align:left;font-size:13px;color:#ddd}
.field input,.field select{font:inherit;font-size:15px;background:#000;color:#fff;border:2px solid #a0a0a0;padding:8px}
.row2{display:flex;gap:8px}.row2>*{flex:1}
.panel{background:#c6c6c6;color:#3f3f3f;border:3px solid #000;box-shadow:inset 3px 3px #fff,inset -3px -3px #555;padding:12px;display:flex;flex-direction:column;gap:8px;max-width:100%}
.panel h3{margin:0;font-size:14px;color:#3f3f3f}
.grid{display:grid;gap:0;justify-content:center}
.slot{width:40px;height:40px;background:#8b8b8b;border:2px solid;border-color:#373737 #fff #fff #373737;position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}
.slot:hover{background:#a8a8a8}.slot.big{width:52px;height:52px}.slot.big .ico{width:38px;height:38px}
.slot.no{opacity:.45}
.cols{display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center}
.arrow{font-size:26px;color:#5b5b5b;font-weight:900;position:relative}
.arrowbar{width:44px;height:16px;background:#8b8b8b;position:relative;border:2px solid #555}.arrowbar i{position:absolute;left:0;top:0;bottom:0;background:#fff}
.flame{width:26px;height:26px;background:#8b8b8b;border:2px solid #555;position:relative;overflow:hidden}.flame i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd64a,#e8590c)}
.cursor{position:absolute;pointer-events:none;z-index:9;width:40px;height:40px;margin:-20px 0 0 -20px;display:flex;align-items:center;justify-content:center}
.tip{position:absolute;pointer-events:none;z-index:10;background:#100010ee;border:2px solid #2a0a5c;color:#fff;padding:4px 8px;font-size:13px;white-space:nowrap;display:none}
.recipes{display:grid;grid-template-columns:repeat(auto-fill,36px);gap:2px;max-height:230px;overflow:auto;background:#8b8b8b;border:2px solid;border-color:#373737 #fff #fff #373737;padding:3px;width:236px;align-content:start}
.recipes .slot{width:36px;height:36px;border-width:1px}.recipes .slot.ok{background:#9fd28a}
.tabs{display:flex;gap:3px;flex-wrap:wrap}.tab{font:inherit;font-size:12px;padding:5px 8px;background:#8b8b8b;border:2px solid #373737;color:#fff;cursor:pointer;font-weight:700}.tab.on{background:#c6c6c6;color:#3f3f3f;border-color:#fff}
.palette{display:grid;grid-template-columns:repeat(9,40px);max-height:min(232px,34vh);overflow:auto;align-content:start}
.search{font:inherit;padding:6px;border:2px solid #373737;background:#fff;color:#000;width:100%}
.mobtools{display:none;gap:6px}
.touch{display:none;position:absolute;inset:0;pointer-events:none}
.joy{position:absolute;left:18px;bottom:24px;width:132px;height:132px;border-radius:50%;background:#ffffff1a;border:2px solid #ffffff40;pointer-events:auto;touch-action:none}
.joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:#ffffff55;border:2px solid #fff8}
.tbtns{position:absolute;right:14px;bottom:24px;display:grid;grid-template-columns:repeat(2,60px);gap:8px;pointer-events:auto}
.tb{width:60px;height:60px;border-radius:50%;background:#0006;border:2px solid #fff8;color:#fff;font:inherit;font-size:12px;font-weight:800;touch-action:none}
.tb.on{background:#4a7d3bcc}.tb.wide{grid-column:span 2;width:auto;border-radius:30px;height:44px}
.tleft{position:absolute;left:18px;bottom:170px;display:flex;flex-direction:column;gap:8px;pointer-events:auto}
@media(pointer:coarse){.touch{display:block}.mobtools{display:flex}.bottom{bottom:4px}.chatlog{bottom:200px}}
@media(max-width:620px),(max-height:520px){.hs{width:34px;height:34px}.ico{width:24px;height:24px}.bars,.air{width:310px}.bars img,.air img{width:15px;height:15px}.slot{width:34px;height:34px}.palette{grid-template-columns:repeat(9,34px)}.panel{padding:8px}.recipes{width:200px}.menu h1{font-size:30px}.joy{width:112px;height:112px}.tb{width:52px;height:52px}.tbtns{grid-template-columns:repeat(2,52px)}}
@media(max-height:520px){.slot{width:30px;height:30px}.ico{width:22px;height:22px}.palette{grid-template-columns:repeat(9,30px)}.cnt{font-size:11px}}`;

const SPLASH = ['무한한 세계!', '블록으로 무엇이든!', '밤에는 조심!', '다이아몬드를 찾아라!', '100% 자체 제작 텍스처!', '횃불은 소중해요', '작업대부터 만들어요'];

function buildDOM() {
  root.innerHTML = `<style>${CSS}</style><section id="mc">
<canvas id="cv" tabindex="0" aria-label="3D 블록 월드"></canvas>
<div class="hud" id="hud">
 <div class="uw" id="uw"></div><div class="flash" id="flash"></div>
 <div class="cross" id="cross"></div>
 <div class="debug" id="debug"></div>
 <div class="chatlog" id="chatlog"></div>
 <div class="toast" id="toast" role="status"></div>
 <div class="eat" id="eat"><i></i></div>
 <div class="tools"><button class="btn sm" id="bInv" aria-label="인벤토리">가방</button><button class="btn sm" id="bPause" aria-label="일시정지">Ⅱ</button></div>
 <div class="touch" id="touch">
  <div class="joy" id="joy"><i id="knob"></i></div>
  <div class="tleft"><button class="tb" id="tSneak">숙이기</button><button class="tb" id="tFly" hidden>비행</button></div>
  <div class="tbtns"><button class="tb" id="tMine">캐기</button><button class="tb" id="tUse">놓기</button><button class="tb" id="tDown" hidden>내려가기</button><button class="tb" id="tJump">점프</button></div>
 </div>
 <div class="bottom"><div class="itemname" id="itemname"></div><div class="air" id="air"></div><div class="bars" id="bars"><div class="row" id="hearts"></div><div class="row food" id="food"></div></div><div class="hotbar" id="hotbar"></div></div>
</div>
<div class="screen" id="screen" hidden></div>
<div class="cursor" id="cursor"></div><div class="tip" id="tip"></div>
</section>`;
  canvas = $('cv');
  $('hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="hs" data-hot="${i}"></div>`).join('');
  $('hearts').innerHTML = '<img alt="">'.repeat(10); $('food').innerHTML = '<img alt="">'.repeat(10); $('air').innerHTML = '<img alt="">'.repeat(10);
}
function slotHTML(s) {
  if (!s) return '';
  const t = toolOf(s.id), dur = t && s.dmg ? `<div class="dur"><i style="width:${Math.max(0, 100 - s.dmg / t.dur * 100)}%;background:hsl(${120 * (1 - s.dmg / t.dur)},90%,50%)"></i></div>` : '';
  return `<img class="ico" src="${ICON[s.id]}" alt="">${s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}${dur}`;
}
let nameTimer = 0;
function updateHUD(dt) {
  if (!G) return;
  if (invDirty) {
    invDirty = false;
    root.querySelectorAll('[data-hot]').forEach((el, i) => { el.innerHTML = slotHTML(G.inv[i]); el.classList.toggle('sel', i === G.sel); });
    const s = held(); $('itemname').textContent = s ? info(s.id).name : ''; $('itemname').style.opacity = 1; nameTimer = 2.5;
  }
  if (nameTimer > 0) { nameTimer -= dt; if (nameTimer <= 0) $('itemname').style.opacity = 0; }
  const surv = G.mode === 'survival';
  $('bars').style.visibility = surv ? 'visible' : 'hidden';
  if (hudDirty && surv) {
    hudDirty = false;
    const hs = $('hearts').children, fs = $('food').children;
    for (let i = 0; i < 10; i++) {
      hs[i].src = HUDICON[P.health >= i * 2 + 2 ? 'heart_full' : P.health >= i * 2 + 1 ? 'heart_half' : 'heart_empty'];
      fs[i].src = HUDICON[P.hunger >= i * 2 + 2 ? 'food_full' : P.hunger >= i * 2 + 1 ? 'food_half' : 'food_empty'];
    }
    $('hearts').classList.toggle('shake', P.health <= 4);
  }
  const bubbles = Math.ceil(P.airT / 1.5);
  const air = $('air');
  if (surv && P.airT < 15) { air.style.visibility = 'visible'; [...air.children].forEach((im, i) => { im.src = HUDICON.bubble; im.style.visibility = i < bubbles ? 'visible' : 'hidden'; }); } else air.style.visibility = 'hidden';
  if (G.hurtFlash > 0) { G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.5); }
  $('flash').style.opacity = G.hurtFlash || 0;
  $('uw').style.display = P.eyeInWater ? 'block' : 'none';
  const eat = $('eat'); eat.style.display = P.eating > 0 ? 'block' : 'none'; if (P.eating > 0) eat.firstChild.style.width = Math.min(100, P.eating / 1.6 * 100) + '%';
  $('tFly').hidden = G.mode !== 'creative'; $('tFly').classList.toggle('on', P.flying); $('tDown').hidden = !P.flying && !P.inWater;
  $('tSneak').classList.toggle('on', input.sneak && touchSneak);
  // chat fade
  for (const el of $('chatlog').children) { const age = (performance.now() - el.dataset.t) / 1000; el.style.opacity = G.ui === 'chat' ? 1 : age > 8 ? 0 : 1; }
  while ($('chatlog').children.length > 8) $('chatlog').firstChild.remove();
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { if (t.isConnected) t.style.opacity = 0; }, 2600); }
function chat(msg, color) { const d = document.createElement('div'); d.textContent = msg; d.dataset.t = performance.now(); if (color) d.style.color = color; $('chatlog').append(d); }

// ── screen management ──
let cursorStack = null, quickMove = false, oneMode = false, tipEl = null, creativeTab = '전체', creativeSearch = '';
function openScreen(kind) {
  if (G.ui === 'death') return;
  input.mine = input.use = false; P.mining = null;
  if (kind === 'table') G.craft = Array(9).fill(null), G.craftW = 3;
  else if (kind === 'inventory') G.craft = Array(4).fill(null), G.craftW = 2;
  G.ui = kind === 'table' || kind === 'inventory' || kind === 'creative' ? kind : (kind === 'furnace' || kind === 'chest') ? 'container' : kind;
  G.uiKind = kind;
  releasePointer();
  renderScreen();
}
function closeScreen() {
  if (!G) return;
  // return items in craft grid and cursor
  if (G.craft) { for (const s of G.craft) if (s) { const l = addToInventory(s.id, s.count, s.dmg); if (l) spawnItem(s.id, l, P.x, P.y + 1.2, P.z, s.dmg); } G.craft = null; }
  if (cursorStack) { const l = addToInventory(cursorStack.id, cursorStack.count, cursorStack.dmg); if (l) spawnItem(cursorStack.id, l, P.x, P.y + 1.2, P.z, cursorStack.dmg); cursorStack = null; }
  if (G.ui === 'container') G.container = null;
  G.ui = null; G.uiKind = null;
  hideScreens(); invChanged();
  capture();
}
function hideScreens() { const s = $('screen'); s.hidden = true; s.innerHTML = ''; $('cursor').innerHTML = ''; $('tip').style.display = 'none'; if (G && G.ui !== 'title') G.ui = null; }
function slotEl(ref, cls = '') { return `<div class="slot ${cls}" data-slot="${ref}"></div>`; }
function invGrid() {
  return `<div class="grid" style="grid-template-columns:repeat(9,auto)">${Array.from({ length: 27 }, (_, i) => slotEl('inv:' + (i + 9))).join('')}</div>
  <div class="grid" style="grid-template-columns:repeat(9,auto);margin-top:6px">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>`;
}
const touchTools = () => `<div class="mobtools"><button class="btn sm ${quickMove ? 'on' : ''}" data-act="quick">빠른 이동</button><button class="btn sm ${oneMode ? 'on' : ''}" data-act="one">1개씩</button></div>`;
function renderScreen() {
  const s = $('screen'); s.hidden = false; s.className = 'screen';
  const k = G.uiKind;
  if (k === 'inventory' || k === 'table') {
    const w = G.craftW;
    s.innerHTML = `<div class="panel" role="dialog" aria-label="${k === 'table' ? '작업대' : '인벤토리'}"><div class="row2" style="justify-content:space-between;align-items:center"><h3>${k === 'table' ? '제작' : '인벤토리 · 제작'}</h3>${touchTools()}<button class="btn sm" data-act="close">닫기</button></div>
    <div class="cols"><div class="cols"><div class="grid" style="grid-template-columns:repeat(${w},auto)">${G.craft.map((_, i) => slotEl('craft:' + i)).join('')}</div><span class="arrow">➜</span>${slotEl('out', 'big')}</div>
    <div><h3 style="margin-bottom:4px">레시피 (초록 = 지금 제작 가능)</h3><div class="recipes" id="recipes"></div></div></div>${invGrid()}</div>`;
    renderRecipes();
  } else if (k === 'creative') {
    const tabs = ['전체', '블록', '장식', '기능', '도구', '음식', '재료'];
    s.innerHTML = `<div class="panel" role="dialog" aria-label="크리에이티브 인벤토리"><div class="row2" style="align-items:center;justify-content:space-between"><h3>크리에이티브 아이템</h3>${touchTools()}<button class="btn sm" data-act="close">닫기</button></div>
    <div class="tabs">${tabs.map(t => `<button class="tab ${t === creativeTab ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
    <input class="search" id="csearch" placeholder="아이템 검색…" value="${esc(creativeSearch)}" aria-label="아이템 검색">
    <div class="palette" id="palette"></div>${invGrid()}<div class="row2" style="align-items:center"><span style="font-size:12px;flex:3">팔레트를 누르면 64개를 집어요(우클릭/1개씩: 1개). 아이템을 든 채 팔레트나 휴지통을 누르면 지워져요.</span>${slotEl('trash')}</div></div>`;
    renderPalette();
    const inp = $('csearch'); inp.addEventListener('input', () => { creativeSearch = inp.value; renderPalette(); }); inp.addEventListener('keydown', e => e.stopPropagation());
  } else if (k === 'furnace') {
    s.innerHTML = `<div class="panel" role="dialog" aria-label="화로"><div class="row2" style="justify-content:space-between;align-items:center"><h3>화로</h3>${touchTools()}<button class="btn sm" data-act="close">닫기</button></div>
    <div class="cols"><div style="display:flex;flex-direction:column;align-items:center;gap:4px">${slotEl('c:0')}<div class="flame"><i id="fflame"></i></div>${slotEl('c:1')}</div><div class="arrowbar"><i id="farrow"></i></div>${slotEl('c:2', 'big')}</div>
    <p style="margin:0;font-size:12px">위: 구울 재료 · 아래: 연료(석탄, 나무 등)</p>${invGrid()}</div>`;
  } else if (k === 'chest') {
    s.innerHTML = `<div class="panel" role="dialog" aria-label="상자"><div class="row2" style="justify-content:space-between;align-items:center"><h3>상자</h3>${touchTools()}<button class="btn sm" data-act="close">닫기</button></div>
    <div class="grid" style="grid-template-columns:repeat(9,auto)">${Array.from({ length: 27 }, (_, i) => slotEl('c:' + i)).join('')}</div><h3>인벤토리</h3>${invGrid()}</div>`;
  }
  renderSlots();
}
function renderSlots() {
  const s = $('screen'); if (s.hidden) return;
  s.querySelectorAll('[data-slot]').forEach(el => { const r = el.dataset.slot; if (r.startsWith('pal:') || r === 'trash') return; el.innerHTML = slotHTML(getSlot(r)); });
  const out = s.querySelector('[data-slot="out"]'); if (out) out.innerHTML = slotHTML(craftResult());
  $('cursor').innerHTML = slotHTML(cursorStack);
  if (G.uiKind === 'furnace' && G.container) { const te = G.container.te; const f = $('fflame'), a = $('farrow'); if (f) f.style.height = (te.burn > 0 ? te.burn / te.burnMax * 100 : 0) + '%'; if (a) a.style.width = (te.cook / SMELT_TIME * 100) + '%'; }
  if (G.uiKind === 'inventory' || G.uiKind === 'table') renderRecipes();
}
function getSlot(ref) {
  const [k, i] = ref.split(':');
  if (k === 'inv') return G.inv[+i];
  if (k === 'craft') return G.craft[+i];
  if (k === 'c') return G.container.te.slots[+i];
  if (k === 'out') return craftResult();
  return null;
}
function setSlot(ref, v) {
  const [k, i] = ref.split(':');
  if (k === 'inv') G.inv[+i] = v; else if (k === 'craft') G.craft[+i] = v; else if (k === 'c') G.container.te.slots[+i] = v;
}
function craftResult() { if (!G.craft) return null; const r = craft(G.craft.map(s => s ? s.id : 0), G.craftW); return r ? { id: r.id, count: r.count, dmg: 0 } : null; }
function consumeGrid() { for (let i = 0; i < G.craft.length; i++) { const s = G.craft[i]; if (s) { s.count--; if (s.count <= 0) { G.craft[i] = s.id === WATER_BUCKET ? { id: BUCKET, count: 1, dmg: 0 } : null; } } } }
const clone = s => s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null;
const same = (a, b) => a && b && a.id === b.id && maxStack(a.id) > 1;
function moveToRange(stack, from, to, accept) {
  for (const pass of [0, 1]) for (let i = from; i < to; i++) {
    const ref = typeof accept === 'string' ? accept + i : 'inv:' + i;
    const cur = getSlot(ref);
    if (pass === 0 && same(cur, stack)) { const k = Math.min(maxStack(stack.id) - cur.count, stack.count); cur.count += k; stack.count -= k; }
    else if (pass === 1 && !cur) { setSlot(ref, clone(stack)); stack.count = 0; }
    if (!stack.count) return null;
  }
  return stack;
}
function shiftMove(ref) {
  const st = getSlot(ref); if (!st) return;
  const [k, idx] = ref.split(':'), i = +idx;
  let rest;
  if (k === 'inv') {
    if (G.uiKind === 'chest') rest = moveToRange(st, 0, 27, 'c:');
    else if (G.uiKind === 'furnace') { const tgt = SMELT[st.id] != null ? 0 : FUEL[st.id] ? 1 : -1; rest = st; if (tgt >= 0) { const cur = G.container.te.slots[tgt]; if (!cur) { G.container.te.slots[tgt] = clone(st); rest = null; } else if (same(cur, st)) { const n = Math.min(maxStack(st.id) - cur.count, st.count); cur.count += n; st.count -= n; rest = st.count ? st : null; } } }
    else rest = i < 9 ? moveToRange(st, 9, 36) : moveToRange(st, 0, 9);
    setSlot(ref, rest && rest.count ? rest : null);
  } else {
    rest = moveToRange(st, 0, 36); setSlot(ref, rest && rest.count ? rest : null);
  }
}
function slotClick(ref, right, shift) {
  shift = shift || quickMove; right = right || oneMode;
  if (ref === 'trash') { cursorStack = null; renderSlots(); return; }
  if (ref.startsWith('pal:')) {
    const id = +ref.slice(4);
    if (cursorStack) cursorStack = null;
    else if (shift) addToInventory(id, maxStack(id));
    else cursorStack = { id, count: right ? 1 : maxStack(id), dmg: 0 };
    renderSlots(); return;
  }
  if (ref === 'out') {
    const r = craftResult(); if (!r) return;
    if (shift) { let n = 0; while (n++ < 64) { const r2 = craftResult(); if (!r2 || r2.id !== r.id) break; const left = addToInventory(r2.id, r2.count); consumeGrid(); if (left) { spawnItem(r2.id, left, P.x, P.y + 1.2, P.z); break; } } }
    else if (!cursorStack) { cursorStack = r; consumeGrid(); }
    else if (cursorStack.id === r.id && cursorStack.count + r.count <= maxStack(r.id)) { cursorStack.count += r.count; consumeGrid(); }
    sfx('craft'); G.stats.crafted++;
    renderSlots(); invChanged(); return;
  }
  if (ref === 'c:2' && G.uiKind === 'furnace') {
    const st = getSlot(ref); if (!st) return;
    if (shift) { shiftMove(ref); }
    else if (!cursorStack) { cursorStack = st; setSlot(ref, null); }
    else if (same(cursorStack, st)) { const k = Math.min(maxStack(st.id) - cursorStack.count, st.count); cursorStack.count += k; st.count -= k; if (!st.count) setSlot(ref, null); }
    renderSlots(); invChanged(); return;
  }
  if (shift) { shiftMove(ref); renderSlots(); invChanged(); return; }
  const st = getSlot(ref);
  if (!right) {
    if (!cursorStack) { if (st) { cursorStack = st; setSlot(ref, null); } }
    else if (!st) { setSlot(ref, cursorStack); cursorStack = null; }
    else if (same(st, cursorStack)) { const k = Math.min(maxStack(st.id) - st.count, cursorStack.count); st.count += k; cursorStack.count -= k; if (!cursorStack.count) cursorStack = null; }
    else { setSlot(ref, cursorStack); cursorStack = st; }
  } else {
    if (!cursorStack) { if (st) { const h = Math.ceil(st.count / 2); cursorStack = { id: st.id, count: h, dmg: st.dmg }; st.count -= h; if (!st.count) setSlot(ref, null); } }
    else if (!st) { setSlot(ref, { id: cursorStack.id, count: 1, dmg: cursorStack.dmg }); cursorStack.count--; if (!cursorStack.count) cursorStack = null; }
    else if (same(st, cursorStack) && st.count < maxStack(st.id)) { st.count++; cursorStack.count--; if (!cursorStack.count) cursorStack = null; }
    else { setSlot(ref, cursorStack); cursorStack = st; }
  }
  renderSlots(); invChanged();
}
// recipe book
function recipeNeeds(r) {
  const need = [];
  if (r.items) r.items.forEach(k => need.push(k));
  else r.pattern.forEach(row => { for (const ch of row) if (ch !== ' ') need.push(r.keys[ch]); });
  return need;
}
function canFill(r) {
  if (r.pattern && (r.pattern.length > G.craftW || Math.max(...r.pattern.map(s => s.length)) > G.craftW)) return false;
  const pool = [...G.inv, ...G.craft].filter(Boolean).map(clone);
  for (const key of recipeNeeds(r)) { const s = pool.find(p => p.count > 0 && matches(key, p.id)); if (!s) return false; s.count--; }
  return true;
}
let recipeCache = null;
function renderRecipes() {
  const el = $('recipes'); if (!el) return;
  const seen = new Set(), list = [];
  for (const r of RECIPES) { if (r.pattern && (r.pattern.length > G.craftW || Math.max(...r.pattern.map(s => s.length)) > G.craftW)) continue; if (seen.has(r.out)) continue; seen.add(r.out); list.push(r); }
  const key = list.map(r => (canFill(r) ? 1 : 0)).join('');
  if (recipeCache === key + G.craftW && el.children.length) return;
  recipeCache = key + G.craftW;
  list.sort((a, b) => canFill(b) - canFill(a));
  el.innerHTML = list.map(r => `<div class="slot ${canFill(r) ? 'ok' : 'no'}" data-recipe="${RECIPES.indexOf(r)}" data-name="${esc(info(r.out).name)}${r.count > 1 ? ' ×' + r.count : ''}"><img class="ico" src="${ICON[r.out]}" alt=""></div>`).join('');
}
function fillRecipe(ri) {
  const r = RECIPES[ri];
  if (!canFill(r)) {
    const names = {}; for (const k of recipeNeeds(r)) { const n = typeof k === 'string' ? ({ log: '아무 원목', planks: '나무 판자', wool: '양털' })[k] : info(k).name; names[n] = (names[n] || 0) + 1; }
    toast('필요: ' + Object.entries(names).map(([n, c]) => `${n} ×${c}`).join(', ')); return;
  }
  for (let i = 0; i < G.craft.length; i++) if (G.craft[i]) { addToInventory(G.craft[i].id, G.craft[i].count, G.craft[i].dmg); G.craft[i] = null; }
  const take = key => { for (let i = 0; i < 36; i++) { const s = G.inv[i]; if (s && matches(key, s.id)) { s.count--; const one = { id: s.id, count: 1, dmg: 0 }; if (!s.count) G.inv[i] = null; return one; } } return null; };
  if (r.items) r.items.forEach((k, i) => { G.craft[i] = take(k); });
  else r.pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ' ') G.craft[y * G.craftW + x] = take(r.keys[row[x]]); });
  renderSlots(); invChanged();
}
function renderPalette() {
  const el = $('palette'); if (!el) return;
  const ids = [];
  for (let id = 1; id < 256; id++) { const b = BLOCK[id]; if (b && b.creative !== false) ids.push(id); }
  for (const id in ITEM) ids.push(+id);
  const q = creativeSearch.trim();
  const list = ids.filter(id => { const inf = info(id); if (q && !inf.name.includes(q)) return false; if (creativeTab === '전체') return true; return (inf.cat || '블록') === creativeTab; });
  el.innerHTML = list.map(id => `<div class="slot" data-slot="pal:${id}" data-name="${esc(info(id).name)}"><img class="ico" src="${ICON[id]}" alt=""></div>`).join('') || '<p style="grid-column:1/-1;font-size:13px">결과가 없어요.</p>';
}
function screenEvents() {
  const s = $('screen');
  const handle = (e, right) => {
    const sl = e.target.closest('[data-slot]'), rc = e.target.closest('[data-recipe]'), act = e.target.closest('[data-act]'), tab = e.target.closest('[data-tab]');
    if (sl && !sl.dataset.slot.startsWith('pal:') && G.ui) { slotClick(sl.dataset.slot, right, e.shiftKey); return; }
    if (sl) { slotClick(sl.dataset.slot, right, e.shiftKey); return; }
    if (rc) { fillRecipe(+rc.dataset.recipe); return; }
    if (tab) { creativeTab = tab.dataset.tab; renderScreen(); return; }
    if (act) menuAction(act.dataset.act, act);
  };
  ctx.on(s, 'click', e => handle(e, false));
  ctx.on(s, 'contextmenu', e => { e.preventDefault(); if (e.target.closest('[data-slot]')) handle(e, true); });
  ctx.on(s, 'pointermove', e => {
    const r = root.querySelector('#mc').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = $('cursor'); cur.style.left = x + 'px'; cur.style.top = y + 'px';
    const tip = $('tip'), el = e.target.closest('[data-slot],[data-recipe]');
    let name = el && (el.dataset.name || (getSlot(el.dataset.slot || '') ? info(getSlot(el.dataset.slot).id).name : ''));
    if (el && el.dataset.slot === 'out') { const o = craftResult(); name = o ? info(o.id).name : ''; }
    if (name && e.pointerType === 'mouse') { tip.textContent = name; tip.style.display = 'block'; tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 4) + 'px'; tip.style.top = (y - 30) + 'px'; } else tip.style.display = 'none';
  });
}

// ── menus ──
function screenHTML(inner, dirt) { const s = $('screen'); s.hidden = false; s.className = 'screen' + (dirt ? ' dirt' : ''); s.innerHTML = inner; }
let selectedWorld = null, deleteArmed = null;
function showTitle() {
  G = null; W = null;
  const worlds = SAVE.worlds.slice().sort((a, b) => b.played - a.played);
  if (!selectedWorld || !worlds.find(w => w.id === selectedWorld)) selectedWorld = worlds[0] ? worlds[0].id : null;
  const fmt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  screenHTML(`<div class="menu"><h1>MINECRAFT<br><small style="font-size:.45em;letter-spacing:6px">MINI</small></h1><div class="splash">${SPLASH[Math.floor(Math.random() * SPLASH.length)]}</div>
  <h2 style="margin-top:6px">월드 선택</h2>
  <div class="worlds" role="listbox" aria-label="저장된 월드">${worlds.length ? worlds.map(w => `<div class="world ${w.id === selectedWorld ? 'sel' : ''}" data-act="pick" data-id="${w.id}" role="option" aria-selected="${w.id === selectedWorld}"><img class="ico" src="${ICON[w.mode === 'creative' ? GRASS : DIAMOND_ORE]}" alt=""><div class="grow"><b>${esc(w.name)}</b><small>${w.mode === 'creative' ? '크리에이티브' : '서바이벌'}${w.difficulty === 0 ? ' · 평화로움' : ''} · ${fmt(w.played)} · 시드 ${esc(w.seedText)}</small></div></div>`).join('') : '<p>아직 월드가 없어요. 새 월드를 만들어 보세요!</p>'}</div>
  <div class="row2"><button class="btn" data-act="play" ${selectedWorld ? '' : 'disabled'}>선택한 월드 플레이</button><button class="btn" data-act="new">새 월드 만들기</button></div>
  <div class="row2"><button class="btn" data-act="delete" ${selectedWorld ? '' : 'disabled'}>${deleteArmed === selectedWorld && selectedWorld ? '정말 삭제할까요?' : '월드 삭제'}</button><button class="btn" data-act="settings">설정</button></div>
  <p>${SAVE.storage ? '월드는 이 브라우저에 자동 저장돼요.' : '이 환경에서는 저장소를 쓸 수 없어 월드가 저장되지 않아요.'}</p></div>`, true);
  G = null;
}
function showCreate() {
  screenHTML(`<div class="menu"><h2>새 월드 만들기</h2>
  <label class="field">월드 이름<input id="wname" maxlength="32" value="새로운 세계${SAVE.worlds.length ? ' ' + (SAVE.worlds.length + 1) : ''}"></label>
  <div class="field">게임 모드<div class="row2"><button class="btn on" data-act="mode" data-mode="survival" id="mSurv">서바이벌</button><button class="btn" data-act="mode" data-mode="creative" id="mCrea">크리에이티브</button></div></div>
  <p id="modeDesc">자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.</p>
  <div class="field">난이도<div class="row2"><button class="btn" data-act="diff" data-diff="0" id="d0">평화로움</button><button class="btn on" data-act="diff" data-diff="2" id="d2">보통</button></div></div>
  <label class="field">시드 (비우면 무작위)<input id="wseed" maxlength="24" placeholder="예: 다이아몬드"></label>
  <div class="row2"><button class="btn" data-act="create">월드 만들기</button><button class="btn" data-act="title">취소</button></div></div>`, true);
  root.querySelectorAll('#screen input').forEach(i => i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') menuAction('create'); }));
  createOpts = { mode: 'survival', difficulty: 2 };
}
let createOpts = { mode: 'survival', difficulty: 2 };
function showPause() {
  if (!G || G.ui === 'death') return;
  G.ui = 'pause'; releasePointer(); input.mine = input.use = false;
  screenHTML(`<div class="menu"><h2>게임 메뉴</h2><button class="btn" data-act="resume">게임으로 돌아가기</button><button class="btn" data-act="settings">설정</button><button class="btn" data-act="help">조작법 · 도움말</button><button class="btn" data-act="quit">저장하고 타이틀로</button>
  <p>${esc(G.world.name)} · ${G.mode === 'creative' ? '크리에이티브' : '서바이벌'} · ${dayCount()}일째</p></div>`);
  ctx.setPaused(true);
}
function showSettings(back) {
  const st = SAVE.settings, prev = G ? G.ui : 'title';
  if (G) G.ui = 'settings';
  screenHTML(`<div class="menu"><h2>설정</h2>
  <label class="field">시야 거리: <b id="vRd">${st.renderDist}</b> 청크<input type="range" min="2" max="8" value="${st.renderDist}" id="sRd"></label>
  <label class="field">시야각(FOV): <b id="vFov">${st.fov}</b><input type="range" min="55" max="105" value="${st.fov}" id="sFov"></label>
  <label class="field">마우스 감도: <b id="vSens">${st.sens}</b><input type="range" min="1" max="20" value="${st.sens}" id="sSens"></label>
  <div class="row2"><button class="btn ${st.bob ? 'on' : ''}" data-act="tbob">화면 흔들림 ${st.bob ? '켬' : '끔'}</button><button class="btn ${st.autoJump ? 'on' : ''}" data-act="tjump">자동 점프 ${st.autoJump ? '켬' : '끔'}</button></div>
  ${G ? `<div class="row2"><button class="btn ${W.difficulty === 0 ? 'on' : ''}" data-act="sdiff" data-diff="0">평화로움</button><button class="btn ${W.difficulty !== 0 ? 'on' : ''}" data-act="sdiff" data-diff="2">보통</button></div>` : ''}
  <button class="btn" data-act="${back || (prev === 'title' || !G ? 'title' : 'pause')}">완료</button></div>`, !G);
  const bind = (id, key, out) => { const el = $(id); el.addEventListener('input', () => { st[key] = +el.value; $(out).textContent = el.value; if (G) G.settings = st; saveSettingsSoon(); }); };
  bind('sRd', 'renderDist', 'vRd'); bind('sFov', 'fov', 'vFov'); bind('sSens', 'sens', 'vSens');
}
function showHelp() {
  G.ui = 'help';
  screenHTML(`<div class="menu" style="width:min(560px,94vw)"><h2>조작법</h2><div class="panel" style="text-align:left;font-size:13px;line-height:1.75;color:#222">
  <b>PC</b> — WASD 이동 · 마우스 시점 · 좌클릭(꾹) 캐기/공격 · 우클릭 설치/사용/먹기 · Space 점프(크리에이티브에서 두 번: 비행) · Shift 웅크리기 · Ctrl 또는 W 두 번 달리기 · 1–9/휠 아이템 선택 · E 인벤토리 · Q 버리기 · 가운데 클릭 블록 집기 · T 또는 / 채팅·명령어 · F3 디버그 · Esc 메뉴<br>
  <b>모바일</b> — 왼쪽 조이스틱 이동 · 화면 드래그 시점 · 짧게 탭 설치/사용 · 길게 누르기 캐기/공격 · 오른쪽 버튼 점프/캐기/놓기<br>
  <b>시작 팁</b> — 나무를 캐 원목 → 판자 → 작업대 → 나무 곡괭이 → 돌 → 화로 → 철. 밤에는 횃불(석탄+막대기)과 집이 필요해요.<br>
  <b>명령어</b> — /gamemode survival|creative · /time set day|night · /give 아이템이름 [개수] · /tp x y z · /spawnpoint · /kill · /seed · /help</div><button class="btn" data-act="pause">돌아가기</button></div>`);
}
function showDeath(msg) {
  G.ui = 'death'; releasePointer();
  screenHTML(`<div class="menu" style="background:#5a0000aa;padding:24px"><h1 style="color:#fff">사망했습니다!</h1><p>${esc(msg)}</p><p>${G.mode === 'survival' ? '소지품은 사망한 자리에 떨어졌어요.' : ''}</p><button class="btn" data-act="respawn">다시 태어나기</button><button class="btn" data-act="quit">타이틀 화면</button></div>`);
}
function showLoading(pct) {
  const s = $('screen');
  if (!s.querySelector('#loadbar')) screenHTML(`<div class="menu"><h2>월드를 불러오는 중</h2><p id="loadtxt">지형 생성 중…</p><div style="height:10px;background:#000;border:2px solid #888"><i id="loadbar" style="display:block;height:100%;width:0;background:#7ad35a"></i></div></div>`, true);
  $('loadbar').style.width = Math.round(pct * 100) + '%'; $('loadtxt').textContent = `지형 생성 중… ${Math.round(pct * 100)}%`;
}
function openChat(prefix = '') {
  G.ui = 'chat'; releasePointer(); input.mine = input.use = false;
  const s = $('screen'); s.hidden = false; s.className = 'screen'; s.style.background = 'transparent'; s.style.alignItems = 'flex-end';
  s.innerHTML = `<input id="chatin" maxlength="120" style="margin:auto 0 0;width:100%;font:inherit;font-size:15px;padding:8px;background:#000b;color:#fff;border:0" placeholder="메시지 또는 /명령어 (Enter 전송, Esc 닫기)" aria-label="채팅 입력">`;
  const inp = $('chatin'); inp.value = prefix; inp.focus();
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = inp.value.trim(); closeChat(); if (v) { if (v.startsWith('/')) command(v); else chat('<나> ' + v); } }
    else if (e.key === 'Escape') closeChat();
  });
}
function closeChat() { const s = $('screen'); s.style.background = ''; s.style.alignItems = ''; hideScreens(); G.ui = null; capture(); }
function dayCount() { return Math.floor(W.time / DAY_TICKS) + 1; }

function menuAction(a, el) {
  switch (a) {
    case 'close': closeScreen(); break;
    case 'quick': quickMove = !quickMove; renderScreen(); break;
    case 'one': oneMode = !oneMode; renderScreen(); break;
    case 'pick': selectedWorld = el.dataset.id; deleteArmed = null; showTitle(); break;
    case 'play': if (selectedWorld) startWorld(SAVE.worlds.find(w => w.id === selectedWorld)); break;
    case 'new': showCreate(); break;
    case 'title': showTitle(); break;
    case 'delete':
      if (deleteArmed !== selectedWorld) { deleteArmed = selectedWorld; showTitle(); ctx.timeout(() => { if (deleteArmed && !G) { deleteArmed = null; if ($('screen').querySelector('.worlds')) showTitle(); } }, 3500); }
      else { SAVE.worlds = SAVE.worlds.filter(w => w.id !== selectedWorld); deleteArmed = null; selectedWorld = null; persist(); showTitle(); }
      break;
    case 'mode': createOpts.mode = el.dataset.mode; $('mSurv').classList.toggle('on', createOpts.mode === 'survival'); $('mCrea').classList.toggle('on', createOpts.mode === 'creative');
      $('modeDesc').textContent = createOpts.mode === 'creative' ? '모든 블록을 무한히 쓰고, 날아다니며, 다치지 않아요. 몬스터도 공격하지 않아요.' : '자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.'; break;
    case 'diff': createOpts.difficulty = +el.dataset.diff; $('d0').classList.toggle('on', createOpts.difficulty === 0); $('d2').classList.toggle('on', createOpts.difficulty !== 0); break;
    case 'create': {
      const name = ($('wname').value.trim() || '새로운 세계').slice(0, 32), seedText = $('wseed').value.trim() || String(Math.floor(Math.random() * 1e9));
      const w = { id: 'w' + Date.now().toString(36), name, mode: createOpts.mode, difficulty: createOpts.difficulty, seedText, seed: /^-?\d+$/.test(seedText) ? (+seedText | 0) >>> 0 : hashSeed(seedText), created: Date.now(), played: Date.now(), data: null };
      SAVE.worlds.push(w); selectedWorld = w.id; startWorld(w); break;
    }
    case 'settings': showSettings(); break;
    case 'resume': hideScreens(); G.ui = null; ctx.setPaused(false); capture(); break;
    case 'pause': showPause(); break;
    case 'help': showHelp(); break;
    case 'quit': quitToTitle(); break;
    case 'respawn': respawn(); break;
    case 'tbob': SAVE.settings.bob = !SAVE.settings.bob; saveSettingsSoon(); showSettings(); break;
    case 'tjump': SAVE.settings.autoJump = !SAVE.settings.autoJump; saveSettingsSoon(); showSettings(); break;
    case 'sdiff': W.difficulty = +el.dataset.diff; G.world.difficulty = W.difficulty; if (W.difficulty === 0) W.mobs = W.mobs.filter(m => !MOBDEF[m.type].hostile); showSettings(); break;
  }
}

// ── commands ──
function findItem(q) {
  q = q.toLowerCase().replace(/_/g, ' ');
  const all = [...BLOCK.filter(Boolean).map(b => b.id), ...Object.keys(ITEM).map(Number)];
  if (/^\d+$/.test(q)) return info(+q) ? +q : null;
  return all.find(id => info(id).name === q) ?? all.find(id => info(id).name.includes(q)) ?? null;
}
function command(line) {
  const [cmd, ...a] = line.slice(1).split(/\s+/);
  const ok = m => chat(m, '#aaa'), bad = m => chat(m, '#f66');
  switch (cmd) {
    case 'help': ok('/gamemode <survival|creative> · /time set <day|night|noon|midnight|숫자> · /give <아이템> [개수] · /tp <x> <y> <z> · /spawnpoint · /kill · /seed'); break;
    case 'gamemode': case 'gm': {
      const m = { survival: 'survival', s: 'survival', '0': 'survival', '서바이벌': 'survival', creative: 'creative', c: 'creative', '1': 'creative', '크리에이티브': 'creative' }[a[0]];
      if (!m) { bad('사용법: /gamemode survival|creative'); break; }
      G.mode = m; G.world.mode = m; if (m === 'survival') P.flying = false; hudDirty = invDirty = true; ok('게임 모드를 ' + (m === 'creative' ? '크리에이티브' : '서바이벌') + '(으)로 바꿨어요.'); break;
    }
    case 'time': {
      const v = { day: 1000, noon: 6000, night: 13000, midnight: 18000 }[a[1]] ?? (+a[1]);
      if (a[0] !== 'set' || !isFinite(v)) { bad('사용법: /time set day|night|noon|midnight|숫자'); break; }
      W.time = Math.floor(W.time / DAY_TICKS) * DAY_TICKS + (v % DAY_TICKS); ok('시간을 ' + v + '(으)로 설정했어요.'); break;
    }
    case 'give': {
      const id = findItem(a.slice(0, a.length > 1 && /^\d+$/.test(a[a.length - 1]) ? -1 : undefined).join(' ') || '');
      const n = a.length > 1 && /^\d+$/.test(a[a.length - 1]) ? Math.min(640, +a[a.length - 1]) : 1;
      if (!id) { bad('아이템을 찾지 못했어요. 예: /give 다이아몬드 5'); break; }
      const left = addToInventory(id, n); if (left) spawnItem(id, left, P.x, P.y + 1, P.z); invChanged(); ok(info(id).name + ' ×' + n + '을(를) 받았어요.'); break;
    }
    case 'tp': { const [x, y, z] = a.map(Number); if (![x, y, z].every(isFinite)) { bad('사용법: /tp x y z'); break; } P.x = x; P.y = clamp(y, 1, WH + 20); P.z = z; P.vy = 0; P.fallStart = P.y; ok(`${x} ${y} ${z}(으)로 이동했어요.`); break; }
    case 'spawnpoint': G.spawn = { x: P.x, y: P.y, z: P.z }; ok('여기를 리스폰 지점으로 정했어요.'); break;
    case 'kill': die('kill'); break;
    case 'seed': ok('시드: ' + G.world.seedText); break;
    default: bad('알 수 없는 명령어예요. /help 를 입력해 보세요.');
  }
}

// ── touch controls ──
let touchSneak = false;
function touchEvents() {
  const joy = $('joy'), knob = $('knob');
  let jid = null, jc = null;
  const setJoy = (dx, dy) => { const r = 46, d = Math.hypot(dx, dy), k = d > r ? r / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; const nx = dx * k / r, ny = dy * k / r; input.fwd = Math.abs(ny) > 0.2 ? -ny : 0; input.side = Math.abs(nx) > 0.2 ? nx : 0; input.sprintKey = ny < -0.95; };
  ctx.on(joy, 'pointerdown', e => { e.preventDefault(); jid = e.pointerId; try { joy.setPointerCapture(jid); } catch { } const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; setJoy(e.clientX - jc[0], e.clientY - jc[1]); });
  ctx.on(joy, 'pointermove', e => { if (e.pointerId === jid) setJoy(e.clientX - jc[0], e.clientY - jc[1]); });
  const endJoy = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; input.fwd = input.side = 0; input.sprintKey = false; };
  ctx.on(joy, 'pointerup', endJoy); ctx.on(joy, 'pointercancel', endJoy);
  const hold = (id, on, off) => { const b = $(id); ctx.on(b, 'pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { } on(); }); ctx.on(b, 'pointerup', off); ctx.on(b, 'pointercancel', off); ctx.on(b, 'contextmenu', e => e.preventDefault()); };
  hold('tJump', () => { input.jump = true; }, () => { input.jump = false; });
  hold('tDown', () => { input.sneak = true; }, () => { input.sneak = touchSneak; });
  hold('tMine', () => { input.mine = true; P.attackCd = 0; P.mineCd = 0; }, () => { input.mine = false; });
  hold('tUse', () => { input.use = true; P.useCd = 0; }, () => { input.use = false; });
  ctx.on($('tSneak'), 'click', () => { touchSneak = !touchSneak; input.sneak = touchSneak; });
  ctx.on($('tFly'), 'click', () => { if (G.mode === 'creative') { P.flying = !P.flying; P.vy = 0; } });
  // look + tap/hold on the canvas
  const looks = new Map();
  ctx.on(canvas, 'pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    if (!G || G.ui) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { }
    const L = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, mining: false };
    L.timer = ctx.timeout(() => { if (looks.get(e.pointerId) === L && L.moved < 12) { L.mining = true; input.mine = true; P.attackCd = 0; P.mineCd = 0; } }, 280);
    looks.set(e.pointerId, L);
  });
  ctx.on(canvas, 'pointermove', e => {
    const L = looks.get(e.pointerId); if (!L) return;
    const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; L.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0055 * SAVE.settings.sens / 8;
    P.yaw += dx * k; P.pitch = clamp(P.pitch - dy * k, -1.55, 1.55);
  });
  const endLook = e => {
    const L = looks.get(e.pointerId); if (!L) return; looks.delete(e.pointerId);
    if (L.mining) input.mine = false;
    else if (L.moved < 12 && performance.now() - L.t < 280 && G && !G.ui) { input.use = true; P.useCd = 0; updateInteraction(0); input.use = false; }
  };
  ctx.on(canvas, 'pointerup', endLook); ctx.on(canvas, 'pointercancel', endLook);
  // hotbar taps
  ctx.on($('hotbar'), 'pointerdown', e => { const h = e.target.closest('[data-hot]'); if (!h || !G) return; e.preventDefault(); const i = +h.dataset.hot; if (i === G.sel && isTouch()) { openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); return; } G.sel = i; invChanged(); });
  ctx.on($('bInv'), 'click', () => { if (G && !G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); else if (G && (G.ui === 'inventory' || G.ui === 'creative' || G.ui === 'table' || G.ui === 'container')) closeScreen(); });
  ctx.on($('bPause'), 'click', () => { if (G && !G.ui) showPause(); else if (G && G.ui === 'pause') menuAction('resume'); });
}

// ─────────────────────────── audio (synthesised) ───────────────────────────
let audio = null, master = null, noiseBuf = null, muted = true;
const lastSfx = {};
function wake() {
  if (muted) return;
  try {
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = 0.55; master.connect(audio.destination); const n = audio.sampleRate; noiseBuf = audio.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    if (audio.state === 'suspended') audio.resume().catch(() => { });
  } catch { }
}
function sfx(name, vol = 1) {
  if (muted || !audio || audio.state !== 'running') return;
  const now = audio.currentTime; if (lastSfx[name] && now - lastSfx[name] < 0.03) return; lastSfx[name] = now;
  const t = now;
  const tone = (type, f0, f1, dur, v, delay = 0) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur); g.gain.setValueAtTime(0.0001, t + delay); g.gain.exponentialRampToValueAtTime(v * vol, t + delay + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g).connect(master); o.start(t + delay); o.stop(t + delay + dur + 0.02); };
  const noise = (dur, freq, q, v, type = 'bandpass', delay = 0) => { const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(v * vol, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); s.connect(f).connect(g).connect(master); s.start(t + delay, Math.random() * 0.5); s.stop(t + delay + dur + 0.02); };
  const mat = name.split('_')[1];
  const matF = { stone: 1100, wood: 520, dirt: 380, sand: 1600, grass: 2400, glass: 3800, soft: 700 }[mat] || 800;
  if (name.startsWith('break_')) { noise(0.2, matF, 0.9, 0.55); if (mat === 'glass') tone('sine', 2200, 1300, 0.25, 0.08); if (mat === 'wood') tone('triangle', 180, 110, 0.09, 0.12); }
  else if (name.startsWith('dig_')) noise(0.08, matF, 1, 0.3);
  else if (name.startsWith('place_')) { noise(0.09, matF * 0.8, 1, 0.5); tone('triangle', 160, 120, 0.05, 0.08); }
  else if (name.startsWith('step_')) noise(0.05, matF * 0.7, 1.2, 0.18);
  else switch (name) {
    case 'pop': tone('sine', 700, 1300, 0.07, 0.12); break;
    case 'hurt': tone('square', 240, 120, 0.16, 0.07); noise(0.1, 600, 1, 0.2); break;
    case 'mhurt': case 'pig': tone('sawtooth', 320, 220, 0.18, 0.05); tone('sawtooth', 300, 200, 0.12, 0.04, 0.12); break;
    case 'cow': tone('sawtooth', 130, 95, 0.6, 0.05); break;
    case 'sheep': tone('sawtooth', 380, 360, 0.25, 0.035); tone('sawtooth', 360, 330, 0.25, 0.03, 0.1); break;
    case 'zhurt': case 'groan': { const o = audio.createOscillator(), g = audio.createGain(), l = audio.createOscillator(), lg = audio.createGain(); o.type = 'sawtooth'; o.frequency.value = name === 'zhurt' ? 150 : 95; l.frequency.value = 7; lg.gain.value = 12; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g).connect(master); o.start(t); l.start(t); o.stop(t + 0.75); l.stop(t + 0.75); break; }
    case 'hiss': case 'shurt': noise(0.35, 5000, 0.7, 0.18); break;
    case 'boom': noise(1.4, 300, 0.5, 1, 'lowpass'); tone('sine', 70, 28, 0.9, 0.5); break;
    case 'fuse': noise(0.5, 4500, 0.5, 0.2); break;
    case 'eat': noise(0.07, 1400, 1.5, 0.35); break;
    case 'burp': tone('sawtooth', 180, 90, 0.22, 0.06); break;
    case 'craft': tone('triangle', 520, 780, 0.07, 0.08); break;
    case 'toolbreak': noise(0.25, 3000, 1, 0.4); tone('square', 900, 300, 0.2, 0.05); break;
    case 'bucket': noise(0.3, 700, 0.8, 0.4, 'lowpass'); break;
    case 'chest': tone('triangle', 170, 120, 0.16, 0.12); break;
  }
}
let musicT = 40;
function music(dt) {
  if (muted || !audio || audio.state !== 'running') return;
  musicT -= dt; if (musicT > 0) return; musicT = 70 + Math.random() * 90;
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3], t = audio.currentTime;
  let deg = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < 9; i++) {
    deg = clamp(deg + Math.floor(Math.random() * 5) - 2, 0, scale.length - 1);
    const at = t + i * (0.9 + Math.random() * 0.6), o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = scale[deg] * (Math.random() < 0.3 ? 0.5 : 1);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.04, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
    o.connect(g).connect(master); o.start(at); o.stop(at + 2.7);
  }
}

// ─────────────────────────── saving ───────────────────────────
let SAVE = null, saveTimer = 0, settingsTimer = 0;
function loadSave() {
  const touch = isTouch();
  SAVE = { v: 1, settings: { renderDist: touch ? 3 : 5, fov: 75, sens: 8, bob: true, autoJump: touch }, worlds: [], storage: typeof ctx.save === 'function' };
  try {
    const raw = ctx.savedData;
    if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.worlds)) { SAVE.worlds = o.worlds.filter(w => w && w.id && w.name); Object.assign(SAVE.settings, o.settings || {}); } }
  } catch { toast('저장된 데이터를 읽지 못해 새로 시작해요.'); }
}
function serializeWorld() {
  return {
    player: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, health: P.health, hunger: P.hunger, sat: P.sat, airT: P.airT, flying: P.flying, dead: P.dead },
    inv: G.inv.map(s => s ? [s.id, s.count, s.dmg || 0] : 0), sel: G.sel, time: W.time, spawn: G.spawn, stats: G.stats,
    mods: encodeMods(), te: Object.fromEntries(W.te),
    mobs: W.mobs.filter(m => !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 80).map(m => [m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), m.hp, m.color]),
  };
}
function persist() {
  if (!SAVE || !SAVE.storage) return;
  if (G && W && !G.loading) { G.world.data = serializeWorld(); G.world.played = Date.now(); G.world.mode = G.mode; G.world.difficulty = W.difficulty; }
  const str = JSON.stringify({ v: 1, settings: SAVE.settings, worlds: SAVE.worlds });
  try { Promise.resolve(ctx.save(str)).then(r => { if (r && r.ok === false) toast(r.error || '저장 공간이 부족해 월드를 저장하지 못했어요.'); }).catch(() => { }); } catch { }
}
function saveSoon() { saveTimer = 2; }
function saveSettingsSoon() { settingsTimer = 1; }

// ─────────────────────────── session lifecycle ───────────────────────────
let lastPc = null, wantList = [];
function startWorld(w) {
  wake();
  const d = w.data;
  W = { seed: w.seed >>> 0, noise: makeNoise(w.seed >>> 0), noise2: makeNoise((w.seed ^ 0x9e3779b9) >>> 0), chunks: new Map(), mods: decodeMods(d && d.mods), te: new Map(Object.entries((d && d.te) || {})),
    fluidQ: new Set(), gravQ: new Set(), mobs: [], items: [], particles: [], tnts: [], time: d ? d.time : 1000, difficulty: w.difficulty ?? 2, daylight: 1, skyLevel: 15 };
  lastChunk = null; lastPc = null;
  G = { world: w, mode: w.mode, inv: Array(36).fill(null), sel: (d && d.sel) || 0, ui: 'loading', settings: SAVE.settings, spawn: (d && d.spawn) || findSpawn(), stats: (d && d.stats) || { mined: 0, placed: 0, crafted: 0, deaths: 0 },
    target: null, targetMob: null, hurtFlash: 0, loading: true, fresh: !d, craft: null, craftW: 2 };
  P = newPlayer(G.spawn);
  if (d && d.player) { Object.assign(P, d.player); P.fallStart = P.y; if (P.dead) { P.dead = false; P.health = 20; P.hunger = 20; Object.assign(P, { x: G.spawn.x, y: G.spawn.y, z: G.spawn.z }); } }
  if (d && d.inv) G.inv = d.inv.map(s => s && info(s[0]) ? { id: s[0], count: s[1], dmg: s[2] || 0 } : null);
  else if (w.mode === 'creative') [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICKS, TORCH].forEach((id, i) => G.inv[i] = { id, count: 64, dmg: 0 });
  if (d && d.mobs) for (const [type, x, y, z, hp, color] of d.mobs) if (MOBDEF[type]) { const m = spawnMob(type, x, y, z); m.hp = hp; m.color = color || 0; }
  invDirty = hudDirty = true;
  w.played = Date.now();
  showLoading(0);
}
function finishLoading() {
  G.loading = false; G.ui = null; hideScreens();
  if (G.fresh) {
    // pick an open spot (not on a tree or in water) near the generated spawn
    const sx = Math.floor(P.x), sz = Math.floor(P.z); let best = null;
    for (let r = 0; r < 14 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dz = -r; dz <= r && !best; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = sx + dx, z = sz + dz; let y = WH - 2; while (y > 0 && !solidAt(x, y, z)) y--;
      const top = getBlock(x, y, z);
      if ((top === GRASS || top === SAND || top === SNOW_GRASS || top === DIRT) && !isWater(getBlock(x, y + 1, z)) && !solidAt(x, y + 1, z) && !solidAt(x, y + 2, z)) best = [x + 0.5, y + 1, z + 0.5];
    }
    if (best) [P.x, P.y, P.z] = best; else P.y = surfaceY(P.x, P.z, P.y);
    G.spawn = { x: P.x, y: P.y, z: P.z }; P.fallStart = P.y;
  }
  else if (hitsAt(P, P.x, P.y, P.z)) P.y = surfaceY(P.x, P.z, P.y);
  $('chatlog').innerHTML = '';
  chat(`${G.world.name}에 오신 것을 환영해요! (${G.mode === 'creative' ? '크리에이티브' : '서바이벌'})`, '#ff5');
  if (G.fresh && G.mode === 'survival') { chat('팁: 나무를 꾹 눌러 캐서 원목을 얻고, 가방(E)에서 판자 → 작업대를 만들어 보세요.', '#ddd'); chat('밤이 되면 몬스터가 나타나요. 해가 지기 전에 은신처와 횃불을 준비하세요!', '#ddd'); }
  else if (G.fresh) chat('팁: E 또는 가방 버튼으로 모든 블록을 꺼낼 수 있어요. 스페이스 두 번으로 비행!', '#ddd');
  persist();
  capture();
}
function quitToTitle() {
  persist();
  if (W) for (const ch of W.chunks.values()) freeChunkGL(ch);
  G = null; W = null; P = null; lastChunk = null; cursorStack = null;
  releasePointer(); ctx.setPaused(false);
  showTitle();
}

// ─────────────────────────── chunk streaming ───────────────────────────
function neighborsGenerated(ch) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && !getChunk(ch.cx + dx, ch.cz + dz)) return false; return true; }
function updateChunks(budget) {
  const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, R = SAVE.settings.renderDist;
  const sig = pcx + ',' + pcz + ',' + R;
  if (sig !== lastPc) {
    lastPc = sig; wantList = [];
    for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) { const d = Math.hypot(dx, dz); if (d <= R + 1.5) wantList.push([dx, dz, d]); }
    wantList.sort((a, b) => a[2] - b[2]);
    for (const [k, ch] of W.chunks) if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 3) { freeChunkGL(ch); W.chunks.delete(k); if (lastChunk === ch) lastChunk = null; }
  }
  // edits first, regardless of budget
  for (const ch of W.chunks.values()) if (ch.urgent && ch.needLight) lightChunk(ch);
  for (const ch of W.chunks.values()) if (ch.urgent && ch.needMesh && ch.mesh !== undefined && neighborsGenerated(ch)) { uploadMesh(ch, meshChunk(ch)); }
  const t0 = performance.now();
  for (const [dx, dz, d] of wantList) {
    if (performance.now() - t0 > budget) break;
    const cx = pcx + dx, cz = pcz + dz;
    let ch = getChunk(cx, cz);
    if (!ch) { ch = generateChunk(cx, cz); W.chunks.set(ckey(cx, cz), ch); continue; }
    if (d > R + 0.5) continue;
    if ((ch.needLight || ch.needMesh) && neighborsGenerated(ch)) { if (ch.needLight) lightChunk(ch); uploadMesh(ch, meshChunk(ch)); }
  }
}
function loadProgress() {
  const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4; let ok = 0, total = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { total++; const c = getChunk(pcx + dx, pcz + dz); if (c && c.mesh) ok++; }
  return ok / total;
}

// ─────────────────────────── simulation ───────────────────────────
let tickAcc = 0, tickN = 0;
function updateSky() {
  const tt = (W.time % DAY_TICKS) / DAY_TICKS, ang = tt * Math.PI * 2, sunY = Math.sin(ang);
  W.sunAng = ang; W.sunY = sunY;
  W.daylight = clamp(0.5 + sunY * 2.2, 0.2, 1);
  W.skyLevel = Math.round(clamp((W.daylight - 0.16) / 0.84, 0, 1) * 11 + 4);
}
function furnaceTick(k, te) {
  const [inp, fuel, out] = te.slots, res = inp && SMELT[inp.id];
  const canOut = res && (!out || (out.id === res && out.count < maxStack(res)));
  const wasLit = te.burn > 0;
  if (te.burn > 0) te.burn -= TICK;
  if (te.burn <= 0 && canOut && fuel && FUEL[fuel.id]) { te.burnMax = te.burn = FUEL[fuel.id]; fuel.count--; if (!fuel.count) te.slots[1] = fuel.id === WATER_BUCKET ? { id: BUCKET, count: 1 } : null; }
  if (te.burn > 0 && canOut) { te.cook += TICK; if (te.cook >= SMELT_TIME) { te.cook = 0; inp.count--; if (!inp.count) te.slots[0] = null; if (out) out.count++; else te.slots[2] = { id: res, count: 1, dmg: 0 }; } }
  else te.cook = Math.max(0, te.cook - TICK * 2);
  if (te.burn < 0) te.burn = 0;
  if (wasLit !== te.burn > 0) { const [x, , z] = k.split(',').map(Number); const ch = getChunk(x >> 4, z >> 4); if (ch) { ch.needMesh = true; ch.urgent = true; } }
}
function gameTick() {
  tickN++;
  if (W.gravQ.size) { const q = [...W.gravQ]; W.gravQ.clear(); for (let i = 0; i < Math.min(q.length, 3000); i++) { const [x, y, z] = q[i].split(',').map(Number); gravityUpdate(x, y, z); } }
  if (tickN % 5 === 0 && W.fluidQ.size) { const q = [...W.fluidQ]; W.fluidQ.clear(); for (let i = 0; i < q.length; i++) { if (i > 4000) { W.fluidQ.add(q[i]); continue; } const [x, y, z] = q[i].split(',').map(Number); fluidUpdate(x, y, z); } }
  randomTicks(P.x, P.z);
  for (const [k, te] of W.te) if (te.type === 'furnace' && (te.burn > 0 || te.slots[0])) furnaceTick(k, te);
  if (G.uiKind === 'furnace' && tickN % 4 === 0) renderSlots();
}
function step(dt) {
  W.time += dt * DAY_TICKS / DAY_SECONDS;
  updateSky();
  updatePlayer(dt); updateInteraction(dt); updateSurvival(dt);
  tickAcc += dt; while (tickAcc >= TICK) { tickAcc -= TICK; gameTick(); }
  updateMobs(dt); updateItems(dt); updateParticles(dt); updateTNT(dt); spawnLogic(dt);
  shake = Math.max(0, shake - dt * 2);
  music(dt);
}

// ─────────────────────────── frame rendering ───────────────────────────
const CLOUDS = new DynBuilder(), LINES = new Float32Array(24 * 9);
let fov = 75;
function render(dt) {
  const w = canvas.width, h = canvas.height; gl.viewport(0, 0, w, h);
  const R = SAVE.settings.renderDist, far = (R + 1) * CS;
  const sunY = W.sunY, dl = W.daylight;
  const day = [0.53, 0.74, 0.98], night = [0.015, 0.02, 0.06], dusk = [0.95, 0.52, 0.28];
  let sky = mix(night, day, clamp((dl - 0.16) / 0.84, 0, 1));
  const duskK = clamp(1 - Math.abs(sunY) * 4, 0, 1) * 0.6; sky = mix(sky, dusk, duskK * clamp(dl, 0.3, 1));
  let fogC = sky, fogR = [far * 0.55, far];
  if (P.eyeInWater) { fogC = mul([0.05, 0.12, 0.36], Math.max(0.3, dl)); fogR = [0, 22]; }
  gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // camera
  const sp = Math.hypot(P.vx, P.vz);
  const bobA = SAVE.settings.bob && P.onGround && !P.flying ? Math.min(1, sp / 4) : 0;
  const bx = Math.cos(P.bob * 1.6) * 0.05 * bobA, by = Math.abs(Math.sin(P.bob * 1.6)) * 0.07 * bobA;
  const sh = shake > 0 ? [(Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3] : [0, 0];
  const eye = [P.x + Math.cos(P.yaw) * bx + sh[0], P.y + eyeHeight() + by + sh[1], P.z + Math.sin(P.yaw) * bx];
  const targetFov = SAVE.settings.fov * (P.sprinting ? 1.12 : 1) * (P.flying && P.sprinting ? 1.05 : 1);
  fov += (targetFov - fov) * Math.min(1, dt * 8);
  const proj = perspective(fov * Math.PI / 180, w / Math.max(1, h), 0.05, far + 60);
  const view = viewMatrix(eye, P.yaw, P.pitch), vp = mat4mul(proj, view), planes = frustumPlanes(vp);
  gl.useProgram(prog); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uEye, eye);
  const tint = mix([0.55, 0.62, 1.0], [1, 1, 1], clamp((dl - 0.16) / 0.5, 0, 1));
  gl.uniform3fv(U.uSkyTint, tint); gl.uniform1f(U.uTime, performance.now() / 1000); gl.uniform1f(U.uMin, 0.045); gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uWater, 0);
  // sky objects
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.uniform1f(U.uBlend, 1); gl.uniform1f(U.uSky, 1); gl.uniform3fv(U.uFog, fogC); gl.uniform2f(U.uFogR, 1e5, 1e5 + 1);
  gl.uniform3f(U.uOffset, eye[0], eye[1], eye[2]); gl.uniform1f(U.uScale, 1);
  if (!P.eyeInWater) {
    SKY.reset();
    const ca = Math.cos(W.sunAng), sa = Math.sin(W.sunAng);
    const disc = (dir, size, tile, b) => { const c = [dir[0] * 100, dir[1] * 100, dir[2] * 100]; const u = [-dir[1], dir[0], 0], v = [0, 0, 1]; const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, bb]) => [c[0] + (u[0] * a + v[0] * bb) * size, c[1] + (u[1] * a + v[1] * bb) * size, c[2] + (u[2] * a + v[2] * bb) * size]); SKY.quad(p, [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)], 1, 1, b); };
    const nightK = clamp(1 - (dl - 0.16) / 0.5, 0, 1);
    if (nightK > 0.05) { const r = mulberry32(5); for (let i = 0; i < 160; i++) { let x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; const L = Math.hypot(x, y, z); x /= L; y /= L; z /= L; const rx = x * ca - y * sa, ry = x * sa + y * ca; if (ry < -0.05) continue; disc([rx, ry, z], 0.25 + r() * 0.25, T.white, nightK * 0.9); } }
    disc([ca, sa, 0], 9, T.sun, 1); disc([-ca, -sa, 0], 7, T.moon, 0.95);
    SKY.draw();
  }
  // opaque terrain
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.uniform1f(U.uBlend, 0); gl.uniform1f(U.uSky, dl); gl.uniform2f(U.uFogR, fogR[0], fogR[1]); gl.uniform1f(U.uScale, 1 / 64);
  const visible = [];
  for (const ch of W.chunks.values()) {
    if (!ch.mesh) continue;
    const x0 = ch.cx * CS, z0 = ch.cz * CS;
    if (!boxVisible(planes, x0, 0, z0, x0 + CS, WH, z0 + CS)) continue;
    visible.push(ch);
    if (ch.oq) { gl.uniform3f(U.uOffset, x0, 0, z0); drawChunkBuffer(ch.vbo, ch.oq); }
  }
  // entities
  gl.disable(gl.CULL_FACE); gl.uniform1f(U.uScale, 1);
  const o = [Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])]; gl.uniform3f(U.uOffset, o[0], o[1], o[2]);
  DYN.reset();
  const right = [Math.cos(P.yaw), 0, Math.sin(P.yaw)], fwd = lookDir();
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  drawMobs(DYN, o[0], o[1], o[2]); drawItems(DYN, o[0], o[1], o[2]); drawParticles(DYN, o[0], o[1], o[2], right, [-up[0], -up[1], -up[2]]);
  DYN.draw();
  // block outline
  const t = G.target;
  if (t && !G.ui && !G.targetMob) {
    const lo = -0.002, hi = 1.002, x = t.x - o[0], y = t.y - o[1], z = t.z - o[2];
    const b = BLOCK[t.id]; let y1 = hi; if (b && b.render === 'torch') y1 = 0.65; if (b && b.render === 'water') y1 = 0.9;
    const c = [[lo, lo, lo], [hi, lo, lo], [hi, y1, lo], [lo, y1, lo], [lo, lo, hi], [hi, lo, hi], [hi, y1, hi], [lo, y1, hi]];
    const uv = uvOf(T.black, 0.5, 0.5); let n = 0;
    for (const [a, bb] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) for (const k of [a, bb]) { LINES.set([x + c[k][0], y + c[k][1], z + c[k][2], uv[0], uv[1], 1, 1, 0.35, 0], n); n += 9; }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo); gl.bufferData(gl.ARRAY_BUFFER, LINES, gl.STREAM_DRAW); bindDynAttribs(0); gl.drawArrays(gl.LINES, 0, 24);
  }
  // translucent: water/ice, cracks, clouds
  gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(U.uBlend, 1);
  visible.sort((a, b) => Math.hypot(b.cx * CS + 8 - eye[0], b.cz * CS + 8 - eye[2]) - Math.hypot(a.cx * CS + 8 - eye[0], a.cz * CS + 8 - eye[2]));
  gl.uniform1f(U.uScale, 1 / 64); gl.uniform1f(U.uWater, 1);
  for (const ch of visible) if (ch.wq) { gl.uniform3f(U.uOffset, ch.cx * CS, 0, ch.cz * CS); drawChunkBuffer(ch.wvbo, ch.wq); }
  gl.uniform1f(U.uWater, 0); gl.uniform1f(U.uScale, 1); gl.uniform3f(U.uOffset, o[0], o[1], o[2]);
  if (P.mining && P.mining.p > 0) {
    DYNB.reset();
    const m = P.mining, stage = clamp(Math.floor(m.p * 10), 0, 9), tile = T['crack_' + stage];
    const [s, bl] = lightAt(m.x, m.y + 1, m.z), e = 0.004;
    box(DYNB, [-e, -e, -e], [1 + e, 1 + e, 1 + e], [tile, tile, tile, tile, tile, tile], p => [m.x - o[0] + p[0], m.y - o[1] + p[1], m.z - o[2] + p[2]], Math.max(s, 0.6), bl);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1); DYNB.draw(); gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  if (!P.eyeInWater) {
    CLOUDS.reset();
    const cy = WH + 30, cs = 12, drift = (W.time / 20) * 0.6, span = Math.ceil(far * 1.4 / cs);
    const bx0 = Math.floor((eye[0] - drift) / cs), bz0 = Math.floor(eye[2] / cs), uv = uvOf(T.white, 0.5, 0.5), U4 = [uv, uv, uv, uv];
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const gx = bx0 + i, gz = bz0 + j; if (W.noise.n2(gx * 0.21 + 100.5, gz * 0.21) < 0.12) continue;
      const x0 = gx * cs + drift - o[0], z0 = gz * cs - o[2], y = cy - o[1];
      CLOUDS.quad([[x0, y, z0 + cs], [x0 + cs, y, z0 + cs], [x0 + cs, y, z0], [x0, y, z0]], U4, 1, 0, 1);
    }
    gl.uniform2f(U.uFogR, far * 0.8, far * 1.8); gl.uniform1f(U.uAlpha, 0.78); CLOUDS.draw(); gl.uniform1f(U.uAlpha, 1);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
  // first-person hand
  if (!G.ui || G.ui === 'chat' || G.ui === 'inventory' || G.ui === 'creative' || G.ui === 'table' || G.ui === 'container') drawHand(w, h, dt);
}
let handLower = 0, lastHeld = -1;
function drawHand(w, h) {
  if (P.dead) return;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const proj = perspective(70 * Math.PI / 180, w / Math.max(1, h), 0.01, 10);
  gl.uniformMatrix4fv(U.uVP, false, proj); gl.uniform3f(U.uEye, 0, 0, 0); gl.uniform3f(U.uOffset, 0, 0, 0); gl.uniform2f(U.uFogR, 1e5, 1e5 + 1); gl.uniform1f(U.uBlend, 0);
  HAND.reset();
  const [sky, blk] = lightAt(P.x, P.y + eyeHeight(), P.z);
  const s = held(), id = s ? s.id : 0;
  if (id !== lastHeld) { handLower = 1; lastHeld = id; }
  handLower = Math.max(0, handLower - 0.08);
  const sw = Math.sin(P.swing * Math.PI), sw2 = Math.sin(Math.sqrt(P.swing) * Math.PI);
  const sp = Math.hypot(P.vx, P.vz), bobA = SAVE.settings.bob && P.onGround ? Math.min(1, sp / 4) : 0;
  const bx = Math.cos(P.bob * 1.6) * 0.03 * bobA, by = -Math.abs(Math.sin(P.bob * 1.6)) * 0.03 * bobA;
  const eatB = P.eating > 0 ? Math.sin(P.eating * 18) * 0.03 : 0;
  const base = [0.56 + bx - sw2 * 0.18 - (P.eating > 0 ? 0.3 : 0), -0.52 + by - handLower * 0.5 + sw2 * 0.12 + eatB + (P.eating > 0 ? 0.2 : 0), -0.82 - sw * 0.1];
  const rotY = -0.6 + sw * 0.4, rotX = -sw2 * 0.8;
  const xf = p => {
    let [x, y, z] = p;
    const c1 = Math.cos(rotX), s1 = Math.sin(rotX); [y, z] = [y * c1 - z * s1, y * s1 + z * c1];
    const c2 = Math.cos(rotY), s2 = Math.sin(rotY); [x, z] = [x * c2 + z * s2, -x * s2 + z * c2];
    return [x + base[0], y + base[1], z + base[2]];
  };
  const b = id && id < 256 ? BLOCK[id] : null;
  if (b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent')) box(HAND, [-0.2, -0.2, -0.2], [0.2, 0.2, 0.2], blockTiles(id), xf, sky, blk);
  else if (id) {
    const tile = b ? T[b.tex] : T[ITEM[id].icon], q = 0.34;
    const pts = [[-q, -q, 0], [q, -q, 0], [q, q, 0], [-q, q, 0]].map(p => { const r = 0.7, c = Math.cos(r), sn = Math.sin(r); return xf([p[0] * c - p[1] * sn * 0, p[1], p[0] * sn]); });
    HAND.quad(pts, [uvOf(tile, 0, 1), uvOf(tile, 1, 1), uvOf(tile, 1, 0), uvOf(tile, 0, 0)], sky, blk, 1);
  } else {
    const at = T.player_arm, six = [at, at, at, at, at, at];
    box(HAND, [-0.09, -0.09, -0.15], [0.09, 0.09, 0.55], six, p => { const q = xf([p[0], p[1], p[2]]); return [q[0] + 0.12, q[1] - 0.08, q[2] + 0.1]; }, sky, blk);
  }
  gl.disable(gl.CULL_FACE); HAND.draw();
}

// ─────────────────────────── input ───────────────────────────
let expectUnlock = false, lastUnlock = 0, sprintTap = false, showDebug = false;
function capture() {
  if (!canvas || isTouch() || !G || G.ui) return;
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { }
  canvas.focus();
}
function releasePointer() { if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); } }
function refreshMove() {
  if (isTouch() && !keys.KeyW && !keys.KeyS && !keys.KeyA && !keys.KeyD && !keys.ArrowUp && !keys.ArrowDown && !keys.ArrowLeft && !keys.ArrowRight && input.joy) return;
  input.fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  input.side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  input.jump = !!keys.Space; input.sneak = !!(keys.ShiftLeft || keys.ShiftRight) || touchSneak;
  input.sprintKey = !!(keys.ControlLeft || keys.ControlRight) || sprintTap;
}
function dropItem(all) {
  const s = held(); if (!s) return;
  const n = all ? s.count : 1, d = lookDir();
  spawnItem(s.id, n, P.x + d[0] * 0.5, P.y + eyeHeight() - 0.3, P.z + d[2] * 0.5, s.dmg, [d[0] * 5, d[1] * 5 + 2, d[2] * 5]);
  W.items[W.items.length - 1].pick = 1.5;
  if (G.mode === 'survival') { s.count -= n; if (s.count <= 0) G.inv[G.sel] = null; }
  invChanged();
}
function pickBlock() {
  const t = G.target; if (!t) return;
  let id = t.id; if (isWater(id)) return; if (id === GRASS || id === SNOW_GRASS) id = id;
  const i = G.inv.findIndex(s => s && s.id === id);
  if (i >= 0 && i < 9) G.sel = i;
  else if (G.mode === 'creative') G.inv[G.sel] = { id, count: 64, dmg: 0 };
  else if (i >= 9) { const tmp = G.inv[G.sel]; G.inv[G.sel] = G.inv[i]; G.inv[i] = tmp; }
  invChanged();
}
function bindInput() {
  const playKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab', 'F3', 'Slash', 'KeyQ', 'KeyE', 'KeyF', 'ControlLeft'];
  ctx.on(window, 'keydown', e => {
    if (!G || G.loading) return;
    if (G.ui === 'chat' || (e.target && e.target.tagName === 'INPUT')) return;
    if (playKeys.includes(e.code) || /^Digit/.test(e.code)) e.preventDefault();
    const c = e.code;
    if (c === 'Escape') {
      if (performance.now() - lastUnlock < 350) return;
      if (G.ui === 'pause') menuAction('resume');
      else if (G.ui === 'settings' || G.ui === 'help') showPause();
      else if (G.ui === 'death' || G.ui === 'title') { }
      else if (G.ui) closeScreen();
      else showPause();
      return;
    }
    if (c === 'KeyE' && !e.repeat) { if (['inventory', 'creative', 'table', 'container'].includes(G.ui)) closeScreen(); else if (!G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); return; }
    if (G.ui) return;
    if (c === 'KeyW' && !e.repeat) { const n = performance.now(); if (n - P.lastFwd < 280) sprintTap = true; P.lastFwd = n; }
    if (c === 'Space' && !e.repeat && G.mode === 'creative') { const n = performance.now(); if (n - P.lastJump < 300) { P.flying = !P.flying; P.vy = 0; P.lastJump = 0; } else P.lastJump = n; }
    keys[c] = true; refreshMove();
    if (/^Digit[1-9]$/.test(c)) { G.sel = +c.slice(5) - 1; invChanged(); }
    if (c === 'KeyQ' && !e.repeat) dropItem(e.ctrlKey);
    if ((c === 'KeyT' || c === 'Enter') && !e.repeat) { keys[c] = false; openChat(''); }
    if (c === 'Slash' && !e.repeat) { keys[c] = false; openChat('/'); }
    if (c === 'F3' && !e.repeat) { showDebug = !showDebug; $('debug').style.display = showDebug ? 'block' : 'none'; }
    if (c === 'KeyF' && !e.repeat && G.mode === 'creative') { P.flying = !P.flying; P.vy = 0; }
  });
  ctx.on(window, 'keyup', e => { delete keys[e.code]; if (e.code === 'KeyW') sprintTap = false; refreshMove(); });
  ctx.on(window, 'blur', () => { for (const k in keys) delete keys[k]; sprintTap = false; refreshMove(); input.mine = input.use = false; });
  ctx.on(canvas, 'contextmenu', e => e.preventDefault());
  ctx.on(canvas, 'mousedown', e => {
    if (!G || G.ui || G.loading) return;
    wake();
    if (document.pointerLockElement !== canvas) { capture(); if (isTouch()) return; }
    e.preventDefault();
    if (e.button === 0) { input.mine = true; P.attackCd = 0; P.mineCd = 0; }
    else if (e.button === 2) { input.use = true; P.useCd = 0; }
    else if (e.button === 1) pickBlock();
  });
  ctx.on(document, 'mouseup', e => { if (e.button === 0) input.mine = false; if (e.button === 2) input.use = false; });
  ctx.on(document, 'mousemove', e => {
    if (!G || G.ui || !P) return;
    const k = 0.0022 * SAVE.settings.sens / 8;
    if (document.pointerLockElement === canvas) { P.yaw += e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.55, 1.55); }
    else if (e.buttons && !isTouch() && e.target === canvas) { P.yaw += e.movementX * k * 1.6; P.pitch = clamp(P.pitch - e.movementY * k * 1.6, -1.55, 1.55); }
  });
  ctx.on(canvas, 'wheel', e => { e.preventDefault(); if (!G || G.ui) return; G.sel = (G.sel + (e.deltaY > 0 ? 1 : 8)) % 9; invChanged(); }, { passive: false });
  ctx.on(document, 'pointerlockchange', () => {
    if (document.pointerLockElement === canvas) return;
    lastUnlock = performance.now();
    input.mine = input.use = false;
    if (expectUnlock) { expectUnlock = false; return; }
    if (G && !G.ui && !G.loading) showPause();
  });
  ctx.on(document, 'visibilitychange', () => { if (document.hidden) { if (G && !G.ui && !G.loading) showPause(); persist(); } });
  ctx.on(canvas, 'webglcontextlost', e => { e.preventDefault(); ctx.reportError(Error('3D 그래픽 연결이 끊겼습니다. 다시 시작해 주세요.')); });
}

// ─────────────────────────── main loop ───────────────────────────
let raf = 0, last = 0, disposed = false, fpsAcc = 0, fpsN = 0, fpsShow = 0, autosave = 45;
function frame(now) {
  if (disposed) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (settingsTimer > 0) { settingsTimer -= dt; if (settingsTimer <= 0) persist(); }
  if (!G || !W) { gl.clearColor(0.08, 0.06, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  if (G.loading) {
    updateSky(); updateChunks(28);
    const p = loadProgress(); showLoading(p);
    if (p >= 1) finishLoading();
    else { gl.clearColor(0.08, 0.06, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  }
  const paused = G.ui === 'pause' || G.ui === 'settings' || G.ui === 'help';
  if (!paused) { let left = dt; while (left > 1e-4) { const s = Math.min(left, 0.05); step(s); left -= s; } }
  if (saveTimer > 0) { saveTimer -= dt; if (saveTimer <= 0) persist(); }
  if (!paused) { autosave -= dt; if (autosave <= 0) { autosave = 45; persist(); } }
  updateChunks(paused ? 3 : 6);
  render(dt);
  updateHUD(dt);
  if (showDebug) {
    const bx = Math.floor(P.x), bz = Math.floor(P.z), ch = getChunk(bx >> 4, bz >> 4), l = getLight(bx, Math.floor(P.y + 1), bz);
    const biome = ch ? BIOME_NAME[ch.biomes[(bz & 15) * CS + (bx & 15)]] : '?';
    const tday = Math.floor(W.time % DAY_TICKS);
    $('debug').textContent = `Minecraft Mini  ${fpsShow} fps\nXYZ ${P.x.toFixed(2)} / ${P.y.toFixed(2)} / ${P.z.toFixed(2)}\n청크 ${bx >> 4}, ${bz >> 4}  로드 ${W.chunks.size}\n바이옴 ${biome}  빛 하늘 ${l >> 4} 블록 ${l & 15}\n시간 ${tday} (${dayCount()}일째)  몹 ${W.mobs.length}  아이템 ${W.items.length}\n시드 ${G.world.seedText}`;
  }
}
function resize() {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(window.devicePixelRatio || 1, isTouch() ? 1.25 : 1.5);
  canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
}

window.GameHub.registerGame({
  id: 7,
  async mount(container, context) {
    root = container; ctx = context; muted = ctx.muted;
    buildDOM();
    buildAtlas(); prepareBlockTables(); buildIcons(); await applyGeneratedItemIcons();
    initGL(canvas);
    const dc = document.createElement('canvas'); dc.width = dc.height = 16; const dg = dc.getContext('2d'); const di = T.dirt; dg.drawImage(atlasCanvas, (di % TPR) * TS, Math.floor(di / TPR) * TS, 16, 16, 0, 0, 16, 16);
    const dirtURL = dc.toDataURL();
    const st = document.createElement('style'); st.textContent = `.screen.dirt{background:linear-gradient(#000a,#000a),url(${dirtURL}) 0 0/64px 64px;image-rendering:pixelated}`; root.append(st);
    loadSave();
    screenEvents(); touchEvents(); bindInput();
    const ro = new ResizeObserver(resize); ro.observe(canvas); ctx.onCleanup(() => ro.disconnect()); resize();
    showTitle();
    last = performance.now(); raf = requestAnimationFrame(frame);
  },
  pause() { if (G && !G.loading && (!G.ui || G.ui === 'chat' || ['inventory', 'creative', 'table', 'container'].includes(G.ui))) { if (G.ui && G.ui !== 'chat') closeScreen(); else if (G.ui === 'chat') closeChat(); showPause(); } if (audio) audio.suspend().catch(() => { }); persist(); },
  resume() { if (audio && !muted) audio.resume().catch(() => { }); if (G && G.ui === 'pause') { hideScreens(); G.ui = null; toast('화면을 클릭하면 다시 조작할 수 있어요.'); } },
  setMuted(v) { muted = v; if (!v) wake(); else if (audio) audio.suspend().catch(() => { }); },
  unmount() {
    try { persist(); } catch { }
    disposed = true; cancelAnimationFrame(raf);
    if (document.pointerLockElement) document.exitPointerLock();
    try { audio && audio.close(); } catch { }
    try { if (W) for (const ch of W.chunks.values()) freeChunkGL(ch); const ext = gl && gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); } catch { }
    root.replaceChildren();
  },
});
})();
