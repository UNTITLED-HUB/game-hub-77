// ─────────────────────────── content update: new blocks, items, recipes ───────────────────────────
// Block ids 200–254 (chunk storage is one byte per block), item ids from 420 upward.
const PURPUR=200, PURPUR_PILLAR=201, END_ROD=202, IRON_BLOCK=203, GOLD_BLOCK=204, DIAMOND_BLOCK=205, EMERALD_BLOCK=206, LAPIS_BLOCK=207,
  COAL_BLOCK=208, REDSTONE_BLOCK=209, HAY_BALE=210, FARMLAND=211, WHEAT_CROP=212, WHEAT_RIPE=213, DIRT_PATH=214, LANTERN=215, SMOOTH_STONE=216,
  OAK_SLAB=217, COBBLE_SLAB=218, STONE_BRICK_SLAB=219, SANDSTONE_SLAB=220, SPRUCE_PLANKS=221, SPRUCE_SLAB=222, SMOKER=223, BLAST_FURNACE=224,
  SMITHING_TABLE=225, FLETCHING_TABLE=226, LOOM=227, COMPOSTER=228, CARTOGRAPHY_TABLE=229, CORNFLOWER=230, ALLIUM=231, BLUE_ORCHID=232,
  LILY_VALLEY=233, BROWN_MUSHROOM=234, RED_MUSHROOM=235, SUGAR_CANE=236, FERN=237, CARROT_CROP=238, POTATO_CROP=239, IRON_BARS=240, COBWEB=241,
  CHISELED_SB=242, SPAWNER=243, RAW_IRON_BLOCK=244, GILDED_BLACKSTONE=245, JACK_O_LANTERN=246, CARVED_PUMPKIN=247, STRIPPED_LOG=248,
  NOTE_BLOCK=249, JUKEBOX=250, ENCHANT_TABLE=251, SLIME_BLOCK=252, BELL=253, SNOW_LAYER=254;
// existing generated block groups
const CONCRETE=BULK_BLOCK_START, POWDER=BULK_BLOCK_START+16, TERRA_C=BULK_BLOCK_START+32, GLAZED=BULK_BLOCK_START+48;
const CRACKED_SB=BULK_BLOCK_START+69, MOSSY_SB=BULK_BLOCK_START+70, SMOOTH_SANDSTONE=BULK_BLOCK_START+73, END_BRICKS=BULK_BLOCK_START+78, POLISHED_BLACKSTONE=BULK_BLOCK_START+76, BLACKSTONE_BRICKS=BULK_BLOCK_START+77;
const WHEAT=BULK_ITEM_START, EGG=BULK_ITEM_START+1, FEATHER=BULK_ITEM_START+2, BONE=BULK_ITEM_START+3, BONE_MEAL=BULK_ITEM_START+4, GUNPOWDER=BULK_ITEM_START+5,
  SLIMEBALL=BULK_ITEM_START+6, ENDER_PEARL=BULK_ITEM_START+7, BLAZE_ROD=BULK_ITEM_START+8, BLAZE_POWDER=BULK_ITEM_START+9, GHAST_TEAR=BULK_ITEM_START+10,
  SPIDER_EYE=BULK_ITEM_START+11, SUGAR=BULK_ITEM_START+12, PAPER=BULK_ITEM_START+13, BOOK=BULK_ITEM_START+14, CLAY_BALL=BULK_ITEM_START+15,
  PUFFERFISH=BULK_ITEM_START+21, COOKIE=BULK_ITEM_START+24, PUMPKIN_PIE=BULK_ITEM_START+25, MUSHROOM_STEW=BULK_ITEM_START+26, HONEY_BOTTLE=BULK_ITEM_START+27,
  MILK_BUCKET=BULK_ITEM_START+28, SNOWBALL=BULK_ITEM_START+29, BRICK_ITEM=BULK_ITEM_START+30;

const RAW_IRON=420, RAW_GOLD=421, RAW_COPPER=422, CHARCOAL=423, IRON_NUGGET=424, GOLD_NUGGET=425, WHEAT_SEEDS=426, BEETROOT_SEEDS=427,
  PUMPKIN_SEEDS=428, MELON_SEEDS=429, GOLDEN_CARROT=430, SWEET_BERRIES=431, GLOW_BERRIES=432, RABBIT=433, COOKED_RABBIT=434, RABBIT_STEW=435,
  BEETROOT_SOUP=436, DRIED_KELP=437, HONEYCOMB=438, INK_SAC=439, GLOW_INK=440, NAME_TAG=441, LEAD=442, SADDLE=443, FIREWORK=444,
  FIRE_CHARGE=445, TRIDENT=446, MACE=447, SPYGLASS=448, RECOVERY_COMPASS=449, PHANTOM_MEMBRANE=450, NAUTILUS=451, HEART_SEA=452,
  SHULKER_SHELL=453, DRAGON_BREATH=454, CHORUS_FRUIT=455, POPPED_CHORUS=456, ECHO_SHARD=457, RABBIT_HIDE=458, RABBIT_FOOT=459,
  MAGMA_CREAM=460, FERM_EYE=461, GLIST_MELON=462, NETHER_WART=463, GLOW_DUST=464, PRIS_CRYSTAL=465, BOWL=466, POISON_POTATO=467,
  HOE0=468, // 468..473 wood, stone, iron, gold, diamond, netherite
  STRENGTH_POTION=474, NIGHT_POTION=475, INVIS_POTION=476, REGEN_POTION=477, WATER_POTION=478, SLOWFALL_POTION=479, LEAP_POTION=480,
  ENCH_GOLDEN_APPLE=481, DYE0=482; // 482..497 sixteen dyes
const DYE_COLORS=[[249,255,254],[249,128,29],[199,78,189],[58,179,218],[254,216,61],[128,199,31],[243,139,170],[71,79,82],[157,157,151],[22,156,156],[137,50,184],[60,68,170],[131,84,50],[94,124,22],[176,46,38],[29,29,33]];
const DYE_EN=['White','Orange','Magenta','Light Blue','Yellow','Lime','Pink','Gray','Light Gray','Cyan','Purple','Blue','Brown','Green','Red','Black'];

// ── blocks ──
const slab = { opaque: false, render: 'bed', height: 0.5 };
const cropBase = Object.assign({}, plant, { needsFarm: true, needsSoil: false, cat: '장식' });
[
 [PURPUR,'퍼퍼 블록','c_purpur',{hard:1.5,tool:'pickaxe',tier:1,en:'Purpur Block'}],
 [PURPUR_PILLAR,'퍼퍼 기둥',{top:'c_purpur_top',bottom:'c_purpur_top',side:'c_purpur_pillar'},{hard:1.5,tool:'pickaxe',tier:1,en:'Purpur Pillar'}],
 [END_ROD,'엔드 막대','c_end_rod',{solid:false,opaque:false,render:'torch',hard:0,light:14,cat:'장식',needsFloor:true,en:'End Rod'}],
 [IRON_BLOCK,'철 블록','c_iron_block',{hard:5,tool:'pickaxe',tier:2,en:'Block of Iron'}],
 [GOLD_BLOCK,'금 블록','c_gold_block',{hard:3,tool:'pickaxe',tier:3,en:'Block of Gold'}],
 [DIAMOND_BLOCK,'다이아몬드 블록','c_diamond_block',{hard:5,tool:'pickaxe',tier:3,en:'Block of Diamond'}],
 [EMERALD_BLOCK,'에메랄드 블록','c_emerald_block',{hard:5,tool:'pickaxe',tier:3,en:'Block of Emerald'}],
 [LAPIS_BLOCK,'청금석 블록','c_lapis_block',{hard:3,tool:'pickaxe',tier:2,en:'Block of Lapis Lazuli'}],
 [COAL_BLOCK,'석탄 블록','c_coal_block',{hard:5,tool:'pickaxe',tier:1,en:'Block of Coal'}],
 [REDSTONE_BLOCK,'레드스톤 블록','c_redstone_block',{hard:5,tool:'pickaxe',tier:1,light:7,en:'Block of Redstone'}],
 [HAY_BALE,'건초 더미',{top:'c_hay_top',bottom:'c_hay_top',side:'c_hay_side'},{hard:0.5,tool:'hoe',cat:'블록',en:'Hay Bale'}],
 [FARMLAND,'경작지',{top:'c_farmland',bottom:'dirt',side:'dirt'},{opaque:false,render:'bed',height:15/16,hard:0.6,tool:'shovel',drop:DIRT,cat:'블록',en:'Farmland'}],
 [WHEAT_CROP,'밀 작물','c_wheat0',Object.assign({},cropBase,{use:'crop',drop:()=>WHEAT_SEEDS,creative:false,en:'Wheat Crops'})],
 [WHEAT_RIPE,'다 자란 밀','c_wheat7',Object.assign({},cropBase,{drop:()=>WHEAT,extraDrop:[[WHEAT_SEEDS,0,3]],en:'Ripe Wheat'})],
 [DIRT_PATH,'흙길',{top:'c_path_top',bottom:'dirt',side:'c_path_side'},{opaque:false,render:'bed',height:15/16,hard:0.65,tool:'shovel',drop:DIRT,cat:'블록',en:'Dirt Path'}],
 [LANTERN,'랜턴','c_lantern',Object.assign({},plant,{light:15,needsFloor:true,hard:3.5,tool:'pickaxe',cat:'장식',en:'Lantern'})],
 [SMOOTH_STONE,'매끄러운 돌','c_smooth_stone',{hard:2,tool:'pickaxe',tier:1,en:'Smooth Stone'}],
 [OAK_SLAB,'참나무 반 블록','planks',Object.assign({},slab,{hard:2,tool:'axe',en:'Oak Slab'})],
 [COBBLE_SLAB,'조약돌 반 블록','cobble',Object.assign({},slab,{hard:2,tool:'pickaxe',tier:1,en:'Cobblestone Slab'})],
 [STONE_BRICK_SLAB,'석재 벽돌 반 블록','stone_bricks',Object.assign({},slab,{hard:1.5,tool:'pickaxe',tier:1,en:'Stone Brick Slab'})],
 [SANDSTONE_SLAB,'사암 반 블록',{top:'sandstone_top',bottom:'sandstone_top',side:'sandstone_side'},Object.assign({},slab,{hard:0.8,tool:'pickaxe',tier:1,en:'Sandstone Slab'})],
 [SPRUCE_PLANKS,'가문비나무 판자','c_spruce_planks',{hard:2,tool:'axe',en:'Spruce Planks'}],
 [SPRUCE_SLAB,'가문비나무 반 블록','c_spruce_planks',Object.assign({},slab,{hard:2,tool:'axe',en:'Spruce Slab'})],
 [SMOKER,'훈연기',{top:'c_smoker_top',bottom:'c_smoker_top',side:'c_smoker_side',front:'c_smoker_front'},{hard:3.5,tool:'pickaxe',tier:1,use:'furnace',facing:true,cat:'기능',en:'Smoker'}],
 [BLAST_FURNACE,'용광로',{top:'c_blast_top',bottom:'c_blast_top',side:'c_blast_side',front:'c_blast_front'},{hard:3.5,tool:'pickaxe',tier:1,use:'furnace',facing:true,cat:'기능',en:'Blast Furnace'}],
 [SMITHING_TABLE,'대장장이 작업대',{top:'c_smith_top',bottom:'c_smith_bottom',side:'c_smith_side'},{hard:2.5,tool:'axe',use:'table',cat:'기능',en:'Smithing Table'}],
 [FLETCHING_TABLE,'화살 작업대',{top:'c_fletch_top',bottom:'birch_planks',side:'c_fletch_side'},{hard:2.5,tool:'axe',cat:'기능',en:'Fletching Table'}],
 [LOOM,'베틀',{top:'c_loom_top',bottom:'planks',side:'c_loom_side'},{hard:2.5,tool:'axe',cat:'기능',en:'Loom'}],
 [COMPOSTER,'퇴비통',{top:'c_composter_top',bottom:'planks',side:'c_composter_side'},{hard:0.6,tool:'axe',cat:'기능',en:'Composter'}],
 [CARTOGRAPHY_TABLE,'지도 제작대',{top:'c_carto_top',bottom:'dark_oak_planks',side:'c_carto_side'},{hard:2.5,tool:'axe',cat:'기능',en:'Cartography Table'}],
 [CORNFLOWER,'수레국화','c_cornflower',Object.assign({},plant,{needsSoil:true,en:'Cornflower'})],
 [ALLIUM,'파꽃','c_allium',Object.assign({},plant,{needsSoil:true,en:'Allium'})],
 [BLUE_ORCHID,'파란 난초','c_blue_orchid',Object.assign({},plant,{needsSoil:true,en:'Blue Orchid'})],
 [LILY_VALLEY,'은방울꽃','c_lily',Object.assign({},plant,{needsSoil:true,en:'Lily of the Valley'})],
 [BROWN_MUSHROOM,'갈색 버섯','c_brown_mushroom',Object.assign({},plant,{needsFloor:true,light:1,en:'Brown Mushroom'})],
 [RED_MUSHROOM,'빨간 버섯','c_red_mushroom',Object.assign({},plant,{needsFloor:true,en:'Red Mushroom'})],
 [SUGAR_CANE,'사탕수수','c_sugar_cane',Object.assign({},plant,{needsSand:true,en:'Sugar Cane'})],
 [FERN,'고사리','c_fern',Object.assign({},plant,{replaceable:true,needsSoil:true,drop:r=>r()<0.125?WHEAT_SEEDS:0,en:'Fern'})],
 [CARROT_CROP,'당근 작물','c_carrot_crop',Object.assign({},cropBase,{drop:()=>CARROT,dropCount:r=>r()<0.4?1:2,en:'Carrots'})],
 [POTATO_CROP,'감자 작물','c_potato_crop',Object.assign({},cropBase,{drop:r=>r()<0.03?POISON_POTATO:POTATO,dropCount:r=>r()<0.4?1:2,en:'Potatoes'})],
 [IRON_BARS,'철창','c_iron_bars',{opaque:false,render:'cutout',hard:5,tool:'pickaxe',tier:1,cat:'장식',en:'Iron Bars'}],
 [COBWEB,'거미줄','c_cobweb',Object.assign({},plant,{hard:4,tool:'sword',drop:()=>STRING,web:true,en:'Cobweb'})],
 [CHISELED_SB,'조각된 석재 벽돌','c_chiseled_sb',{hard:1.5,tool:'pickaxe',tier:1,en:'Chiseled Stone Bricks'}],
 [SPAWNER,'몬스터 생성기','c_spawner',{opaque:false,render:'cutout',hard:5,tool:'pickaxe',tier:1,drop:0,cat:'기능',en:'Monster Spawner'}],
 [RAW_IRON_BLOCK,'철 원석 블록','c_raw_iron_block',{hard:5,tool:'pickaxe',tier:2,en:'Block of Raw Iron'}],
 [GILDED_BLACKSTONE,'금박 흑암','c_gilded',{hard:1.5,tool:'pickaxe',tier:1,drop:r=>r()<0.1?GOLD_NUGGET:GILDED_BLACKSTONE,dropCount:()=>1,en:'Gilded Blackstone'}],
 [JACK_O_LANTERN,'잭 오 랜턴',{top:'pumpkin_top',bottom:'pumpkin_top',side:'pumpkin_side',front:'c_jack_front'},{hard:1,tool:'axe',light:15,facing:true,cat:'장식',en:"Jack o'Lantern"}],
 [CARVED_PUMPKIN,'조각된 호박',{top:'pumpkin_top',bottom:'pumpkin_top',side:'pumpkin_side',front:'c_carved_front'},{hard:1,tool:'axe',facing:true,cat:'장식',en:'Carved Pumpkin'}],
 [STRIPPED_LOG,'벗긴 참나무 원목',{top:'c_stripped_top',bottom:'c_stripped_top',side:'c_stripped_side'},{hard:2,tool:'axe',en:'Stripped Oak Log'}],
 [NOTE_BLOCK,'소리 블록','c_note',{hard:0.8,tool:'axe',use:'note',cat:'기능',en:'Note Block'}],
 [JUKEBOX,'주크박스',{top:'c_jukebox_top',bottom:'c_note',side:'c_note'},{hard:2,tool:'axe',cat:'기능',en:'Jukebox'}],
 [ENCHANT_TABLE,'마법 부여대',{top:'c_ench_top',bottom:'obsidian',side:'c_ench_side'},{opaque:false,render:'bed',height:0.75,hard:5,tool:'pickaxe',tier:1,light:7,cat:'기능',en:'Enchanting Table'}],
 [SLIME_BLOCK,'슬라임 블록','c_slime',{opaque:false,render:'translucent',hard:0,bouncy:true,cat:'기능',en:'Slime Block'}],
 [BELL,'종','c_bell',Object.assign({},plant,{hard:5,tool:'pickaxe',use:'bell',needsFloor:true,cat:'기능',en:'Bell'})],
 [SNOW_LAYER,'눈 층','snow',{opaque:false,render:'bed',height:2/16,hard:0.1,tool:'shovel',replaceable:true,drop:()=>SNOWBALL,cat:'장식',en:'Snow'}],
].forEach(([id,name,tex,o])=>B(id,name,tex,o));
// modern ore drops: raw metal instead of the ore block
BLOCK[IRON_ORE].drop=RAW_IRON;BLOCK[GOLD_ORE].drop=RAW_GOLD;BLOCK[COPPER_ORE].drop=RAW_COPPER;BLOCK[DEEP_IRON].drop=RAW_IRON;BLOCK[DEEP_GOLD].drop=RAW_GOLD;
BLOCK[COPPER_ORE].tier=2;
BLOCK[TALL_GRASS].drop=r=>r()<0.125?WHEAT_SEEDS:0;

// ── items ──
const food=(f,o={})=>Object.assign({cat:'음식',food:f},o);
[
 [RAW_IRON,'철 원석','c_raw_iron',{en:'Raw Iron'}],[RAW_GOLD,'금 원석','c_raw_gold',{en:'Raw Gold'}],[RAW_COPPER,'구리 원석','c_raw_copper',{en:'Raw Copper'}],
 [CHARCOAL,'숯','c_charcoal',{en:'Charcoal'}],[IRON_NUGGET,'철 조각','c_iron_nugget',{en:'Iron Nugget'}],[GOLD_NUGGET,'금 조각','c_gold_nugget',{en:'Gold Nugget'}],
 [WHEAT_SEEDS,'밀 씨앗','c_wheat_seeds',{plant:WHEAT_CROP,en:'Wheat Seeds'}],[BEETROOT_SEEDS,'비트 씨앗','c_beet_seeds',{en:'Beetroot Seeds'}],
 [PUMPKIN_SEEDS,'호박 씨앗','c_pumpkin_seeds',{en:'Pumpkin Seeds'}],[MELON_SEEDS,'수박 씨앗','c_melon_seeds',{en:'Melon Seeds'}],
 [GOLDEN_CARROT,'황금 당근','c_golden_carrot',food([6,14.4],{en:'Golden Carrot'})],[SWEET_BERRIES,'달콤한 열매','c_sweet_berries',food([2,0.4],{en:'Sweet Berries'})],
 [GLOW_BERRIES,'발광 열매','c_glow_berries',food([2,0.4],{en:'Glow Berries'})],[RABBIT,'익히지 않은 토끼고기','c_rabbit',food([3,1.8],{en:'Raw Rabbit'})],
 [COOKED_RABBIT,'익힌 토끼고기','c_cooked_rabbit',food([5,6],{en:'Cooked Rabbit'})],[RABBIT_STEW,'토끼 스튜','c_rabbit_stew',food([10,12],{stack:1,bowl:true,en:'Rabbit Stew'})],
 [BEETROOT_SOUP,'비트 수프','c_beet_soup',food([6,7.2],{stack:1,bowl:true,en:'Beetroot Soup'})],[DRIED_KELP,'말린 켈프','c_dried_kelp',food([1,0.6],{en:'Dried Kelp'})],
 [HONEYCOMB,'벌집 조각','c_honeycomb',{en:'Honeycomb'}],[INK_SAC,'먹물 주머니','c_ink_sac',{en:'Ink Sac'}],[GLOW_INK,'발광 먹물 주머니','c_glow_ink',{en:'Glow Ink Sac'}],
 [NAME_TAG,'이름표','c_name_tag',{cat:'도구',en:'Name Tag'}],[LEAD,'끈','c_lead',{cat:'도구',en:'Lead'}],[SADDLE,'안장','c_saddle',{stack:1,cat:'도구',en:'Saddle'}],
 [FIREWORK,'폭죽 로켓','c_firework',{cat:'도구',en:'Firework Rocket'}],[FIRE_CHARGE,'화염구','c_fire_charge',{cat:'도구',en:'Fire Charge'}],
 [TRIDENT,'삼지창','c_trident',{stack:1,cat:'전투',tool:{kind:'trident',level:0,speed:1,dur:250,dmg:9,aspd:1.1},en:'Trident'}],
 [MACE,'철퇴','c_mace',{stack:1,cat:'전투',tool:{kind:'mace',level:0,speed:1,dur:500,dmg:6,aspd:0.6},en:'Mace'}],
 [SPYGLASS,'망원경','c_spyglass',{stack:1,cat:'도구',en:'Spyglass'}],[RECOVERY_COMPASS,'회복 나침반','c_recovery',{stack:1,cat:'도구',gadget:'recovery',en:'Recovery Compass'}],
 [PHANTOM_MEMBRANE,'팬텀 막','c_membrane',{en:'Phantom Membrane'}],[NAUTILUS,'앵무조개 껍데기','c_nautilus',{en:'Nautilus Shell'}],[HEART_SEA,'바다의 심장','c_heart_sea',{en:'Heart of the Sea'}],
 [SHULKER_SHELL,'셜커 껍데기','c_shulker_shell',{en:'Shulker Shell'}],[DRAGON_BREATH,'드래곤의 숨결','c_dragon_breath',{en:"Dragon's Breath"}],
 [CHORUS_FRUIT,'후렴과','c_chorus',food([4,2.4],{teleport:true,en:'Chorus Fruit'})],[POPPED_CHORUS,'튀긴 후렴과','c_popped_chorus',{en:'Popped Chorus Fruit'}],
 [ECHO_SHARD,'메아리 조각','c_echo',{en:'Echo Shard'}],[RABBIT_HIDE,'토끼 가죽','c_rabbit_hide',{en:'Rabbit Hide'}],[RABBIT_FOOT,'토끼발','c_rabbit_foot',{en:"Rabbit's Foot"}],
 [MAGMA_CREAM,'마그마 크림','c_magma_cream',{en:'Magma Cream'}],[FERM_EYE,'발효된 거미 눈','c_ferm_eye',{en:'Fermented Spider Eye'}],
 [GLIST_MELON,'반짝이는 수박 조각','c_glist_melon',{en:'Glistering Melon Slice'}],[NETHER_WART,'네더 사마귀','c_nether_wart',{en:'Nether Wart'}],
 [GLOW_DUST,'발광석 가루','c_glow_dust',{en:'Glowstone Dust'}],[PRIS_CRYSTAL,'프리즈머린 수정','c_pris_crystal',{en:'Prismarine Crystals'}],
 [BOWL,'그릇','c_bowl',{en:'Bowl'}],[POISON_POTATO,'독이 있는 감자','c_poison_potato',food([2,1.2],{poison:0.6,en:'Poisonous Potato'})],
 [ENCH_GOLDEN_APPLE,'마법이 부여된 황금 사과','c_ench_apple',food([4,9.6],{effects:[['regeneration',20,1],['resistance',300,0],['fire_resistance',300,0]],en:'Enchanted Golden Apple'})],
].forEach(([id,name,icon,o])=>I(id,name,icon,o));
const HOE_TIERS=[['나무',59,2,'Wooden'],['돌',131,4,'Stone'],['철',250,6,'Iron'],['금',32,12,'Golden'],['다이아몬드',1561,8,'Diamond'],['네더라이트',2031,9,'Netherite']];
HOE_TIERS.forEach(([n,dur,speed,en],i)=>I(HOE0+i,n+' 괭이','c_hoe_'+i,{stack:1,cat:'도구',tool:{kind:'hoe',level:i===5?5:[1,2,3,1,4][i],speed,dur,dmg:1,aspd:[1,2,3,1,4,4][i]},en:en+' Hoe'}));
[[STRENGTH_POTION,'힘의 물약','strength',[230,180,40],'Potion of Strength'],[NIGHT_POTION,'야간 투시의 물약','night_vision',[40,60,200],'Potion of Night Vision'],
 [INVIS_POTION,'투명화의 물약','invisibility',[180,190,200],'Potion of Invisibility'],[REGEN_POTION,'재생의 물약','regeneration',[220,100,180],'Potion of Regeneration'],
 [WATER_POTION,'수중 호흡의 물약','water_breathing',[60,120,220],'Potion of Water Breathing'],[SLOWFALL_POTION,'느린 낙하의 물약','slow_falling',[240,230,200],'Potion of Slow Falling'],
 [LEAP_POTION,'도약의 물약','jump_boost',[120,230,80],'Potion of Leaping']].forEach(([id,name,effect,col,en])=>I(id,name,'c_potion_'+effect,{stack:1,cat:'음식',potion:{effect,time:180},pcol:col,en}));
COLOR_NAMES.forEach((n,i)=>I(DYE0+i,n.replace(/색$/,'')+' 염료','c_dye_'+i,{en:DYE_EN[i]+' Dye'}));
ITEM[MUSHROOM_STEW].bowl=true; ITEM[HONEY_BOTTLE].bottle=true; ITEM[GOLDEN_APPLE].effects=[['regeneration',5,1]];
ITEM[MILK_BUCKET].milk=true; ITEM[ENDER_PEARL].pearl=true; ITEM[ENDER_PEARL].stack=16; ITEM[SNOWBALL].stack=16;
ITEM[BONE_MEAL].bonemeal=true; ITEM[CARROT].plant=CARROT_CROP; ITEM[POTATO].plant=POTATO_CROP; ITEM[FIREWORK].rocket=true; ITEM[FIRE_CHARGE].lighter=true;

// ── recipes ──
GROUP.planks.push(SPRUCE_PLANKS); GROUP.log.push(STRIPPED_LOG);
GROUP.slab=[OAK_SLAB,SPRUCE_SLAB];
RECIPES.unshift({items:[SPRUCE_LOG],out:SPRUCE_PLANKS,count:4},{items:[BIRCH_LOG],out:BIRCH_PLANKS,count:4});
const store=(item,block)=>{shaped(['XXX','XXX','XXX'],{X:item},block);shapeless([block],item,9);};
store(IRON,IRON_BLOCK);store(GOLD,GOLD_BLOCK);store(DIAMOND,DIAMOND_BLOCK);store(EMERALD,EMERALD_BLOCK);store(LAPIS,LAPIS_BLOCK);store(COAL,COAL_BLOCK);store(REDSTONE,REDSTONE_BLOCK);store(WHEAT,HAY_BALE);store(RAW_IRON,RAW_IRON_BLOCK);store(SLIMEBALL,SLIME_BLOCK);
shapeless([IRON],IRON_NUGGET,9);shaped(['XXX','XXX','XXX'],{X:IRON_NUGGET},IRON);shapeless([GOLD],GOLD_NUGGET,9);shaped(['XXX','XXX','XXX'],{X:GOLD_NUGGET},GOLD);
shaped(['K','S'],{K:CHARCOAL,S:STICK},TORCH,4);
shaped(['NNN','NCN','NNN'],{N:GOLD_NUGGET,C:CARROT},GOLDEN_CARROT);shaped(['NNN','NMN','NNN'],{N:GOLD_NUGGET,M:MELON_SLICE},GLIST_MELON);
shaped(['P P',' P '],{P:'planks'},BOWL,4);
shapeless([COOKED_RABBIT,CARROT,BAKED_POTATO,BROWN_MUSHROOM,BOWL],RABBIT_STEW);shapeless([BEETROOT,BEETROOT,BEETROOT,BEETROOT,BEETROOT,BEETROOT,BOWL],BEETROOT_SOUP);
shapeless([BROWN_MUSHROOM,RED_MUSHROOM,BOWL],MUSHROOM_STEW);
shapeless([PUMPKIN],PUMPKIN_SEEDS,4);shapeless([MELON_SLICE],MELON_SEEDS);shapeless([BEETROOT],BEETROOT_SEEDS);
shaped(['SS ','SB ','  S'],{S:STRING,B:SLIMEBALL},LEAD,2);shapeless([PAPER,GUNPOWDER],FIREWORK,3);shapeless([GUNPOWDER,BLAZE_POWDER,COAL],FIRE_CHARGE,3);
shaped([' A ',' C ',' C '],{A:AMETHYST_SHARD,C:COPPER_INGOT},SPYGLASS);shaped(['EEE','ECE','EEE'],{E:ECHO_SHARD,C:COMPASS},RECOVERY_COMPASS);
shapeless([ELYTRA,PHANTOM_MEMBRANE],ELYTRA);
shapeless([SPIDER_EYE,BROWN_MUSHROOM,SUGAR],FERM_EYE);shapeless([BLAZE_POWDER,SLIMEBALL],MAGMA_CREAM);shaped(['GG','GG'],{G:GLOW_DUST},GLOWSTONE);
shaped(['MM','MM'],{M:BULK_ITEM_START+30},BRICKS);shaped(['SS','SS'],{S:SNOWBALL},SNOW);shaped(['SSS'],{S:SNOW},SNOW_LAYER,6);
shaped(['CCC'],{C:SUGAR_CANE},PAPER,3);shapeless([SUGAR_CANE],SUGAR);shapeless([PAPER,PAPER,PAPER,LEATHER],BOOK);shapeless([BONE],BONE_MEAL,3);
shaped(['WCW'],{W:WHEAT,C:DYE0+12},COOKIE,8);
shapeless([PUMPKIN,SUGAR,EGG],PUMPKIN_PIE);
shaped(['PP','PP'],{P:POPPED_CHORUS},PURPUR,4);shaped(['P','P'],{P:PURPUR},PURPUR_PILLAR);shaped(['B','P'],{B:BLAZE_ROD,P:POPPED_CHORUS},END_ROD,4);
shaped(['XXX'],{X:PLANKS},OAK_SLAB,6);shaped(['XXX'],{X:COBBLE},COBBLE_SLAB,6);shaped(['XXX'],{X:STONE_BRICKS},STONE_BRICK_SLAB,6);shaped(['XXX'],{X:SANDSTONE},SANDSTONE_SLAB,6);shaped(['XXX'],{X:SPRUCE_PLANKS},SPRUCE_SLAB,6);
shaped(['S','S'],{S:STONE_BRICK_SLAB},CHISELED_SB);shapeless([STONE_BRICKS,BULK_ITEM_START+6],MOSSY_SB);
shaped([' L ','LFL',' L '],{L:'log',F:FURNACE},SMOKER);shaped(['III','IFI','SSS'],{I:IRON,F:FURNACE,S:SMOOTH_STONE},BLAST_FURNACE);
shaped(['II','PP','PP'],{I:IRON,P:'planks'},SMITHING_TABLE);shaped(['FF','PP','PP'],{F:FLINT,P:'planks'},FLETCHING_TABLE);shaped(['SS','PP'],{S:STRING,P:'planks'},LOOM);
shaped(['S S','S S','SSS'],{S:'slab'},COMPOSTER);shaped(['AA','PP','PP'],{A:PAPER,P:'planks'},CARTOGRAPHY_TABLE);
shaped(['NNN','NTN','NNN'],{N:IRON_NUGGET,T:TORCH},LANTERN);shaped(['III','III'],{I:IRON},IRON_BARS,16);
shapeless([CARVED_PUMPKIN,TORCH],JACK_O_LANTERN);shaped(['PPP','PRP','PPP'],{P:'planks',R:REDSTONE},NOTE_BLOCK);shaped(['PPP','PDP','PPP'],{P:'planks',D:DIAMOND},JUKEBOX);
shaped([' B ','DOD','OOO'],{B:BOOK,D:DIAMOND,O:OBSIDIAN},ENCHANT_TABLE);
shaped(['GGG','GAG','GGG'],{G:GOLD_BLOCK,A:APPLE},ENCH_GOLDEN_APPLE);
HOE_TIERS.forEach((_,i)=>{if(i<5)shaped(['MM',' S',' S'],{M:TIERS[i].mat,S:STICK},HOE0+i);});shapeless([HOE0+4,NETHERITE_INGOT],HOE0+5);
// simplified brewing: bottle + nether wart + ingredient
[[HEALING_POTION,GLIST_MELON],[SPEED_POTION,SUGAR],[FIRE_POTION,MAGMA_CREAM],[STRENGTH_POTION,BLAZE_POWDER],[NIGHT_POTION,GOLDEN_CARROT],[INVIS_POTION,FERM_EYE],
 [REGEN_POTION,GHAST_TEAR],[WATER_POTION,PUFFERFISH],[SLOWFALL_POTION,PHANTOM_MEMBRANE],[LEAP_POTION,RABBIT_FOOT]].forEach(([p,ing])=>shapeless([GLASS_BOTTLE,NETHER_WART,ing],p));
// dyes
const DYE=i=>DYE0+i;
[[FLOWER_RED,14],[FLOWER_YELLOW,4],[CORNFLOWER,11],[ALLIUM,2],[BLUE_ORCHID,3],[LILY_VALLEY,0],[BONE_MEAL,0],[INK_SAC,15],[LAPIS,11]].forEach(([s,d])=>shapeless([s],DYE(d)));
[[14,4,1],[14,0,6],[11,0,3],[15,0,7],[7,0,8],[11,13,9],[14,11,10],[10,6,2],[13,0,5]].forEach(([a,b,o])=>shapeless([DYE(a),DYE(b)],DYE(o),2));
for(let i=0;i<16;i++){shapeless([DYE(i),SAND,SAND,SAND,SAND,GRAVEL,GRAVEL,GRAVEL,GRAVEL],POWDER+i,8);shaped(['TTT','TDT','TTT'],{T:TERRACOTTA,D:DYE(i)},TERRA_C+i,8);SMELT[TERRA_C+i]=GLAZED+i;}
Object.assign(SMELT,{[RAW_IRON]:IRON,[RAW_GOLD]:GOLD,[RAW_COPPER]:COPPER_INGOT,[LOG]:CHARCOAL,[SPRUCE_LOG]:CHARCOAL,[BIRCH_LOG]:CHARCOAL,[CHERRY_LOG]:CHARCOAL,[DARK_OAK_LOG]:CHARCOAL,[MANGROVE_LOG]:CHARCOAL,[STRIPPED_LOG]:CHARCOAL,
 [CACTUS]:DYE(13),[RABBIT]:COOKED_RABBIT,[CHORUS_FRUIT]:POPPED_CHORUS,[STONE]:SMOOTH_STONE,[CLAY_BALL]:BRICK_ITEM,[SANDSTONE]:SMOOTH_SANDSTONE,[STONE_BRICKS]:CRACKED_SB,[DIAMOND_ORE]:DIAMOND,[DEEP_IRON]:IRON,[DEEP_GOLD]:GOLD,[NETHERRACK]:BULK_ITEM_START+31});
Object.assign(FUEL,{[CHARCOAL]:80,[COAL_BLOCK]:800,[BLAZE_ROD]:120,[SPRUCE_PLANKS]:15,[STRIPPED_LOG]:15,[OAK_SLAB]:7,[SPRUCE_SLAB]:7,[BOWL]:5,[LAVA_BUCKET]:1000,[HOE0]:10});

// ── textures for the new content (painted procedurally, like the rest of the atlas) ──
function paintContent() {
  const px = (t, rows, pal) => mask(t, rows, pal);
  const storageBlock = (base, hi, lo, pattern) => t => {
    t.noise(base, 0.06);
    t.each((x, y) => { if (x === 0 || y === 0) t.set(x, y, hi); else if (x === 15 || y === 15) t.set(x, y, lo); });
    if (pattern === 'grid') t.each((x, y) => { if ((x === 5 || x === 10 || y === 5 || y === 10) && x && y && x < 15 && y < 15) t.set(x, y, mul(base, 0.82)); });
    if (pattern === 'gem') for (let i = 0; i < 5; i++) { const cx = 3 + Math.floor(t.r() * 10), cy = 3 + Math.floor(t.r() * 10); t.set(cx, cy, hi); t.set(cx + 1, cy, mul(base, 1.15)); t.set(cx, cy + 1, mul(base, 0.75)); }
    if (pattern === 'dots') for (let i = 0; i < 14; i++) t.set(1 + Math.floor(t.r() * 14), 1 + Math.floor(t.r() * 14), t.r() < 0.5 ? hi : lo);
  };
  tile('c_purpur', t => t.each((x, y) => { const cx = x % 8, cy = y % 8, e = cx === 7 || cy === 7; t.set(x, y, e ? [120, 82, 122] : mul([170, 124, 170], (cx < 2 || cy < 2 ? 1.08 : 0.97) + (t.r() - 0.5) * 0.08)); }));
  tile('c_purpur_pillar', t => t.each((x, y) => t.set(x, y, mul([172, 128, 172], (x % 4 === 0 ? 0.82 : 1.02) + (t.r() - 0.5) * 0.06))));
  tile('c_purpur_top', t => t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.set(x, y, mul([170, 124, 170], Math.floor(d) % 3 === 0 ? 0.82 : 1.02)); }));
  tile('c_end_rod', t => { for (let y = 2; y < 16; y++) { t.set(7, y, [250, 246, 238]); t.set(8, y, [222, 214, 206]); } for (let x = 6; x < 10; x++) { t.set(x, 15, [180, 150, 190]); t.set(x, 14, [200, 170, 205]); } });
  tile('c_iron_block', storageBlock([220, 220, 224], [250, 250, 252], [150, 150, 156], 'grid'));
  tile('c_gold_block', storageBlock([246, 208, 62], [255, 246, 150], [190, 140, 30], 'grid'));
  tile('c_diamond_block', storageBlock([98, 230, 220], [210, 255, 252], [40, 160, 150], 'gem'));
  tile('c_emerald_block', storageBlock([52, 200, 96], [170, 255, 190], [20, 120, 50], 'gem'));
  tile('c_lapis_block', storageBlock([36, 72, 170], [100, 140, 230], [20, 40, 110], 'dots'));
  tile('c_coal_block', storageBlock([30, 30, 32], [70, 70, 74], [12, 12, 14], 'dots'));
  tile('c_redstone_block', storageBlock([176, 22, 12], [240, 80, 60], [110, 10, 6], 'grid'));
  tile('c_hay_side', t => t.each((x, y) => { const band = y === 2 || y === 3 || y === 12 || y === 13; t.set(x, y, band ? mul([150, 60, 30], 0.9 + t.r() * 0.2) : mul([206, 170, 40], (x % 3 === 0 ? 0.85 : 1) * (0.94 + t.r() * 0.12))); }));
  tile('c_hay_top', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, mul([200, 162, 36], (Math.floor(d) % 2 ? 0.86 : 1) * (0.92 + t.r() * 0.14))); }));
  tile('c_farmland', t => t.each((x, y) => t.set(x, y, mul([92, 60, 36], (y % 4 === 0 ? 0.68 : 1) * (0.9 + t.r() * 0.18)))));
  const crop = (stage) => t => { for (let i = 0; i < 6; i++) { const x = 1 + i * 2.6 + t.r(), h = stage ? 12 + t.r() * 3 : 4 + t.r() * 3; for (let y = 15; y > 15 - h; y--) t.set(Math.floor(x), y, stage ? mul([200, 170, 60], 0.8 + t.r() * 0.3) : mul([70, 160, 50], 0.8 + t.r() * 0.3)); if (stage) for (let k = 0; k < 4; k++) t.set(Math.floor(x) + (k % 2), Math.floor(15 - h + k), [170, 130, 40]); } };
  tile('c_wheat0', crop(0)); tile('c_wheat7', crop(1));
  tile('c_path_top', t => t.noise([150, 122, 66], 0.12));
  tile('c_path_side', t => { t.copy('dirt'); for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) t.set(x, y, mul([150, 122, 66], 0.9 + t.r() * 0.2)); });
  tile('c_lantern', t => px(t, ['................', '.......##.......', '......#..#......', '.......##.......', '.....######.....', '.....#YYYY#.....', '....#YWWYYY#....', '....#YWYYYY#....', '....#YYYYYY#....', '....#YYYYYY#....', '....#YYYYYY#....', '.....######.....', '................', '................', '................', '................'], { '#': [44, 44, 52], Y: [255, 190, 70], W: [255, 250, 210] }));
  tile('c_smooth_stone', t => { t.noise([160, 160, 160], 0.04); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [118, 118, 118]); }); });
  tile('c_spruce_planks', t => t.each((x, y) => { const row = Math.floor(y / 4), seam = y % 4 === 3 || x === (row * 5 + 2) % 16; t.set(x, y, seam ? [70, 48, 26] : mul([116, 84, 50], 0.9 + 0.08 * Math.sin(x * 0.9 + row * 3) + t.r() * 0.08)); }));
  tile('c_smoker_side', t => { t.copy('log_side'); t.each((x, y) => { if (y > 11) t.set(x, y, mul([110, 110, 110], 0.9 + t.r() * 0.2)); }); });
  tile('c_smoker_top', t => { t.noise([92, 88, 84], 0.12); for (let x = 3; x < 13; x++) for (let y = 3; y < 13; y++) t.set(x, y, mul([50, 48, 46], 0.9 + t.r() * 0.2)); });
  tile('c_smoker_front', t => { t.copy('c_smoker_side'); for (let x = 3; x < 13; x++) for (let y = 6; y < 12; y++) t.set(x, y, [20, 18, 16]); for (let x = 3; x < 13; x++) t.set(x, 5, [60, 60, 60]); });
  tile('c_blast_side', t => { t.noise([120, 120, 124], 0.1); t.each((x, y) => { if (y < 3 || y > 12) t.set(x, y, mul([80, 80, 84], 0.9 + t.r() * 0.2)); }); });
  tile('c_blast_top', t => { t.noise([100, 100, 104], 0.08); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) if ((x + y) % 2) t.set(x, y, [40, 40, 44]); });
  tile('c_blast_front', t => { t.copy('c_blast_side'); for (let x = 3; x < 13; x++) for (let y = 5; y < 12; y++) t.set(x, y, (x % 2) ? [30, 30, 34] : [150, 150, 156]); });
  tile('c_smith_top', t => { t.noise([52, 44, 48], 0.1); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [200, 200, 206]); }); });
  tile('c_smith_side', t => { t.copy('planks'); t.each((x, y) => { if (y < 3) t.set(x, y, [56, 46, 50]); if ((x === 2 || x === 13) && y > 2) t.set(x, y, [70, 70, 76]); }); });
  tile('c_smith_bottom', t => t.copy('c_smith_top'));
  tile('c_fletch_top', t => { t.copy('birch_planks'); for (let k = 0; k < 9; k++) { t.set(3 + k, 4 + k, [236, 236, 236]); t.set(12 - k, 4 + k, [150, 102, 60]); } });
  tile('c_fletch_side', t => { t.copy('birch_planks'); t.each((x, y) => { if (y < 4) t.set(x, y, mul([210, 190, 140], 0.9 + t.r() * 0.15)); }); for (let x = 4; x < 12; x++) t.set(x, 8, [80, 60, 40]); });
  tile('c_loom_top', t => { t.copy('planks'); for (let x = 2; x < 14; x++) for (let y = 5; y < 11; y++) t.set(x, y, mul([230, 230, 220], 0.9 + t.r() * 0.15)); });
  tile('c_loom_side', t => { t.copy('planks'); for (let y = 2; y < 14; y++) for (const x of [4, 7, 10]) t.set(x, y, [236, 236, 236]); });
  tile('c_composter_side', t => { t.copy('planks'); t.each((x, y) => { if (x < 2 || x > 13 || y > 13) t.set(x, y, [96, 70, 40]); }); });
  tile('c_composter_top', t => { t.copy('dirt'); t.each((x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13) t.set(x, y, [120, 88, 52]); }); });
  tile('c_carto_top', t => { t.copy('dark_oak_planks'); for (let x = 3; x < 13; x++) for (let y = 3; y < 13; y++) t.set(x, y, (x + y) % 5 ? [220, 210, 170] : [120, 170, 90]); });
  tile('c_carto_side', t => { t.copy('dark_oak_planks'); for (let x = 2; x < 14; x++) t.set(x, 4, [220, 210, 170]); });
  const flower = (petal, center, stem = [60, 130, 40]) => t => { for (let y = 8; y < 16; y++) t.set(7, y, stem); t.set(6, 12, stem); t.set(8, 13, stem); blob(t, 7.5, 5.5, 3, 2.6, petal, 0.15); t.set(7, 5, center); t.set(8, 5, center); };
  tile('c_cornflower', flower([70, 100, 220], [40, 60, 160])); tile('c_allium', flower([180, 90, 210], [220, 160, 240])); tile('c_blue_orchid', flower([60, 180, 230], [200, 240, 255]));
  tile('c_lily', t => { for (let y = 6; y < 16; y++) t.set(7, y, [60, 140, 40]); for (const [x, y] of [[5, 7], [9, 8], [6, 10], [10, 11]]) { t.set(x, y, [250, 250, 250]); t.set(x, y + 1, [220, 220, 220]); } blob(t, 5, 13, 2, 2.5, [70, 150, 50], 0.2); });
  const shroom = cap => t => { for (let y = 10; y < 16; y++) { t.set(7, y, [220, 210, 190]); t.set(8, y, [200, 190, 170]); } blob(t, 7.5, 9, 4.2, 2.6, cap, 0.15); if (cap[0] > 180) for (const [x, y] of [[5, 8], [9, 8], [7, 7]]) t.set(x, y, [255, 255, 255]); };
  tile('c_brown_mushroom', shroom([150, 110, 80])); tile('c_red_mushroom', shroom([210, 40, 40]));
  tile('c_sugar_cane', t => { for (const x of [3, 7, 11]) for (let y = 0; y < 16; y++) { t.set(x, y, y % 5 === 0 ? [150, 200, 110] : [120, 180, 80]); t.set(x + 1, y, [100, 160, 70]); } });
  tile('c_fern', t => plantSprite(t, 7, [70, 130, 50]));
  tile('c_carrot_crop', t => { for (let i = 0; i < 5; i++) { const x = 2 + i * 3; for (let y = 8; y < 14; y++) t.set(x, y, [60, 150, 40]); t.set(x, 14, [230, 120, 30]); t.set(x, 15, [230, 120, 30]); t.set(x + 1, 9, [80, 170, 50]); } });
  tile('c_potato_crop', t => { for (let i = 0; i < 5; i++) { const x = 2 + i * 3; for (let y = 7; y < 14; y++) t.set(x, y, [70, 150, 50]); t.set(x, 14, [200, 170, 90]); t.set(x + 1, 15, [190, 160, 80]); t.set(x - 1, 8, [90, 170, 60]); } });
  tile('c_iron_bars', t => t.each((x, y) => { if (x % 4 === 1 || y === 0 || y === 15) t.set(x, y, x % 4 === 1 ? [160, 160, 166] : [120, 120, 126]); }));
  tile('c_cobweb', t => { for (let k = 0; k < 16; k++) { t.set(k, k, [230, 230, 230], 200); t.set(15 - k, k, [230, 230, 230], 200); t.set(7, k, [230, 230, 230], 170); t.set(k, 7, [230, 230, 230], 170); } t.each((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (Math.abs(d - 3.5) < 0.6 || Math.abs(d - 6.5) < 0.6) t.set(x, y, [220, 220, 220], 150); }); });
  tile('c_chiseled_sb', t => { t.copy('stone_bricks'); t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (Math.abs(d - 4) < 0.8) t.set(x, y, [86, 86, 86]); if (d < 1.5) t.set(x, y, [100, 100, 100]); }); });
  tile('c_spawner', t => t.each((x, y) => { if (x % 5 === 0 || y % 5 === 0 || x === 15 || y === 15) t.set(x, y, mul([40, 44, 58], 0.9 + t.r() * 0.3)); }));
  tile('c_raw_iron_block', t => voronoi(t, 8, [196, 160, 128], [140, 104, 80], 0.3, 1.1));
  tile('c_gilded', t => { t.noise([44, 38, 44], 0.25); for (let i = 0; i < 9; i++) t.set(Math.floor(t.r() * 16), Math.floor(t.r() * 16), [240, 190, 50]); });
  const face = lit => t => { t.copy('pumpkin_side'); const C = lit ? [255, 220, 90] : [40, 22, 6]; for (const [x, y] of [[4, 5], [5, 5], [10, 5], [11, 5], [4, 6], [11, 6]]) t.set(x, y, C); for (let x = 3; x < 13; x++) t.set(x, 10, C); for (const x of [4, 7, 10]) t.set(x, 11, C); };
  tile('c_jack_front', face(true)); tile('c_carved_front', face(false));
  tile('c_stripped_side', t => t.each((x, y) => t.set(x, y, mul([178, 140, 86], 0.9 + 0.08 * Math.sin(x * 1.9) + (t.r() - 0.5) * 0.1))));
  tile('c_stripped_top', t => t.each((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); t.set(x, y, mul([182, 146, 92], (Math.floor(d * 1.3) % 2 ? 0.86 : 1) * (0.95 + t.r() * 0.1))); }));
  tile('c_note', t => { t.noise([110, 70, 50], 0.12); t.each((x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) t.set(x, y, [70, 44, 30]); }); });
  tile('c_jukebox_top', t => { t.copy('c_note'); for (let x = 3; x < 13; x++) t.set(x, 7, [20, 20, 20]); for (let x = 3; x < 13; x++) t.set(x, 8, [20, 20, 20]); });
  tile('c_ench_top', t => { t.noise([160, 30, 40], 0.12); for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) for (let k = 0; k < 4; k++) t.set(x + (k & 1), y + (k >> 1), [90, 230, 220]); });
  tile('c_ench_side', t => { t.copy('obsidian'); t.each((x, y) => { if (y < 4) t.set(x, y, mul([160, 30, 40], 0.9 + t.r() * 0.2)); }); });
  tile('c_slime', t => t.each((x, y) => { const e = x === 0 || y === 0 || x === 15 || y === 15, inner = x > 3 && x < 12 && y > 3 && y < 12; t.set(x, y, e ? [80, 170, 60] : inner ? [110, 200, 90] : [130, 220, 110], e ? 230 : inner ? 230 : 170); }));
  tile('c_bell', t => { px(t, ['................', '.......##.......', '......#..#......', '.....######.....', '.....#GGGG#.....', '....#GGWGGG#....', '....#GGWGGG#....', '....#GGGGGG#....', '...#GGGGGGGG#...', '...##########...', '.......##.......', '.......##.......', '................', '................', '................', '................'].map(r => r), { '#': [140, 100, 20], G: [246, 200, 60], W: [255, 245, 170] }); });
  // items
  const lump = (c, dark) => t => { voronoi(t, 4, c, dark, 0.3, 1); t.each((x, y) => { if (Math.hypot(x - 7.5, y - 8) > 5.6) t.set(x, y, [0, 0, 0], 0); }); outline(t, 0.5); };
  tile('c_raw_iron', lump([212, 176, 146], [150, 110, 86])); tile('c_raw_gold', lump([240, 200, 70], [180, 130, 30])); tile('c_raw_copper', lump([226, 130, 90], [160, 80, 50]));
  tile('c_charcoal', t => { t.copy('coal'); t.each((x, y) => { const p = t.get(x, y); if (p[3]) t.set(x, y, [p[0] * 1.15 + 18, p[1] * 1.05 + 8, p[2]], p[3]); }); });
  const nugget = c => t => { for (const [x, y, r] of [[6, 7, 2.2], [10, 9, 1.8], [7, 11, 1.6]]) blob(t, x, y, r, r, c, 0.2); outline(t, 0.5); };
  tile('c_iron_nugget', nugget([220, 220, 224])); tile('c_gold_nugget', nugget([250, 214, 70]));
  const seeds = c => t => { for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [8, 12], [10, 12]]) { t.set(x, y, c); t.set(x + 1, y, mul(c, 0.8)); } outline(t, 0.5); };
  tile('c_wheat_seeds', seeds([80, 160, 40])); tile('c_beet_seeds', seeds([200, 180, 120])); tile('c_pumpkin_seeds', seeds([230, 220, 160])); tile('c_melon_seeds', seeds([40, 30, 20]));
  tile('c_golden_carrot', t => { for (let k = 0; k < 9; k++) { t.set(4 + k, 12 - k, [250, 210, 60]); t.set(5 + k, 12 - k, [220, 170, 30]); t.set(4 + k, 13 - k, [200, 150, 30]); } t.set(13, 3, [80, 170, 40]); t.set(14, 2, [80, 170, 40]); t.set(12, 2, [80, 170, 40]); outline(t, 0.45); });
  const berries = (c, hi) => t => { for (const [x, y] of [[6, 7], [10, 8], [7, 11], [11, 12]]) { blob(t, x, y, 1.9, 1.9, c, 0.15); t.set(Math.floor(x) - 1, Math.floor(y) - 1, hi); } for (let k = 0; k < 5; k++) t.set(8 + (k % 2), 2 + k, [60, 120, 40]); outline(t, 0.45); };
  tile('c_sweet_berries', berries([190, 30, 40], [255, 120, 120])); tile('c_glow_berries', berries([250, 170, 40], [255, 240, 160]));
  const meat = (c, fat) => t => { shape(t, (x, y) => ((x + 0.5 - 8) / 5) ** 2 + ((y + 0.5 - 8.5) / 4) ** 2 <= 1, c, 0.15); for (let x = 4; x < 12; x++) t.set(x, 7, fat); for (let y = 10; y < 14; y++) t.set(12, y, [236, 230, 210]); outline(t, 0.45); };
  tile('c_rabbit', meat([230, 150, 140], [250, 210, 200])); tile('c_cooked_rabbit', meat([180, 110, 60], [210, 160, 100]));
  const bowlT = soup => t => { shape(t, (x, y) => y >= 8 && y <= 13 && Math.abs(x - 7.5) <= 6.5 - (y - 8) * 0.7, [140, 100, 56], 0.1); if (soup) for (let x = 2; x < 14; x++) t.set(x, 8, soup), t.set(x, 9, mul(soup, 0.85)); outline(t, 0.45); };
  tile('c_bowl', bowlT(null)); tile('c_rabbit_stew', bowlT([170, 110, 50])); tile('c_beet_soup', bowlT([170, 30, 40]));
  tile('c_dried_kelp', t => { for (let y = 2; y < 15; y++) { const x = 7 + Math.round(Math.sin(y * 0.7) * 2); t.set(x, y, [60, 70, 40]); t.set(x + 1, y, [80, 96, 50]); } outline(t, 0.5); });
  tile('c_honeycomb', t => { t.each((x, y) => { const hx = (x + (Math.floor(y / 4) % 2) * 2) % 4, hy = y % 4; if (Math.hypot(x - 7.5, y - 7.5) < 6.4) t.set(x, y, hx === 0 || hy === 0 ? [200, 140, 20] : [250, 190, 50]); }); outline(t, 0.45); });
  const sac = c => t => { blob(t, 8, 9, 5, 5, c, 0.2); t.set(8, 3, mul(c, 0.7)); t.set(8, 4, mul(c, 0.7)); t.set(6, 7, mul(c, 1.6)); outline(t, 0.45); };
  tile('c_ink_sac', sac([40, 40, 50])); tile('c_glow_ink', sac([40, 170, 170]));
  tile('c_name_tag', t => { shape(t, (x, y) => x + y > 8 && x + y < 22 && Math.abs(x - y) < 5, [230, 220, 190], 0.1); t.set(5, 5, [140, 120, 90]); for (let k = 0; k < 4; k++) t.set(2 + k, 2 + k, [200, 200, 200]); outline(t, 0.45); });
  tile('c_lead', t => { t.each((x, y) => { const d = Math.hypot(x - 8, y - 7); if (d > 3.6 && d < 5.4 && y < 11) t.set(x, y, (x + y) % 3 ? [160, 120, 80] : [120, 86, 56]); }); for (let y = 11; y < 15; y++) t.set(4 + (y - 11), y, [160, 120, 80]); outline(t, 0.45); });
  tile('c_saddle', t => { shape(t, (x, y) => y > 4 && y < 12 && x > 2 && x < 13 && !(y < 7 && x > 5 && x < 10), [140, 80, 40], 0.15); for (let y = 11; y < 15; y++) { t.set(4, y, [120, 120, 120]); t.set(11, y, [120, 120, 120]); } outline(t, 0.45); });
  tile('c_firework', t => { for (let y = 3; y < 10; y++) for (let x = 6; x < 10; x++) t.set(x, y, x === 6 ? [250, 80, 80] : [210, 40, 40]); t.set(7, 2, [60, 60, 60]); t.set(8, 2, [60, 60, 60]); for (let y = 10; y < 15; y++) t.set(8, y, STICKC); for (let x = 6; x < 10; x++) t.set(x, 6, [240, 230, 220]); outline(t, 0.45); });
  tile('c_fire_charge', t => { blob(t, 8, 8, 5, 5, [60, 40, 30], 0.3); for (let i = 0; i < 9; i++) t.set(4 + Math.floor(t.r() * 8), 4 + Math.floor(t.r() * 8), t.r() < 0.5 ? [250, 160, 40] : [230, 80, 20]); outline(t, 0.45); });
  tile('c_trident', t => { for (let k = 0; k < 11; k++) { t.set(2 + k, 13 - k, [60, 150, 140]); t.set(3 + k, 13 - k, [40, 110, 100]); } for (const [x, y] of [[12, 1], [14, 3], [13, 2], [10, 1], [14, 5], [11, 2], [14, 4]]) t.set(x, y, [120, 220, 200]); outline(t, 0.45); });
  tile('c_mace', t => { for (let k = 0; k < 8; k++) t.set(3 + k, 13 - k, [90, 70, 50]); blob(t, 11, 5, 3.2, 3.2, [120, 120, 130], 0.2); for (const [x, y] of [[11, 1], [15, 5], [11, 9], [7, 5]]) t.set(x, y, [200, 200, 210]); outline(t, 0.45); });
  tile('c_spyglass', t => { for (let k = 0; k < 10; k++) { t.set(3 + k, 12 - k, [200, 140, 60]); t.set(4 + k, 12 - k, [170, 110, 40]); t.set(3 + k, 13 - k, [150, 90, 30]); } t.set(12, 3, [150, 200, 240]); t.set(13, 2, [150, 200, 240]); outline(t, 0.45); });
  tile('c_recovery', t => { blob(t, 8, 8, 6, 6, [40, 60, 70], 0.1); blob(t, 8, 8, 4.6, 4.6, [20, 120, 140], 0.1); for (let k = 0; k < 3; k++) { t.set(8 + k, 7 - k, [120, 255, 240]); t.set(7 - k, 8 + k, [70, 70, 80]); } outline(t, 0.45); });
  tile('c_membrane', t => { shape(t, (x, y) => y > 3 && y < 13 && x > 1 && x < 15 && (y - 3) > Math.abs(x - 8) * 0.5, [190, 200, 170], 0.2); outline(t, 0.5); });
  tile('c_nautilus', t => { t.each((x, y) => { const d = Math.hypot(x - 8, y - 8), a = Math.atan2(y - 8, x - 8); if (d < 6) t.set(x, y, (Math.floor(d + a) % 2) ? [230, 210, 190] : [190, 120, 90]); }); outline(t, 0.45); });
  tile('c_heart_sea', t => { blob(t, 8, 8, 5, 5, [40, 120, 200], 0.2); blob(t, 8, 8, 2.6, 2.6, [110, 220, 240], 0.1); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8]]) t.set(x, y, [60, 200, 200]); outline(t, 0.45); });
  tile('c_shulker_shell', t => { shape(t, (x, y) => y > 3 && y < 12 && Math.abs(x - 7.5) < 6.5, [150, 100, 150], 0.15); for (let x = 2; x < 14; x++) t.set(x, 8, [110, 70, 110]); outline(t, 0.45); });
  const bottle = (liq, glow) => t => { for (let y = 2; y < 5; y++) for (let x = 7; x < 9; x++) t.set(x, y, y === 2 ? [140, 100, 60] : [210, 230, 240]); blob(t, 8, 10, 5, 4.6, liq, 0.12); t.set(6, 8, glow || [255, 255, 255]); outline(t, 0.45); };
  tile('c_dragon_breath', bottle([230, 120, 200]));
  tile('c_chorus', t => { blob(t, 8, 8.5, 5, 5, [140, 90, 150], 0.2); for (let i = 0; i < 6; i++) t.set(5 + Math.floor(t.r() * 6), 5 + Math.floor(t.r() * 6), [220, 180, 230]); outline(t, 0.45); });
  tile('c_popped_chorus', t => { blob(t, 8, 8.5, 5, 5, [190, 150, 200], 0.2); for (let i = 0; i < 8; i++) t.set(5 + Math.floor(t.r() * 6), 5 + Math.floor(t.r() * 6), [250, 230, 250]); outline(t, 0.45); });
  tile('c_echo', t => { shape(t, (x, y) => Math.abs(x - 8) + Math.abs(y - 8) * 0.6 < 5, [20, 80, 90], 0.2); t.set(7, 6, [80, 220, 230]); t.set(9, 9, [80, 220, 230]); outline(t, 0.45); });
  tile('c_rabbit_hide', t => { shape(t, (x, y) => x > 3 && x < 13 && y > 3 && y < 13, [190, 150, 110], 0.2); outline(t, 0.5); });
  tile('c_rabbit_foot', t => { blob(t, 7, 10, 3.5, 4, [200, 170, 130], 0.2); for (let y = 2; y < 7; y++) t.set(10, y, [150, 110, 80]); outline(t, 0.45); });
  tile('c_magma_cream', t => { blob(t, 8, 8, 5, 5, [220, 110, 30], 0.2); blob(t, 8, 8, 2.4, 2.4, [250, 210, 80], 0.1); outline(t, 0.45); });
  tile('c_ferm_eye', t => { blob(t, 8, 8, 5, 5, [150, 60, 60], 0.2); blob(t, 8, 8, 2, 2, [60, 20, 20], 0.1); for (let i = 0; i < 5; i++) t.set(5 + Math.floor(t.r() * 6), 5 + Math.floor(t.r() * 6), [220, 200, 160]); outline(t, 0.45); });
  tile('c_glist_melon', t => { t.copy('melon_slice'); for (let i = 0; i < 7; i++) t.set(4 + Math.floor(t.r() * 8), 5 + Math.floor(t.r() * 6), [255, 230, 80]); });
  tile('c_nether_wart', t => { for (const [x, y] of [[6, 6], [10, 6], [8, 10], [5, 11], [11, 11]]) blob(t, x, y, 2.2, 2.2, [170, 30, 40], 0.2); outline(t, 0.45); });
  tile('c_glow_dust', t => { for (let i = 0; i < 26; i++) t.set(3 + Math.floor(t.r() * 10), 5 + Math.floor(t.r() * 9), t.r() < 0.5 ? [255, 220, 120] : [220, 170, 70]); outline(t, 0.5); });
  tile('c_pris_crystal', t => { for (const [x, y] of [[5, 6], [10, 5], [8, 10], [11, 11], [5, 11]]) { blob(t, x, y, 1.8, 1.8, [180, 240, 220], 0.15); t.set(x, y, [255, 255, 255]); } outline(t, 0.45); });
  tile('c_poison_potato', t => { blob(t, 8, 9, 5, 4, [180, 190, 90], 0.2); for (let i = 0; i < 5; i++) t.set(5 + Math.floor(t.r() * 7), 7 + Math.floor(t.r() * 4), [110, 140, 40]); outline(t, 0.45); });
  tile('c_ench_apple', t => { t.copy('golden_apple'); t.each((x, y) => { const p = t.get(x, y); if (p[3] && (x + y) % 5 === 0) t.set(x, y, [p[0], p[1] * 0.7, Math.min(255, p[2] + 140)], p[3]); }); });
  const hcol = [[156, 117, 64], [128, 128, 128], [222, 222, 222], [240, 210, 60], [90, 226, 212], [70, 62, 72]];
  hcol.forEach((H, i) => tile('c_hoe_' + i, t => { for (let x = 2; x < 11; x++) t.set(x, 15 - x - 1, STICKC); for (let x = 7; x < 13; x++) { t.set(x, 3, H); t.set(x, 4, mul(H, 0.8)); } t.set(7, 5, H); outline(t, 0.45); }));
  for (const [id, it] of Object.entries(ITEM)) if (it.pcol) tile(it.icon, bottle(it.pcol));
  DYE_COLORS.forEach((c, i) => tile('c_dye_' + i, t => { shape(t, (x, y) => y > 5 && y < 14 && Math.abs(x - 7.5) < (y - 4) * 0.75 && Math.abs(x - 7.5) < 6, c, 0.18); t.set(7, 6, mul(c, 1.25)); outline(t, 0.45); }));
}
