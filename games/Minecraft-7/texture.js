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
  BULK_BLOCK_TILES.forEach(name=>tile(name,t=>t.copy('stone')));
  BULK_ITEM_TILES.forEach(name=>tile(name,t=>t.copy('stick')));
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
  for(const name of ['shield_item','elytra_item','totem_item','glass_bottle','healing_potion','speed_potion','fire_potion','ghast_face','ghast_body','hoglin_face','hoglin_body','zoglin_face','zoglin_body','strider_face','strider_body','brute_face','brute_body','dragon_face','dragon_body','silverfish_face','silverfish_body','endermite_face','endermite_body','ancient_debris','netherite_block','netherite_scrap','netherite_ingot','netherite_sword','netherite_pickaxe','netherite_axe','netherite_shovel',...ARMOR_MATS.flatMap(m=>['helmet','chest','legs','boots'].map(p=>'equip_'+m.key+'_'+p)),'ender_eye','lava_bucket',...Array.from({length:18},(_,i)=>'spawn_egg_'+i),'end_frame_top','end_frame_side','lava','villager_face','golem_face','skeleton_face','creeper_face','enderman_face','blaze_face','piglin_face','villager_robe','armor_chest','armor_helmet','armor_limb','bed_head_top','bed_head_side','deep_coal','deep_iron','deep_gold','deep_diamond','magma','nether_quartz','nether_portal','end_portal']) tile(name,t=>voronoi(t,12,[75,65,78],[35,30,40],0.4,1));
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
    ['nether-mobs.png',['ghast_face','ghast_body','hoglin_face','hoglin_body','zoglin_face','zoglin_body','strider_face','strider_body','brute_face','brute_body','dragon_face','dragon_body','silverfish_face','silverfish_body','endermite_face','endermite_body']],
    ['armor-materials.png',['leather','gold','iron','diamond'].flatMap(m=>['helmet','chest','legs','boots'].map(p=>'equip_'+m+'_'+p))],
    ['netherite-kit.png',[...['netherite','chain'].flatMap(m=>['helmet','chest','legs','boots'].map(p=>'equip_'+m+'_'+p)),'netherite_sword','netherite_pickaxe','netherite_axe','netherite_shovel','ancient_debris','netherite_scrap','netherite_ingot','netherite_block']],
    ['world-upgrade.png',[null,'water','lava','end_frame_top','end_frame_side','armor_chest','armor_helmet','armor_limb','villager_face','golem_face','skeleton_face','creeper_face','enderman_face','blaze_face','piglin_face','villager_robe']],
    ['dimension-fixes.png', [null,null,'bed_head_top','bed_top','bed_head_side','bed_side',null,null,'deep_coal','deep_iron','deep_gold','deep_diamond','magma','nether_quartz','nether_portal','end_portal']],
    ['concrete-v3.png', BULK_BLOCK_TILES.slice(0,16)],
    ['powder-v3.png', BULK_BLOCK_TILES.slice(16,32)],
    ['terracotta-v3.png', BULK_BLOCK_TILES.slice(32,48)],
    ['glazed-v3.png', BULK_BLOCK_TILES.slice(48,64)],
    ['building-v3.png', BULK_BLOCK_TILES.slice(64,80)],
    ['world-face-v2.png', NEW_FACE_TILES],
    ['world-blocks-v2.png', NEW_BLOCK_TILES],
    ['world-extra.png', EXTRA_TEXTURES],
    ['world-functional.png', [null,'table_front','furnace_top','furnace_front','sandstone_top','cactus_top','tnt_top','tnt_bottom','melon_top',null,null,'wool_3','wool_4','wool_6','wool_7',null]],
    ['world-a.png', ['dirt','grass_top','grass_side','stone','cobble','mossy','bedrock','obsidian','sand','gravel','clay','log_side','spruce_log','birch_log','log_top','planks']],
    ['world-b.png', ['coal_ore','iron_ore','gold_ore','diamond_ore','table_top','table_side','furnace_front_lit','furnace_side','stone_bricks','bricks','snow','ice','bookshelf','sandstone_side','cactus_side','tnt_side']],
    ['world-nature.png', ['leaves','spruce_leaves','birch_leaves','wool','glowstone','pumpkin_side','pumpkin_top','melon_side','chest_side','chest_front','chest_top','snow_side','wool_0','wool_1','wool_2','wool_5']],
    ...['zombie','pig','cow','sheep','spider'].map(m => ['skin-'+m+'.png', Array.from({length:16},(_,i)=>'skin_'+m+'_'+i)])
  ];
  const load = src => new Promise((resolve,reject) => { const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>resolve(im); im.onerror=reject; im.src=src; });
  const c=atlasCanvas.getContext('2d'); c.imageSmoothingEnabled=false;
  await Promise.all(defs.map(async ([file,names]) => { try { const im=await load('textures/'+file); const w=im.naturalWidth/4,h=im.naturalHeight/4; names.forEach((name,i)=>{const target=T[name]; if(target===undefined)return; c.clearRect((target%TPR)*TS,Math.floor(target/TPR)*TS,TS,TS); c.globalAlpha=name==='water'?0.65:1;c.drawImage(im,(i%4)*w,Math.floor(i/4)*h,w,h,(target%TPR)*TS,Math.floor(target/TPR)*TS,TS,TS);c.globalAlpha=1;}); } catch (_) { /* keep built-in fallback */ } }));
}

function tileUV(name) { const i = typeof name === 'number' ? name : T[name]; return [(i % TPR) / TPR, Math.floor(i / TPR) / TPR]; }

// UI icons for items (isometric cube for blocks)
async function applyGeneratedItemIcons() {
  const defs = [
    ['world-upgrade.png',[SHEARS]],
    ['dimension-fixes.png', [LEATHER,BED]],
    ['items-tools.png', [PICK0,PICK0+1,PICK0+2,PICK0+4,SWORD0,SWORD0+1,SWORD0+2,SWORD0+4,IRON,GOLD,DIAMOND,COAL,APPLE,BREAD,BEEF,BUCKET]],
    ['items-extra.png', [AXE0,AXE0+1,AXE0+2,AXE0+4,SHOVEL0,SHOVEL0+1,SHOVEL0+2,SHOVEL0+4,PICK0+3,AXE0+3,SHOVEL0+3,SWORD0+3,STICK,STRING,FLINT,FLINT_STEEL]],
    ['items-food.png', [PORK,COOKED_PORK,BEEF,STEAK,MUTTON,COOKED_MUTTON,FLESH,MELON_SLICE,BREAD,APPLE,BUCKET,WATER_BUCKET,COAL,IRON,GOLD,DIAMOND]],
    ['items-armor.png', Array.from({length:16},(_,i)=>ARMOR0+i)],
    ['items-new.png', [EMERALD,LAPIS,COPPER_INGOT,AMETHYST_SHARD,PICK0,PICK0+1,PICK0+2,PICK0+4,SWORD0,SWORD0+1,SWORD0+2,SWORD0+4,APPLE,BREAD,IRON,DIAMOND]],
    ['items-mats-v3.png', Array.from({length:16},(_,i)=>BULK_ITEM_START+i)],
    ['items-food-v3.png', Array.from({length:16},(_,i)=>BULK_ITEM_START+16+i)],
    ['mob-items-upgrade.png',[ENDER_EYE,LAVA_BUCKET,END_FRAME,SHEARS,...Array.from({length:12},(_,i)=>368+i)]],
    ['mob-items-upgrade.png',[null,null,null,null,...Array.from({length:6},(_,i)=>380+i)]],
    ['iconic-items.png',[SHIELD,ELYTRA,TOTEM,GLASS_BOTTLE,HEALING_POTION,SPEED_POTION,FIRE_POTION,null,NETHERITE_ARMOR,NETHERITE_ARMOR+1,NETHERITE_ARMOR+2,NETHERITE_ARMOR+3,CHAIN_ARMOR,CHAIN_ARMOR+1,CHAIN_ARMOR+2,CHAIN_ARMOR+3]],
    ['netherite-kit.png',[null,null,null,null,null,null,null,null,NETHERITE_SWORD,NETHERITE_PICK,NETHERITE_AXE,NETHERITE_SHOVEL,null,NETHERITE_SCRAP,NETHERITE_INGOT]],
    ['items-v2.png', [GOLDEN_APPLE,CARROT,POTATO,BAKED_POTATO,BEETROOT,EMERALD,QUARTZ,REDSTONE,LAPIS,COPPER_INGOT,AMETHYST_SHARD,PRISMARINE_SHARD,DIAMOND,IRON,GOLD,COAL]]
  ];
  const load=src=>new Promise((resolve,reject)=>{const im=new Image(); im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  // Build 32px icons, removing only the connected sheet background from tile edges.
  const drawIcon=(im,i) => {const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;const w=im.naturalWidth/4,h=im.naturalHeight/4;g.drawImage(im,(i%4)*w,Math.floor(i/4)*h,w,h,0,0,32,32);const pixels=g.getImageData(0,0,32,32),d=pixels.data;if(d[3]===0)return c;const bg=[d[0],d[1],d[2]],seen=new Uint8Array(1024),stack=[0];while(stack.length){const n=stack.pop();if(n<0||n>=1024||seen[n])continue;seen[n]=1;const k=n*4;if(Math.abs(d[k]-bg[0])+Math.abs(d[k+1]-bg[1])+Math.abs(d[k+2]-bg[2])>75)continue;d[k+3]=0;const x=n%32,y=Math.floor(n/32);if(x)stack.push(n-1);if(x<31)stack.push(n+1);if(y)stack.push(n-32);if(y<31)stack.push(n+32);}g.putImageData(pixels,0,0);return c;};
  // Process sheets in order so duplicate IDs have a deterministic final appearance.
  const sheets=await Promise.allSettled(defs.map(([file])=>load('textures/'+file)));
  for (let n=0;n<defs.length;n++) { const [file,ids]=defs[n]; try {if(sheets[n].status!=='fulfilled') continue;const im=sheets[n].value;for(let i=0;i<ids.length;i++){const id=ids[i];if(id==null)continue;const icon=drawIcon(im,i);ICON[id]=icon.toDataURL('image/png');const ti=T[ITEM[id]?.icon];if(ti!==undefined){const g=atlasCanvas.getContext('2d');g.clearRect((ti%TPR)*TS,Math.floor(ti/TPR)*TS,TS,TS);g.imageSmoothingEnabled=false;g.drawImage(icon,(ti%TPR)*TS,Math.floor(ti/TPR)*TS,TS,TS);}}}catch(_) {/* Built-in icon remains available. */}}
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
