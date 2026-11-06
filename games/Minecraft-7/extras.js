// ─────────────────────────── original content: this game's own items ───────────────────────────
// New materials with full tool and armor sets, daggers and war hammers for every material, dishes,
// teas and tonics, gems and charms, gadgets, instruments and the fortress items. Names, recipes and
// effects are this game's own designs. Item ids are handed out in order from 500, so new entries must
// only ever be APPENDED at the end of this file (saves store item ids). Block 255 is the Emberbloom.
const EMBERBLOOM = 255;
B(EMBERBLOOM, '잉걸꽃', 'x_emberbloom', Object.assign({}, plant, { light: 7, needsSoul: true, en: 'Emberbloom' }));
let XNEXT = 500;
const XID = {};
const XDESC = {}; // Korean description -> English
function XI(key, name, en, o = {}) {
  const id = XNEXT++; XID[key] = id;
  if (o.desc && o.descEn) XDESC[o.desc] = o.descEn;
  I(id, name, o.icon || 'x_' + key, Object.assign({ en, xkey: key }, o));
  return id;
}

// ── materials ──
XI('bronze_ingot', '청동 주괴', 'Bronze Ingot');
XI('raw_blackiron', '흑철 원석', 'Raw Blackiron', { desc: '화로에 구우면 흑철 주괴가 돼요', descEn: 'Smelt it into a Blackiron Ingot' });
XI('blackiron_ingot', '흑철 주괴', 'Blackiron Ingot');
XI('obsidian_shard', '흑요석 조각', 'Obsidian Shard');
XI('amethyst_crystal', '자수정 결정', 'Amethyst Crystal');
XI('starmetal_ingot', '별철 주괴', 'Starmetal Ingot');

// ── new material tiers: pickaxe, axe, shovel, sword, hoe and four armor pieces each ──
const XTIERS = [
  { key: 'bone', ko: '뼈', en: 'Bone', col: [226, 220, 196], mat: BONE, level: 1, speed: 3, dur: 90, sw: 4.5, ax: 7.5, pk: 2.5, sh: 3, axs: 0.8, arm: [1, 3, 2, 1], mul: 8, tough: 0 },
  { key: 'bronze', ko: '청동', en: 'Bronze', col: [200, 134, 62], mat: XID.bronze_ingot, level: 2, speed: 5, dur: 190, sw: 5.5, ax: 9, pk: 3.5, sh: 4, axs: 0.85, arm: [2, 5, 4, 2], mul: 12, tough: 0 },
  { key: 'amethyst', ko: '자수정', en: 'Amethyst', col: [172, 112, 224], mat: XID.amethyst_crystal, level: 3, speed: 11, dur: 300, sw: 6, ax: 8.5, pk: 4, sh: 4.5, axs: 1, arm: [2, 6, 5, 2], mul: 14, tough: 0 },
  { key: 'blackiron', ko: '흑철', en: 'Blackiron', col: [104, 102, 114], mat: XID.blackiron_ingot, level: 3, speed: 6.5, dur: 520, sw: 6.5, ax: 9.5, pk: 4.5, sh: 5, axs: 0.9, arm: [3, 6, 5, 2], mul: 20, tough: 1 },
  { key: 'obsidian', ko: '흑요석', en: 'Obsidian', col: [86, 60, 132], mat: XID.obsidian_shard, level: 4, speed: 5.5, dur: 1300, sw: 7, ax: 10, pk: 5, sh: 5.5, axs: 0.8, arm: [3, 7, 6, 3], mul: 28, tough: 1.5 },
  { key: 'starmetal', ko: '별철', en: 'Starmetal', col: [150, 222, 242], mat: XID.starmetal_ingot, level: 5, speed: 10, dur: 2600, sw: 8.5, ax: 10.5, pk: 6.5, sh: 6.5, axs: 1.1, arm: [3, 8, 6, 3], mul: 40, tough: 3 },
];
const XARMOR_EN = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
XTIERS.forEach(t => {
  const tool = (kind, dmg, aspd, speed = t.speed) => ({ stack: 1, cat: '도구', tool: { kind, level: t.level, speed, dur: t.dur, dmg, aspd } });
  t.pick = XI(t.key + '_pickaxe', t.ko + ' 곡괭이', t.en + ' Pickaxe', tool('pickaxe', t.pk, 1.2));
  t.axe = XI(t.key + '_axe', t.ko + ' 도끼', t.en + ' Axe', tool('axe', t.ax, t.axs));
  t.shovel = XI(t.key + '_shovel', t.ko + ' 삽', t.en + ' Shovel', tool('shovel', t.sh, 1));
  t.sword = XI(t.key + '_sword', t.ko + ' 검', t.en + ' Sword', tool('sword', t.sw, 1.6, 1.5));
  t.hoe = XI(t.key + '_hoe', t.ko + ' 괭이', t.en + ' Hoe', tool('hoe', 1, Math.min(4, t.level)));
  const mi = ARMOR_MATS.length;
  ARMOR_MATS.push({ key: t.key, name: t.ko, mat: t.mat, def: t.arm, mul: t.mul, tough: t.tough, col: t.col });
  t.armor = ARMOR_PARTS.map(([pk, pn, base], pi) => XI(t.key + '_' + pk, t.ko + ' ' + pn, t.en + ' ' + XARMOR_EN[pi],
    { stack: 1, cat: '전투', icon: 'armor_' + t.key + '_' + pk, armor: { slot: pi, def: t.arm[pi], tough: t.tough, dur: base * t.mul, mat: mi } }));
  ARMOR_MATS[mi].base = t.armor[0];
});

// ── daggers and war hammers for all twelve materials ──
const XWEAPON_TIERS = [
  ['wood', '나무', 'Wooden', PLANKS, 4, 59, [156, 117, 64]], ['stone', '돌', 'Stone', COBBLE, 5, 131, [128, 128, 128]],
  ['iron', '철', 'Iron', IRON, 6, 250, [222, 222, 222]], ['gold', '금', 'Golden', GOLD, 4, 32, [240, 210, 60]],
  ['diamond', '다이아몬드', 'Diamond', DIAMOND, 7, 1561, [90, 226, 212]], ['netherite', '네더라이트', 'Netherite', NETHERITE_INGOT, 8, 2031, [84, 74, 88]],
  ...XTIERS.map(t => [t.key, t.ko, t.en, t.mat, t.sw, t.dur, t.col])];
XWEAPON_TIERS.forEach(([key, ko, en, , sw, dur]) => {
  XI(key + '_dagger', ko + ' 단검', en + ' Dagger', { stack: 1, cat: '전투', tool: { kind: 'dagger', level: 0, speed: 1.5, dur: Math.round(dur * 0.8), dmg: Math.max(2, sw - 2), aspd: 2.4 },
    desc: '빠르게 찌르고, 등 뒤에서 찌르면 피해가 두 배예요', descEn: 'Quick stabs; double damage from behind' });
  XI(key + '_hammer', ko + ' 전투 망치', en + ' War Hammer', { stack: 1, cat: '전투', tool: { kind: 'hammer', level: 0, speed: 1, dur: Math.round(dur * 1.2), dmg: sw + 2.5, aspd: 0.65 },
    desc: '크게 밀쳐내고, 힘껏 치면 주변 적도 흔들려요', descEn: 'Heavy knockback; full swings shake nearby foes' });
});

// ── gems: rough stone from mining, polished gem, and a charm that works from the off hand ──
const XGEMS = [
  ['garnet', '석류석', 'Garnet', [186, 34, 56], 'strength', '힘', 'Strength'],
  ['topaz', '황옥', 'Topaz', [240, 190, 60], 'speed', '신속', 'Speed'],
  ['jade', '비취', 'Jade', [60, 172, 104], 'resistance', '저항', 'Resistance'],
  ['moonstone', '월장석', 'Moonstone', [196, 212, 240], 'night_vision', '야간 투시', 'Night Vision'],
  ['amber', '호박석', 'Amber', [230, 142, 40], 'fire_resistance', '화염 저항', 'Fire Resistance'],
  ['opal', '오팔', 'Opal', [226, 216, 238], 'jump_boost', '도약', 'Jump Boost'],
  ['sapphire', '청옥', 'Sapphire', [44, 84, 204], 'water_breathing', '수중 호흡', 'Water Breathing'],
  ['jet', '흑옥', 'Jet', [52, 46, 60], 'haste', '성급함', 'Haste'],
];
XGEMS.forEach(([key, ko, en, , eff, effKo, effEn]) => {
  XI('rough_' + key, ko + ' 원석', 'Rough ' + en, { desc: '부싯돌과 함께 조합하면 다듬을 수 있어요', descEn: 'Craft with flint to polish it' });
  XI(key, ko, en);
  XI(key + '_charm', ko + ' 부적', en + ' Charm', { stack: 1, cat: '전투', charm: eff, desc: '왼손에 들고 있으면 ' + effKo + ' 효과가 계속돼요', descEn: 'Grants ' + effEn + ' while held in the off hand' });
});

// ── dishes ──
const XF = (key, ko, en, f, o = {}) => XI(key, ko, en, Object.assign({ cat: '음식', food: f }, o));
const bowlFood = { stack: 1, bowl: true }, bottled = { stack: 16, bottle: true };
XF('baked_apple', '구운 사과', 'Baked Apple', [5, 4]);
XF('honey_apple', '꿀 사과', 'Honey Apple', [7, 8]);
XF('caramel_apple', '캐러멜 사과', 'Caramel Apple', [6, 6]);
XF('apple_pie', '사과 파이', 'Apple Pie', [8, 6]);
XF('berry_pie', '베리 파이', 'Berry Pie', [8, 6]);
XF('mushroom_pie', '버섯 파이', 'Mushroom Pie', [8, 8]);
XF('meat_pie', '고기 파이', 'Meat Pie', [10, 11]);
XF('berry_jam', '베리 잼', 'Berry Jam', [4, 2.4], bottled);
XF('jam_toast', '잼 토스트', 'Jam Toast', [9, 9]);
XF('honey_bread', '꿀 빵', 'Honey Bread', [8, 8]);
XF('fried_egg', '달걀 프라이', 'Fried Egg', [3, 3]);
XF('omelette', '오믈렛', 'Omelette', [7, 8]);
XF('potato_pancake', '감자전', 'Potato Pancake', [7, 8]);
XF('potato_chips', '감자칩', 'Potato Chips', [2, 1]);
XF('mashed_potato', '으깬 감자', 'Mashed Potatoes', [8, 9], bowlFood);
XF('carrot_soup', '당근 수프', 'Carrot Soup', [7, 7], bowlFood);
XF('pumpkin_soup', '호박 수프', 'Pumpkin Soup', [7, 8], bowlFood);
XF('fish_chowder', '생선 수프', 'Fish Chowder', [10, 11], bowlFood);
XF('grain_porridge', '곡물죽', 'Grain Porridge', [6, 8], bowlFood);
XF('garden_salad', '채소 샐러드', 'Garden Salad', [6, 6], bowlFood);
XF('fruit_salad', '과일 샐러드', 'Fruit Salad', [7, 7], bowlFood);
XF('ember_stew', '잉걸 스튜', 'Ember Stew', [9, 10], Object.assign({ effects: [['fire_resistance', 90, 0]], desc: '먹으면 잠시 불에 강해져요', descEn: 'Briefly protects you from fire' }, bowlFood));
XF('mushroom_skewer', '버섯 꼬치', 'Mushroom Skewer', [4, 4]);
XF('meat_skewer', '고기 꼬치', 'Meat Skewer', [10, 12]);
XF('lamb_skewer', '양고기 꼬치', 'Lamb Skewer', [9, 11]);
XF('chicken_skewer', '닭꼬치', 'Chicken Skewer', [8, 10]);
XF('steak_sandwich', '스테이크 샌드위치', 'Steak Sandwich', [12, 14]);
XF('salmon_sandwich', '연어 샌드위치', 'Salmon Sandwich', [11, 12]);
XF('egg_sandwich', '달걀 샌드위치', 'Egg Sandwich', [9, 9]);
XF('packed_lunch', '도시락', 'Packed Lunch', [14, 16], { stack: 16 });
XF('melon_juice', '수박 주스', 'Melon Juice', [4, 2], Object.assign({ effects: [['speed', 20, 0]] }, bottled));
XF('apple_juice', '사과 주스', 'Apple Juice', [4, 3], bottled);
XF('berry_juice', '베리 주스', 'Berry Juice', [3, 2], Object.assign({ effects: [['regeneration', 4, 0]] }, bottled));
XF('carrot_juice', '당근 주스', 'Carrot Juice', [4, 4], Object.assign({ effects: [['night_vision', 30, 0]] }, bottled));
XF('roasted_carrot', '구운 당근', 'Roasted Carrot', [5, 6]);
XF('roasted_beetroot', '구운 비트', 'Roasted Beetroot', [3, 4]);
XF('roasted_pumpkin', '구운 호박', 'Roasted Pumpkin', [5, 5]);
XF('roasted_mushroom', '구운 버섯', 'Roasted Mushroom', [3, 3]);
XF('roasted_seeds', '볶은 씨앗', 'Roasted Seeds', [2, 1]);
XF('jerky', '육포', 'Jerky', [5, 4], { desc: '썩은 살점을 화로에 구워 만들어요', descEn: 'Smelted from rotten flesh' });
XF('kelp_crisps', '켈프 칩', 'Kelp Crisps', [3, 2]);
XF('candy', '사탕', 'Candy', [1, 0.5], { effects: [['speed', 5, 0]] });
XF('star_candy', '별사탕', 'Star Candy', [2, 1], { effects: [['jump_boost', 20, 0]] });
XF('pickled_beets', '비트 절임', 'Pickled Beets', [5, 6], bottled);
XF('pancakes', '팬케이크', 'Pancakes', [7, 7]);
XF('trail_bread', '여행자 빵', 'Trail Bread', [6, 10]);
XF('honey_cookie', '꿀 쿠키', 'Honey Cookie', [2, 1.5]);
XF('rabbit_skewer', '토끼 꼬치', 'Rabbit Skewer', [8, 10]);
XF('glow_tart', '발광 열매 타르트', 'Glow Berry Tart', [6, 6], { effects: [['night_vision', 20, 0]] });

// ── teas and tonics: drink right away, any time, and keep the bottle ──
const XD = (key, ko, en, effects, desc, descEn, o = {}) => XI(key, ko, en, Object.assign({ cat: '음식', stack: 16, drink: { effects }, desc, descEn }, o));
XD('dandelion_tea', '민들레차', 'Dandelion Tea', [['haste', 120, 0]], '마시면 2분 동안 빨리 캐요', 'Haste for 2 minutes');
XD('poppy_tea', '양귀비차', 'Poppy Tea', [['regeneration', 12, 0]], '마시면 체력이 조금씩 차올라요', 'Slowly restores health');
XD('cornflower_tea', '수레국화차', 'Cornflower Tea', [['night_vision', 180, 0]], '마시면 3분 동안 어둠 속이 잘 보여요', 'Night vision for 3 minutes');
XD('allium_tea', '파꽃차', 'Allium Tea', [['speed', 120, 0]], '마시면 2분 동안 빨라져요', 'Speed for 2 minutes');
XD('orchid_tea', '난초차', 'Orchid Tea', [['water_breathing', 180, 0]], '마시면 3분 동안 물속에서 숨 쉴 수 있어요', 'Water breathing for 3 minutes');
XD('lily_tea', '은방울꽃차', 'Lily Tea', [['resistance', 90, 0]], '마시면 90초 동안 받는 피해가 줄어요', 'Resistance for 90 seconds');
XD('honey_tea', '꿀차', 'Honey Tea', [], '마시면 체력 3칸을 회복하고 독을 풀어요', 'Heals 3 hearts and cures poison', { drink: { effects: [], heal: 6, cure: true } });
XD('ember_tea', '잉걸꽃차', 'Ember Tea', [['fire_resistance', 300, 0]], '마시면 5분 동안 불과 용암에 강해져요', 'Fire resistance for 5 minutes');
XD('mushroom_brew', '버섯 달임', 'Mushroom Brew', [['resistance', 30, 0], ['regeneration', 6, 0]], '마시면 잠시 단단해지고 회복해요', 'Brief resistance and regeneration');
XD('climber_tonic', '등반가 강장제', "Climber's Tonic", [['jump_boost', 120, 0], ['speed', 120, 0]], '마시면 2분 동안 높이 뛰고 빨라져요', 'Jump boost and speed for 2 minutes');
XD('feather_tonic', '깃털 강장제', 'Feather Tonic', [['slow_falling', 180, 0]], '마시면 3분 동안 천천히 떨어져요', 'Slow falling for 3 minutes');
XD('warrior_tonic', '전사의 강장제', "Warrior's Tonic", [['strength', 90, 0], ['resistance', 90, 0]], '마시면 90초 동안 강하고 단단해져요', 'Strength and resistance for 90 seconds');
XD('shadow_tonic', '그림자 강장제', 'Shadow Tonic', [['invisibility', 120, 0], ['night_vision', 120, 0]], '마시면 2분 동안 몸이 보이지 않아요', 'Invisibility and night vision for 2 minutes');
XD('miner_tonic', '광부의 강장제', "Miner's Tonic", [['haste', 240, 0], ['night_vision', 240, 0]], '마시면 4분 동안 빨리 캐고 잘 보여요', 'Haste and night vision for 4 minutes');
XD('antidote', '해독제', 'Antidote', [], '마시면 독과 나쁜 효과가 모두 사라져요', 'Removes poison and harmful effects', { drink: { effects: [], cure: true } });
XD('leaf_tea', '찻잎차', 'Leaf Tea', [['regeneration', 5, 0], ['haste', 30, 0]], '마시면 잠시 회복하고 손이 빨라져요', 'Brief regeneration and haste');
XD('pine_tea', '솔잎차', 'Pine Needle Tea', [['resistance', 45, 0]], '마시면 45초 동안 받는 피해가 줄어요', 'Resistance for 45 seconds');
XD('blossom_tea', '벚꽃차', 'Blossom Tea', [['regeneration', 10, 0]], '마시면 체력이 조금씩 차올라요', 'Slowly restores health');
XD('cactus_juice', '선인장 즙', 'Cactus Juice', [['fire_resistance', 60, 0]], '마시면 1분 동안 불에 강해져요', 'Fire resistance for 1 minute');

// ── gadgets ──
const XG = (key, ko, en, o, desc, descEn) => XI(key, ko, en, Object.assign({ cat: '도구', desc, descEn }, o));
const gadgetTool = dur => ({ kind: 'gadget', level: 0, speed: 1, dur, dmg: 1 });
XG('return_scroll', '귀환 두루마리', 'Scroll of Return', { stack: 16, act: 'return' }, '읽으면 리스폰 지점으로 돌아가요 (오버월드)', 'Takes you back to your spawn point (Overworld)');
XG('memory_crystal', '기억 수정', 'Memory Crystal', { stack: 1, act: 'mark', tool: gadgetTool(16) }, '웅크리고 쓰면 위치를 기억하고, 그냥 쓰면 그곳으로 이동해요', 'Sneak-use to remember a spot, use to return to it');
XG('pocket_workbench', '휴대용 작업대', 'Pocket Workbench', { stack: 1, act: 'workbench' }, '어디서나 작업대를 열어요', 'Opens a crafting grid anywhere');
XG('depth_gauge', '깊이 측정기', 'Depth Gauge', { stack: 1, gadget: 'depth' }, '들고 있으면 지금 높이를 알려줘요', 'Shows your height while held');
XG('field_guide', '생태 도감', 'Field Guide', { stack: 1, gadget: 'biome' }, '들고 있으면 지금 있는 생물 군계를 알려줘요', 'Names the biome you are in while held');
XG('ore_dowser', '광맥 탐지기', 'Ore Dowser', { stack: 1, act: 'dowse', tool: gadgetTool(64) }, '쓰면 가까운 광석의 방향과 거리를 알려줘요', 'Points out the nearest ore');
XG('bandage', '붕대', 'Bandage', { stack: 16, act: 'heal', heal: 4 }, '쓰면 체력 2칸을 바로 회복해요', 'Heals 2 hearts at once');
XG('first_aid_kit', '구급상자', 'First Aid Kit', { stack: 8, act: 'heal', heal: 12, cure: true }, '쓰면 체력 6칸을 회복하고 독을 풀어요', 'Heals 6 hearts and cures poison');
XG('signal_flare', '신호탄', 'Signal Flare', { stack: 16, act: 'flare' }, '하늘로 쏘아 멀리서도 보이는 불빛을 올려요', 'Shoots a bright trail into the sky');
XG('blast_charge', '폭약 꾸러미', 'Blast Charge', { stack: 16, act: 'blast' }, '블록에 쓰면 잠시 뒤 터져요', 'Use on a block; it explodes shortly after');
XG('magnet', '자석', 'Magnet', { stack: 1, magnet: true }, '왼손에 들고 있으면 주변 아이템을 끌어와요', 'Pulls nearby items while in the off hand');
XG('balloon', '풍선', 'Balloon', { stack: 1, charm: 'slow_falling' }, '왼손에 들고 있으면 천천히 떨어져요', 'Slow falling while in the off hand');
XG('grappling_hook', '갈고리', 'Grappling Hook', { stack: 1, act: 'hook', tool: gadgetTool(100) }, '쓰면 바라본 블록 쪽으로 몸을 끌어당겨요', 'Pulls you toward the block you look at');
XG('super_fertilizer', '고급 비료', 'Super Fertilizer', { act: 'fertilize' }, '쓰면 주변 5×5 작물을 한 번에 키워요', 'Grows crops in a 5×5 area at once');
XG('tome_knowledge', '지식의 책', 'Tome of Knowledge', { stack: 16, act: 'tome' }, '읽으면 경험치 30을 얻어요', 'Grants 30 experience');
XG('lucky_coin', '행운의 금화', 'Lucky Coin', { act: 'coin' }, '주민에게 쓰면 무언가를 건네줘요', 'Give one to a villager for a surprise');
XG('fortress_key', '요새 열쇠', 'Fortress Key', { stack: 16, act: 'key' }, '철창에 쓰면 이어진 철창이 열려요', 'Opens a connected set of iron bars');
XG('fortress_compass', '요새 나침반', 'Fortress Compass', { stack: 1, gadget: 'fortress' }, '네더에서 들고 있으면 가까운 요새 방향을 알려줘요', 'Points to the nearest fortress in the Nether');
XG('hourglass', '모래시계', 'Hourglass', { stack: 1, gadget: 'hourglass' }, '들고 있으면 밤이나 아침까지 남은 시간을 알려줘요', 'Shows the time left until night or morning');
XG('adventure_journal', '모험 일지', 'Adventure Journal', { stack: 1, act: 'journal' }, '읽으면 지금까지의 모험 기록을 보여줘요', 'Shows your adventure so far');

// ── instruments ──
const XS = (key, ko, en, sound) => XI(key, ko, en, { stack: 1, cat: '도구', act: 'play', sound, desc: '쓰면 소리가 나요', descEn: 'Plays a sound' });
XS('bamboo_flute', '대나무 피리', 'Bamboo Flute', 'x_flute');
XS('hand_drum', '손북', 'Hand Drum', 'x_drum');
XS('bone_horn', '뿔나팔', 'Bone Horn', 'x_horn');
XS('lyre', '수금', 'Lyre', 'x_harp');
XS('wind_chime', '풍경', 'Wind Chime', 'x_chime');
XS('ocarina', '오카리나', 'Ocarina', 'x_ocarina');

// ── fortress materials ──
XI('ember_coal', '잉걸 석탄', 'Ember Coal', { desc: '석탄보다 두 배 오래 타요', descEn: 'Burns twice as long as coal' });
XI('ember_dust', '잉걸 가루', 'Ember Dust');
XI('ember_heart', '잉걸 심장', 'Ember Heart', { desc: '블레이즈가 가끔 떨어뜨려요', descEn: 'Sometimes dropped by blazes' });
// (append new items above this line only by adding at the very end of the file)

// ── recipes ──
{
  const x = XID, S = STICK;
  shapeless([COPPER_INGOT, COPPER_INGOT, COPPER_INGOT, IRON_NUGGET], x.bronze_ingot, 3);
  shapeless([RAW_IRON, BLACKSTONE, COAL], x.raw_blackiron); shapeless([RAW_IRON, BLACKSTONE, CHARCOAL], x.raw_blackiron);
  shapeless([OBSIDIAN], x.obsidian_shard, 4);
  shaped(['AA', 'AA'], { A: AMETHYST_SHARD }, x.amethyst_crystal);
  shapeless([DIAMOND, POPPED_CHORUS, POPPED_CHORUS, GLOW_DUST], x.starmetal_ingot, 2);
  SMELT[x.raw_blackiron] = x.blackiron_ingot;
  XTIERS.forEach(t => {
    const M = t.mat;
    shaped(['MMM', ' S ', ' S '], { M, S }, t.pick); shaped(['MM', 'MS', ' S'], { M, S }, t.axe); shaped(['M', 'S', 'S'], { M, S }, t.shovel);
    shaped(['M', 'M', 'S'], { M, S }, t.sword); shaped(['MM', ' S', ' S'], { M, S }, t.hoe);
    shaped(['MMM', 'M M'], { M }, t.armor[0]); shaped(['M M', 'MMM', 'MMM'], { M }, t.armor[1]); shaped(['MMM', 'M M', 'M M'], { M }, t.armor[2]); shaped(['M M', 'M M'], { M }, t.armor[3]);
  });
  XWEAPON_TIERS.forEach(([key, , , M]) => {
    if (key === 'netherite') { shapeless([x.diamond_dagger, NETHERITE_INGOT], x.netherite_dagger); shapeless([x.diamond_hammer, NETHERITE_INGOT], x.netherite_hammer); return; }
    shaped(['M', 'S'], { M, S }, x[key + '_dagger']); shaped(['MMM', 'MSM', ' S '], { M, S }, x[key + '_hammer']);
  });
  XGEMS.forEach(([key]) => { shapeless([x['rough_' + key], FLINT], x[key]); shaped([' S ', 'NGN', ' N '], { S: STRING, N: GOLD_NUGGET, G: x[key] }, x[key + '_charm']); });
  // dishes
  const COOKED_SALMON = BULK_ITEM_START + 17, COOKED_COD = BULK_ITEM_START + 19, COOKED_CHICKEN = BULK_ITEM_START + 23;
  Object.assign(SMELT, { [APPLE]: x.baked_apple, [EGG]: x.fried_egg, [CARROT]: x.roasted_carrot, [BEETROOT]: x.roasted_beetroot, [PUMPKIN]: x.roasted_pumpkin,
    [BROWN_MUSHROOM]: x.roasted_mushroom, [RED_MUSHROOM]: x.roasted_mushroom, [PUMPKIN_SEEDS]: x.roasted_seeds, [MELON_SEEDS]: x.roasted_seeds, [FLESH]: x.jerky });
  shapeless([APPLE, HONEY_BOTTLE], x.honey_apple); shapeless([APPLE, SUGAR, S], x.caramel_apple);
  shapeless([APPLE, APPLE, SUGAR, EGG, WHEAT], x.apple_pie); shapeless([SWEET_BERRIES, SWEET_BERRIES, SUGAR, EGG, WHEAT], x.berry_pie);
  shapeless([BROWN_MUSHROOM, RED_MUSHROOM, EGG, WHEAT], x.mushroom_pie); shapeless([STEAK, EGG, WHEAT, WHEAT], x.meat_pie);
  shapeless([SWEET_BERRIES, SWEET_BERRIES, SWEET_BERRIES, SUGAR, GLASS_BOTTLE], x.berry_jam); shapeless([BREAD, x.berry_jam], x.jam_toast);
  shapeless([BREAD, HONEY_BOTTLE], x.honey_bread); shapeless([EGG, EGG, BROWN_MUSHROOM], x.omelette);
  shapeless([POTATO, POTATO, EGG, WHEAT], x.potato_pancake); shapeless([BAKED_POTATO, BAKED_POTATO, PAPER], x.potato_chips, 4);
  shapeless([BAKED_POTATO, BAKED_POTATO, BOWL], x.mashed_potato); shapeless([CARROT, CARROT, CARROT, BOWL], x.carrot_soup);
  shapeless([PUMPKIN, BOWL], x.pumpkin_soup); shapeless([COOKED_COD, POTATO, BOWL], x.fish_chowder); shapeless([WHEAT, WHEAT, WHEAT, BOWL], x.grain_porridge);
  shapeless([CARROT, BEETROOT, BOWL], x.garden_salad); shapeless([APPLE, MELON_SLICE, SWEET_BERRIES, BOWL], x.fruit_salad);
  shapeless([EMBERBLOOM, STEAK, BOWL], x.ember_stew); shapeless([EMBERBLOOM, COOKED_PORK, BOWL], x.ember_stew);
  shapeless([BROWN_MUSHROOM, RED_MUSHROOM, S], x.mushroom_skewer); shapeless([COOKED_PORK, CARROT, S], x.meat_skewer);
  shapeless([COOKED_MUTTON, BAKED_POTATO, S], x.lamb_skewer); shapeless([COOKED_CHICKEN, BEETROOT, S], x.chicken_skewer); shapeless([COOKED_RABBIT, CARROT, S], x.rabbit_skewer);
  shapeless([BREAD, STEAK], x.steak_sandwich); shapeless([BREAD, COOKED_SALMON], x.salmon_sandwich); shapeless([BREAD, x.fried_egg], x.egg_sandwich);
  shapeless([BREAD, STEAK, APPLE, CARROT], x.packed_lunch); shapeless([BREAD, COOKED_PORK, APPLE, CARROT], x.packed_lunch);
  shapeless([MELON_SLICE, MELON_SLICE, MELON_SLICE, GLASS_BOTTLE], x.melon_juice); shapeless([APPLE, APPLE, GLASS_BOTTLE], x.apple_juice);
  shapeless([SWEET_BERRIES, SWEET_BERRIES, SWEET_BERRIES, GLASS_BOTTLE], x.berry_juice); shapeless([CARROT, CARROT, GLASS_BOTTLE], x.carrot_juice);
  shapeless([DRIED_KELP, DRIED_KELP, DRIED_KELP], x.kelp_crisps, 2); shapeless([SUGAR, SUGAR, SWEET_BERRIES], x.candy, 4);
  shapeless([SUGAR, POPPED_CHORUS, GLOW_DUST], x.star_candy, 4); shapeless([BEETROOT, BEETROOT, BEETROOT, SUGAR, GLASS_BOTTLE], x.pickled_beets);
  shapeless([WHEAT, WHEAT, EGG, SUGAR], x.pancakes); shapeless([WHEAT, WHEAT, WHEAT, SWEET_BERRIES], x.trail_bread, 2);
  shapeless([HONEY_BOTTLE, WHEAT, WHEAT], x.honey_cookie, 6); shapeless([GLOW_BERRIES, GLOW_BERRIES, SUGAR, WHEAT], x.glow_tart);
  // teas and tonics
  const tea = (ings, out) => shapeless([GLASS_BOTTLE, ...ings], out);
  tea([FLOWER_YELLOW], x.dandelion_tea); tea([FLOWER_RED], x.poppy_tea); tea([CORNFLOWER], x.cornflower_tea); tea([ALLIUM], x.allium_tea);
  tea([BLUE_ORCHID], x.orchid_tea); tea([LILY_VALLEY], x.lily_tea); tea([EMBERBLOOM], x.ember_tea); tea([RED_MUSHROOM, BROWN_MUSHROOM], x.mushroom_brew);
  tea([SLIMEBALL, SUGAR], x.climber_tonic); tea([FEATHER, SUGAR], x.feather_tonic); tea([x.ember_heart, BLAZE_POWDER], x.warrior_tonic);
  tea([INK_SAC, x.jet], x.shadow_tonic); tea([GLOW_INK, GLOW_DUST], x.miner_tonic); tea([FERN, SUGAR], x.antidote);
  tea([LEAVES], x.leaf_tea); tea([SPRUCE_LEAVES], x.pine_tea); tea([CHERRY_LEAVES], x.blossom_tea); tea([CACTUS], x.cactus_juice);
  shapeless([HONEY_BOTTLE, GLOW_BERRIES], x.honey_tea);
  // gadgets
  shapeless([PAPER, ENDER_PEARL, GOLD_NUGGET], x.return_scroll, 2);
  shaped([' A ', 'AEA', ' A '], { A: AMETHYST_SHARD, E: ENDER_PEARL }, x.memory_crystal);
  shapeless([TABLE, LEATHER], x.pocket_workbench);
  shaped([' C ', 'CRC', ' C '], { C: COPPER_INGOT, R: REDSTONE }, x.depth_gauge);
  shapeless([BOOK, WHEAT_SEEDS, FLOWER_YELLOW], x.field_guide);
  shaped(['A A', ' C ', ' C '], { A: AMETHYST_SHARD, C: COPPER_INGOT }, x.ore_dowser);
  shapeless([STRING, STRING, PAPER], x.bandage, 2);
  shapeless([x.bandage, x.bandage, GLIST_MELON, LEATHER], x.first_aid_kit);
  shapeless([GUNPOWDER, PAPER, DYE0 + 14], x.signal_flare, 2);
  shapeless([GUNPOWDER, GUNPOWDER, SAND, PAPER], x.blast_charge, 2);
  shaped(['R R', 'I I', ' I '], { R: REDSTONE, I: IRON }, x.magnet);
  shapeless([STRING, SLIMEBALL, LEATHER], x.balloon);
  shaped([' II', ' SI', 'S  '], { I: IRON, S: STRING }, x.grappling_hook);
  shapeless([BONE_MEAL, BONE_MEAL, GLOW_DUST], x.super_fertilizer, 2);
  shapeless([BOOK, LAPIS, LAPIS, LAPIS], x.tome_knowledge);
  shaped(['NNN', 'NEN', 'NNN'], { N: GOLD_NUGGET, E: EMERALD }, x.lucky_coin, 4);
  shapeless([GOLD, x.blackiron_ingot], x.fortress_key);
  shaped([' B ', 'BCB', ' B '], { B: BULK_ITEM_START + 31, C: COMPASS }, x.fortress_compass);
  shaped(['PPP', 'GSG', 'PPP'], { P: 'planks', G: GLASS, S: SAND }, x.hourglass);
  shapeless([BOOK, FEATHER, INK_SAC], x.adventure_journal);
  // instruments
  shapeless([BAMBOO_BLOCK, STRING], x.bamboo_flute); shaped(['LLL', 'PPP'], { L: LEATHER, P: 'planks' }, x.hand_drum);
  shapeless([BONE, BONE, LEATHER], x.bone_horn); shaped(['W W', 'WSW', ' W '], { W: S, S: STRING }, x.lyre);
  shaped([' S ', 'NNN'], { S: STRING, N: IRON_NUGGET }, x.wind_chime); shapeless([BRICK_ITEM, BRICK_ITEM, CLAY_BALL], x.ocarina);
  // fortress materials
  shapeless([COAL, BLAZE_POWDER], x.ember_coal, 2); shapeless([EMBERBLOOM], x.ember_dust, 2);
  Object.assign(FUEL, { [x.ember_coal]: 160, [x.wood_dagger]: 10, [x.wood_hammer]: 10 });
}

// rough gems turn up when mining stone and deepslate
{
  const top = [XID.rough_garnet, XID.rough_topaz, XID.rough_jade, XID.rough_amber], deep = [XID.rough_moonstone, XID.rough_opal, XID.rough_sapphire, XID.rough_jet];
  const stoneDrop = BLOCK[STONE].drop;
  BLOCK[STONE].drop = r => { const v = r(); return v < 0.005 ? top[Math.floor(v / 0.005 * 4)] : stoneDrop; };
  BLOCK[DEEPSLATE].drop = r => { const v = r(); return v < 0.008 ? deep[Math.floor(v / 0.008 * 4)] : DEEPSLATE; };
}
// English for descriptions and the messages below
Object.assign(EN, XDESC, {
  '잉걸꽃은 영혼 모래나 네더랙 위에만 심을 수 있어요.': 'Emberbloom only grows on soul sand, soul soil or netherrack.',
  '오버월드에서만 쓸 수 있어요.': 'Only works in the Overworld.',
  '리스폰 지점으로 돌아왔어요.': 'You are back at your spawn point.',
  '이 위치를 기억했어요.': 'Location remembered.',
  '기억한 위치가 없어요. 웅크리고 쓰면 기억해요.': 'No location saved. Sneak and use to remember one.',
  '기억한 곳은 다른 차원에 있어요.': 'The remembered spot is in another dimension.',
  '기억한 곳으로 이동했어요.': 'Returned to the remembered spot.',
  '근처에 광석이 없어요.': 'No ore nearby.',
  '{0}: {1}쪽 {2}m': '{0}: {2}m to the {1}',
  '체력이 가득해요.': 'Your health is already full.',
  '블록에 대고 쓰세요.': 'Use it on a block.',
  '경험치 30을 얻었어요.': 'Gained 30 experience.',
  '주민에게 쓰세요.': 'Use it on a villager.',
  '주민이 {0}을(를) 건네줬어요.': 'The villager handed you {0}.',
  '철창에 대고 쓰세요.': 'Use it on iron bars.',
  '철창이 열렸어요.': 'The bars swing open.',
  '{0}일째 · 캔 블록 {1} · 놓은 블록 {2} · 조합 {3} · 사망 {4}': 'Day {0} · mined {1} · placed {2} · crafted {3} · deaths {4}',
  '높이 {0} · {1}': 'Height {0} · {1}',
  '높은 산': 'High peaks', '지상': 'Surface', '지하': 'Underground', '깊은 동굴': 'Deep caves', '심층암 지대': 'Deepslate layer', '세계의 바닥': 'World bottom',
  '네더': 'Nether', '엔드': 'End', '네더에서만 작동해요': 'Only works in the Nether',
  '요새 중앙이에요': 'You are at the fortress center', '요새 중앙까지 {0}m': '{0}m to the fortress center',
  '{0}일째 · 밤까지 {1}분': 'Day {0} · {1} min until night', '{0}일째 · 아침까지 {1}분': 'Day {0} · {1} min until morning',
});

// ── using the new items ──
const XHARMFUL = ['slowness', 'weakness', 'poison', 'wither', 'hunger', 'mining_fatigue', 'levitation', 'instant_damage'];
function xCure() { P.poison = 0; if (P.effects) for (const e of XHARMFUL) delete P.effects[e]; }
function xTeleport(x, y, z, surface) {
  const key = ckey(Math.floor(x) >> 4, Math.floor(z) >> 4);
  if (!W.chunks.has(key)) { const ch = generateChunk(Math.floor(x) >> 4, Math.floor(z) >> 4); W.chunks.set(key, ch); }
  if (surface) y = surfaceY(x, z, y);
  particles(P.x, P.y + 1, P.z, T.c_purpur, 14, 0.4, 2, 0.6);
  Object.assign(P, { x, y, z, vx: 0, vy: 0, vz: 0, fallStart: y, gliding: false });
  sfx('pearl'); hudDirty = true;
}
const XORES = () => new Map([[COAL_ORE, '석탄'], [DEEP_COAL, '석탄'], [IRON_ORE, '철'], [DEEP_IRON, '철'], [COPPER_ORE, '구리'], [GOLD_ORE, '금'], [DEEP_GOLD, '금'],
  [DIAMOND_ORE, '다이아몬드'], [DEEP_DIAMOND, '다이아몬드'], [EMERALD_ORE, '에메랄드'], [LAPIS_ORE, '청금석'], [NETHER_QUARTZ, '네더 석영'], [ANCIENT_DEBRIS, '고대 잔해']]);
let XORE_MAP = null;
const xDirName = (dx, dz) => tr(['북', '동', '남', '서'][((Math.round(Math.atan2(dx, -dz) / (Math.PI / 2)) % 4) + 4) % 4]);
const XCOIN_GIFTS = () => [[EMERALD, 1], [BREAD, 4], [XID.bandage, 2], [XID.return_scroll, 1], [IRON, 3], [XID.packed_lunch, 1], [GOLDEN_CARROT, 2], [XID.apple_pie, 2], [BOOK, 1], [XID.rough_topaz, 1], [XID.honey_tea, 1], [ARROW, 8]];
// returns true when the held item was one of ours and has been used
function xUseItem(t, s, id) {
  const it = ITEM[id]; if (!it || !it.xkey) return false;
  const survival = G.mode === 'survival';
  const giveBottle = () => { if (survival && addToInventory(GLASS_BOTTLE, 1)) spawnItem(GLASS_BOTTLE, 1, P.x, P.y + 1, P.z); };
  if (it.drink) {
    const d = it.drink;
    if (d.heal) P.health = Math.min(20, P.health + d.heal);
    if (d.cure) xCure();
    P.effects ??= {}; for (const [e, time, amp] of d.effects) P.effects[e] = { time, amp };
    consumeHeld(1); giveBottle(); sfx('burp'); hudDirty = true; invChanged(); return true;
  }
  switch (it.act) {
    case 'heal':
      if (P.health >= 20 && !(it.cure && P.poison > 0)) { toast(tr('체력이 가득해요.')); return true; }
      P.health = Math.min(20, P.health + it.heal); if (it.cure) xCure();
      consumeHeld(1); sfx('equip'); hudDirty = true; startSwing(); return true;
    case 'return':
      if ((W.dimension || 'overworld') !== 'overworld') { toast(tr('오버월드에서만 쓸 수 있어요.')); return true; }
      consumeHeld(1); xTeleport(G.spawn.x, G.spawn.y, G.spawn.z, true); toast(tr('리스폰 지점으로 돌아왔어요.')); return true;
    case 'mark': {
      const dim = W.dimension || 'overworld';
      if (P.sneaking) { P.mark = { x: P.x, y: P.y, z: P.z, dim }; sfx('bell'); toast(tr('이 위치를 기억했어요.')); return true; }
      if (!P.mark) { toast(tr('기억한 위치가 없어요. 웅크리고 쓰면 기억해요.')); return true; }
      if (P.mark.dim !== dim) { toast(tr('기억한 곳은 다른 차원에 있어요.')); return true; }
      damageTool(1); xTeleport(P.mark.x, P.mark.y, P.mark.z, false); toast(tr('기억한 곳으로 이동했어요.')); return true;
    }
    case 'workbench': openScreen('table'); sfx('chest'); return true;
    case 'dowse': {
      XORE_MAP ??= XORES();
      const bx = Math.floor(P.x), by = Math.floor(P.y + 1), bz = Math.floor(P.z); let best = null;
      for (let dy = -8; dy <= 8; dy++) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
        const id2 = getBlock(bx + dx, by + dy, bz + dz); if (!XORE_MAP.has(id2)) continue;
        const d = Math.hypot(dx, dy, dz); if (!best || d < best[0]) best = [d, id2, dx, dz];
      }
      damageTool(1); startSwing(); sfx('note', 0.6);
      if (!best) toast(tr('근처에 광석이 없어요.')); else toast(tr('{0}: {1}쪽 {2}m', tr(XORE_MAP.get(best[1])), xDirName(best[2], best[3]), Math.round(best[0])));
      return true;
    }
    case 'flare': {
      consumeHeld(1); sfx('rocket');
      for (let k = 0; k < 40; k++) W.particles.push({ x: P.x + (Math.random() - 0.5) * 0.3, y: P.y + 1.5 + k * 0.6, z: P.z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.4, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 0.4, life: 2 + Math.random() * 1.5, tile: T.glowstone, su: 0, sv: 0, full: true, size: 0.25, grav: -0.5, glow: true });
      return true;
    }
    case 'blast':
      if (!t) { toast(tr('블록에 대고 쓰세요.')); return true; }
      consumeHeld(1); primeTNT(t.px, t.py, t.pz, 2.5); startSwing(); return true;
    case 'hook': {
      const hit = raycast(eyePos(), lookDir(), 24, false);
      if (!hit) { toast(tr('너무 멀어요.')); return true; }
      const dx = hit.x + 0.5 - P.x, dy = hit.y + 0.5 - P.y, dz = hit.z + 0.5 - P.z, d = Math.hypot(dx, dy, dz) || 1, v = Math.min(24, 6 + d * 1.6);
      P.vx = dx / d * v; P.vz = dz / d * v; P.vy = Math.max(P.vy, dy / d * v + 5); P.fallStart = P.y;
      damageTool(1); sfx('bow'); startSwing(); return true;
    }
    case 'fertilize': {
      if (!t) { toast(tr('블록에 대고 쓰세요.')); return true; }
      let grew = 0;
      for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x = t.x + dx, y = t.y + dy, z = t.z + dz, b = getBlock(x, y, z);
        if (b === WHEAT_CROP) { setBlock(x, y, z, WHEAT_RIPE); grew++; }
        else if (b === SAPLING && Math.random() < 0.5) { growTree(x, y, z); grew++; }
        else if (b === EMBERBLOOM && Math.random() < 0.5) { const nx = x + (Math.random() < 0.5 ? -1 : 1), below = getBlock(nx, y - 1, z); if (getBlock(nx, y, z) === AIR && [SOUL_SAND, SOUL_SOIL, NETHERRACK].includes(below)) { setBlock(nx, y, z, EMBERBLOOM); grew++; } }
      }
      boneParticles(t); consumeHeld(1); startSwing(); if (grew) sfx('pop'); return true;
    }
    case 'tome': P.xp = (P.xp || 0) + 30; consumeHeld(1); sfx('bell'); toast(tr('경험치 30을 얻었어요.')); return true;
    case 'coin': {
      const m = G.targetMob; if (!m || m.dead || m.type !== 'villager') { toast(tr('주민에게 쓰세요.')); return true; }
      const gifts = XCOIN_GIFTS(), [gid, n] = gifts[Math.floor(Math.random() * gifts.length)];
      consumeHeld(1); if (addToInventory(gid, n)) spawnItem(gid, n, P.x, P.y + 1, P.z); invChanged(); sfx('pop');
      toast(tr('주민이 {0}을(를) 건네줬어요.', info(gid).name + (n > 1 ? ' ×' + n : ''))); return true;
    }
    case 'key': {
      if (!t || t.id !== IRON_BARS) { toast(tr('철창에 대고 쓰세요.')); return true; }
      const todo = [[t.x, t.y, t.z]], seen = new Set(); let n = 0;
      while (todo.length && n < 40) {
        const [x, y, z] = todo.pop(), k = x + ',' + y + ',' + z; if (seen.has(k)) continue; seen.add(k);
        if (getBlock(x, y, z) !== IRON_BARS) continue; setBlock(x, y, z, AIR); n++;
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) todo.push([x + a, y + b, z + c]);
      }
      consumeHeld(1); sfx('chest'); toast(tr('철창이 열렸어요.')); return true;
    }
    case 'journal': {
      const st = G.stats || {};
      toast(tr('{0}일째 · 캔 블록 {1} · 놓은 블록 {2} · 조합 {3} · 사망 {4}', dayCount(), st.mined || 0, st.placed || 0, st.crafted || 0, st.deaths || 0)); sfx('chest'); return true;
    }
    case 'play': sfx(it.sound); startSwing(); particles(P.x + Math.sin(P.yaw) * 0.6, P.y + 1.6, P.z - Math.cos(P.yaw) * 0.6, T.c_emerald_block, 3, 0.2, 1, 0.6); return true;
  }
  return false;
}
const xCanUse = it => !!(it && it.xkey && (it.drink || it.act));
// off-hand charms and the magnet
function updateExtras(dt) {
  if (P.dead) return;
  const off = G.off && ITEM[G.off.id];
  if (off && off.charm) { P.effects ??= {}; const e = P.effects[off.charm]; if (!e || e.time < 1.5) P.effects[off.charm] = { time: 2.5, amp: 0 }; }
  if (off && off.magnet) for (const e of W.items) {
    if (e.pick > 0) continue;
    const dx = P.x - e.x, dy = P.y + 0.8 - e.y, dz = P.z - e.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 81 && d2 > 1.5) { const k = Math.min(1, 9 * dt / Math.sqrt(d2)); e.x += dx * k; e.y += dy * k * 0.6; e.z += dz * k; }
  }
}
// held-item readouts (the HUD line above the hotbar)
let xBiomeCache = { k: '', v: '' };
const XGADGET = {
  depth() {
    const y = Math.floor(P.y), dim = W.dimension || 'overworld';
    const layer = dim === 'nether' ? '네더' : dim === 'end' ? '엔드' : y > 140 ? '높은 산' : y >= SEA ? '지상' : y >= 30 ? '지하' : y >= 0 ? '깊은 동굴' : y > -45 ? '심층암 지대' : '세계의 바닥';
    return ['d' + y + dim, `<span>${tr('높이 {0} · {1}', y, tr(layer))}</span>`];
  },
  biome() {
    const dim = W.dimension || 'overworld', bx = Math.floor(P.x), bz = Math.floor(P.z), k = dim + bx + ',' + bz;
    if (xBiomeCache.k !== k) { xBiomeCache = { k, v: dim === 'overworld' ? tr(BIOME_NAME[column(bx, bz)[1]] || '') : tr(DIM_NAME[dim]) }; }
    return ['b' + xBiomeCache.v, `<span>${esc(xBiomeCache.v)}</span>`];
  },
  fortress(needle) {
    if (W.dimension !== 'nether') return ['f-none', `<span>${tr('네더에서만 작동해요')}</span>`];
    needle(Math.round(P.x / 256) * 256, Math.round(P.z / 256) * 256, tr('요새 중앙이에요'), '요새 중앙까지 {0}m');
  },
  hourglass() {
    const tt = W.time % DAY_TICKS, night = tt >= 12000 && tt < 23000, left = night ? 23000 - tt : (tt < 12000 ? 12000 - tt : DAY_TICKS - tt + 12000);
    const mins = Math.max(1, Math.ceil(left / 1200));
    return ['h' + mins + night, `<span>${tr(night ? '{0}일째 · 아침까지 {1}분' : '{0}일째 · 밤까지 {1}분', dayCount(), mins)}</span>`];
  },
};

// ── icons (painted procedurally like the rest of the atlas) ──
function retile(name, fn) { const keep = tileCount; tileCount = T[name]; tile(name, fn); tileCount = keep; }
function paintExtras() {
  const xt = (key, fn) => tile('x_' + key, fn);
  const tint = (base, col) => t => {
    t.copy(base);
    t.each((x, y) => { const p = t.get(x, y); if (!p[3]) return; const hi = Math.max(p[0], p[1], p[2]), lo = Math.min(p[0], p[1], p[2]); if (hi - lo > 30) return; t.set(x, y, mul(col, (p[0] + p[1] + p[2]) / 3 / 214), p[3]); });
  };
  const ingot = c => t => { for (let y = 6; y <= 11; y++) for (let x = 2 + (11 - y) * 0.5; x <= 13 - (11 - y) * 0.5; x++) t.set(Math.floor(x), y, mul(c, y === 6 ? 1.25 : y > 9 ? 0.78 : 1)); outline(t, 0.45); };
  const lumpT = (c, dark) => t => { voronoi(t, 4, c, dark, 0.3, 1); t.each((x, y) => { if (Math.hypot(x - 7.5, y - 8) > 5.4) t.set(x, y, [0, 0, 0], 0); }); outline(t, 0.5); };
  const gem = c => t => { shape(t, (x, y) => { const dx = Math.abs(x + 0.5 - 8), dy = y + 0.5 - 8; return dx * 1.1 + Math.abs(dy) * (dy < 0 ? 1.6 : 0.9) < 6 ? mul(c, dy < -1.5 ? 1.25 : x < 8 ? 1.05 : 0.8) : 0; }, c, 0.06); t.set(6, 5, [255, 255, 255]); t.set(7, 5, mix(c, [255, 255, 255], 0.6)); outline(t, 0.4); };
  const roughGem = c => t => { blob(t, 8, 9, 5.6, 4.6, [118, 116, 112], 0.25); for (const [x, y] of [[6, 8], [9, 7], [8, 11], [10, 10]]) { t.set(x, y, c); t.set(x + 1, y, mul(c, 1.25)); t.set(x, y + 1, mul(c, 0.75)); } outline(t, 0.45); };
  const charm = c => t => { for (let k = 0; k < 6; k++) { t.set(4 + Math.floor(k * 0.6), 2 + k, [230, 230, 220]); t.set(11 - Math.floor(k * 0.6), 2 + k, [230, 230, 220]); } t.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 10.5); if (d < 4.2) t.set(x, y, d > 2.6 ? mul([240, 196, 60], 0.9 + (y < 10 ? 0.2 : 0)) : mul(c, d < 1.2 ? 1.3 : 1)); }); outline(t, 0.45); };
  const bottleT = (liq, cork = [140, 100, 60]) => t => { for (let y = 2; y < 5; y++) for (let x = 7; x < 9; x++) t.set(x, y, y === 2 ? cork : [210, 230, 240]); blob(t, 8, 10, 5, 4.6, liq, 0.12); t.set(6, 8, [255, 255, 255]); outline(t, 0.45); };
  const jar = (fill, lid = [150, 104, 60]) => t => { for (let y = 3; y < 5; y++) for (let x = 4; x < 12; x++) t.set(x, y, lid); for (let y = 5; y < 14; y++) for (let x = 4; x < 12; x++) t.set(x, y, x === 4 || x === 11 || y === 13 ? [200, 220, 230] : mul(fill, 0.9 + ((x + y) % 3) * 0.06)); t.set(5, 6, [255, 255, 255]); outline(t, 0.45); };
  const bowlT = (soup, bits) => t => { shape(t, (x, y) => y >= 8 && y <= 13 && Math.abs(x - 7.5) <= 6.5 - (y - 8) * 0.7, [140, 100, 56], 0.1); for (let x = 2; x < 14; x++) { t.set(x, 8, soup); t.set(x, 9, mul(soup, 0.85)); } if (bits) for (const [x, y] of [[4, 8], [7, 8], [10, 8], [12, 9]]) t.set(x, y, bits); outline(t, 0.45); };
  const pie = (crust, fill) => t => { blob(t, 8, 9.5, 6.6, 4, crust, 0.12); blob(t, 8, 9, 5, 2.6, fill, 0.15); for (let x = 3; x < 13; x += 2) t.set(x, 7, mul(crust, 1.15)); outline(t, 0.45); };
  const skewer = cols => t => { for (let k = 0; k < 13; k++) t.set(2 + k, 14 - k, [170, 130, 80]); cols.forEach((c, i) => blob(t, 5.5 + i * 2.8, 11.5 - i * 2.8, 1.9, 1.9, c, 0.15)); outline(t, 0.45); };
  const sandwich = fill => t => { for (let x = 2; x < 14; x++) { t.set(x, 5, [220, 170, 100]); t.set(x, 6, [236, 200, 140]); t.set(x, 7, fill); t.set(x, 8, mul(fill, 0.85)); t.set(x, 9, [236, 200, 140]); t.set(x, 10, [200, 150, 90]); } outline(t, 0.45); };
  const roast = (base, f = 0.82) => t => { t.copy(base); t.each((x, y) => { const p = t.get(x, y); if (p[3]) t.set(x, y, [p[0] * f + 20, p[1] * f * 0.86, p[2] * f * 0.6], p[3]); }); };
  const book = (cover, mark) => t => { for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) t.set(x, y, x > 11 ? [236, 230, 210] : mul(cover, x === 3 ? 0.75 : 1)); if (mark) for (const [x, y] of [[7, 6], [8, 6], [7, 7], [8, 7], [6, 8], [9, 8]]) t.set(x, y, mark); outline(t, 0.45); };
  // materials
  xt('bronze_ingot', ingot([200, 134, 62])); xt('blackiron_ingot', ingot([104, 102, 114])); xt('starmetal_ingot', ingot([150, 222, 242]));
  xt('raw_blackiron', lumpT([96, 92, 104], [52, 48, 58]));
  xt('obsidian_shard', t => { shape(t, (x, y) => y > 2 && y < 14 && Math.abs(x + 0.5 - 8 - (y - 8) * 0.3) < (14 - y) * 0.42 ? mul([70, 48, 110], y < 6 ? 1.3 : 1) : 0, [70, 48, 110], 0.15); outline(t, 0.4); });
  xt('amethyst_crystal', t => { for (const [cx, h, w] of [[5, 8, 1.6], [8, 11, 2], [11, 7, 1.5]]) shape(t, (x, y) => y >= 14 - h && y < 14 && Math.abs(x + 0.5 - cx) < w * Math.min(1, (y - (14 - h)) / 2 + 0.3) ? mul([176, 116, 226], x + 0.5 < cx ? 1.2 : 0.9) : 0, null, 0.1); outline(t, 0.45); });
  // tools for the new materials (recoloured from the iron set) and daggers / hammers for all materials
  XTIERS.forEach(tt => {
    xt(tt.key + '_pickaxe', tint('pickaxe_2', tt.col)); xt(tt.key + '_axe', tint('axe_2', tt.col)); xt(tt.key + '_shovel', tint('shovel_2', tt.col));
    xt(tt.key + '_sword', tint('sword_2', tt.col)); xt(tt.key + '_hoe', tint('c_hoe_2', tt.col));
    ['helmet', 'chest', 'legs', 'boots'].forEach((p, pi) => retile('equip_' + tt.key + '_' + p, t => { t.noise(tt.col, 0.07); t.each((x, y) => { if (y === 0 || y === 15 || x === 0 || x === 15 || (pi === 1 && (x === 7 || x === 8) && y > 3)) t.set(x, y, mul(tt.col, 0.62)); else if (y < 3) t.set(x, y, mul(tt.col, 1.18)); }); }));
  });
  XWEAPON_TIERS.forEach(([key, , , , , , H]) => {
    xt(key + '_dagger', t => {
      for (let k = 0; k < 6; k++) { t.set(8 + k, 7 - k, mul(H, 1.15)); t.set(8 + k, 8 - k, H); t.set(9 + k, 8 - k, mul(H, 0.78)); }
      for (const [x, y] of [[5, 6], [6, 7], [7, 8], [8, 9], [9, 10]]) t.set(x, y, [74, 56, 38]);
      for (const [x, y] of [[6, 9], [5, 10], [4, 11], [3, 12]]) t.set(x, y, STICKC); t.set(2, 13, mul(H, 0.9)); outline(t, 0.45);
    });
    xt(key + '_hammer', t => {
      for (let k = 0; k < 9; k++) t.set(2 + k, 13 - k, STICKC);
      shape(t, (x, y) => { const dx = x + 0.5 - 10.5, dy = y + 0.5 - 4.5, a = (dx + dy) / Math.SQRT2, b = (dx - dy) / Math.SQRT2; return Math.abs(a) <= 4.4 && Math.abs(b) <= 2 ? mul(H, b < -0.9 ? 1.2 : b > 0.9 ? 0.78 : 1) : 0; }, H, 0.08);
      outline(t, 0.45);
    });
  });
  // gems
  XGEMS.forEach(([key, , , c]) => { xt('rough_' + key, roughGem(c)); xt(key, gem(c)); xt(key + '_charm', charm(c)); });
  // dishes
  xt('baked_apple', roast('apple')); xt('honey_apple', t => { t.copy('apple'); for (const [x, y] of [[5, 6], [6, 7], [9, 6], [10, 8], [7, 10], [8, 11]]) t.set(x, y, [250, 190, 50]); });
  xt('caramel_apple', t => { t.copy('apple'); t.each((x, y) => { const p = t.get(x, y); if (p[3] && y > 8) t.set(x, y, mix(p, [200, 130, 50], 0.7), p[3]); }); for (let y = 0; y < 5; y++) t.set(8, y, [170, 130, 80]); });
  xt('apple_pie', pie([210, 160, 90], [200, 60, 50])); xt('berry_pie', pie([210, 160, 90], [140, 30, 70])); xt('mushroom_pie', pie([200, 150, 90], [150, 110, 80])); xt('meat_pie', pie([190, 140, 80], [130, 70, 40]));
  xt('berry_jam', jar([170, 30, 60])); xt('pickled_beets', jar([140, 20, 60], [120, 120, 120]));
  xt('jam_toast', t => { shape(t, (x, y) => x > 2 && x < 13 && y > 3 && y < 13 ? (x === 3 || x === 12 || y === 4 || y === 12 ? [170, 110, 50] : (y < 9 ? [180, 30, 60] : [236, 196, 130])) : 0, null, 0.1); outline(t, 0.45); });
  xt('honey_bread', t => { blob(t, 8, 9, 6.5, 3.5, [200, 150, 80], 0.15); for (let x = 3; x < 13; x++) t.set(x, 7 + (x % 3 === 0 ? 1 : 0), [250, 190, 50]); outline(t, 0.45); });
  xt('fried_egg', t => { blob(t, 8, 8.5, 6, 5, [250, 250, 244], 0.05); blob(t, 8.5, 8, 2.4, 2.2, [250, 190, 40], 0.08); outline(t, 0.4); });
  xt('omelette', t => { shape(t, (x, y) => ((x + 0.5 - 8) / 6.5) ** 2 + ((y + 0.5 - 9) / 3.6) ** 2 <= 1 && y >= 7 ? [246, 206, 80] : 0, null, 0.12); for (let x = 3; x < 13; x++) t.set(x, 7, [226, 176, 60]); t.set(6, 9, [150, 110, 80]); t.set(10, 10, [150, 110, 80]); outline(t, 0.45); });
  xt('potato_pancake', t => { blob(t, 8, 9, 6.4, 3.6, [220, 170, 80], 0.2); for (let i = 0; i < 6; i++) t.set(4 + Math.floor(t.r() * 8), 7 + Math.floor(t.r() * 4), [170, 110, 40]); outline(t, 0.45); });
  xt('potato_chips', t => { shape(t, (x, y) => x > 3 && x < 12 && y > 2 && y < 14 ? (y < 5 ? [200, 40, 40] : [230, 60, 50]) : 0, null, 0.08); blob(t, 8, 9, 2.4, 2, [250, 210, 90], 0.1); outline(t, 0.45); });
  xt('mashed_potato', bowlT([240, 226, 180], [250, 220, 90])); xt('carrot_soup', bowlT([236, 130, 40], [250, 180, 80])); xt('pumpkin_soup', bowlT([230, 150, 40], [200, 110, 20]));
  xt('fish_chowder', bowlT([236, 230, 210], [230, 140, 110])); xt('grain_porridge', bowlT([220, 200, 150], [180, 150, 90])); xt('garden_salad', bowlT([90, 170, 60], [200, 40, 60]));
  xt('fruit_salad', bowlT([220, 60, 60], [250, 220, 90])); xt('ember_stew', bowlT([200, 70, 30], [255, 180, 60]));
  xt('mushroom_skewer', skewer([[150, 110, 80], [210, 40, 40], [150, 110, 80]])); xt('meat_skewer', skewer([[180, 104, 62], [236, 130, 40], [180, 104, 62]]));
  xt('lamb_skewer', skewer([[160, 90, 60], [220, 180, 100], [160, 90, 60]])); xt('chicken_skewer', skewer([[220, 170, 110], [170, 30, 50], [220, 170, 110]])); xt('rabbit_skewer', skewer([[180, 110, 60], [236, 130, 40], [180, 110, 60]]));
  xt('steak_sandwich', sandwich([120, 66, 38])); xt('salmon_sandwich', sandwich([240, 130, 100])); xt('egg_sandwich', sandwich([250, 220, 90]));
  xt('packed_lunch', t => { for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) t.set(x, y, y < 6 ? [170, 40, 40] : x === 7 ? [120, 80, 40] : mul([200, 140, 80], 0.92 + t.r() * 0.12)); for (const [x, y] of [[4, 8], [10, 9], [5, 10], [11, 7]]) t.set(x, y, [240, 230, 210]); outline(t, 0.45); });
  xt('melon_juice', bottleT([230, 70, 80])); xt('apple_juice', bottleT([240, 200, 80])); xt('berry_juice', bottleT([150, 30, 70])); xt('carrot_juice', bottleT([240, 140, 40]));
  xt('roasted_carrot', roast('carrot')); xt('roasted_beetroot', roast('beetroot')); xt('roasted_pumpkin', t => { shape(t, (x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 4); return y >= 5 && d <= 7 ? (d > 5.6 ? [150, 80, 20] : [230, 140, 40]) : 0; }, null, 0.12); outline(t, 0.45); });
  xt('roasted_mushroom', t => { for (let y = 9; y < 14; y++) t.set(8, y, [170, 130, 80]); blob(t, 8, 7, 4.4, 2.8, [120, 76, 44], 0.15); outline(t, 0.45); });
  xt('roasted_seeds', t => { for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [8, 12], [10, 12], [6, 7]]) { t.set(x, y, [200, 160, 90]); t.set(x + 1, y, [150, 110, 60]); } outline(t, 0.5); });
  xt('jerky', t => { for (const [x0, y0] of [[3, 4], [6, 6], [9, 3]]) for (let k = 0; k < 8; k++) { t.set(x0 + (k > 4 ? 1 : 0), y0 + k, [140, 70, 40]); t.set(x0 + 1 + (k > 4 ? 1 : 0), y0 + k, [110, 50, 30]); } outline(t, 0.45); });
  xt('kelp_crisps', t => { for (const [cx, cy] of [[6, 6], [10, 8], [7, 11]]) blob(t, cx, cy, 2.8, 2, [70, 90, 46], 0.2); outline(t, 0.45); });
  xt('candy', t => { blob(t, 8, 8, 3, 2.6, [230, 60, 120], 0.1); t.set(7, 7, [255, 180, 210]); for (let k = -1; k <= 1; k++) { t.set(4, 8 + k, [250, 200, 220]); t.set(3, 8 + 2 * k, [250, 200, 220]); t.set(11, 8 + k, [250, 200, 220]); t.set(12, 8 + 2 * k, [250, 200, 220]); } outline(t, 0.45); });
  xt('star_candy', t => { for (const [cx, cy, c] of [[6, 6, [250, 230, 120]], [10, 8, [200, 160, 240]], [7, 11, [250, 170, 200]]]) shape(t, (x, y) => Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy) < 2.4 || (Math.abs(x + 0.5 - cx) < 0.6 && Math.abs(y + 0.5 - cy) < 3) || (Math.abs(y + 0.5 - cy) < 0.6 && Math.abs(x + 0.5 - cx) < 3) ? c : 0, c, 0.05); outline(t, 0.45); });
  xt('pancakes', t => { for (let k = 0; k < 3; k++) blob(t, 8, 11 - k * 2.2, 6, 1.6, [226, 170, 90], 0.1); for (let x = 5; x < 11; x++) t.set(x, 6, [250, 190, 50]); outline(t, 0.45); });
  xt('trail_bread', t => { blob(t, 8, 9, 6, 3.6, [170, 120, 70], 0.18); for (const [x, y] of [[5, 8], [8, 9], [11, 8], [7, 11]]) t.set(x, y, [150, 30, 50]); outline(t, 0.45); });
  xt('honey_cookie', t => { blob(t, 8, 8.5, 5.4, 5, [220, 170, 80], 0.15); for (const [x, y] of [[6, 6], [10, 7], [7, 10], [10, 11]]) t.set(x, y, [250, 200, 60]); outline(t, 0.45); });
  xt('glow_tart', pie([210, 160, 90], [250, 170, 40]));
  // teas and tonics
  const teaCol = { dandelion_tea: [230, 200, 60], poppy_tea: [200, 50, 50], cornflower_tea: [70, 100, 220], allium_tea: [180, 90, 210], orchid_tea: [60, 180, 230], lily_tea: [236, 236, 220],
    honey_tea: [240, 180, 60], ember_tea: [240, 100, 30], mushroom_brew: [150, 110, 80], climber_tonic: [120, 220, 90], feather_tonic: [236, 236, 246], warrior_tonic: [200, 40, 30],
    shadow_tonic: [60, 50, 80], miner_tonic: [90, 220, 210], antidote: [150, 230, 140], leaf_tea: [100, 160, 60], pine_tea: [60, 110, 70], blossom_tea: [240, 170, 200], cactus_juice: [100, 170, 70] };
  for (const [k, c] of Object.entries(teaCol)) xt(k, bottleT(c, k.endsWith('tonic') ? [80, 80, 90] : [140, 100, 60]));
  // gadgets
  xt('return_scroll', t => { for (let x = 3; x < 13; x++) for (let y = 4; y < 12; y++) t.set(x, y, (y === 6 || y === 8 || y === 10) && x > 4 && x < 11 ? [150, 110, 220] : [236, 224, 186]); for (let y = 3; y < 13; y++) { t.set(2, y, [140, 96, 50]); t.set(13, y, [140, 96, 50]); } outline(t, 0.45); });
  xt('memory_crystal', t => { shape(t, (x, y) => Math.abs(x + 0.5 - 8) * 1.4 + Math.abs(y + 0.5 - 8) < 7 ? mul([150, 100, 230], x < 8 ? 1.2 : 0.85) : 0, null, 0.08); t.set(7, 6, [240, 230, 255]); outline(t, 0.4); });
  xt('pocket_workbench', t => { t.copy('table_top'); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [0, 0, 0], 0); else if (y === 7 || y === 8) t.set(x, y, [120, 76, 40]); }); });
  xt('depth_gauge', t => { blob(t, 8, 8, 6, 6, [200, 120, 70], 0.08); blob(t, 8, 8, 4.4, 4.4, [230, 226, 210], 0.04); for (let y = 4; y < 9; y++) t.set(8, y, [200, 30, 30]); for (const y of [5, 8, 11]) t.set(5, y, [60, 60, 60]); outline(t, 0.45); });
  xt('field_guide', book([60, 130, 60], [230, 200, 60])); xt('tome_knowledge', book([90, 50, 150], [120, 220, 240])); xt('adventure_journal', book([140, 90, 50], [230, 220, 190]));
  xt('ore_dowser', t => { for (let y = 8; y < 15; y++) t.set(8, y, [200, 120, 70]); for (let k = 0; k < 5; k++) { t.set(7 - k, 7 - k, [200, 120, 70]); t.set(9 + k, 7 - k, [200, 120, 70]); } t.set(2, 2, [190, 130, 240]); t.set(13, 2, [190, 130, 240]); t.set(3, 2, [220, 180, 250]); t.set(12, 2, [220, 180, 250]); outline(t, 0.45); });
  xt('bandage', t => { blob(t, 8, 9, 5, 4, [244, 240, 228], 0.06); blob(t, 8, 9, 1.8, 1.6, [210, 190, 160], 0.05); for (let x = 11; x < 15; x++) t.set(x, 12, [244, 240, 228]); outline(t, 0.4); });
  xt('first_aid_kit', t => { for (let y = 4; y < 14; y++) for (let x = 2; x < 14; x++) t.set(x, y, [240, 240, 236]); for (let k = 5; k < 13; k++) { t.set(7, k, [210, 30, 30]); t.set(8, k, [210, 30, 30]); t.set(k - 1, 8, [210, 30, 30]); t.set(k - 1, 9, [210, 30, 30]); } for (let x = 6; x < 10; x++) t.set(x, 3, [120, 120, 120]); outline(t, 0.4); });
  xt('signal_flare', t => { for (let y = 4; y < 14; y++) for (let x = 6; x < 10; x++) t.set(x, y, y < 6 ? [60, 60, 60] : x === 6 ? [240, 90, 80] : [210, 40, 40]); t.set(8, 2, [255, 220, 90]); t.set(7, 3, [255, 160, 60]); outline(t, 0.45); });
  xt('blast_charge', t => { blob(t, 8, 10, 5, 4, [150, 100, 60], 0.15); for (let x = 3; x < 13; x++) t.set(x, 9, [200, 40, 30]); for (let k = 0; k < 4; k++) t.set(9 + (k % 2), 5 - k, [220, 220, 210]); t.set(11, 1, [255, 200, 60]); outline(t, 0.45); });
  xt('magnet', t => { t.each((x, y) => { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 7); if (d > 2.4 && d < 5.4 && y >= 6) t.set(x, y, y > 10 ? [200, 200, 206] : [210, 40, 40]); if (d > 2.4 && d < 5.4 && y < 7 && y > 2 && (x < 5 || x > 10)) t.set(x, y, y < 4 ? [200, 200, 206] : [210, 40, 40]); }); outline(t, 0.45); });
  xt('balloon', t => { blob(t, 8, 6, 4.6, 5, [220, 40, 50], 0.08); t.set(6, 4, [255, 160, 160]); for (let y = 11; y < 16; y++) t.set(8 + (y % 2), y, [230, 230, 230]); outline(t, 0.45); });
  xt('grappling_hook', t => { for (let k = 0; k < 7; k++) t.set(2 + k, 13 - k, [200, 170, 120]); t.each((x, y) => { const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 5); if (d > 1.6 && d < 3.2 && !(x < 11 && y > 5)) t.set(x, y, [170, 170, 176]); }); t.set(9, 7, [170, 170, 176]); outline(t, 0.45); });
  xt('super_fertilizer', t => { for (let y = 4; y < 14; y++) for (let x = 4 - (y > 6 ? 1 : 0); x < 12 + (y > 6 ? 1 : 0); x++) t.set(x, y, y < 6 ? [180, 150, 100] : mul([220, 200, 150], 0.94 + t.r() * 0.1)); for (const [x, y] of [[7, 8], [8, 9], [9, 8], [8, 10]]) t.set(x, y, [70, 170, 60]); outline(t, 0.45); });
  xt('lucky_coin', t => { blob(t, 8, 8, 5.4, 5.4, [240, 196, 50], 0.06); blob(t, 8, 8, 3.6, 3.6, [250, 220, 90], 0.04); for (const [x, y] of [[8, 5], [7, 7], [9, 7], [8, 9], [8, 10]]) t.set(x, y, [190, 140, 30]); outline(t, 0.4); });
  xt('fortress_key', t => { t.each((x, y) => { const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5); if (d > 1.2 && d < 3.2) t.set(x, y, [230, 180, 50]); }); for (let k = 0; k < 8; k++) t.set(6 + k, 6 + k, [230, 180, 50]); t.set(11, 13, [230, 180, 50]); t.set(13, 11, [230, 180, 50]); t.set(10, 12, [230, 180, 50]); outline(t, 0.45); });
  xt('fortress_compass', t => { blob(t, 8, 8, 6, 6, [90, 30, 34], 0.1); blob(t, 8, 8, 4.6, 4.6, [228, 214, 200], 0.05); for (let k = 0; k < 3; k++) { t.set(8 + k, 7 - k, [240, 120, 30]); t.set(7 - k, 8 + k, [70, 70, 80]); } outline(t, 0.45); });
  xt('hourglass', t => { for (let x = 3; x < 13; x++) { t.set(x, 2, [140, 96, 50]); t.set(x, 13, [140, 96, 50]); } for (let y = 3; y < 13; y++) { const w = Math.abs(y - 7.5) * 0.7 + 0.6; for (let x = Math.floor(8 - w); x < Math.ceil(8 + w); x++) t.set(x, y, (y > 8 && y < 13) || y === 7 ? [230, 200, 120] : [200, 226, 240]); } outline(t, 0.45); });
  // instruments
  xt('bamboo_flute', t => { for (let k = 0; k < 12; k++) { t.set(2 + k, 13 - k, [150, 190, 80]); t.set(3 + k, 13 - k, [110, 150, 60]); } for (const k of [4, 6, 8]) t.set(2 + k, 13 - k, [60, 60, 40]); outline(t, 0.45); });
  xt('hand_drum', t => { for (let y = 5; y < 13; y++) for (let x = 3; x < 13; x++) t.set(x, y, y < 7 ? [236, 220, 190] : (x + y) % 4 === 0 ? [200, 180, 140] : [170, 50, 40]); outline(t, 0.45); });
  xt('bone_horn', t => { t.each((x, y) => { const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4); if (d > 5 && d < 5 + (x + y) * 0.17 && x > 2 && y > 2) t.set(x, y, [226, 220, 196]); }); outline(t, 0.45); });
  xt('lyre', t => { t.each((x, y) => { if ((x === 4 || x === 11) && y > 2 && y < 12) t.set(x, y, [170, 120, 60]); if (y === 12 && x > 3 && x < 12) t.set(x, y, [170, 120, 60]); if (y === 4 && x > 4 && x < 11) t.set(x, y, [140, 96, 50]); if ((x === 6 || x === 8 || x === 9) && y > 4 && y < 12) t.set(x, y, [236, 236, 220]); }); outline(t, 0.45); });
  xt('wind_chime', t => { for (let x = 4; x < 12; x++) t.set(x, 2, [140, 96, 50]); for (const [x, h] of [[5, 7], [7, 9], [9, 8], [11, 6]]) for (let y = 3; y < 3 + h; y++) t.set(x, y, y < 5 ? [220, 220, 220] : [190, 196, 206]); outline(t, 0.45); });
  xt('ocarina', t => { blob(t, 8, 9, 5.6, 3.8, [180, 110, 70], 0.15); for (let y = 3; y < 7; y++) t.set(11, y, [180, 110, 70]); for (const [x, y] of [[5, 9], [7, 8], [9, 9], [8, 11]]) t.set(x, y, [70, 40, 30]); outline(t, 0.45); });
  // fortress materials and the Emberbloom
  xt('ember_coal', t => { t.copy('coal'); for (let i = 0; i < 9; i++) { const x = 4 + Math.floor(t.r() * 8), y = 4 + Math.floor(t.r() * 8); if (t.get(x, y)[3]) t.set(x, y, t.r() < 0.5 ? [250, 150, 40] : [230, 70, 20]); } });
  xt('ember_dust', t => { for (let i = 0; i < 28; i++) t.set(3 + Math.floor(t.r() * 10), 5 + Math.floor(t.r() * 9), t.r() < 0.5 ? [250, 140, 40] : [210, 60, 20]); outline(t, 0.5); });
  xt('ember_heart', t => { mask(t, ['................', '................', '...###....###...', '..#OOO#..#OOO#..', '.#OYYOO##OOOOO#.', '.#OYOOOOOOOOOO#.', '.#OOOOOOOOOOOO#.', '..#OOOOOOOOOO#..', '...#OOOOOOOO#...', '....#OOOOOO#....', '.....#OOOO#.....', '......#OO#......', '.......##.......', '................', '................', '................'], { '#': [120, 30, 10], O: [236, 100, 30], Y: [255, 220, 120] }); });
  xt('emberbloom', t => { for (let y = 8; y < 16; y++) t.set(7 + (y % 3 === 0 ? 1 : 0), y, [70, 40, 30]); t.set(5, 12, [90, 50, 40]); t.set(10, 11, [90, 50, 40]); blob(t, 7.5, 5.5, 3.4, 3, [240, 90, 30], 0.15); blob(t, 7.5, 5.5, 1.6, 1.4, [255, 210, 80], 0.1); for (const [x, y] of [[3, 4], [12, 5], [7, 1]]) t.set(x, y, [255, 150, 50]); });
}
