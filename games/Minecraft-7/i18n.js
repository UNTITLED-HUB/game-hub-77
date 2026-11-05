// ─────────────────────────── language ───────────────────────────
// Korean is the source language; tr() looks the Korean text up in the active dictionary.
const LANGS = [['ko', '한국어', '대한민국'], ['en', 'English', 'United States']];
let LANG = 'ko';
const curLang = () => LANG;
const EN = {};
function tr(s, ...a) {
  s = String(s ?? '');
  const out = LANG === 'en' && Object.hasOwn(EN, s) ? EN[s] : s;
  return a.length ? out.replace(/\{(\d)\}/g, (_, i) => a[i] ?? '') : out;
}
const COLOR_EN = ['White', 'Orange', 'Magenta', 'Light Blue', 'Yellow', 'Lime', 'Pink', 'Gray', 'Light Gray', 'Cyan', 'Purple', 'Blue', 'Brown', 'Green', 'Red', 'Black'];
const EN_NAMES = (() => {
  const n = {};
  const blocks = ['', 'Grass Block', 'Dirt', 'Stone', 'Cobblestone', 'Bedrock', 'Sand', 'Gravel', 'Oak Log', 'Oak Planks', 'Oak Leaves', 'Glass', 'Coal Ore', 'Iron Ore', 'Gold Ore', 'Diamond Ore', 'Crafting Table', 'Furnace', 'Chest', 'Sandstone', 'Stone Bricks', 'Bricks', 'Clay', 'Snowy Grass Block', 'Snow Block', 'Ice', 'Cactus', 'White Wool', 'Torch', 'Short Grass', 'Poppy', 'Dandelion', 'Oak Sapling', 'Dead Bush', 'Spruce Log', 'Spruce Leaves', 'Birch Log', 'Birch Leaves', 'Glowstone', 'TNT', 'Water'];
  blocks.forEach((v, i) => { if (v) n[i] = v; });
  for (let i = 41; i <= 47; i++) n[i] = 'Flowing Water';
  ['Red', 'Orange', 'Yellow', 'Lime', 'Light Blue', 'Blue', 'Purple', 'Black'].forEach((c, i) => n[48 + i] = c + ' Wool');
  Object.assign(n, { 56: 'Mossy Cobblestone', 57: 'Obsidian', 58: 'Bookshelf', 59: 'Pumpkin', 60: 'Melon', 61: 'Bed', 62: 'Cherry Planks', 63: 'Deepslate', 64: 'Copper Ore', 65: 'Block of Amethyst', 66: 'Nether Bricks', 67: 'End Stone', 68: 'Terracotta', 69: 'Granite', 70: 'Diorite', 71: 'Andesite', 72: 'Block of Copper', 73: 'Oxidized Copper', 74: 'Dark Oak Planks', 75: 'Birch Planks', 76: 'Emerald Ore', 77: 'Lapis Lazuli Ore',
    78: 'Cherry Log', 79: 'Dark Oak Log', 80: 'Mangrove Log', 81: 'Block of Bamboo', 82: 'Barrel', 83: 'Basalt', 84: 'Quartz Pillar', 85: 'Cherry Leaves', 86: 'Mangrove Planks', 87: 'Bamboo Planks', 88: 'Prismarine', 89: 'Dark Prismarine', 90: 'Sea Lantern', 91: 'Netherrack', 92: 'Soul Sand', 93: 'Blackstone', 94: 'Tuff', 95: 'Calcite', 96: 'Dripstone Block', 97: 'Moss Block', 98: 'Mud', 99: 'Packed Ice', 100: 'Red Sand' });
  COLOR_EN.forEach((c, i) => { n[101 + i] = c + ' Concrete'; n[117 + i] = c + ' Concrete Powder'; n[133 + i] = c + ' Terracotta'; n[149 + i] = c + ' Glazed Terracotta'; });
  ['Polished Granite', 'Polished Diorite', 'Polished Andesite', 'Polished Deepslate', 'Deepslate Bricks', 'Cracked Stone Bricks', 'Mossy Stone Bricks', 'Cut Sandstone', 'Red Sandstone', 'Smooth Sandstone', 'Quartz Bricks', 'Chiseled Quartz Block', 'Polished Blackstone', 'Polished Blackstone Bricks', 'End Stone Bricks', 'Crimson Planks'].forEach((v, i) => n[165 + i] = v);
  Object.assign(n, { 181: 'Bed (Head)', 182: 'Deepslate Coal Ore', 183: 'Deepslate Iron Ore', 184: 'Deepslate Gold Ore', 185: 'Deepslate Diamond Ore', 186: 'Magma Block', 187: 'Nether Quartz Ore', 188: 'Nether Portal', 189: 'End Portal', 190: 'End Portal Frame', 191: 'Lava', 192: 'Flowing Lava', 193: 'Flowing Lava', 194: 'Flowing Lava', 195: 'Flowing Lava', 196: 'Ancient Debris', 197: 'Block of Netherite', 198: 'Crying Obsidian', 199: 'Soul Soil' });
  Object.assign(n, { 256: 'Stick', 257: 'Coal', 258: 'Iron Ingot', 259: 'Gold Ingot', 260: 'Diamond' });
  ['Wooden', 'Stone', 'Iron', 'Golden', 'Diamond'].forEach((t, i) => { n[261 + i] = t + ' Pickaxe'; n[266 + i] = t + ' Axe'; n[271 + i] = t + ' Shovel'; n[276 + i] = t + ' Sword'; });
  Object.assign(n, { 281: 'Apple', 282: 'Raw Porkchop', 283: 'Cooked Porkchop', 284: 'Raw Beef', 285: 'Steak', 286: 'Raw Mutton', 287: 'Cooked Mutton', 288: 'Rotten Flesh', 289: 'String', 290: 'Bucket', 291: 'Water Bucket', 292: 'Flint', 293: 'Flint and Steel', 294: 'Melon Slice', 295: 'Bread', 296: 'Leather', 297: 'Shears', 298: 'Bow', 299: 'Arrow', 300: 'Compass', 301: 'Clock', 302: 'Emerald', 303: 'Lapis Lazuli', 304: 'Copper Ingot', 305: 'Amethyst Shard' });
  [['Leather', 'Cap', 'Tunic', 'Pants', 'Boots'], ['Golden', 'Helmet', 'Chestplate', 'Leggings', 'Boots'], ['Iron', 'Helmet', 'Chestplate', 'Leggings', 'Boots'], ['Diamond', 'Helmet', 'Chestplate', 'Leggings', 'Boots']].forEach(([m, ...p], mi) => p.forEach((q, pi) => n[310 + mi * 4 + pi] = m + ' ' + q));
  Object.assign(n, { 326: 'Golden Apple', 327: 'Carrot', 328: 'Potato', 329: 'Baked Potato', 330: 'Beetroot', 331: 'Nether Quartz', 332: 'Redstone Dust', 333: 'Prismarine Shard' });
  ['Wheat', 'Egg', 'Feather', 'Bone', 'Bone Meal', 'Gunpowder', 'Slimeball', 'Ender Pearl', 'Blaze Rod', 'Blaze Powder', 'Ghast Tear', 'Spider Eye', 'Sugar', 'Paper', 'Book', 'Clay Ball', 'Raw Salmon', 'Cooked Salmon', 'Raw Cod', 'Cooked Cod', 'Tropical Fish', 'Pufferfish', 'Raw Chicken', 'Cooked Chicken', 'Cookie', 'Pumpkin Pie', 'Mushroom Stew', 'Honey Bottle', 'Milk Bucket', 'Snowball', 'Brick', 'Nether Brick'].forEach((v, i) => n[334 + i] = v);
  Object.assign(n, { 366: 'Lava Bucket', 367: 'Eye of Ender', 386: 'Netherite Scrap', 387: 'Netherite Ingot', 388: 'Netherite Pickaxe', 389: 'Netherite Axe', 390: 'Netherite Shovel', 391: 'Netherite Sword', 392: 'Netherite Helmet', 393: 'Netherite Chestplate', 394: 'Netherite Leggings', 395: 'Netherite Boots', 396: 'Chainmail Helmet', 397: 'Chainmail Chestplate', 398: 'Chainmail Leggings', 399: 'Chainmail Boots',
    408: 'Shield', 409: 'Elytra', 410: 'Totem of Undying', 411: 'Potion of Healing', 412: 'Potion of Swiftness', 413: 'Potion of Fire Resistance', 414: 'Glass Bottle' });
  return n;
})();
const MOB_EN = { pig: 'Pig', cow: 'Cow', sheep: 'Sheep', zombie: 'Zombie', spider: 'Spider', villager: 'Villager', iron_golem: 'Iron Golem', skeleton: 'Skeleton', creeper: 'Creeper', enderman: 'Enderman', blaze: 'Blaze', piglin: 'Piglin', zombified_piglin: 'Zombified Piglin', wither_skeleton: 'Wither Skeleton', husk: 'Husk', stray: 'Stray', witch: 'Witch', wolf: 'Wolf', cat: 'Cat', chicken: 'Chicken', horse: 'Horse', slime: 'Slime', magma_cube: 'Magma Cube', ghast: 'Ghast', hoglin: 'Hoglin', zoglin: 'Zoglin', strider: 'Strider', piglin_brute: 'Piglin Brute', ender_dragon: 'Ender Dragon', silverfish: 'Silverfish', endermite: 'Endermite' };
// swaps block / item / mob display names; Korean names stay reachable as nameKo for search and commands
function applyLanguage() {
  LANG = (typeof SAVE !== 'undefined' && SAVE && SAVE.settings && SAVE.settings.lang) || LANG;
  const en = LANG === 'en';
  for (const b of BLOCK) if (b) { b.nameKo ??= b.name; b.en ??= EN_NAMES[b.id]; b.name = en && b.en ? b.en : b.nameKo; }
  for (const it of Object.values(ITEM)) {
    it.nameKo ??= it.name;
    if (!it.en) { if (EN_NAMES[it.id]) it.en = EN_NAMES[it.id]; else if (it.spawnMob && MOB_EN[it.spawnMob]) it.en = MOB_EN[it.spawnMob] + ' Spawn Egg'; }
    it.name = en && it.en ? it.en : it.nameKo;
  }
  if (typeof MOBDEF !== 'undefined') for (const [k, m] of Object.entries(MOBDEF)) { m.nameKo ??= m.name; m.name = en && MOB_EN[k] ? MOB_EN[k] : m.nameKo; }
}
function HELP_TEXT(kn) {
  if (LANG === 'en') return [
    ['PC', `${kn('forward')}/${kn('left')}/${kn('back')}/${kn('right')} move · mouse to look · hold left click to mine/attack · right click to place/use/eat · middle click picks a block`, `${kn('jump')} jump (double-tap in Creative to fly) · ${kn('sneak')} sneak · ${kn('sprint')} or double-tap ${kn('forward')} to sprint · 1–9 / wheel to select`, `${kn('inventory')} inventory · ${kn('drop')} drop (Ctrl: stack) · ${kn('chat')} chat · ${kn('command')} command · ${kn('hideHud')} hide HUD · ${kn('debug')} debug · Esc menu`],
    ['Mobile', 'Left joystick (or D-pad) to move · drag to look · tap to place/use · hold to mine/attack · jump and sneak buttons on the right · ⋯ next to the hotbar opens the inventory', "Turn off 'Simple touch buttons' in Settings → Touch Controls to show the mine/use/sprint/drop buttons. Buttons can be moved and resized in the layout editor."],
    ['Elytra', 'Wear the elytra in the chest slot. Jump, then press jump again while in the air to start gliding. Look down to gain speed, look up to climb. Use a firework rocket while gliding to boost. Repair with a phantom membrane.'],
    ['Farming', 'Use a hoe on grass or dirt to make farmland, then plant wheat seeds (from grass), carrots or potatoes. Wheat ripens after a few minutes in light; bone meal grows it instantly.'],
    ['Structures', 'Villages with farms, workshops and a bell · ruined portals · desert pyramids · igloos · dungeons with monster spawners · a stronghold · end cities with an end ship that holds an elytra. Use /locate village, ruined_portal, desert_pyramid, igloo, stronghold, end_city.'],
    ['Inventory', 'Click: pick up/place · right click: half/one · Shift+click: quick move · green book: recipe book (red = missing ingredients)'],
    ['Combat', 'Each weapon has an attack speed; wait for the gauge under the crosshair for full damage. Falling hits are critical (×1.5). The mace deals extra damage the further you fall.'],
    ['Commands', '/gamemode survival|creative · /time set day|night · /give item [count] · /tp x y z · /locate structure · /help'],
  ];
  return [
    ['PC', `${kn('forward')}/${kn('left')}/${kn('back')}/${kn('right')} 이동 · 마우스 시점 · 좌클릭(꾹) 캐기·공격 · 우클릭 설치·사용·먹기 · 가운데 클릭 블록 집기`, `${kn('jump')} 점프(크리에이티브에서 두 번: 비행) · ${kn('sneak')} 웅크리기 · ${kn('sprint')} 또는 ${kn('forward')} 두 번 달리기 · 1–9/휠 아이템 선택`, `${kn('inventory')} 인벤토리 · ${kn('drop')} 버리기(Ctrl: 묶음) · ${kn('chat')} 채팅 · ${kn('command')} 명령어 · ${kn('hideHud')} HUD 숨기기 · ${kn('debug')} 디버그 · Esc 메뉴`],
    ['모바일', '왼쪽 조이스틱(또는 방향 패드)으로 이동 · 화면 드래그로 시점 · 짧게 탭 설치·사용 · 꾹 누르기 캐기·공격 · 오른쪽 점프·웅크리기 버튼 · 핫바 옆 ⋯ 인벤토리', "설정 → 터치 컨트롤에서 '간단한 터치 버튼'을 끄면 캐기·사용·달리기·버리기 버튼이 보여요. 버튼 위치·크기는 '버튼 배치 편집'에서 바꿀 수 있어요."],
    ['겉날개', '흉갑 칸에 겉날개를 입고, 점프한 뒤 공중에서 점프를 한 번 더 누르면 활공해요. 아래를 보면 빨라지고 위를 보면 올라가요. 활공 중 폭죽 로켓을 쓰면 가속해요. 팬텀 막과 함께 조합하면 수리돼요.'],
    ['농사', '괭이로 잔디나 흙을 갈아 경작지를 만들고 밀 씨앗(풀에서 얻음)·당근·감자를 심어요. 밀은 밝은 곳에서 몇 분 지나면 자라고, 뼛가루를 쓰면 바로 자라요.'],
    ['구조물', '농장·작업장·종이 있는 마을 · 무너진 차원문 · 사막 피라미드 · 이글루 · 몬스터 생성기가 있는 던전 · 요새 · 겉날개가 있는 엔드 함선과 엔드 시티. /locate village, ruined_portal, desert_pyramid, igloo, stronghold, end_city 로 찾을 수 있어요.'],
    ['인벤토리', '클릭: 집기/놓기 · 우클릭: 절반 집기/1개 놓기 · Shift+클릭: 빠른 이동 · 초록 책: 레시피 책(빨간 칸은 재료 부족). 터치: 길게 누르면 절반, 두 번 탭하면 빠른 이동, 끌어서 옮기기'],
    ['전투', '무기마다 공격 속도가 있어 조준점 아래 게이지가 다 차야 최대 피해가 나요. 떨어지면서 때리면 치명타(×1.5). 철퇴는 높이 떨어질수록 강하게 내려찍어요.'],
    ['명령어', '/gamemode survival|creative · /time set day|night · /give 아이템 [개수] · /tp x y z · /locate 구조물 · /help'],
  ];
}
Object.assign(EN, {
  // titles & menus
  '싱글플레이': 'Singleplayer', '새로운 월드 만들기': 'Create New World', '조작법': 'How to Play', '설정...': 'Options...', '설정': 'Options', '전체화면': 'Fullscreen', '언어...': 'Language...', '언어': 'Language', '접근성 설정...': 'Accessibility Settings...', '접근성 설정': 'Accessibility Settings',
  '자체 제작 텍스처 · 원작 리소스 미사용': 'Original textures · no official assets', '월드 선택': 'Select World', '검색...': 'Search...', '선택한 월드 플레이': 'Play Selected World', '삭제': 'Delete', '뒤로': 'Back', '취소': 'Cancel', '완료': 'Done', '저장': 'Save',
  '아직 월드가 없어요.': 'No worlds yet.', '새로운 월드를 만들어 보세요!': 'Create a new world!', '이 환경에서는 저장소를 쓸 수 없어 월드가 저장되지 않아요.': 'Storage is unavailable here, so worlds will not be saved.',
  '크리에이티브 모드': 'Creative Mode', '서바이벌 모드': 'Survival Mode', '크리에이티브': 'Creative', '서바이벌': 'Survival', '치트': 'Cheats',
  '이 월드를 삭제할까요?': 'Delete this world?', "'{0}' 월드가 영원히 사라져요. 되돌릴 수 없어요!": "'{0}' will be lost forever! (A long time!)",
  '게임': 'Game', '월드': 'World', '월드 이름': 'World Name', '새로운 세계': 'New World', '게임 모드: {0}': 'Game Mode: {0}', '난이도: {0}': 'Difficulty: {0}', '치트 허용: {0}': 'Allow Cheats: {0}', '보너스 상자: {0}': 'Bonus Chest: {0}', '구조물 생성: {0}': 'Generate Structures: {0}',
  '/gamemode, /give 같은 명령어를 쓸 수 있어요.': 'Commands like /gamemode and /give can be used.', '월드 생성기 시드': 'Seed for the World Generator', '비워 두면 무작위 시드': 'Leave blank for a random seed', '같은 시드를 쓰면 같은 지형이 만들어져요.': 'The same seed creates the same terrain.',
  '마을, 무너진 차원문, 사막 피라미드, 이글루, 던전, 엔드 시티를 만들어요.': 'Villages, ruined portals, desert pyramids, igloos, dungeons and end cities.', '서바이벌을 시작할 때 원목, 사과, 나무 도구를 받아요.': 'Start Survival with logs, apples and wooden tools.',
  '자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.': 'Search for resources, craft, gain levels, health and hunger.', '모든 블록을 무한히 쓰고, 날아다니며, 다치지 않아요. 몬스터도 공격하지 않아요.': 'Unlimited resources, free flying and destroy blocks instantly.',
  '몬스터가 나타나지 않고, 체력과 배고픔이 저절로 회복돼요.': 'No hostile mobs; health and hunger regenerate.', '몬스터가 적게 나타나고 피해도 적어요.': 'Hostile mobs spawn but deal less damage.', '몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.': 'Hostile mobs spawn; starving drops you to half a heart.', '몬스터가 많고 아파요. 굶으면 죽을 수도 있어요!': 'Mobs hit hard and starving can kill you!',
  '평화로움': 'Peaceful', '쉬움': 'Easy', '보통': 'Normal', '어려움': 'Hard',
  '게임 메뉴': 'Game Menu', '게임으로 돌아가기': 'Back to Game', '통계': 'Statistics', '버튼 배치...': 'Button Layout...', '키 설정...': 'Key Binds...', '키 설정': 'Key Binds', '오버월드': 'Overworld', '네더': 'Nether', '엔드': 'The End', '저장 후 타이틀 화면으로': 'Save and Quit to Title', '{0}일째': 'Day {0}',
  '사망했습니다!': 'You Died!', '생존: {0}일째': 'Survived: day {0}', '부활': 'Respawn', '타이틀 화면': 'Title Screen', '월드 불러오는 중': 'Loading World', '지형 생성 중... {0}%': 'Generating terrain... {0}%',
  '메시지 또는 /명령어 (Enter 전송, Esc 닫기)': 'Message or /command (Enter to send, Esc to close)', '채팅': 'Chat', '나': 'Me',
  '이 브라우저에서는 전체화면을 지원하지 않아요.': 'This browser does not support fullscreen.', '전체화면을 열 수 없어요. 허브 상단 전체화면 버튼도 이용해 주세요.': 'Could not enter fullscreen. Try the hub fullscreen button.',
  // settings
  '켬': 'ON', '끔': 'OFF', '기본': 'Default', '밝게': 'Bright', '최대': 'Max', '정지': 'Paused', '{0} 블록': '{0} blocks', '{0} 청크': '{0} chunks', '{0}초': '{0}s', '무제한': 'Unlimited', '모두': 'All', '감소': 'Decreased', '최소': 'Minimal', '자동': 'Auto',
  '누르기': 'Hold', '전환': 'Toggle', '항상 표시': 'Always', '숨김': 'Hidden', '조이스틱': 'Joystick', '방향 패드': 'D-pad', '고정 위치': 'Fixed', '터치한 곳': 'Where touched', '30초': '30s', '45초': '45s', '2분': '2 min', '5분': '5 min', '공격 쿨다운': 'Attack cooldown', '연타 (구버전)': 'Spam click (legacy)',
  '시야각': 'FOV', '난이도': 'Difficulty', 'GUI 크기': 'GUI Scale', '밝기': 'Brightness', '3인칭 카메라 거리': 'Third-person Distance', '시야 거리': 'Render Distance', '렌더 해상도': 'Render Resolution', '최대 프레임': 'Max Framerate', '파티클': 'Particles', '구름': 'Clouds', '안개': 'Fog', '손 표시': 'Show Hand', '화면 흔들림': 'View Bobbing', '시야 효과': 'FOV Effects', '피격·폭발 흔들림': 'Damage Tilt & Shake',
  '주 음량': 'Master Volume', '음악': 'Music', '블록': 'Blocks', '생물': 'Creatures', '플레이어': 'Players', '버튼 클릭음': 'Button Clicks', '마우스 감도': 'Mouse Sensitivity', '마우스 반전': 'Invert Mouse', '자동 점프': 'Auto-Jump', '휠 방향 반전': 'Invert Scroll', '웅크리기': 'Sneak', '달리기': 'Sprint',
  '터치 컨트롤': 'Touch Controls', '이동 방식': 'Movement', '터치 시점 감도': 'Touch Sensitivity', '버튼 크기': 'Button Size', '버튼 불투명도': 'Button Opacity', '탭해서 설치': 'Tap to Place', '꾹 눌러 캐기': 'Hold to Mine', '진동': 'Vibration', '좌우 반전 배치': 'Left-handed Layout', '인벤토리 보조 버튼': 'Inventory Helper Buttons', '간단한 터치 버튼': 'Simple Touch Buttons',
  'HUD 크기': 'HUD Scale', '채팅 불투명도': 'Chat Opacity', '채팅 글자 크기': 'Chat Text Size', '조준점': 'Crosshair', '아이템 이름': 'Item Names', '좌표 표시': 'Show Coordinates', 'FPS 표시': 'Show FPS', '채팅 표시': 'Show Chat', '게임 안내 메시지': 'Game Notices', '창을 벗어나면 일시정지': 'Pause on Lost Focus', '자동 저장': 'Autosave',
  '메뉴 배경 흐림': 'Menu Background Blur', '타이틀 배경 속도': 'Panorama Scroll Speed', '고대비 테두리': 'High Contrast Outlines', '움직임 줄이기': 'Reduce Motion', '전투 방식': 'Combat', '공격 게이지': 'Attack Indicator', '데미지 숫자': 'Damage Numbers',
  '캐릭터 꾸미기...': 'Skin Customization...', '음악 및 소리...': 'Music & Sounds...', '비디오 설정...': 'Video Settings...', '조작...': 'Controls...', '채팅 설정...': 'Chat Settings...', '인터페이스...': 'Interface...', '터치 컨트롤...': 'Touch Controls...', '게임플레이...': 'Gameplay...',
  '게임플레이': 'Gameplay', '비디오 설정': 'Video Settings', '음악 및 소리': 'Music & Sounds', '조작': 'Controls', '채팅 설정': 'Chat Settings', '인터페이스': 'Interface', '버튼 배치': 'Button Layout', '버튼 배치 편집...': 'Edit Button Layout...', '배치 초기화': 'Reset Layout',
  '공격 쿨다운: 무기마다 공격 속도가 있고, 게이지가 다 차야 최대 피해가 나요. 연타 방식은 쿨다운 없이 빠르게 때려요.': 'Attack cooldown: every weapon has an attack speed and deals full damage when the gauge is full. Spam click attacks without a cooldown.',
  "'간단한 터치 버튼'을 켜면 화면 탭·꾹 누르기와 겹치는 캐기/사용 버튼 등을 숨겨요. '버튼 배치 편집'에서 버튼을 옮기고 크기를 바꿀 수 있어요.": "'Simple touch buttons' hides the mine/use buttons that duplicate tap and hold on the screen. Move and resize buttons in the layout editor.",
  '지금은 터치 기기가 아니라서 버튼이 숨겨져 있어요.': 'This is not a touch device, so the buttons are hidden.', "'게임 안내 메시지'를 켜면 차원문·잠자기 같은 안내 문구를 화면에 보여줘요.": "'Game notices' shows hints such as portal and sleeping messages.",
  '메뉴, 설정, 아이템 이름, 안내 문구가 바뀌어요.': 'Changes menus, options, item names and messages.',
  '캐릭터 꾸미기': 'Skin Customization', '캐릭터': 'Character', '기본 캐릭터': 'Default Characters', '꾸미기': 'Customize', '슬림': 'Slim', '클래식': 'Classic', '체형: {0}': 'Model: {0}', '슬림 (얇은 팔)': 'Slim (thin arms)', '클래식 (넓은 팔)': 'Classic (wide arms)', '머리 모양: {0}': 'Hair: {0}', '긴 머리': 'Long', '짧은 머리': 'Short', '피부색': 'Skin', '머리 색': 'Hair Color', '상의 색': 'Shirt Color', '하의 색': 'Pants Color',
  '바위': 'Rocky', '노을': 'Sunset', '숲지기': 'Ranger', '새벽': 'Dawn',
  '초기화': 'Reset', '모두 초기화': 'Reset Keys', '없음': 'None', '바꿀 키를 누르세요 (Esc: 취소)': 'Press a key (Esc: cancel)', '방향키와 1~9 숫자 키, 마우스 버튼은 항상 함께 쓸 수 있어요.': 'Arrow keys, 1–9 and mouse buttons always work as well.', '키패드 ': 'Numpad ',
  '스페이스': 'Space', '왼쪽 Shift': 'Left Shift', '오른쪽 Shift': 'Right Shift', '왼쪽 Ctrl': 'Left Ctrl', '오른쪽 Ctrl': 'Right Ctrl', '왼쪽 Alt': 'Left Alt', '오른쪽 Alt': 'Right Alt', '왼쪽 ⌘': 'Left ⌘', '오른쪽 ⌘': 'Right ⌘', '백스페이스': 'Backspace',
  '이동': 'Movement', '앞으로 걷기': 'Walk Forwards', '뒤로 걷기': 'Walk Backwards', '왼쪽으로 걷기': 'Strafe Left', '오른쪽으로 걷기': 'Strafe Right', '점프': 'Jump', '인벤토리 열기': 'Open Inventory', '아이템 버리기': 'Drop Item', '양손 바꾸기': 'Swap Hands', '시점 전환': 'Toggle Perspective', '비행 전환 (크리에이티브)': 'Toggle Flight (Creative)', '기타': 'Other', '채팅 열기': 'Open Chat', '명령어 입력': 'Open Command', 'HUD 숨기기': 'Hide HUD', '디버그 화면': 'Debug Screen',
  '생존한 날': 'Days survived', '플레이 시간': 'Time played', '걸은 거리': 'Distance walked', '캔 블록': 'Blocks mined', '설치한 블록': 'Blocks placed', '만든 아이템': 'Items crafted', '사망 횟수': 'Deaths', '{0}일': '{0} days', '{0}시간 {1}분': '{0}h {1}m', '{0}분 {1}초': '{0}m {1}s',
  // inventory & HUD
  '인벤토리': 'Inventory', '제작': 'Crafting', '작업대': 'Crafting', '화로': 'Furnace', '상자': 'Chest', '레시피 책': 'Recipe Book', '제작 가능': 'Craftable', '닫기': 'Close', '빠른 이동': 'Quick move', '1개씩': 'One by one', '갑옷': 'Armor', '왼손': 'Off-hand', '버리기': 'Destroy Item', '아이템 검색': 'Search Items', '아이템 검색...': 'Search...', '생존 인벤토리': 'Survival Inventory', '크리에이티브 인벤토리': 'Creative Inventory',
  '전체': 'All', '도구': 'Tools', '장식': 'Decoration', '기능': 'Functional', '전투': 'Combat', '음식': 'Food', '재료': 'Ingredients', '결과가 없어요': 'No results', '지금 만들 수 있는 게 없어요': 'Nothing craftable right now', '재료가 부족해요': 'Missing ingredients', '필요: ': 'Needs: ', '아무 원목': 'any log', '나무 판자': 'planks', '양털': 'wool', '나무 반 블록': 'wooden slab',
  '더 이상 넣을 수 없어요.': 'Cannot add more.', '재료가 부족해서 더 넣을 수 없어요.': 'Not enough ingredients to add more.', '{0} 칸에는 {0} 갑옷만 넣을 수 있어요.': 'Only {0} armor fits the {0} slot.', '머리': 'head', '몸통': 'chest', '다리': 'legs', '발': 'feet',
  '내구도: {0} / {1}': 'Durability: {0} / {1}', '허기 +{0}': 'Hunger +{0}', '방어력 +{0} ({1})': '+{0} Armor ({1})', '방어력 {0}': 'Armor {0}', '공격력 {0} · 공격 속도 {1}': '{0} Attack Damage · {1} Attack Speed',
  '들고 있으면 리스폰 지점 방향을 알려줘요': 'Points to your spawn point when held', '들고 있으면 시간을 알려줘요': 'Shows the time when held', '들고 있으면 마지막으로 죽은 곳을 알려줘요': 'Points to your last death location', '공중에서 점프를 한 번 더 누르면 활공해요': 'Press jump again in mid-air to glide', '활공 중에 사용하면 앞으로 가속해요': 'Use while gliding to boost', '사용 버튼을 누르고 있으면 확대해요': 'Hold use to zoom in',
  '위치: {0}, {1}, {2}': 'XYZ: {0}, {1}, {2}', '{0}일째 · {1}쪽': 'Day {0} · facing {1}', '북': 'north', '동': 'east', '남': 'south', '서': 'west', '{0}일째 · {1} {2}': 'Day {0} · {1} {2}', '낮': 'Day', '해 질 녘': 'Sunset', '밤': 'Night',
  '리스폰 지점이에요': 'You are at spawn', '리스폰 지점까지 {0}m': '{0}m to spawn', '여기에서 죽었어요': 'You died here', '마지막 사망 지점까지 {0}m': '{0}m to last death', '사망 기록이 없어요': 'No death recorded',
  // touch
  '이동 패드': 'Move', '캐기': 'Mine', '사용 / 설치': 'Use / Place', '비행': 'Fly', '내려가기': 'Descend', '일시정지': 'Pause', '시점': 'Perspective', '버튼 배치 편집': 'Edit Button Layout', '펼치기': 'Expand', '접기': 'Collapse', '버튼을 끌어서 옮기고, 눌러서 선택하세요': 'Drag buttons to move them, tap to select',
  '크기: {0}%': 'Size: {0}%', '표시: {0}': 'Visible: {0}', '이 버튼 초기화': 'Reset Button', '격자 맞춤: {0}': 'Snap to Grid: {0}', '버튼 배치를 저장했어요.': 'Button layout saved.', '터치 버튼 배치를 기본값으로 되돌렸어요.': 'Touch layout reset to default.',
  // gameplay messages
  '경작지에만 심을 수 있어요.': 'Can only be planted on farmland.', '{0}은(는) 흙이나 잔디 위에만 심을 수 있어요.': '{0} can only be planted on dirt or grass.', '모래 위에만 심을 수 있어요.': 'Can only be placed on sand.', '블록 윗면에만 설치할 수 있어요.': 'Must be placed on top of a block.', '선인장은 모래 위에만 자라요.': 'Cactus only grows on sand.', '여기에는 설치할 수 없어요.': 'Cannot place here.',
  '침대는 앞뒤 두 칸의 빈 공간과 바닥이 필요해요.': 'A bed needs two free blocks with a floor.', '{0}이(가) 부서졌어요!': '{0} broke!', '흑요석 틀의 안쪽 너비는 2~21칸, 높이는 3~21칸이어야 합니다.': 'The obsidian frame must be 2–21 wide and 3–21 tall inside.', '에메랄드 1개로 빵 3개를 샀습니다.': 'Traded 1 emerald for 3 bread.', '네더에서는 물이 증발합니다.': 'Water evaporates in the Nether.',
  '속이 좋지 않아요… 배고픔이 빨리 줄어요.': 'You feel sick… hunger drains faster.', '너무 멀어요.': 'Too far away.', '화살이 없어요.': 'No arrows.', '겉날개가 거의 부서졌어요. 팬텀 막으로 수리하세요.': 'Your elytra is nearly broken. Repair it with a phantom membrane.', '불사의 토템이 당신을 구했습니다.': 'The totem of undying saved you.',
  '이 차원에서는 잠을 잘 수 없어요.': 'You can not sleep in this dimension.', '리스폰 지점을 정했어요. 잠은 밤에만 잘 수 있어요.': 'Respawn point set. You can only sleep at night.', '근처에 몬스터가 있어 잘 수 없어요!': 'You may not rest now; there are monsters nearby!', '리스폰 지점을 정했어요. 잘 자요…': 'Respawn point set. Sleep well…',
  '저장 공간이 부족해 월드를 저장하지 못했어요.': 'Not enough storage to save the world.', '저장된 데이터를 읽지 못해 새로 시작해요.': 'Saved data could not be read; starting fresh.', '화면을 클릭하면 다시 조작할 수 있어요.': 'Click the screen to resume control.',
  '네더 차원문이 열렸습니다. 안에 서서 기다리세요.': 'The nether portal is open. Stand inside it.', '엔드 차원문이 열렸습니다.': 'The end portal is open.', '엔더의 눈을 끼웠습니다. 틀 12개를 모두 채우세요.': 'Eye of ender inserted. Fill all 12 frames.', '차원문 안에서 4초 동안 기다리세요.': 'Wait in the portal for 4 seconds.', '가까운 곳에서 찾지 못했습니다: ': 'Could not find nearby: ',
  '높은 곳에서 떨어졌습니다': 'You hit the ground too hard', '좀비에게 당했습니다': 'You were slain by a zombie', '거미에게 당했습니다': 'You were slain by a spider', '익사했습니다': 'You drowned', '굶어 죽었습니다': 'You starved to death', '폭발에 휘말렸습니다': 'You blew up', '선인장에 찔렸습니다': 'You were pricked to death', '세상 밖으로 떨어졌습니다': 'You fell out of the world', '스스로 목숨을 끊었습니다': 'You died', '사망했습니다': 'You died',
  '/give <대상> <아이템> [개수]': '/give <targets> <item> [count]', '/effect give <대상> <효과> [초] [강도]': '/effect give <targets> <effect> [seconds] [amplifier]', '/tp <x y z | 대상> [가로 회전] [세로 회전]': '/tp <x y z | target> [yaw] [pitch]', '/summon <몹> [x y z]': '/summon <entity> [x y z]', '/locate <구조물>': '/locate <structure>', '/fill <x1 y1 z1> <x2 y2 z2> <블록>': '/fill <from> <to> <block>', '/setblock <x y z> <블록>': '/setblock <pos> <block>', '/time set <day|night|값>': '/time set <day|night|value>', '/gamemode <survival|creative>': '/gamemode <survival|creative>', '/enchant <대상> <마법> [레벨]': '/enchant <targets> <enchantment> [level]', '/clear [대상] [아이템]': '/clear [targets] [item]', '/kill [대상]': '/kill [targets]',
  // splashes
  '겉날개로 하늘을 날아요!': 'Fly with the elytra!', '마을을 찾아보세요!': 'Find a village!', '100개가 넘는 새 아이템!': '100+ new items!', '엔드 시티에 보물이!': 'Treasure in end cities!', '무너진 차원문을 조심!': 'Mind the ruined portals!', '무한한 세계!': 'Infinite worlds!', '블록으로 무엇이든!': 'Build anything!', '밤에는 조심!': 'Beware the night!', '다이아몬드를 찾아라!': 'Find diamonds!', '지하와 다른 차원을 탐험하세요!': 'Explore other dimensions!', '횃불은 소중해요': 'Torches matter', '작업대부터 만들어요': 'Craft a table first', '이제 버튼도 옮길 수 있어요!': 'Movable buttons!', '설정이 더 많아졌어요!': 'More options!', '좀비는 햇빛을 싫어해요?': 'Zombies hate sunlight?', '모바일에서도 즐겨요!': 'Play on mobile too!',
});
