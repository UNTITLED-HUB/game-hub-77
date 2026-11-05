// ─────────────────────────── structures ───────────────────────────
// Villages follow the terrain like the modern game: a meeting point with a well and bell, roads that
// drape over the land, and houses / farms / workshops that each sit on their own foundation and face a road.
// Also: ruined portals, desert pyramids, igloos, dungeons, a stronghold portal room, end cities and end ships.
// Every structure is a pure function of the seed, built chunk by chunk through a clipped put().

const HCACHE = new Map();
function natH(x, z) { if (HCACHE.seed !== W.seed) { HCACHE.clear(); HCACHE.seed = W.seed; } const k = x + ',' + z; let h = HCACHE.get(k); if (h === undefined) { if (HCACHE.size > 250000) HCACHE.clear(); h = column(x, z)[0]; HCACHE.set(k, h); } return h; }
const STRUCT_RND = (a, b, s) => mulberry32((hash2(a, b, (W.seed + s) | 0) * 4294967296) >>> 0);

// ── loot ──
const LOOT = {
  village: [[1, 4], [BREAD, 1, 4, 6], [APPLE, 1, 5, 5], [WHEAT, 2, 6, 4], [WHEAT_SEEDS, 2, 5, 4], [IRON, 1, 3, 3], [EMERALD, 1, 2, 2], [TORCH, 2, 6, 3], [COAL, 1, 4, 3], [BOOK, 1, 1, 1], [POTATO, 1, 4, 3], [CARROT, 1, 4, 3], [SWEET_BERRIES, 2, 6, 2]],
  smith: [[3, 6], [IRON, 1, 5, 6], [BREAD, 1, 3, 4], [APPLE, 1, 3, 3], [PICK0 + 2, 1, 1, 2], [SWORD0 + 2, 1, 1, 2], [ARMOR0 + 9, 1, 1, 1], [ARMOR0 + 8, 1, 1, 1], [OBSIDIAN, 3, 7, 2], [IRON_NUGGET, 3, 9, 3], [DIAMOND, 1, 3, 1], [SADDLE, 1, 1, 1]],
  portal: [[4, 8], [OBSIDIAN, 1, 2, 8], [FLINT, 1, 4, 6], [IRON_NUGGET, 9, 18, 6], [FLINT_STEEL, 1, 1, 6], [FIRE_CHARGE, 1, 1, 6], [GOLDEN_APPLE, 1, 1, 3], [GOLD_NUGGET, 4, 24, 8], [SWORD0 + 3, 1, 1, 3], [AXE0 + 3, 1, 1, 3], [GOLDEN_CARROT, 4, 12, 3], [GOLD_BLOCK, 1, 2, 1], [ENCH_GOLDEN_APPLE, 1, 1, 0.3]],
  desert: [[2, 6], [BONE, 4, 6, 6], [FLESH, 3, 7, 6], [SPIDER_EYE, 1, 3, 5], [GOLD, 2, 7, 4], [IRON, 1, 5, 4], [EMERALD, 1, 3, 3], [DIAMOND, 1, 3, 2], [SADDLE, 1, 1, 2], [GOLDEN_APPLE, 1, 1, 2], [ENCH_GOLDEN_APPLE, 1, 1, 0.3], [SAND, 1, 8, 3], [GUNPOWDER, 1, 8, 3]],
  dungeon: [[3, 7], [BONE, 1, 8, 6], [FLESH, 1, 8, 6], [GUNPOWDER, 1, 8, 5], [STRING, 1, 8, 5], [BREAD, 1, 1, 4], [WHEAT, 1, 4, 4], [IRON, 1, 4, 3], [GOLD, 1, 4, 2], [SADDLE, 1, 1, 3], [NAME_TAG, 1, 1, 2], [GOLDEN_APPLE, 1, 1, 2], [ENCH_GOLDEN_APPLE, 1, 1, 0.4], [BUCKET, 1, 1, 2], [REDSTONE, 1, 4, 3], [MELON_SEEDS, 2, 4, 2], [PUMPKIN_SEEDS, 2, 4, 2], [BEETROOT_SEEDS, 2, 4, 2]],
  stronghold: [[3, 7], [ENDER_PEARL, 1, 3, 4], [IRON, 1, 5, 5], [GOLD, 1, 3, 4], [DIAMOND, 1, 3, 2], [BREAD, 1, 3, 4], [APPLE, 1, 3, 4], [REDSTONE, 4, 9, 3], [BOOK, 1, 3, 5], [PAPER, 2, 7, 5], [ARMOR0 + 8, 1, 1, 1], [PICK0 + 2, 1, 1, 1], [SWORD0 + 2, 1, 1, 1]],
  igloo: [[2, 6], [APPLE, 1, 3, 6], [COAL, 1, 4, 5], [GOLD_NUGGET, 1, 3, 4], [WHEAT, 2, 3, 4], [FLESH, 1, 1, 3], [GOLDEN_APPLE, 1, 1, 2], [SNOWBALL, 2, 8, 3], [EMERALD, 1, 1, 1]],
  end: [[3, 7], [DIAMOND, 2, 7, 5], [IRON, 4, 8, 8], [GOLD, 2, 7, 8], [EMERALD, 2, 6, 3], [BEETROOT_SEEDS, 1, 10, 4], [SADDLE, 1, 1, 2], [ARMOR0 + 12, 1, 1, 1], [ARMOR0 + 13, 1, 1, 1], [ARMOR0 + 14, 1, 1, 1], [ARMOR0 + 15, 1, 1, 1], [SWORD0 + 4, 1, 1, 2], [PICK0 + 4, 1, 1, 2], [SHULKER_SHELL, 1, 2, 2], [CHORUS_FRUIT, 2, 6, 3]],
};
function rollLoot(table, x, y, z) {
  const t = LOOT[table], rnd = mulberry32((hash3(x, y, z, W.seed + 404) * 4294967296) >>> 0), slots = Array(27).fill(null);
  const entries = t.slice(1), total = entries.reduce((a, e) => a + e[3], 0), rolls = t[0][0] + Math.floor(rnd() * (t[0][1] - t[0][0] + 1));
  for (let i = 0; i < rolls; i++) {
    let r = rnd() * total, e = entries[0]; for (const en of entries) { r -= en[3]; if (r <= 0) { e = en; break; } }
    const count = Math.min(maxStack(e[0]), e[1] + Math.floor(rnd() * (e[2] - e[1] + 1)));
    for (let k = 0; k < 8; k++) { const s = Math.floor(rnd() * 27); if (!slots[s]) { slots[s] = { id: e[0], count, dmg: 0 }; break; } }
  }
  return slots;
}

// ── chunk-clipped writer ──
function makeWriter(ch) {
  const x0 = ch.cx * 16, z0 = ch.cz * 16, B = ch.blocks;
  const inside = (x, z) => x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16;
  const w = {
    inside,
    put(x, y, z, id) { if (inside(x, z) && y >= YMIN && y < WH) B[bidx(x - x0, y, z - z0)] = id; },
    get(x, y, z) { return inside(x, z) && y >= YMIN && y < WH ? B[bidx(x - x0, y, z - z0)] : AIR; },
    chest(x, y, z, table, facing = 4) { if (!inside(x, z)) return; w.put(x, y, z, CHEST); (ch.pendingTE || (ch.pendingTE = [])).push([pkey(x, y, z), CHEST, () => ({ type: 'chest', facing, slots: rollLoot(table, x, y, z) })]); },
    spawner(x, y, z, mob) { if (!inside(x, z)) return; w.put(x, y, z, SPAWNER); (ch.pendingTE || (ch.pendingTE = [])).push([pkey(x, y, z), SPAWNER, () => ({ type: 'spawner', mob, slots: [] })]); },
    facing(x, y, z, id, facing) { if (!inside(x, z)) return; w.put(x, y, z, id); const use = BLOCK[id].use; (ch.pendingTE || (ch.pendingTE = [])).push([pkey(x, y, z), id, () => use === 'furnace' ? { type: 'furnace', facing, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 } : { type: 'facing', facing, slots: [] }]); },
    hits(bx0, bz0, bx1, bz1) { return bx1 >= x0 && bx0 < x0 + 16 && bz1 >= z0 && bz0 < z0 + 16; },
  };
  return w;
}
// chest/spawner tile entities are created after the player's own edits are applied, so a broken chest stays broken
function applyPendingTE(ch) {
  if (!ch.pendingTE) return;
  for (const [k, id, make] of ch.pendingTE) {
    if (W.te.has(k)) continue;
    const [x, y, z] = k.split(',').map(Number);
    if (ch.blocks[bidx(x & 15, y, z & 15)] === id) W.te.set(k, make());
  }
  ch.pendingTE = null;
}

// ── villages ──
const villageCache = new Map(), layoutCache = new Map();
const VILLAGE_GRID = 192;
const villageCenter = (x, z) => [Math.floor((x + 64) / VILLAGE_GRID) * VILLAGE_GRID + 32, Math.floor((z + 64) / VILLAGE_GRID) * VILLAGE_GRID + 32];
function villageSite(gx, gz) {
  const key = W.seed + ':' + gx + ',' + gz; if (villageCache.has(key)) return villageCache.get(key);
  let land = 0, total = 0, lo = Infinity, hi = -Infinity;
  for (let z = -32; z <= 32; z += 8) for (let x = -32; x <= 32; x += 8) {
    total++; const [h, b] = column(gx + x, gz + z);
    if (h > SEA + 1 && b !== MOUNTAIN && b !== OCEAN && b !== BEACH) { land++; lo = Math.min(lo, h); hi = Math.max(hi, h); }
  }
  const [ch, cb] = column(gx, gz);
  const valid = ch > SEA + 1 && cb !== MOUNTAIN && cb !== OCEAN && cb !== BEACH && land / total >= 0.7 && hi - lo <= 22 && hash2(gx, gz, W.seed + 31) < 0.85;
  const v = { valid, base: ch + 1 }; villageCache.set(key, v); return v;
}
const VSTYLE = {
  plains: { found: COBBLE, corner: LOG, wall: PLANKS, roof: PLANKS, slab: OAK_SLAB, floor: PLANKS, acc: STRIPPED_LOG, post: LOG, light: LANTERN },
  desert: { found: SANDSTONE, corner: SMOOTH_SANDSTONE, wall: SANDSTONE, roof: SMOOTH_SANDSTONE, slab: SANDSTONE_SLAB, floor: SMOOTH_SANDSTONE, acc: TERRA_C + 1, post: SANDSTONE, light: TORCH, flat: true },
  snowy: { found: COBBLE, corner: SPRUCE_LOG, wall: SPRUCE_PLANKS, roof: SPRUCE_PLANKS, slab: SPRUCE_SLAB, floor: SPRUCE_PLANKS, acc: STRIPPED_LOG, post: SPRUCE_LOG, light: LANTERN, snow: true },
  taiga: { found: MOSSY, corner: SPRUCE_LOG, wall: SPRUCE_PLANKS, roof: SPRUCE_PLANKS, slab: SPRUCE_SLAB, floor: SPRUCE_PLANKS, acc: LOG, post: SPRUCE_LOG, light: LANTERN },
};
const JOB_BLOCKS = [SMOKER, BLAST_FURNACE, SMITHING_TABLE, FLETCHING_TABLE, LOOM, COMPOSTER, CARTOGRAPHY_TABLE, BOOKSHELF];
const PIECE_SIZE = { small: [5, 5], medium: [7, 7], farm: [9, 7], smith: [7, 7], library: [9, 7], pen: [7, 7] };
function villageLayout(gx, gz) {
  const key = W.seed + ':' + gx + ',' + gz; if (layoutCache.has(key)) return layoutCache.get(key);
  const site = villageSite(gx, gz); if (!site.valid) { layoutCache.set(key, null); return null; }
  const rnd = STRUCT_RND(gx, gz, 77), b = column(gx, gz)[1];
  const style = b === DESERT ? 'desert' : b === SNOWY ? 'snowy' : b === FOREST ? (rnd() < 0.5 ? 'taiga' : 'plains') : 'plains';
  const L = { gx, gz, style, pieces: [], roads: [], bx0: gx - 4, bz0: gz - 4, bx1: gx + 4, bz1: gz + 4 };
  const rects = [], roadRects = [];
  const overlap = (a, c, m) => !(a[2] < c[0] - m || a[0] > c[2] + m || a[3] < c[1] - m || a[1] > c[3] + m);
  const free = r => rects.every(o => !overlap(r, o, 1)) && roadRects.every(o => !overlap(r, o, 0)) && Math.max(Math.abs(r[0] - gx), Math.abs(r[2] - gx), Math.abs(r[1] - gz), Math.abs(r[3] - gz)) < 60;
  const grow = r => { L.bx0 = Math.min(L.bx0, r[0]); L.bz0 = Math.min(L.bz0, r[1]); L.bx1 = Math.max(L.bx1, r[2]); L.bz1 = Math.max(L.bz1, r[3]); };
  const plaza = [gx - 3, gz - 3, gx + 3, gz + 3];
  L.pieces.push({ type: 'well', x0: plaza[0], z0: plaza[1], x1: plaza[2], z1: plaza[3], r: 0, w: 7, d: 7, base: natH(gx, gz) });
  rects.push(plaza);
  const addRoad = (axis, c, a0, a1) => { const r = axis === 'x' ? [Math.min(a0, a1), c - 1, Math.max(a0, a1), c + 1] : [c - 1, Math.min(a0, a1), c + 1, Math.max(a0, a1)]; L.roads.push(r); roadRects.push(r); grow(r); return { axis, c, a0, a1 }; };
  const roads = [];
  for (const [axis, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
    if (rnd() < 0.12) continue;
    const len = 16 + Math.floor(rnd() * 22), start = (axis === 'x' ? gx : gz) + sgn * 4, end = start + sgn * len;
    const road = addRoad(axis, axis === 'x' ? gz : gx, start, end); roads.push(road);
    if (len > 22 && rnd() < 0.7) { const at = start + sgn * (9 + Math.floor(rnd() * (len - 14))), bs = rnd() < 0.5 ? 1 : -1, bl = 10 + Math.floor(rnd() * 12), c = axis === 'x' ? gz : gx; roads.push(addRoad(axis === 'x' ? 'z' : 'x', at, c + bs * 2, c + bs * (2 + bl))); }
  }
  const terrainOk = r => { const hs = [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [(r[0] + r[2]) >> 1, (r[1] + r[3]) >> 1]].map(([x, z]) => natH(x, z)); if (Math.min(...hs) <= SEA) return null; if (Math.max(...hs) - Math.min(...hs) > 5) return null; return Math.round(hs.reduce((a, c) => a + c, 0) / hs.length); };
  const types = [['small', 38], ['medium', 24], ['farm', 20], ['smith', 7], ['library', 6], ['pen', 5]];
  const pickType = () => { let r = rnd() * 100; for (const [t, w] of types) { r -= w; if (r <= 0) return t; } return 'small'; };
  for (const rd of roads) {
    const dir = Math.sign(rd.a1 - rd.a0) || 1, len = Math.abs(rd.a1 - rd.a0);
    for (const side of [-1, 1]) {
      let s = 2 + Math.floor(rnd() * 3);
      while (s < len - 2) {
        const type = pickType(), [w, d] = PIECE_SIZE[type], mid = rd.a0 + dir * s;
        let rect, r;
        if (rd.axis === 'x') { const xa = mid - (w >> 1); if (side < 0) { rect = [xa, rd.c - 3 - (d - 1), xa + w - 1, rd.c - 3]; r = 2; } else { rect = [xa, rd.c + 3, xa + w - 1, rd.c + 3 + d - 1]; r = 0; } }
        else { const za = mid - (w >> 1); if (side < 0) { rect = [rd.c - 3 - (d - 1), za, rd.c - 3, za + w - 1]; r = 1; } else { rect = [rd.c + 3, za, rd.c + 3 + d - 1, za + w - 1]; r = 3; } }
        const base = free(rect) && rnd() < 0.8 ? terrainOk(rect) : null;
        if (base != null) { rects.push(rect); grow(rect); L.pieces.push({ type, x0: rect[0], z0: rect[1], x1: rect[2], z1: rect[3], r, w, d, base, job: JOB_BLOCKS[Math.floor(rnd() * JOB_BLOCKS.length)], seed: Math.floor(rnd() * 1e9) }); s += w + 1 + Math.floor(rnd() * 3); }
        else s += 3;
      }
    }
    // lamp posts beside the road
    for (let s = 6; s < len; s += 11) {
      const a = rd.a0 + dir * s, side = (s / 11) % 2 < 1 ? 2 : -2;
      const [x, z] = rd.axis === 'x' ? [a, rd.c + side] : [rd.c + side, a], rect = [x, z, x, z];
      if (rects.every(o => !overlap(rect, o, 0)) && roadRects.every(o => !overlap(rect, o, 0)) && natH(x, z) > SEA) { rects.push(rect); L.pieces.push({ type: 'lamp', x0: x, z0: z, x1: x, z1: z, r: 0, w: 1, d: 1, base: natH(x, z) }); }
    }
  }
  L.bx0 -= 4; L.bz0 -= 4; L.bx1 += 4; L.bz1 += 4;
  layoutCache.set(key, L); return L;
}
function nearVillage(x, z) {
  const [gx, gz] = villageCenter(x, z); if (Math.abs(x - gx) > 70 || Math.abs(z - gz) > 70) return false;
  const L = villageLayout(gx, gz); return !!L && x >= L.bx0 && x <= L.bx1 && z >= L.bz0 && z <= L.bz1;
}
function pieceXZ(p, u, v) { switch (p.r) { case 0: return [p.x0 + u, p.z0 + v]; case 2: return [p.x1 - u, p.z1 - v]; case 1: return [p.x1 - v, p.z0 + u]; default: return [p.x0 + v, p.z1 - u]; } }
const FRONT_FACE = [4, 1, 5, 0]; // block face that looks out of the front: -z, +x, +z, -x
function buildVillage(w, L) {
  const S = VSTYLE[L.style];
  for (const r of L.roads) {
    if (!w.hits(r[0], r[1], r[2], r[3])) continue;
    for (let z = r[1]; z <= r[3]; z++) for (let x = r[0]; x <= r[2]; x++) {
      if (!w.inside(x, z)) continue;
      const h = natH(x, z);
      if (h <= SEA) { w.put(x, SEA, z, S.floor === SMOOTH_SANDSTONE ? SANDSTONE : PLANKS); for (let y = SEA + 1; y < SEA + 4; y++) w.put(x, y, z, AIR); continue; }
      w.put(x, h, z, L.style === 'desert' && hash2(x, z, 9) < 0.3 ? SMOOTH_SANDSTONE : DIRT_PATH); w.put(x, h - 1, z, DIRT);
      for (let y = h + 1; y < h + 5; y++) w.put(x, y, z, AIR);
    }
  }
  for (const p of L.pieces) if (w.hits(p.x0 - 2, p.z0 - 2, p.x1 + 2, p.z1 + 2)) buildPiece(w, p, S, L.style);
}
function buildPiece(w, p, S, style) {
  const rnd = mulberry32((p.seed || 7) >>> 0), base = p.base;
  const at = (u, y, v, id) => { const [x, z] = pieceXZ(p, u, v); w.put(x, base + y, z, id); };
  const H = { small: 7, medium: 9, farm: 3, smith: 6, library: 8, pen: 3, well: 4, lamp: 4 }[p.type];
  // foundation down to the ground and a clear volume above it
  for (let v = 0; v < p.d; v++) for (let u = 0; u < p.w; u++) {
    const [x, z] = pieceXZ(p, u, v); if (!w.inside(x, z)) continue;
    const nat = natH(x, z);
    for (let y = Math.max(nat + 1, base - 12); y < base; y++) w.put(x, y, z, p.type === 'farm' || p.type === 'pen' || p.type === 'lamp' || p.type === 'well' ? DIRT : S.found);
    for (let y = base + 1; y <= Math.max(nat, base + H) + 2; y++) w.put(x, y, z, AIR);
    w.put(x, base, z, p.type === 'well' ? DIRT_PATH : p.type === 'lamp' ? (style === 'desert' ? SANDSTONE : GRASS) : S.found);
  }
  const chestAt = (u, y, v, table) => { const [x, z] = pieceXZ(p, u, v); w.chest(x, base + y, z, table, FRONT_FACE[p.r]); };
  const faceAt = (u, y, v, id) => { const [x, z] = pieceXZ(p, u, v); w.facing(x, base + y, z, id, FRONT_FACE[p.r]); };
  const used = new Set();
  const bedIn = cells => { cells = cells.filter(([u, v]) => !used.has(u + ',' + v)); for (const [u, v] of cells) { const [x, z] = pieceXZ(p, u, v); const pair = cells.find(([u2, v2]) => { const [x2, z2] = pieceXZ(p, u2, v2); return x2 === x && z2 === z + 1; }); if (pair) { w.put(x, base + 1, z, BED); w.put(x, base + 1, z + 1, BED_HEAD); used.add(u + ',' + v); used.add(pair[0] + ',' + pair[1]); return true; } } return false; };
  const free = (wid, dep, taken) => { const c = []; for (let v = 1; v < dep - 1; v++) for (let u = 1; u < wid - 1; u++) if (!(v === 1 && u === (wid >> 1)) && !taken.some(t => t[0] === u && t[1] === v)) c.push([u, v]); return c; };
  const roof = (wid, dep, y0) => {
    if (S.flat) { for (let v = -1; v <= dep; v++) for (let u = -1; u <= wid; u++) at(u, y0, v, u < 0 || v < 0 || u >= wid || v >= dep ? S.slab : S.roof); for (let u = 0; u < wid; u++) { at(u, y0 + 1, 0, S.slab); at(u, y0 + 1, dep - 1, S.slab); } return; }
    const half = (wid - 1) >> 1;
    for (let k = 0; k <= half; k++) for (let v = -1; v <= dep; v++) {
      for (let u = k - 1; u <= wid - k; u++) {
        const edge = u === k - 1 || u === wid - k;
        if (edge) at(u, y0 + k, v, S.slab);
        else { at(u, y0 + k, v, k === half ? S.slab : S.roof); if (S.snow && k === half) at(u, y0 + k + 1, v, SNOW_LAYER); }
      }
    }
  };
  const walls = (wid, dep, hgt, doorU) => {
    for (let y = 1; y <= hgt; y++) for (let v = 0; v < dep; v++) for (let u = 0; u < wid; u++) {
      const edgeU = u === 0 || u === wid - 1, edgeV = v === 0 || v === dep - 1; if (!edgeU && !edgeV) continue;
      let id = edgeU && edgeV ? S.corner : S.wall;
      if (y === 2 && !(edgeU && edgeV) && ((edgeU && v % 2 === 0 && v > 0 && v < dep - 1) || (v === dep - 1 && u % 2 === 0 && u > 0 && u < wid - 1))) id = GLASS;
      if (style === 'desert' && y === hgt && !(edgeU && edgeV)) id = S.acc;
      if (v === 0 && u === doorU && y <= 2) id = AIR;
      at(u, y, v, id);
    }
    for (let v = 1; v < dep - 1; v++) for (let u = 1; u < wid - 1; u++) at(u, 0, v, S.floor);
    // a short path from the door to the road
    const [dx, dz] = pieceXZ(p, doorU, -1); if (w.inside(dx, dz)) { const h = natH(dx, dz); if (h > SEA) { w.put(dx, h, dz, DIRT_PATH); for (let y = h + 1; y < h + 4; y++) w.put(dx, y, dz, AIR); } }
  };
  switch (p.type) {
    case 'well': {
      for (let v = 0; v < 7; v++) for (let u = 0; u < 7; u++) at(u, 0, v, DIRT_PATH);
      for (let v = 2; v <= 4; v++) for (let u = 2; u <= 4; u++) { at(u, 0, v, S.found); at(u, -1, v, S.found); at(u, -2, v, S.found); }
      at(3, 0, 3, WATER); at(3, -1, 3, WATER);
      for (const [u, v] of [[2, 2], [4, 2], [2, 4], [4, 4]]) { at(u, 1, v, S.post); at(u, 2, v, S.post); }
      for (let v = 2; v <= 4; v++) for (let u = 2; u <= 4; u++) at(u, 3, v, S.slab);
      at(1, 1, 1, BELL); at(5, 1, 5, S.light === LANTERN ? LANTERN : TORCH);
      break;
    }
    case 'lamp': at(0, 1, 0, S.post); at(0, 2, 0, S.post); at(0, 3, 0, S.light); break;
    case 'small': {
      walls(5, 5, 3, 2); roof(5, 5, 4);
      bedIn(free(5, 5, [[3, 3], [1, 3], [3, 1]]));
      at(3, 1, 3, rnd() < 0.5 ? TABLE : S.found === SANDSTONE ? TERRA_C + 1 : CHEST);
      if (rnd() < 0.5) chestAt(1, 1, 3, 'village'); else at(1, 1, 3, p.job);
      at(3, 1, 1, TORCH);
      break;
    }
    case 'medium': {
      walls(7, 7, 4, 3); roof(7, 7, 5);
      const taken = [[1, 2], [5, 2], [3, 5], [1, 1], [5, 1], [3, 4]]; bedIn(free(7, 7, taken)); bedIn(free(7, 7, taken));
      if (p.job === SMOKER || p.job === BLAST_FURNACE) faceAt(1, 1, 2, p.job); else at(1, 1, 2, p.job);
      chestAt(5, 1, 2, 'village'); at(3, 1, 5, BOOKSHELF); at(1, 1, 1, TORCH); at(5, 1, 1, TORCH);
      at(3, 1, 4, TABLE);
      break;
    }
    case 'library': {
      walls(9, 7, 5, 4); roof(9, 7, 6);
      for (let u = 1; u < 8; u++) { at(u, 1, 5, BOOKSHELF); at(u, 2, 5, BOOKSHELF); }
      for (let v = 2; v < 5; v++) { at(1, 1, v, BOOKSHELF); at(7, 1, v, BOOKSHELF); }
      at(4, 1, 3, CARTOGRAPHY_TABLE); at(2, 1, 1, TORCH); at(6, 1, 1, TORCH); chestAt(6, 1, 4, 'village');
      break;
    }
    case 'smith': {
      for (let y = 1; y <= 4; y++) for (let v = 0; v < 7; v++) for (let u = 0; u < 7; u++) {
        const edgeU = u === 0 || u === 6, edgeV = v === 0 || v === 6; if (!edgeU && !edgeV) continue;
        let id = edgeU && edgeV ? S.corner : style === 'desert' ? SANDSTONE : COBBLE;
        if (v === 0 && u >= 2 && u <= 4 && y <= 3) id = u === 3 || y < 3 ? AIR : id;
        if (y === 2 && edgeU && v === 3) id = IRON_BARS;
        at(u, y, v, id);
      }
      for (let v = 1; v < 6; v++) for (let u = 1; u < 6; u++) at(u, 0, v, SMOOTH_STONE);
      for (let v = -1; v <= 7; v++) for (let u = -1; u <= 7; u++) at(u, 5, v, u < 0 || v < 0 || u > 6 || v > 6 ? COBBLE_SLAB : style === 'desert' ? SMOOTH_SANDSTONE : COBBLE);
      faceAt(1, 1, 5, FURNACE); faceAt(2, 1, 5, BLAST_FURNACE); at(5, 1, 5, SMITHING_TABLE); chestAt(5, 1, 3, 'smith'); at(1, 1, 1, TORCH); at(1, 1, 3, rnd() < 0.3 ? IRON_BLOCK : TABLE);
      break;
    }
    case 'farm': {
      const crops = [WHEAT_RIPE, WHEAT_RIPE, CARROT_CROP, POTATO_CROP][Math.floor(rnd() * 4)], crops2 = rnd() < 0.5 ? crops : WHEAT_RIPE;
      for (let v = 0; v < 7; v++) for (let u = 0; u < 9; u++) {
        const edge = u === 0 || u === 8 || v === 0 || v === 6;
        if (edge) { at(u, 0, v, style === 'desert' ? SANDSTONE : (style === 'plains' ? LOG : SPRUCE_LOG)); continue; }
        if (u === 4) { at(u, 0, v, WATER); continue; }
        at(u, 0, v, FARMLAND); at(u, 1, v, u < 4 ? crops : crops2);
      }
      at(0, 1, 0, COMPOSTER);
      break;
    }
    case 'pen': {
      for (let v = 0; v < 7; v++) for (let u = 0; u < 7; u++) { const edge = u === 0 || u === 6 || v === 0 || v === 6; at(u, 0, v, GRASS); if (edge && !(v === 0 && u === 3)) at(u, 1, v, (u + v) % 2 ? S.post : S.slab); }
      at(2, 1, 4, HAY_BALE); at(4, 1, 5, HAY_BALE); at(4, 2, 5, HAY_BALE); at(1, 1, 1, S.light === LANTERN ? COMPOSTER : HAY_BALE);
      { const [x, z] = pieceXZ(p, 3, 3), mk = 'pen:' + x + ',' + z; if (w.inside(x, z) && !W.te.has(mk)) { W.te.set(mk, { type: 'marker', slots: [] }); const kind = ['sheep', 'cow', 'pig', 'chicken'][Math.floor(rnd() * 4)]; (W.pendingSpawns || (W.pendingSpawns = [])).push([kind, x + 0.5, base + 2, z + 0.5], [kind, x - 0.5, base + 2, z + 1.5]); } }
      break;
    }
  }
}

// ── grid placement for rare structures ──
function structureAt(kind, gx, gz) {
  const spacing = { portal: 160, pyramid: 224, igloo: 208 }[kind], salt = { portal: 501, pyramid: 601, igloo: 701 }[kind], reach = { portal: 8, pyramid: 14, igloo: 8 }[kind], chance = { portal: 0.6, pyramid: 0.75, igloo: 0.7 }[kind];
  if (hash2(gx, gz, W.seed + salt) >= chance) return null;
  const ox = gx * spacing + reach + Math.floor(hash2(gx, gz, W.seed + salt + 1) * (spacing - reach * 2)), oz = gz * spacing + reach + Math.floor(hash2(gx, gz, W.seed + salt + 2) * (spacing - reach * 2));
  const [h, b] = column(ox, oz);
  if (kind === 'pyramid' && (b !== DESERT || h <= SEA + 1)) return null;
  if (kind === 'igloo' && (b !== SNOWY || h <= SEA + 1)) return null;
  if (kind === 'portal' && (h <= SEA || b === MOUNTAIN)) return null;
  if (nearVillage(ox, oz)) return null;
  return { x: ox, z: oz, h };
}
function eachStructure(kind, ch, fn) {
  const spacing = { portal: 160, pyramid: 224, igloo: 208 }[kind], reach = { portal: 8, pyramid: 14, igloo: 8 }[kind];
  const x0 = ch.cx * 16 - reach, x1 = ch.cx * 16 + 15 + reach, z0 = ch.cz * 16 - reach, z1 = ch.cz * 16 + 15 + reach;
  for (let gz = Math.floor(z0 / spacing); gz <= Math.floor(z1 / spacing); gz++) for (let gx = Math.floor(x0 / spacing); gx <= Math.floor(x1 / spacing); gx++) {
    const s = structureAt(kind, gx, gz); if (!s) continue;
    if (s.x < x0 || s.x > x1 || s.z < z0 || s.z > z1) continue;
    fn(s, gx, gz);
  }
}

// ── ruined portal ──
function buildRuinedPortal(w, s, gx, gz) {
  const rnd = STRUCT_RND(gx, gz, 502), axisX = rnd() < 0.5, broken = rnd() < 0.35, y0 = s.h;
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx, dz) + rnd() * 1.4; if (d > 5.2) continue;
    const x = s.x + dx, z = s.z + dz, h = natH(x, z);
    if (Math.abs(h - y0) > 3) continue;
    const r = hash2(x, z, W.seed + 503);
    w.put(x, h, z, r < 0.55 ? NETHERRACK : r < 0.68 ? MAGMA : r < 0.75 ? GILDED_BLACKSTONE : r < 0.85 ? BLACKSTONE : w.get(x, h, z) || STONE);
    for (let y = h + 1; y <= h + 7; y++) if (Math.abs(dx) > 2 || Math.abs(dz) > 2) w.put(x, y, z, AIR);
  }
  // obsidian frame: 4 wide × 5 tall, some blocks missing or crying
  for (let a = 0; a < 4; a++) for (let b = 0; b < 5; b++) {
    if (a > 0 && a < 3 && b > 0 && b < 4) { const [x, z] = axisX ? [s.x - 1 + a, s.z] : [s.x, s.z - 1 + a]; w.put(x, y0 + 1 + b, z, AIR); continue; }
    if (broken && b >= 3 && rnd() < 0.7) continue;
    if (rnd() < 0.22) continue;
    const [x, z] = axisX ? [s.x - 1 + a, s.z] : [s.x, s.z - 1 + a];
    w.put(x, y0 + 1 + b, z, rnd() < 0.18 ? CRYING_OBSIDIAN : OBSIDIAN);
  }
  for (let k = 0; k < 5; k++) { const x = s.x + Math.floor((rnd() - 0.5) * 8), z = s.z + Math.floor((rnd() - 0.5) * 8), h = natH(x, z); if (Math.abs(x - s.x) > 1 || Math.abs(z - s.z) > 1) w.put(x, h + 1, z, rnd() < 0.5 ? OBSIDIAN : rnd() < 0.5 ? STONE_BRICKS : MOSSY_SB); }
  if (rnd() < 0.5) w.put(s.x + 3, natH(s.x + 3, s.z + 2) + 1, s.z + 2, GOLD_BLOCK);
  if (rnd() < 0.35) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) { const x = s.x - 4 + dx, z = s.z + 2 + dz; w.put(x, natH(x, z), z, LAVA); }
  const cx = axisX ? s.x + 1 : s.x + 2, cz = axisX ? s.z + 2 : s.z + 1; w.chest(cx, natH(cx, cz) + 1, cz, 'portal');
}

// ── desert pyramid ──
function buildPyramid(w, s, gx, gz) {
  const y0 = s.h, R = 10, rnd = STRUCT_RND(gx, gz, 602);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const x = s.x + dx, z = s.z + dz; if (!w.inside(x, z)) continue;
    const nat = natH(x, z);
    for (let y = Math.max(nat + 1, y0 - 8); y < y0; y++) w.put(x, y, z, SANDSTONE);
    for (let y = y0 + 1; y <= Math.max(nat, y0 + 12) + 1; y++) w.put(x, y, z, AIR);
    const m = Math.max(Math.abs(dx), Math.abs(dz));
    w.put(x, y0, z, SANDSTONE);
    for (let k = 1; k <= R; k++) { const lim = R - k + 1; if (m <= lim) w.put(x, y0 + k, z, m === lim || k === R ? SANDSTONE : AIR); }
    if (m <= 4 && dz > -5) w.put(x, y0, z, (Math.abs(dx) + Math.abs(dz)) % 4 === 0 ? TERRA_C + 1 : m === 0 ? TERRA_C + 11 : SANDSTONE);
  }
  // inner hall
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) for (let y = 1; y <= 5; y++) w.put(s.x + dx, y0 + y, s.z + dz, AIR);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 1; y <= 5; y++) w.put(s.x + sx * 4, y0 + y, s.z + sz * 4, SMOOTH_SANDSTONE);
  // entrance and towers
  for (let dz = -R - 1; dz <= -4; dz++) for (let dx = -1; dx <= 1; dx++) for (let y = 1; y <= 3; y++) w.put(s.x + dx, y0 + y, s.z + dz, AIR);
  for (const tx of [-R + 2, R - 2]) for (let dz = -R; dz <= -R + 4; dz++) for (let dx = tx - 2; dx <= tx + 2; dx++) for (let y = 1; y <= 13; y++) {
    const edge = Math.abs(dx - tx) === 2 || dz === -R || dz === -R + 4;
    w.put(s.x + dx, y0 + y, s.z + dz, edge ? (y % 4 === 2 ? TERRA_C + 1 : y === 13 ? SMOOTH_SANDSTONE : SANDSTONE) : y === 13 ? SANDSTONE_SLAB : AIR);
  }
  // hidden chamber with four chests and a TNT floor
  const cy = y0 - 11;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = cy - 1; y <= cy + 3; y++) {
    const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
    w.put(s.x + dx, y, s.z + dz, y === cy - 1 ? (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? TNT : SANDSTONE) : edge || y === cy + 3 ? SANDSTONE : AIR);
  }
  for (let y = cy - 2; y < cy - 1; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.put(s.x + dx, y, s.z + dz, SANDSTONE);
  for (let y = cy + 3; y < y0; y++) w.put(s.x, y, s.z, AIR);
  for (const [dx, dz, f] of [[2, 0, 0], [-2, 0, 1], [0, 2, 4], [0, -2, 5]]) w.chest(s.x + dx, cy, s.z + dz, 'desert', f);
  void rnd;
}

// ── igloo ──
function buildIgloo(w, s, gx, gz) {
  const y0 = s.h, rnd = STRUCT_RND(gx, gz, 702);
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const x = s.x + dx, z = s.z + dz, nat = natH(x, z), d = Math.hypot(dx, dz);
    if (d > 4.3) continue;
    for (let y = Math.max(nat + 1, y0 - 5); y <= y0; y++) w.put(x, y, z, SNOW);
    for (let y = y0 + 1; y <= y0 + 6; y++) { const r = Math.hypot(dx, (y - y0 - 0.5) * 1.15, dz); w.put(x, y, z, r <= 3.9 && r > 2.9 ? SNOW : r <= 2.9 ? AIR : w.get(x, y, z) === SNOW || w.get(x, y, z) === SNOW_GRASS ? AIR : w.get(x, y, z)); }
    if (d < 3.2) w.put(x, y0, z, WOOL);
  }
  for (let dz = -6; dz <= -3; dz++) for (let dx = -1; dx <= 1; dx++) { const edge = Math.abs(dx) === 1; for (let y = y0 + 1; y <= y0 + 3; y++) w.put(s.x + dx, y, s.z + dz, edge || y === y0 + 3 ? (dz < -3 ? SNOW : AIR) : AIR); w.put(s.x + dx, y0, s.z + dz, SNOW); }
  for (let y = y0 + 1; y <= y0 + 2; y++) w.put(s.x, y, s.z - 3, AIR);
  w.put(s.x - 2, y0 + 1, s.z + 1, BED); w.put(s.x - 2, y0 + 1, s.z + 2, BED_HEAD);
  w.facing(s.x + 2, y0 + 1, s.z + 1, FURNACE, 0); w.put(s.x + 2, y0 + 1, s.z - 1, TABLE); w.put(s.x, y0 + 1, s.z + 2, TORCH);
  if (rnd() < 0.6) w.chest(s.x + 1, y0 + 1, s.z + 2, 'igloo');
}

// ── dungeon (underground monster room) ──
function buildDungeon(w, ch) {
  const rnd = STRUCT_RND(ch.cx, ch.cz, 801); if (rnd() > 0.09) return;
  const x = ch.cx * 16 + 5 + Math.floor(rnd() * 6), z = ch.cz * 16 + 5 + Math.floor(rnd() * 6), y = -40 + Math.floor(rnd() * 70);
  if (y > natH(x, z) - 10) return;
  const c = w.get(x, y, z); if (c !== STONE && c !== DEEPSLATE && c !== AIR && !BLOCK[c]?.tier) return;
  const rx = 3 + (rnd() < 0.5 ? 1 : 0), rz = 3 + (rnd() < 0.5 ? 1 : 0);
  for (let dz = -rz; dz <= rz; dz++) for (let dx = -rx; dx <= rx; dx++) for (let dy = -1; dy <= 4; dy++) {
    const edge = Math.abs(dx) === rx || Math.abs(dz) === rz || dy === -1 || dy === 4;
    const cur = w.get(x + dx, y + dy, z + dz);
    if (edge) { if (dy === -1 || cur !== AIR || rnd() < 0.8) w.put(x + dx, y + dy, z + dz, dy === -1 ? (rnd() < 0.6 ? MOSSY : COBBLE) : (rnd() < 0.35 ? MOSSY : COBBLE)); }
    else w.put(x + dx, y + dy, z + dz, AIR);
  }
  w.spawner(x, y, z, ['zombie', 'zombie', 'skeleton', 'spider'][Math.floor(rnd() * 4)]);
  w.chest(x + rx - 1, y, z, 'dungeon', 0); if (rnd() < 0.6) w.chest(x, y, z - rz + 1, 'dungeon', 5);
  for (let k = 0; k < 3; k++) w.put(x - rx + 1 + Math.floor(rnd() * (rx * 2 - 1)), y + 3, z - rz + 1 + Math.floor(rnd() * (rz * 2 - 1)), COBWEB);
}

// ── stronghold: portal room, corridors and a library ──
const STRONGHOLD = { x: 96, y: -28, z: 96 };
function buildStronghold(w, ch) {
  const { x: sx, y: sy, z: sz } = STRONGHOLD;
  if (!w.hits(sx - 40, sz - 40, sx + 40, sz + 40)) return;
  const brick = (x, y, z) => { const r = hash3(x, y, z, W.seed + 901); return r < 0.18 ? MOSSY_SB : r < 0.3 ? CRACKED_SB : STONE_BRICKS; };
  const box = (x0, y0, z0, x1, y1, z1, fillAir = true) => {
    if (!w.hits(x0, z0, x1, z1)) return;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1 || y === y0 || y === y1;
      if (edge) w.put(x, y, z, brick(x, y, z)); else if (fillAir) w.put(x, y, z, AIR);
    }
  };
  // portal room 17 × 7 × 17
  box(sx - 8, sy - 2, sz - 8, sx + 8, sy + 6, sz + 8);
  for (let z = sz - 7; z <= sz + 7; z++) for (let x = sx - 7; x <= sx + 7; x++) {
    const dx = x - sx, dz = z - sz, m = Math.max(Math.abs(dx), Math.abs(dz));
    if (m <= 3) w.put(x, sy - 1, z, Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? LAVA : STONE_BRICKS);
    if (m <= 2 && !(Math.abs(dx) <= 1 && Math.abs(dz) <= 1) && m === 2 && !(Math.abs(dx) === 2 && Math.abs(dz) === 2)) w.put(x, sy, z, END_FRAME);
    if (m === 3 && dz === -3 && Math.abs(dx) <= 1) w.put(x, sy - 1, z, STONE_BRICK_SLAB);
    if (Math.abs(dx) === 7 && Math.abs(dz) % 3 === 0) { w.put(x, sy + 2, z, IRON_BARS); w.put(x, sy + 3, z, IRON_BARS); }
  }
  for (let y = sy; y <= sy + 2; y++) for (let x = sx - 6; x <= sx + 6; x += 12) w.put(x, y, sz + 6, STONE_BRICKS);
  w.put(sx - 6, sy + 3, sz + 6, TORCH); w.put(sx + 6, sy + 3, sz + 6, TORCH);
  w.spawner(sx, sy, sz - 5, 'silverfish');
  // corridors in four directions and rooms at their ends
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ex = sx + dx * 30, ez = sz + dz * 30;
    const [cx0, cx1] = dx ? [Math.min(sx + dx * 8, ex), Math.max(sx + dx * 8, ex)] : [sx - 2, sx + 2], [cz0, cz1] = dz ? [Math.min(sz + dz * 8, ez), Math.max(sz + dz * 8, ez)] : [sz - 2, sz + 2];
    box(cx0, sy - 2, cz0, cx1, sy + 2, cz1);
    for (let k = 9; k < 30; k += 6) w.put(sx + dx * k + (dz ? 1 : 0), sy - 1, sz + dz * k + (dx ? 1 : 0), TORCH);
    // door holes into the portal room
    for (let y = sy - 1; y <= sy + 1; y++) for (let t = -1; t <= 1; t++) w.put(sx + dx * 8 + (dz ? t : 0), y, sz + dz * 8 + (dx ? t : 0), AIR);
    for (let y = sy - 1; y <= sy + 1; y++) for (let t = -1; t <= 1; t++) w.put(ex + (dz ? t : 0), y, ez + (dx ? t : 0), AIR);
    if (dx === 1) { // library
      box(ex, sy - 2, ez - 6, ex + 12, sy + 5, ez + 6);
      for (let z = ez - 5; z <= ez + 5; z++) for (let y = sy - 1; y <= sy + 3; y++) { if (Math.abs(z - ez) > 1) w.put(ex + 11, y, z, BOOKSHELF); if (z % 3 === 0) w.put(ex + 4, y, z, y < sy + 3 ? BOOKSHELF : AIR); }
      w.put(ex + 1, sy, ez + 5, BOOKSHELF); w.chest(ex + 10, sy - 1, ez, 'stronghold', 1); w.put(ex + 6, sy - 1, ez - 5, TORCH); w.put(ex + 6, sy - 1, ez + 5, TORCH);
      for (let y = sy - 1; y <= sy + 1; y++) for (let t = -1; t <= 1; t++) w.put(ex, y, ez + t, AIR);
    } else {
      const rx0 = ex - 4 + (dx < 0 ? -4 : dx > 0 ? 4 : 0), rz0 = ez - 4 + (dz < 0 ? -4 : dz > 0 ? 4 : 0);
      box(rx0, sy - 2, rz0, rx0 + 8, sy + 4, rz0 + 8);
      w.chest(rx0 + 4, sy - 1, rz0 + 4, 'stronghold'); w.put(rx0 + 2, sy - 1, rz0 + 2, TORCH); w.put(rx0 + 6, sy - 1, rz0 + 6, TORCH);
      w.put(rx0 + 1, sy - 1, rz0 + 7, COBWEB); w.put(rx0 + 7, sy + 2, rz0 + 1, COBWEB);
    }
  }
}

function generateOverworldStructures(ch) {
  const w = makeWriter(ch), x0 = ch.cx * 16, z0 = ch.cz * 16;
  // villages: the grid cell this chunk can touch
  const seen = new Set();
  for (const [ax, az] of [[x0, z0], [x0 + 15, z0], [x0, z0 + 15], [x0 + 15, z0 + 15]]) {
    const [gx, gz] = villageCenter(ax, az), key = gx + ',' + gz; if (seen.has(key)) continue; seen.add(key);
    const L = villageLayout(gx, gz); if (!L || !w.hits(L.bx0, L.bz0, L.bx1, L.bz1)) continue;
    buildVillage(w, L);
    if (w.inside(gx, gz) && !W.te.has('village:' + key)) { W.te.set('village:' + key, { type: 'marker', slots: [] }); const n = 3 + Math.floor(hash2(gx, gz, W.seed + 9) * 3); (W.pendingSpawns || (W.pendingSpawns = [])).push(...Array.from({ length: n }, (_, i) => ['villager', gx + 0.5 + (i % 3) * 2 - 2, natH(gx, gz) + 2, gz - 2.5 + Math.floor(i / 3) * 5]), ['iron_golem', gx + 4.5, natH(gx, gz) + 2, gz + 4.5]); }
  }
  eachStructure('portal', ch, (s, gx, gz) => buildRuinedPortal(w, s, gx, gz));
  eachStructure('pyramid', ch, (s, gx, gz) => buildPyramid(w, s, gx, gz));
  eachStructure('igloo', ch, (s, gx, gz) => buildIgloo(w, s, gx, gz));
  buildDungeon(w, ch);
  buildStronghold(w, ch);
}
function treeBlocked(x, z) {
  if (nearVillage(x, z)) return true;
  for (const [kind, sp, r] of [['portal', 160, 8], ['pyramid', 224, 14], ['igloo', 208, 8]]) { const st = structureAt(kind, Math.floor(x / sp), Math.floor(z / sp)); if (st && Math.abs(st.x - x) <= r + 3 && Math.abs(st.z - z) <= r + 3) return true; }
  return false;
}

// ── the End: cities and ships on the outer islands ──
const END_CITIES = [[224, 0]];
function endCityList(cx, cz) {
  const out = [...END_CITIES];
  for (let gz = Math.floor((cz * 16 - 60) / 400); gz <= Math.floor((cz * 16 + 76) / 400); gz++) for (let gx = Math.floor((cx * 16 - 60) / 400); gx <= Math.floor((cx * 16 + 76) / 400); gx++) {
    if (hash2(gx, gz, W.seed + 990) > 0.55) continue;
    const x = gx * 400 + 60 + Math.floor(hash2(gx, gz, W.seed + 991) * 280), z = gz * 400 + 60 + Math.floor(hash2(gx, gz, W.seed + 992) * 280);
    if (Math.hypot(x, z) > 320) out.push([x, z]);
  }
  return out;
}
function endForcedIsland(x, z) { for (const [cx, cz] of endCityList(x >> 4, z >> 4)) if (Math.hypot(x - cx, z - cz) < 26) return true; return false; }
const endIslandH = (x, z) => Math.floor(62 + W.noise.n2(x / 42, z / 42) * 10);
function buildEndCity(w, cx, cz) {
  if (!w.hits(cx - 16, cz - 12, cx + 40, cz + 12)) return;
  const rnd = STRUCT_RND(cx, cz, 993), base = endIslandH(cx, cz) + 1;
  const pur = (x, y, z) => w.put(x, y, z, PURPUR), pil = (x, y, z) => w.put(x, y, z, PURPUR_PILLAR);
  const room = (x0, y0, z0, x1, y1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const ex = x === x0 || x === x1, ez = z === z0 || z === z1, edge = ex || ez || y === y0 || y === y1; if (!edge) w.put(x, y, z, AIR); else if (ex && ez) pil(x, y, z); else if (y === y0) w.put(x, y, z, END_BRICKS); else if ((y - y0) % 4 === 2 && !(ex && ez) && ((x + z) % 3 === 0)) w.put(x, y, z, GLASS); else pur(x, y, z); } };
  // base house
  room(cx - 5, base, cz - 5, cx + 5, base + 6, cz + 5);
  for (let y = base + 1; y <= base + 3; y++) for (let t = -1; t <= 1; t++) w.put(cx + t, y, cz - 5, AIR);
  for (let z = cz - 8; z <= cz - 5; z++) for (let t = -1; t <= 1; t++) { w.put(cx + t, base, z, END_BRICKS); for (let y = base - 3; y < base; y++) w.put(cx + t, y, z, END_STONE); }
  // tower with a climbable spiral of purpur steps
  const top = base + 6 + 16 + Math.floor(rnd() * 6);
  room(cx - 3, base + 6, cz - 3, cx + 3, top, cz + 3);
  const ring = []; for (let u = -2; u <= 2; u++) ring.push([u, -2]); for (let v = -1; v <= 2; v++) ring.push([2, v]); for (let u = 1; u >= -2; u--) ring.push([u, 2]); for (let v = 1; v >= -1; v--) ring.push([-2, v]);
  for (let y = base + 1; y < top; y++) { const [u, v] = ring[(y - base) % ring.length]; pur(cx + u, y, cz + v); }
  for (let y = base + 6; y < top; y++) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) if (u || v || y === base + 6) w.put(cx + u, y, cz + v, AIR);
  // crown room
  room(cx - 5, top, cz - 5, cx + 5, top + 5, cz + 5);
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) w.put(cx + u, top, cz + v, Math.max(Math.abs(u), Math.abs(v)) === 2 ? END_BRICKS : AIR);
  for (const [u, v] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { w.put(cx + u, top + 6, cz + v, END_ROD); }
  w.chest(cx + 3, top + 1, cz + 3, 'end'); w.chest(cx - 3, top + 1, cz + 3, 'end');
  for (let y = top + 1; y <= top + 3; y++) w.put(cx + 5, y, cz, AIR);
  // the end ship floats beside the city
  const sx = cx + 22, sy = top - 4, sz = cz;
  for (let a = -8; a <= 8; a++) {
    const half = a < -5 ? 1 : a > 6 ? 0 : 2;
    for (let b = -half - 1; b <= half + 1; b++) for (let y = sy - 2; y <= sy + 2; y++) {
      const hullW = y === sy - 2 ? half - 1 : half + (y > sy ? 1 : 0);
      if (Math.abs(b) > hullW + 1) continue;
      const edge = Math.abs(b) === hullW + 1 || y === sy - 2 || Math.abs(a) === 8;
      w.put(sx + a, y, sz + b, edge ? (y === sy + 2 ? PURPUR_PILLAR : PURPUR) : y === sy - 1 ? END_BRICKS : AIR);
    }
  }
  for (let y = sy + 2; y <= sy + 11; y++) pil(sx, y, sz);
  for (let b = -4; b <= 4; b++) for (let y = sy + 6; y <= sy + 9; y++) if (Math.abs(b) > 0) w.put(sx + 1, y, sz + b, COLOR_WOOL + 6);
  w.put(sx + 8, sy + 3, sz, END_ROD); w.put(sx - 8, sy + 3, sz, END_ROD);
  w.put(sx - 5, sy - 1, sz, CHEST);
  w.chest(sx + 4, sy - 1, sz + 1, 'end'); w.chest(sx + 4, sy - 1, sz - 1, 'end');
}
function generateEndStructures(ch) {
  const w = makeWriter(ch);
  for (const [cx, cz] of endCityList(ch.cx, ch.cz)) {
    buildEndCity(w, cx, cz);
    const sx = cx + 22, top = endShipTop(cx, cz), key = pkey(sx - 5, top - 5, cz);
    if (w.inside(sx - 5, cz)) (ch.pendingTE || (ch.pendingTE = [])).push([key, CHEST, () => { const slots = rollLoot('end', sx - 5, top - 5, cz); slots[13] = { id: ELYTRA, count: 1, dmg: 0 }; slots[4] = { id: TOTEM, count: 1, dmg: 0 }; return { type: 'chest', facing: 4, slots }; }]);
  }
}
function endShipTop(cx, cz) { const rnd = STRUCT_RND(cx, cz, 993), base = endIslandH(cx, cz) + 1; return base + 6 + 16 + Math.floor(rnd() * 6); }

// ── monster spawners come alive when the player is near ──
let spawnerT = 0;
function updateSpawners(dt) {
  spawnerT -= dt; if (spawnerT > 0) return; spawnerT = 3;
  if (!W.difficulty) return;
  for (const [k, te] of W.te) {
    if (te.type !== 'spawner') continue;
    const [x, y, z] = k.split(',').map(Number); if (Math.abs(x - P.x) > 16 || Math.abs(z - P.z) > 16 || Math.abs(y - P.y) > 10) continue;
    if (getBlock(x, y, z) !== SPAWNER || !MOBDEF[te.mob]) continue;
    const near = W.mobs.filter(m => !m.dead && m.type === te.mob && Math.abs(m.x - x) < 9 && Math.abs(m.z - z) < 9).length; if (near >= 5) continue;
    for (let i = 0; i < 2; i++) { const mx = x + Math.floor((Math.random() - 0.5) * 7), mz = z + Math.floor((Math.random() - 0.5) * 7); for (const my of [y, y + 1, y - 1]) if (!solidAt(mx, my, mz) && !solidAt(mx, my + 1, mz) && solidAt(mx, my - 1, mz)) { spawnMob(te.mob, mx + 0.5, my, mz + 0.5); particles(mx + 0.5, my + 0.5, mz + 0.5, T.c_spawner, 8, 0.4, 1, 0.5); break; } }
  }
}
function processPendingSpawns() {
  if (!W.pendingSpawns || !W.pendingSpawns.length) return;
  const keep = [];
  for (const s of W.pendingSpawns) { const [type, x, y, z] = s; if (!getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4) || !neighborsGenerated(getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4))) { keep.push(s); continue; } spawnMob(type, x, surfaceY(x, z, y), z); }
  W.pendingSpawns = keep.slice(-40);
}
// /locate support
function locateStructure(type) {
  const px = Math.floor(P.x), pz = Math.floor(P.z);
  if (type === 'village') { let best = null; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const [gx, gz] = villageCenter(px + dx * VILLAGE_GRID, pz + dz * VILLAGE_GRID); if (villageSite(gx, gz).valid) { const d = Math.hypot(gx - px, gz - pz); if (!best || d < best[2]) best = [gx, gz, d]; } } return best; }
  if (type === 'stronghold') return [STRONGHOLD.x, STRONGHOLD.z];
  if (type === 'fortress') return [Math.round(P.x / 256) * 256, Math.round(P.z / 256) * 256];
  if (type === 'end_city') { let best = null; for (const [x, z] of endCityList(px >> 4, pz >> 4)) { const d = Math.hypot(x - px, z - pz); if (!best || d < best[2]) best = [x, z, d]; } return best; }
  const kind = { ruined_portal: 'portal', desert_pyramid: 'pyramid', igloo: 'igloo' }[type]; if (!kind) return null;
  const sp = { portal: 160, pyramid: 224, igloo: 208 }[kind]; let best = null;
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const gx = Math.floor(px / sp) + dx, gz = Math.floor(pz / sp) + dz, s = structureAt(kind, gx, gz); if (s) { const d = Math.hypot(s.x - px, s.z - pz); if (!best || d < best[2]) best = [s.x, s.z, d]; } }
  return best;
}
