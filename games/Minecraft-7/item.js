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
const COLOR_NAMES=['하얀색','주황색','자홍색','하늘색','노란색','연두색','분홍색','회색','밝은 회색','청록색','보라색','파란색','갈색','초록색','빨간색','검은색'];
const BULK_BLOCK_NAMES=['윤이 나는 화강암','윤이 나는 섬록암','윤이 나는 안산암','윤이 나는 심층암','심층암 벽돌','금 간 석재 벽돌','이끼 낀 석재 벽돌','사암 벽돌','붉은 사암','매끄러운 사암','석영 벽돌','조각된 석영','윤이 나는 흑암','흑암 벽돌','엔드 석재 벽돌','진홍빛 판자'];
const BULK_BLOCK_START=101, BULK_ITEM_START=334;
const BULK_BLOCK_TILES=Array.from({length:80},(_,i)=>'bulk_block_'+i);
const BULK_ITEM_TILES=Array.from({length:32},(_,i)=>'bulk_item_'+i);
const BULK_ITEM_NAMES=['밀','달걀','깃털','뼈','뼛가루','화약','슬라임볼','엔더 진주','블레이즈 막대','블레이즈 가루','가스트의 눈물','거미 눈','설탕','종이','책','점토 덩이','익히지 않은 연어','익힌 연어','익히지 않은 대구','익힌 대구','열대어','복어','익히지 않은 닭고기','익힌 닭고기','쿠키','호박 파이','버섯 스튜','꿀병','우유 양동이','눈덩이','벽돌 아이템','네더 벽돌 아이템'];
const EXTRA_TEXTURES=['cherry_planks','deepslate','copper_ore','amethyst_block','nether_bricks','end_stone','terracotta','granite','diorite','andesite','copper_block','oxidized_copper','dark_oak_planks','birch_planks','emerald_ore','lapis_ore'];

const SHIELD=408,ELYTRA=409,TOTEM=410,HEALING_POTION=411,SPEED_POTION=412,FIRE_POTION=413,GLASS_BOTTLE=414;
const ANCIENT_DEBRIS=196,NETHERITE_BLOCK=197,CRYING_OBSIDIAN=198,SOUL_SOIL=199;
const NETHERITE_SCRAP=386,NETHERITE_INGOT=387,NETHERITE_PICK=388,NETHERITE_AXE=389,NETHERITE_SHOVEL=390,NETHERITE_SWORD=391,NETHERITE_ARMOR=392,CHAIN_ARMOR=396;
const END_FRAME=190,LAVA=191,LAVA_BUCKET=366,ENDER_EYE=367;
const BED_HEAD=181, DEEP_COAL=182, DEEP_IRON=183, DEEP_GOLD=184, DEEP_DIAMOND=185, MAGMA=186, NETHER_QUARTZ=187, NETHER_PORTAL=188, END_PORTAL=189;
const DIM_NAME={overworld:'오버월드',nether:'네더',end:'엔드'};
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
for(let i=0;i<80;i++) { const group=Math.floor(i/16), n=i%16; const name=group===0?COLOR_NAMES[n]+' 콘크리트':group===1?COLOR_NAMES[n]+' 콘크리트 가루':group===2?COLOR_NAMES[n]+' 테라코타':group===3?COLOR_NAMES[n]+' 무늬 있는 테라코타':BULK_BLOCK_NAMES[n]; B(BULK_BLOCK_START+i,name,BULK_BLOCK_TILES[i],{hard:group===1?0.5:1.5,tool:group===1?'shovel':(i===79?'axe':'pickaxe'),gravity:group===1,cat:'블록'}); }
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
B(BED_HEAD,'침대 머리',{top:'bed_head_top',bottom:'planks',side:'bed_head_side'}, {opaque:false,render:'bed',hard:0.2,tool:'axe',use:'bed',height:9/16,drop:0,creative:false});
for(const [id,name,tex,drop] of [[DEEP_COAL,'심층암 석탄 광석','deep_coal',COAL],[DEEP_IRON,'심층암 철 광석','deep_iron',IRON_ORE],[DEEP_GOLD,'심층암 금 광석','deep_gold',GOLD_ORE],[DEEP_DIAMOND,'심층암 다이아몬드 광석','deep_diamond',DIAMOND]]) B(id,name,tex,{hard:3,tool:'pickaxe',tier:id===DEEP_DIAMOND?3:1,drop});
B(ANCIENT_DEBRIS,'고대 잔해','ancient_debris',{hard:30,tool:'pickaxe',tier:4});B(NETHERITE_BLOCK,'네더라이트 블록','netherite_block',{hard:50,tool:'pickaxe',tier:4});B(CRYING_OBSIDIAN,'우는 흑요석','obsidian',{hard:50,tool:'pickaxe',tier:4,light:10});B(SOUL_SOIL,'영혼 흙','soul_sand',{hard:.5,tool:'shovel'});
B(END_FRAME,'엔드 차원문 틀',{top:'end_frame_top',side:'end_frame_side',bottom:'end_stone'},{hard:-1,use:'endframe'});
for(let id=192;id<=195;id++) B(id,'흐르는 용암','lava',{solid:false,opaque:false,render:'cube',hard:-1,fluid:true,replaceable:true,light:15,creative:false});
B(LAVA,'용암','lava',{solid:false,opaque:false,render:'cube',hard:-1,fluid:true,replaceable:true,light:15,cat:'자연'});
B(MAGMA,'마그마 블록','magma',{hard:0.5,tool:'pickaxe',light:5});
B(NETHER_QUARTZ,'네더 석영 광석','nether_quartz',{hard:3,tool:'pickaxe',tier:1,drop:QUARTZ});
B(NETHER_PORTAL,'네더 차원문','nether_portal',{opaque:false,solid:false,render:'translucent',hard:-1,light:11,use:'nether'});
B(END_PORTAL,'엔드 차원문','end_portal',{opaque:false,solid:false,render:'bed',height:0.05,hard:-1,light:10,use:'end'});
const WEAPON_STATS = { sword: [SWORD_DMG, [1.6, 1.6, 1.6, 1.6, 1.6]], axe: [[7, 9, 9, 7, 9], [0.8, 0.8, 0.9, 1, 1]], pickaxe: [[2, 3, 4, 2, 5], [1.2, 1.2, 1.2, 1.2, 1.2]], shovel: [[2.5, 3.5, 4.5, 2.5, 5.5], [1, 1, 1, 1, 1]] };
BULK_ITEM_NAMES.forEach((name,i)=>{ const foods={16:[2,0.4],17:[6,9.6],18:[2,0.4],19:[5,6],20:[1,0.2],21:[1,0.2],22:[2,1.2],23:[6,7.2],24:[2,0.4],25:[8,4.8],26:[6,7.2],27:[6,1.2]}; I(BULK_ITEM_START+i,name,BULK_ITEM_TILES[i],{cat:foods[i]?'음식':'재료',...(foods[i]?{food:foods[i]}:{}),...([26,27,28].includes(i)?{stack:1}:{})}); });
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
I(LAVA_BUCKET,'용암 양동이','lava_bucket');I(ENDER_EYE,'엔더의 눈','ender_eye');
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
  { key: 'diamond', name: '다이아몬드', mat: DIAMOND, def: [3, 8, 6, 3], mul: 33, tough: 2, col: [78, 220, 208] },
  {key:'netherite',name:'네더라이트',mat:NETHERITE_INGOT,def:[3,8,6,3],mul:37,tough:3,col:[66,60,68],base:NETHERITE_ARMOR},
  {key:'chain',name:'사슬',mat:IRON,def:[2,5,4,1],mul:15,tough:0,col:[145,150,156],base:CHAIN_ARMOR}];
const ARMOR_PARTS = [['helmet', '투구', 11], ['chest', '흉갑', 16], ['legs', '레깅스', 15], ['boots', '부츠', 13]];
const ARMOR_SLOT_NAME = ['머리', '몸통', '다리', '발'];
ARMOR_MATS.forEach((m, mi) => ARMOR_PARTS.forEach(([pk, pn, base], pi) => I((m.base??ARMOR0 + mi * 4) + pi, m.name + ' ' + pn, 'armor_' + m.key + '_' + pk, { stack: 1, cat: '전투', armor: { slot: pi, def: m.def[pi], tough: m.tough, dur: base * m.mul, mat: mi } })));
const armorOf = id => (id >= 256 && ITEM[id] && ITEM[id].armor) || null;
const durOf = id => { const t = toolOf(id), a = armorOf(id); return (t && t.dur) || (a && a.dur) || 0; };

I(NETHERITE_SCRAP,'네더라이트 조각','netherite_scrap');I(NETHERITE_INGOT,'네더라이트 주괴','netherite_ingot');
for(const [id,kind,name]of [[NETHERITE_PICK,'pickaxe','곡괭이'],[NETHERITE_AXE,'axe','도끼'],[NETHERITE_SHOVEL,'shovel','삽'],[NETHERITE_SWORD,'sword','검']])I(id,'네더라이트 '+name,'netherite_'+kind,{stack:1,cat:'도구',tool:{kind,level:5,speed:kind==='sword'?1.5:9,dur:2031,dmg:kind==='sword'?8:kind==='axe'?10:6,aspd:kind==='sword'?1.6:1.0}});
I(SHIELD,'방패','shield_item',{stack:1,cat:'전투',tool:{kind:'shield',level:0,speed:1,dur:336,dmg:1}});
I(ELYTRA,'겉날개','elytra_item',{stack:1,cat:'전투',armor:{slot:1,def:0,tough:0,dur:432,mat:3}});
I(TOTEM,'불사의 토템','totem_item',{stack:1,cat:'전투'});I(GLASS_BOTTLE,'유리병','glass_bottle',{stack:64,cat:'재료'});
for(const [id,name,icon,effect,time]of [[HEALING_POTION,'치유의 물약','healing_potion','instant_health',0],[SPEED_POTION,'신속의 물약','speed_potion','speed',180],[FIRE_POTION,'화염 저항의 물약','fire_potion','fire_resistance',180]])I(id,name,icon,{stack:1,cat:'음식',potion:{effect,time}});
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
shaped(['PIP','PPP',' P '],{P:PLANKS,I:IRON},SHIELD);shaped(['G G',' G '],{G:GLASS},GLASS_BOTTLE);
shapeless([NETHERITE_SCRAP,NETHERITE_SCRAP,NETHERITE_SCRAP,NETHERITE_SCRAP,GOLD,GOLD,GOLD,GOLD],NETHERITE_INGOT);
for(const [from,to]of [[PICK0+4,NETHERITE_PICK],[AXE0+4,NETHERITE_AXE],[SHOVEL0+4,NETHERITE_SHOVEL],[SWORD0+4,NETHERITE_SWORD],...[0,1,2,3].map(i=>[ARMOR0+12+i,NETHERITE_ARMOR+i])])shapeless([from,NETHERITE_INGOT],to);
shapeless([BULK_ITEM_START+8],BULK_ITEM_START+9,2);
shapeless([BULK_ITEM_START+7,BULK_ITEM_START+9],ENDER_EYE);
shaped(['WWW'],{W:BULK_ITEM_START},BREAD);
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
  const M = m.mat, a = m.base??ARMOR0 + mi * 4;
  if(m.key==='netherite'||m.key==='chain')return;
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
const SMELT = { [ANCIENT_DEBRIS]:NETHERITE_SCRAP, [BULK_ITEM_START+16]: BULK_ITEM_START+17, [BULK_ITEM_START+18]: BULK_ITEM_START+19, [BULK_ITEM_START+22]: BULK_ITEM_START+23, [POTATO]: BAKED_POTATO, [COPPER_ORE]: COPPER_INGOT, [IRON_ORE]: IRON, [GOLD_ORE]: GOLD, [SAND]: GLASS, [COBBLE]: STONE, [PORK]: COOKED_PORK, [BEEF]: STEAK, [MUTTON]: COOKED_MUTTON, [CLAY]: BRICKS, [LOG]: COAL, [SPRUCE_LOG]: COAL, [BIRCH_LOG]: COAL, [CACTUS]: COLOR_WOOL + 3 };
const FUEL = { [COAL]: 80, [PLANKS]: 15, [LOG]: 15, [SPRUCE_LOG]: 15, [BIRCH_LOG]: 15, [STICK]: 5, [SAPLING]: 5, [TABLE]: 15, [CHEST]: 15, [BOOKSHELF]: 15, [BOW]: 15 };
TIERS.forEach((t, i) => { if (i === 0) [PICK0, AXE0, SHOVEL0, SWORD0].forEach(b => FUEL[b + i] = 10); });
[CHERRY_LOG,DARK_OAK_LOG,MANGROVE_LOG,BAMBOO_BLOCK,CHERRY_PLANKS,DARK_OAK_PLANKS,BIRCH_PLANKS,MANGROVE_PLANKS,BAMBOO_PLANKS].forEach(id=>FUEL[id]=15);
const SMELT_TIME = 8;
