// ─────────────────────────── terrain v2: continents, rivers, ridged mountains, more biomes and caves ───────────────────────────
// Worlds created after this update store gen:2 and use this generator. Older worlds keep the original
// generator (columnV1 / generateChunkV1), because saves only record player edits on top of regenerated terrain.
const RIVER = 7, TAIGA = 8, BIRCH_FOREST = 9, DARK_FOREST = 10, SWAMP = 11, BADLANDS = 12, CHERRY_GROVE = 13, FROZEN_OCEAN = 14, SNOWY_PEAKS = 15, MEADOW = 16;
BIOME_NAME.push('강', '타이가', '자작나무 숲', '어두운 숲', '늪', '악지', '벚나무 숲', '얼어붙은 바다', '눈 덮인 봉우리', '초원');
const BIOME_EN = ['Ocean', 'Beach', 'Plains', 'Forest', 'Desert', 'Snowy Plains', 'Mountains', 'River', 'Taiga', 'Birch Forest', 'Dark Forest', 'Swamp', 'Badlands', 'Cherry Grove', 'Frozen Ocean', 'Snowy Peaks', 'Meadow'];
BIOME_NAME.forEach((k, i) => { if (!Object.hasOwn(EN, k)) EN[k] = BIOME_EN[i]; });

const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const NU = 8.5;            // fbm2 output × NU ≈ unit spread (measured: σ ≈ 0.117)
const SNOW_LINE = -1.4;    // altitude-adjusted temperature below which peaks are snow-covered
const COLD = -1.2;         // below this, lowlands are snowy and seas freeze
// Wavy terracotta strata for badlands
const BADLAND_BANDS = [TERRA_C + 1, TERRACOTTA, TERRA_C + 4, TERRA_C + 1, TERRA_C + 14, TERRA_C + 12, TERRACOTTA, TERRA_C + 0, TERRA_C + 1, TERRA_C + 8, TERRA_C + 14, TERRACOTTA, TERRA_C + 4, TERRA_C + 12];
const STONEISH = new Uint8Array(256);
for (const id of [STONE, DEEPSLATE, GRANITE, DIORITE, ANDESITE, TUFF]) STONEISH[id] = 1;
const DEEP_ORE = { [COAL_ORE]: DEEP_COAL, [IRON_ORE]: DEEP_IRON, [GOLD_ORE]: DEEP_GOLD, [DIAMOND_ORE]: DEEP_DIAMOND };
// tree chance per surface column, by biome id
const TREE_DENS = [0, 0, 0.004, 0.05, 0, 0.012, 0.02, 0.004, 0.05, 0.05, 0.11, 0.025, 0, 0.022, 0, 0, 0.003];

// Villages (gen 3+): the ground around a village is levelled to one height, blending back into the
// natural terrain over a ring. Returns [level, weight 0..1] or null. Sites are judged on raw terrain.
function villageFlat(x, z) {
  if ((W.gen || 4) < 3 || W.structures === false) return null;
  const [gx, gz] = villageCenter(x, z), d = Math.hypot(x - gx, z - gz);
  if (d > 94) return null;
  const s = villageSite(gx, gz);
  return s.valid ? [s.flat, 1 - sstep(58, 94, d)] : null;
}

// Height and biome of one column. Returns [height, biome, altitude-adjusted temperature, village weight].
// raw = true skips village levelling (used to judge village sites).
function column2(x, z, raw) {
  const n = W.noise, m = W.noise2;
  // continentalness: large land masses and oceans
  const C = n.fbm2(x / 900 + 11.3, z / 900 - 7.1, 4) * NU * 0.85 + n.fbm2(x / 240 - 3.3, z / 240 + 5.5, 3) * NU * 0.3 + 0.25;
  const D = n.fbm2(x / 52 + 31.7, z / 52 - 17.3, 3) * NU;
  const T = m.fbm2(x / 640 + 500.5, z / 640 - 200.5, 3) * NU + D * 0.06;
  const H = n.fbm2(x / 520 - 800.5, z / 520 + 300.5, 3) * NU + D * 0.06;
  const Wd = m.fbm2(x / 300 - 60.5, z / 300 + 90.5, 2) * NU;
  const R = m.fbm2(x / 210 + 33.3, z / 210 + 44.4, 3) * NU;
  const land = sstep(-0.45, -0.15, C);
  let h;
  if (C < -0.45) h = SEA - 4 + (C + 0.45) * 26;
  else if (C < -0.25) h = lerp(SEA - 4, SEA + 2, (C + 0.45) / 0.2);
  else h = SEA + 2 + (C + 0.25) * 9;
  // rolling hills where the roughness noise is high
  const hill = sstep(-0.4, 1.3, R) * land;
  h += D * (1.6 + hill * 3) + n.fbm2(x / 140 - 9.9, z / 140 + 4.4, 3) * NU * hill * 10;
  // ridged mountain ranges
  const MM = sstep(0.35, 1.25, m.fbm2(x / 760 - 120.7, z / 760 + 310.2, 3) * NU) * sstep(-0.2, 0.5, C);
  if (MM > 0) {
    const r1 = 1 - Math.min(1, Math.abs(n.n2(x / 300 + 77.7, z / 300 - 12.1)) / 0.45);
    const r2 = 1 - Math.min(1, Math.abs(m.n2(x / 110 - 41.9, z / 110 + 63.3)) / 0.45);
    h += MM * (18 + (r1 * r1 * 0.72 + r2 * r2 * 0.28) * 160 + D * 4);
  }
  // terraced plateaus in hot, dry land
  const PL = sstep(0.55, 0.95, T) * sstep(0.25, 0.75, -H) * sstep(0.1, 0.5, Wd) * land * (1 - MM);
  if (PL > 0) {
    const top = SEA + 14 + Math.max(0, n.fbm2(x / 90 + 5.5, z / 90 - 8.8, 3) * NU) * 22;
    h = lerp(h, Math.max(h, Math.floor(top / 7) * 7), sstep(0.3, 0.7, PL));
  }
  // flat, waterlogged swamps in temperate wet land
  const SW = sstep(0.75, 1.2, H) * (1 - sstep(0.55, 1.0, Math.abs(T))) * land * (1 - MM) * (1 - PL);
  if (SW > 0) h = lerp(h, SEA - 0.6 + D * 1.3, SW * 0.92);
  // rivers: a valley that narrows into a channel below sea level; they fade out in high ground
  let river = 0;
  const rv = Math.abs(m.fbm2(x / 380 + 71.1, z / 380 - 33.3, 4) * NU);
  const rf = sstep(-0.35, -0.1, C) * (1 - MM * 0.9) * (1 - sstep(SEA + 28, SEA + 60, h));
  if (rf > 0 && rv < 0.32) {
    const valley = 1 - sstep(0.06, 0.32, rv);
    h = lerp(h, Math.min(h, SEA + 2 + rv * 12), valley * rf * 0.85);
    river = (1 - sstep(0, 0.075, rv)) * rf;
    if (river > 0) h = lerp(h, SEA - 2 - river * 3, river);
  }
  let vw = 0;
  if (!raw) { const f = villageFlat(x, z); if (f) { vw = f[1]; h = lerp(h, f[0], vw); river *= 1 - vw; } }
  h = Math.floor(clamp(h, SEA - 40, WH - 24));
  const Ta = T - Math.max(0, h - SEA - 40) / 55;
  let b;
  if (h < SEA) b = river > 0.35 ? RIVER : SW > 0.5 ? SWAMP : Ta < COLD ? FROZEN_OCEAN : OCEAN;
  else if (MM > 0.45 && h > SEA + 45) b = Ta < SNOW_LINE ? SNOWY_PEAKS : MOUNTAIN;
  else if (MM > 0.2 && h > SEA + 22 && Ta > COLD) b = MEADOW;
  else if (h <= SEA + 2 && C < -0.15) b = BEACH;
  else if (river > 0.35) b = RIVER;
  else if (PL > 0.5) b = BADLANDS;
  else if (Ta < COLD) b = SNOWY;
  else if (Ta < -0.6) b = TAIGA;
  else if (Ta > 0.7) b = H < 0.15 ? DESERT : H > 0.7 ? FOREST : PLAINS;
  else if (SW > 0.5) b = SWAMP;
  else if (H > 0.55 && Wd > 0.5) b = DARK_FOREST;
  else if (H > 0.3) b = Wd < -0.3 ? BIRCH_FOREST : FOREST;
  else if (Wd > 0.8 && h > SEA + 5) b = CHERRY_GROVE;
  else b = PLAINS;
  return [h, b, Ta, vw];
}
// Caves may break through the surface, except under water and on levelled village ground.
const caveTop2 = (h, vw) => h <= SEA + 2 ? h - 6 : vw > 0.05 ? h - 8 : h;
const ravineAt2 = (wx, wz, vw) => vw > 0.05 ? null : ravine2(wx, wz);

// Surface block of a column, shared by terrain filling and tree placement so both agree across chunks.
function surfaceTop2(wx, wz, h, b, ta, slope) {
  const patch = W.noise.n2(wx / 7 + 0.5, wz / 7 + 0.5), hr = hash2(wx, wz, W.seed + 3);
  const steepAt = (b === MOUNTAIN || b === SNOWY_PEAKS || b === MEADOW) ? 3 : 5;
  if (slope >= steepAt && h >= SEA && b !== BEACH && b !== DESERT && b !== BADLANDS && b !== SWAMP && b !== RIVER) return patch > 0.35 ? GRAVEL : patch < -0.35 ? ANDESITE : STONE;
  switch (b) {
    case OCEAN: return h < SEA - 12 ? GRAVEL : hr < 0.07 ? CLAY : SAND;
    case FROZEN_OCEAN: return hr < 0.5 ? GRAVEL : SAND;
    case RIVER: return h < SEA ? (hr < 0.12 ? CLAY : hr < 0.4 ? GRAVEL : SAND) : ta < COLD ? SNOW_GRASS : GRASS;
    case BEACH: case DESERT: return SAND;
    case SNOWY: return SNOW_GRASS;
    case SWAMP: return h < SEA ? (patch > 0 ? MUD : DIRT) : patch > 0.25 ? MUD : GRASS;
    case TAIGA: return patch > 0.32 ? MOSS_BLOCK : GRASS;
    case SNOWY_PEAKS: return SNOW;
    case MOUNTAIN: return ta + (hr - 0.5) * 0.16 < SNOW_LINE ? SNOW : ta < -1.05 ? (patch > 0.2 ? CALCITE : STONE) : GRASS;
    case BADLANDS: return (slope <= 1 && h < SEA + 16) ? RED_SAND : -1;   // -1 = terracotta strata
    default: return GRASS;
  }
}
// Ravine opening for a column: [half-width in noise units, floor y], or null.
function ravine2(wx, wz) {
  const mask = W.noise2.n2(wx / 520 + 12.5, wz / 520 - 71.1);
  if (mask < 0.3) return null;
  return [0.022 * sstep(0.3, 0.38, mask), 8 + Math.floor(W.noise2.n2(wx / 50 + 3.1, wz / 50 - 9.7) * 40), Math.abs(W.noise.n2(wx / 150 - 300.3, wz / 150 + 120.7))];
}
// 3D noise for one column, sampled every 4 blocks on a fixed world grid and interpolated in y.
// Same result whichever chunk asks, at a quarter of the cost of sampling every block.
const CN_STEP = 4, CN_LEN = Math.ceil(HEIGHT / CN_STEP) + 2;
const CN = { x: NaN, z: NaN, world: null, arr: [0, 1, 2, 3, 4].map(() => new Float32Array(CN_LEN)) };
function caveColumn(wx, wz) {
  if (CN.x === wx && CN.z === wz && CN.world === W) return;
  CN.x = wx; CN.z = wz; CN.world = W; for (const a of CN.arr) a.fill(NaN);
}
function cnRaw(kind, y) {
  const x = CN.x, z = CN.z;
  switch (kind) {
    case 0: return W.noise.n3(x / 26, y / 15, z / 26);                 // tunnel pair
    case 1: return W.noise2.n3(x / 26, y / 15, z / 26);
    case 2: return W.noise.n3(x / 64 + 40.5, y / 30, z / 64 - 21.5);   // caverns
    case 3: return W.noise2.n3(x / 22 + 7.7, y / 12, z / 22 - 3.3);
    default: return W.noise.n3(x / 22 + 101.3, y / 16, z / 22 - 57.1); // rock blobs
  }
}
function cn(kind, y) {
  const arr = CN.arr[kind], f = (y - YMIN) / CN_STEP, j = Math.floor(f), t = f - j;
  let a = arr[j]; if (a !== a) a = arr[j] = cnRaw(kind, YMIN + j * CN_STEP);
  if (!t) return a;
  let b = arr[j + 1]; if (b !== b) b = arr[j + 1] = cnRaw(kind, YMIN + (j + 1) * CN_STEP);
  return a + (b - a) * t;
}
function carved2(wx, y, wz, h, caveTop, rav) {
  if (y <= YMIN + 3 || y > caveTop) return false;
  caveColumn(wx, wz);
  if (y < 150) {   // winding tunnels
    const a = cn(0, y), c = cn(1, y);
    if (a * a + c * c < 0.0075) return true;
  }
  if (y < 48 && y < h - 9) {   // large caverns, rarer toward the surface
    const v = cn(2, y), thr = 0.38 + Math.max(0, y) / 100;
    if (v > thr - 0.2 && v + 0.28 * cn(3, y) > thr) return true;
  }
  if (rav && y > rav[1] && h > SEA + 2) {   // ravines: narrow at the floor, open to the sky
    if (rav[2] < rav[0] * Math.sqrt(clamp((y - rav[1]) / Math.max(8, h - rav[1]), 0, 1))) return true;
  }
  return false;
}

function generateChunk2(cx, cz) {
  const ch = newChunk(cx, cz), B = ch.blocks, seed = W.seed, n = W.noise, m = W.noise2;
  const x0 = cx * CS, z0 = cz * CS, M = 6, SZ = CS + M * 2, TR = 5;   // TR = how far trees may reach into this chunk
  const hs = new Int16Array(SZ * SZ), bs = new Uint8Array(SZ * SZ), ts = new Float32Array(SZ * SZ), vs = new Float32Array(SZ * SZ);
  for (let lz = 0; lz < SZ; lz++) for (let lx = 0; lx < SZ; lx++) { const c = column2(x0 + lx - M, z0 + lz - M), k = lz * SZ + lx; hs[k] = c[0]; bs[k] = c[1]; ts[k] = c[2]; vs[k] = c[3]; }
  const slopeAt = k => Math.max(Math.abs(hs[k] - hs[k - 1]), Math.abs(hs[k] - hs[k + 1]), Math.abs(hs[k] - hs[k - SZ]), Math.abs(hs[k] - hs[k + SZ]));
  const stoneAt = (wx, y, wz) => {   // caller has selected this column with caveColumn()
    const deep = y < 0 || (y < 8 && hash3(wx, y, wz, seed + 9) < (8 - y) / 8);
    if (cn(4, y) > 0.42) {
      if (deep) return TUFF;
      const s = m.n3(wx / 70 - 13.7, y / 50, wz / 70 + 29.9);
      return s < -0.12 ? GRANITE : s > 0.12 ? DIORITE : ANDESITE;
    }
    return deep ? DEEPSLATE : STONE;
  };

  // ── terrain, caves, water ──
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const k = (z + M) * SZ + x + M, h = hs[k], b = bs[k], ta = ts[k], wx = x0 + x, wz = z0 + z;
    ch.biomes[z * CS + x] = b; ch.heights[z * CS + x] = h;
    const top = surfaceTop2(wx, wz, h, b, ta, slopeAt(k));
    let fill = DIRT, depth = 3 + (hash2(wx, wz, seed + 5) < 0.5 ? 1 : 0), deepFill = 0;
    if (top === SAND || top === GRAVEL || top === CLAY) { fill = top === GRAVEL ? GRAVEL : SAND; if (b === DESERT || b === BEACH) deepFill = SANDSTONE; }
    else if (top === STONE || top === ANDESITE || top === CALCITE) { fill = STONE; depth = 1; }
    else if (top === SNOW) { fill = b === SNOWY_PEAKS && n.n2(wx / 9, wz / 9) > 0.15 ? PACKED_ICE : SNOW; depth = b === SNOWY_PEAKS ? 3 : 1; }
    else if (top === MUD) fill = MUD;
    else if (top === RED_SAND) { fill = RED_SAND; depth = 2; }
    const bandOff = b === BADLANDS ? Math.floor(m.n2(wx / 70, wz / 70) * 10) : 0;
    const band = y => BADLAND_BANDS[(((y + bandOff) % 14) + 14) % 14];
    const caveTop = caveTop2(h, vs[k]), rav = ravineAt2(wx, wz, vs[k]);
    const iceTop = b === FROZEN_OCEAN || (ta < COLD && b === RIVER);
    caveColumn(wx, wz);
    for (let y = YMIN; y <= Math.max(h, SEA); y++) {
      let id;
      if (y === YMIN) id = BEDROCK;
      else if (y <= YMIN + 3 && hash3(wx, y, wz, seed) < 0.75 - (y - YMIN) * 0.22) id = BEDROCK;
      else if (y > h) id = (iceTop && y === SEA) ? ICE : WATER;
      else if (b === BADLANDS && top !== RED_SAND && y > SEA - 14) id = band(y);
      else if (y === h) id = top === -1 ? band(y) : top;
      else if (y > h - depth) id = fill;
      else if (b === BADLANDS && y > SEA - 14) id = band(y);
      else if (deepFill && y > h - depth - 4) id = deepFill;
      else id = stoneAt(wx, y, wz);
      if (id !== WATER && id !== ICE && id !== BEDROCK && carved2(wx, y, wz, h, caveTop, rav)) id = y <= -45 ? LAVA : AIR;
      B[bidx(x, y, z)] = id;
    }
    // icebergs on frozen seas
    if (b === FROZEN_OCEAN) {
      const ib = n.n2(wx / 22 + 3.3, wz / 22 - 1.1);
      if (ib > 0.3) for (let y = Math.max(h + 1, SEA - Math.floor((ib - 0.3) * 50)); y <= SEA + Math.floor((ib - 0.3) * 70); y++) B[bidx(x, y, z)] = y === SEA + Math.floor((ib - 0.3) * 70) && ib > 0.36 ? SNOW : PACKED_ICE;
    }
    // ice spikes in parts of the snowy plains
    if (b === SNOWY && m.n2(wx / 160 + 0.5, wz / 160 - 0.5) > 0.25) {
      const sp = n.n2(wx / 7 + 9.1, wz / 7 - 4.4);
      if (sp > 0.33) for (let y = h + 1, e = Math.min(WH - 2, h + Math.floor((sp - 0.33) * 220)); y <= e; y++) B[bidx(x, y, z)] = PACKED_ICE;
    }
    // cave decoration: dripstone and lush moss regions
    const dripM = m.n2(wx / 170 + 7.7, wz / 170 - 3.3), lushM = dripM > 0.22 ? 0 : n.n2(wx / 150 - 50.5, wz / 150 + 20.5);
    if (dripM > 0.22 || lushM > 0.24) {
      for (let y = Math.min(h - 5, 120); y > YMIN + 5; y--) {
        const i = bidx(x, y, z); if (B[i] !== AIR) continue;
        const r = hash3(wx, y, wz, seed + 31);
        if (dripM > 0.22) {
          if (STONEISH[B[i + 256]]) { B[i + 256] = DRIPSTONE; if (r < 0.22) for (let d = 0, len = 1 + Math.floor(r * 12); d < len && B[i - d * 256] === AIR && y - d > YMIN + 4; d++) B[i - d * 256] = DRIPSTONE; }
          if (STONEISH[B[i - 256]]) { B[i - 256] = DRIPSTONE; if (r > 0.88 && B[i] === AIR) B[i] = DRIPSTONE; }
        } else {
          if (STONEISH[B[i - 256]]) B[i - 256] = r < 0.08 ? CLAY : MOSS_BLOCK;
          if (STONEISH[B[i + 256]] && r < 0.5) B[i + 256] = MOSS_BLOCK;
        }
      }
    }
  }

  // ── ores and underground pockets ──
  const rnd = mulberry32(hash2(cx, cz, seed + 5) * 4294967296);
  const host = id => STONEISH[id] ? (id === DEEPSLATE || id === TUFF ? 2 : 1) : 0;
  const vein = (id, count, size, ymin, ymax, tri) => {
    for (let v = 0; v < count; v++) {
      let x = rnd() * 16, y = ymin + (tri ? (rnd() + rnd()) / 2 : rnd()) * (ymax - ymin), z = rnd() * 16;
      const len = Math.floor(size * (0.6 + rnd() * 0.6));
      for (let k = 0; k < len; k++) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        if (ix >= 0 && ix < CS && iz >= 0 && iz < CS && iy > YMIN && iy < WH) { const i = bidx(ix, iy, iz), hh = host(B[i]); if (hh) B[i] = hh === 2 && DEEP_ORE[id] ? DEEP_ORE[id] : id; }
        x += rnd() * 2 - 1; y += rnd() * 2 - 1; z += rnd() * 2 - 1;
      }
    }
  };
  vein(DIRT, 4, 16, 0, 160); vein(GRAVEL, 4, 14, -40, 160); vein(CLAY, 1, 8, 10, 60);
  vein(COAL_ORE, 20, 11, 0, 200); vein(IRON_ORE, 10, 9, -24, 56, true); vein(IRON_ORE, 6, 8, -55, 72); vein(IRON_ORE, 8, 9, 80, 260, true);
  vein(COPPER_ORE, 10, 10, -16, 112, true); vein(GOLD_ORE, 4, 8, -55, 32, true); vein(LAPIS_ORE, 2, 7, -32, 32, true); vein(LAPIS_ORE, 2, 6, -55, 64);
  vein(DIAMOND_ORE, 4, 5, -70, 16, true); if (rnd() < 0.5) vein(DIAMOND_ORE, 1, 4, -55, -20);
  const cb = bs[(8 + M) * SZ + 8 + M];
  if (cb === MOUNTAIN || cb === SNOWY_PEAKS || cb === MEADOW) vein(EMERALD_ORE, 8, 2, -16, 240, true);
  // amethyst geode: calcite shell, amethyst lining, hollow core
  if (rnd() < 1 / 26) {
    const gx = 5 + rnd() * 6, gy = -40 + rnd() * 60, gz = 5 + rnd() * 6, R = 4.2 + rnd() * 0.8;
    for (let y = Math.floor(gy - R); y <= Math.ceil(gy + R); y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const d = Math.hypot(x + 0.5 - gx, (y + 0.5 - gy) * 1.1, z + 0.5 - gz) + (hash3(x0 + x, y, z0 + z, seed + 77) - 0.5) * 0.5;
      if (d > R || y <= YMIN + 4) continue;
      const i = bidx(x, y, z);
      if (d < R - 1.8) B[i] = AIR; else if (d < R - 0.9) B[i] = AMETHYST_BLOCK; else if (B[i] !== AIR && B[i] !== WATER && B[i] !== LAVA) B[i] = CALCITE;
    }
  }

  // ── surface plants ──
  const setL = (lx, y, lz, id, force) => {
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < YMIN || y >= WH) return;
    const i = bidx(lx, y, lz), cur = B[i];
    if (cur === AIR || (BLOCK[cur] && BLOCK[cur].render === 'cross') || (force && (cur === LEAVES || cur === SPRUCE_LEAVES || cur === BIRCH_LEAVES || cur === CHERRY_LEAVES))) B[i] = id;
  };
  const pick = (list, r) => list[Math.floor(r * list.length) % list.length];
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const k = (z + M) * SZ + x + M, h = hs[k], b = bs[k], wx = x0 + x, wz = z0 + z;
    if (h < SEA || h + 4 >= WH || B[bidx(x, h + 1, z)] !== AIR) continue;
    const topId = B[bidx(x, h, z)], r2 = hash2(wx, wz, seed + 23);
    let r = hash2(wx, wz, seed + 21);
    // sugar cane on shores next to water
    if (h === SEA && (topId === SAND || topId === GRASS || topId === DIRT || topId === RED_SAND) && (hs[k - 1] < SEA || hs[k + 1] < SEA || hs[k - SZ] < SEA || hs[k + SZ] < SEA)) {
      if (r < 0.18) { for (let j = 1, e = 1 + Math.floor(r2 * 3); j <= e; j++) setL(x, h + j, z, SUGAR_CANE); continue; }
    }
    if (topId === SAND && b === DESERT) {
      if (r < 0.006) { for (let j = 1, e = 1 + Math.floor(r2 * 3); j <= e; j++) setL(x, h + j, z, CACTUS); }
      else if (r < 0.016) setL(x, h + 1, z, DEAD_BUSH);
      continue;
    }
    if (topId === RED_SAND) { if (r < 0.02) setL(x, h + 1, z, DEAD_BUSH); continue; }
    if (topId !== GRASS) continue;
    let grass = 0.05, flower = 0.006, flowers = [FLOWER_RED, FLOWER_YELLOW], mush = 0, fern = 0;
    switch (b) {
      case PLAINS: grass = 0.22; flower = 0.02; flowers = [FLOWER_RED, FLOWER_YELLOW, CORNFLOWER]; if (r > 0.9985) { setL(x, h + 1, z, PUMPKIN); continue; } break;
      case MEADOW: grass = 0.3; flower = 0.1; flowers = [FLOWER_RED, FLOWER_YELLOW, CORNFLOWER, ALLIUM, LILY_VALLEY]; break;
      case FOREST: grass = 0.09; flower = 0.015; flowers = [FLOWER_RED, FLOWER_YELLOW, LILY_VALLEY]; mush = 0.004; if (r > 0.999) { setL(x, h + 1, z, MELON); continue; } break;
      case BIRCH_FOREST: grass = 0.1; flower = 0.03; flowers = [LILY_VALLEY, ALLIUM, FLOWER_YELLOW]; break;
      case DARK_FOREST: grass = 0.05; flower = 0.004; mush = 0.03; break;
      case TAIGA: grass = 0.05; fern = 0.14; mush = 0.006; flower = 0.004; break;
      case SWAMP: grass = 0.1; flower = 0.02; flowers = [BLUE_ORCHID]; mush = 0.012; break;
      case CHERRY_GROVE: grass = 0.12; flower = 0.06; flowers = [ALLIUM, LILY_VALLEY, FLOWER_RED]; break;
      case MOUNTAIN: grass = 0.08; fern = 0.04; flowers = [CORNFLOWER, FLOWER_YELLOW]; break;
      case RIVER: case BEACH: grass = 0.12; flower = 0.01; break;
    }
    if (r < grass) setL(x, h + 1, z, TALL_GRASS);
    else if ((r -= grass) < fern) setL(x, h + 1, z, FERN);
    else if ((r -= fern) < flower) setL(x, h + 1, z, pick(flowers, r2));
    else if ((r -= flower) < mush) setL(x, h + 1, z, r2 < 0.5 ? BROWN_MUSHROOM : RED_MUSHROOM);
  }

  // ── trees (may cross chunk borders; each is a pure function of its trunk column) ──
  for (let lz = -TR; lz < CS + TR; lz++) for (let lx = -TR; lx < CS + TR; lx++) {
    const k = (lz + M) * SZ + lx + M, h = hs[k], b = bs[k], wx = x0 + lx, wz = z0 + lz;
    const dens = TREE_DENS[b];
    if (!dens || h < SEA || h > WH - 34 || hash2(wx, wz, seed + 11) >= dens) continue;
    const sl = slopeAt(k); if (sl > 2) continue;
    const t = surfaceTop2(wx, wz, h, b, ts[k], sl);
    if (t !== GRASS && t !== SNOW_GRASS && t !== MOSS_BLOCK && t !== DIRT && !(t === MUD && b === SWAMP)) continue;
    if (h === SEA && (hs[k - 1] < SEA || hs[k + 1] < SEA || hs[k - SZ] < SEA || hs[k + SZ] < SEA)) continue;
    if (carved2(wx, h, wz, h, caveTop2(h, vs[k]), ravineAt2(wx, wz, vs[k]))) continue;
    if (W.structures !== false && treeBlocked(wx, wz)) continue;
    const r = hash2(wx, wz, seed + 12), r3 = hash2(wx, wz, seed + 13);
    let kind = 0, size = r3;
    if (b === FOREST) kind = r < 0.12 ? 3 : r < 0.35 ? 1 : 0;
    else if (b === PLAINS || b === RIVER) kind = r < 0.25 ? 3 : 0;
    else if (b === MEADOW) kind = r < 0.5 ? 1 : 0;
    else if (b === TAIGA || b === SNOWY || b === MOUNTAIN) kind = r < 0.3 ? 6 : 2;
    else if (b === BIRCH_FOREST) { kind = 1; if (r < 0.35) size = 1.4 + r3; }
    else if (b === DARK_FOREST) kind = r < 0.75 ? 4 : 3;
    else if (b === SWAMP) kind = 7;
    else if (b === CHERRY_GROVE) kind = 5;
    placeTree2(setL, lx, h + 1, lz, kind, size, x0, z0);
  }
  if (W.structures !== false) generateOverworldStructures(ch);
  const mods = W.mods.get(ckey(cx, cz));
  if (mods) for (const [i, id] of mods) B[i] = id;
  applyPendingTE(ch);
  for (let i = 0; i < CVOL; i++) { const id = B[i]; if (id && BLOCK[id] && BLOCK[id].light) ch.emit.add(i); }
  return ch;
}

// Tree shapes. Kinds 0–2 are the original oak / birch / spruce; the rest are new.
// 3 big oak, 4 dark oak (2×2 trunk), 5 cherry, 6 tall spruce, 7 swamp oak. Canopies stay within 5 blocks of the trunk.
// (ox, oz) turn the chunk-local coordinates passed to set() into world coordinates for the leaf jitter.
function placeTree2(set, x, y, z, kind, r, ox, oz) {
  if (kind <= 2) return placeTree(set, x, y, z, kind, r, ox, oz);
  const jit = (a, b, c) => hash3(a + ox, b, c + oz, 4242);
  const blob = (cx, cy, cz, rad, leaf, squash = 1.4) => {
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dz * dz + (dy * squash) * (dy * squash);
      if (d <= rad * rad + 0.6 - jit(cx + dx, cy + dy, cz + dz) * 1.6) set(cx + dx, cy + dy, cz + dz, leaf);
    }
  };
  if (kind === 3) {   // big oak: tall trunk, round crown and side branches
    const ht = 7 + Math.floor(r * 4);
    for (let k = 0; k < ht; k++) set(x, y + k, z, LOG, true);
    const a0 = r * 6.283;
    for (let j = 0; j < 3; j++) {
      const a = a0 + j * 2.1, bx = Math.round(Math.cos(a) * 2), bz = Math.round(Math.sin(a) * 2), by = y + ht - 4 + j;
      set(x + Math.sign(bx), by, z + Math.sign(bz), LOG, true); set(x + bx, by + 1, z + bz, LOG, true);
      blob(x + bx, by + 2, z + bz, 2, LEAVES);
    }
    blob(x, y + ht, z, 3, LEAVES);
    return;
  }
  if (kind === 4) {   // dark oak: thick 2×2 trunk and a wide flat canopy
    const ht = 6 + Math.floor(r * 3);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      for (let k = 0; k < ht; k++) set(x + dx, y + k, z + dz, DARK_OAK_LOG, true);
      for (let k = 1; k <= 3; k++) set(x + dx, y - k, z + dz, DARK_OAK_LOG);   // root into uneven ground
    }
    for (let k = ht - 2; k <= ht + 1; k++) {
      const rad = k === ht + 1 ? 2.6 : k === ht - 2 ? 3.2 : 4.3;
      for (let dz = -4; dz <= 5; dz++) for (let dx = -4; dx <= 5; dx++) {
        if (Math.hypot(dx - 0.5, dz - 0.5) <= rad - jit(x + dx, y + k, z + dz) * 0.9) set(x + dx, y + k, z + dz, LEAVES);
      }
    }
    return;
  }
  if (kind === 5) {   // cherry: short trunk forking into two arched branches with fluffy pink crowns
    const ht = 4 + Math.floor(r * 2), a = r * 6.283;
    for (let k = 0; k < ht; k++) set(x, y + k, z, CHERRY_LOG, true);
    for (const s of [1, -1]) {
      const bx = Math.round(Math.cos(a) * 2 * s), bz = Math.round(Math.sin(a) * 2 * s);
      set(x + Math.sign(bx), y + ht, z + Math.sign(bz), CHERRY_LOG, true); set(x + bx, y + ht + 1, z + bz, CHERRY_LOG, true);
      blob(x + bx, y + ht + 2, z + bz, 3, CHERRY_LEAVES, 1.9);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (jit(x + bx + dx, y, z + bz + dz) < 0.2) set(x + bx + dx, y + ht, z + bz + dz, CHERRY_LEAVES);
    }
    return;
  }
  if (kind === 6) {   // tall spruce: narrow layered cone
    const ht = 10 + Math.floor(r * 5);
    for (let k = 0; k < ht; k++) set(x, y + k, z, SPRUCE_LOG, true);
    for (let k = ht; k >= 3; k--) {
      const d = ht - k, base = Math.min(3, Math.floor(d / 3.2) + 1), rad = d % 2 ? base : Math.max(0, base - 1);
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) if ((dx || dz) && Math.abs(dx) + Math.abs(dz) <= rad + (rad > 1 ? 1 : 0)) set(x + dx, y + k, z + dz, SPRUCE_LEAVES);
    }
    set(x, y + ht, z, SPRUCE_LEAVES); set(x, y + ht + 1, z, SPRUCE_LEAVES);
    return;
  }
  // 7 swamp oak: short trunk, broad flat crown with leaves hanging from the rim
  const ht = 4 + Math.floor(r * 3);
  for (let k = 0; k < ht; k++) set(x, y + k, z, LOG, true);
  for (let k = ht - 2; k <= ht; k++) {
    const rad = k === ht ? 2 : 3;
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
      if (Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
      set(x + dx, y + k, z + dz, LEAVES);
      if (k === ht - 2 && (Math.abs(dx) === rad || Math.abs(dz) === rad)) { const hang = Math.floor(jit(x + dx, y, z + dz) * 4) - 1; for (let j = 1; j <= hang; j++) set(x + dx, y + k - j, z + dz, LEAVES); }
    }
  }
}
