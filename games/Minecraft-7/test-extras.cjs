// Tests for this game's own items (extras.js) and the fortress rooms (fortress.js).
// Run: node test-extras.cjs game.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.argv[2], 'utf8').replace('window.GameHub.registerGame({', `window.api={init(){buildAtlas();prepareBlockTables();SAVE={settings:{particles:0}};chat=()=>{};toast=m=>{lastToast=m;};sfx=()=>{};buzz=()=>{};invChanged=()=>{};saveSoon=()=>{};particles=()=>{};openScreen=k=>{lastScreen=k;};
W={seed:123,noise:makeNoise(123),noise2:makeNoise(234),mods:new Map(),chunks:new Map(),te:new Map(),fluidQ:new Set(),gravQ:new Set(),mobs:[],items:[],particles:[],arrows:[],tnts:[],time:1000};
G={world:{cheats:true,seedText:'123'},settings:{particles:0},mode:'survival',stats:{mined:3,placed:2,crafted:1,deaths:0},inv:Array(36).fill(null),armor:Array(4).fill(null),off:null,sel:0,spawn:{x:0.5,y:70,z:0.5}};
P={x:.5,y:70,z:.5,w:.3,h:1.8,health:10,hunger:20,hurt:0,yaw:0,pitch:0,vx:0,vy:0,vz:0,effects:{},atkT:9,fallStart:70,onGround:true};},
flat(){W.chunks.clear();for(let cx=-1;cx<=1;cx++)for(let cz=-1;cz<=1;cz++){const ch=newChunk(cx,cz);ch.blocks.fill(0);W.chunks.set(ckey(cx,cz),ch);}},
get lastToast(){return lastToast},get lastScreen(){return lastScreen},
xUseItem,updateExtras,attack,craft,spawnMob,generateChunk,getBlock,setBlock,effectLevel,updateEffects,tryPlace,rollLoot,info,
ITEM,BLOCK,T,XID,LOOT,SMELT,RECIPES,MOBDEF,FUEL,EMBERBLOOM,get tiles(){return tileCount},TPR,
get W(){return W},get G(){return G},get P(){return P}};let lastToast='',lastScreen='';window.GameHub.registerGame({`);
const c = { console, Uint8Array, Uint8ClampedArray, Math, window: { GameHub: { registerGame() {} } }, document: { createElement() { return { getContext() { return { createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData() {} }; } }; } } };
vm.runInNewContext(src, c, { timeout: 60000 });
const a = c.window.api; a.init();
const X = a.XID, ids = Object.values(X);

// ── every new item: 200+, named in both languages, own icon, and obtainable ──
assert(ids.length >= 200, 'at least 200 new items: ' + ids.length);
assert.equal(new Set(ids).size, ids.length);
const icons = new Set();
const made = new Set(a.RECIPES.map(r => r.out)), smelted = new Set(Object.values(a.SMELT)), looted = new Set(Object.values(a.LOOT).flatMap(t => t.slice(1).map(e => e[0])));
for (const m of Object.values(a.MOBDEF)) for (const [id] of m.drops || []) looted.add(id);
const mined = new Set([X.rough_garnet, X.rough_topaz, X.rough_jade, X.rough_amber, X.rough_moonstone, X.rough_opal, X.rough_sapphire, X.rough_jet]);
for (const id of ids) {
  const it = a.ITEM[id];
  assert(it && it.nameKo !== undefined || it.name, 'item ' + id);
  assert(it.en && /^[A-Z]/.test(it.en), 'English name for ' + id);
  assert(Number.isInteger(a.T[it.icon]), 'icon tile for ' + it.icon);
  icons.add(a.T[it.icon]);
  assert(made.has(id) || smelted.has(id) || looted.has(id) || mined.has(id), 'no way to get ' + it.en);
}
assert.equal(icons.size, ids.length, 'every new item has its own icon');
assert(a.tiles <= a.TPR * a.TPR);
assert(a.BLOCK[a.EMBERBLOOM] && a.BLOCK[a.EMBERBLOOM].light > 0);
console.log('New items: ' + ids.length + ' with icons, English names and a source each; atlas tiles ' + a.tiles + '/' + a.TPR * a.TPR);

// ── crafting ──
const grid = cells => { const g = Array(9).fill(0); cells.forEach((v, i) => g[i] = v || 0); return g; };
assert.equal(a.craft(grid([304, 304, 304, 424]), 3).id, X.bronze_ingot, 'bronze from copper and an iron nugget');
assert.equal(a.craft(grid([0, 258, 0, 0, 256, 0, 0, 0, 0]), 3).id, X.iron_dagger, 'iron dagger');
assert.equal(a.craft(grid([258, 258, 258, 258, 256, 258, 0, 256, 0]), 3).id, X.iron_hammer, 'iron war hammer');
assert.equal(a.craft(grid([X.bronze_ingot, X.bronze_ingot, X.bronze_ingot, 0, 256, 0, 0, 256, 0]), 3).id, X.bronze_pickaxe, 'bronze pickaxe');
assert.equal(a.craft(grid([414, a.EMBERBLOOM]), 3).id, X.ember_tea, 'ember tea');
assert.equal(a.craft(grid([X.rough_jade, 292]), 3).id, X.jade, 'polishing a gem');
assert.equal(a.SMELT[288], X.jerky, 'rotten flesh smokes into jerky');
assert.equal(a.SMELT[X.raw_blackiron], X.blackiron_ingot);
console.log('Recipes: bronze, daggers, hammers, new-tier tools, teas, gems and smelting passed.');

// ── using items ──
a.flat(); const G = a.G, P = a.P;
const hold = (id, n = 1) => { G.inv[0] = { id, count: n, dmg: 0 }; G.sel = 0; };
hold(X.bandage, 3); assert(a.xUseItem(null, G.inv[0], X.bandage)); assert.equal(P.health, 14); assert.equal(G.inv[0].count, 2);
P.health = 20; assert(a.xUseItem(null, G.inv[0], X.bandage)); assert.equal(G.inv[0].count, 2, 'no bandage used at full health');
hold(X.ember_tea); assert(a.xUseItem(null, G.inv[0], X.ember_tea)); assert(a.effectLevel(P, 'fire_resistance') >= 0); assert(G.inv.some(s => s && s.id === 414), 'tea gives the bottle back');
P.effects.poison = { time: 9, amp: 0 }; P.poison = 5; hold(X.antidote); a.xUseItem(null, G.inv[0], X.antidote); assert(!P.effects.poison && !P.poison, 'antidote cures');
G.off = { id: X.topaz_charm, count: 1, dmg: 0 }; P.effects = {}; a.updateExtras(0.05); assert(a.effectLevel(P, 'speed') >= 0, 'charm works from the off hand');
G.off = { id: X.magnet, count: 1, dmg: 0 }; a.W.items.push({ id: 3, count: 1, x: 5, y: 70, z: 0.5, pick: 0 }); a.updateExtras(0.1); assert(a.W.items[0].x < 5, 'magnet pulls items'); a.W.items.length = 0; G.off = null;
hold(X.pocket_workbench); a.xUseItem(null, G.inv[0], X.pocket_workbench); assert.equal(a.lastScreen, 'table');
P.sneaking = true; hold(X.memory_crystal); a.xUseItem(null, G.inv[0], X.memory_crystal); assert(P.mark && P.mark.dim === 'overworld');
P.sneaking = false; P.x = 9.5; P.z = 9.5; a.xUseItem(null, G.inv[0], X.memory_crystal); assert.equal(P.x, 0.5, 'memory crystal returns to the mark'); assert.equal(G.inv[0].dmg, 1);
for (let y = 70; y <= 72; y++) for (let x = 3; x <= 5; x++) a.setBlock(x, y, 3, 240);
hold(X.fortress_key); a.xUseItem({ x: 4, y: 71, z: 3, id: 240 }, G.inv[0], X.fortress_key); assert.equal(a.getBlock(3, 70, 3), 0, 'key opens the connected bars'); assert.equal(a.getBlock(5, 72, 3), 0);
a.setBlock(2, 69, 2, 211); a.setBlock(2, 70, 2, 212); a.setBlock(3, 69, 2, 211); a.setBlock(3, 70, 2, 212);
hold(X.super_fertilizer); a.xUseItem({ x: 2, y: 69, z: 2, px: 2, py: 70, pz: 2, id: 211 }, G.inv[0], X.super_fertilizer); assert.equal(a.getBlock(3, 70, 2), 213, 'fertilizer ripens nearby crops');
// emberbloom only on nether ground
a.setBlock(6, 69, 6, 3); assert(!a.tryPlace({ x: 6, y: 69, z: 6, px: 6, py: 70, pz: 6, id: 3 }, a.EMBERBLOOM)); a.setBlock(6, 69, 6, 92); assert(a.tryPlace({ x: 6, y: 69, z: 6, px: 6, py: 70, pz: 6, id: 92 }, a.EMBERBLOOM));
console.log('Bandage, teas, antidote, charms, magnet, pocket workbench, memory crystal, fortress key, fertilizer and Emberbloom placement passed.');

// ── daggers strike harder from behind, hammers knock back further ──
const hit = (weapon, behind) => { a.W.mobs.length = 0; const m = a.spawnMob('zombie', 0.5, 70, -1.5); m.yaw = behind ? 0 : Math.PI; /* yaw 0 faces -z, away from the player */ hold(weapon); P.atkT = 9; P.vy = 0; P.onGround = true; const hp = m.hp; a.attack(m); return [hp - m.hp, Math.hypot(m.vx || 0, m.vz || 0)]; };
const [front] = hit(X.iron_dagger, false), [back] = hit(X.iron_dagger, true);
assert(back > front * 1.8, 'dagger backstab ' + front + ' -> ' + back);
const [, kbSword] = hit(276 + 2, false), [, kbHammer] = hit(X.iron_hammer, false);
assert(kbHammer > kbSword * 1.5, 'hammer knockback ' + kbSword + ' -> ' + kbHammer);
console.log('Dagger backstab (' + front + ' → ' + back + ') and hammer knockback passed.');

// ── fortress rooms (new worlds) ──
a.W.dimension = 'nether'; a.W.mods = new Map(); a.W.chunks.clear(); a.W.te.clear();
// the fortress at x=256 has every room; the one at the origin skips the vault because the arrival chamber is below it
const FX = 256;
for (let cz = -4; cz <= 3; cz++) for (let cx = 12; cx <= 19; cx++) a.W.chunks.set(cx + ',' + cz, a.generateChunk(cx, cz));
const chestTables = {}; let spawners = []; let bloom = 0, lava = 0, barsGate = 0;
for (const [k, te] of a.W.te) { const [x, y, z] = k.split(',').map(Number); if (te.type === 'chest') chestTables[k] = te; if (te.type === 'spawner') spawners.push(te.mob); }
for (let z = -50; z <= 50; z++) for (let x = -50; x <= 50; x++) for (let y = 52; y <= 70; y++) { const id = a.getBlock(FX + x, y, z); if (id === a.EMBERBLOOM) bloom++; if (id === 191 && Math.abs(x) <= 1 && Math.abs(z) <= 1 && y === 64) lava++; if (id === 240 && z === -2 && y >= 54 && y <= 58) barsGate++; }
assert(Object.keys(chestTables).length >= 10, 'fortress chests: ' + Object.keys(chestTables).length);
assert(Object.values(chestTables).every(te => te.slots.some(Boolean)), 'every fortress chest has loot');
assert(Object.values(chestTables).some(te => te.slots.some(s => s && s.id === X.fortress_key)), 'the guard post holds a fortress key');
assert(spawners.includes('blaze') && spawners.includes('wither_skeleton'), 'blaze and wither skeleton spawners: ' + spawners);
assert(bloom >= 20, 'emberbloom in the greenhouse and hall: ' + bloom);
assert.equal(lava, 8, 'lava fountain around the centre pillar');
assert.equal(barsGate, 13 * 5, 'vault gate of iron bars');
// the stairway from the hall floor (y 63) down to the vault floor (y 53) climbs one block per step
for (let k = 1; k <= 10; k++) { const x = FX - 5 + k, top = 63 - k; assert.equal(a.getBlock(x, top, 7), 66, 'step ' + k); assert.equal(a.getBlock(x, top + 1, 7), 0); assert.equal(a.getBlock(x, top + 2, 7), 0); }
for (let x = 10; x <= 45; x++) assert.equal(a.getBlock(FX + x, 63, 0), 66, 'bridge deck at ' + x);
// origin: hall present, arrival chamber and return portal untouched
a.W.chunks.clear(); a.W.te.clear();
for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) a.W.chunks.set(cx + ',' + cz, a.generateChunk(cx, cz));
let portal = 0; for (let y = 49; y <= 52; y++) for (const x of [-1, 0]) if (a.getBlock(x, y, 4) === 188) portal++;
assert.equal(portal, 8, 'return portal intact'); assert.equal(a.getBlock(-2, 53, 4), 57); assert.equal(a.getBlock(3, 53, 0), 0, 'arrival chamber stays open');
assert.equal(a.getBlock(0, 74, 0), 38, 'origin hall ceiling light (glowstone)');
console.log('Fortress: ' + Object.keys(chestTables).length + ' chests, spawners ' + [...new Set(spawners)].join('/') + ', ' + bloom + ' emberblooms, lava fountain, vault gate and stairway passed.');
// older worlds keep their plain fortress
a.W.gen = 3; a.W.chunks.clear(); a.W.te.clear(); const old = a.generateChunk(0, 0); let oldChest = 0, oldBloom = 0; for (const id of old.blocks) { if (id === 18) oldChest++; if (id === a.EMBERBLOOM) oldBloom++; }
assert.equal(oldChest + oldBloom, 0, 'gen 3 nether has no new rooms'); a.W.gen = undefined;
console.log('Older worlds keep the original fortress.');
