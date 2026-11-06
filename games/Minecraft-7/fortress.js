// ─────────────────────────── nether fortress rooms (worlds made with gen 4+) ───────────────────────────
// The bridge cross and its four end towers come from generateDimensionChunk. Newer worlds also get:
// an ember hall at the crossing with a lava fountain, a treasure vault under it reached by a stairway
// (every fortress except the one at the origin, whose hall stands over the arrival chamber),
// and four themed towers: a forge (east), an ember greenhouse (west), an archive (north) and a guard
// post with a blaze spawner and cells (south). Lanterns line the bridges and Emberbloom grows on soul sand.
const FORT_GRID = 256;
Object.assign(LOOT, {
  fort_hall: [[3, 6], [GOLD, 1, 4, 5], [IRON, 1, 5, 5], [XID.raw_blackiron, 1, 3, 4], [XID.ember_coal, 2, 6, 4], [NETHER_WART, 2, 5, 3], [EMBERBLOOM, 1, 3, 3],
    [OBSIDIAN, 1, 3, 2], [SADDLE, 1, 1, 1], [GOLDEN_APPLE, 1, 1, 1], [XID.bandage, 2, 4, 3], [XID.return_scroll, 1, 1, 1], [XID.ember_tea, 1, 2, 2], [XID.fortress_compass, 1, 1, 1]],
  fort_forge: [[3, 6], [XID.raw_blackiron, 2, 5, 6], [XID.blackiron_ingot, 1, 3, 4], [XID.bronze_ingot, 2, 5, 4], [IRON, 2, 6, 4], [COAL, 3, 8, 4], [XID.ember_coal, 2, 5, 4],
    [IRON_NUGGET, 4, 12, 3], [XID.blackiron_dagger, 1, 1, 1], [XID.blackiron_hammer, 1, 1, 1], [XID.blackiron_pickaxe, 1, 1, 1], [XID.blackiron_helmet, 1, 1, 1]],
  fort_garden: [[3, 6], [EMBERBLOOM, 2, 5, 6], [NETHER_WART, 2, 6, 5], [RED_MUSHROOM, 1, 4, 3], [BROWN_MUSHROOM, 1, 4, 3], [BONE_MEAL, 2, 6, 4], [SOUL_SOIL, 2, 6, 2],
    [XID.ember_stew, 1, 1, 2], [XID.ember_dust, 2, 5, 4], [XID.ember_tea, 1, 2, 2], [XID.super_fertilizer, 1, 3, 2], [GLASS_BOTTLE, 1, 4, 2]],
  fort_archive: [[3, 6], [BOOK, 1, 3, 5], [PAPER, 3, 8, 5], [XID.tome_knowledge, 1, 1, 3], [XID.return_scroll, 1, 2, 3], [XID.memory_crystal, 1, 1, 1], [XID.fortress_compass, 1, 1, 2],
    [XID.field_guide, 1, 1, 2], [XID.depth_gauge, 1, 1, 2], [LAPIS, 2, 6, 3], [XID.rough_garnet, 1, 2, 2], [XID.rough_amber, 1, 2, 2], [XID.amber_charm, 1, 1, 1], [XID.adventure_journal, 1, 1, 1]],
  fort_prison: [[2, 5], [BONE, 2, 6, 6], [FLESH, 1, 5, 5], [STRING, 1, 4, 4], [GOLD_NUGGET, 3, 9, 4], [XID.antidote, 1, 1, 2], [XID.bandage, 1, 3, 3], [XID.lucky_coin, 1, 3, 2]],
  fort_vault: [[4, 7], [GOLD, 3, 8, 6], [GOLD_BLOCK, 1, 2, 2], [DIAMOND, 1, 3, 3], [NETHERITE_SCRAP, 1, 1, 1], [XID.garnet, 1, 2, 3], [XID.jade, 1, 2, 3], [XID.lucky_coin, 2, 5, 3],
    [ENCH_GOLDEN_APPLE, 1, 1, 0.5], [XID.obsidian_hammer, 1, 1, 1], [XID.blackiron_chest, 1, 1, 1], [XID.blackiron_legs, 1, 1, 1], [XID.warrior_tonic, 1, 2, 2], [XID.first_aid_kit, 1, 2, 2]],
});
// a few of the new items in the older structures' chests (loot is rolled when a chest is first generated)
LOOT.village.push([XID.bandage, 1, 3, 2], [XID.apple_pie, 1, 2, 2], [XID.honey_tea, 1, 1, 1]);
LOOT.dungeon.push([XID.rough_garnet, 1, 2, 2], [XID.rough_topaz, 1, 2, 2], [XID.return_scroll, 1, 1, 1], [XID.blast_charge, 1, 3, 2]);
LOOT.stronghold.push([XID.tome_knowledge, 1, 1, 2], [XID.memory_crystal, 1, 1, 1], [XID.rough_moonstone, 1, 2, 2]);
LOOT.end.push([XID.starmetal_ingot, 1, 3, 3], [XID.opal_charm, 1, 1, 1]);
LOOT.desert.push([XID.rough_amber, 1, 2, 2], [XID.lucky_coin, 1, 3, 2]);
// fortress mobs carry the new materials
if (MOBDEF.blaze) MOBDEF.blaze.drops.push([XID.ember_heart, 0, 1]);
if (MOBDEF.wither_skeleton) MOBDEF.wither_skeleton.drops.push([XID.raw_blackiron, 0, 1]);

function generateFortress(ch) {
  const x0 = ch.cx * 16, z0 = ch.cz * 16, w = makeWriter(ch), seen = new Set();
  for (const [x, z] of [[x0 - 48, z0 - 48], [x0 + 63, z0 - 48], [x0 - 48, z0 + 63], [x0 + 63, z0 + 63]]) {
    const gx = Math.round(x / FORT_GRID) * FORT_GRID, gz = Math.round(z / FORT_GRID) * FORT_GRID, k = gx + ',' + gz;
    if (seen.has(k)) continue; seen.add(k);
    if (w.hits(gx - 48, gz - 48, gx + 48, gz + 48)) buildFortress(w, ch, gx, gz);
  }
  // Emberbloom on open soul sand
  const B = ch.blocks;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) for (let y = 120; y > 30; y--) {
    const i = bidx(x, y, z);
    if (B[i] === SOUL_SAND && B[bidx(x, y + 1, z)] === AIR && hash3(x0 + x, y, z0 + z, W.seed + 515) < 0.035) B[bidx(x, y + 1, z)] = EMBERBLOOM;
  }
}
function buildFortress(w, ch, gx, gz) {
  const cx0 = ch.cx * 16, cz0 = ch.cz * 16;
  // fill a box given in fortress-relative coordinates, clipped to this chunk
  const fill = (ax, ay, az, bx, by, bz, id) => {
    const X0 = Math.max(gx + Math.min(ax, bx), cx0), X1 = Math.min(gx + Math.max(ax, bx), cx0 + 15), Z0 = Math.max(gz + Math.min(az, bz), cz0), Z1 = Math.min(gz + Math.max(az, bz), cz0 + 15);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) w.put(x, y, z, id);
  };
  const put = (x, y, z, id) => w.put(gx + x, y, gz + z, id);
  const chest = (x, y, z, table, facing = 4, extra) => {
    const X = gx + x, Z = gz + z; if (!w.inside(X, Z)) return; w.put(X, y, Z, CHEST);
    (ch.pendingTE || (ch.pendingTE = [])).push([pkey(X, y, Z), CHEST, () => { const slots = rollLoot(table, X, y, Z); if (extra) slots[13] = { id: extra, count: 1, dmg: 0 }; return { type: 'chest', facing, slots }; }]);
  };
  const facing = (x, y, z, id, f) => w.facing(gx + x, y, gz + z, id, f);
  const spawner = (x, y, z, mob) => w.spawner(gx + x, y, gz + z, mob);
  const near = (ax, az, r) => w.hits(gx + ax - r, gz + az - r, gx + ax + r, gz + az + r);
  const NB = NETHER_BRICKS;

  // ── lanterns on the bridge railings ──
  for (const s of [-1, 1]) for (const a of [12, 20, 28]) for (const r of [-3, 3]) { put(s * a, 66, r, LANTERN); put(r, 66, s * a, LANTERN); }

  // ── ember hall at the crossing (19×19) ──
  if (near(0, 0, 10)) {
    fill(-9, 62, -9, 9, 74, 9, NB); fill(-8, 64, -8, 8, 73, 8, AIR);
    for (let z = -8; z <= 8; z++) for (let x = -8; x <= 8; x++) { const d = Math.max(Math.abs(x), Math.abs(z)); if (d === 4 || d === 7) put(x, 63, z, BLACKSTONE_BRICKS); }
    for (const s of [-9, 9]) { fill(-2, 64, s, 2, 67, s, AIR); fill(s, 64, -2, s, 67, 2, AIR); for (const o of [-7, -5, 5, 7]) { fill(o, 68, s, o, 70, s, IRON_BARS); fill(s, 68, o, s, 70, o, IRON_BARS); } }
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) put(x, 74, z, GLOWSTONE);
    // lava fountain
    fill(-2, 64, -2, 2, 65, 2, NB); fill(-1, 64, -1, 1, 65, 1, AIR); fill(-1, 64, -1, 1, 64, 1, LAVA); fill(0, 64, 0, 0, 67, 0, NB); put(0, 68, 0, LANTERN);
    // ember planters in the corners
    for (const [x, z] of [[-7, -7], [7, -7], [7, 7], [-7, 7]]) for (const [dx, dz] of [[0, 0], [x > 0 ? -1 : 1, 0], [0, z > 0 ? -1 : 1]]) { put(x + dx, 64, z + dz, SOUL_SOIL); put(x + dx, 65, z + dz, EMBERBLOOM); }
    chest(8, 64, -3, 'fort_hall', 0); chest(-8, 64, -3, 'fort_hall', 1);
  }
  // ── treasure vault under the hall, with a stairway down along the south wall ──
  // (not at the origin fortress: the Nether arrival chamber and return portal sit right below that hall)
  if (near(0, 1, 9) && (gx !== 0 || gz !== 0)) {
    fill(-7, 52, -7, 7, 61, 9, NB); fill(-6, 54, -6, 6, 58, 8, AIR);
    fill(-6, 54, -2, 6, 58, -2, IRON_BARS); // the gate: break it, or open it with a fortress key
    fill(-6, 54, -6, -6, 58, -6, GOLD_BLOCK); fill(6, 54, -6, 6, 58, -6, GOLD_BLOCK);
    for (const x of [-4, -2, 2, 4]) put(x, 56, -7, GILDED_BLACKSTONE);
    chest(0, 54, -5, 'fort_vault', 5); chest(-3, 54, -5, 'fort_vault', 5); chest(3, 54, -5, 'fort_vault', 5);
    spawner(0, 54, 3, 'wither_skeleton');
    for (const [x, z] of [[-3, 3], [3, 3], [0, -4]]) put(x, 59, z, GLOWSTONE);
    put(-5, 54, 1, LANTERN); put(5, 54, 1, LANTERN);
    for (let k = 1; k <= 10; k++) { const x = -5 + k, top = 63 - k; fill(x, 52, 7, x, top, 8, NB); fill(x, top + 1, 7, x, 63, 8, AIR); }
  }
  // ── east tower: forge ──
  if (near(40, 0, 6)) {
    const T = (x, y, z, id) => put(40 + x, y, z, id);
    facing(37, 64, -5, BLAST_FURNACE, 5); facing(39, 64, -5, BLAST_FURNACE, 5); T(1, 64, -5, SMITHING_TABLE); facing(43, 64, -5, FURNACE, 5);
    T(-4, 64, -5, COAL_BLOCK); T(-4, 65, -5, COAL_BLOCK); T(4, 64, -5, COAL_BLOCK);
    for (let x = -4; x <= 4; x++) for (const z of [4, 5]) { T(x, 63, z, LAVA); T(x, 64, z, IRON_BARS); }
    T(-3, 64, 2, IRON_BLOCK); T(3, 64, 2, IRON_BLOCK);
    chest(44, 64, -3, 'fort_forge', 0);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) T(x, 73, z, GLOWSTONE);
  }
  // ── west tower: ember greenhouse ──
  if (near(-40, 0, 6)) {
    const T = (x, y, z, id) => put(-40 + x, y, z, id);
    for (const z of [-4, -3, 3, 4]) for (let x = -4; x <= 4; x++) { T(x, 63, z, SOUL_SOIL); T(x, 64, z, (x + z) % 2 === 0 ? EMBERBLOOM : (x % 3 === 0 ? RED_MUSHROOM : BROWN_MUSHROOM)); }
    T(5, 64, 3, COMPOSTER); chest(-35, 64, -3, 'fort_garden', 0);
    for (const [x, z] of [[-3, -3], [0, -3], [3, -3], [-3, 3], [0, 3], [3, 3]]) T(x, 73, z, GLOWSTONE);
  }
  // ── north tower: archive ──
  if (near(0, -40, 6)) {
    const T = (x, y, z, id) => put(x, y, -40 + z, id);
    for (let y = 64; y <= 67; y++) for (let k = -5; k <= 5; k++) {
      if (Math.abs(k) >= 2) { T(-5, y, k, BOOKSHELF); T(5, y, k, BOOKSHELF); T(k, y, -5, BOOKSHELF); }
    }
    T(0, 64, -3, ENCHANT_TABLE); T(-3, 64, 3, CARTOGRAPHY_TABLE); T(4, 64, 4, LANTERN); T(-4, 64, 4, LANTERN);
    chest(-3, 64, -44, 'fort_archive', 5); chest(3, 64, -44, 'fort_archive', 5);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) T(x, 73, z, GLOWSTONE);
  }
  // ── south tower: guard post with a blaze spawner and two cells ──
  if (near(0, 40, 6)) {
    const T = (x, y, z, id) => put(x, y, 40 + z, id);
    fill(-1, 64, 39, 1, 64, 41, NB); spawner(0, 65, 40, 'blaze');
    for (const s of [-1, 1]) {
      for (let k = 2; k <= 5; k++) for (let y = 64; y <= 66; y++) { T(s * 2, y, k, IRON_BARS); T(s * k, y, 2, IRON_BARS); }
      T(s * 5, 65, 3, COBWEB); chest(s * 4, 64, 44, 'fort_prison', 4);
    }
    chest(-4, 64, 36, 'fort_prison', 5, XID.fortress_key);
    for (const [x, z] of [[-3, -3], [3, -3], [0, 0]]) T(x, 73, z, GLOWSTONE);
  }
}
