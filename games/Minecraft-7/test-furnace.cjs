// Furnace rules (original game timings) and the touch long-press "use" for food, bows, spyglass and shield.
// Run: node test-furnace.cjs game.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.argv[2], 'utf8').replace('window.GameHub.registerGame({', `window.api={init(){buildAtlas();prepareBlockTables();SAVE={settings:{particles:0}};toast=()=>{};sfx=()=>{};invChanged=()=>{};
W={seed:1,noise:makeNoise(1),noise2:makeNoise(2),mods:new Map(),chunks:new Map(),te:new Map(),fluidQ:new Set(),gravQ:new Set(),mobs:[],items:[],particles:[]};
G={mode:'survival',stats:{},inv:Array(36).fill(null),armor:Array(4).fill(null),off:null,sel:0,ui:null};P={x:0,y:70,z:0,hunger:10,dead:false};},
furnaceTick,holdToUse,FUEL,SMELT,SMELT_TIME,FURNACE,SMOKER,BLAST_FURNACE,COAL,RAW_IRON,IRON,BEEF,STEAK,PLANKS,LAVA_BUCKET,BUCKET,BOW,ARROW,SHIELD,PICK0,COBBLE,STONE,SAND,GLASS,FARMLAND,CARROT,
get G(){return G},get P(){return P}};window.GameHub.registerGame({`);
const c = { console, Uint8Array, Uint8ClampedArray, Math, window: { GameHub: { registerGame() {} } }, document: { createElement() { return { getContext() { return { createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData() {} }; } }; } } };
vm.runInNewContext(src, c, { timeout: 60000 }); const a = c.window.api; a.init();

const S = (id, count) => ({ id, count, dmg: 0 });
const furnace = (block, inp, fuel, out = null) => ({ type: 'furnace', block, slots: [inp, fuel, out], burn: 0, burnMax: 0, cook: 0 });
const run = (te, seconds) => { for (let i = 0; i < Math.round(seconds * 20); i++) if (te.burn > 0 || te.slots[0]) a.furnaceTick('0,0,0', te); };

assert.equal(a.SMELT_TIME, 10); assert.equal(a.FUEL[a.COAL], 80); assert.equal(a.FUEL[a.PLANKS], 15);
// one coal cooks 8 items in 80 s
{ const te = furnace(a.FURNACE, S(a.RAW_IRON, 9), S(a.COAL, 1)); run(te, 80.5); assert.equal(te.slots[2].count, 8); assert.equal(te.slots[0].count, 1); assert.equal(te.slots[1], null); assert.equal(te.burn, 0); }
// the 1st item is ready after 10 s, not before
{ const te = furnace(a.FURNACE, S(a.RAW_IRON, 2), S(a.COAL, 1)); run(te, 9.9); assert.equal(te.slots[2], null); run(te, 0.15); assert.equal(te.slots[2].count, 1); }
// smoker: food only, twice as fast, fuel burns twice as fast → still 8 per coal
{ const te = furnace(a.SMOKER, S(a.BEEF, 9), S(a.COAL, 1)); run(te, 40.5); assert.equal(te.slots[2].id, a.STEAK); assert.equal(te.slots[2].count, 8); assert.equal(te.burn, 0); }
{ const te = furnace(a.SMOKER, S(a.RAW_IRON, 4), S(a.COAL, 1)); run(te, 20); assert.equal(te.slots[2], null); assert.equal(te.slots[1].count, 1, 'smoker does not burn fuel for ores'); }
// blast furnace: ores only
{ const te = furnace(a.BLAST_FURNACE, S(a.RAW_IRON, 3), S(a.COAL, 1)); run(te, 15.1); assert.equal(te.slots[2].count, 3); }
{ const te = furnace(a.BLAST_FURNACE, S(a.SAND, 3), S(a.COAL, 1)); run(te, 20); assert.equal(te.slots[2], null); assert.equal(te.slots[1].count, 1); }
// planks: 1.5 items each
{ const te = furnace(a.FURNACE, S(a.COBBLE, 5), S(a.PLANKS, 2)); run(te, 40); assert.equal(te.slots[2].count, 3); assert.equal(te.slots[2].id, a.STONE); }
// lava bucket burns 1000 s and leaves the empty bucket
{ const te = furnace(a.FURNACE, S(a.SAND, 64), S(a.LAVA_BUCKET, 1)); run(te, 1); assert.equal(te.slots[1].id, a.BUCKET); }
// fuel is not used without input or when the output is full
{ const te = furnace(a.FURNACE, null, S(a.COAL, 3)); run(te, 5); assert.equal(te.slots[1].count, 3); }
{ const te = furnace(a.FURNACE, S(a.SAND, 5), S(a.COAL, 3), S(a.GLASS, 64)); run(te, 5); assert.equal(te.slots[1].count, 3); assert.equal(te.burn, 0); }
// lit fuel keeps burning after the input is taken out; progress restarts when the input changes
{ const te = furnace(a.FURNACE, S(a.SAND, 1), S(a.COAL, 1)); run(te, 5); te.slots[0] = null; run(te, 10); assert(Math.abs(te.burn - 65) < 0.1, 'burn ' + te.burn); te.slots[0] = S(a.COBBLE, 1); run(te, 5); te.slots[0] = S(a.SAND, 1); a.furnaceTick('0,0,0', te); assert(te.cook < 0.1, 'progress reset ' + te.cook); }
console.log('Furnace: 10 s per item, 8 per coal, smoker/blast furnace speed and filters, planks, lava bucket, idle fuel, burn-down and progress reset passed.');

// touch long-press uses food / bow / shield instead of mining
const G = a.G, P = a.P;
G.inv[0] = S(a.STEAK, 3); assert(a.holdToUse(), 'hold to eat');
P.hunger = 20; assert(!a.holdToUse(), 'full: hold mines'); P.hunger = 10;
G.mode = 'creative'; assert(!a.holdToUse()); G.mode = 'survival';
G.inv[0] = S(a.PICK0, 1); assert(!a.holdToUse(), 'pickaxe mines');
G.inv[0] = S(a.BOW, 1); assert(!a.holdToUse(), 'bow without arrows'); G.inv[5] = S(a.ARROW, 4); assert(a.holdToUse(), 'bow with arrows');
G.inv[0] = null; G.off = S(a.SHIELD, 1); assert(a.holdToUse(), 'off-hand shield with an empty main hand');
G.inv[0] = S(a.PICK0, 1); assert(!a.holdToUse(), 'pickaxe in main hand wins');
console.log('Touch: long-press eats, draws the bow and raises the shield; tools still mine.');
