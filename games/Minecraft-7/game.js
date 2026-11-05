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
  STRING = 289, BUCKET = 290, WATER_BUCKET = 291, FLINT = 292, FLINT_STEEL = 293, MELON_SLICE = 294, BREAD = 295,
  LEATHER = 296, SHEARS = 297, BOW = 298, ARROW = 299, COMPASS = 300, CLOCK = 301,
  ARMOR0 = 310; // 310..325 = 4 materials × [helmet, chestplate, leggings, boots]
const BED = 61;
const CHERRY_PLANKS=62, DEEPSLATE=63, COPPER_ORE=64, AMETHYST_BLOCK=65, NETHER_BRICKS=66, END_STONE=67, TERRACOTTA=68, GRANITE=69, DIORITE=70, ANDESITE=71, COPPER_BLOCK=72, OXIDIZED_COPPER=73, DARK_OAK_PLANKS=74, BIRCH_PLANKS=75, EMERALD_ORE=76, LAPIS_ORE=77;
const EMERALD=302, LAPIS=303, COPPER_INGOT=304, AMETHYST_SHARD=305;
const CHERRY_LOG=78, DARK_OAK_LOG=79, MANGROVE_LOG=80, BAMBOO_BLOCK=81, BARREL=82, BASALT=83, QUARTZ_PILLAR=84, CHERRY_LEAVES=85, MANGROVE_PLANKS=86, BAMBOO_PLANKS=87, PRISMARINE=88, DARK_PRISMARINE=89, SEA_LANTERN=90, NETHERRACK=91, SOUL_SAND=92, BLACKSTONE=93, TUFF=94, CALCITE=95, DRIPSTONE=96, MOSS_BLOCK=97, MUD=98, PACKED_ICE=99, RED_SAND=100;
const GOLDEN_APPLE=326, CARROT=327, POTATO=328, BAKED_POTATO=329, BEETROOT=330, QUARTZ=331, REDSTONE=332, PRISMARINE_SHARD=333;
const NEW_FACE_TILES=['cherry_log_side','cherry_log_top','dark_oak_log_side','dark_oak_log_top','mangrove_log_side','mangrove_log_top','bamboo_side','bamboo_top','barrel_side','barrel_top','melon_side_v2','melon_top_v2','basalt_side','basalt_top','quartz_side','quartz_top'];
const NEW_BLOCK_TILES=['cherry_leaves','mangrove_planks','bamboo_planks','prismarine','dark_prismarine','sea_lantern','netherrack','soul_sand','blackstone','tuff','calcite','dripstone','moss_block','mud','packed_ice','red_sand'];
const EXTRA_TEXTURES=['cherry_planks','deepslate','copper_ore','amethyst_block','nether_bricks','end_stone','terracotta','granite','diorite','andesite','copper_block','oxidized_copper','dark_oak_planks','birch_planks','emerald_ore','lapis_ore'];

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
B(LEAVES, '참나무 잎', 'leaves', { opaque: false, render: 'cutout', hard: 0.2, tool: 'shears', drop: r => { const v = r(); return v < 0.06 ? SAPLING : v < 0.085 ? APPLE : 0; } });
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
B(SPRUCE_LEAVES, '가문비나무 잎', 'spruce_leaves', { opaque: false, render: 'cutout', hard: 0.2, tool: 'shears', drop: r => r() < 0.05 ? SAPLING : 0 });
B(BIRCH_LOG, '자작나무 원목', { top: 'log_top', bottom: 'log_top', side: 'birch_log' }, { hard: 2, tool: 'axe' });
B(BIRCH_LEAVES, '자작나무 잎', 'birch_leaves', { opaque: false, render: 'cutout', hard: 0.2, tool: 'shears', drop: r => r() < 0.05 ? SAPLING : 0 });
B(GLOWSTONE, '발광석', 'glowstone', { hard: 0.3, light: 15, cat: '장식' });
B(TNT, 'TNT', { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, { hard: 0, use: 'tnt', cat: '기능' });
for (let l = 0; l < 8; l++) B(WATER + l, l ? '흐르는 물' : '물', 'water', { solid: false, opaque: false, render: 'water', hard: -1, drop: 0, replaceable: true, creative: false, fluid: true, level: l });
WOOL_COLORS.forEach(([n], i) => B(COLOR_WOOL + i, n + ' 양털', 'wool_' + i, { hard: 0.8, cat: '장식' }));
B(MOSSY, '이끼 낀 조약돌', 'mossy', { hard: 2, tool: 'pickaxe', tier: 1 });
B(OBSIDIAN, '흑요석', 'obsidian', { hard: 50, tool: 'pickaxe', tier: 4 });
B(BOOKSHELF, '책장', { top: 'planks', bottom: 'planks', side: 'bookshelf' }, { hard: 1.5, tool: 'axe', drop: PLANKS, cat: '장식' });
B(PUMPKIN, '호박', { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, { hard: 1, tool: 'axe', cat: '장식' });
B(MELON, '수박', { top: 'melon_top_v2', bottom: 'melon_top_v2', side: 'melon_side_v2' }, { hard: 1, tool: 'axe', drop: () => MELON_SLICE, dropCount: r => 3 + Math.floor(r() * 5), cat: '장식' });
B(BED, '침대', { top: 'bed_top', bottom: 'planks', side: 'bed_side' }, { opaque: false, render: 'bed', hard: 0.2, tool: 'axe', use: 'bed', cat: '기능', height: 9 / 16 });
[
 [CHERRY_PLANKS,'벚나무 판자','axe'], [DEEPSLATE,'심층암','pickaxe'], [COPPER_ORE,'구리 광석','pickaxe'], [AMETHYST_BLOCK,'자수정 블록','pickaxe'], [NETHER_BRICKS,'네더 벽돌','pickaxe'], [END_STONE,'엔드 돌','pickaxe'], [TERRACOTTA,'테라코타','pickaxe'], [GRANITE,'화강암','pickaxe'], [DIORITE,'섬록암','pickaxe'], [ANDESITE,'안산암','pickaxe'], [COPPER_BLOCK,'구리 블록','pickaxe'], [OXIDIZED_COPPER,'산화된 구리','pickaxe'], [DARK_OAK_PLANKS,'짙은 참나무 판자','axe'], [BIRCH_PLANKS,'자작나무 판자','axe'], [EMERALD_ORE,'에메랄드 광석','pickaxe'], [LAPIS_ORE,'청금석 광석','pickaxe']
].forEach(([id,name,tool],i)=> B(id,name,EXTRA_TEXTURES[i],{hard:1.5,tool,tier:tool==='pickaxe'?1:0, ...(id===EMERALD_ORE?{tier:3,drop:EMERALD}:id===LAPIS_ORE?{tier:2,drop:LAPIS}: {})}));
[
 [CHERRY_LOG,'벚나무 원목','cherry_log_side','cherry_log_top','axe'],[DARK_OAK_LOG,'짙은 참나무 원목','dark_oak_log_side','dark_oak_log_top','axe'],[MANGROVE_LOG,'맹그로브나무 원목','mangrove_log_side','mangrove_log_top','axe'],[BAMBOO_BLOCK,'대나무 블록','bamboo_side','bamboo_top','axe'],[BARREL,'통','barrel_side','barrel_top','axe'],[BASALT,'현무암','basalt_side','basalt_top','pickaxe'],[QUARTZ_PILLAR,'석영 기둥','quartz_side','quartz_top','pickaxe']
].forEach(([id,name,side,top,tool])=>B(id,name,{top,bottom:top,side},{hard:2,tool,tier:tool==='pickaxe'?1:0,...(id===BARREL?{use:'chest',facing:true,cat:'기능'}:{})}));
const addedNames=['벚나무 잎','맹그로브나무 판자','대나무 판자','프리즈머린','짙은 프리즈머린','바다 랜턴','네더랙','영혼 모래','흑암','응회암','방해석','점적석 블록','이끼 블록','진흙','꽁꽁 언 얼음','붉은 모래'];
addedNames.forEach((name,i)=>B(CHERRY_LEAVES+i,name,NEW_BLOCK_TILES[i],{hard:1.5,tool:[0,1,2].includes(i)?'axe':'pickaxe',tier:0,...(i===0?{opaque:false,render:'cutout',tool:'shears'}:{}),...(i===5?{light:15}:{}),...(i===14?{opaque:false,render:'translucent',slippery:true}:{}),...(i===15?{tool:'shovel',gravity:true}: {})}));
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
// attack damage / attacks per second per tier (wood, stone, iron, gold, diamond), as in the original
const WEAPON_STATS = { sword: [SWORD_DMG, [1.6, 1.6, 1.6, 1.6, 1.6]], axe: [[7, 9, 9, 7, 9], [0.8, 0.8, 0.9, 1, 1]], pickaxe: [[2, 3, 4, 2, 5], [1.2, 1.2, 1.2, 1.2, 1.2]], shovel: [[2.5, 3.5, 4.5, 2.5, 5.5], [1, 1, 1, 1, 1]] };
I(GOLDEN_APPLE,'황금 사과','golden_apple',{cat:'음식',food:[4,9.6]}); I(CARROT,'당근','carrot',{cat:'음식',food:[3,3.6]}); I(POTATO,'감자','potato',{cat:'음식',food:[1,0.6]}); I(BAKED_POTATO,'구운 감자','baked_potato',{cat:'음식',food:[5,6]}); I(BEETROOT,'비트','beetroot',{cat:'음식',food:[1,1.2]}); I(QUARTZ,'네더 석영','quartz_item'); I(REDSTONE,'레드스톤 가루','redstone_item'); I(PRISMARINE_SHARD,'프리즈머린 조각','prismarine_shard');
I(EMERALD, '에메랄드', 'emerald'); I(LAPIS, '청금석', 'lapis'); I(COPPER_INGOT, '구리 주괴', 'copper_ingot'); I(AMETHYST_SHARD, '자수정 조각', 'amethyst_shard');
I(STICK, '막대기', 'stick'); I(COAL, '석탄', 'coal'); I(IRON, '철 주괴', 'iron_ingot'); I(GOLD, '금 주괴', 'gold_ingot'); I(DIAMOND, '다이아몬드', 'diamond');
TIERS.forEach((t, i) => {
  I(PICK0 + i, t.name + ' 곡괭이', 'pickaxe_' + i, { stack: 1, cat: '도구', tool: { kind: 'pickaxe', level: t.level, speed: t.speed, dur: t.dur, dmg: 2 + Math.min(i, 3) * 0.5 + (i === 4 ? 1 : 0) } });
  I(AXE0 + i, t.name + ' 도끼', 'axe_' + i, { stack: 1, cat: '도구', tool: { kind: 'axe', level: t.level, speed: t.speed, dur: t.dur, dmg: SWORD_DMG[i] - 1 } });
  I(SHOVEL0 + i, t.name + ' 삽', 'shovel_' + i, { stack: 1, cat: '도구', tool: { kind: 'shovel', level: t.level, speed: t.speed, dur: t.dur, dmg: 1.5 + i * 0.4 } });
  I(SWORD0 + i, t.name + ' 검', 'sword_' + i, { stack: 1, cat: '도구', tool: { kind: 'sword', level: t.level, speed: 1.5, dur: t.dur, dmg: SWORD_DMG[i] } });
});
TIERS.forEach((t, i) => [PICK0, AXE0, SHOVEL0, SWORD0].forEach(b => { const tl = ITEM[b + i].tool, st = WEAPON_STATS[tl.kind]; tl.dmg = st[0][i]; tl.aspd = st[1][i]; }));
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
I(LEATHER, '가죽', 'leather');
I(SHEARS, '가위', 'shears', { stack: 1, cat: '도구', tool: { kind: 'shears', level: 0, speed: 5, dur: 238, dmg: 1 } });
I(BOW, '활', 'bow_0', { stack: 1, cat: '전투', tool: { kind: 'bow', level: 0, speed: 1, dur: 384, dmg: 1 } });
I(ARROW, '화살', 'arrow', { cat: '전투' });
I(COMPASS, '나침반', 'compass', { stack: 1, cat: '도구', gadget: 'compass' });
I(CLOCK, '시계', 'clock', { stack: 1, cat: '도구', gadget: 'clock' });
// armor: defence points and durability follow the original game's values
const ARMOR_MATS = [
  { key: 'leather', name: '가죽', mat: LEATHER, def: [1, 3, 2, 1], mul: 5, tough: 0, col: [152, 96, 58] },
  { key: 'gold', name: '금', mat: GOLD, def: [2, 5, 3, 1], mul: 7, tough: 0, col: [246, 208, 62] },
  { key: 'iron', name: '철', mat: IRON, def: [2, 6, 5, 2], mul: 15, tough: 0, col: [212, 212, 216] },
  { key: 'diamond', name: '다이아몬드', mat: DIAMOND, def: [3, 8, 6, 3], mul: 33, tough: 2, col: [78, 220, 208] }];
const ARMOR_PARTS = [['helmet', '투구', 11], ['chest', '흉갑', 16], ['legs', '레깅스', 15], ['boots', '부츠', 13]];
const ARMOR_SLOT_NAME = ['머리', '몸통', '다리', '발'];
ARMOR_MATS.forEach((m, mi) => ARMOR_PARTS.forEach(([pk, pn, base], pi) => I(ARMOR0 + mi * 4 + pi, m.name + ' ' + pn, 'armor_' + m.key + '_' + pk, { stack: 1, cat: '전투', armor: { slot: pi, def: m.def[pi], tough: m.tough, dur: base * m.mul, mat: mi } })));
const armorOf = id => (id >= 256 && ITEM[id] && ITEM[id].armor) || null;
const durOf = id => { const t = toolOf(id), a = armorOf(id); return (t && t.dur) || (a && a.dur) || 0; };

function info(id) {
  if (id < 256) { const b = BLOCK[id]; return b ? { id, name: b.name, stack: 64, block: b, cat: b.cat } : null; }
  return ITEM[id] || null;
}
const toolOf = id => (id >= 256 && ITEM[id] && ITEM[id].tool) || null;
const maxStack = id => (info(id) || { stack: 64 }).stack;

// ─────────────────────────── crafting ───────────────────────────
const LOGS = [LOG, SPRUCE_LOG, BIRCH_LOG];
const GROUP = { log: LOGS, planks: [PLANKS,CHERRY_PLANKS,DARK_OAK_PLANKS,BIRCH_PLANKS,MANGROVE_PLANKS,BAMBOO_PLANKS], wool: [WOOL, ...WOOL_COLORS.map((_, i) => COLOR_WOOL + i)] };
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
shaped([' I', 'I '], { I: IRON }, SHEARS);
shaped([' TS', 'T S', ' TS'], { T: STICK, S: STRING }, BOW);
shaped(['F', 'T', 'S'], { F: FLINT, T: STICK, S: STRING }, ARROW, 4);
shaped(['WWW', 'PPP'], { W: 'wool', P: 'planks' }, BED);
shaped([' I ', 'ICI', ' I '], { I: IRON, C: COAL }, COMPASS);
shaped([' G ', 'GCG', ' G '], { G: GOLD, C: COAL }, CLOCK);
ARMOR_MATS.forEach((m, mi) => {
  const M = m.mat, a = ARMOR0 + mi * 4;
  shaped(['MMM', 'M M'], { M }, a);
  shaped(['M M', 'MMM', 'MMM'], { M }, a + 1);
  shaped(['MMM', 'M M', 'M M'], { M }, a + 2);
  shaped(['M M', 'M M'], { M }, a + 3);
});
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
[[CHERRY_LOG,CHERRY_PLANKS],[DARK_OAK_LOG,DARK_OAK_PLANKS],[MANGROVE_LOG,MANGROVE_PLANKS],[BAMBOO_BLOCK,BAMBOO_PLANKS]].forEach(([a,b])=>shapeless([a],b,4));
shaped(['GGG','GAG','GGG'],{G:GOLD,A:APPLE},GOLDEN_APPLE);
shaped(['P P','PPP','P P'],{P:'planks'},BARREL);
shaped(['QQ','QQ'],{Q:QUARTZ},QUARTZ_PILLAR);
shaped(['CCC','CCC','CCC'], { C: COPPER_INGOT }, COPPER_BLOCK);
shapeless([COPPER_BLOCK], COPPER_INGOT, 9);
const SMELT = { [POTATO]: BAKED_POTATO, [COPPER_ORE]: COPPER_INGOT, [IRON_ORE]: IRON, [GOLD_ORE]: GOLD, [SAND]: GLASS, [COBBLE]: STONE, [PORK]: COOKED_PORK, [BEEF]: STEAK, [MUTTON]: COOKED_MUTTON, [CLAY]: BRICKS, [LOG]: COAL, [SPRUCE_LOG]: COAL, [BIRCH_LOG]: COAL, [CACTUS]: COLOR_WOOL + 3 };
const FUEL = { [COAL]: 80, [PLANKS]: 15, [LOG]: 15, [SPRUCE_LOG]: 15, [BIRCH_LOG]: 15, [STICK]: 5, [SAPLING]: 5, [TABLE]: 15, [CHEST]: 15, [BOOKSHELF]: 15, [BOW]: 15 };
TIERS.forEach((t, i) => { if (i === 0) [PICK0, AXE0, SHOVEL0, SWORD0].forEach(b => FUEL[b + i] = 10); });
[CHERRY_LOG,DARK_OAK_LOG,MANGROVE_LOG,BAMBOO_BLOCK,CHERRY_PLANKS,DARK_OAK_PLANKS,BIRCH_PLANKS,MANGROVE_PLANKS,BAMBOO_PLANKS].forEach(id=>FUEL[id]=15);
const SMELT_TIME = 8;

// ─────────────────────────── procedural texture atlas ───────────────────────────
const ATLAS = 512, TS = 16, TPR = ATLAS / TS;
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
  NEW_FACE_TILES.forEach(name=>tile(name,t=>t.copy('log_side')));
  NEW_BLOCK_TILES.forEach(name=>tile(name,t=>t.copy('stone')));
  [['golden_apple','apple'],['carrot','apple'],['potato','apple'],['baked_potato','apple'],['beetroot','apple'],['quartz_item','diamond'],['redstone_item','coal'],['prismarine_shard','diamond']].forEach(([name,base])=>tile(name,t=>t.copy(base)));
  EXTRA_TEXTURES.forEach((name,i)=>tile(name,t=>t.copy(i===0||i===12||i===13?'planks':i===2||i===14||i===15?'iron_ore':i===3?'obsidian':'stone')));
  [['emerald','diamond'],['lapis','diamond'],['copper_ingot','iron_ingot'],['amethyst_shard','diamond']].forEach(([name,base])=>tile(name,t=>t.copy(base)));
  // Each model face gets its own tile, retaining procedural fallback textures.
  const fallback = {zombie:'zombie_skin',pig:'pig_skin',cow:'cow_skin',sheep:'sheep_face',spider:'spider_body'};
  for (const [mob, base] of Object.entries(fallback)) for (let i=0;i<16;i++) tile('skin_'+mob+'_'+i, t => t.copy(i === 0 ? mob+'_face' : base));
  if (tileCount > TPR * TPR) throw Error('텍스처 아틀라스 공간이 부족합니다.');
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
  // ── armor, tools & gadgets ──
  const ARM_SHAPES = [
    ['................', '................', '................', '....########....', '...#HXXXXXXX#...', '..#HXXXXXXXXS#..', '..#XXXXXXXXXS#..', '..#XS######XS#..', '..#XS#....#XS#..', '..#XS#....#XS#..', '..####....####..', '................', '................', '................', '................', '................'],
    ['................', '..####....####..', '.#HXX#....#XXS#.', '.#XXXX####XXXS#.', '.#XXXXXXXXXXXS#.', '.###XXXXXXXXS###', '...#HXXXXXXXS#..', '...#XXXXXXXXS#..', '...#XXXXXXXXS#..', '...#XXXXXXXXS#..', '...#XXXXXXXXS#..', '...#SSSSSSSSS#..', '...###########..', '................', '................', '................'],
    ['................', '................', '...##########...', '...#HXXXXXXS#...', '...#XXXXXXXS#...', '...#XXX##XXS#...', '...#XXS#.#XS#...', '...#XXS#.#XS#...', '...#XXS#.#XS#...', '...#XXS#.#XS#...', '...#XXS#.#XS#...', '...#####.####...', '................', '................', '................', '................'],
    ['................', '................', '................', '................', '................', '................', '...####..####...', '...#HX#..#HX#...', '...#XS#..#XS#...', '...#XS#..#XS#...', '..#XXS#..#XXS#..', '..#XXS#..#XXS#..', '..#####..#####..', '................', '................', '................']];
  ARMOR_MATS.forEach(m => ARMOR_PARTS.forEach(([pk], pi) => tile('armor_' + m.key + '_' + pk, t => {
    mask(t, ARM_SHAPES[pi], { '#': mul(m.col, 0.38), X: m.col, H: mul(m.col, 1.25), S: mul(m.col, 0.72) });
    t.each((x, y) => { const p = t.get(x, y); if (p[3] && t.r() < 0.18) t.set(x, y, mul(p, 0.92 + t.r() * 0.12)); });
  })));
  // worn-armor skin for the first-person sleeve
  ARMOR_MATS.forEach(m => tile('armor_skin_' + m.key, t => t.noise(m.col, 0.1)));
  tile('leather', t => { shape(t, (x, y) => x > 2 && x < 13 && y > 3 && y < 13 && !((x === 3 || x === 12) && (y === 4 || y === 12)) ? [150, 92, 52] : 0, null, 0.2); for (let i = 0; i < 6; i++) t.set(4 + Math.floor(t.r() * 8), 5 + Math.floor(t.r() * 7), [120, 70, 38]); outline(t, 0.5); });
  tile('shears', t => {
    for (let k = 0; k < 7; k++) { t.set(8 + k, 7 - k, [222, 222, 228]); t.set(8 + k, 8 - k, [170, 170, 176]); t.set(7 - k + 7, 7 - k + 1, [200, 200, 206]); }
    blob(t, 5, 11, 2.6, 2.6, [60, 60, 66], 0.1); blob(t, 9.5, 12.5, 2.4, 2.4, [60, 60, 66], 0.1);
    t.set(5, 11, [0, 0, 0], 0); t.set(9, 12, [0, 0, 0], 0); outline(t, 0.45);
  });
  // diagonal like the original: the arrow points to the top-left, which the first-person pose aims at the crosshair
  const bowTile = pull => t => {
    const W = [128, 90, 50], Wd = [92, 62, 32], S = [232, 232, 232];
    const dx = -Math.SQRT1_2, dy = -Math.SQRT1_2, px = Math.SQRT1_2, py = -Math.SQRT1_2, cx = 8.5 + pull * 0.5, cy = 8.5 + pull * 0.5;
    const pt = (a, b) => [cx + px * a + dx * b, cy + py * a + dy * b];
    const flex = 1 - pull * 0.12;
    for (let i = 0; i <= 40; i++) { const sN = i / 20 - 1, [x, y] = pt(sN * 6.6 * flex, 2.6 * (1 - sN * sN)); t.set(Math.floor(x), Math.floor(y), i % 7 < 2 ? Wd : W); }
    const [ax, ay] = pt(-6.6 * flex, 0), [bx, by] = pt(6.6 * flex, 0), [qx, qy] = pt(0, -pull * 1.7);
    const line = (x0, y0, x1, y1, c) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let k = 0; k <= n; k++) { const x = Math.floor(x0 + (x1 - x0) * k / n), y = Math.floor(y0 + (y1 - y0) * k / n); if (!t.get(x, y)[3]) t.set(x, y, c); } };
    line(ax, ay, qx, qy, S); line(qx, qy, bx, by, S);
    if (pull > 0) {
      const [hx, hy] = pt(0, 8.2);
      line(qx, qy, hx, hy, [150, 110, 64]);
      t.set(Math.floor(hx), Math.floor(hy), [92, 92, 98]); t.set(Math.floor(hx) + 1, Math.floor(hy), [70, 70, 76]); t.set(Math.floor(hx), Math.floor(hy) + 1, [70, 70, 76]);
      t.set(Math.floor(qx), Math.floor(qy) + 1, [236, 236, 236]); t.set(Math.floor(qx) + 1, Math.floor(qy), [236, 236, 236]);
    }
    outline(t, 0.4);
  };
  for (let k = 0; k < 4; k++) tile('bow_' + k, bowTile(k));
  tile('arrow', t => { for (let k = 0; k < 10; k++) t.set(3 + k, 12 - k, [140, 102, 60]); t.set(12, 3, [80, 80, 86]); t.set(13, 2, [110, 110, 116]); t.set(11, 3, [80, 80, 86]); t.set(12, 4, [80, 80, 86]); t.set(13, 3, [60, 60, 64]); t.set(12, 2, [60, 60, 64]);
    for (const [x, y] of [[2, 12], [3, 13], [2, 13], [4, 13], [2, 11], [3, 14], [1, 12]]) t.set(x, y, [236, 236, 236]); outline(t, 0.45); });
  tile('compass', t => { blob(t, 8, 8, 6, 6, [150, 150, 156], 0.1); blob(t, 8, 8, 4.6, 4.6, [228, 228, 214], 0.05); for (let k = 0; k < 3; k++) { t.set(8 + k, 7 - k, [220, 40, 40]); t.set(7 - k, 8 + k, [70, 70, 80]); } t.set(8, 8, [40, 40, 40]); outline(t, 0.45); });
  tile('clock', t => { blob(t, 8, 8, 6, 6, [232, 196, 60], 0.1); blob(t, 8, 8, 4.6, 4.6, [96, 150, 220], 0.05); t.each((x, y) => { if (y >= 8 && Math.hypot(x + 0.5 - 8, y + 0.5 - 8) < 4.6) t.set(x, y, [40, 50, 96]); }); t.set(7, 6, [255, 240, 120]); t.set(8, 6, [255, 240, 120]); t.set(8, 7, [60, 60, 60]); t.set(8, 8, [60, 60, 60]); outline(t, 0.45); });
  tile('bed_top', t => { t.each((x, y) => { const edge = x === 0 || x === 15; t.set(x, y, y < 5 ? mul([236, 236, 236], 0.92 + t.r() * 0.08) : edge ? [150, 26, 26] : mul([196, 40, 40], 0.9 + 0.1 * Math.sin(y * 2.2) + t.r() * 0.06)); }); for (let x = 1; x < 15; x++) t.set(x, 5, [170, 170, 170]); });
  tile('bed_side', t => { t.each((x, y) => { if (y < 7) return; if (y < 10) t.set(x, y, mul([196, 40, 40], 0.9 + t.r() * 0.1)); else if (y < 13) t.set(x, y, mul([168, 132, 82], 0.9 + t.r() * 0.1)); else if (x < 3 || x > 12) t.set(x, y, mul([120, 88, 50], 0.9 + t.r() * 0.1)); }); });
  tile('sheep_shorn', t => t.noise([218, 196, 170], 0.06));
  tile('crit', t => { for (let k = -5; k <= 5; k++) { const a = 255 - Math.abs(k) * 30; t.set(7 + k, 7, [255, 250, 210], a); t.set(7, 7 + k, [255, 250, 210], a); } for (let k = -2; k <= 2; k++) { t.set(7 + k, 7 + k, [255, 240, 160], 200); t.set(7 + k, 7 - k, [255, 240, 160], 200); } });
  tile('sweep', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 15), a = Math.atan2(15 - y, x - 7.5); if (d > 9 && d < 13.5 && a > 0.25 && a < 2.9) t.set(x, y, [245, 245, 245], Math.round(250 - Math.abs(d - 11.2) * 70)); }));
  tile('arrow_shaft', t => t.each((x, y) => t.set(x, y, y < 3 ? [96, 96, 102] : y > 12 ? [236, 236, 236] : mul([140, 102, 60], 0.9 + t.r() * 0.15))));
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
  for (const n of CHAR_TILES) tile(n, () => { }); // painted by paintCharacter() from the chosen character
  tile('sun', t => t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, d < 4 ? [255, 255, 230] : d < 6 ? [255, 240, 150] : [255, 220, 110], d < 6 ? 255 : 150); }));
  tile('moon', t => { t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, [222, 226, 236], d < 6 ? 255 : 0); }); [[5, 5], [9, 9], [10, 5], [6, 10]].forEach(([x, y]) => { t.set(x, y, [170, 175, 190]); t.set(x + 1, y, [180, 185, 200]); }); });
  // destroy stages 0–9 like the original: jagged cracks branch out from the centre, every stage keeps
  // the previous ones, and late stages add splinters and chipped corners until the face is shattered.
  {
    const rr = mulberry32(4242), pts = []; // [x, y, reveal 0..1, kind] kind 0 = crack, 1 = chip
    const walk = (x, y, a, len, r0, r1, depth) => {
      for (let s = 0; s < len; s++) {
        pts.push([Math.round(x), Math.round(y), r0 + (r1 - r0) * s / len, 0]);
        a += (rr() - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a);
        if (x < 0 || y < 0 || x > 15 || y > 15) break;
        if (depth < 2 && rr() < 0.16) walk(x, y, a + (rr() < 0.5 ? 1 : -1) * (0.7 + rr() * 0.6), 2 + rr() * 5, r0 + (r1 - r0) * s / len + 0.1, Math.min(1, r1 + 0.15), depth + 1);
      }
    };
    const arms = 6;
    for (let b = 0; b < arms; b++) { const a = b / arms * Math.PI * 2 + rr() * 0.7; walk(7.5 + (rr() - 0.5) * 2, 7.5 + (rr() - 0.5) * 2, a, 7 + rr() * 6, b * 0.06, 0.55 + b * 0.07, 0); }
    for (let i = 0; i < 40; i++) pts.push([Math.floor(rr() * 16), Math.floor(rr() * 16), 0.55 + rr() * 0.45, 1]);
    for (let k = 0; k < 10; k++) tile('crack_' + k, t => {
      const lim = (k + 1) / 10;
      for (const [x, y, rv, kind] of pts) {
        if (rv > lim) continue;
        if (kind === 1) { t.set(x, y, [30, 30, 30], 120); continue; }
        t.set(x, y, [24, 24, 24], 205);
        if (t.get(x + 1, y + 1)[3] === 0 && x < 15 && y < 15) t.set(x + 1, y + 1, [255, 255, 255], 85);
      }
    });
  }
  // ── HUD ──
  const heartRows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const heart = mode => t => heartRows.forEach((s, y) => { for (let x = 0; x < 7; x++) if (s[x] === '#') { const fill = mode === 'full' || (mode === 'half' && x < 4); const edge = (heartRows[y - 1]?.[x] !== '#') || (heartRows[y + 1]?.[x] !== '#') || s[x - 1] !== '#' || s[x + 1] !== '#'; t.set(4 + x, 5 + y, edge ? [24, 10, 10] : fill ? (y === 1 && x < 3 ? [255, 140, 140] : [220, 20, 30]) : [60, 30, 30]); } });
  tile('heart_full', heart('full')); tile('heart_half', heart('half')); tile('heart_empty', heart('empty'));
  const food = mode => t => { const rows = ['..###..', '.#####.', '.#####.', '..####.', '...##..', '....#..', '.....##']; rows.forEach((s, y) => { for (let x = 0; x < 7; x++) if (s[x] === '#') { const fill = mode === 'full' || (mode === 'half' && x >= 3); t.set(4 + x, 4 + y, y > 4 ? [230, 220, 200] : fill ? (x < 3 && y < 2 ? [220, 140, 80] : [170, 90, 40]) : [60, 40, 30]); } }); outline(t, 0.3); };
  tile('food_full', food('full')); tile('food_half', food('half')); tile('food_empty', food('empty'));
  tile('bubble', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3.5 && d > 2.2) t.set(x, y, [120, 180, 255]); else if (d <= 2.2 && x < 8 && y < 8) t.set(x, y, [230, 240, 255]); }));
  const armRows = ['.##...##.', '#XX###XX#', '#XXXXXXX#', '.##XXX##.', '..#XXX#..', '..#XXX#..', '..#XXX#..', '..#####..', '.........'];
  const armIcon = mode => t => armRows.forEach((s, y) => { for (let x = 0; x < 9; x++) { const ch = s[x]; if (ch === '.') continue; const fill = mode === 'full' || (mode === 'half' && x < 4); t.set(3 + x, 3 + y, ch === '#' ? [26, 26, 30] : fill ? (y < 3 && x < 4 ? [244, 244, 248] : [196, 196, 204]) : [58, 58, 64]); } });
  tile('armor_full', armIcon('full')); tile('armor_half', armIcon('half')); tile('armor_empty', armIcon('empty'));
}


// Generated sheets are split into fixed UV cells; loading failures retain built-in textures.
async function applyWorldSheets() {
  const defs = [
    ['world-face-v2.png', NEW_FACE_TILES],
    ['world-blocks-v2.png', NEW_BLOCK_TILES],
    ['world-extra.png', EXTRA_TEXTURES],
    ['world-functional.png', [null,'table_front','furnace_top','furnace_front','sandstone_top','cactus_top','tnt_top','tnt_bottom','melon_top','bed_top','bed_side','wool_3','wool_4','wool_6','wool_7',null]],
    ['world-a.png', ['dirt','grass_top','grass_side','stone','cobble','mossy','bedrock','obsidian','sand','gravel','clay','log_side','spruce_log','birch_log','log_top','planks']],
    ['world-b.png', ['coal_ore','iron_ore','gold_ore','diamond_ore','table_top','table_side','furnace_front_lit','furnace_side','stone_bricks','bricks','snow','ice','bookshelf','sandstone_side','cactus_side','tnt_side']],
    ['world-nature.png', ['leaves','spruce_leaves','birch_leaves','wool','glowstone','pumpkin_side','pumpkin_top','melon_side','chest_side','chest_front','chest_top','snow_side','wool_0','wool_1','wool_2','wool_5']],
    ...['zombie','pig','cow','sheep','spider'].map(m => ['skin-'+m+'.png', Array.from({length:16},(_,i)=>'skin_'+m+'_'+i)])
  ];
  const load = src => new Promise((resolve,reject) => { const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>resolve(im); im.onerror=reject; im.src=src; });
  const c=atlasCanvas.getContext('2d'); c.imageSmoothingEnabled=false;
  await Promise.all(defs.map(async ([file,names]) => { try { const im=await load('textures/'+file); const w=im.naturalWidth/4,h=im.naturalHeight/4; names.forEach((name,i)=>{const target=T[name]; if(target===undefined)return; c.clearRect((target%TPR)*TS,Math.floor(target/TPR)*TS,TS,TS); c.drawImage(im,(i%4)*w,Math.floor(i/4)*h,w,h,(target%TPR)*TS,Math.floor(target/TPR)*TS,TS,TS);}); } catch (_) { /* keep built-in fallback */ } }));
}

function tileUV(name) { const i = typeof name === 'number' ? name : T[name]; return [(i % TPR) / TPR, Math.floor(i / TPR) / TPR]; }

// UI icons for items (isometric cube for blocks)
async function applyGeneratedItemIcons() {
  const defs = [
    ['items-tools.png', [PICK0,PICK0+1,PICK0+2,PICK0+4,SWORD0,SWORD0+1,SWORD0+2,SWORD0+4,IRON,GOLD,DIAMOND,COAL,APPLE,BREAD,BEEF,BUCKET]],
    ['items-extra.png', [AXE0,AXE0+1,AXE0+2,AXE0+4,SHOVEL0,SHOVEL0+1,SHOVEL0+2,SHOVEL0+4,PICK0+3,AXE0+3,SHOVEL0+3,SWORD0+3,STICK,STRING,FLINT,FLINT_STEEL]],
    ['items-food.png', [PORK,COOKED_PORK,BEEF,STEAK,MUTTON,COOKED_MUTTON,FLESH,MELON_SLICE,BREAD,APPLE,BUCKET,WATER_BUCKET,COAL,IRON,GOLD,DIAMOND]],
    ['items-armor.png', Array.from({length:16},(_,i)=>ARMOR0+i)],
    ['items-new.png', [EMERALD,LAPIS,COPPER_INGOT,AMETHYST_SHARD,PICK0,PICK0+1,PICK0+2,PICK0+4,SWORD0,SWORD0+1,SWORD0+2,SWORD0+4,APPLE,BREAD,IRON,DIAMOND]],
    ['items-v2.png', [GOLDEN_APPLE,CARROT,POTATO,BAKED_POTATO,BEETROOT,EMERALD,QUARTZ,REDSTONE,LAPIS,COPPER_INGOT,AMETHYST_SHARD,PRISMARINE_SHARD,DIAMOND,IRON,GOLD,COAL]]
  ];
  const load=src=>new Promise((resolve,reject)=>{const im=new Image(); im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  // Build 32px icons, removing only the connected sheet background from tile edges.
  const drawIcon=(im,i) => {const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;const w=im.naturalWidth/4,h=im.naturalHeight/4;g.drawImage(im,(i%4)*w,Math.floor(i/4)*h,w,h,0,0,32,32);const pixels=g.getImageData(0,0,32,32),d=pixels.data;const bg=[d[0],d[1],d[2]],seen=new Uint8Array(1024),stack=[0];while(stack.length){const n=stack.pop();if(n<0||n>=1024||seen[n])continue;seen[n]=1;const k=n*4;if(Math.abs(d[k]-bg[0])+Math.abs(d[k+1]-bg[1])+Math.abs(d[k+2]-bg[2])>75)continue;d[k+3]=0;const x=n%32,y=Math.floor(n/32);if(x)stack.push(n-1);if(x<31)stack.push(n+1);if(y)stack.push(n-32);if(y<31)stack.push(n+32);}g.putImageData(pixels,0,0);return c;};
  // Process sheets in order so duplicate IDs have a deterministic final appearance.
  const sheets=await Promise.allSettled(defs.map(([file])=>load('textures/'+file)));
  for (let n=0;n<defs.length;n++) { const [file,ids]=defs[n]; try {if(sheets[n].status!=='fulfilled') continue;const im=sheets[n].value;for(let i=0;i<ids.length;i++){const id=ids[i], icon=drawIcon(im,i);ICON[id]=icon.toDataURL('image/png');const ti=T[ITEM[id]?.icon];if(ti!==undefined){const g=atlasCanvas.getContext('2d');g.clearRect((ti%TPR)*TS,Math.floor(ti/TPR)*TS,TS,TS);g.imageSmoothingEnabled=false;g.drawImage(icon,(ti%TPR)*TS,Math.floor(ti/TPR)*TS,TS,TS);}}}catch(_) {/* Built-in icon remains available. */}}
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
    if (b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent' || b.render === 'water' || b.render === 'bed')) {
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
  for (const n of ['heart_full', 'heart_half', 'heart_empty', 'food_full', 'food_half', 'food_empty', 'bubble', 'armor_full', 'armor_half', 'armor_empty']) {
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
  // Adjacent meshes may have sampled this chunk before its light was calculated.
  for (let dz=-1; dz<=1; dz++) for (let dx=-1; dx<=1; dx++) {
    if (!dx && !dz) continue; const neighbor=getChunk(ch.cx+dx,ch.cz+dz);
    if (neighbor && neighbor.mesh) neighbor.needMesh=true;
  }
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
// vertex: int16 x,y,z,pad (×64) | uint16 u,v (normalized) | uint8 sky, block, shade, flash  = 16 bytes
// Every attribute starts on a 4-byte boundary (0 / 8 / 12). Mobile GPUs (iOS Safari ANGLE-Metal, some Android
// drivers) misread unaligned offsets such as 6 or 10, leaving the terrain black or distorted.
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
      this.i16[w] = Math.round(p[k][0] * 64); this.i16[w + 1] = Math.round(p[k][1] * 64); this.i16[w + 2] = Math.round(p[k][2] * 64); this.i16[w + 3] = 0;
      this.u16[w + 4] = Math.round(uv[k][0] * 65535); this.u16[w + 5] = Math.round(uv[k][1] * 65535);
      const b = v * 16 + 12; this.u8[b] = l[k][0]; this.u8[b + 1] = l[k][1]; this.u8[b + 2] = l[k][2]; this.u8[b + 3] = flash;
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
      if (c) { const i = bidx(lx, y, lz); PB[p] = c.blocks[i]; PL[p] = c.lit ? c.light[i] : (y > c.heights[lz * CS + lx] && !isOpaqueId(c.blocks[i]) ? 0xF0 : 0); } else { PB[p] = STONE; PL[p] = 0; }
    }
  }
}

const OPAQUE = new Uint8Array(256), RTYPE = new Uint8Array(256); // 1 cube 2 cutout 3 translucent 4 water 5 cross 6 torch 7 bed (low cube)
const FTILE = []; // [blockId][face] = tile index ; front stored separately
function prepareBlockTables() {
  const rmap = { cube: 1, cutout: 2, translucent: 3, water: 4, cross: 5, torch: 6, bed: 7 };
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
    else if (rt === 7) wh = b.height;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi], q = p + f.nd;
      if (f.n[1] === -1 && y === 0) continue;
      const nid = y + f.n[1] >= WH ? 0 : PB[q];
      if (rt === 4) {
        if (isWater(nid)) continue;
        if (OPAQUE[nid] && !(f.top && wh < 1)) continue;
        if (f.bottom && nid === ICE) continue;
      } else if (OPAQUE[nid] && !(rt === 7 && f.top)) continue;
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
        if ((rt === 4 || rt === 7) && cy === 1) cy = wh;
        if (rt === 2 && id === CACTUS && f.side) { corners[k][0] = x + (f.n[0] ? (c[0] ? 15 / 16 : 1 / 16) : c[0]); corners[k][2] = z + (f.n[2] ? (c[2] ? 15 / 16 : 1 / 16) : c[2]); }
        else { corners[k][0] = x + c[0]; corners[k][2] = z + c[2]; }
        corners[k][1] = y + cy;
        const t = uvOf(tile, f.uv[k][0], rt === 7 && f.side && c[1] ? 1 - wh : f.uv[k][1]); uvs[k][0] = t[0]; uvs[k][1] = t[1];
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
  // cv(): light curve. Full sky light (l=1) can round to a hair above 1 on mobile GPUs; pow() of the resulting
  // tiny negative base is NaN there (black terrain, striped clouds), so clamp and avoid pow() entirely.
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform float uSky;uniform vec3 uFog;uniform vec2 uFogR;uniform float uBlend;uniform float uTime;uniform float uWater;uniform float uMin;uniform float uAlpha;uniform vec3 uSkyTint;uniform float uGamma;
varying vec2 vUV;varying vec4 vL;varying float vDist;varying vec3 vW;
float cv(float l){l=clamp(l,0.0,1.0);float a=clamp(l/(4.0-3.0*l),0.0,1.0);float q=1.0-a;q*=q;return mix(a,1.0-q*q,uGamma);}
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
  for (const n of ['uVP', 'uOffset', 'uScale', 'uEye', 'uTex', 'uSky', 'uFog', 'uFogR', 'uBlend', 'uTime', 'uWater', 'uMin', 'uAlpha', 'uSkyTint', 'uGamma']) U[n] = gl.getUniformLocation(prog, n);
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
  gl.vertexAttribPointer(A.aPos, 4, gl.SHORT, false, 16, off);
  gl.vertexAttribPointer(A.aUV, 2, gl.UNSIGNED_SHORT, true, 16, off + 8);
  gl.vertexAttribPointer(A.aLight, 4, gl.UNSIGNED_BYTE, true, 16, off + 12);
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
  const pq = SAVE.settings.particles ?? 2; if (pq === 0) return; if (pq === 1) n = Math.ceil(n / 2);
  if (W.particles.length > (pq === 1 ? 300 : 600)) return;
  for (let i = 0; i < n; i++) W.particles.push({ x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread * 2, z: z + (Math.random() - 0.5) * spread * 2, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed, vz: (Math.random() - 0.5) * speed, life: life * (0.5 + Math.random() * 0.6), tile, su: Math.floor(Math.random() * 12) / 16, sv: Math.floor(Math.random() * 12) / 16, size: 0.06 + Math.random() * 0.06, grav: 14 });
}
function blockParticles(x, y, z, id, n = 18) { const t = FTILE[id]; if (t) particles(x + 0.5, y + 0.5, z + 0.5, t[4], n, 0.35, 3.2); }
// small chips that fly off the face being mined, like the original
function digParticles(t) {
  const tl = FTILE[t.id], pq = SAVE.settings.particles ?? 2; if (!tl || pq === 0 || W.particles.length > 500) return;
  const fi = t.face >= 0 ? t.face : 2, n = FACES[fi].n, h = (BLOCK[t.id] && BLOCK[t.id].height) || 1, r = Math.random;
  for (let k = 0; k < (pq === 1 ? 1 : 2); k++) {
    const x = t.x + (n[0] ? 0.5 + n[0] * 0.52 : 0.05 + r() * 0.9), y = t.y + (n[1] ? h / 2 + n[1] * (h / 2 + 0.02) : (0.05 + r() * 0.9) * h), z = t.z + (n[2] ? 0.5 + n[2] * 0.52 : 0.05 + r() * 0.9);
    W.particles.push({ x, y, z, vx: n[0] * 1.4 + (r() - 0.5) * 1.6, vy: n[1] * 1.4 + r() * 1.8, vz: n[2] * 1.4 + (r() - 0.5) * 1.6, life: 0.35 + r() * 0.45, tile: tl[fi], su: Math.floor(r() * 12) / 16, sv: Math.floor(r() * 12) / 16, size: 0.04 + r() * 0.04, grav: 14 });
  }
}
// ── arrows ──
function shootArrow(d) {
  let f = Math.min(1, d); f = (f * f + f * 2) / 3; if (f < 0.1) return;
  const dir = lookDir(), e = eyePos(), sp = f * 54;
  const base = Math.ceil(f * 6), crit = f >= 0.99;
  W.arrows.push({ x: e[0] + dir[0] * 0.4, y: e[1] - 0.1 + dir[1] * 0.4, z: e[2] + dir[2] * 0.4, vx: dir[0] * sp, vy: dir[1] * sp, vz: dir[2] * sp, yaw: P.yaw, pitch: P.pitch, age: 0, stuck: false, crit, dmg: base + (crit ? Math.floor(Math.random() * (base / 2 + 2)) : 0), pick: G.mode === 'survival' });
  if (G.mode === 'survival') {
    if (G.off && G.off.id === ARROW) { if (!--G.off.count) G.off = null; }
    else { const i = G.inv.findIndex(x => x && x.id === ARROW); if (i >= 0) { G.inv[i].count--; if (!G.inv[i].count) G.inv[i] = null; } }
    damageTool(1); invChanged();
  }
  sfx('bow');
}
function updateArrows(dt) {
  for (let i = W.arrows.length - 1; i >= 0; i--) {
    const a = W.arrows[i]; a.age += dt;
    if (a.age > 60 || a.y < -20) { W.arrows.splice(i, 1); continue; }
    if (a.stuck) {
      if (!solidAt(a.bx, a.by, a.bz)) { a.stuck = false; a.vx = a.vy = a.vz = 0; continue; }
      if (a.pick && !P.dead && Math.hypot(P.x - a.x, P.y + 0.9 - a.y, P.z - a.z) < 1.7 && !addToInventory(ARROW, 1)) { sfx('pop'); invChanged(); W.arrows.splice(i, 1); }
      continue;
    }
    a.vy -= 20 * dt; const drag = Math.pow(entityInWater(a, 0) ? 0.6 : 0.99, dt * 20); a.vx *= drag; a.vy *= drag; a.vz *= drag;
    const len = Math.hypot(a.vx, a.vy, a.vz) * dt, steps = Math.max(1, Math.ceil(len / 0.2));
    let gone = false;
    for (let k = 0; k < steps && !gone; k++) {
      const nx = a.x + a.vx * dt / steps, ny = a.y + a.vy * dt / steps, nz = a.z + a.vz * dt / steps;
      for (const m of W.mobs) {
        if (m.dead || nx < m.x - m.w - 0.1 || nx > m.x + m.w + 0.1 || nz < m.z - m.w - 0.1 || nz > m.z + m.w + 0.1 || ny < m.y || ny > m.y + m.h) continue;
        if (hurtMob(m, a.dmg, m.x - a.vx, m.z - a.vz)) { if (m.type === 'spider') m.angry = true; if (a.crit) particles(m.x, m.y + m.h * 0.7, m.z, T.white, 8, 0.3, 2, 0.4); sfx('arrowhit'); }
        else if (a.pick) spawnItem(ARROW, 1, nx, ny, nz);
        W.arrows.splice(i, 1); gone = true; break;
      }
      if (gone) break;
      if (solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { a.stuck = true; a.bx = Math.floor(nx); a.by = Math.floor(ny); a.bz = Math.floor(nz); a.x += (nx - a.x) * 0.6; a.y += (ny - a.y) * 0.6; a.z += (nz - a.z) * 0.6; sfx('arrowhit', 0.5); break; }
      a.x = nx; a.y = ny; a.z = nz;
    }
    if (!gone && !a.stuck) { const h = Math.hypot(a.vx, a.vz); a.yaw = Math.atan2(a.vx, -a.vz); a.pitch = Math.atan2(a.vy, h); if (a.crit && Math.random() < 0.5) particles(a.x, a.y, a.z, T.white, 1, 0.02, 0.2, 0.3); }
  }
}
// ── beds ──
function trySleep(t) {
  G.spawn = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
  const tt = W.time % DAY_TICKS;
  if (tt < 12540 || tt > 23460) { toast('리스폰 지점을 정했어요. 잠은 밤에만 잘 수 있어요.'); return; }
  if (G.mode === 'survival' && W.difficulty > 0 && W.mobs.some(m => !m.dead && MOBDEF[m.type].hostile && Math.hypot(m.x - t.x - 0.5, m.z - t.z - 0.5) < 8 && Math.abs(m.y - t.y) < 5)) { toast('근처에 몬스터가 있어 잘 수 없어요!'); return; }
  input.mine = input.use = false; input.fwd = input.side = 0; resetTouchHolds();
  P.x = t.x + 0.5; P.z = t.z + 0.5; P.y = t.y + 1; P.vx = P.vy = P.vz = 0; P.flying = false;
  G.sleep = 0.001; toast('리스폰 지점을 정했어요. 잘 자요…');
}
function updateSleep(dt) {
  if (!G.sleep) return;
  if (G.sleep < 0) { G.sleep = Math.min(0, G.sleep + dt * 1.2); return; }
  G.sleep += dt; input.fwd = input.side = 0; input.jump = false;
  if (G.sleep > 2.4) { W.time = Math.ceil(W.time / DAY_TICKS) * DAY_TICKS + 300; updateSky(); G.sleep = -1; chat('좋은 아침이에요!', '#ff5'); saveSoon(); }
}
// ── armor ──
function armorPoints() { let d = 0, t = 0; for (const s of G.armor) { const a = s && armorOf(s.id); if (a) { d += a.def; t += a.tough; } } return [d, t]; }
function damageArmor(amount) {
  const n = Math.max(1, Math.floor(amount / 4));
  for (let i = 0; i < 4; i++) {
    const s = G.armor[i], a = s && armorOf(s.id); if (!a) continue;
    s.dmg = (s.dmg || 0) + n;
    if (s.dmg >= a.dur) { G.armor[i] = null; sfx('toolbreak'); toast(info(s.id).name + '이(가) 부서졌어요!'); }
  }
  invChanged();
}
const ARMOR_BYPASS = { starve: 1, drown: 1, void: 1, fall: 1, kill: 1 };
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
  cow: { name: '소', hp: 10, w: 0.45, h: 1.3, speed: 1.2, passive: true, drops: [[BEEF, 1, 3], [LEATHER, 0, 2]], cooked: STEAK },
  sheep: { name: '양', hp: 8, w: 0.45, h: 1.25, speed: 1.2, passive: true, drops: [[WOOL, 1, 1], [MUTTON, 1, 2]] },
  zombie: { name: '좀비', hp: 20, w: 0.3, h: 1.9, speed: 2.3, hostile: true, dmg: 3, drops: [[FLESH, 0, 2]], burns: true },
  spider: { name: '거미', hp: 16, w: 0.65, h: 0.9, speed: 3.1, hostile: true, dmg: 2, drops: [[STRING, 0, 2]], climbs: true },
};
function spawnMob(type, x, y, z) {
  const d = MOBDEF[type];
  const m = { type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, hp: d.hp, yaw: Math.random() * 6.28, bodyYaw: 0, walk: 0, wanderT: 0, moving: false, hurt: 0, panic: 0, attackCd: 0, dead: 0, burn: 0, onGround: false, color: type === 'sheep' ? Math.floor(Math.random() * 10) : 0 };
  m.bodyYaw = m.yaw; W.mobs.push(m); return m;
}
function hurtMob(m, dmg, fx, fz, explosion, kb = 1) {
  if (m.dead || m.hurt > 0.0 && !explosion) return false;
  m.hp -= dmg; m.hurt = 0.5;
  const dx = m.x - fx, dz = m.z - fz, d = Math.hypot(dx, dz) || 1;
  if (!explosion) { m.vx += dx / d * 7 * kb; m.vz += dz / d * 7 * kb; m.vy = Math.max(m.vy, 5.5 * Math.min(1, 0.4 + kb * 0.6)); }
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
        for (const [id, a, b] of d.drops) { if (id === WOOL && m.sheared) continue; const n = a + Math.floor(Math.random() * (b - a + 1)); const outId = (m.burn > 0 && d.cooked && id === d.drops[0][0]) ? d.cooked : (id === WOOL && m.color >= 8 ? COLOR_WOOL + 7 : id); spawnItem(outId, n, m.x, m.y + 0.5, m.z); }
        continue;
      }
    }
    m.hurt = Math.max(0, m.hurt - dt); m.panic = Math.max(0, m.panic - dt); m.attackCd = Math.max(0, m.attackCd - dt);
    if (m.sheared) m.sheared = Math.max(0, m.sheared - dt);
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
  if (W.difficulty === 0 || hostile >= [0, 5, 8, 11][W.difficulty]) return;
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
    // Order follows the six box faces: right, left, top, bottom, back, front.
    const skin = (name, cells) => cells.map(i => T['skin_'+name+'_'+i]);
    const withFace = (t, f) => [t, t, t, t, t, f];
    const skinFaces = (name, cells) => cells.map(i => T['skin_'+name+'_'+i]);
    if (m.type === 'zombie') {
      const S = T.zombie_skin, sh = T.zombie_shirt, pa = T.zombie_pants;
      part([-0.25, 0, -0.125], [0, 0.75, 0.125], skin('zombie',[13,13,12,14,13,12]), [0, 0.75, 0], swing);
      part([0, 0, -0.125], [0.25, 0.75, 0.125], skin('zombie',[13,13,12,14,13,12]), [0, 0.75, 0], -swing);
      part([-0.25, 0.75, -0.125], [0.25, 1.5, 0.125], skin('zombie',[8,8,9,9,7,6]), [0, 0, 0], 0);
      part([-0.5, 0.75, -0.125], [-0.25, 1.5, 0.125], skin('zombie',[11,11,9,15,11,10]), [0, 1.4, 0], Math.PI / 2 + swing * 0.15);
      part([0.25, 0.75, -0.125], [0.5, 1.5, 0.125], skin('zombie',[11,11,9,15,11,10]), [0, 1.4, 0], Math.PI / 2 - swing * 0.15);
      part([-0.25, 1.5, -0.25], [0.25, 2, 0.25], skin('zombie',[3,2,4,5,1,0]), [0, 0, 0], 0);
    } else if (m.type === 'spider') {
      const S = T.spider_body;
      part([-0.42, 0.3, -0.1], [0.42, 0.85, 0.75], skin('spider',[7,6,8,9,7,6]), [0, 0, 0], 0);
      part([-0.25, 0.32, -0.55], [0.25, 0.72, -0.1], skin('spider',[3,2,4,5,1,0]), [0, 0, 0], 0);
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
      if (sheep && m.sheared) part([-bw * 0.72, by0 + 0.06, -bl * 0.9], [bw * 0.72, by1 - 0.12, bl * 0.9], six(T.sheep_shorn), [0, 0, 0], 0);
      else part([-bw, by0, -bl], [bw, by1, bl], sheep && m.color >= 8 ? six(woolT) : skinFaces(m.type,[7,6,8,9,7,6]), [0, 0, 0], 0);
      for (const [lx, lz, s] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
        const cx = lx * (bw - lw), cz = lz * (bl - lw - 0.04);
        part([cx - lw, 0, cz - lw], [cx + lw, lh, cz + lw], skinFaces(m.type,[10,10,12,13,10,11]), [cx, lh, cz], swing * s);
      }
      const hs = big ? 0.3 : 0.25, hy = big ? 1.05 : sheep ? 0.95 : 0.5;
      part([-hs, hy, -bl - hs * 1.6], [hs, hy + hs * 2, -bl + hs * 0.3], skinFaces(m.type,[3,2,4,5,1,0]), [0, 0, 0], 0);
      if (!sheep) part([-hs*.58, hy+hs*.18, -bl-hs*1.9], [hs*.58, hy+hs*.9, -bl-hs*1.59], skinFaces(m.type,[15,15,15,15,15,14]), [0,0,0], 0);
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
      if (isCubeItem(e.id)) {
        const hs = 0.125, hy = hs * 2 * (b.height || 1);
        box(B, [-hs, 0, -hs], [hs, hy, hs], blockTiles(e.id), p => [e.x - ox + offx + p[0] * c - p[2] * s, e.y - oy + bob + offy + p[1], e.z - oz + p[0] * s + p[2] * c], sky, blk);
      } else {
        // extruded 3D sprite, 0.4 blocks wide, spinning around its vertical axis
        drawItemMesh(B, itemTileIdle(e.id), p => { const x = (p[0] - 0.5) * 0.4, y = p[1] * 0.4, z = (p[2] - 0.5) * 0.4; return [e.x - ox + offx + x * c - z * s, e.y - oy + bob + offy + y, e.z - oz + x * s + z * c]; }, sky, blk, 0.95);
      }
    }
  }
  for (const a of W.arrows) {
    const [sky, blk] = lightAt(a.x, a.y, a.z), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw), cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
    const F = [sy * cp, sp, -cy * cp], R = [cy, 0, sy], Up = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]], t = T.arrow_shaft;
    box(B, [-0.035, -0.035, -0.5], [0.035, 0.035, 0], [t, t, t, t, t, t], p => [a.x - ox + R[0] * p[0] + Up[0] * p[1] - F[0] * p[2], a.y - oy + R[1] * p[0] + Up[1] * p[1] - F[1] * p[2], a.z - oz + R[2] * p[0] + Up[2] * p[1] - F[2] * p[2]], sky, blk);
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
    const [sky, blk] = p.grav < 0 || p.glow ? [1, 0] : lightAt(p.x, p.y, p.z);
    const s = p.size, rx = right[0] * s, ry = right[1] * s, rz = right[2] * s, ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
    const x = p.x - ox, y = p.y - oy, z = p.z - oz;
    const q = [[x - rx - ux, y - ry - uy, z - rz - uz], [x + rx - ux, y + ry - uy, z + rz - uz], [x + rx + ux, y + ry + uy, z + rz + uz], [x - rx + ux, y - ry + uy, z - rz + uz]];
    const d = p.full ? 1 : 3 / 16, uv = [uvOf(p.tile, 0, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 1, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 1, 0, p.su, p.sv, p.su + d, p.sv + d), uvOf(p.tile, 0, 0, p.su, p.sv, p.su + d, p.sv + d)];
    B.quad(q, uv, sky, blk, p.grav < 0 ? Math.min(1, p.life) * 0.9 : 0.9);
  }
}

// ─────────────────────────── player, survival, interaction ───────────────────────────
let G = null, P = null, shake = 0;
const input = { fwd: 0, side: 0, jump: false, sneak: false, descend: false, sprintKey: false, mine: false, use: false, click: false };
// creative flight on/off; lifts you off the ground a little so you don't land straight away
function setFlying(on) {
  if (!G || G.mode !== 'creative') return;
  P.flying = on; P.vy = on && P.onGround ? 4 : 0;
  if (on && touchSneak) { touchSneak = false; input.sneak = touchDown; }
  buzz(10);
}
const keys = {};

function newPlayer(spawn) {
  return { x: spawn.x, y: spawn.y, z: spawn.z, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0.6, pitch: -0.15, onGround: false, inWater: false, eyeInWater: false,
    flying: false, sneaking: false, sprinting: false, fallStart: spawn.y, health: 20, hunger: 20, sat: 5, exhaustion: 0, airT: 15, hurt: 0, regenT: 0, starveT: 0, drownT: 0, cactusT: 0, voidT: 0,
    dead: false, swingT: -1, swingOffT: -1, draw: 0, noArrowT: 0, atkT: 1, heldId: -1, useHand: 0, usePrev: false, minePrev: false, mineLock: false, bodyYaw: 0, bob: 0, eating: 0, mining: null, mineCd: 0, useCd: 0, attackCd: 0, poison: 0, lastJump: 0, lastFwd: 0, jumpCd: 0, stepAcc: 0 };
}
const eyeHeight = () => P.sneaking && !P.flying ? 1.27 : 1.62;
const lookDir = () => [Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)];
// HSEL picks the hand that use/consume helpers act on: 0 = main hand (hotbar), 1 = off-hand
let HSEL = 0;
const held = () => HSEL ? G.off : G.inv[G.sel];
const setHeld = v => { if (HSEL) G.off = v; else G.inv[G.sel] = v; };
function withHand(h, fn) { const o = HSEL; HSEL = h; try { return fn(); } finally { HSEL = o; } }
function swapHands() { if (!G || P.dead) return; const a = G.inv[G.sel]; G.inv[G.sel] = G.off; G.off = a; P.atkT = 0; P.draw = 0; P.eating = 0; sfx('equip', 0.5); invChanged(); }

function addToInventory(id, count, dmg = 0) {
  const ms = maxStack(id), inv = G.inv;
  if (ms > 1) for (let i = 0; i < 36; i++) { const s = inv[i]; if (s && s.id === id && s.count < ms) { const k = Math.min(ms - s.count, count); s.count += k; count -= k; if (!count) return 0; } }
  for (let i = 0; i < 36; i++) if (!inv[i]) { const k = Math.min(ms, count); inv[i] = { id, count: k, dmg }; count -= k; if (!count) return 0; }
  return count;
}
function consumeHeld(n = 1) { if (G.mode === 'creative') return; const s = held(); if (!s) return; s.count -= n; if (s.count <= 0) setHeld(null); invChanged(); }
function damageTool(n) {
  if (G.mode === 'creative') return; const s = held(); const t = s && toolOf(s.id); if (!t) return;
  s.dmg = (s.dmg || 0) + n;
  if (s.dmg >= t.dur) { setHeld(null); sfx('toolbreak'); toast(info(s.id).name + '이(가) 부서졌어요!'); }
  invChanged();
}

// ── ray casting ──
// blocks that don't fill their cell get their real outline, so you can aim past them (e.g. hit a pig
// standing behind tall grass instead of breaking the grass)
function blockBox(id) { const b = BLOCK[id]; if (!b) return null; if (b.render === 'cross') return [0.12, 0, 0.12, 0.88, 0.8, 0.88]; if (b.render === 'torch') return [0.38, 0, 0.38, 0.62, 0.65, 0.62]; if (b.height) return [0, 0, 0, 1, b.height, 1]; return null; }
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return -1; continue; }
    let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1;
  }
  return t0;
}
function raycast(o, d, maxD, fluids) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
  let tmx = sx ? (sx > 0 ? (x + 1 - o[0]) : (o[0] - x)) * tdx : Infinity, tmy = sy ? (sy > 0 ? (y + 1 - o[1]) : (o[1] - y)) * tdy : Infinity, tmz = sz ? (sz > 0 ? (z + 1 - o[2]) : (o[2] - z)) * tdz : Infinity;
  let t = 0, face = -1, px = x, py = y, pz = z;
  while (t <= maxD) {
    const id = getBlock(x, y, z);
    if (id && (!isWater(id) || (fluids && id === WATER))) {
      const bb = blockBox(id), bt = bb ? rayBox(o, d, [x + bb[0], y + bb[1], z + bb[2]], [x + bb[3], y + bb[4], z + bb[5]]) : t;
      if (!(isWater(id) && !fluids) && bt >= 0 && bt <= maxD) return { x, y, z, id, face, px, py, pz, t: bt };
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
const isLeaves = id => id === LEAVES || id === SPRUCE_LEAVES || id === BIRCH_LEAVES;
const isWool = id => id === WOOL || (id >= COLOR_WOOL && id < COLOR_WOOL + 8);
function startSwing() { const k = HSEL ? 'swingOffT' : 'swingT'; if (P[k] < 0 || P[k] >= 0.5) P[k] = 0; }
function canHarvest(b, tool) { return !b.tier || (tool && tool.kind === 'pickaxe' && tool.level >= b.tier); }
function breakTime(id) {
  const b = BLOCK[id]; if (!b || b.hard < 0) return Infinity; if (b.hard === 0) return 0.05;
  const s = held(), tool = s && toolOf(s.id);
  let speed = 1;
  if (tool && tool.kind === b.tool) speed = tool.speed;
  if (tool && tool.kind === 'sword' && (id === LEAVES || id === SPRUCE_LEAVES || id === BIRCH_LEAVES || id === MELON || id === PUMPKIN)) speed = 1.5;
  if (tool && tool.kind === 'shears') speed = isLeaves(id) ? 15 : isWool(id) ? 5 : 1;
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
    if (tool && tool.kind === 'shears' && (isLeaves(id) || id === TALL_GRASS || id === DEAD_BUSH)) spawnItem(id, 1, t.x + 0.5, t.y + 0.4, t.z + 0.5);
    else if (canHarvest(b, tool)) dropBlockItems(t.x, t.y, t.z, id);
    else { const te = W.te.get(pkey(t.x, t.y, t.z)); if (te) for (const sl of te.slots) if (sl) spawnItem(sl.id, sl.count, t.x + 0.5, t.y + 0.5, t.z + 0.5, sl.dmg); }
    if (tool && b.hard > 0) damageTool(tool.kind === 'sword' ? 2 : 1);
    P.exhaustion += 0.005;
    G.stats.mined++;
  }
  const replace = (id === ICE && G.mode === 'survival' && getBlock(t.x, t.y - 1, t.z) !== AIR) ? WATER : AIR;
  setBlock(t.x, t.y, t.z, replace);
  blockParticles(t.x, t.y, t.z, id);
  sfx('break_' + material(id)); buzz(12);
  if (G.ui === 'container' && G.container && G.container.pos === pkey(t.x, t.y, t.z)) closeScreen();
}
// ── combat (follows the original 1.9+ rules) ──
// attack strength refills at the weapon's attack speed; damage = base × (0.2 + 0.8·strength²)
// critical: full strength while falling, not sprinting/flying/in water → ×1.5
// sprint hit: full strength while sprinting → extra knockback (and stops the sprint)
// sweep: full-strength sword hit on the ground → 1 damage to mobs right next to the target
const classicCombat = () => SAVE.settings.combat === 'classic';
const weaponOf = () => { const s = G.inv[G.sel], t = s && toolOf(s.id); return { dmg: t && t.dmg != null ? t.dmg : 1, spd: t && t.aspd ? t.aspd : 4, kind: t ? t.kind : null }; };
const attackStrength = () => classicCombat() ? 1 : clamp(P.atkT * weaponOf().spd, 0, 1);
function attack(m) {
  const s = G.inv[G.sel], tool = s && toolOf(s.id), w = weaponOf(), str = attackStrength(), full = str > 0.9, classic = classicCombat();
  let dmg = w.dmg * (0.2 + str * str * 0.8);
  const sprintHit = full && P.sprinting && !classic;
  const crit = full && P.vy < 0 && !P.onGround && !P.inWater && !P.flying && (classic || !P.sprinting);
  if (crit) dmg *= 1.5;
  const sweep = !classic && full && !crit && !sprintHit && P.onGround && w.kind === 'sword' && Math.hypot(P.vx, P.vz) < 4.4;
  dmg = Math.round(dmg * 100) / 100;
  P.atkT = 0;
  if (hurtMob(m, dmg, P.x, P.z, false, (sprintHit ? 1.7 : 1) * (0.35 + 0.65 * str))) {
    if (m.type === 'spider') m.angry = true;
    dmgNumber(m, dmg, crit);
    if (crit) { critParticles(m); sfx('crit'); } else sfx(sprintHit ? 'knock' : full ? 'strong' : 'weak');
    if (sweep) {
      sweepParticle(m); sfx('sweep');
      for (const o of W.mobs) if (o !== m && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) < 1.6 && Math.abs(o.y - m.y) < 1 && Math.hypot(o.x - P.x, o.z - P.z) < 4) { if (hurtMob(o, 1, P.x, P.z, false, 0.45)) dmgNumber(o, 1, false); }
    }
    if (sprintHit) { P.sprinting = false; P.vx *= 0.6; P.vz *= 0.6; }
    if (tool) damageTool(tool.kind === 'sword' ? 1 : 2);
    P.exhaustion += 0.1;
  } else sfx('weak', 0.5);
  startSwing();
}
function critParticles(m) {
  const pq = SAVE.settings.particles ?? 2; if (pq === 0) return;
  for (let i = 0; i < (pq === 1 ? 6 : 12); i++) { const a = Math.random() * 6.28, r = Math.random(); W.particles.push({ x: m.x + Math.cos(a) * m.w * 1.2, y: m.y + m.h * (0.4 + Math.random() * 0.6), z: m.z + Math.sin(a) * m.w * 1.2, vx: Math.cos(a) * (2 + r * 2), vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * (2 + r * 2), life: 0.5 + Math.random() * 0.3, tile: T.crit, su: 0, sv: 0, full: true, size: 0.09, grav: 6 }); }
}
function sweepParticle(m) { const d = lookDir(); W.particles.push({ x: m.x - d[0] * 0.3, y: m.y + m.h * 0.55, z: m.z - d[2] * 0.3, vx: 0, vy: 0, vz: 0, life: 0.25, tile: T.sweep, su: 0, sv: 0, full: true, size: 0.75, grav: 0, glow: true }); }
function dmgNumber(m, v, crit) { if (!SAVE.settings.dmgNumbers) return; (W.dnums || (W.dnums = [])).push({ x: m.x + (Math.random() - 0.5) * 0.4, y: m.y + m.h + 0.2, z: m.z + (Math.random() - 0.5) * 0.4, v, crit, t: 0 }); }
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
  sfx('place_' + material(id)); startSwing();
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
    if (b && b.use === 'tnt' && id === FLINT_STEEL) { setBlock(t.x, t.y, t.z, AIR); primeTNT(t.x, t.y, t.z); damageTool(1); startSwing(); return; }
    if (b && b.use === 'bed') { trySleep(t); return; }
  }
  // shear a sheep
  const tm = G.targetMob;
  if (id === SHEARS && tm && tm.type === 'sheep' && !tm.sheared && !tm.dead) {
    tm.sheared = 60 + Math.random() * 60; spawnItem(tm.color >= 8 ? COLOR_WOOL + 7 : WOOL, 1 + Math.floor(Math.random() * 3), tm.x, tm.y + 1, tm.z);
    sfx('shear'); damageTool(1); startSwing(); return;
  }
  // put on armor straight from the hand
  const arm = armorOf(id);
  if (arm) { const cur = G.armor[arm.slot]; G.armor[arm.slot] = s; setHeld(cur); sfx('equip'); startSwing(); hudDirty = true; invChanged(); return; }
  if (id === BUCKET) {
    const w = raycast(eyePos(), lookDir(), REACH, true);
    if (w && w.id === WATER) {
      setBlock(w.x, w.y, w.z, AIR); sfx('bucket');
      if (G.mode === 'survival') { if (s.count > 1) { s.count--; if (addToInventory(WATER_BUCKET, 1)) spawnItem(WATER_BUCKET, 1, P.x, P.y + 1, P.z); } else setHeld({ id: WATER_BUCKET, count: 1, dmg: 0 }); invChanged(); }
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
      if (G.mode === 'survival') { setHeld({ id: BUCKET, count: 1, dmg: 0 }); invChanged(); }
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

// "use" goes to the main hand first and falls back to the off-hand when the main hand has nothing to
// do (e.g. sword in the main hand, torch in the off-hand), like the original
const hasArrow = () => (G.off && G.off.id === ARROW) || G.inv.some(x => x && x.id === ARROW);
function canUse(s) {
  if (!s) return false;
  const id = s.id, t = G.target;
  if (id < 256) return !!t;
  const it = ITEM[id];
  if (it.food) return G.mode === 'survival' && P.hunger < 20;
  if (it.armor || id === BUCKET || id === WATER_BUCKET) return true;
  if (id === BOW) return G.mode === 'creative' || hasArrow();
  if (id === FLINT_STEEL) return !!t;
  if (id === SHEARS) return !!(G.targetMob && G.targetMob.type === 'sheep' && !G.targetMob.sheared);
  return false;
}
function pickUseHand() {
  if (G.target && !P.sneaking) { const b = BLOCK[G.target.id]; if (b && b.use && b.use !== 'tnt') return 0; } // tables, chests, beds…
  if (canUse(G.inv[G.sel])) return 0;
  if (canUse(G.off)) return 1;
  return 0;
}
function updateInteraction(dt) {
  for (const k of ['swingT', 'swingOffT']) if (P[k] >= 0) { P[k] += dt / 0.3; if (P[k] >= 1) P[k] = -1; }
  P.noArrowT = Math.max(0, P.noArrowT - dt);
  P.mineCd = Math.max(0, P.mineCd - dt); P.useCd = Math.max(0, P.useCd - dt); P.attackCd = Math.max(0, P.attackCd - dt);
  P.atkT += dt;
  const s = G.inv[G.sel], sid = s ? s.id : 0;
  if (sid !== P.heldId) { P.heldId = sid; P.atkT = 0; } // switching items resets the attack meter
  const fluids = (s && s.id === BUCKET) || (G.off && G.off.id === BUCKET);
  const eye = eyePos(), dir = lookDir();
  G.target = raycast(eye, dir, REACH, fluids);
  const tTarget = G.target ? G.target.t : REACH;
  G.targetMob = rayMob(eye, dir, Math.min(G.mode === 'creative' ? 5 : 3.5, tTarget + 0.01));
  // a click shorter than one frame (slow phones) is latched in input.click so it still counts
  const edge = (input.mine && !P.minePrev) || input.click, pressing = input.mine || input.click; P.minePrev = input.mine; input.click = false;
  if (!pressing) P.mineLock = false;
  if (pressing && !P.dead) {
    if (G.targetMob) {
      // click = hit right away; holding = hit again whenever the attack meter is full
      P.mining = null; P.mineLock = true;
      if (edge || (classicCombat() ? P.attackCd <= 0 : attackStrength() >= 1 && P.attackCd <= 0)) { attack(G.targetMob); P.attackCd = classicCombat() ? 0.25 : 0.1; }
    } else if (P.mineLock) {
      // this press already hit a mob: don't start digging the grass under it when it moves away or dies
      P.mining = null;
    } else if (G.target && !isWater(G.target.id)) {
      const t = G.target;
      if (G.mode === 'creative') { if (P.mineCd <= 0) { if (!(s && toolOf(s.id) && toolOf(s.id).kind === 'sword')) breakBlock(t); P.mineCd = 0.22; startSwing(); } }
      else if (P.mineCd <= 0) {
        if (!P.mining || P.mining.x !== t.x || P.mining.y !== t.y || P.mining.z !== t.z || P.mining.id !== t.id) P.mining = { x: t.x, y: t.y, z: t.z, id: t.id, p: 0, snd: 0 };
        const bt = breakTime(t.id);
        P.mining.p += dt / bt; P.mining.snd -= dt; if (P.swingT < 0) startSwing();
        if (P.mining.snd <= 0) { P.mining.snd = 0.24; sfx('dig_' + material(t.id), 0.5); digParticles(t); }
        if (P.mining.p >= 1) { breakBlock(t); P.mining = null; P.mineCd = 0.12; }
      }
    } else { P.mining = null; if (edge) { startSwing(); P.atkT = 0; } }
  } else P.mining = null;
  // pick the hand for this "use" press
  if (input.use && !P.usePrev) P.useHand = pickUseHand();
  P.usePrev = input.use;
  withHand(P.useHand || 0, () => {
    const h = held();
    // bow: hold "use" to draw, release to shoot
    const bow = h && h.id === BOW;
    if (bow && input.use && !P.dead) {
      if (P.draw > 0) P.draw = Math.min(1.5, P.draw + dt);
      else if (G.mode === 'creative' || hasArrow()) P.draw = 0.001;
      else if (!P.noArrowT) { toast('화살이 없어요.'); P.noArrowT = 2; }
      return;
    }
    if (P.draw > 0) { if (bow && !P.dead) shootArrow(P.draw); P.draw = 0; }
    if (input.use && !P.dead) {
      const f = h && ITEM[h.id] && ITEM[h.id].food;
      if (f && P.hunger < 20 && G.mode === 'survival') {
        P.eating += dt; if (Math.random() < dt * 6) { sfx('eat', 0.4); particles(P.x + Math.sin(P.yaw) * 0.4, P.y + 1.4, P.z - Math.cos(P.yaw) * 0.4, T[ITEM[h.id].icon], 1, 0.1, 1.5, 0.4); }
        if (P.eating >= 1.6) { P.eating = 0; eat(h); }
      } else if (P.useCd <= 0) { useItem(); P.useCd = 0.24; }
    } else P.eating = 0;
  });
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
  if (P.eating > 0 || P.draw > 0) speed *= 0.35;
  const n = Math.max(1, Math.hypot(fwd, side));
  const wx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) / n * speed, wz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) / n * speed;
  const below = getBlock(Math.floor(P.x), Math.floor(P.y - 0.05), Math.floor(P.z));
  const icy = below === ICE;
  const acc = P.flying ? 6 : P.onGround ? (icy ? 1.6 : 16) : P.inWater ? 6 : 3.5;
  P.vx += (wx - P.vx) * Math.min(1, acc * dt); P.vz += (wz - P.vz) * Math.min(1, acc * dt);
  if (P.flying) {
    const ty = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * 8.5;
    P.vy += (ty - P.vy) * Math.min(1, 12 * dt);
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
    P.bob += moved; P.stepAcc = (P.stepAcc || 0) + moved; G.stats.walk = (G.stats.walk || 0) + moved;
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
  if (src && W.difficulty === 1) amount = Math.max(1, Math.round(amount / 2 + 0.5)); else if (src && W.difficulty === 3) amount = Math.round(amount * 1.5);
  if (!ARMOR_BYPASS[cause]) { const [def, tough] = armorPoints(); if (def > 0) { const eff = clamp(def - amount / (2 + tough / 4), def * 0.2, 20); damageArmor(amount); amount *= 1 - eff / 25; } }
  if (G.sleep > 0) G.sleep = 0;
  P.health = Math.max(0, Math.round((P.health - amount) * 10) / 10); P.hurt = 0.5; G.hurtFlash = 1;
  P.exhaustion += 0.1;
  if (src) { const dx = P.x - src.x, dz = P.z - src.z, d = Math.hypot(dx, dz) || 1; P.vx += dx / d * 6; P.vz += dz / d * 6; P.vy = Math.max(P.vy, 5); }
  sfx('hurt'); buzz(40); shake = Math.max(shake, 0.25);
  if (P.health <= 0) die(cause);
  hudDirty = true;
}
const DEATH_MSG = { fall: '높은 곳에서 떨어졌습니다', zombie: '좀비에게 당했습니다', spider: '거미에게 당했습니다', drown: '익사했습니다', starve: '굶어 죽었습니다', explosion: '폭발에 휘말렸습니다', cactus: '선인장에 찔렸습니다', void: '세상 밖으로 떨어졌습니다', kill: '스스로 목숨을 끊었습니다' };
function die(cause) {
  P.dead = true; P.health = 0; input.mine = input.use = false;
  if (G.mode === 'survival') {
    for (let i = 0; i < 36; i++) { const s = G.inv[i]; if (s) { spawnItem(s.id, s.count, P.x, P.y + 1, P.z, s.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.inv[i] = null; } }
    if (G.off) { spawnItem(G.off.id, G.off.count, P.x, P.y + 1, P.z, G.off.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.off = null; }
    for (let i = 0; i < 4; i++) { const s = G.armor[i]; if (s) { spawnItem(s.id, 1, P.x, P.y + 1, P.z, s.dmg, [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]); G.armor[i] = null; } }
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
    P.starveT += dt; if (P.starveT >= 4) { P.starveT = 0; if (P.health > [20, 10, 1, 0][W.difficulty]) damagePlayer(1, 'starve'); }
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
// touch UI can be forced on/off in settings; isTouch() still describes the device itself
const touchUI = () => { const m = SAVE && SAVE.settings ? SAVE.settings.touchMode : 'auto'; return m === 'on' || (m !== 'off' && isTouch()); };
function invChanged() { invDirty = true; if (G && G.ui) renderSlots(); }

// All GUI sizes are expressed in "GUI pixels" (--g), like the original game's GUI scale option.
const u = n => `calc(var(--g)*${n})`;
const notch = n => { const a = u(n), b = `calc(100% - var(--g)*${n})`; return `polygon(${a} 0,${b} 0,${b} ${a},100% ${a},100% ${b},${b} ${b},${b} 100%,${a} 100%,${a} ${b},0 ${b},0 ${a},${a} ${a})`; };

const CSS = `@font-face{font-family:"MCKR";src:url("fonts/Galmuri11.woff2") format("woff2"),url("https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2") format("woff2");font-display:swap}
*{box-sizing:border-box}
#mc{--g:2px;--hs:1;--to:.85;--blur:0px;--chat:.5;--chato:1;--fs:max(12px,${u(6)});--ts:max(1px,${u(.5)});--sh:var(--ts) var(--ts) 0 #3f3f3f;position:relative;width:100%;height:100%;overflow:hidden;background:#000;font-family:"MCKR","Galmuri11","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;font-size:var(--fs);line-height:1.3;color:#fff;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:none}
#mc button,#mc input{font:inherit;color:inherit;letter-spacing:inherit}
#mc [hidden]{display:none!important}
#mc img{image-rendering:pixelated}
canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
.hud{position:absolute;inset:0;pointer-events:none}
#mc.nohud .hud>:not(.touch){visibility:hidden}
.cross{position:absolute;left:50%;top:50%;width:${u(9)};height:${u(9)};transform:translate(-50%,-50%);mix-blend-mode:difference}
.cross:before,.cross:after{content:"";position:absolute;background:#fff}.cross:before{left:${u(4)};top:0;width:${u(1)};height:100%}.cross:after{top:${u(4)};left:0;height:${u(1)};width:100%}
#mc.nocross .cross{display:none}
.flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(190,0,0,.55));opacity:0}
.uw{position:absolute;inset:0;background:rgba(20,50,140,.35);display:none}
.bottom{position:absolute;left:50%;bottom:0;transform:translateX(-50%) scale(var(--hs));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center}
.itemname{position:absolute;bottom:calc(100% + ${u(3)});left:50%;transform:translateX(-50%);white-space:nowrap;text-shadow:var(--sh);transition:opacity .4s}
#mc.noname .itemname{display:none}
.statrows{width:${u(182)};display:flex;flex-direction:column}
.bars{display:flex;justify-content:space-between;width:100%;margin-bottom:${u(1)}}
.bars .hr{display:flex}.bars img,.air img{width:${u(9)};height:${u(9)};margin-right:${u(-1)};display:block}
.bars .food{flex-direction:row-reverse}.bars .food img,.air img{margin:0 0 0 ${u(-1)}}
.bars .shake img{animation:shk .25s infinite}@keyframes shk{50%{transform:translateY(${u(-1)})}}
.air{display:flex;flex-direction:row-reverse;height:${u(9)}}
.toprow{display:flex;justify-content:space-between;align-items:flex-end;height:${u(9)};margin-bottom:${u(1)}}
.armor{display:flex;visibility:hidden}.armor img{width:${u(9)};height:${u(9)};margin-right:${u(-1)};display:block}
.sleepov{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.iinfo{position:absolute;left:50%;top:calc(50% + ${u(16)});transform:translateX(-50%);display:none;align-items:center;gap:${u(3)};background:#00000060;padding:${u(1)} ${u(4)};text-shadow:var(--sh);white-space:nowrap}
.ndl{position:relative;display:inline-block;width:${u(9)};height:${u(9)};border-radius:50%;background:#c8c8b4;border:${u(1)} solid #555}
.ndl::before{content:"";position:absolute;left:50%;top:${u(.5)};width:0;height:0;margin-left:${u(-1.5)};border-left:${u(1.5)} solid transparent;border-right:${u(1.5)} solid transparent;border-bottom:${u(3.5)} solid #e02828}
.hotbar{position:relative;width:${u(182)};height:${u(22)};background:var(--tx-hot) 0 0/100% 100%;image-rendering:pixelated;pointer-events:auto;--sel:0}
.hs{position:absolute;top:${u(1)};width:${u(20)};height:${u(20)};display:flex;align-items:center;justify-content:center}
.hsel{position:absolute;top:${u(-1)};left:calc(var(--g)*(var(--sel)*20 - 1));width:${u(24)};height:${u(24)};background:var(--tx-hsel) 0 0/100% 100%;image-rendering:pixelated;pointer-events:none;z-index:1}
.hot-inv{display:none;position:absolute;left:calc(100% + ${u(2)});top:0;width:${u(22)};height:${u(22)};padding:0;border:0;background:var(--tx-hotend) 0 0/100% 100%;image-rendering:pixelated;pointer-events:auto;touch-action:manipulation;cursor:pointer}
#mc.touchui .hot-inv{display:block}
.ico{width:${u(16)};height:${u(16)};image-rendering:pixelated;pointer-events:none;display:block}
.cnt{position:absolute;right:0;bottom:${u(-1)};line-height:1;text-shadow:var(--sh);pointer-events:none;z-index:3;color:#fff}
.dur{position:absolute;left:${u(2)};width:${u(13)};bottom:${u(2)};height:${u(2)};background:#000;pointer-events:none;z-index:1}.dur i{display:block;height:${u(1)}}
.eat{position:absolute;left:50%;top:60%;width:${u(60)};height:${u(3)};transform:translateX(-50%);background:#0008;display:none}.eat i{display:block;height:100%;background:#f9c74f}
.debug,.hinfo{position:absolute;left:${u(1)};top:${u(1)};display:none;flex-direction:column;align-items:flex-start;line-height:1.15}
.debug div{background:#505050a0;color:#e0e0e0;padding:${u(.5)} ${u(1)};white-space:pre}
.hinfo{display:flex;left:${u(2)};top:${u(2)};gap:${u(1)}}.hinfo div{background:#00000070;padding:${u(1)} ${u(3)};text-shadow:var(--sh);white-space:pre}
.chatlog{position:absolute;left:${u(2)};bottom:${u(42)};width:min(${u(320)},70%);display:flex;flex-direction:column;opacity:var(--chato)}
#mc.touchui .chatlog{bottom:auto;top:${u(2)}}
.chatlog div{background:rgba(0,0,0,var(--chat));padding:${u(.5)} ${u(2)};transition:opacity 1s;text-shadow:var(--sh);overflow-wrap:anywhere}
#mc.nochat .chatlog{display:none}
.toast{position:absolute;left:50%;bottom:calc(var(--g)*62*var(--hs));transform:translateX(-50%);z-index:8;padding:${u(1)} ${u(3)};background:#0000005a;text-shadow:var(--sh);opacity:0;transition:opacity .3s;white-space:nowrap;max-width:96%;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.tools{position:absolute;right:${u(2)};top:${u(2)};display:flex;gap:${u(2)};pointer-events:auto;z-index:4}
#mc.touchui .tools .dk{display:none}

/* widgets */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;height:${u(20)};min-width:0;max-width:100%;padding:0 ${u(4)};color:#fff;text-shadow:var(--sh);background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)} repeat;image-rendering:pixelated;border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;touch-action:manipulation;outline:none;flex:none}
.btn:hover,.btn:focus-visible{border-color:#fff;color:#ffffa0}
.btn:active{filter:brightness(1.12)}
.btn[disabled]{background:#2d2d2d var(--tx-btnoff) 0 0/${u(64)} ${u(20)};color:#a0a0a0;border-color:#000;box-shadow:none;cursor:default;text-shadow:var(--ts) var(--ts) 0 #282828;filter:none}
.btn.sq{width:${u(20)};padding:0}.btn.sq img{width:${u(12)};height:${u(12)};pointer-events:none}
.btn.sm{height:${u(14)};padding:0 ${u(3)}}
.btn.listen{color:#ffff55}.btn.conf{color:#ff5555}
.w200{width:${u(200)}}.w150{width:${u(150)}}.w98{width:${u(98)}}.w308{width:${u(308)}}.w204{width:${u(204)}}
.w200,.w150,.w98,.w308,.w204{max-width:100%}
.row{display:flex;gap:${u(4)}}.row>.btn{flex:1 1 0;width:auto}.row>.btn.sq{flex:none;width:${u(20)}}
.slider{position:relative;display:block;height:${u(20)};border:${u(1)} solid #000;background:#2d2d2d var(--tx-btnoff) 0 0/${u(64)} ${u(20)};image-rendering:pixelated;max-width:100%}
.slider input{-webkit-appearance:none;appearance:none;position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;background:transparent;cursor:pointer;outline:none;touch-action:none}
.slider input::-webkit-slider-runnable-track{height:100%;background:transparent;border:0}
.slider input::-moz-range-track{height:100%;background:transparent;border:0}
.slider input::-webkit-slider-thumb{-webkit-appearance:none;box-sizing:border-box;width:${u(8)};height:${u(18)};background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)};border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c;image-rendering:pixelated}
.slider input::-moz-range-thumb{box-sizing:border-box;width:${u(8)};height:${u(18)};border-radius:0;background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)};border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c}
.slider:hover input::-webkit-slider-thumb{border-color:#fff}.slider:hover input::-moz-range-thumb{border-color:#fff}
.slider .lab{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;text-shadow:var(--sh);white-space:nowrap;overflow:hidden;padding:0 ${u(3)}}
.slider:hover .lab{color:#ffffa0}
.mfield{height:${u(20)};width:${u(200)};max-width:100%;background:#000;border:${u(1)} solid #a0a0a0;color:#fff;padding:0 ${u(4)};outline:none;user-select:text;-webkit-user-select:text;border-radius:0}
.mfield:focus{border-color:#fff}.mfield::placeholder{color:#707070}
.yellow{color:#ffff55}.gray{color:#a0a0a0}.red{color:#ff5555}

/* screens */
.screen{position:absolute;inset:0;z-index:5;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column}
.screen.bg-dirt{background:#1b130d var(--tx-dirt) 0 0/${u(32)} ${u(32)} repeat;image-rendering:pixelated}
.screen.bg-game{background:linear-gradient(#101010b0,#101010d8);-webkit-backdrop-filter:blur(var(--blur));backdrop-filter:blur(var(--blur))}
.screen.bg-cont{background:linear-gradient(#10101060,#10101090)}
.screen.bg-none{background:transparent}
.screen.bg-death{background:linear-gradient(#50000060,#a03030a8)}
.screen.bg-pano{background:linear-gradient(#0000 50%,#0008),url('textures/title-panorama.png') 0% 50%/auto 112% repeat-x #3a5f8f;animation:pano var(--pano-dur,120s) linear infinite alternate}
@keyframes pano{to{background-position:0 0,100% 50%}}
#mc.nopano .screen.bg-pano{animation:none}
.ms{min-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;padding:${u(6)} ${u(6)} ${u(5)};text-shadow:var(--sh)}
.ms.center{justify-content:center;gap:${u(4)}}
.ms.full{height:100%;min-height:${u(150)}}
.mtitle{margin:${u(4)} 0 ${u(8)};text-align:center}
#mc.short .mtitle{margin:${u(1)} 0 ${u(4)}}
.mlist{flex:1 1 auto;min-height:${u(40)};width:calc(100% + ${u(12)});margin:0 ${u(-6)};overflow:auto;overscroll-behavior:contain;background:#00000080;border-top:${u(1)} solid #000;border-bottom:${u(1)} solid #ffffff26;box-shadow:inset 0 ${u(3)} ${u(4)} ${u(-2)} #000c;padding:${u(4)} ${u(6)};display:flex;flex-direction:column;align-items:center}
.mlist::-webkit-scrollbar{width:${u(6)}}.mlist::-webkit-scrollbar-track{background:#000}.mlist::-webkit-scrollbar-thumb{background:#808080;box-shadow:inset ${u(-1)} ${u(-1)} #c0c0c0}
.mfoot{display:flex;flex-direction:column;align-items:center;gap:${u(4)};padding-top:${u(6)};width:100%}
.desc{color:#a0a0a0;text-align:center;max-width:${u(310)};margin:${u(3)} 0 ${u(6)};line-height:1.45}
.mlabel{color:#a0a0a0;width:${u(200)};max-width:100%;text-align:left;margin:${u(6)} 0 ${u(2)}}
.opts{display:grid;grid-template-columns:repeat(2,${u(150)});gap:${u(4)} ${u(10)};justify-content:center;width:100%;padding:${u(2)} 0}
.opts>*{width:100%;min-width:0}
.opts .wide{grid-column:1/-1;justify-self:center;width:${u(200)};max-width:100%}
.opts .sect{grid-column:1/-1;text-align:center;color:#ffff55;margin-top:${u(4)}}
#mc.narrow .opts{grid-template-columns:minmax(0,${u(200)})}
/* title */
.tw{position:relative;min-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;padding:${u(26)} ${u(6)} ${u(18)};text-shadow:var(--sh)}
#mc.short .tw{padding-top:${u(8)}}
.logo{position:relative;margin-bottom:${u(26)};text-align:center;filter:drop-shadow(0 ${u(2)} ${u(3)} #0008)}
#mc.short .logo{margin-bottom:${u(9)}}
.logo h1{display:grid;margin:0;font-weight:normal;font-size:calc(var(--fs)*4);line-height:1;letter-spacing:${u(1)};text-shadow:none}
#mc.short .logo h1{font-size:calc(var(--fs)*3)}
.logo h1>span{grid-area:1/1}
.logo .lb{color:#2a180c;text-shadow:${u(1)} ${u(1)} 0 #2a180c,${u(2)} ${u(2)} 0 #24140a,${u(3)} ${u(3)} 0 #1b0f07,${u(1)} 0 0 #2a180c,0 ${u(1)} 0 #2a180c,${u(-1)} 0 0 #2a180c,0 ${u(-1)} 0 #2a180c}
.logo .lf{background:linear-gradient(#b5ec6a 0 18%,#7cc042 18% 30%,#4f8a2a 30% 36%,#a27652 36% 62%,#86603f 62% 82%,#6d4c31 82%);-webkit-background-clip:text;background-clip:text;color:transparent}
.edition{display:inline-block;margin-top:${u(3)};padding:${u(1)} ${u(5)};background:#1d1d1dd0;border:${u(1)} solid #000;box-shadow:inset 0 0 0 ${u(1)} #ffffff30;letter-spacing:${u(3)};color:#e8e8e8}
.splash{position:absolute;left:calc(100% - ${u(10)});top:calc(100% - ${u(8)});transform:translate(-50%,-50%) rotate(-18deg);color:#ff0;text-shadow:var(--ts) var(--ts) 0 #3f3f00;white-space:nowrap;pointer-events:none}
.splash span{display:inline-block;animation:spl .5s ease-in-out infinite alternate}@keyframes spl{to{transform:scale(1.09)}}
.tmenu{display:flex;flex-direction:column;gap:${u(4)};align-items:stretch;width:${u(200)};max-width:100%}
.tmenu .gap{height:${u(6)}}
#mc.short .tmenu .gap{height:0}
.corner{position:absolute;bottom:${u(2)};opacity:.92;white-space:nowrap}.corner.l{left:${u(2)}}.corner.r{right:${u(2)}}
#mc.narrow .corner.r{display:none}
/* lists */
.wl{width:${u(270)};max-width:100%;display:flex;flex-direction:column;gap:${u(4)}}
.we{display:flex;gap:${u(3)};padding:${u(1)};border:${u(1)} solid transparent;cursor:pointer;min-height:${u(36)};align-items:center;text-align:left}
.we:hover{background:#ffffff0d}.we.sel{border-color:#808080;background:#000}
.we .wi{width:${u(32)};height:${u(32)};flex:none;position:relative;background:#00000080;display:flex;align-items:center;justify-content:center}
.we .wi img{width:${u(24)};height:${u(24)}}
.we:hover .wi::after,.we.sel .wi::after{content:"";position:absolute;inset:0;background:#00000090 var(--tx-play) center/${u(14)} ${u(14)} no-repeat;image-rendering:pixelated}
.we .wt{min-width:0;flex:1;display:flex;flex-direction:column;gap:${u(1)}}
.we .wt>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.we .ws{color:#808080}
.empty{color:#a0a0a0;text-align:center;margin:${u(10)} 0}
.ctabs{display:flex;gap:${u(2)};margin-bottom:${u(4)}}
.ctabb{min-width:${u(70)}}.ctabb.on{color:#ffffa0}.ctabb.on::after{content:"";position:absolute;left:${u(3)};right:${u(3)};bottom:${u(3)};height:${u(1)};background:#fff}
.krow{display:grid;grid-template-columns:1fr ${u(80)} ${u(46)};gap:${u(4)};align-items:center;width:${u(310)};max-width:100%;min-height:${u(20)}}
.krow>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.khead{color:#ffff55;margin:${u(6)} 0 ${u(2)};width:${u(310)};max-width:100%;text-align:center}
.strow{display:flex;justify-content:space-between;gap:${u(8)};width:${u(270)};max-width:100%;padding:${u(2)} ${u(3)}}.strow:nth-child(odd){background:#ffffff12}
.help{width:${u(310)};max-width:100%;line-height:1.6}.help h4{color:#ffff55;margin:${u(5)} 0 ${u(1)};font-weight:normal;font-size:inherit}.help p{margin:0;color:#e0e0e0}
.chunkmap{display:grid;grid-template-columns:repeat(5,${u(6)});gap:${u(1)};margin:${u(4)} 0}
.chunkmap i{width:${u(6)};height:${u(6)};background:#2a2a2a}.chunkmap i.g{background:#7d7d7d}.chunkmap i.m{background:#5d9e2d}
.pbar{width:${u(200)};max-width:100%;height:${u(6)};border:${u(1)} solid #fff;padding:${u(1)}}.pbar i{display:block;height:100%;background:#fff;width:0}
.dtitle{font-size:calc(var(--fs)*2);margin-bottom:${u(8)}}
.minfo{color:#a0a0a0;margin-top:${u(6)};text-align:center}
.chatin{margin:auto ${u(2)} ${u(2)};height:${u(12)};background:#00000080;border:0;color:#fff;padding:0 ${u(2)};outline:none;width:calc(100% - ${u(4)});text-shadow:var(--sh);user-select:text;-webkit-user-select:text}
/* containers */
.cwrap{margin:auto;display:flex;align-items:stretch;justify-content:center;flex-wrap:wrap;gap:${u(2)};padding:${u(3)}}
.panel{position:relative;background:#c6c6c6;color:#404040;text-shadow:none;border:${u(1)} solid #000;box-shadow:inset ${u(2)} ${u(2)} #fff,inset ${u(-2)} ${u(-2)} #555;padding:${u(6)} ${u(6)} ${u(7)};clip-path:${notch(1)}}
.chead{display:flex;align-items:center;gap:${u(3)};min-height:${u(11)};margin:0 0 ${u(3)}}
.ctitle{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ctitle.sub{margin:${u(4)} 0 ${u(2)}}
.sp{flex:1}
.xbtn{flex:none;width:${u(11)};height:${u(11)};padding:0;background:#8b8b8b var(--tx-x) center/${u(7)} ${u(7)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated}
.xbtn:hover{background-color:#a4a4c8}
#mc.touchui .xbtn{width:${u(16)};height:${u(16)}}
.mobtools{display:none;gap:${u(2)}}#mc.touchui .mobtools{display:flex}
.tgl{height:${u(14)};padding:0 ${u(3)};background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;color:#fff!important;text-shadow:var(--sh);cursor:pointer;white-space:nowrap;touch-action:manipulation}
.tgl.on{background:#5c8f3a;border-color:#a8e080 #2f4f1c #2f4f1c #a8e080}
.grid{display:grid;grid-template-columns:repeat(9,${u(18)})}.grid.g2{grid-template-columns:repeat(2,${u(18)})}.grid.g3{grid-template-columns:repeat(3,${u(18)})}
.slot{position:relative;width:${u(18)};height:${u(18)};background:#8b8b8b;border:${u(1)} solid;border-color:#373737 #fff #fff #373737;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;touch-action:manipulation}
.slot:hover::after,.slot.hl::after{content:"";position:absolute;inset:0;background:#ffffff80;pointer-events:none;z-index:2}
.slot.big{width:${u(26)};height:${u(26)}}
.slot.ghosted::before{content:"";position:absolute;inset:0;background:#ff000038;pointer-events:none}
.slot .ghost{opacity:.5}
.slot.trash{background:#8b8b8b var(--tx-trash) center/${u(16)} ${u(16)} no-repeat;image-rendering:pixelated}
#mc.touchui .slot{touch-action:none}
.offhot{position:absolute;right:calc(100% + ${u(4)});top:0;width:${u(22)};height:${u(22)};background:var(--tx-offbg) 0 0/100% 100%;image-rendering:pixelated;display:none;align-items:center;justify-content:center}
.atkind{position:absolute;left:50%;top:calc(50% + ${u(8)});width:${u(16)};height:${u(2)};transform:translateX(-50%);background:#00000090;display:none}.atkind i{display:block;height:100%;background:#e8e8e8;width:0}
.dnums{position:absolute;inset:0;overflow:hidden}.dnums b{position:absolute;transform:translate(-50%,-50%);font-weight:normal;color:#ff6b6b;text-shadow:var(--sh);white-space:nowrap}.dnums b.crit{color:#ffd23a;font-size:calc(var(--fs)*1.3)}
#mc.cam2 .cross{display:none}
.pcol{display:flex;flex-direction:column;align-items:center;gap:${u(2)};align-self:center}
.pview{width:${u(26)};height:${u(52)};image-rendering:pixelated;display:block;background:#00000018}
#mc.short .pview{display:none}
.charwrap{display:flex;gap:${u(10)};align-items:flex-start;justify-content:center;flex-wrap:wrap}
.pview.big{width:${u(48)};height:${u(96)};background:#00000040;border:${u(1)} solid #000}
.charopts{grid-template-columns:repeat(2,${u(120)})}
.sw{display:inline-block;width:${u(7)};height:${u(7)};margin-right:${u(3)};border:${u(1)} solid #000;vertical-align:middle}
.chead .bookbtn{align-self:center;height:${u(14)};width:${u(16)};background-size:${u(12)} ${u(12)}}
.ico.sil{filter:brightness(0);opacity:.28}
.armcol{display:grid;grid-template-columns:${u(18)};align-self:center}
#mc.short .armcol{grid-template-columns:repeat(2,${u(18)})}
.armrow{display:flex}
.cursor.drag{transform:translateY(${u(-14)}) scale(1.45)}
.slot.hl.spread::after{background:#ffffa070}
.invgap{height:${u(4)}}
.craft{display:flex;align-items:center;gap:${u(4)};padding:${u(1)} ${u(6)} ${u(2)} 0;min-height:${u(40)}}
.craft .sp{min-width:${u(2)}}
.carrow{width:${u(22)};height:${u(15)};position:relative;background:var(--tx-arrow) 0 0/100% 100%;image-rendering:pixelated;flex:none}
.carrow i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--tx-arrowf) 0 0/${u(22)} ${u(15)} no-repeat;image-rendering:pixelated}
.bookbtn{flex:none;width:${u(20)};height:${u(18)};padding:0;background:#8b8b8b var(--tx-book) center/${u(16)} ${u(16)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated;align-self:flex-end}
.bookbtn:hover{background-color:#a4a4c8}.bookbtn.on{background-color:#79a85a}
.rbook{width:${u(147)};display:flex;flex-direction:column;gap:${u(3)}}.rbook .rgrid{flex:1 0 auto}
.rhead{display:flex;gap:${u(2)};align-items:center}
.rhead .mfield{flex:1;min-width:0;height:${u(14)};width:auto}
.rtabs{display:flex;gap:${u(1)}}
.rtab{flex:1;height:${u(14)};background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;color:#fff;text-shadow:var(--sh);cursor:pointer;padding:0;touch-action:manipulation}
.rtab.on{background:#d8d8d8;color:#404040;text-shadow:none;border-color:#fff #8b8b8b #8b8b8b #fff}
.rgrid{display:grid;grid-template-columns:repeat(5,${u(25)});grid-auto-rows:${u(25)};gap:${u(1)};justify-content:center;align-content:start;height:${u(104)}}
.rslot{position:relative;display:flex;align-items:center;justify-content:center;background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;touch-action:manipulation}
.rslot.no{background:#a85c5c;border-color:#d89090 #5a2020 #5a2020 #d89090}
.rslot:hover::after{content:"";position:absolute;inset:0;background:#ffffff50}
.rslot .cnt{right:${u(1)};bottom:${u(1)}}
.rempty{grid-column:1/-1;text-align:center;margin:${u(10)} 0;color:#555}
.rpage{display:flex;align-items:center;justify-content:center;gap:${u(8)};min-height:${u(14)}}
.pg{width:${u(14)};height:${u(14)};padding:0;background:#8b8b8b var(--tx-pg) center/${u(7)} ${u(7)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated}
.pg.prev{transform:scaleX(-1)}.pg[disabled]{opacity:.4;cursor:default}
.cr{margin:auto;display:flex;flex-direction:column;padding:${u(3)}}
.crtabs{display:flex;gap:${u(1)};align-items:flex-end;padding:0 ${u(2)};position:relative;z-index:1}
.crtab{width:${u(26)};height:${u(25)};padding:0;background:#9d9d9d;border:${u(1)} solid #000;border-bottom:0;box-shadow:inset ${u(2)} ${u(2)} #d8d8d8;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:${u(-1)};touch-action:manipulation}
.crtab.on{background:#c6c6c6;height:${u(28)};box-shadow:inset ${u(2)} ${u(2)} #fff}
.crtabs.bot{align-items:flex-start}.crtabs.bot .crtab{border-top:0;border-bottom:${u(1)} solid #000;margin:${u(-1)} 0 0;box-shadow:inset ${u(2)} 0 #d8d8d8}.crtabs.bot .crtab.on{box-shadow:inset ${u(2)} 0 #fff}
.crp{width:${u(195)};max-width:100%}
.csearch{width:100%;height:${u(14)};margin-bottom:${u(3)}}
.palette{display:grid;grid-template-columns:repeat(9,${u(18)});grid-auto-rows:${u(18)};height:${u(90)};overflow-y:auto;overscroll-behavior:contain;align-content:start;padding-right:${u(1)}}
@supports not selector(::-webkit-scrollbar){.palette{scrollbar-color:#c6c6c6 #8b8b8b}}
#mc.short .palette{height:${u(72)}}
#mc.short .cwrap{padding:${u(1)}}#mc.short .panel{padding:${u(4)} ${u(5)} ${u(5)}}#mc.short .chead{margin-bottom:${u(1)}}#mc.short .ctitle.sub{margin:${u(2)} 0 ${u(1)}}#mc.short .craft{min-height:0}#mc.short .edhint{display:none}
.palette::-webkit-scrollbar{width:${u(12)}}.palette::-webkit-scrollbar-track{background:#8b8b8b;box-shadow:inset ${u(1)} ${u(1)} #373737,inset ${u(-1)} ${u(-1)} #fff}.palette::-webkit-scrollbar-thumb{background:#c6c6c6;border:${u(1)} solid;border-color:#fff #555 #555 #fff}
.palette .pe{grid-column:1/-1;margin:${u(6)} 0}
.hotrow{display:flex;gap:${u(6)};align-items:center;margin-top:${u(4)}}
.furn{display:flex;align-items:center;justify-content:center;gap:${u(14)};padding:${u(2)} 0 ${u(4)}}
.fcol{display:flex;flex-direction:column;align-items:center;gap:${u(2)}}
.flame{width:${u(14)};height:${u(14)};position:relative;background:var(--tx-flameoff) 0 0/100% 100%;image-rendering:pixelated}
.flame i{position:absolute;left:0;right:0;bottom:0;height:0;background:var(--tx-flame) 0 100%/${u(14)} ${u(14)} no-repeat;image-rendering:pixelated}
.cursor{position:absolute;pointer-events:none;z-index:9;width:${u(16)};height:${u(16)};margin:${u(-8)} 0 0 ${u(-8)}}
.tip{position:absolute;pointer-events:none;z-index:10;background:#100010f0;padding:${u(3)} ${u(4)};display:none;white-space:nowrap;color:#fff;text-shadow:var(--sh);line-height:1.35}
.tip::before{content:"";position:absolute;inset:${u(1)};border:${u(1)} solid transparent;border-image:linear-gradient(#5000ffa0,#28007fa0) 1;pointer-events:none}
.tip .tl{color:#a8a8a8}
.touch-held{position:static;align-self:center;margin:0 auto ${u(2)};background:#000c;padding:${u(2)} ${u(5)};border:${u(1)} solid #777;display:none;align-items:center;gap:${u(3)};z-index:6;pointer-events:none;max-width:100%;text-shadow:var(--sh)}
#mc.touchui .touch-held{display:flex}
.held-slot{position:relative;width:${u(16)};height:${u(16)};flex:none}
/* touch controls */
.touch{position:absolute;inset:0;pointer-events:none;display:none;opacity:var(--to)}
#mc.touchui .touch{display:block}
.tc{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;touch-action:none;padding:0;margin:0}
.tc.off,.tc.cond-off{display:none}
.tb{background:#1e1e1e70 center/56% no-repeat;image-rendering:pixelated;border:${u(1)} solid #ffffff70;box-shadow:inset 0 0 0 ${u(1)} #00000050;border-radius:${u(2)};cursor:pointer}
.tb.down{background-color:#ffffff60}
.tb.on{background-color:#3f7a2da0;border-color:#a8f080}
.joy{border-radius:50%;background:#1e1e1e50;border:${u(1)} solid #ffffff60}
.joy i{position:absolute;left:50%;top:50%;width:42%;height:42%;margin:-21% 0 0 -21%;border-radius:50%;background:#ffffff70;border:${u(1)} solid #ffffffb0;pointer-events:none}
.dpad{display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);gap:5%}
.dpad b{display:block;background:#1e1e1e70 var(--ti-up) center/58% no-repeat;border:${u(1)} solid #ffffff70;border-radius:${u(2)};image-rendering:pixelated;pointer-events:none}
.dpad b.c{background-image:var(--ti-sneak)}.dpad b.c.on{background-color:#3f7a2da0;border-color:#a8f080}
.dpad b.x{visibility:hidden}.dpad b.down{background-color:#ffffff60;visibility:visible}
.dpad b[data-d=r]{transform:rotate(90deg)}.dpad b[data-d=d]{transform:rotate(180deg)}.dpad b[data-d=l]{transform:rotate(-90deg)}
.dpad b[data-d=ur]{transform:rotate(45deg)}.dpad b[data-d=ul]{transform:rotate(-45deg)}.dpad b[data-d=dr]{transform:rotate(135deg)}.dpad b[data-d=dl]{transform:rotate(-135deg)}
#mc.editing .touch{display:block;z-index:6;opacity:1}
#mc.editing .tc.off,#mc.editing .tc.cond-off{display:block}#mc.editing .dpad.off,#mc.editing .dpad.cond-off{display:grid}
#mc.editing .tc.off{opacity:.35}
#mc.editing .tc{outline:${u(1)} dashed #ffffffb0;outline-offset:${u(1)};cursor:grab}
#mc.editing .tc.sel{outline:${u(1)} solid #ffff55;z-index:1}
#mc.editing .tc::after{content:attr(data-label);position:absolute;left:50%;top:calc(100% + ${u(3)});transform:translateX(-50%);white-space:nowrap;background:#000b;padding:0 ${u(2)};text-shadow:var(--sh);color:#fff;pointer-events:none;font-size:var(--fs);line-height:1.3}
#mc.editing .tc.sel::after{color:#ffff55}
#mc.editing .bottom{z-index:6;opacity:.45;pointer-events:none}
#mc.editing .tools{display:none}
#mc.editing .bottom *{pointer-events:none}
.editor{position:absolute;inset:0;z-index:7;pointer-events:none}
.editor.grid{background-image:linear-gradient(#ffffff14 1px,transparent 1px),linear-gradient(90deg,#ffffff14 1px,transparent 1px);background-size:var(--snap,16px) var(--snap,16px)}
.edbar{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${u(170)};max-width:calc(100% - 8px);pointer-events:auto;background:#000000d0;border:${u(1)} solid #ffffff60;padding:${u(4)};display:flex;flex-direction:column;gap:${u(3)};text-shadow:var(--sh)}
.edbar.moved{transform:none}
.edhead{display:flex;align-items:center;gap:${u(3)};cursor:move;touch-action:none;color:#ffff55;min-height:${u(14)}}
.edhead span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.edbar.min>:not(.edhead){display:none}
.edsel{display:flex;align-items:center;gap:${u(3)}}.edsel b{flex:1;text-align:center;font-weight:normal}
.edhint{color:#a0a0a0;text-align:center;font-size:var(--fs)}`;

const SPLASH = ['무한한 세계!', '블록으로 무엇이든!', '밤에는 조심!', '다이아몬드를 찾아라!', '100% 자체 제작 텍스처!', '횃불은 소중해요', '작업대부터 만들어요', '이제 버튼도 옮길 수 있어요!', '설정이 더 많아졌어요!', '좀비는 햇빛을 싫어해요?', '모바일에서도 즐겨요!'];

// ── generated pixel textures for the GUI (no external UI images needed) ──
const UIT = {}, TICON = {};
function pixCanvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, w, h); return c; }
function pixURL(rows, colors) {
  return pixCanvas(rows[0].length, rows.length, g => { rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = colors[r[x]]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } } }); }).toDataURL();
}
// white icon with a soft dark drop shadow, used for touch buttons and small tool buttons
function iconURL(rows, color = '#ffffff') {
  const h = rows.length, w = rows[0].length;
  return pixCanvas(w + 1, h + 1, g => {
    for (const [dx, col] of [[1, 'rgba(0,0,0,.55)'], [0, color]]) { g.fillStyle = col; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') g.fillRect(x + dx, y + dx, 1, 1); }); }
  }).toDataURL();
}
const ICONS = {
  up: ['............', '.....##.....', '....####....', '...######...', '..########..', '.##########.', '....####....', '....####....', '....####....', '....####....', '....####....', '............'],
  sneak: ['............', '....####....', '....####....', '....####....', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............', '.##########.', '............'],
  mine: ['............', '..########..', '.##########.', '##...##...##', '#....##....#', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '............'],
  use: ['............', '.##########.', '.#........#.', '.#...##...#.', '.#...##...#.', '.#.######.#.', '.#.######.#.', '.#...##...#.', '.#...##...#.', '.#........#.', '.##########.', '............'],
  fly: ['............', '.....##.....', '....####....', '...##..##...', '..##....##..', '.....##.....', '....####....', '...##..##...', '..##....##..', '.##......##.', '............', '............'],
  sprint: ['............', '.##...##....', '..##...##...', '...##...##..', '....##...##.', '.....##...##', '....##...##.', '...##...##..', '..##...##...', '.##...##....', '............', '............'],
  drop: ['.....##.....', '.....##.....', '.....##.....', '...######...', '....####....', '.....##.....', '............', '.#........#.', '.#........#.', '.##########.', '............', '............'],
  chat: ['............', '.##########.', '.#........#.', '.#.######.#.', '.#........#.', '.#.####...#.', '.#........#.', '.####.#####.', '....#.#.....', '....##......', '....#.......', '............'],
  pause: ['............', '............', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '............', '............'],
  dots: ['............', '............', '............', '............', '............', '.##..##..##.', '.##..##..##.', '............', '............', '............', '............', '............'],
  full: ['............', '.####..####.', '.#........#.', '.#........#.', '.#........#.', '............', '............', '.#........#.', '.#........#.', '.#........#.', '.####..####.', '............'],
  bag: ['............', '....####....', '...#....#...', '.##########.', '.#........#.', '.#..####..#.', '.#..#..#..#.', '.#..####..#.', '.#........#.', '.#........#.', '.##########.', '............'],
  grid: ['............', '.####..####.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.', '............', '............', '.####..####.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.', '............'],
  view: ['............', '............', '...######...', '..#......#..', '.#...##...#.', '#...####...#', '#...####...#', '.#...##...#.', '..#......#..', '...######...', '............', '............'],
  swap: ['............', '..#.........', '.##.........', '#########...', '.##.........', '..#.........', '.........#..', '.........##.', '...#########', '.........##.', '.........#..', '............'],
  search: ['............', '...####.....', '..#....#....', '.#......#...', '.#......#...', '.#......#...', '.#......#...', '..#....#....', '...#####....', '.......###..', '........###.', '.........##.'],
};
function makeUITextures() {
  const rnd = mulberry32(7331);
  const stone = (base, spread, top) => pixCanvas(64, 20, g => {
    for (let y = 0; y < 20; y++) for (let x = 0; x < 64; x++) {
      let v = base + (rnd() - 0.5) * spread; if (rnd() < 0.06) v -= spread * 0.9; if (y < 2) v += top; v = clamp(Math.round(v), 0, 255);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
    }
  }).toDataURL();
  UIT.btn = stone(112, 13, 5); UIT.btnoff = stone(44, 8, 0);
  // hotbar strip (182×22) and selection frame (24×24)
  UIT.hot = pixCanvas(182, 22, g => {
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 180, 20);
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 20;
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 1, 2, 18, 18);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, 3, 16, 16);
      g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(x, 1, 20, 1); g.fillRect(x, 1, 1, 20);
      g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(x, 20, 20, 1); g.fillRect(x + 19, 1, 1, 20);
    }
    g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 182, 1); g.fillRect(0, 21, 182, 1); g.fillRect(0, 0, 1, 22); g.fillRect(181, 0, 1, 22);
  }).toDataURL();
  UIT.hsel = pixCanvas(24, 24, g => {
    g.fillStyle = '#000'; g.fillRect(1, 0, 22, 1); g.fillRect(1, 23, 22, 1); g.fillRect(0, 1, 1, 22); g.fillRect(23, 1, 1, 22);
    g.fillStyle = '#ffffff'; g.fillRect(1, 1, 22, 2); g.fillRect(1, 1, 2, 22);
    g.fillStyle = '#c8c8c8'; g.fillRect(1, 21, 22, 2); g.fillRect(21, 1, 2, 22);
    g.fillStyle = '#000'; g.fillRect(3, 3, 18, 1); g.fillRect(3, 20, 18, 1); g.fillRect(3, 3, 1, 18); g.fillRect(20, 3, 1, 18);
  }).toDataURL();
  UIT.hotend = pixCanvas(22, 22, g => {
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 20, 20);
    g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(1, 1, 20, 1); g.fillRect(1, 1, 1, 20);
    g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(1, 20, 20, 1); g.fillRect(20, 1, 1, 20);
    g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 22, 1); g.fillRect(0, 21, 22, 1); g.fillRect(0, 0, 1, 22); g.fillRect(21, 0, 1, 22);
    g.fillStyle = '#fff'; for (const x of [5, 10, 15]) g.fillRect(x, 10, 2, 2);
  }).toDataURL();
  const arrow = col => pixCanvas(22, 15, g => { g.fillStyle = col; for (let y = 0; y < 15; y++) for (let x = 0; x < 22; x++) { const head = x >= 13 && x - 13 <= 7 - Math.abs(y - 7), shaft = x < 13 && y >= 5 && y <= 9; if (head || shaft) g.fillRect(x, y, 1, 1); } }).toDataURL();
  UIT.arrow = arrow('#8b8b8b'); UIT.arrowf = arrow('#ffffff');
  const FL = ['......#.......', '......##......', '.....###......', '.....####.....', '....#####.#...', '...#######.#..', '...########...', '..##########..', '..####..####..', '.####....####.', '.###......###.', '.####....####.', '..##########..', '...########...'];
  UIT.flameoff = pixURL(FL, { '#': '#8b8b8b' });
  UIT.flame = pixCanvas(14, 14, g => { FL.forEach((r, y) => { for (let x = 0; x < 14; x++) if (r[x] === '#') { const t = y / 13; g.fillStyle = t < .35 ? '#ffe26a' : t < .7 ? '#ff9a1f' : '#e2461a'; g.fillRect(x, y, 1, 1); } }); }).toDataURL();
  UIT.book = pixURL(['................', '.##############.', '.#GGGGGGGGGGGW#.', '.#GLLLLLLLLLGW#.', '.#GLGGGGGGGLGW#.', '.#GLGYYYYYGLGW#.', '.#GLGGGGGGGLGW#.', '.#GLLLLLLLLLGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#DDDDDDDDDDDD#.', '.##############.', '................'],
    { '#': '#1e3a12', G: '#3f7d2a', L: '#6fb04a', Y: '#e8d27a', W: '#f2efe2', D: '#2a5a1a' });
  UIT.trash = pixURL(['................', '................', '...##......##...', '..#RR#....#RR#..', '..#RRR#..#RRR#..', '...#RRR##RRR#...', '....#RRRRRR#....', '.....#RRRR#.....', '.....#RRRR#.....', '....#RRRRRR#....', '...#RRR##RRR#...', '..#RRR#..#RRR#..', '..#RR#....#RR#..', '...##......##...', '................', '................'], { '#': '#3a0000', R: '#e23a3a' });
  UIT.x = pixURL(['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#'], { '#': '#ffffff' });
  UIT.pg = pixURL(['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....'], { '#': '#ffffff' });
  UIT.play = pixURL(['##.......', '####.....', '######...', '########.', '#########', '########.', '######...', '####.....', '##.......'], { '#': '#ffffff' });
  for (const k in ICONS) UIT['i_' + k] = iconURL(ICONS[k]);
  UIT.shield = pixURL(['................', '................', '...##########...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '....#XXXXXX#....', '....#XXXXXX#....', '.....#XXXX#.....', '......####......', '................', '................', '................', '................'], { '#': '#555', X: '#999' });
  UIT.offbg = pixCanvas(22, 22, g => { g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 20, 20); g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(1, 1, 20, 1); g.fillRect(1, 1, 1, 20); g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(1, 20, 20, 1); g.fillRect(20, 1, 1, 20); g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 22, 1); g.fillRect(0, 21, 22, 1); g.fillRect(0, 0, 1, 22); g.fillRect(21, 0, 1, 22); }).toDataURL();
  Object.assign(TICON, { view: UIT.i_view, swap: UIT.i_swap, jump: UIT.i_up, mine: UIT.i_mine, use: UIT.i_use, sneak: UIT.i_sneak, sprint: UIT.i_sprint, fly: UIT.i_fly, down: iconURL(ICONS.up.slice().reverse()), drop: UIT.i_drop, chat: UIT.i_chat, pause: UIT.i_pause });
  // dark menu background made from the world's own dirt tile
  const dc = pixCanvas(16, 16, g => { const di = T.dirt; g.drawImage(atlasCanvas, (di % TPR) * TS, Math.floor(di / TPR) * TS, 16, 16, 0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, 16, 16); });
  UIT.dirt = dc.toDataURL();
  const mc = $('mc');
  for (const k of ['btn', 'btnoff', 'hot', 'hsel', 'hotend', 'offbg', 'arrow', 'arrowf', 'flameoff', 'flame', 'book', 'trash', 'x', 'pg', 'play', 'dirt']) mc.style.setProperty('--tx-' + k, `url(${UIT[k]})`);
  mc.style.setProperty('--ti-up', `url(${UIT.i_up})`); mc.style.setProperty('--ti-sneak', `url(${UIT.i_sneak})`);
  $('iInv').src = UIT.i_bag; $('iFull').src = UIT.i_full; $('iPause').src = UIT.i_pause;
}

function buildDOM() {
  root.innerHTML = `<style>${CSS}</style><section id="mc">
<canvas id="cv" tabindex="0" aria-label="3D 블록 월드"></canvas>
<div class="hud" id="hud">
 <div class="uw" id="uw"></div><div class="flash" id="flash"></div>
 <div class="cross" id="cross"></div><div class="atkind" id="atkind"><i></i></div><div class="dnums" id="dnums"></div><div class="iinfo" id="iinfo"></div><div class="sleepov" id="sleepov"></div>
 <div class="hinfo" id="hinfo"></div><div class="debug" id="debug"></div>
 <div class="chatlog" id="chatlog"></div>
 <div class="eat" id="eat"><i></i></div>
 <div class="tools"><button class="btn sq dk" id="bInv" aria-label="인벤토리" title="인벤토리 (E)"><img id="iInv" alt=""></button><button class="btn sq" id="bFull" aria-label="전체화면 전환" title="전체화면"><img id="iFull" alt=""></button><button class="btn sq dk" id="bPause" aria-label="일시정지" title="게임 메뉴 (Esc)"><img id="iPause" alt=""></button></div>
 <div class="touch" id="touch"></div>
 <div class="bottom" id="bottomHud"><div class="itemname" id="itemname"></div><div class="statrows"><div class="toprow"><div class="armor" id="armor"></div><div class="air" id="air"></div></div><div class="bars" id="bars"><div class="hr" id="hearts"></div><div class="hr food" id="food"></div></div></div><div class="hotbar" id="hotbar"></div></div>
</div>
<div class="screen" id="screen" hidden></div>
<div class="editor" id="editor" hidden></div>
<div class="toast" id="toast" role="status"></div>
<div class="cursor" id="cursor"></div><div class="tip" id="tip"></div>
</section>`;
  canvas = $('cv');
  $('hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="hs" data-hot="${i}" style="left:calc(var(--g)*${1 + i * 20})"></div>`).join('') + '<div class="hsel"></div><button id="hotInv" class="hot-inv" aria-label="인벤토리 열기"></button><div class="offhot" id="offhot" title="왼손"></div>';
  $('hearts').innerHTML = '<img alt="">'.repeat(10); $('food').innerHTML = '<img alt="">'.repeat(10); $('air').innerHTML = '<img alt="">'.repeat(10); $('armor').innerHTML = '<img alt="">'.repeat(10);
}
// GUI scale: "auto" picks the largest scale that still fits, like the original game's option
let guiG = 2;
function applyGui() {
  if (!root || !SAVE) return;
  const mc = $('mc'), W = mc.clientWidth || innerWidth, H = mc.clientHeight || innerHeight, tu = touchUI();
  let auto = 1; while (auto < 3 && W >= 320 * (auto + 1) && H >= 240 * (auto + 1)) auto++;
  if (tu && auto < 2 && Math.min(W, H) >= 300) auto = 2;
  guiG = clamp(+SAVE.settings.guiScale || auto, 1, 4);
  mc.style.setProperty('--g', guiG + 'px');
  mc.classList.toggle('narrow', W < 326 * guiG);
  mc.classList.toggle('short', H < 250 * guiG);
  mc.classList.toggle('touchui', tu);
}
function slotHTML(s) {
  if (!s) return '';
  const dm = durOf(s.id), dur = dm && s.dmg ? `<div class="dur"><i style="width:${Math.max(0, 100 - s.dmg / dm * 100)}%;background:hsl(${120 * (1 - s.dmg / dm)},90%,50%)"></i></div>` : '';
  return `<img class="ico" src="${ICON[s.id]}" alt="">${s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}${dur}`;
}
function tipHTML(id, s) {
  const inf = info(id); if (!inf) return '';
  let extra = '';
  const t = toolOf(id), a = armorOf(id), dm = durOf(id); if (dm && s) extra = `<div class="tl">내구도: ${dm - (s.dmg || 0)} / ${dm}</div>`;
  else if (inf.food) extra = `<div class="tl">허기 +${inf.food[0] / 2}</div>`;
  if (a) extra += `<div class="tl" style="color:#5555ff">방어력 +${a.def} (${ARMOR_SLOT_NAME[a.slot]})</div>`;
  if (inf.gadget === 'compass') extra += '<div class="tl">들고 있으면 리스폰 지점 방향을 알려줘요</div>';
  if (inf.gadget === 'clock') extra += '<div class="tl">들고 있으면 시간을 알려줘요</div>';
  if (t && t.aspd) extra += `<div class="tl" style="color:#55ff55">공격력 ${t.dmg} · 공격 속도 ${t.aspd}</div>`;
  return `<div>${esc(inf.name)}</div>${extra}`;
}
let nameTimer = 0, infoT = 0;
function updateHUD(dt) {
  if (!G) return;
  const st = SAVE.settings;
  if (invDirty) {
    invDirty = false;
    root.querySelectorAll('[data-hot]').forEach((el, i) => { el.innerHTML = slotHTML(G.inv[i]); });
    $('hotbar').style.setProperty('--sel', G.sel); updateArmorBar();
    const oh = $('offhot'); oh.innerHTML = slotHTML(G.off); oh.style.display = G.off ? 'flex' : 'none';
    if (TEL.swap) TEL.swap.classList.toggle('cond-off', !G.off);
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
    updateArmorBar();
  }
  $('sleepov').style.opacity = G.sleep > 0 ? Math.min(1, G.sleep / 1.6) : G.sleep < 0 ? -G.sleep : 0;
  { const ai = $('atkind'), str = attackStrength(), show = !G.ui && !classicCombat() && st.attackIndicator !== false && str < 0.999 && camView !== 2; ai.style.display = show ? 'block' : 'none'; if (show) ai.firstChild.style.width = (str * 100).toFixed(0) + '%'; }
  updateGadget();
  const bubbles = Math.ceil(P.airT / 1.5);
  const air = $('air');
  if (surv && P.airT < 15) { air.style.visibility = 'visible'; [...air.children].forEach((im, i) => { im.src = HUDICON.bubble; im.style.visibility = i < bubbles ? 'visible' : 'hidden'; }); } else air.style.visibility = 'hidden';
  if (G.hurtFlash > 0) { G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.5); }
  $('flash').style.opacity = G.hurtFlash || 0;
  $('uw').style.display = P.eyeInWater ? 'block' : 'none';
  const eat = $('eat'); eat.style.display = P.eating > 0 ? 'block' : 'none'; if (P.eating > 0) eat.firstChild.style.width = Math.min(100, P.eating / 1.6 * 100) + '%';
  if (TEL.fly) { TEL.fly.classList.toggle('cond-off', G.mode !== 'creative'); TEL.fly.classList.toggle('on', P.flying); }
  if (TEL.down) TEL.down.classList.toggle('cond-off', !P.flying && !P.inWater);
  if (TEL.sneak) TEL.sneak.classList.toggle('on', touchSneak);
  if (TEL.sprint) TEL.sprint.classList.toggle('on', touchSprint);
  if (TEL.move && st.moveStyle === 'dpad') { const c = TEL.move.querySelector('.c'); if (c) c.classList.toggle('on', touchSneak); }
  // optional coordinate / FPS overlay
  infoT -= dt;
  if (infoT <= 0) {
    infoT = 0.25;
    const lines = [];
    if (st.showFps) lines.push(`${fpsShow} FPS`);
    if (st.showCoords) lines.push(`위치: ${Math.floor(P.x)}, ${Math.floor(P.y)}, ${Math.floor(P.z)}`, `${dayCount()}일째 · ${['북', '동', '남', '서'][((Math.round(P.yaw / (Math.PI / 2)) % 4) + 4) % 4]}쪽`);
    const hi = $('hinfo'); hi.style.display = lines.length && !showDebug ? 'flex' : 'none'; hi.innerHTML = lines.map(l => `<div>${esc(l)}</div>`).join('');
  }
  // chat fade
  for (const el of $('chatlog').children) { const age = (performance.now() - el.dataset.t) / 1000; el.style.opacity = G.ui === 'chat' ? 1 : age > 8 ? 0 : 1; }
  while ($('chatlog').children.length > 10) $('chatlog').firstChild.remove();
}
function updateArmorBar() {
  const ar = $('armor'), [def] = armorPoints(), show = def > 0 && G.mode === 'survival';
  ar.style.visibility = show ? 'visible' : 'hidden';
  if (show) [...ar.children].forEach((im, i) => { im.src = HUDICON[def >= i * 2 + 2 ? 'armor_full' : def >= i * 2 + 1 ? 'armor_half' : 'armor_empty']; });
}
let gadgetKey = '';
function updateGadget() {
  const el = $('iinfo'), s = held(), g = s && ITEM[s.id] && ITEM[s.id].gadget;
  let key = '', html = '';
  if (g === 'compass' && !G.ui) {
    const dx = G.spawn.x - P.x, dz = G.spawn.z - P.z, d = Math.hypot(dx, dz), a = Math.atan2(dx, -dz) - P.yaw;
    key = 'c' + Math.round(d) + ',' + Math.round(a * 20);
    html = `<i class="ndl" style="transform:rotate(${a.toFixed(2)}rad)"></i><span>${d < 2 ? '리스폰 지점이에요' : `리스폰 지점까지 ${Math.round(d)}m`}</span>`;
  } else if (g === 'clock' && !G.ui) {
    const tt = W.time % DAY_TICKS, mins = Math.floor(((tt / 1000 + 6) % 24) * 60), hh = Math.floor(mins / 60), mm = mins % 60;
    const ph = tt < 12000 ? '낮' : tt < 13800 ? '해 질 녘' : tt < 22200 ? '밤' : '새벽';
    key = 't' + hh + ':' + mm; html = `<span>${dayCount()}일째 · ${ph} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`;
  }
  if (key === gadgetKey) return; gadgetKey = key;
  el.style.display = key ? 'flex' : 'none'; if (key) el.innerHTML = html;
}
let toastT = 0;
function toast(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { if (t.isConnected) t.style.opacity = 0; }, 2600); }
function chat(msg, color) { const d = document.createElement('div'); d.textContent = msg; d.dataset.t = performance.now(); if (color) d.style.color = color; $('chatlog').append(d); }
function buzz(ms) { if (SAVE && SAVE.settings.vibrate && touchUI() && navigator.vibrate) { try { navigator.vibrate(ms); } catch { } } }

// ── screen management ──
let cursorStack = null, quickMove = false, oneMode = false, creativeTab = '전체', creativeSearch = '';
let rbOpen = null, rbTab = '전체', rbSearch = '', rbCraftable = false, rbPage = 0, ghost = null;
function openScreen(kind) {
  if (G.ui === 'death') return;
  input.mine = input.use = input.jump = false; input.fwd = input.side = 0; input.sprintKey = touchSprint; resetTouchHolds(); P.mining = null;
  P.draw = 0; P.eating = 0; // opening a screen mid-draw used to fire the arrow from inside the inventory
  if (kind === 'table') G.craft = Array(9).fill(null), G.craftW = 3;
  else if (kind === 'inventory') G.craft = Array(4).fill(null), G.craftW = 2;
  G.ui = kind === 'table' || kind === 'inventory' || kind === 'creative' ? kind : (kind === 'furnace' || kind === 'chest') ? 'container' : kind;
  G.uiKind = kind; ghost = null; rbPage = 0;
  if (rbOpen === null) rbOpen = SAVE.settings.recipeBook ?? !($('mc').classList.contains('narrow') || ($('mc').classList.contains('short') && touchUI()));
  releasePointer();
  renderScreen();
}
function closeScreen() {
  if (!G) return;
  // return items in craft grid and cursor
  if (G.craft) { for (const s of G.craft) if (s) { const l = addToInventory(s.id, s.count, s.dmg); if (l) spawnItem(s.id, l, P.x, P.y + 1.2, P.z, s.dmg); } G.craft = null; }
  if (cursorStack) { const l = addToInventory(cursorStack.id, cursorStack.count, cursorStack.dmg); if (l) spawnItem(cursorStack.id, l, P.x, P.y + 1.2, P.z, cursorStack.dmg); cursorStack = null; }
  if (G.ui === 'container') G.container = null;
  G.ui = null; G.uiKind = null; ghost = null;
  hideScreens(); invChanged();
  capture();
}
function hideScreens() { menuScreen = null; const s = $('screen'); s.hidden = true; s.className = 'screen'; s.innerHTML = ''; $('cursor').innerHTML = ''; $('tip').style.display = 'none'; if (G && G.ui !== 'title') G.ui = null; }
function slotEl(ref, cls = '') { return `<div class="slot ${cls}" data-slot="${ref}"></div>`; }
function invGrid() {
  return `<div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('inv:' + (i + 9))).join('')}</div><div class="invgap"></div>
  <div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>`;
}
const touchTools = () => `<div class="mobtools"><button class="tgl ${quickMove ? 'on' : ''}" data-act="quick">빠른 이동</button><button class="tgl ${oneMode ? 'on' : ''}" data-act="one">1개씩</button></div>`;
const contHead = (title, extra = '') => `<div class="chead"><span class="ctitle">${title}</span>${extra}<span class="sp"></span>${touchTools()}<button class="xbtn" data-act="close" aria-label="닫기" title="닫기 (E)"></button></div>`;
const RB_TABS = [['전체', null], ['도구', ['도구', '전투']], ['블록', ['블록', '장식', '기능']], ['기타', ['재료', '음식']]];
function recipeBookHTML() {
  return `<div class="panel rbook" aria-label="레시피 책"><div class="rhead"><input class="mfield" id="rsearch" placeholder="검색..." value="${esc(rbSearch)}" aria-label="레시피 검색"><button class="tgl ${rbCraftable ? 'on' : ''}" data-act="rfilter" title="제작 가능한 것만 보기">제작 가능</button></div>
  <div class="rtabs">${RB_TABS.map(([t]) => `<button class="rtab ${t === rbTab ? 'on' : ''}" data-act="rtab" data-t="${t}">${t}</button>`).join('')}</div>
  <div class="rgrid" id="recipes"></div>
  <div class="rpage"><button class="pg prev" data-act="rprev" aria-label="이전 쪽"></button><span id="rpg">1/1</span><button class="pg" data-act="rnext" aria-label="다음 쪽"></button></div></div>`;
}
const CR_TABS = [['블록', BRICKS], ['장식', FLOWER_RED], ['기능', CHEST], ['도구', PICK0 + 2], ['전투', ARMOR0 + 9], ['음식', APPLE], ['재료', IRON]];
function renderScreen() {
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-cont'; menuScreen = 'cont';
  const k = G.uiKind; recipeCache = null;
  if (k === 'inventory' || k === 'table') {
    const w = G.craftW;
    s.innerHTML = `<div class="cwrap">${rbOpen ? recipeBookHTML() : ''}<div class="panel" role="dialog" aria-label="${k === 'table' ? '작업대' : '인벤토리'}">${contHead('제작', `<button class="bookbtn ${rbOpen ? 'on' : ''}" data-act="book" aria-label="레시피 책" title="레시피 책"></button>`)}
    <div class="craft">${k === 'inventory' ? `<div class="armcol" title="갑옷">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><div class="pcol"><canvas class="pview" id="pview" width="16" height="32" aria-label="내 캐릭터"></canvas>${slotEl('off:0')}</div>` : ''}<span class="sp"></span><div class="grid g${w}">${G.craft.map((_, i) => slotEl('craft:' + i)).join('')}</div><div class="carrow"></div>${slotEl('out', 'big')}</div>
    <div class="ctitle sub" id="invsub">인벤토리</div>${invGrid()}</div></div>`;
    const inp = $('rsearch'); if (inp) { inp.addEventListener('input', () => { rbSearch = inp.value; rbPage = 0; renderRecipes(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'creative') {
    const tab = creativeTab, title = tab === '전체' ? '아이템 검색' : tab === '인벤토리' ? '생존 인벤토리' : tab;
    const tabBtn = (t, icon, name) => `<button class="crtab ${t === tab ? 'on' : ''}" data-tab="${t}" data-name="${name || t}" aria-label="${name || t}"><img class="ico" src="${icon}" alt=""></button>`;
    s.innerHTML = `<div class="cr"><div class="crtabs">${CR_TABS.map(([t, id]) => tabBtn(t, ICON[id])).join('')}<span class="sp"></span>${tabBtn('전체', UIT.i_search, '아이템 검색')}</div>
    <div class="panel crp" role="dialog" aria-label="크리에이티브 인벤토리">${contHead(title)}
    ${tab === '인벤토리' ? `<div class="hotrow" style="margin:0 0 ${u(3)}"><span class="ctitle" id="invsub">갑옷</span><span class="sp"></span><div class="armrow">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><span class="ctitle">왼손</span>${slotEl('off:0')}</div>` + invGrid() + `<div class="hotrow"><span class="sp"></span><span class="ctitle">버리기</span>${slotEl('trash', 'trash')}</div>`
      : `${tab === '전체' ? `<input class="mfield csearch" id="csearch" placeholder="아이템 검색..." value="${esc(creativeSearch)}" aria-label="아이템 검색">` : ''}<div class="palette" id="palette"></div>
      <div class="hotrow"><div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>${slotEl('trash', 'trash')}</div>`}</div>
    <div class="crtabs bot"><span class="sp"></span>${tabBtn('인벤토리', ICON[CHEST], '생존 인벤토리')}</div></div>`;
    renderPalette();
    const inp = $('csearch'); if (inp) { inp.addEventListener('input', () => { creativeSearch = inp.value; renderPalette(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'furnace') {
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="화로">${contHead('화로')}
    <div class="furn"><div class="fcol">${slotEl('c:0')}<div class="flame"><i id="fflame"></i></div>${slotEl('c:1')}</div><div class="carrow"><i id="farrow"></i></div>${slotEl('c:2', 'big')}</div>
    <div class="ctitle sub">인벤토리</div>${invGrid()}</div></div>`;
  } else if (k === 'chest') {
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="상자">${contHead('상자')}
    <div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('c:' + i)).join('')}</div><div class="ctitle sub">인벤토리</div>${invGrid()}</div></div>`;
  }
  if (touchUI()) s.insertAdjacentHTML('beforeend', '<div class="touch-held" id="touchHeld" role="status"></div>');
  renderSlots();
}
function ghostMap() {
  if (ghost == null || !G.craft) return null;
  const r = RECIPES[ghost], m = {}, rep = k => typeof k === 'string' ? GROUP[k][0] : k;
  if (r.items) r.items.forEach((k, i) => { m[i] = rep(k); });
  else r.pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ' ') m[y * G.craftW + x] = rep(r.keys[row[x]]); });
  return m;
}
function renderSlots() {
  const s = $('screen'); if (s.hidden) return;
  const gm = ghostMap();
  s.querySelectorAll('[data-slot]').forEach(el => {
    const r = el.dataset.slot; if (r.startsWith('pal:') || r === 'trash') return;
    const st = getSlot(r);
    if (r.startsWith('craft:')) { const gi = +r.slice(6), gid = gm && !st ? gm[gi] : null; el.classList.toggle('ghosted', gid != null); el.innerHTML = st ? slotHTML(st) : gid != null ? `<img class="ico ghost" src="${ICON[gid]}" alt="">` : ''; return; }
    if (r === 'off:0') { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${UIT.shield}" alt="">`; el.title = '왼손'; return; }
    if (r.startsWith('arm:')) { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${ICON[ARMOR0 + 8 + +r.slice(4)]}" alt="">`; el.title = ARMOR_SLOT_NAME[+r.slice(4)]; return; }
    el.innerHTML = slotHTML(st);
  });
  const out = s.querySelector('[data-slot="out"]');
  if (out) { const r = craftResult(); out.classList.toggle('ghosted', !r && ghost != null); out.innerHTML = r ? slotHTML(r) : ghost != null ? `<img class="ico ghost" src="${ICON[RECIPES[ghost].out]}" alt="">` : ''; }
  $('cursor').innerHTML = slotHTML(cursorStack);
  const held = $('touchHeld'); if (held) { held.innerHTML = cursorStack ? `<span class="held-slot">${slotHTML(cursorStack)}</span><span>${esc(info(cursorStack.id).name)} · 놓을 칸을 누르거나, 끌어서 여러 칸에 나눠 놓으세요</span>` : '<span>끌어서 옮기기 · 길게 눌러 반 나누기 · 두 번 탭해 빠른 이동</span>'; }
  const pv = $('pview'); if (pv) drawPortrait(pv, G.armor);
  const sub = $('invsub'); if (sub && G.armor) { const [def] = armorPoints(); sub.textContent = (G.uiKind === 'creative' ? '갑옷' : '인벤토리') + (def ? ` · 방어력 ${def}` : ''); }
  if (G.uiKind === 'furnace' && G.container) { const te = G.container.te; const f = $('fflame'), a = $('farrow'); if (f) f.style.height = (te.burn > 0 ? te.burn / te.burnMax * 100 : 0) + '%'; if (a) a.style.width = (te.cook / SMELT_TIME * 100) + '%'; }
  if (G.uiKind === 'inventory' || G.uiKind === 'table') renderRecipes();
}
function getSlot(ref) {
  const [k, i] = ref.split(':');
  if (k === 'inv') return G.inv[+i];
  if (k === 'craft') return G.craft[+i];
  if (k === 'c') return G.container.te.slots[+i];
  if (k === 'arm') return G.armor[+i];
  if (k === 'off') return G.off;
  if (k === 'out') return craftResult();
  return null;
}
function setSlot(ref, v) {
  const [k, i] = ref.split(':');
  if (k === 'inv') G.inv[+i] = v; else if (k === 'craft') G.craft[+i] = v; else if (k === 'c') G.container.te.slots[+i] = v; else if (k === 'arm') G.armor[+i] = v; else if (k === 'off') G.off = v;
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
  const am = armorOf(st.id);
  if (k === 'inv' && am && (G.uiKind === 'inventory' || G.uiKind === 'creative') && !G.armor[am.slot]) { G.armor[am.slot] = st; setSlot(ref, null); sfx('equip'); return; }
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
  if (ghost != null && !ref.startsWith('pal:')) ghost = null;
  if (ref === 'trash') { if (shift && G.mode === 'creative') { for (let i = 0; i < 36; i++) G.inv[i] = null; } cursorStack = null; renderSlots(); invChanged(); return; }
  if (ref.startsWith('pal:')) {
    const id = +ref.slice(4);
    if (cursorStack) cursorStack = null;
    else if (shift) addToInventory(id, maxStack(id));
    else cursorStack = { id, count: right ? 1 : maxStack(id), dmg: 0 };
    renderSlots(); invChanged(); return;
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
  if (ref.startsWith('arm:')) {
    const ai = +ref.slice(4), st = G.armor[ai];
    if (shift) { if (st && !addToInventory(st.id, 1, st.dmg)) G.armor[ai] = null; }
    else if (cursorStack) {
      const a = armorOf(cursorStack.id);
      if (!a || a.slot !== ai) { toast(ARMOR_SLOT_NAME[ai] + ' 칸에는 ' + ARMOR_SLOT_NAME[ai] + ' 갑옷만 넣을 수 있어요.'); return; }
      G.armor[ai] = cursorStack; cursorStack = st; sfx('equip');
    } else if (st) { cursorStack = st; G.armor[ai] = null; }
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
function recipeList() {
  const seen = new Set(), list = [];
  for (const r of RECIPES) { if (r.pattern && (r.pattern.length > G.craftW || Math.max(...r.pattern.map(s => s.length)) > G.craftW)) continue; if (seen.has(r.out)) continue; seen.add(r.out); list.push(r); }
  return list;
}
function renderRecipes() {
  const el = $('recipes'); if (!el) return;
  const q = rbSearch.trim(), tab = RB_TABS.find(t => t[0] === rbTab) || RB_TABS[0];
  let list = recipeList().filter(r => { const inf = info(r.out); if (q && !inf.name.includes(q)) return false; return !tab[1] || tab[1].includes(inf.cat || '블록'); });
  const ok = new Map(list.map(r => [r, canFill(r)]));
  if (rbCraftable) list = list.filter(r => ok.get(r));
  list.sort((a, b) => ok.get(b) - ok.get(a));
  const pages = Math.max(1, Math.ceil(list.length / 20)); rbPage = clamp(rbPage, 0, pages - 1);
  const key = [rbTab, q, rbCraftable, rbPage, G.craftW, list.map(r => RECIPES.indexOf(r) + (ok.get(r) ? '+' : '-')).join(',')].join('|');
  if (recipeCache === key && el.children.length) return;
  recipeCache = key;
  el.innerHTML = list.slice(rbPage * 20, rbPage * 20 + 20).map(r => `<div class="rslot ${ok.get(r) ? 'ok' : 'no'}" data-recipe="${RECIPES.indexOf(r)}" data-name="${esc(info(r.out).name)}${r.count > 1 ? ' ×' + r.count : ''}"><img class="ico" src="${ICON[r.out]}" alt="">${r.count > 1 ? `<span class="cnt">${r.count}</span>` : ''}</div>`).join('')
    || `<p class="rempty">${rbCraftable ? '지금 만들 수 있는 게 없어요' : '결과가 없어요'}</p>`;
  const pg = $('rpg'); if (pg) pg.textContent = `${rbPage + 1}/${pages}`;
  const sc = $('screen'); const pv = sc.querySelector('[data-act="rprev"]'), nx = sc.querySelector('[data-act="rnext"]'); if (pv) pv.disabled = rbPage <= 0; if (nx) nx.disabled = rbPage >= pages - 1;
}
function fillRecipe(ri) {
  const r = RECIPES[ri];
  // tapping the same recipe again adds one more set to every filled grid cell
  const cur = craftResult();
  if (cur && cur.id === r.out && ghost == null) {
    const need = {}; G.craft.forEach(s => { if (s) need[s.id] = (need[s.id] || 0) + 1; });
    if (G.craft.some(s => s && s.count >= maxStack(s.id))) { toast('더 이상 넣을 수 없어요.'); return; }
    for (const id in need) if (G.inv.reduce((a, s) => a + (s && s.id === +id ? s.count : 0), 0) < need[id]) { toast('재료가 부족해서 더 넣을 수 없어요.'); return; }
    for (const s of G.craft) if (s) { const i = G.inv.findIndex(x => x && x.id === s.id); G.inv[i].count--; if (!G.inv[i].count) G.inv[i] = null; s.count++; }
    renderSlots(); invChanged(); return;
  }
  if (!canFill(r)) {
    const names = {}; for (const k of recipeNeeds(r)) { const n = typeof k === 'string' ? ({ log: '아무 원목', planks: '나무 판자', wool: '양털' })[k] : info(k).name; names[n] = (names[n] || 0) + 1; }
    ghost = ri; renderSlots();
    toast('필요: ' + Object.entries(names).map(([n, c]) => `${n} ×${c}`).join(', ')); return;
  }
  ghost = null;
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
  const q = creativeTab === '전체' ? creativeSearch.trim() : '';
  const list = ids.filter(id => { const inf = info(id); if (q && !inf.name.includes(q)) return false; if (creativeTab === '전체') return true; return (inf.cat || '블록') === creativeTab; });
  el.innerHTML = list.map(id => `<div class="slot" data-slot="pal:${id}" data-name="${esc(info(id).name)}"><img class="ico" src="${ICON[id]}" alt=""></div>`).join('') || '<p class="pe">결과가 없어요.</p>';
}
let lastPtrSlot = 0;
function screenEvents() {
  const s = $('screen');
  const handle = (e, right) => {
    const sl = e.target.closest('[data-slot]'), rc = e.target.closest('[data-recipe]'), act = e.target.closest('[data-act]'), tab = e.target.closest('[data-tab]'), opt = e.target.closest('[data-opt]');
    if (e.target.closest('button,.we,[data-recipe]')) uiClick();
    if (sl && G && G.ui) { if (performance.now() - lastPtrSlot > 900) slotClick(sl.dataset.slot, right, e.shiftKey); return; }
    if (rc) { fillRecipe(+rc.dataset.recipe); return; }
    if (tab) { creativeTab = tab.dataset.tab; renderScreen(); return; }
    if (opt && opt.tagName === 'BUTTON') { cycleOpt(opt.dataset.opt, e.shiftKey ? -1 : 1, opt); return; }
    if (act && !act.disabled) menuAction(act.dataset.act, act, e);
  };
  ctx.on(s, 'click', e => handle(e, false));
  ctx.on(s, 'dblclick', e => { const w = e.target.closest('.we'); if (w) { selectedWorld = w.dataset.id; menuAction('play'); } });
  ctx.on(s, 'contextmenu', e => { e.preventDefault(); }); // right clicks on slots are handled by the pointer code below
  ctx.on(s, 'input', e => { const sl = e.target.closest('.slider [data-opt]'); if (sl) setOpt(sl.dataset.opt, +sl.value, sl); });
  ctx.on(s, 'pointermove', e => {
    const r = $('mc').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = $('cursor'); cur.style.left = x + 'px'; cur.style.top = y + 'px';
    const tip = $('tip'), el = e.target.closest('[data-slot],[data-recipe],.crtab');
    let html = '';
    if (el) {
      if (el.dataset.slot === 'out') { const o = craftResult(); if (o) html = tipHTML(o.id, o); else if (ghost != null) html = tipHTML(RECIPES[ghost].out); }
      else if (el.dataset.slot && el.dataset.slot.startsWith('pal:')) html = tipHTML(+el.dataset.slot.slice(4));
      else if (el.dataset.slot === 'trash') html = '<div>아이템 버리기</div>';
      else if (el.dataset.slot) { const st = getSlot(el.dataset.slot); if (st) html = tipHTML(st.id, st); }
      else if (el.dataset.recipe) { const rr = RECIPES[+el.dataset.recipe]; html = tipHTML(rr.out) + (canFill(rr) ? '' : '<div class="tl" style="color:#ff5555">재료가 부족해요</div>'); }
      else if (el.dataset.name) html = `<div>${esc(el.dataset.name)}</div>`;
    }
    if (html && e.pointerType === 'mouse' && !cursorStack) { tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 4) + 'px'; tip.style.top = Math.max(2, y - tip.offsetHeight - 6) + 'px'; } else tip.style.display = 'none';
  });
  // ── slot drag & drop (touch and mouse) ──
  // tap: pick up / put down · drag a stack: carry it to another slot (swaps if occupied, leftovers go back)
  // drag while already holding a stack: spread it evenly over every slot you cross (1 each in "1개씩" mode)
  // long-press: take half / place one · long-press the craft result: craft as many as possible
  // double-tap: quick-move to the other section · palette: swipe to scroll, hold then drag to take
  let D = null, lastTap = null;
  const placeable = r => !!r && !r.startsWith('pal:') && r !== 'out' && r !== 'trash' && !(r === 'c:2' && G.uiKind === 'furnace');
  const canSpread = r => placeable(r) && !r.startsWith('arm:') && !!cursorStack && (!getSlot(r) || (same(getSlot(r), cursorStack) && getSlot(r).count < maxStack(cursorStack.id)));
  const slotAt = (x, y) => { const rn = root.getRootNode ? root.getRootNode() : document, h = (rn && rn.elementFromPoint ? rn : document).elementFromPoint(x, y), el = h && h.closest ? h.closest('[data-slot]') : null; return el && s.contains(el) ? el : null; };
  const slotNode = r => s.querySelector(`[data-slot="${r}"]`);
  const clearHL = () => s.querySelectorAll('.slot.hl').forEach(e => e.classList.remove('hl', 'spread'));
  const dragCur = (on, x, y) => { const c = $('cursor'); c.classList.toggle('drag', on && D && D.touch); if (x != null) { const r = $('mc').getBoundingClientRect(); c.style.left = (x - r.left) + 'px'; c.style.top = (y - r.top) + 'px'; } };
  // Long-press is decided from the events' own timestamps, not from the timer firing first, so a busy
  // frame on a slow phone can't turn a quick drag into a long-press. The timer only gives feedback.
  const LONG_MS = 420;
  const isLong = (d, ts) => d.touch && !quickMove && ts - d.t0 >= LONG_MS;
  const longFeedback = d => { if (D !== d || d.moved || !G || !G.ui) return; buzz(15); d.el.classList.add('hl'); };
  const startDrag = (d, ts) => {
    if (isLong(d, ts) && !d.pal && d.ref !== 'out' && !d.had && getSlot(d.ref)) { slotClick(d.ref, true, false); d.mode = 'carry'; return; } // hold, then drag = take half
    if (isLong(d, ts) && d.pal) { const id = +d.ref.slice(4); cursorStack = { id, count: maxStack(id), dmg: 0 }; d.mode = 'carry'; renderSlots(); return; }
    if (d.pal) { if (Math.abs(d.y - d.y0) > Math.abs(d.x - d.x0)) { d.mode = 'scroll'; d.scrollEl = d.el.closest('.palette'); d.st0 = d.scrollEl ? d.scrollEl.scrollTop : 0; return; } const id = +d.ref.slice(4); cursorStack = { id, count: d.right ? 1 : maxStack(id), dmg: 0 }; d.mode = 'carry'; renderSlots(); return; }
    if (d.had && cursorStack) { d.mode = 'spread'; if (canSpread(d.ref)) d.visited.push(d.ref); return; }
    if (d.ref === 'out' ? !craftResult() : !getSlot(d.ref) || d.ref === 'trash') { d.mode = 'scroll'; d.scrollEl = s; d.st0 = s.scrollTop; return; }
    slotClick(d.ref, d.right, false); d.mode = cursorStack ? 'carry' : null;
  };
  ctx.on(s, 'pointerdown', e => {
    if (!G || !G.ui || D) return;
    const sl = e.target.closest('[data-slot]'); if (!sl) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const ref = sl.dataset.slot, touch = e.pointerType !== 'mouse';
    D = { pid: e.pointerId, ref, el: sl, t0: e.timeStamp, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch, right: e.button === 2, shift: e.shiftKey, moved: false, mode: null, had: !!cursorStack, visited: [], pal: ref.startsWith('pal:') };
    if (touch && !quickMove) { const d = D; d.timer = ctx.timeout(() => longFeedback(d), LONG_MS); }
    try { s.setPointerCapture(e.pointerId); } catch { }
  });
  ctx.on(s, 'pointermove', e => {
    const d = D; if (!d || d.pid !== e.pointerId) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(d.x - d.x0, d.y - d.y0) > (d.touch ? 9 : 4)) { d.moved = true; clearTimeout(d.timer); d.el.classList.remove('hl'); startDrag(d, e.timeStamp); }
    if (d.mode === 'scroll') { if (d.scrollEl) d.scrollEl.scrollTop = d.st0 - (d.y - d.y0); return; }
    if (!d.mode) return;
    clearHL(); dragCur(true, d.x, d.y);
    const tg = slotAt(d.x, d.y), tr = tg && tg.dataset.slot;
    if (d.mode === 'spread') {
      if (tr && !d.visited.includes(tr) && canSpread(tr)) d.visited.push(tr);
      d.visited.forEach(r => { const n = slotNode(r); if (n) n.classList.add('hl', 'spread'); });
    } else if (tg) tg.classList.add('hl');
  });
  const spread = (list, one) => {
    const per = one ? 1 : Math.max(1, Math.floor(cursorStack.count / list.length));
    for (const r of list) {
      if (!cursorStack) break;
      const cur = getSlot(r), k = Math.min(per, maxStack(cursorStack.id) - (cur ? cur.count : 0), cursorStack.count); if (k <= 0) continue;
      if (cur) cur.count += k; else setSlot(r, { id: cursorStack.id, count: k, dmg: cursorStack.dmg });
      cursorStack.count -= k; if (!cursorStack.count) cursorStack = null;
    }
  };
  const endDrag = e => {
    const d = D; if (!d || d.pid !== e.pointerId) return;
    D = null; clearTimeout(d.timer); clearHL(); dragCur(false); lastPtrSlot = performance.now();
    if (!G || !G.ui) return;
    // put whatever is still held back where it came from (merging with what stayed there)
    const back = () => {
      if (!cursorStack || !placeable(d.ref)) return;
      const o = getSlot(d.ref);
      if (!o) { setSlot(d.ref, cursorStack); cursorStack = null; }
      else if (same(o, cursorStack)) { const k = Math.min(maxStack(o.id) - o.count, cursorStack.count); o.count += k; cursorStack.count -= k; if (!cursorStack.count) cursorStack = null; }
    };
    if (e.type === 'pointercancel') { if (d.mode === 'carry') back(); renderSlots(); invChanged(); return; }
    if (!d.moved) {
      if (isLong(d, e.timeStamp)) { slotClick(d.ref, true, d.ref === 'out'); return; } // half / one · craft all on the result
      const now = e.timeStamp, dbl = d.touch && lastTap && lastTap.ref === d.ref && now - lastTap.t < 380 && lastTap.picked;
      const before = !!cursorStack, hadItem = !!getSlot(d.ref);
      slotClick(d.ref, d.right, d.shift);
      if (dbl && placeable(d.ref) && !cursorStack && getSlot(d.ref)) { shiftMove(d.ref); lastTap = null; renderSlots(); invChanged(); return; }
      lastTap = { ref: d.ref, t: now, picked: !before && hadItem && !!cursorStack };
      return;
    }
    const tg = slotAt(e.clientX, e.clientY), tr = tg && tg.dataset.slot;
    if (d.mode === 'carry') {
      if (tr && tr !== d.ref) { slotClick(tr, false, false); back(); }
      else if (d.pal) cursorStack = null;
      else back();
    } else if (d.mode === 'spread') {
      const list = d.visited.filter(canSpread);
      if (list.length > 1) spread(list, d.right || oneMode);
      else if (tr) slotClick(tr, d.right, false);
    }
    renderSlots(); invChanged();
  };
  ctx.on(s, 'pointerup', endDrag); ctx.on(s, 'pointercancel', endDrag);
}

// ── menus ──
let menuScreen = null, selectedWorld = null, createFrom = 'title', worldFilter = '';
function screenHTML(inner, bg = G ? 'game' : 'dirt') { const s = $('screen'); s.hidden = false; s.className = 'screen bg-' + bg; s.style.background = ''; s.innerHTML = inner; s.scrollTop = 0; }
function uiClick() { if (SAVE && SAVE.settings.uiSound !== false) { wake(); sfx('click'); } }
function showLanding() {
  G = null; W = null; menuScreen = 'landing';
  screenHTML(`<div class="tw"><div class="logo"><h1 aria-label="Minecraft Mini"><span class="lb" aria-hidden="true">MINECRAFT</span><span class="lf" aria-hidden="true">MINECRAFT</span></h1><div class="edition">MINI</div><div class="splash"><span>${esc(SPLASH[Math.floor(Math.random() * SPLASH.length)])}</span></div></div>
  <div class="tmenu"><button class="btn" data-act="worlds">싱글플레이</button><button class="btn" data-act="new">새로운 월드 만들기</button><button class="btn" data-act="help">조작법</button><div class="gap"></div>
  <div class="row"><button class="btn sq" data-act="layout" aria-label="터치 버튼 배치" title="터치 버튼 배치"><img src="${UIT.i_grid}" alt=""></button><button class="btn" data-act="settings">설정...</button><button class="btn sq" data-act="full" aria-label="전체화면" title="전체화면"><img src="${UIT.i_full}" alt=""></button></div></div>
  <div class="corner l">Minecraft Mini 2.0</div><div class="corner r">자체 제작 텍스처 · 원작 리소스 미사용</div></div>`, 'pano');
}
function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const DIFF_NAME = ['평화로움', '쉬움', '보통', '어려움'];
function showTitle() {
  G = null; W = null; menuScreen = 'worlds';
  const worlds = SAVE.worlds.slice().sort((a, b) => b.played - a.played);
  if (!selectedWorld || !worlds.find(w => w.id === selectedWorld)) selectedWorld = worlds[0] ? worlds[0].id : null;
  screenHTML(`<div class="ms full"><div class="mtitle">월드 선택</div><input class="mfield" id="wsearch" placeholder="검색..." value="${esc(worldFilter)}" aria-label="월드 검색" style="margin-bottom:${u(6)}">
  <div class="mlist"><div class="wl" role="listbox" aria-label="저장된 월드">${worlds.length ? worlds.map(w => `<div class="we ${w.id === selectedWorld ? 'sel' : ''}" data-act="pick" data-id="${w.id}" data-n="${esc(w.name.toLowerCase())}" role="option" aria-selected="${w.id === selectedWorld}">
    <div class="wi"><img src="${ICON[w.mode === 'creative' ? GRASS : DIAMOND_ORE]}" alt=""></div><div class="wt"><div>${esc(w.name)}</div><div class="ws">${fmtDate(w.played)}</div><div class="ws">${w.mode === 'creative' ? '크리에이티브' : '서바이벌'} 모드 · ${DIFF_NAME[w.difficulty ?? 2]} · 시드 ${esc(w.seedText)}</div></div></div>`).join('') : '<p class="empty">아직 월드가 없어요.<br>새로운 월드를 만들어 보세요!</p>'}</div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="play" ${selectedWorld ? '' : 'disabled'}>선택한 월드 플레이</button><button class="btn" data-act="new">새로운 월드 만들기</button></div>
  <div class="row w308"><button class="btn" data-act="delete" ${selectedWorld ? '' : 'disabled'}>삭제</button><button class="btn" data-act="title">취소</button></div>
  ${SAVE.storage ? '' : '<p class="desc">이 환경에서는 저장소를 쓸 수 없어 월드가 저장되지 않아요.</p>'}</div></div>`, 'dirt');
  const inp = $('wsearch'), filt = () => { worldFilter = inp.value; const q = worldFilter.trim().toLowerCase(); root.querySelectorAll('.we').forEach(e => { e.hidden = !!q && !e.dataset.n.includes(q); }); };
  inp.addEventListener('input', filt); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); filt();
}
function showDeleteConfirm() {
  const w = SAVE.worlds.find(x => x.id === selectedWorld); if (!w) return showTitle();
  menuScreen = 'confirmDelete';
  screenHTML(`<div class="ms center"><div class="mtitle">이 월드를 삭제할까요?</div><p class="desc">'${esc(w.name)}' 월드가 영원히 사라져요. 되돌릴 수 없어요!</p><div class="row w308"><button class="btn" data-act="delYes">삭제</button><button class="btn" data-act="worlds">취소</button></div></div>`, 'dirt');
}
let createOpts = { mode: 'survival', difficulty: 2, bonus: false, tab: 'game' };
const MODE_DESC = { survival: '자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.', creative: '모든 블록을 무한히 쓰고, 날아다니며, 다치지 않아요. 몬스터도 공격하지 않아요.' };
function showCreate(from) {
  createFrom = from || (menuScreen === 'worlds' ? 'worlds' : 'title'); menuScreen = 'create';
  createOpts = { mode: 'survival', difficulty: 2, bonus: false, tab: 'game' };
  screenHTML(`<div class="ms full"><div class="mtitle">새로운 월드 만들기</div>
  <div class="ctabs"><button class="btn ctabb on" data-act="ctab" data-t="game">게임</button><button class="btn ctabb" data-act="ctab" data-t="world">월드</button></div>
  <div class="mlist"><div id="ctGame" style="display:flex;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wname">월드 이름</label><input class="mfield" id="wname" maxlength="32" value="새로운 세계${SAVE.worlds.length ? ' ' + (SAVE.worlds.length + 1) : ''}">
   <div style="height:${u(8)}"></div><button class="btn w200" data-act="cmode" id="cMode">게임 모드: 서바이벌</button><p class="desc" id="modeDesc">${MODE_DESC.survival}</p>
   <button class="btn w200" data-act="cdiff" id="cDiff">난이도: 보통</button><p class="desc" id="diffDesc">몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.</p></div>
  <div id="ctWorld" style="display:none;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wseed">월드 생성기 시드</label><input class="mfield" id="wseed" maxlength="24" placeholder="비워 두면 무작위 시드"><p class="desc">같은 시드를 쓰면 같은 지형이 만들어져요.</p>
   <button class="btn w200" data-act="cbonus" id="cBonus">보너스 아이템: 끔</button><p class="desc">서바이벌을 시작할 때 원목, 사과, 나무 도구를 받아요.</p></div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="create">새로운 월드 만들기</button><button class="btn" data-act="ccancel">취소</button></div></div></div>`, 'dirt');
  root.querySelectorAll('#screen input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Escape') return; e.stopPropagation(); if (e.key === 'Enter') menuAction('create'); }));
}
function updateCreate() {
  $('cMode').textContent = '게임 모드: ' + (createOpts.mode === 'creative' ? '크리에이티브' : '서바이벌');
  $('modeDesc').textContent = MODE_DESC[createOpts.mode];
  $('cDiff').textContent = '난이도: ' + DIFF_NAME[createOpts.difficulty];
  $('diffDesc').textContent = ['몬스터가 나타나지 않고, 체력과 배고픔이 저절로 회복돼요.', '몬스터가 적게 나타나고 피해도 적어요.', '몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.', '몬스터가 많고 아파요. 굶으면 죽을 수도 있어요!'][createOpts.difficulty];
  $('cBonus').textContent = '보너스 아이템: ' + (createOpts.bonus ? '켬' : '끔');
  root.querySelectorAll('.ctabb').forEach(b => b.classList.toggle('on', b.dataset.t === createOpts.tab));
  $('ctGame').style.display = createOpts.tab === 'game' ? 'flex' : 'none'; $('ctWorld').style.display = createOpts.tab === 'world' ? 'flex' : 'none';
}
function showPause() {
  if (!G || G.ui === 'death') return;
  G.ui = 'pause'; menuScreen = 'pause'; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="mtitle">게임 메뉴</div>
  <button class="btn w204" data-act="resume">게임으로 돌아가기</button>
  <div class="row w204"><button class="btn" data-act="help">조작법</button><button class="btn" data-act="stats">통계</button></div>
  <div class="row w204"><button class="btn" data-act="settings">설정...</button>${touchUI() ? '<button class="btn" data-act="layout">버튼 배치...</button>' : '<button class="btn" data-act="page" data-p="keys">키 설정...</button>'}</div>
  <button class="btn w204" data-act="quit">저장 후 타이틀 화면으로</button>
  <p class="minfo">${esc(G.world.name)} · ${G.mode === 'creative' ? '크리에이티브' : '서바이벌'} · ${DIFF_NAME[W.difficulty]} · ${dayCount()}일째</p></div>`, 'game');
  ctx.setPaused(true);
}
// ── settings ──
const pct = v => v + '%', vol = v => v == 0 ? '끔' : v + '%', sensF = v => Math.round(v / 8 * 100) + '%';
const OPTS = {
  fov: { l: '시야각', min: 30, max: 110, f: v => v == 70 ? '보통' : v == 110 ? '최대' : v },
  difficulty: { l: '난이도', v: [0, 1, 2, 3], n: DIFF_NAME },
  guiScale: { l: 'GUI 크기', v: [0, 1, 2, 3, 4], n: ['자동', '1', '2', '3', '4'] },
  brightness: { l: '밝기', min: 0, max: 100, f: v => v == 0 ? '기본' : v == 100 ? '밝게' : '+' + v + '%' },
  renderDist: { l: '시야 거리', min: 2, max: 10, f: v => v + ' 청크' },
  renderScale: { l: '렌더 해상도', min: 50, max: 100, step: 5, f: pct },
  maxFps: { l: '최대 프레임', v: [30, 60, 0], n: ['30 FPS', '60 FPS', '무제한'] },
  particles: { l: '파티클', v: [2, 1, 0], n: ['모두', '감소', '최소'] },
  clouds: { l: '구름', b: 1 }, bob: { l: '걷기 흔들림', b: 1 }, fovEffect: { l: '달리기 시야 효과', b: 1 }, hurtShake: { l: '피격·폭발 흔들림', b: 1 },
  volMaster: { l: '주 음량', min: 0, max: 100, step: 5, f: vol }, volMusic: { l: '음악', min: 0, max: 100, step: 5, f: vol }, volBlocks: { l: '블록', min: 0, max: 100, step: 5, f: vol },
  volMobs: { l: '생물', min: 0, max: 100, step: 5, f: vol }, volPlayer: { l: '플레이어', min: 0, max: 100, step: 5, f: vol }, uiSound: { l: '버튼 클릭음', b: 1 },
  sens: { l: '마우스 감도', min: 1, max: 20, f: sensF }, invertY: { l: '마우스 반전', b: 1 }, autoJump: { l: '자동 점프', b: 1 },
  sneakToggle: { l: '웅크리기', v: [false, true], n: ['누르기', '전환'] }, sprintToggle: { l: '달리기', v: [false, true], n: ['누르기', '전환'] },
  touchMode: { l: '터치 컨트롤', v: ['auto', 'on', 'off'], n: ['자동', '항상 표시', '숨김'] },
  moveStyle: { l: '이동 방식', v: ['joystick', 'dpad'], n: ['조이스틱', '방향 패드'] },
  joyFloat: { l: '조이스틱', v: [false, true], n: ['고정 위치', '터치한 곳'] },
  touchSens: { l: '터치 시점 감도', min: 1, max: 20, f: sensF }, btnSize: { l: '버튼 크기', min: 60, max: 160, step: 5, f: pct },
  touchOpacity: { l: '버튼 불투명도', min: 20, max: 100, step: 5, f: pct }, tapPlace: { l: '탭해서 설치', b: 1 },
  holdDelay: { l: '꾹 눌러 캐기', min: 150, max: 600, step: 25, f: v => (v / 1000).toFixed(2) + '초' }, vibrate: { l: '진동', b: 1 }, leftHanded: { l: '좌우 반전 배치', b: 1 },
  hudScale: { l: 'HUD 크기', min: 50, max: 150, step: 5, f: pct }, chatOpacity: { l: '채팅 불투명도', min: 10, max: 100, step: 5, f: pct },
  crosshair: { l: '조준점', b: 1 }, itemNames: { l: '아이템 이름', b: 1 }, showCoords: { l: '좌표 표시', b: 1 }, showFps: { l: 'FPS 표시', b: 1 }, chatShow: { l: '채팅 표시', b: 1 },
  menuBlur: { l: '메뉴 배경 흐림', min: 0, max: 10, f: v => v == 0 ? '끔' : v }, panoSpeed: { l: '타이틀 배경 속도', min: 0, max: 200, step: 10, f: v => v == 0 ? '정지' : v + '%' },
  combat: { l: '전투 방식', v: ['modern', 'classic'], n: ['공격 쿨다운', '연타 (구버전)'] }, attackIndicator: { l: '공격 게이지', b: 1 }, dmgNumbers: { l: '데미지 숫자', b: 1 },
};
const PAGES = {
  main: ['설정', () => [G ? 'fov' : 'fov*', G ? 'difficulty' : null, '@video|비디오 설정...', '@sound|음악 및 소리...', '@controls|조작...', '@keys|키 설정...', '@touch|터치 컨트롤...', '@iface|인터페이스...', '@char|캐릭터...', '@combat|전투...']],
  combat: ['전투', () => ['combat*', 'attackIndicator', 'dmgNumbers']],
  video: ['비디오 설정', () => ['guiScale', 'brightness', 'renderDist', 'renderScale', 'maxFps', 'particles', 'clouds', 'bob', 'fovEffect', 'hurtShake']],
  sound: ['음악 및 소리', () => ['volMaster*', 'volMusic', 'volBlocks', 'volMobs', 'volPlayer', 'uiSound*']],
  controls: ['조작', () => ['sens', 'invertY', 'autoJump', 'sneakToggle', 'sprintToggle', '@keys|키 설정...']],
  touch: ['터치 컨트롤', () => ['touchMode', 'moveStyle', 'joyFloat', 'touchSens', 'btnSize', 'touchOpacity', 'tapPlace', 'holdDelay', 'vibrate', 'leftHanded', '#버튼 배치', '!layout|버튼 배치 편집...', '!resetLayout|배치 초기화']],
  iface: ['인터페이스', () => ['hudScale', 'chatOpacity', 'crosshair', 'itemNames', 'showCoords', 'showFps', 'chatShow', 'menuBlur', 'panoSpeed*']],
};
const KEYDEF = [['#이동'], ['forward', '앞으로', 'KeyW'], ['back', '뒤로', 'KeyS'], ['left', '왼쪽', 'KeyA'], ['right', '오른쪽', 'KeyD'], ['jump', '점프', 'Space'], ['sneak', '웅크리기', 'ShiftLeft'], ['sprint', '달리기', 'ControlLeft'],
  ['#게임플레이'], ['inventory', '인벤토리 열기', 'KeyE'], ['drop', '아이템 버리기', 'KeyQ'], ['swap', '양손 바꾸기', 'KeyF'], ['view', '시점 전환', 'F5'], ['fly', '비행 전환 (크리에이티브)', 'KeyG'],
  ['#기타'], ['chat', '채팅 열기', 'KeyT'], ['command', '명령어 입력', 'Slash'], ['hideHud', 'HUD 숨기기', 'F1'], ['debug', '디버그 화면', 'F3']];
const DEFAULT_KEYS = Object.fromEntries(KEYDEF.filter(k => k[2]).map(k => [k[0], k[2]]));
function keyName(c) {
  if (!c) return '없음';
  const M = { Space: '스페이스', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', MetaLeft: '왼쪽 ⌘', MetaRight: '오른쪽 ⌘', Tab: 'Tab', Enter: 'Enter', Backspace: '백스페이스', CapsLock: 'Caps Lock', Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (M[c]) return M[c]; if (/^Key[A-Z]$/.test(c)) return c.slice(3); if (/^Digit\d$/.test(c)) return c.slice(5); if (/^Numpad/.test(c)) return '키패드 ' + c.slice(6); return c;
}
let setPage = 'main', keysParent = 'main', bindingKey = null;
const optGet = k => k === 'difficulty' ? (W ? W.difficulty : 2) : SAVE.settings[k];
function optLabel(k) { const o = OPTS[k], v = optGet(k); return o.b ? `${o.l}: ${v ? '켬' : '끔'}` : `${o.l}: ${o.n[Math.max(0, o.v.indexOf(v))]}`; }
function optHTML(tok) {
  const wide = tok.endsWith('*'); if (wide) tok = tok.slice(0, -1);
  const cls = wide ? ' wide' : '';
  if (tok[0] === '#') return `<div class="sect">${tok.slice(1)}</div>`;
  if (tok[0] === '@' || tok[0] === '!') { const [a, l] = tok.slice(1).split('|'); return tok[0] === '@' ? `<button class="btn${cls}" data-act="page" data-p="${a}">${l}</button>` : `<button class="btn${cls}" data-act="${a}">${l}</button>`; }
  const o = OPTS[tok], v = optGet(tok);
  if (o.min != null) return `<label class="slider${cls}"><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${v}" data-opt="${tok}" aria-label="${o.l}"><span class="lab">${o.l}: ${o.f ? o.f(v) : v}</span></label>`;
  return `<button class="btn${cls}" data-opt="${tok}">${optLabel(tok)}</button>`;
}
function setOpt(k, v, el) {
  SAVE.settings[k] = v;
  const o = OPTS[k]; if (el && el.nextElementSibling) el.nextElementSibling.textContent = `${o.l}: ${o.f ? o.f(v) : v}`;
  applyOpt(k);
}
function cycleOpt(k, dir, btn) {
  const o = OPTS[k], v = optGet(k);
  const nv = o.b ? !v : o.v[(o.v.indexOf(v) + dir + o.v.length) % o.v.length];
  if (k === 'difficulty') { if (!W) return; W.difficulty = nv; G.world.difficulty = nv; if (nv === 0) W.mobs = W.mobs.filter(m => !MOBDEF[m.type].hostile); }
  else SAVE.settings[k] = nv;
  if (btn) btn.textContent = optLabel(k);
  applyOpt(k);
}
function applyOpt(k) {
  if (G) G.settings = SAVE.settings;
  if (k === 'renderScale') resize();
  applyVisualSettings();
  if (k === 'touchMode' || k === 'moveStyle') renderTouch();
  saveSettingsSoon();
}
function showSettings(page = 'main') {
  setPage = page; menuScreen = 'settings';
  if (G) G.ui = 'settings';
  if (page === 'keys') return showKeys();
  if (page === 'char') return showCharacter();
  const [title, items] = PAGES[page];
  const desc = page === 'combat' ? `<p class="desc">공격 쿨다운: 무기마다 공격 속도가 있고, 게이지가 다 차야 최대 피해가 나요. 게이지가 찬 상태로 떨어지면서 때리면 치명타(×1.5), 달리면서 때리면 강한 밀치기, 검으로 땅에서 때리면 옆의 몹까지 휩쓸어요. 연타 방식은 쿨다운 없이 빠르게 때려요.</p>` : page === 'touch' ? `<p class="desc">'버튼 배치 편집'에서 버튼을 끌어 옮기고, 크기를 바꾸고, 숨길 수 있어요.${touchUI() ? '' : ' 지금은 터치 기기가 아니라서 버튼이 숨겨져 있어요.'}</p>` : '';
  screenHTML(`<div class="ms full"><div class="mtitle">${title}</div><div class="mlist">${desc}<div class="opts">${items().filter(Boolean).map(optHTML).join('')}</div></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">완료</button></div></div>`);
}
function showCharacter() {
  setPage = 'char'; menuScreen = 'settings'; if (G) G.ui = 'settings';
  const c = charOf(), rgb = a => `rgb(${a.join(',')})`, sw = a => `<i class="sw" style="background:${rgb(a)}"></i>`;
  const btn = (k, label) => `<button class="btn" data-act="charopt" data-k="${k}">${label}</button>`;
  screenHTML(`<div class="ms full"><div class="mtitle">캐릭터</div><div class="mlist"><div class="charwrap"><canvas class="pview big" id="charpv" width="16" height="32" aria-label="캐릭터 미리보기"></canvas>
  <div class="opts charopts"><div class="sect">기본 캐릭터</div>${CHAR_PRESETS.map((p, i) => `<button class="btn" data-act="charpreset" data-i="${i}">${p.name} (${p.model === 'slim' ? '슬림' : '클래식'})</button>`).join('')}
  <div class="sect">꾸미기</div>
  ${btn('model', `체형: ${c.slim ? '슬림 (얇은 팔)' : '클래식 (넓은 팔)'}`)}${btn('style', `머리 모양: ${c.style ? '긴 머리' : '짧은 머리'}`)}
  ${btn('skin', sw(CHAR_SKIN[c.skin]) + '피부색')}${btn('hair', sw(CHAR_HAIR[c.hair]) + '머리 색')}${btn('shirt', sw(CHAR_SHIRT[c.shirt]) + '상의 색')}${btn('pants', sw(CHAR_PANTS[c.pants]) + '하의 색')}</div></div>
  <p class="desc">3인칭 시점(PC: F5 · 터치: 오른쪽 위 눈 모양 버튼)에서 내 캐릭터를 볼 수 있어요. 1인칭에서도 팔 모양과 소매 색이 바뀌어요.</p></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">완료</button></div></div>`);
  drawPortrait($('charpv'), G ? G.armor : null);
}
function setCharacter(c) { SAVE.settings.char = c; paintCharacter(); saveSettingsSoon(); showCharacter(); }
function showKeys() {
  const K = SAVE.settings.keys;
  const rows = KEYDEF.map(k => {
    if (k[0][0] === '#') return `<div class="khead">${k[0].slice(1)}</div>`;
    const code = K[k[0]], conf = code && Object.entries(K).some(([a, c]) => a !== k[0] && c === code), lis = bindingKey === k[0];
    return `<div class="krow"><span>${k[1]}</span><button class="btn ${lis ? 'listen' : conf ? 'conf' : ''}" data-act="bind" data-k="${k[0]}">${lis ? `&gt; ${esc(keyName(code))} &lt;` : esc(keyName(code))}</button><button class="btn" data-act="kreset" data-k="${k[0]}" ${code === DEFAULT_KEYS[k[0]] ? 'disabled' : ''}>초기화</button></div>`;
  }).join('');
  screenHTML(`<div class="ms full"><div class="mtitle">키 설정</div><div class="mlist">${bindingKey ? '<p class="desc yellow">바꿀 키를 누르세요 (Esc: 취소)</p>' : ''}${rows}<p class="desc">방향키와 1~9 숫자 키, 마우스 버튼은 항상 함께 쓸 수 있어요.</p></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="kresetAll">모두 초기화</button><button class="btn" data-act="setback">완료</button></div></div></div>`);
}
function settingsBack() {
  bindingKey = null;
  if (setPage === 'keys') { if (keysParent === 'pause' && G) return showPause(); if (keysParent !== 'pause') return showSettings(keysParent); }
  if (setPage !== 'main') return showSettings('main');
  if (G) return showPause();
  showLanding();
}
function showHelp() {
  const from = G ? 'pause' : 'title'; if (G) G.ui = 'help'; menuScreen = 'help';
  const K = SAVE.settings.keys, kn = a => keyName(K[a]);
  screenHTML(`<div class="ms full"><div class="mtitle">조작법</div><div class="mlist"><div class="help">
  <h4>PC</h4><p>${kn('forward')}/${kn('left')}/${kn('back')}/${kn('right')} 이동 · 마우스 시점 · 좌클릭(꾹) 캐기·공격 · 우클릭 설치·사용·먹기 · 가운데 클릭 블록 집기</p>
  <p>${kn('jump')} 점프(크리에이티브에서 두 번: 비행) · ${kn('sneak')} 웅크리기 · ${kn('sprint')} 또는 ${kn('forward')} 두 번 달리기 · 1–9/휠 아이템 선택</p>
  <p>${kn('inventory')} 인벤토리 · ${kn('drop')} 버리기(Ctrl: 묶음) · ${kn('chat')} 채팅 · ${kn('command')} 명령어 · ${kn('hideHud')} HUD 숨기기 · ${kn('debug')} 디버그 · Esc 메뉴</p>
  <h4>모바일</h4><p>왼쪽 조이스틱(또는 방향 패드)으로 이동 · 화면 드래그로 시점 · 짧게 탭 설치·사용 · 꾹 누르기 캐기·공격 · 오른쪽 버튼 점프/캐기/놓기/웅크리기 · 핫바 옆 ⋯ 인벤토리</p>
  <p>크리에이티브 비행: 점프 버튼 두 번 탭 또는 비행 버튼 · 날 때 점프 = 위로, 내려가기/웅크리기 = 아래로(누르고 있는 동안)</p>
  <p>버튼 위치·크기는 설정 → 터치 컨트롤 → 버튼 배치 편집에서 바꿀 수 있어요.</p>
  <h4>인벤토리</h4><p>클릭: 집기/놓기 · 우클릭: 절반 집기/1개 놓기 · Shift+클릭: 빠른 이동 · 초록 책: 레시피 책(빨간 칸은 재료 부족, 같은 레시피를 다시 누르면 재료 한 세트 추가)</p>
  <p>끌어서 놓기: 아이템을 다른 칸으로 끌면 옮겨지고(다른 아이템이 있으면 맞바꿈), 아이템을 든 채로 여러 칸을 문지르면 고르게 나눠 놓아요. 터치: 길게 누르면 절반 집기, 두 번 탭하면 빠른 이동, 결과 칸을 길게 누르면 최대한 많이 제작.</p>
  <h4>전투</h4><p>무기마다 공격 속도가 있어 조준점 아래 게이지가 다 차야 최대 피해가 나요. 게이지가 찬 상태로 떨어지면서 때리면 치명타(×1.5, 노란 별), 달리면서 때리면 강한 밀치기, 검으로 땅에서 때리면 옆 몹까지 휩쓸기. 설정 → 전투에서 연타(구버전) 방식과 데미지 숫자를 켤 수 있어요.</p>
  <h4>왼손 · 캐릭터 · 시점</h4><p>${kn('swap')} 또는 터치 '양손 바꾸기' 버튼으로 손에 든 아이템과 왼손 아이템을 바꿔요. 인벤토리의 방패 모양 칸이 왼손이에요. 오른손으로 쓸 게 없으면 왼손 아이템(횃불, 블록, 음식, 화살 등)을 사용해요. 설정 → 캐릭터에서 클래식/슬림 체형과 색을 고르고, ${kn('view')} 또는 터치 '시점' 버튼으로 3인칭으로 볼 수 있어요.</p>
  <h4>갑옷과 도구</h4><p>갑옷(가죽·금·철·다이아몬드 투구/흉갑/레깅스/부츠)은 인벤토리 왼쪽 칸에 넣거나 손에 들고 사용하면 입어요. 방어력만큼 받는 피해가 줄고 갑옷 내구도가 닳아요. 가죽은 소에게서 얻어요.</p>
  <p>가위: 잎·양털을 빨리 캐고 잎 블록을 그대로 얻어요. 양에게 사용하면 양털을 깎아요 · 활: 사용 버튼을 누르고 있다가 떼면 발사(화살 필요) · 침대: 밤에 사용하면 아침까지 자고, 리스폰 지점이 돼요 · 나침반/시계: 들고 있으면 리스폰 방향과 시간을 알려줘요</p>
  <h4>시작 팁</h4><p>나무를 캐 원목 → 판자 → 작업대 → 나무 곡괭이 → 돌 → 화로 → 철. 밤에는 횃불(석탄+막대기)과 집이 필요해요.</p>
  <h4>명령어</h4><p>/gamemode survival|creative · /time set day|night · /give 아이템 [개수] · /tp x y z · /spawnpoint · /kill · /seed · /help</p></div></div>
  <div class="mfoot"><button class="btn w200" data-act="${from === 'pause' ? 'pause' : 'title'}">완료</button></div></div>`);
}
function fmtTime(s) { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}시간 ${m}분` : `${m}분 ${s % 60}초`; }
function showStats() {
  G.ui = 'stats'; menuScreen = 'stats'; const S = G.stats;
  const rows = [['생존한 날', dayCount() + '일'], ['플레이 시간', fmtTime(S.time)], ['걸은 거리', ((S.walk || 0) / 1000).toFixed(2) + ' km'], ['캔 블록', S.mined], ['설치한 블록', S.placed], ['만든 아이템', S.crafted], ['사망 횟수', S.deaths]];
  screenHTML(`<div class="ms full"><div class="mtitle">통계</div><div class="mlist">${rows.map(([a, b]) => `<div class="strow"><span>${a}</span><span>${b ?? 0}</span></div>`).join('')}</div><div class="mfoot"><button class="btn w200" data-act="pause">완료</button></div></div>`);
}
function showDeath(msg) {
  G.ui = 'death'; menuScreen = 'death'; releasePointer(); resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="dtitle">사망했습니다!</div><p>${esc(msg)}</p><p>생존: <span class="yellow">${dayCount()}</span>일째${G.mode === 'survival' ? ' · 소지품은 사망한 자리에 떨어졌어요' : ''}</p><div style="height:${u(16)}"></div>
  <button class="btn w200" data-act="respawn" disabled>부활</button><button class="btn w200" data-act="quit" disabled>타이틀 화면</button></div>`, 'death');
  ctx.timeout(() => { if (G && G.ui === 'death') root.querySelectorAll('#screen .btn').forEach(b => b.disabled = false); }, 1000);
}
function showLoading(pct) {
  const s = $('screen');
  if (!s.querySelector('#loadbar')) { menuScreen = 'loading'; screenHTML(`<div class="ms center"><div class="mtitle">월드 생성 중</div><p id="loadtxt">지형 생성 중...</p><div class="chunkmap" id="chunkmap">${'<i></i>'.repeat(25)}</div><div class="pbar"><i id="loadbar"></i></div></div>`, 'dirt'); }
  $('loadbar').style.width = Math.round(pct * 100) + '%'; $('loadtxt').textContent = `지형 생성 중... ${Math.round(pct * 100)}%`;
  if (P && W) { const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, cells = $('chunkmap').children; let i = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = getChunk(pcx + dx, pcz + dz); cells[i++].className = c ? (c.mesh ? 'm' : 'g') : ''; } }
}
function openChat(prefix = '') {
  G.ui = 'chat'; menuScreen = 'chat'; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-none';
  s.innerHTML = `<input id="chatin" class="chatin" maxlength="120" placeholder="메시지 또는 /명령어 (Enter 전송, Esc 닫기)" aria-label="채팅 입력">`;
  const inp = $('chatin'); inp.value = prefix; inp.focus();
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = inp.value.trim(); closeChat(); if (v) { if (v.startsWith('/')) command(v); else chat('<나> ' + v); } }
    else if (e.key === 'Escape') closeChat();
  });
  if (touchUI()) inp.addEventListener('blur', () => ctx.timeout(() => { if (G && G.ui === 'chat' && document.activeElement !== inp) closeChat(); }, 150));
}
function closeChat() { hideScreens(); if (G) G.ui = null; capture(); }
function dayCount() { return Math.floor(W.time / DAY_TICKS) + 1; }
async function toggleFull() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('mc').requestFullscreen) await $('mc').requestFullscreen(); else toast('이 브라우저에서는 전체화면을 지원하지 않아요.'); } catch { toast('전체화면을 열 수 없어요. 허브 상단 전체화면 버튼도 이용해 주세요.'); } }
function menuEscape() {
  if (bindingKey) return;
  switch (menuScreen) {
    case 'worlds': case 'help': showLanding(); break;
    case 'create': menuAction('ccancel'); break;
    case 'confirmDelete': showTitle(); break;
    case 'settings': settingsBack(); break;
    case 'layout': closeLayoutEditor(false); break;
  }
}

function menuAction(a, el) {
  switch (a) {
    case 'close': closeScreen(); break;
    case 'quick': quickMove = !quickMove; el.classList.toggle('on', quickMove); root.querySelectorAll('[data-act="quick"]').forEach(b => b.classList.toggle('on', quickMove)); break;
    case 'one': oneMode = !oneMode; root.querySelectorAll('[data-act="one"]').forEach(b => b.classList.toggle('on', oneMode)); break;
    case 'book': rbOpen = !rbOpen; SAVE.settings.recipeBook = rbOpen; saveSettingsSoon(); renderScreen(); break;
    case 'rfilter': rbCraftable = !rbCraftable; rbPage = 0; el.classList.toggle('on', rbCraftable); renderRecipes(); break;
    case 'rtab': rbTab = el.dataset.t; rbPage = 0; root.querySelectorAll('.rtab').forEach(b => b.classList.toggle('on', b.dataset.t === rbTab)); renderRecipes(); break;
    case 'rprev': rbPage--; renderRecipes(); break;
    case 'rnext': rbPage++; renderRecipes(); break;
    case 'pick': selectedWorld = el.dataset.id; root.querySelectorAll('.we').forEach(w => { const on = w.dataset.id === selectedWorld; w.classList.toggle('sel', on); w.setAttribute('aria-selected', on); }); root.querySelectorAll('[data-act="play"],[data-act="delete"]').forEach(b => b.disabled = false); break;
    case 'play': { const w = SAVE.worlds.find(x => x.id === selectedWorld); if (w) startWorld(w); break; }
    case 'new': showCreate(); break;
    case 'title': showLanding(); break;
    case 'worlds': showTitle(); break;
    case 'delete': if (selectedWorld) showDeleteConfirm(); break;
    case 'delYes': SAVE.worlds = SAVE.worlds.filter(w => w.id !== selectedWorld); selectedWorld = null; persist(); showTitle(); break;
    case 'ctab': createOpts.tab = el.dataset.t; updateCreate(); break;
    case 'cmode': createOpts.mode = createOpts.mode === 'survival' ? 'creative' : 'survival'; updateCreate(); break;
    case 'cdiff': createOpts.difficulty = (createOpts.difficulty + 1) % 4; updateCreate(); break;
    case 'cbonus': createOpts.bonus = !createOpts.bonus; updateCreate(); break;
    case 'ccancel': if (createFrom === 'worlds') showTitle(); else showLanding(); break;
    case 'create': {
      const name = ($('wname').value.trim() || '새로운 세계').slice(0, 32), seedText = $('wseed').value.trim() || String(Math.floor(Math.random() * 1e9));
      const w = { id: 'w' + Date.now().toString(36), name, mode: createOpts.mode, difficulty: createOpts.difficulty, bonus: createOpts.bonus, seedText, seed: /^-?\d+$/.test(seedText) ? (+seedText | 0) >>> 0 : hashSeed(seedText), created: Date.now(), played: Date.now(), data: null };
      SAVE.worlds.push(w); selectedWorld = w.id; startWorld(w); break;
    }
    case 'settings': keysParent = 'main'; showSettings('main'); break;
    case 'page': { const p = el.dataset.p; if (menuScreen === 'settings') { if (p === 'keys') keysParent = setPage; showSettings(p); } else { keysParent = 'pause'; showSettings(p); } break; }
    case 'setback': settingsBack(); break;
    case 'bind': bindingKey = bindingKey === el.dataset.k ? null : el.dataset.k; showKeys(); break;
    case 'kreset': SAVE.settings.keys[el.dataset.k] = DEFAULT_KEYS[el.dataset.k]; saveSettingsSoon(); showKeys(); break;
    case 'kresetAll': SAVE.settings.keys = { ...DEFAULT_KEYS }; bindingKey = null; saveSettingsSoon(); showKeys(); break;
    case 'resume': hideScreens(); G.ui = null; ctx.setPaused(false); capture(); break;
    case 'pause': showPause(); break;
    case 'help': showHelp(); break;
    case 'stats': showStats(); break;
    case 'quit': quitToTitle(); break;
    case 'respawn': respawn(); break;
    case 'layout': openLayoutEditor(menuScreen === 'settings' ? 'settings' : G ? 'pause' : 'title'); break;
    case 'resetLayout': SAVE.settings.layout = {}; saveSettingsSoon(); positionTouch(); toast('터치 버튼 배치를 기본값으로 되돌렸어요.'); break;
    case 'full': toggleFull(); break;
    case 'charpreset': setCharacter({ ...CHAR_PRESETS[+el.dataset.i] }); break;
    case 'charopt': {
      const c = charOf(), k = el.dataset.k, n = { skin: CHAR_SKIN.length, hair: CHAR_HAIR.length, shirt: CHAR_SHIRT.length, pants: CHAR_PANTS.length }[k];
      const nc = { model: c.model, skin: c.skin, hair: c.hair, style: c.style, shirt: c.shirt, pants: c.pants, name: c.name };
      if (k === 'model') nc.model = c.slim ? 'classic' : 'slim'; else if (k === 'style') nc.style = c.style ? 0 : 1; else nc[k] = (c[k] + 1) % n;
      setCharacter(nc); break;
    }
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
// Each control can be moved, resized and hidden in the layout editor. Saved positions are the
// control's centre as a fraction of the screen; unsaved controls use edge-anchored defaults.
const TCTL = [
  { id: 'move', label: '이동', base: 124 }, { id: 'jump', label: '점프', base: 62 }, { id: 'mine', label: '캐기', base: 56 }, { id: 'use', label: '놓기', base: 56 },
  { id: 'sneak', label: '웅크리기', base: 50 }, { id: 'sprint', label: '달리기', base: 46 }, { id: 'fly', label: '비행', base: 50 }, { id: 'down', label: '내려가기', base: 50 },
  { id: 'drop', label: '버리기', base: 44 }, { id: 'chat', label: '채팅', base: 38 }, { id: 'pause', label: '일시정지', base: 38 },
  { id: 'view', label: '시점', base: 38 }, { id: 'swap', label: '양손 바꾸기', base: 40 }];
const TDEF = { move: ['l', 100, 'b', 104], jump: ['r', 62, 'b', 88], mine: ['r', 146, 'b', 120], use: ['r', 66, 'b', 172], sneak: ['r', 150, 'b', 196], sprint: ['l', 182, 'b', 204],
  fly: ['r', 68, 'b', 246], down: ['r', 228, 'b', 104], drop: ['l', 46, 'b', 214], chat: ['r', 118, 't', 26], pause: ['r', 72, 't', 26], view: ['r', 164, 't', 26], swap: ['l', 46, 'b', 268] };
let touchSneak = false, touchSprint = false, touchJump = false, touchDown = false;
const TEL = {}, tptr = new Map();
const J = { pid: null, cx: 0, cy: 0, r: 46, float: false };
const DP = { pid: null, f: 0, lastFwd: 0, center: false, sprint: false };
const tk = (W, H) => clamp(Math.min(W, H) / 390, 0.85, 1.6);
const layoutOf = id => { const L = SAVE.settings.layout || (SAVE.settings.layout = {}); return L[id] || (L[id] = {}); };
function tpos(id, W, H) {
  const L = (SAVE.settings.layout || {})[id] || {}, d = TDEF[id], k = tk(W, H), port = H > W * 1.05;
  const c = TCTL.find(t => t.id === id);
  const size = c.base * k * (L.s || 1) * (SAVE.settings.btnSize || 100) / 100;
  let x, y;
  if (L.x != null) { x = L.x * W; y = L.y * H; }
  else { x = d[0] === 'l' ? d[1] * k : W - d[1] * k; y = d[2] === 't' ? d[3] * k : H - (d[3] + (port ? 70 : 0)) * k; }
  if (SAVE.settings.leftHanded) x = W - x;
  x = clamp(x, size / 2 + 2, W - size / 2 - 2); y = clamp(y, size / 2 + 2, H - size / 2 - 2);
  return { x, y, size, hide: !!L.hide };
}
function renderTouch() {
  const t = $('touch'); if (!t || !SAVE) return;
  t.innerHTML = TCTL.map(c => {
    if (c.id === 'move') return SAVE.settings.moveStyle === 'dpad'
      ? `<div class="tc dpad" data-ctl="move" data-label="${c.label}">${['ul', 'u', 'ur', 'l', 'c', 'r', 'dl', 'd', 'dr'].map(d => `<b data-d="${d}" class="${d.length === 2 ? 'x' : d === 'c' ? 'c' : ''}"></b>`).join('')}</div>`
      : `<div class="tc joy" data-ctl="move" data-label="${c.label}"><i></i></div>`;
    return `<button class="tc tb" data-ctl="${c.id}" data-label="${c.label}" aria-label="${c.label}" style="background-image:url(${TICON[c.id]})"></button>`;
  }).join('');
  for (const k in TEL) delete TEL[k];
  t.querySelectorAll('[data-ctl]').forEach(el => { TEL[el.dataset.ctl] = el; });
  positionTouch();
}
function positionTouch() {
  if (!root || !SAVE || !TEL.move) return;
  const mc = $('mc'), W = mc.clientWidth, H = mc.clientHeight; if (!W || !H) return;
  for (const c of TCTL) {
    const el = TEL[c.id]; if (!el) continue;
    if (c.id === 'move' && J.float && J.pid != null) continue;
    const p = tpos(c.id, W, H);
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.width = el.style.height = p.size + 'px';
    el.classList.toggle('off', p.hide); el.classList.toggle('sel', !!ED && ED.sel === c.id);
  }
}
function resetTouchHolds() {
  touchJump = touchDown = false; input.jump = false; input.sneak = touchSneak; input.descend = false;
  J.pid = null; DP.pid = null; DP.f = 0; DP.sprint = false; input.sprintKey = touchSprint;
  for (const p of tptr.values()) clearTimeout(p.timer); tptr.clear();
  if (root) root.querySelectorAll('#touch .down').forEach(e => e.classList.remove('down'));
  const k = TEL.move && TEL.move.querySelector('i'); if (k) k.style.transform = '';
  if (J.float) { J.float = false; positionTouch(); }
}
function joyStart(e, cx, cy) { J.pid = e.pointerId; J.cx = cx; J.cy = cy; J.r = Math.max(20, TEL.move.getBoundingClientRect().width * 0.36); joyMove(e); }
function joyMove(e) {
  const dx = e.clientX - J.cx, dy = e.clientY - J.cy, r = J.r, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
  const knob = TEL.move && TEL.move.querySelector('i'); if (knob) knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  const nx = dx * k / r, ny = dy * k / r;
  input.fwd = Math.abs(ny) > 0.2 ? -ny : 0; input.side = Math.abs(nx) > 0.2 ? nx : 0; input.sprintKey = touchSprint || ny < -0.95;
}
function joyEnd() { J.pid = null; const knob = TEL.move && TEL.move.querySelector('i'); if (knob) knob.style.transform = ''; input.fwd = input.side = 0; input.sprintKey = touchSprint; if (J.float) { J.float = false; positionTouch(); } }
const DIRN = { '1,0': 'u', '1,-1': 'ul', '1,1': 'ur', '0,-1': 'l', '0,1': 'r', '-1,0': 'd', '-1,-1': 'dl', '-1,1': 'dr' };
function dpadMove(e, first) {
  const el = TEL.move, r = el.getBoundingClientRect(), cell = r.width / 3, dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const inC = Math.abs(dx) < cell / 2 && Math.abs(dy) < cell / 2;
  if (first && inC) { DP.center = true; touchSneak = !touchSneak; input.sneak = touchSneak; return; }
  if (DP.center && inC) return;
  DP.center = false;
  const f = dy < -cell / 2 ? 1 : dy > cell / 2 ? -1 : 0, s = dx > cell / 2 ? 1 : dx < -cell / 2 ? -1 : 0;
  if (f === 1 && DP.f !== 1) { const n = performance.now(); if (n - DP.lastFwd < 300) DP.sprint = true; DP.lastFwd = n; }
  if (f !== 1) DP.sprint = false;
  DP.f = f; input.fwd = f; input.side = s; input.sprintKey = touchSprint || DP.sprint;
  const dn = DIRN[f + ',' + s]; el.querySelectorAll('b').forEach(b => b.classList.toggle('down', b.dataset.d === dn));
}
function dpadEnd() { DP.pid = null; DP.f = 0; DP.sprint = false; DP.center = false; input.fwd = input.side = 0; input.sprintKey = touchSprint; if (TEL.move) TEL.move.querySelectorAll('b.down').forEach(b => b.classList.remove('down')); }
function ctlDown(id, e, el) {
  el.classList.add('down');
  switch (id) {
    case 'move': if (SAVE.settings.moveStyle === 'dpad') { DP.pid = e.pointerId; dpadMove(e, true); } else { const r = el.getBoundingClientRect(); joyStart(e, r.left + r.width / 2, r.top + r.height / 2); } break;
    case 'jump': {
      touchJump = true; input.jump = true;
      // double-tap jump toggles flight in creative, like the original
      const n = e.timeStamp; if (G.mode === 'creative') { if (n - P.lastJump < 380) { setFlying(!P.flying); P.lastJump = 0; } else P.lastJump = n; }
      break;
    }
    case 'mine': input.mine = true; P.attackCd = 0; P.mineCd = 0; break;
    case 'use': input.use = true; P.useCd = 0; break;
    case 'sneak': { const p = tptr.get(e.pointerId); if (P.flying) { p.flyHold = true; touchDown = true; input.descend = true; } else { touchSneak = !touchSneak; input.sneak = touchSneak; } break; }
    case 'sprint': touchSprint = !touchSprint; input.sprintKey = touchSprint; break;
    case 'fly': if (G.mode === 'creative') setFlying(!P.flying); break;
    case 'view': cycleView(); break;
    case 'swap': swapHands(); break;
    case 'down': touchDown = true; input.sneak = true; input.descend = true; break;
    case 'drop': { const p = tptr.get(e.pointerId); p.timer = ctx.timeout(() => { if (tptr.get(e.pointerId) === p) { p.fired = true; dropItem(true); buzz(25); } }, 450); break; }
  }
}
function ctlUp(id, e, el, p) {
  el.classList.remove('down');
  const ok = e.type !== 'pointercancel';
  switch (id) {
    case 'move': if (SAVE.settings.moveStyle === 'dpad') dpadEnd(); else joyEnd(); break;
    case 'jump': touchJump = false; input.jump = false; break;
    case 'mine': input.mine = false; break;
    case 'use': input.use = false; break;
    case 'down': touchDown = false; input.sneak = touchSneak; input.descend = false; break;
    case 'sneak': if (p && p.flyHold) { touchDown = false; input.descend = false; input.sneak = touchSneak; } break;
    case 'drop': clearTimeout(p.timer); if (!p.fired && ok && G && !G.ui) dropItem(false); break;
    case 'chat': if (ok && G && !G.ui) openChat(''); break;
    case 'pause': if (ok && G && !G.ui) showPause(); break;
  }
}
function touchEvents() {
  const touch = $('touch');
  ctx.on(touch, 'pointerdown', e => {
    const el = e.target.closest('[data-ctl]'); if (!el) return;
    e.preventDefault();
    if (ED) { edStart(e, el); return; }
    if (!G || G.ui || G.loading || P.dead) return;
    try { el.setPointerCapture(e.pointerId); } catch { }
    const p = { id: el.dataset.ctl, el }; tptr.set(e.pointerId, p);
    ctlDown(p.id, e, el);
  });
  ctx.on(touch, 'pointermove', e => {
    if (ED) { edMove(e); return; }
    const p = tptr.get(e.pointerId); if (!p || p.id !== 'move') return;
    if (SAVE.settings.moveStyle === 'dpad') { if (DP.pid === e.pointerId) dpadMove(e, false); } else if (J.pid === e.pointerId) joyMove(e);
  });
  const up = e => { if (ED) { edEnd(e); return; } const p = tptr.get(e.pointerId); if (!p) return; tptr.delete(e.pointerId); ctlUp(p.id, e, p.el, p); };
  ctx.on(touch, 'pointerup', up); ctx.on(touch, 'pointercancel', up);
  ctx.on(touch, 'contextmenu', e => e.preventDefault());
  // look + tap/hold on the canvas (and the floating joystick on the left side)
  const looks = new Map();
  ctx.on(canvas, 'pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    if (!G || G.ui) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { }
    const st = SAVE.settings, mc = $('mc').getBoundingClientRect(), lx = e.clientX - mc.left, ly = e.clientY - mc.top;
    const floatSide = st.leftHanded ? lx > mc.width * 0.55 : lx < mc.width * 0.45;
    if (touchUI() && st.joyFloat && st.moveStyle !== 'dpad' && J.pid == null && TEL.move && !TEL.move.classList.contains('off') && floatSide && ly > mc.height * 0.3) {
      J.float = true; TEL.move.style.left = lx + 'px'; TEL.move.style.top = ly + 'px'; TEL.move.classList.add('down');
      joyStart(e, e.clientX, e.clientY); return;
    }
    const L = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, mining: false };
    L.timer = ctx.timeout(() => { if (looks.get(e.pointerId) === L && L.moved < 12) { L.mining = true; input.mine = true; P.attackCd = 0; P.mineCd = 0; } }, st.holdDelay || 280);
    looks.set(e.pointerId, L);
  });
  ctx.on(canvas, 'pointermove', e => {
    if (J.float && J.pid === e.pointerId) { joyMove(e); return; }
    const L = looks.get(e.pointerId); if (!L) return;
    const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; L.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0055 * (SAVE.settings.touchSens || 8) / 8;
    P.yaw += dx * k; P.pitch = clamp(P.pitch - dy * k * (SAVE.settings.invertY ? -1 : 1), -1.55, 1.55);
  });
  const endLook = e => {
    if (J.float && J.pid === e.pointerId) { if (TEL.move) TEL.move.classList.remove('down'); joyEnd(); return; }
    const L = looks.get(e.pointerId); if (!L) return; looks.delete(e.pointerId);
    clearTimeout(L.timer);
    if (L.mining) input.mine = false;
    else if (e.type !== 'pointercancel' && L.moved < 12 && performance.now() - L.t < (SAVE.settings.holdDelay || 280) && G && !G.ui) {
      // a quick tap on a mob hits it (shears on a sheep still shear); otherwise it places / uses
      const m = G.targetMob, s = G.inv[G.sel];
      if (m && !(s && s.id === SHEARS && m.type === 'sheep' && !m.sheared)) { input.mine = true; P.minePrev = false; updateInteraction(0); input.mine = false; }
      else if (SAVE.settings.tapPlace !== false) { input.use = true; P.useCd = 0; updateInteraction(0); input.use = false; }
    }
  };
  ctx.on(canvas, 'pointerup', endLook); ctx.on(canvas, 'pointercancel', endLook);
  // hotbar taps
  ctx.on($('hotbar'), 'pointerdown', e => { const h = e.target.closest('[data-hot]'); if (!h || !G || ED) return; e.preventDefault(); G.sel = +h.dataset.hot; invChanged(); });
  ctx.on($('hotInv'), 'click', () => { if (G && !G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); });
  ctx.on($('bInv'), 'click', () => { if (G && !G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); else if (G && (G.ui === 'inventory' || G.ui === 'creative' || G.ui === 'table' || G.ui === 'container')) closeScreen(); });
  ctx.on($('bPause'), 'click', () => { if (G && !G.ui) showPause(); else if (G && G.ui === 'pause') menuAction('resume'); });
  ctx.on($('bFull'), 'click', toggleFull);
  // layout editor toolbar
  const ed = $('editor');
  ctx.on(ed, 'click', e => { const b = e.target.closest('[data-ed]'); if (b) { uiClick(); edAction(b.dataset.ed); } });
  ctx.on(ed, 'input', e => { if (e.target.id === 'edSize' && ED) { layoutOf(ED.sel).s = +e.target.value / 100; $('edSizeL').textContent = `크기: ${e.target.value}%`; positionTouch(); } });
  let bar = null;
  ctx.on(ed, 'pointerdown', e => { const h = e.target.closest('.edhead'); if (!h || e.target.closest('button')) return; const b = $('edbar'), r = b.getBoundingClientRect(), m = $('mc').getBoundingClientRect(); bar = { pid: e.pointerId, ox: r.left - m.left - e.clientX, oy: r.top - m.top - e.clientY }; try { h.setPointerCapture(e.pointerId); } catch { } });
  ctx.on(ed, 'pointermove', e => { if (!bar || bar.pid !== e.pointerId) return; const b = $('edbar'), m = $('mc'); b.classList.add('moved'); b.style.left = clamp(e.clientX + bar.ox, 0, m.clientWidth - b.offsetWidth) + 'px'; b.style.top = clamp(e.clientY + bar.oy, 0, m.clientHeight - b.offsetHeight) + 'px'; });
  ctx.on(ed, 'pointerup', () => { bar = null; }); ctx.on(ed, 'pointercancel', () => { bar = null; });
}

// ── touch layout editor ──
let ED = null;
const snapSize = (W, H) => Math.round(8 * tk(W, H));
function openLayoutEditor(from) {
  ED = { sel: 'jump', orig: JSON.parse(JSON.stringify(SAVE.settings.layout || {})), snap: true, from, drag: null, min: false };
  if (G) { G.ui = 'layout'; releasePointer(); resetTouchHolds(); }
  menuScreen = 'layout';
  screenHTML('', G ? 'none' : 'pano');
  $('mc').classList.add('editing');
  renderTouch();
  const ed = $('editor'); ed.hidden = false; renderEdBar();
}
function closeLayoutEditor(save) {
  if (!ED) return;
  if (save) { saveSettingsSoon(); toast('버튼 배치를 저장했어요.'); } else SAVE.settings.layout = ED.orig;
  const from = ED.from; ED = null;
  $('mc').classList.remove('editing'); $('editor').hidden = true; $('editor').innerHTML = '';
  positionTouch();
  if (from === 'settings') showSettings('touch');
  else if (G) showPause();
  else showLanding();
}
function renderEdBar() {
  const ed = $('editor'), c = TCTL.find(t => t.id === ED.sel), L = (SAVE.settings.layout || {})[ED.sel] || {}, mc = $('mc');
  ed.classList.toggle('grid', ED.snap); ed.style.setProperty('--snap', snapSize(mc.clientWidth, mc.clientHeight) + 'px');
  const old = $('edbar'), pos = old && old.classList.contains('moved') ? `left:${old.style.left};top:${old.style.top}` : '';
  ed.innerHTML = `<div class="edbar ${ED.min ? 'min' : ''} ${pos ? 'moved' : ''}" id="edbar" style="${pos}">
  <div class="edhead"><span>버튼 배치 편집</span><button class="btn sm" data-ed="min">${ED.min ? '펼치기' : '접기'}</button>${ED.min ? '<button class="btn sm" data-ed="save">저장</button>' : ''}</div>
  <div class="edhint">버튼을 끌어서 옮기고, 눌러서 선택하세요</div>
  <div class="edsel"><button class="btn sq" data-ed="prev" aria-label="이전 버튼">◀</button><b>${c.label}</b><button class="btn sq" data-ed="next" aria-label="다음 버튼">▶</button></div>
  <label class="slider"><input type="range" id="edSize" min="50" max="200" step="5" value="${Math.round((L.s || 1) * 100)}" aria-label="버튼 크기"><span class="lab" id="edSizeL">크기: ${Math.round((L.s || 1) * 100)}%</span></label>
  <div class="row"><button class="btn" data-ed="vis">표시: ${L.hide ? '끔' : '켬'}</button><button class="btn" data-ed="resetOne">이 버튼 초기화</button></div>
  <div class="row"><button class="btn" data-ed="snap">격자 맞춤: ${ED.snap ? '켬' : '끔'}</button><button class="btn" data-ed="resetAll">모두 초기화</button></div>
  <div class="row"><button class="btn" data-ed="cancel">취소</button><button class="btn" data-ed="save">저장</button></div></div>`;
}
function edAction(a) {
  if (!ED) return;
  const L = SAVE.settings.layout || (SAVE.settings.layout = {}), i = TCTL.findIndex(t => t.id === ED.sel);
  switch (a) {
    case 'prev': ED.sel = TCTL[(i + TCTL.length - 1) % TCTL.length].id; break;
    case 'next': ED.sel = TCTL[(i + 1) % TCTL.length].id; break;
    case 'vis': layoutOf(ED.sel).hide = !layoutOf(ED.sel).hide; break;
    case 'resetOne': delete L[ED.sel]; break;
    case 'resetAll': SAVE.settings.layout = {}; break;
    case 'snap': ED.snap = !ED.snap; break;
    case 'min': ED.min = !ED.min; break;
    case 'cancel': closeLayoutEditor(false); return;
    case 'save': closeLayoutEditor(true); return;
  }
  positionTouch(); renderEdBar();
}
function edStart(e, el) {
  const id = el.dataset.ctl;
  ED.sel = id; ED.drag = { pid: e.pointerId, id, sx: e.clientX, sy: e.clientY, ox: parseFloat(el.style.left) || 0, oy: parseFloat(el.style.top) || 0 };
  try { el.setPointerCapture(e.pointerId); } catch { }
  positionTouch(); renderEdBar();
}
function edMove(e) {
  const d = ED && ED.drag; if (!d || d.pid !== e.pointerId) return;
  const mc = $('mc'), W = mc.clientWidth, H = mc.clientHeight;
  let x = d.ox + e.clientX - d.sx, y = d.oy + e.clientY - d.sy;
  if (ED.snap) { const s = snapSize(W, H); x = Math.round(x / s) * s; y = Math.round(y / s) * s; }
  const L = layoutOf(d.id); L.x = clamp((SAVE.settings.leftHanded ? W - x : x) / W, 0, 1); L.y = clamp(y / H, 0, 1);
  positionTouch();
}
function edEnd(e) { if (ED && ED.drag && ED.drag.pid === e.pointerId) ED.drag = null; }

// ─────────────────────────── audio (synthesised) ───────────────────────────
let audio = null, master = null, noiseBuf = null, muted = true;
const lastSfx = {};
function wake() {
  if (muted) return;
  try {
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = 0.55 * volOf('volMaster'); master.connect(audio.destination); const n = audio.sampleRate; noiseBuf = audio.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    if (audio.state === 'suspended') audio.resume().catch(() => { });
  } catch { }
}
const volOf = k => SAVE && SAVE.settings ? clamp((SAVE.settings[k] ?? 100) / 100, 0, 1) : 1;
function updateVolume() { if (master) master.gain.value = 0.55 * volOf('volMaster'); }
const SFX_CAT = n => /^(break|dig|place|step)_/.test(n) || n === 'boom' || n === 'fuse' || n === 'bucket' || n === 'chest' ? 'volBlocks' : /^(pig|cow|sheep|zhurt|groan|hiss|shurt|mhurt)$/.test(n) ? 'volMobs' : n === 'click' ? 'volMaster' : 'volPlayer';
function sfx(name, vol = 1) {
  if (muted || !audio || audio.state !== 'running') return;
  if (name !== 'click') vol *= volOf(SFX_CAT(name)); if (vol <= 0.001) return;
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
    case 'click': tone('square', 1250, 700, 0.035, 0.035); noise(0.03, 2600, 1.2, 0.12); break;
    case 'equip': noise(0.12, 900, 0.8, 0.35); tone('triangle', 330, 260, 0.08, 0.06); break;
    case 'bow': noise(0.18, 1800, 0.6, 0.3); tone('triangle', 420, 160, 0.14, 0.07); break;
    case 'arrowhit': noise(0.08, 1200, 1.4, 0.4); tone('triangle', 260, 140, 0.06, 0.06); break;
    case 'shear': noise(0.06, 4200, 2, 0.3); noise(0.06, 3800, 2, 0.3, 'bandpass', 0.09); break;
    case 'strong': noise(0.1, 900, 1, 0.5); tone('triangle', 200, 110, 0.08, 0.1); break;
    case 'weak': noise(0.07, 1400, 1.2, 0.25); break;
    case 'knock': noise(0.14, 600, 0.8, 0.6); tone('triangle', 150, 80, 0.12, 0.12); break;
    case 'crit': noise(0.12, 2600, 1.5, 0.5); tone('square', 1300, 700, 0.1, 0.05); break;
    case 'sweep': noise(0.22, 2000, 0.5, 0.35, 'bandpass'); break;
  }
}
let musicT = 40;
function music(dt) {
  if (muted || !audio || audio.state !== 'running') return;
  musicT -= dt; if (musicT > 0) return; musicT = 70 + Math.random() * 90;
  const mv = volOf('volMusic'); if (mv <= 0.001) return;
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3], t = audio.currentTime;
  let deg = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < 9; i++) {
    deg = clamp(deg + Math.floor(Math.random() * 5) - 2, 0, scale.length - 1);
    const at = t + i * (0.9 + Math.random() * 0.6), o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = scale[deg] * (Math.random() < 0.3 ? 0.5 : 1);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.04 * mv, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
    o.connect(g).connect(master); o.start(at); o.stop(at + 2.7);
  }
}

// ─────────────────────────── saving ───────────────────────────
let SAVE = null, saveTimer = 0, settingsTimer = 0;
function loadSave() {
  const touch = isTouch();
  SAVE = { v: 1, settings: { renderDist: touch ? 3 : 5, fov: 75, sens: 8, bob: true, autoJump: touch, invertY: false, hudScale: 100, touchOpacity: 85, joySize: 100,
    guiScale: 0, brightness: 0, renderScale: 100, maxFps: 0, clouds: true, particles: 2, fovEffect: true, hurtShake: true,
    volMaster: 100, volMusic: 70, volBlocks: 100, volMobs: 100, volPlayer: 100, uiSound: true,
    sneakToggle: false, sprintToggle: false, keys: { ...DEFAULT_KEYS },
    touchMode: 'auto', moveStyle: 'joystick', joyFloat: false, touchSens: 8, btnSize: 100, tapPlace: true, holdDelay: 280, vibrate: true, leftHanded: false, layout: {},
    crosshair: true, itemNames: true, showCoords: false, showFps: false, chatShow: true, chatOpacity: 100, menuBlur: 0, panoSpeed: 100, recipeBook: null,
    combat: 'modern', attackIndicator: true, dmgNumbers: false, char: null }, worlds: [], storage: typeof ctx.save === 'function' };
  let raw = null;
  try {
    raw = ctx.savedData;
    if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.worlds)) { SAVE.worlds = o.worlds.filter(w => w && w.id && w.name); Object.assign(SAVE.settings, o.settings || {}); } }
  } catch { raw = 'bad'; }
  const st = SAVE.settings;
  // F now swaps hands (like the original); older saves had flight on F, move it to G
  if (st.keys && typeof st.keys === 'object' && st.keys.fly === 'KeyF' && !st.keys.swap) st.keys.fly = 'KeyG';
  st.keys = Object.assign({ ...DEFAULT_KEYS }, st.keys && typeof st.keys === 'object' ? st.keys : {});
  if (!st.layout || typeof st.layout !== 'object') st.layout = {};
  // older saves stored one joystick size for everyone; carry it into the new per-button layout
  if (+st.joySize && st.joySize !== 100 && !(st.layout.move && st.layout.move.s)) { (st.layout.move || (st.layout.move = {})).s = st.joySize / 100; st.joySize = 100; }
  st.renderDist = clamp(+st.renderDist || 4, 2, 10); st.fov = clamp(+st.fov || 75, 30, 110);
  return raw === 'bad';
}
function applyVisualSettings() {
  if (!SAVE || !root) return;
  const st = SAVE.settings, mc = $('mc');
  applyGui();
  mc.style.setProperty('--hs', clamp((+st.hudScale || 100) / 100, .5, 1.5));
  mc.style.setProperty('--to', clamp((+st.touchOpacity || 85) / 100, .2, 1));
  mc.style.setProperty('--chat', (clamp((+st.chatOpacity || 100) / 100, .1, 1) * .5).toFixed(3));
  mc.style.setProperty('--chato', clamp((+st.chatOpacity || 100) / 100, .1, 1));
  mc.style.setProperty('--blur', (+st.menuBlur || 0) + 'px');
  mc.style.setProperty('--pano-dur', (st.panoSpeed > 0 ? 12000 / st.panoSpeed : 120) + 's');
  mc.classList.toggle('nopano', !(st.panoSpeed > 0));
  mc.classList.toggle('nocross', st.crosshair === false);
  mc.classList.toggle('noname', st.itemNames === false);
  mc.classList.toggle('nochat', st.chatShow === false);
  positionTouch(); updateVolume();
}
function serializeWorld() {
  return {
    player: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, health: P.health, hunger: P.hunger, sat: P.sat, airT: P.airT, flying: P.flying, dead: P.dead },
    inv: G.inv.map(s => s ? [s.id, s.count, s.dmg || 0] : 0), armor: G.armor.map(s => s ? [s.id, 1, s.dmg || 0] : 0), off: G.off ? [G.off.id, G.off.count, G.off.dmg || 0] : 0, sel: G.sel, time: W.time, spawn: G.spawn, stats: G.stats,
    mods: encodeMods(), te: Object.fromEntries(W.te),
    mobs: W.mobs.filter(m => !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 80).map(m => [m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), m.hp, m.color, Math.round(m.sheared || 0)]),
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
    fluidQ: new Set(), gravQ: new Set(), mobs: [], items: [], particles: [], tnts: [], arrows: [], time: d ? d.time : 1000, difficulty: w.difficulty ?? 2, daylight: 1, skyLevel: 15 };
  lastChunk = null; lastPc = null;
  G = { world: w, mode: w.mode, inv: Array(36).fill(null), sel: (d && d.sel) || 0, ui: 'loading', settings: SAVE.settings, spawn: (d && d.spawn) || findSpawn(), stats: Object.assign({ mined: 0, placed: 0, crafted: 0, deaths: 0, time: 0, walk: 0 }, (d && d.stats) || {}),
    target: null, targetMob: null, hurtFlash: 0, loading: true, fresh: !d, craft: null, craftW: 2 };
  P = newPlayer(G.spawn);
  if (d && d.player) { Object.assign(P, d.player); P.fallStart = P.y; if (P.dead) { P.dead = false; P.health = 20; P.hunger = 20; Object.assign(P, { x: G.spawn.x, y: G.spawn.y, z: G.spawn.z }); } }
  if (d && d.inv) G.inv = d.inv.map(s => s && info(s[0]) ? { id: s[0], count: s[1], dmg: s[2] || 0 } : null);
  else if (w.mode === 'creative') [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICKS, TORCH].forEach((id, i) => G.inv[i] = { id, count: 64, dmg: 0 });
  G.off = d && d.off && info(d.off[0]) ? { id: d.off[0], count: d.off[1], dmg: d.off[2] || 0 } : null;
  G.armor = [0, 1, 2, 3].map(i => { const s = d && d.armor && d.armor[i]; return s && armorOf(s[0]) && armorOf(s[0]).slot === i ? { id: s[0], count: 1, dmg: s[2] || 0 } : null; });
  G.sleep = 0;
  if (d && d.mobs) for (const [type, x, y, z, hp, color, sheared] of d.mobs) if (MOBDEF[type]) { const m = spawnMob(type, x, y, z); m.hp = hp; m.color = color || 0; m.sheared = +sheared || 0; }
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
  if (G.fresh && G.mode === 'survival' && G.world.bonus) { for (const [id, n] of [[LOG, 12], [APPLE, 6], [PICK0, 1], [AXE0, 1], [TORCH, 8], [BREAD, 3]]) addToInventory(id, n); invChanged(); chat('보너스 아이템을 받았어요!', '#5f5'); }
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
  showLanding();
}

// ─────────────────────────── chunk streaming ───────────────────────────
function neighborsGenerated(ch) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && !getChunk(ch.cx + dx, ch.cz + dz)) return false; return true; }
function updateChunks(budget) {
  const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, R = SAVE.settings.renderDist;
  const sig = pcx + ',' + pcz + ',' + R;
  if (sig !== lastPc) {
    lastPc = sig; wantList = [];
    // generate one ring further than we mesh: a chunk is meshed only once all 8 neighbours exist, and a
    // meshed chunk (d ≤ R+0.5) can have neighbours out to R+0.5+√2 — with R+1.5 those edge chunks never meshed
    for (let dx = -R - 2; dx <= R + 2; dx++) for (let dz = -R - 2; dz <= R + 2; dz++) { const d = Math.hypot(dx, dz); if (d <= R + 2) wantList.push([dx, dz, d]); }
    wantList.sort((a, b) => a[2] - b[2]);
    for (const [k, ch] of W.chunks) if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 3) { freeChunkGL(ch); W.chunks.delete(k); if (lastChunk === ch) lastChunk = null; }
  }
  // Spread edits across frames so several adjacent relights do not block a frame together.
  const t0 = performance.now();
  for (const ch of W.chunks.values()) if (ch.urgent) {
    if (ch.needLight) lightChunk(ch);
    if (ch.needMesh && neighborsGenerated(ch)) uploadMesh(ch, meshChunk(ch));
    if (performance.now() - t0 >= budget) return;
  }
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
  // only count chunks that updateChunks will actually mesh (with view distance 2 the corners never are)
  const R = SAVE.settings.renderDist;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.hypot(dx, dz) > R + 0.5) continue; total++; const c = getChunk(pcx + dx, pcz + dz); if (c && c.mesh) ok++; }
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
  updateMobs(dt); updateItems(dt); updateArrows(dt); updateParticles(dt); updateTNT(dt); spawnLogic(dt); updateSleep(dt);
  G.stats.time = (G.stats.time || 0) + dt;
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
  const sh = shake > 0 && SAVE.settings.hurtShake !== false ? [(Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3] : [0, 0];
  let eye = [P.x + Math.cos(P.yaw) * bx + sh[0], P.y + eyeHeight() + by + sh[1], P.z + Math.sin(P.yaw) * bx], vyaw = P.yaw, vpitch = P.pitch;
  if (camView && !P.dead) {
    // third person: pull the camera back (or out in front) until it would hit a block
    const d = lookDir(), sgn = camView === 1 ? -1 : 1; let dist = 4;
    for (let k = 0.3; k <= 4; k += 0.1) if (solidAt(Math.floor(eye[0] + d[0] * sgn * k), Math.floor(eye[1] + d[1] * sgn * k), Math.floor(eye[2] + d[2] * sgn * k))) { dist = Math.max(0.3, k - 0.3); break; }
    eye = [eye[0] + d[0] * sgn * dist, eye[1] + d[1] * sgn * dist, eye[2] + d[2] * sgn * dist];
    if (camView === 2) { vyaw = P.yaw + Math.PI; vpitch = -P.pitch; }
  }
  const fe = SAVE.settings.fovEffect !== false, targetFov = SAVE.settings.fov * (fe && P.sprinting ? 1.12 : 1) * (fe && P.flying && P.sprinting ? 1.05 : 1) * (fe && P.draw > 0 ? 1 - 0.15 * Math.min(1, P.draw) : 1);
  fov += (targetFov - fov) * Math.min(1, dt * 8);
  const proj = perspective(fov * Math.PI / 180, w / Math.max(1, h), 0.05, far + 60);
  const view = viewMatrix(eye, vyaw, vpitch), vp = mat4mul(proj, view), planes = frustumPlanes(vp);
  gl.useProgram(prog); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uEye, eye);
  const tint = mix([0.55, 0.62, 1.0], [1, 1, 1], clamp((dl - 0.16) / 0.5, 0, 1));
  gl.uniform3fv(U.uSkyTint, tint); gl.uniform1f(U.uGamma, clamp((+SAVE.settings.brightness || 0) / 100, 0, 1) * 0.85); gl.uniform1f(U.uTime, performance.now() / 1000); gl.uniform1f(U.uMin, 0.045); gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uWater, 0);
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
  const right = [Math.cos(vyaw), 0, Math.sin(vyaw)], fwd = [Math.sin(vyaw) * Math.cos(vpitch), Math.sin(vpitch), -Math.cos(vyaw) * Math.cos(vpitch)];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  drawMobs(DYN, o[0], o[1], o[2]); drawItems(DYN, o[0], o[1], o[2]); if (camView) drawPlayerModel(DYN, o[0], o[1], o[2], dt); drawParticles(DYN, o[0], o[1], o[2], right, [-up[0], -up[1], -up[2]]);
  DYN.draw();
  // block outline
  const t = G.target;
  if (t && !G.ui && !G.targetMob) {
    const lo = -0.002, hi = 1.002, x = t.x - o[0], y = t.y - o[1], z = t.z - o[2];
    const b = BLOCK[t.id]; let y1 = hi; if (b && b.render === 'torch') y1 = 0.65; if (b && b.render === 'water') y1 = 0.9; if (b && b.height) y1 = b.height + 0.002;
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
  if (!P.eyeInWater && SAVE.settings.clouds !== false) {
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
  updateDamageNumbers(vp, dt);
  if ((!G.ui || G.ui === 'chat' || G.ui === 'inventory' || G.ui === 'creative' || G.ui === 'table' || G.ui === 'container') && !hudHidden && !camView) drawHand(w, h, dt);
}
// ── first-person hand ──
// Small 3×4 affine "pose stack" so the held item and arm follow the original game's transforms
// (equip, swing arc, bow draw, eating) instead of a hand-tuned approximation.
const DEG = Math.PI / 180;
function mMul(a, b) { const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0); return o; }
class Pose {
  constructor() { this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; }
  t(x, y, z) { this.m = mMul(this.m, [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]); return this; }
  rx(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]); return this; }
  ry(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]); return this; }
  rz(d) { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); this.m = mMul(this.m, [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]); return this; }
  s(x, y = x, z = x) { this.m = mMul(this.m, [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0]); return this; }
  fn() { const m = this.m.slice(); return p => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]]; }
}
// Items are drawn as 1-pixel-thick extruded sprites (like the original): a front and back face plus a
// side wall for every opaque pixel edge. Built once per tile from the atlas alpha channel.
let atlasAlpha = null;
const ITEM_MESH = new Map();
function itemMesh(tile) {
  let m = ITEM_MESH.get(tile); if (m) return m;
  if (!atlasAlpha) atlasAlpha = atlasCanvas.getContext('2d').getImageData(0, 0, ATLAS, ATLAS).data;
  const ox = (tile % TPR) * TS, oy = Math.floor(tile / TPR) * TS;
  const A = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && atlasAlpha[((oy + y) * ATLAS + ox + x) * 4 + 3] >= 128;
  const z0 = 7.5 / 16, z1 = 8.5 / 16, uv = (u, v) => uvOf(tile, u, v);
  m = [{ p: [[0, 0, z1], [1, 0, z1], [1, 1, z1], [0, 1, z1]], uv: [uv(0, 1), uv(1, 1), uv(1, 0), uv(0, 0)], sh: 1 },
    { p: [[1, 0, z0], [0, 0, z0], [0, 1, z0], [1, 1, z0]], uv: [uv(1, 1), uv(0, 1), uv(0, 0), uv(1, 0)], sh: 0.78 }];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!A(x, y)) continue;
    const X0 = x / 16, X1 = (x + 1) / 16, Y0 = 1 - (y + 1) / 16, Y1 = 1 - y / 16, c = uv((x + 0.5) / 16, (y + 0.5) / 16), C = [c, c, c, c];
    if (!A(x - 1, y)) m.push({ p: [[X0, Y0, z0], [X0, Y0, z1], [X0, Y1, z1], [X0, Y1, z0]], uv: C, sh: 0.7 });
    if (!A(x + 1, y)) m.push({ p: [[X1, Y0, z1], [X1, Y0, z0], [X1, Y1, z0], [X1, Y1, z1]], uv: C, sh: 0.7 });
    if (!A(x, y - 1)) m.push({ p: [[X0, Y1, z1], [X1, Y1, z1], [X1, Y1, z0], [X0, Y1, z0]], uv: C, sh: 0.92 });
    if (!A(x, y + 1)) m.push({ p: [[X0, Y0, z0], [X1, Y0, z0], [X1, Y0, z1], [X0, Y0, z1]], uv: C, sh: 0.55 });
  }
  ITEM_MESH.set(tile, m); return m;
}
function drawItemMesh(B, tile, xf, sky, blk, shadeMul = 1) { for (const q of itemMesh(tile)) B.quad(q.p.map(xf), q.uv, sky, blk, q.sh * shadeMul); }
const isCubeItem = id => { const b = id && id < 256 ? BLOCK[id] : null; return !!(b && (b.render === 'cube' || b.render === 'cutout' || b.render === 'translucent' || b.render === 'bed')); };
function itemTileIdle(id) { const b = id < 256 ? BLOCK[id] : null; return b ? T[typeof b.tex === 'string' ? b.tex : b.tex.side] : T[ITEM[id].icon]; }
function itemTile(id) {
  if (id === BOW && P && P.draw > 0) return T['bow_' + (P.draw < 0.35 ? 1 : P.draw < 0.8 ? 2 : 3)];
  const b = id < 256 ? BLOCK[id] : null; return b ? T[typeof b.tex === 'string' ? b.tex : b.tex.side] : T[ITEM[id].icon];
}
const handLower = [0, 0], lastHeld = [-1, -1];
function drawHand(w, h, dt) {
  if (P.dead) return;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const proj = perspective(70 * Math.PI / 180, w / Math.max(1, h), 0.01, 10);
  gl.uniformMatrix4fv(U.uVP, false, proj); gl.uniform3f(U.uEye, 0, 0, 0); gl.uniform3f(U.uOffset, 0, 0, 0); gl.uniform2f(U.uFogR, 1e5, 1e5 + 1); gl.uniform1f(U.uBlend, 0);
  HAND.reset();
  const [sky, blk] = lightAt(P.x, P.y + eyeHeight(), P.z);
  const ids = [G.inv[G.sel] ? G.inv[G.sel].id : 0, G.off ? G.off.id : 0];
  for (const hi of [0, 1]) { if (ids[hi] !== lastHeld[hi]) { handLower[hi] = 1; lastHeld[hi] = ids[hi]; } handLower[hi] = Math.max(0, handLower[hi] - Math.min(dt, 0.1) * 4.8); }
  renderHandItem(0, ids[0], sky, blk);
  if (ids[1]) renderHandItem(1, ids[1], sky, blk); // the off-hand is drawn mirrored on the left, like the original
  gl.disable(gl.CULL_FACE); HAND.draw();
}
function renderHandItem(hi, id, sky, blk) {
  const swr = hi ? P.swingOffT : P.swingT, sw = swr >= 0 ? swr : 0, sq = Math.sqrt(sw), equip = handLower[hi], using = (P.useHand || 0) === hi;
  const sp = Math.hypot(P.vx, P.vz), bobA = SAVE.settings.bob && P.onGround && !P.flying ? Math.min(1, sp / 4) : 0;
  const ps = new Pose(); if (hi) ps.s(-1, 1, 1);
  ps.t(Math.sin(P.bob * 1.6) * 0.025 * bobA, -Math.abs(Math.cos(P.bob * 1.6)) * 0.03 * bobA, 0);
  if (!id) {
    // empty hand: the player's arm, posed exactly like the original renderPlayerArm
    ps.t(0.64 - 0.3 * Math.sin(sq * Math.PI), 0.4 * Math.sin(sq * 2 * Math.PI) - 0.6 - equip * 0.6, -0.4 * Math.sin(sw * Math.PI) - 0.72)
      .ry(45).ry(Math.sin(sq * Math.PI) * 70).rz(Math.sin(sw * sw * Math.PI) * -20)
      .t(-1, 3.6, 3.5).rz(120).rx(200).ry(-135).t(5.6, 0, 0);
    const xf = ps.fn(), slim = charOf().slim, x0 = (slim ? -7 : -8) / 16, fp = T.pl_arm_fp;
    box(HAND, [x0, 0, -2 / 16], [-4 / 16, 12 / 16, 2 / 16], [fp, fp, T.pl_arm_u, T.pl_arm_t, fp, fp], xf, sky, blk);
    const ch = G.armor[1], am = ch && armorOf(ch.id);
    if (am) { const st = T['armor_skin_' + ARMOR_MATS[am.mat].key], e = 0.6 / 16; box(HAND, [x0 - e, -e, -2 / 16 - e], [-4 / 16 + e, 5 / 16, 2 / 16 + e], [st, st, st, st, st, st], xf, sky, blk); }
    return;
  }
  const eatK = using && P.eating > 0 ? P.eating / 1.6 : 0;
  if (using && P.draw > 0 && id === BOW) {
    ps.t(0.56, -0.52 - equip * 0.6, -0.72).t(-0.2785682, 0.18344387, 0.15731531).rx(-13.935).ry(35.3).rz(-9.785);
    const f = Math.min(1, (P.draw * P.draw + P.draw * 2) / 3);
    if (f > 0.1) ps.t(0, Math.sin((P.draw * 20 - 2) * 1.3) * (f - 0.1) * 0.004, 0);
    ps.t(0, 0, f * 0.04).s(1, 1, 1 + f * 0.2).ry(-45);
  } else if (eatK > 0) {
    const left = (1 - eatK) * 32, f1 = 1 - eatK;
    if (f1 < 0.8) ps.t(0, Math.abs(Math.cos(left / 4 * Math.PI) * 0.1), 0);
    const f3 = 1 - Math.pow(f1, 27);
    ps.t(f3 * 0.6, f3 * -0.5, 0).ry(f3 * 90).rx(f3 * 10).rz(f3 * 30).t(0.56, -0.52 - equip * 0.6, -0.72);
  } else {
    ps.t(-0.4 * Math.sin(sq * Math.PI), 0.2 * Math.sin(sq * 2 * Math.PI), -0.2 * Math.sin(sw * Math.PI))
      .t(0.56, -0.52 - equip * 0.6, -0.72)
      .ry(45 + Math.sin(sw * sw * Math.PI) * -20).rz(Math.sin(sq * Math.PI) * -20).rx(Math.sin(sq * Math.PI) * -80).ry(-45);
  }
  if (isCubeItem(id)) { ps.ry(45).s(0.4).t(-0.5, -0.5, -0.5); box(HAND, [0, 0, 0], [1, BLOCK[id].height || 1, 1], blockTiles(id), ps.fn(), sky, blk); }
  else { ps.t(1.13 / 16, 3.2 / 16, 1.13 / 16).ry(-90).rz(25).s(0.68).t(-0.5, -0.5, -0.5); drawItemMesh(HAND, hi === (P.useHand || 0) ? itemTile(id) : itemTileIdle(id), ps.fn(), sky, blk); }
}
// floating damage numbers (optional, Settings → 전투)
function updateDamageNumbers(vp, dt) {
  const box = $('dnums'), list = W.dnums || []; if (!box) return;
  for (let i = list.length - 1; i >= 0; i--) { const n = list[i]; n.t += dt; n.y += dt * 0.7; if (n.t > 1) list.splice(i, 1); }
  while (box.children.length < list.length) box.append(document.createElement('b'));
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  [...box.children].forEach((el, i) => {
    const n = list[i]; if (!n) { el.style.display = 'none'; return; }
    const x = vp[0] * n.x + vp[4] * n.y + vp[8] * n.z + vp[12], y = vp[1] * n.x + vp[5] * n.y + vp[9] * n.z + vp[13], w = vp[3] * n.x + vp[7] * n.y + vp[11] * n.z + vp[15];
    if (w <= 0.05) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.className = n.crit ? 'crit' : '';
    el.textContent = (Math.round(n.v * 10) / 10).toString();
    el.style.left = ((x / w * 0.5 + 0.5) * cw).toFixed(1) + 'px'; el.style.top = ((0.5 - y / w * 0.5) * ch).toFixed(1) + 'px'; el.style.opacity = Math.min(1, (1 - n.t) * 3).toFixed(2);
  });
}

// ─────────────────────────── player character ───────────────────────────
// Two body models like the original — classic (4-pixel arms) and slim (3-pixel arms) — with original
// pixel-art looks that you can recolour. Skin tiles are painted into the atlas at runtime.
const CHAR_SKIN = [[243, 210, 181], [230, 185, 143], [201, 144, 100], [154, 100, 64], [107, 67, 42]];
const CHAR_HAIR = [[36, 28, 28], [74, 48, 32], [138, 74, 34], [224, 192, 104], [184, 184, 192], [44, 58, 120], [122, 34, 56]];
const CHAR_SHIRT = [[184, 51, 43], [216, 120, 44], [216, 192, 74], [76, 138, 58], [46, 128, 134], [53, 87, 168], [122, 74, 168], [230, 230, 230], [42, 42, 46]];
const CHAR_PANTS = [[58, 58, 64], [168, 147, 94], [106, 74, 48], [32, 32, 36], [63, 95, 143], [90, 106, 52]];
const CHAR_PRESETS = [
  { name: '바위', model: 'classic', skin: 1, hair: 0, style: 0, shirt: 0, pants: 0 },
  { name: '노을', model: 'slim', skin: 0, hair: 6, style: 1, shirt: 6, pants: 1 },
  { name: '숲지기', model: 'classic', skin: 3, hair: 1, style: 0, shirt: 3, pants: 2 },
  { name: '새벽', model: 'slim', skin: 2, hair: 3, style: 1, shirt: 5, pants: 3 }];
function charOf() { const c = Object.assign({}, CHAR_PRESETS[0], (SAVE && SAVE.settings.char) || {}); c.slim = c.model === 'slim'; return c; }
// pixel art per face; one character per pixel, stretched to fill a 16×16 tile
const CHAR_ART = {
  headF: [['HHHHHHHH', 'HHHHHHHH', 'H......H', '.bb..bb.', '..e..e..', '...nn...', '...mm...', '........'],
    ['HHHHHHHH', 'HHHHHHHH', 'HHH..HHH', 'Hbb..bbH', 'H.e..e.H', 'H..nn..H', 'H..mm..H', 'H......H']],
  headR: [['HHHHHHHH', 'HHHHHHHH', 'HHHH....', 'HHH.....', 'HH..k...', 'HH......', 'H.......', '........'],
    ['HHHHHHHH', 'HHHHHHHH', 'HHHHH...', 'HHHHH...', 'HHHHHk..', 'HHHH....', 'HHHH....', 'HHH.....']],
  headB: [['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', '........'], ['HHHHHHHH']],
  bodyF: ['sss..sss', 'ssss.sss', 'ssssssss', 'ssssLsss', 'ssssssss', 'ssssssss', 'ssssLsss', 'ssssssss', 'ssssssss', 'ssssLsss', 'ssssssss', 'dddddddd'],
  bodyB: ['ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dddddddd'],
  arm: ['ssss', 'ssss', 'ssss', 'dddd', '....', '....', '....', '....', '....', '....', '....', 'kkkk'],
  leg: ['PPPP', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'oooo', 'oooo', 'oooo'],
};
const CHAR_TILES = ['pl_head_f', 'pl_head_r', 'pl_head_l', 'pl_head_b', 'pl_head_t', 'pl_head_u', 'pl_body_f', 'pl_body_b', 'pl_body_s', 'pl_body_t', 'pl_body_u', 'pl_arm_s', 'pl_arm_fp', 'pl_arm_t', 'pl_arm_u', 'pl_leg_s', 'pl_leg_t', 'pl_leg_u'];
function charPalette(c) {
  const sk = CHAR_SKIN[c.skin] || CHAR_SKIN[0], h = CHAR_HAIR[c.hair] || CHAR_HAIR[0], sh = CHAR_SHIRT[c.shirt] || CHAR_SHIRT[0], pa = CHAR_PANTS[c.pants] || CHAR_PANTS[0];
  return { '.': sk, k: mul(sk, 0.86), n: mul(sk, 0.88), m: mul(sk, 0.68), e: [34, 26, 30], H: h, b: mul(h, 0.7), s: sh, d: mul(sh, 0.74), L: mul(sh, 1.22), p: pa, P: mul(pa, 0.75), o: [56, 46, 40] };
}
function paintCharacter() {
  if (!atlasCanvas) return;
  const c = charOf(), pal = charPalette(c), g = atlasCanvas.getContext('2d'), img = g.createImageData(16, 16), D = img.data, A = CHAR_ART;
  const put = (name, rows, flipY = false, mirror = false) => {
    const i = T[name], w = rows[0].length, h = rows.length;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ay = Math.floor((flipY ? 15 - y : y) * h / 16), ax = Math.floor((mirror ? 15 - x : x) * w / 16), col = pal[rows[ay][ax]] || pal['.'];
      const v = 0.95 + hash2(ax * 7 + i, ay * 13, 99) * 0.1, k = (y * 16 + x) * 4;
      D[k] = clamp(col[0] * v, 0, 255); D[k + 1] = clamp(col[1] * v, 0, 255); D[k + 2] = clamp(col[2] * v, 0, 255); D[k + 3] = 255;
    }
    g.putImageData(img, (i % TPR) * TS, Math.floor(i / TPR) * TS);
  };
  const st = c.style ? 1 : 0;
  put('pl_head_f', A.headF[st]); put('pl_head_r', A.headR[st]); put('pl_head_l', A.headR[st], false, true); put('pl_head_b', A.headB[st]);
  put('pl_head_t', ['H']); put('pl_head_u', ['.']);
  put('pl_body_f', A.bodyF); put('pl_body_b', A.bodyB); put('pl_body_s', A.bodyB); put('pl_body_t', ['s']); put('pl_body_u', ['p']);
  put('pl_arm_s', A.arm); put('pl_arm_fp', A.arm, true); put('pl_arm_t', ['s']); put('pl_arm_u', ['k']);
  put('pl_leg_s', A.leg); put('pl_leg_t', ['p']); put('pl_leg_u', ['o']);
  if (gl && atlasTex) { gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas); }
}
// flat front view (16×32 px) for the inventory and the character screen, with worn armor on top
function drawPortrait(cv, armor) {
  if (!cv) return;
  const c = charOf(), pal = charPalette(c), g = cv.getContext('2d'), A = CHAR_ART, aw = c.slim ? 3 : 4;
  g.clearRect(0, 0, 16, 32);
  const blit = (rows, x0, y0, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = rows[Math.floor(y * rows.length / h)], col = pal[r[Math.floor(x * r.length / w)]] || pal['.']; g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; g.fillRect(x0 + x, y0 + y, 1, 1); } };
  blit(A.headF[c.style ? 1 : 0], 4, 0, 8, 8); blit(A.bodyF, 4, 8, 8, 12);
  blit(A.arm, 4 - aw, 8, aw, 12); blit(A.arm, 12, 8, aw, 12); blit(A.leg, 4, 20, 4, 12); blit(A.leg, 8, 20, 4, 12);
  const over = (slot, rects) => { const s = armor && armor[slot], a = s && armorOf(s.id); if (!a) return; const col = ARMOR_MATS[a.mat].col; for (const [x, y, w, h, f] of rects) { g.fillStyle = `rgb(${col.map(v => clamp(v * (f || 1), 0, 255) | 0).join(',')})`; g.fillRect(x, y, w, h); } };
  over(0, [[4, 0, 8, 2, 1.1], [3, 2, 1, 3, 0.8], [12, 2, 1, 3, 0.8]]);
  over(1, [[4, 8, 8, 9, 1], [4 - aw, 8, aw, 4, 0.85], [12, 8, aw, 4, 0.85], [7, 9, 2, 6, 1.15]]);
  over(2, [[4, 17, 8, 3, 0.95], [4, 20, 4, 7, 0.9], [8, 20, 4, 7, 0.9]]);
  over(3, [[4, 28, 4, 4, 0.8], [8, 28, 4, 4, 0.8]]);
}
// ── third-person model ──
let camView = 0; // 0 first person, 1 behind, 2 in front
function cycleView() {
  camView = (camView + 1) % 3; $('mc').classList.toggle('cam2', camView === 2);
  toast(['1인칭 시점', '3인칭 시점 (뒤)', '3인칭 시점 (앞)'][camView]);
}
function drawPlayerModel(B, ox, oy, oz, dt) {
  if (P.dead) return;
  const c = charOf(), aw = c.slim ? 3 : 4;
  const [sky, blk] = lightAt(P.x, P.y + 1.2, P.z), flash = P.hurt > 0.25 ? 1 : 0;
  // the body follows where you walk; the head leads it, like the original
  const sp = Math.hypot(P.vx, P.vz), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let dy = wrap(P.yaw - P.bodyYaw);
  if (sp > 0.5) P.bodyYaw += dy * Math.min(1, dt * 10); else if (Math.abs(dy) > 0.85) P.bodyYaw += dy - Math.sign(dy) * 0.85;
  dy = wrap(P.yaw - P.bodyYaw);
  const amt = P.flying ? 0.15 : Math.min(1, sp / 4.3), ph = P.bob * 2.3, legA = Math.cos(ph) * 50 * amt, armA = -Math.cos(ph) * 40 * amt;
  const root = new Pose().t(P.x - ox, P.y - oy - (P.sneaking ? 0.12 : 0), P.z - oz).ry(-P.bodyYaw / DEG).s(0.9375 / 16);
  const sub = (x, y, z) => { const p = new Pose(); p.m = root.m.slice(); return p.t(x, y, z); };
  const bx = (pose, mn, mx, tiles, inf = 0) => box(B, [mn[0] - inf, mn[1] - inf, mn[2] - inf], [mx[0] + inf, mx[1] + inf, mx[2] + inf], tiles, pose.fn(), sky, blk, flash);
  const t6 = n => { const t = T[n]; return [t, t, t, t, t, t]; };
  const arm = G.armor || [], amat = i => { const s = arm[i], a = s && armorOf(s.id); return a ? 'armor_skin_' + ARMOR_MATS[a.mat].key : null; };
  const TL = [T.pl_leg_s, T.pl_leg_s, T.pl_leg_t, T.pl_leg_u, T.pl_leg_s, T.pl_leg_s], TA = [T.pl_arm_s, T.pl_arm_s, T.pl_arm_t, T.pl_arm_u, T.pl_arm_s, T.pl_arm_s];
  // legs
  for (const side of [1, -1]) {
    const p = sub(side * 2, 12, 0).rx(side * legA);
    bx(p, [-2, -12, -2], [2, 0, 2], TL);
    if (amat(2)) bx(p, [-2, -8, -2], [2, 0, 2], t6(amat(2)), 0.4);
    if (amat(3)) bx(p, [-2, -12, -2], [2, -8.5, 2], t6(amat(3)), 0.8);
  }
  // body
  const body = sub(0, 12, 0);
  bx(body, [-4, 0, -2], [4, 12, 2], [T.pl_body_s, T.pl_body_s, T.pl_body_t, T.pl_body_u, T.pl_body_b, T.pl_body_f]);
  if (amat(1)) bx(body, [-4, 1, -2], [4, 12, 2], t6(amat(1)), 0.8);
  if (amat(2)) bx(body, [-4, 0, -2], [4, 2.5, 2], t6(amat(2)), 0.5);
  // arms: walking swing, attack swing, bow pose
  const pitch = P.pitch / DEG, bowing = P.draw > 0;
  for (const side of [1, -1]) {
    const hand = side > 0 ? 0 : 1, sw = hand ? P.swingOffT : P.swingT, s = sw >= 0 ? Math.sin(Math.sqrt(sw) * Math.PI) : 0;
    let rx = side * armA, ry = 0, rz = side * 3;
    if (s) { rx = 30 + s * 70 + pitch * 0.5; ry = side * s * 20; }
    if (bowing) { rx = 90 + pitch; ry = side * (hand === P.useHand ? -6 : 22); rz = 0; }
    if (P.eating > 0 && hand === P.useHand) { rx = 70 + Math.sin(P.eating * 20) * 8; ry = -side * 30; }
    const p = sub(side * (4 + aw / 2), 22, 0).ry(ry).rx(rx).rz(rz);
    bx(p, [-aw / 2, -10, -2], [aw / 2, 2, 2], TA);
    if (amat(1)) bx(p, [-aw / 2, -3, -2], [aw / 2, 2, 2], t6(amat(1)), 0.7);
    // held item
    const st = hand ? G.off : G.inv[G.sel], id = st ? st.id : 0;
    if (id) {
      const ip = new Pose(); ip.m = p.m.slice(); ip.t(0, -10, -0.5);
      if (isCubeItem(id)) { ip.s(5).t(-0.5, -0.8, -0.8); box(B, [0, 0, 0], [1, BLOCK[id].height || 1, 1], blockTiles(id), ip.fn(), sky, blk, flash); }
      else { ip.ry(90 * side).s(9).t(-0.2, -0.2, -0.5); drawItemMesh(B, itemTile(id), ip.fn(), sky, blk); }
    }
  }
  // head
  const head = sub(0, 24, 0).ry(-dy / DEG).rx(pitch);
  bx(head, [-4, 0, -4], [4, 8, 4], [T.pl_head_r, T.pl_head_l, T.pl_head_t, T.pl_head_u, T.pl_head_b, T.pl_head_f]);
  if (amat(0)) bx(head, [-4, 3, -4], [4, 8, 4], t6(amat(0)), 0.9);
}

// ─────────────────────────── input ───────────────────────────
let expectUnlock = false, lastUnlock = 0, sprintTap = false, showDebug = false, hudHidden = false, sneakLatch = false, sprintLatch = false;
function capture() {
  if (!canvas || touchUI() || !G || G.ui) return;
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { }
  canvas.focus();
}
function releasePointer() { if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); } }
const keyAct = c => { const K = SAVE.settings.keys; for (const a in K) if (K[a] === c) return a; return null; };
function refreshMove() {
  const st = SAVE.settings, K = st.keys, k = a => !!keys[K[a]];
  input.fwd = (k('forward') || keys.ArrowUp ? 1 : 0) - (k('back') || keys.ArrowDown ? 1 : 0);
  input.side = (k('right') || keys.ArrowRight ? 1 : 0) - (k('left') || keys.ArrowLeft ? 1 : 0);
  input.jump = k('jump') || touchJump;
  input.sneak = (st.sneakToggle ? sneakLatch : k('sneak') || !!keys.ShiftRight) || touchSneak || touchDown;
  input.descend = k('sneak') || !!keys.ShiftRight || (st.sneakToggle && sneakLatch) || touchDown;
  input.sprintKey = (st.sprintToggle ? sprintLatch : k('sprint') || !!keys.ControlRight) || sprintTap || touchSprint;
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
function setHudHidden(v) { hudHidden = v; $('mc').classList.toggle('nohud', v); }
function bindInput() {
  // key rebinding grabs the next key press before anything else sees it
  ctx.on(window, 'keydown', e => {
    if (!bindingKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') SAVE.settings.keys[bindingKey] = e.code;
    bindingKey = null; saveSettingsSoon(); showKeys();
  }, true);
  ctx.on(window, 'keydown', e => {
    const tg = e.target, typing = tg && (tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && tg.type !== 'range'));
    const c = e.code;
    if (!G) { if (c === 'Escape') { if (typing) tg.blur(); menuEscape(); } return; }
    if (G.loading) return;
    if (G.ui === 'chat') return;
    if (typing && c !== 'Escape') return;
    const act = keyAct(c);
    if (act || /^(Digit\d|Arrow\w+|Tab|F1|F3)$/.test(c)) e.preventDefault();
    if (c === 'Escape') {
      if (performance.now() - lastUnlock < 350) return;
      if (typing) tg.blur();
      if (G.ui === 'pause') menuAction('resume');
      else if (G.ui === 'settings') settingsBack();
      else if (G.ui === 'help' || G.ui === 'stats') showPause();
      else if (G.ui === 'layout') closeLayoutEditor(false);
      else if (G.ui === 'death' || G.ui === 'title') { }
      else if (G.ui) closeScreen();
      else showPause();
      return;
    }
    if (act === 'inventory' && !e.repeat) { if (['inventory', 'creative', 'table', 'container'].includes(G.ui)) closeScreen(); else if (!G.ui) openScreen(G.mode === 'creative' ? 'creative' : 'inventory'); return; }
    if (G.ui) return;
    const st = SAVE.settings;
    if (act === 'forward' && !e.repeat) { const n = performance.now(); if (n - P.lastFwd < 280) sprintTap = true; P.lastFwd = n; }
    if (act === 'jump' && !e.repeat && G.mode === 'creative') { const n = performance.now(); if (n - P.lastJump < 300) { setFlying(!P.flying); P.lastJump = 0; } else P.lastJump = n; }
    if (act === 'sneak' && !e.repeat && st.sneakToggle) sneakLatch = !sneakLatch;
    if (act === 'sprint' && !e.repeat && st.sprintToggle) sprintLatch = !sprintLatch;
    keys[c] = true; refreshMove();
    if (/^Digit[1-9]$/.test(c)) { G.sel = +c.slice(5) - 1; invChanged(); }
    if (e.repeat) return;
    if (act === 'drop') dropItem(e.ctrlKey || e.metaKey);
    if (act === 'chat' || c === 'Enter') { keys[c] = false; openChat(''); }
    if (act === 'command') { keys[c] = false; openChat('/'); }
    if (act === 'debug') { showDebug = !showDebug; $('debug').style.display = showDebug ? 'flex' : 'none'; infoT = 0; }
    if (act === 'hideHud') setHudHidden(!hudHidden);
    if (act === 'fly' && G.mode === 'creative') setFlying(!P.flying);
    if (act === 'swap') swapHands();
    if (act === 'view') cycleView();
  });
  ctx.on(window, 'keyup', e => { delete keys[e.code]; if (e.code === SAVE.settings.keys.forward || e.code === 'ArrowUp') sprintTap = false; if (G) refreshMove(); });
  ctx.on(window, 'blur', () => { for (const k in keys) delete keys[k]; sprintTap = false; if (G) refreshMove(); input.mine = input.use = false; });
  ctx.on(canvas, 'contextmenu', e => e.preventDefault());
  ctx.on(canvas, 'mousedown', e => {
    if (!G || G.ui || G.loading) return;
    wake();
    if (document.pointerLockElement !== canvas) { capture(); if (isTouch()) return; }
    e.preventDefault();
    if (e.button === 0) { input.mine = true; input.click = true; P.attackCd = 0; P.mineCd = 0; }
    else if (e.button === 2) { input.use = true; P.useCd = 0; }
    else if (e.button === 1) pickBlock();
  });
  ctx.on(document, 'mouseup', e => { if (e.button === 0) input.mine = false; if (e.button === 2) input.use = false; });
  ctx.on(document, 'mousemove', e => {
    if (!G || G.ui || !P) return;
    const k = 0.0022 * SAVE.settings.sens / 8;
    if (document.pointerLockElement === canvas) { P.yaw += e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k * (SAVE.settings.invertY ? -1 : 1), -1.55, 1.55); }
    else if (e.buttons && !isTouch() && e.target === canvas) { P.yaw += e.movementX * k * 1.6; P.pitch = clamp(P.pitch - e.movementY * k * (SAVE.settings.invertY ? -1 : 1) * 1.6, -1.55, 1.55); }
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
const PAUSED_UI = ['pause', 'settings', 'help', 'stats', 'layout'];
function frame(now) {
  if (disposed) return;
  raf = requestAnimationFrame(frame);
  const cap = +SAVE.settings.maxFps || 0;
  if (cap && now - last < 1000 / cap - 2) return;
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
  const paused = PAUSED_UI.includes(G.ui);
  if (!paused) { let left = dt; while (left > 1e-4) { const s = Math.min(left, 0.05); step(s); left -= s; } }
  if (saveTimer > 0) { saveTimer -= dt; if (saveTimer <= 0) persist(); }
  if (!paused) { autosave -= dt; if (autosave <= 0) { autosave = 45; persist(); } }
  updateChunks(paused ? 2 : 3);
  render(dt);
  updateHUD(dt);
  if (showDebug) {
    const bx = Math.floor(P.x), bz = Math.floor(P.z), ch = getChunk(bx >> 4, bz >> 4), l = getLight(bx, Math.floor(P.y + 1), bz);
    const biome = ch ? BIOME_NAME[ch.biomes[(bz & 15) * CS + (bx & 15)]] : '?';
    const tday = Math.floor(W.time % DAY_TICKS);
    const facing = ['북쪽 (-Z)', '동쪽 (+X)', '남쪽 (+Z)', '서쪽 (-X)'][((Math.round(P.yaw / (Math.PI / 2)) % 4) + 4) % 4];
    const tg = G.target;
    $('debug').innerHTML = [`Minecraft Mini  ${fpsShow} fps`, `XYZ: ${P.x.toFixed(3)} / ${P.y.toFixed(3)} / ${P.z.toFixed(3)}`, `블록: ${bx} ${Math.floor(P.y)} ${bz}  청크: ${bx >> 4} ${bz >> 4} (로드 ${W.chunks.size})`, `방향: ${facing}`,
      `바이옴: ${biome}  빛: 하늘 ${l >> 4} 블록 ${l & 15}`, `시간: ${tday} (${dayCount()}일째)  난이도: ${DIFF_NAME[W.difficulty]}`, `몹 ${W.mobs.length}  아이템 ${W.items.length}  파티클 ${W.particles.length}`, `시드: ${G.world.seedText}`,
      tg ? `대상 블록: ${tg.x} ${tg.y} ${tg.z} ${info(tg.id) ? info(tg.id).name : ''}` : ''].filter(Boolean).map(t => `<div>${esc(t)}</div>`).join('');
  }
}
function resize() {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(window.devicePixelRatio || 1, isTouch() ? 1.25 : 1.5) * clamp((SAVE && +SAVE.settings.renderScale || 100) / 100, 0.5, 1);
  canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d));
}

window.GameHub.registerGame({
  id: 7,
  async mount(container, context) {
    root = container; ctx = context; muted = ctx.muted;
    buildDOM();
    buildAtlas(); await applyWorldSheets(); prepareBlockTables(); buildIcons(); await applyGeneratedItemIcons();
    paintCharacter(); initGL(canvas);
    makeUITextures();
    const badSave = loadSave(); paintCharacter();
    applyVisualSettings(); renderTouch();
    screenEvents(); touchEvents(); bindInput();
    const ro = new ResizeObserver(() => { resize(); applyVisualSettings(); if (ED) renderEdBar(); }); ro.observe(canvas); ctx.onCleanup(() => ro.disconnect()); resize();
    showLanding();
    if (badSave) toast('저장된 데이터를 읽지 못해 새로 시작해요.');
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
