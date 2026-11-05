// ─────────────────────────── UI: HUD, screens, inventory ───────────────────────────
let root = null, ctx = null, canvas = null;
let hudDirty = true, invDirty = true;
const $ = id => root.querySelector('#' + id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTouch = () => matchMedia('(pointer:coarse)').matches;
// touch UI can be forced on/off in settings; isTouch() still describes the device itself
const touchUI = () => { const m = SAVE && SAVE.settings ? SAVE.settings.touchMode : 'auto'; return m === 'on' || (m !== 'off' && isTouch()); };
function invChanged() { invDirty = true; if (G && G.ui) renderSlots(); }

// All GUI sizes are expressed in "GUI pixels" (--g), like the original game's GUI scale option.
const u = n => `calc(var(--g)*${n})`;
const notch = n => { const a = u(n), b = `calc(100% - var(--g)*${n})`; return `polygon(${a} 0,${b} 0,${b} ${a},100% ${a},100% ${b},${b} ${b},${b} 100%,${a} 100%,${a} ${b},0 ${b},0 ${a},${a} ${a})`; };

const CSS = `@font-face{font-family:"MCKR";src:url("fonts/Galmuri11.woff2") format("woff2"),url("https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2") format("woff2");font-display:swap}
*{box-sizing:border-box}
#mc{--g:2px;--hs:1;--to:.85;--blur:0px;--chat:.5;--chato:1;--fs:max(12px,${u(6)});--ts:max(1px,${u(.5)});--sh:var(--ts) var(--ts) 0 #3f3f3f;position:relative;width:100%;height:100%;overflow:hidden;background:#000;font-family:"MCKR","Galmuri11","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;font-size:var(--fs);line-height:1.3;color:#fff;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:none}
#mc button,#mc input{font:inherit;color:inherit;letter-spacing:inherit}
#mc [hidden]{display:none!important}
#mc img{image-rendering:pixelated}
canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
.hud{position:absolute;inset:0;pointer-events:none}
#mc.nohud .hud>:not(.touch){visibility:hidden}
.cross{position:absolute;left:50%;top:50%;width:${u(9)};height:${u(9)};transform:translate(-50%,-50%);mix-blend-mode:difference}
.cross:before,.cross:after{content:"";position:absolute;background:#fff}.cross:before{left:${u(4)};top:0;width:${u(1)};height:100%}.cross:after{top:${u(4)};left:0;height:${u(1)};width:100%}
#mc.nocross .cross{display:none}
.flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(190,0,0,.55));opacity:0}
.uw{position:absolute;inset:0;background:rgba(20,50,140,.35);display:none}
.bottom{position:absolute;left:50%;bottom:0;transform:translateX(-50%) scale(var(--hs));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center}
.itemname{position:absolute;bottom:calc(100% + ${u(3)});left:50%;transform:translateX(-50%);white-space:nowrap;text-shadow:var(--sh);transition:opacity .4s}
#mc.noname .itemname{display:none}
.statrows{width:${u(182)};display:flex;flex-direction:column}
.bars{display:flex;justify-content:space-between;width:100%;margin-bottom:${u(1)}}
.bars .hr{display:flex}.bars img,.air img{width:${u(9)};height:${u(9)};margin-right:${u(-1)};display:block}
.bars .food{flex-direction:row-reverse}.bars .food img,.air img{margin:0 0 0 ${u(-1)}}
.bars .shake img{animation:shk .25s infinite}@keyframes shk{50%{transform:translateY(${u(-1)})}}
.air{display:flex;flex-direction:row-reverse;height:${u(9)}}
.toprow{display:flex;justify-content:space-between;align-items:flex-end;height:${u(9)};margin-bottom:${u(1)}}
.armor{display:flex;visibility:hidden}.armor img{width:${u(9)};height:${u(9)};margin-right:${u(-1)};display:block}
.sleepov{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.iinfo{position:absolute;left:50%;top:calc(50% + ${u(16)});transform:translateX(-50%);display:none;align-items:center;gap:${u(3)};background:#00000060;padding:${u(1)} ${u(4)};text-shadow:var(--sh);white-space:nowrap}
.ndl{position:relative;display:inline-block;width:${u(9)};height:${u(9)};border-radius:50%;background:#c8c8b4;border:${u(1)} solid #555}
.ndl::before{content:"";position:absolute;left:50%;top:${u(.5)};width:0;height:0;margin-left:${u(-1.5)};border-left:${u(1.5)} solid transparent;border-right:${u(1.5)} solid transparent;border-bottom:${u(3.5)} solid #e02828}
.hotbar{position:relative;width:${u(182)};height:${u(22)};background:var(--tx-hot) 0 0/100% 100%;image-rendering:pixelated;pointer-events:auto;--sel:0}
.hs{position:absolute;top:${u(1)};width:${u(20)};height:${u(20)};display:flex;align-items:center;justify-content:center}
.hsel{position:absolute;top:${u(-1)};left:calc(var(--g)*(var(--sel)*20 - 1));width:${u(24)};height:${u(24)};background:var(--tx-hsel) 0 0/100% 100%;image-rendering:pixelated;pointer-events:none;z-index:1}
.hot-inv{display:none;position:absolute;left:calc(100% + ${u(2)});top:0;width:${u(22)};height:${u(22)};padding:0;border:0;background:var(--tx-hotend) 0 0/100% 100%;image-rendering:pixelated;pointer-events:auto;touch-action:manipulation;cursor:pointer}
#mc.touchui .hot-inv{display:block}
.ico{aspect-ratio:1/1;object-fit:contain;flex-shrink:0;max-width:none;max-height:none;width:${u(16)};height:${u(16)};image-rendering:pixelated;pointer-events:none;display:block}
.cnt{position:absolute;right:0;bottom:${u(-1)};line-height:1;text-shadow:var(--sh);pointer-events:none;z-index:3;color:#fff}
.dur{position:absolute;left:${u(2)};width:${u(13)};bottom:${u(2)};height:${u(2)};background:#000;pointer-events:none;z-index:1}.dur i{display:block;height:${u(1)}}
.eat{position:absolute;left:50%;top:60%;width:${u(60)};height:${u(3)};transform:translateX(-50%);background:#0008;display:none}.eat i{display:block;height:100%;background:#f9c74f}
.debug,.hinfo{position:absolute;left:${u(1)};top:${u(1)};display:none;flex-direction:column;align-items:flex-start;line-height:1.15}
.debug div{background:#505050a0;color:#e0e0e0;padding:${u(.5)} ${u(1)};white-space:pre}
.hinfo{display:flex;left:${u(2)};top:${u(2)};gap:${u(1)}}.hinfo div{background:#00000070;padding:${u(1)} ${u(3)};text-shadow:var(--sh);white-space:pre}
.chatlog{position:absolute;left:${u(2)};bottom:${u(42)};width:min(${u(320)},70%);display:flex;flex-direction:column;opacity:var(--chato)}
#mc.touchui .chatlog{bottom:auto;top:${u(2)}}
.chatlog div{background:rgba(0,0,0,var(--chat));padding:${u(.5)} ${u(2)};transition:opacity 1s;text-shadow:var(--sh);overflow-wrap:anywhere}
#mc.nochat .chatlog{display:none}
.toast{position:absolute;left:50%;bottom:calc(var(--g)*62*var(--hs));transform:translateX(-50%);z-index:8;padding:${u(1)} ${u(3)};background:#0000005a;text-shadow:var(--sh);opacity:0;transition:opacity .3s;white-space:nowrap;max-width:96%;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.tools{position:absolute;right:${u(2)};top:${u(2)};display:flex;gap:${u(2)};pointer-events:auto;z-index:4}
#mc.touchui .tools .dk{display:none}

/* widgets */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;height:${u(20)};min-width:0;max-width:100%;padding:0 ${u(4)};color:#fff;text-shadow:var(--sh);background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)} repeat;image-rendering:pixelated;border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;touch-action:manipulation;outline:none;flex:none}
.btn:hover,.btn:focus-visible{border-color:#fff;color:#ffffa0}
.btn:active{filter:brightness(1.12)}
.btn[disabled]{background:#2d2d2d var(--tx-btnoff) 0 0/${u(64)} ${u(20)};color:#a0a0a0;border-color:#000;box-shadow:none;cursor:default;text-shadow:var(--ts) var(--ts) 0 #282828;filter:none}
.btn.sq{width:${u(20)};padding:0}.btn.sq img{width:${u(12)};height:${u(12)};pointer-events:none}
.btn.sm{height:${u(14)};padding:0 ${u(3)}}
.btn.listen{color:#ffff55}.btn.conf{color:#ff5555}
.w200{width:${u(200)}}.w150{width:${u(150)}}.w98{width:${u(98)}}.w308{width:${u(308)}}.w204{width:${u(204)}}
.w200,.w150,.w98,.w308,.w204{max-width:100%}
.row{display:flex;gap:${u(4)}}.row>.btn{flex:1 1 0;width:auto}.row>.btn.sq{flex:none;width:${u(20)}}
.slider{position:relative;display:block;height:${u(20)};border:${u(1)} solid #000;background:#2d2d2d var(--tx-btnoff) 0 0/${u(64)} ${u(20)};image-rendering:pixelated;max-width:100%}
.slider input{-webkit-appearance:none;appearance:none;position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;background:transparent;cursor:pointer;outline:none;touch-action:none}
.slider input::-webkit-slider-runnable-track{height:100%;background:transparent;border:0}
.slider input::-moz-range-track{height:100%;background:transparent;border:0}
.slider input::-webkit-slider-thumb{-webkit-appearance:none;box-sizing:border-box;width:${u(8)};height:${u(18)};background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)};border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c;image-rendering:pixelated}
.slider input::-moz-range-thumb{box-sizing:border-box;width:${u(8)};height:${u(18)};border-radius:0;background:#6f6f6f var(--tx-btn) 0 0/${u(64)} ${u(20)};border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #ffffff4d,inset ${u(-1)} ${u(-2)} #0000005c}
.slider:hover input::-webkit-slider-thumb{border-color:#fff}.slider:hover input::-moz-range-thumb{border-color:#fff}
.slider .lab{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;text-shadow:var(--sh);white-space:nowrap;overflow:hidden;padding:0 ${u(3)}}
.slider:hover .lab{color:#ffffa0}
.mfield{height:${u(20)};width:${u(200)};max-width:100%;background:#000;border:${u(1)} solid #a0a0a0;color:#fff;padding:0 ${u(4)};outline:none;user-select:text;-webkit-user-select:text;border-radius:0}
.mfield:focus{border-color:#fff}.mfield::placeholder{color:#707070}
.yellow{color:#ffff55}.gray{color:#a0a0a0}.red{color:#ff5555}

/* screens */
.screen{position:absolute;inset:0;z-index:5;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column}
.screen.bg-dirt{background:#1b130d var(--tx-dirt) 0 0/${u(32)} ${u(32)} repeat;image-rendering:pixelated}
.screen.bg-game{background:linear-gradient(#101010b0,#101010d8);-webkit-backdrop-filter:blur(var(--blur));backdrop-filter:blur(var(--blur))}
.screen.bg-cont{background:linear-gradient(#10101060,#10101090)}
.screen.bg-none{background:transparent}
.screen.bg-death{background:linear-gradient(#50000060,#a03030a8)}
.screen.bg-pano{background:linear-gradient(#0000 50%,#0008),url('textures/title-panorama.png') 0% 50%/auto 112% repeat-x #3a5f8f;animation:pano var(--pano-dur,120s) linear infinite alternate}
@keyframes pano{to{background-position:0 0,100% 50%}}
#mc.nopano .screen.bg-pano{animation:none}
.ms{min-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;padding:${u(6)} ${u(6)} ${u(5)};text-shadow:var(--sh)}
.ms.center{justify-content:center;gap:${u(4)}}
.ms.full{height:100%;min-height:${u(150)}}
.mtitle{margin:${u(4)} 0 ${u(8)};text-align:center}
#mc.short .mtitle{margin:${u(1)} 0 ${u(4)}}
.mlist{flex:1 1 auto;min-height:${u(40)};width:calc(100% + ${u(12)});margin:0 ${u(-6)};overflow:auto;overscroll-behavior:contain;background:#00000080;border-top:${u(1)} solid #000;border-bottom:${u(1)} solid #ffffff26;box-shadow:inset 0 ${u(3)} ${u(4)} ${u(-2)} #000c;padding:${u(4)} ${u(6)};display:flex;flex-direction:column;align-items:center}
.mlist::-webkit-scrollbar{width:${u(6)}}.mlist::-webkit-scrollbar-track{background:#000}.mlist::-webkit-scrollbar-thumb{background:#808080;box-shadow:inset ${u(-1)} ${u(-1)} #c0c0c0}
.mfoot{display:flex;flex-direction:column;align-items:center;gap:${u(4)};padding-top:${u(6)};width:100%}
.desc{color:#a0a0a0;text-align:center;max-width:${u(310)};margin:${u(3)} 0 ${u(6)};line-height:1.45}
.mlabel{color:#a0a0a0;width:${u(200)};max-width:100%;text-align:left;margin:${u(6)} 0 ${u(2)}}
.opts{display:grid;grid-template-columns:repeat(2,${u(150)});gap:${u(4)} ${u(10)};justify-content:center;width:100%;padding:${u(2)} 0}
.opts>*{width:100%;min-width:0}
.opts .wide{grid-column:1/-1;justify-self:center;width:${u(200)};max-width:100%}
.opts .sect{grid-column:1/-1;text-align:center;color:#ffff55;margin-top:${u(4)}}
#mc.narrow .opts{grid-template-columns:minmax(0,${u(200)})}
/* title */
.tw{position:relative;min-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;padding:${u(26)} ${u(6)} ${u(18)};text-shadow:var(--sh)}
#mc.short .tw{padding-top:${u(8)}}
.logo{position:relative;margin-bottom:${u(26)};text-align:center;filter:drop-shadow(0 ${u(2)} ${u(3)} #0008)}
#mc.short .logo{margin-bottom:${u(9)}}
.logo h1{display:grid;margin:0;font-weight:normal;font-size:calc(var(--fs)*4);line-height:1;letter-spacing:${u(1)};text-shadow:none}
#mc.short .logo h1{font-size:calc(var(--fs)*3)}
.logo h1>span{grid-area:1/1}
.logo .lb{color:#2a180c;text-shadow:${u(1)} ${u(1)} 0 #2a180c,${u(2)} ${u(2)} 0 #24140a,${u(3)} ${u(3)} 0 #1b0f07,${u(1)} 0 0 #2a180c,0 ${u(1)} 0 #2a180c,${u(-1)} 0 0 #2a180c,0 ${u(-1)} 0 #2a180c}
.logo .lf{background:linear-gradient(#b5ec6a 0 18%,#7cc042 18% 30%,#4f8a2a 30% 36%,#a27652 36% 62%,#86603f 62% 82%,#6d4c31 82%);-webkit-background-clip:text;background-clip:text;color:transparent}
.edition{display:inline-block;margin-top:${u(3)};padding:${u(1)} ${u(5)};background:#1d1d1dd0;border:${u(1)} solid #000;box-shadow:inset 0 0 0 ${u(1)} #ffffff30;letter-spacing:${u(3)};color:#e8e8e8}
.splash{position:absolute;left:calc(100% - ${u(10)});top:calc(100% - ${u(8)});transform:translate(-50%,-50%) rotate(-18deg);color:#ff0;text-shadow:var(--ts) var(--ts) 0 #3f3f00;white-space:nowrap;pointer-events:none}
.splash span{display:inline-block;animation:spl .5s ease-in-out infinite alternate}@keyframes spl{to{transform:scale(1.09)}}
.tmenu{display:flex;flex-direction:column;gap:${u(4)};align-items:stretch;width:${u(200)};max-width:100%}
.tmenu .gap{height:${u(6)}}
#mc.short .tmenu .gap{height:0}
.corner{position:absolute;bottom:${u(2)};opacity:.92;white-space:nowrap}.corner.l{left:${u(2)}}.corner.r{right:${u(2)}}
#mc.narrow .corner.r{display:none}
/* lists */
.wl{width:${u(270)};max-width:100%;display:flex;flex-direction:column;gap:${u(4)}}
.we{display:flex;gap:${u(3)};padding:${u(1)};border:${u(1)} solid transparent;cursor:pointer;min-height:${u(36)};align-items:center;text-align:left}
.we:hover{background:#ffffff0d}.we.sel{border-color:#808080;background:#000}
.we .wi{width:${u(32)};height:${u(32)};flex:none;position:relative;background:#00000080;display:flex;align-items:center;justify-content:center}
.we .wi img{width:${u(24)};height:${u(24)}}
.we:hover .wi::after,.we.sel .wi::after{content:"";position:absolute;inset:0;background:#00000090 var(--tx-play) center/${u(14)} ${u(14)} no-repeat;image-rendering:pixelated}
.we .wt{min-width:0;flex:1;display:flex;flex-direction:column;gap:${u(1)}}
.we .wt>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.we .ws{color:#808080}
.empty{color:#a0a0a0;text-align:center;margin:${u(10)} 0}
.ctabs{display:flex;gap:${u(2)};margin-bottom:${u(4)}}
.ctabb{min-width:${u(70)}}.ctabb.on{color:#ffffa0}.ctabb.on::after{content:"";position:absolute;left:${u(3)};right:${u(3)};bottom:${u(3)};height:${u(1)};background:#fff}
.krow{display:grid;grid-template-columns:1fr ${u(80)} ${u(46)};gap:${u(4)};align-items:center;width:${u(310)};max-width:100%;min-height:${u(20)}}
.krow>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.khead{color:#ffff55;margin:${u(6)} 0 ${u(2)};width:${u(310)};max-width:100%;text-align:center}
.strow{display:flex;justify-content:space-between;gap:${u(8)};width:${u(270)};max-width:100%;padding:${u(2)} ${u(3)}}.strow:nth-child(odd){background:#ffffff12}
.help{width:${u(310)};max-width:100%;line-height:1.6}.help h4{color:#ffff55;margin:${u(5)} 0 ${u(1)};font-weight:normal;font-size:inherit}.help p{margin:0;color:#e0e0e0}
.chunkmap{display:grid;grid-template-columns:repeat(5,${u(6)});gap:${u(1)};margin:${u(4)} 0}
.chunkmap i{width:${u(6)};height:${u(6)};background:#2a2a2a}.chunkmap i.g{background:#7d7d7d}.chunkmap i.m{background:#5d9e2d}
.pbar{width:${u(200)};max-width:100%;height:${u(6)};border:${u(1)} solid #fff;padding:${u(1)}}.pbar i{display:block;height:100%;background:#fff;width:0}
.dtitle{font-size:calc(var(--fs)*2);margin-bottom:${u(8)}}
.minfo{color:#a0a0a0;margin-top:${u(6)};text-align:center}
.chatin{margin:auto ${u(2)} ${u(2)};height:${u(12)};background:#00000080;border:0;color:#fff;padding:0 ${u(2)};outline:none;width:calc(100% - ${u(4)});text-shadow:var(--sh);user-select:text;-webkit-user-select:text}
/* containers */
.cwrap{margin:auto;display:flex;align-items:stretch;justify-content:center;flex-wrap:wrap;gap:${u(2)};padding:${u(3)}}
.panel{position:relative;background:#c6c6c6;color:#404040;text-shadow:none;border:${u(1)} solid #000;box-shadow:inset ${u(2)} ${u(2)} #fff,inset ${u(-2)} ${u(-2)} #555;padding:${u(6)} ${u(6)} ${u(7)};clip-path:${notch(1)}}
.chead{display:flex;align-items:center;gap:${u(3)};min-height:${u(11)};margin:0 0 ${u(3)}}
.ctitle{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ctitle.sub{margin:${u(4)} 0 ${u(2)}}
.sp{flex:1}
.xbtn{flex:none;width:${u(11)};height:${u(11)};padding:0;background:#8b8b8b var(--tx-x) center/${u(7)} ${u(7)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated}
.xbtn:hover{background-color:#a4a4c8}
#mc.touchui .xbtn{width:${u(16)};height:${u(16)}}
.mobtools{display:none;gap:${u(2)}}#mc.touchui .mobtools{display:flex}
.tgl{height:${u(14)};padding:0 ${u(3)};background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;color:#fff!important;text-shadow:var(--sh);cursor:pointer;white-space:nowrap;touch-action:manipulation}
.tgl.on{background:#5c8f3a;border-color:#a8e080 #2f4f1c #2f4f1c #a8e080}
.grid{display:grid;grid-template-columns:repeat(9,${u(18)})}.grid.g2{grid-template-columns:repeat(2,${u(18)})}.grid.g3{grid-template-columns:repeat(3,${u(18)})}
.slot{aspect-ratio:1/1;flex:0 0 auto;box-sizing:border-box;position:relative;width:${u(18)};height:${u(18)};background:#8b8b8b;border:${u(1)} solid;border-color:#373737 #fff #fff #373737;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;touch-action:manipulation}
.slot:hover::after,.slot.hl::after{content:"";position:absolute;inset:0;background:#ffffff80;pointer-events:none;z-index:2}
.slot.big{width:${u(26)};height:${u(26)}}
.slot.ghosted::before{content:"";position:absolute;inset:0;background:#ff000038;pointer-events:none}
.slot .ghost{opacity:.5}
.slot.trash{background:#8b8b8b var(--tx-trash) center/${u(16)} ${u(16)} no-repeat;image-rendering:pixelated}
#mc.touchui .slot{touch-action:none}
.offhot{position:absolute;right:calc(100% + ${u(4)});top:0;width:${u(22)};height:${u(22)};background:var(--tx-offbg) 0 0/100% 100%;image-rendering:pixelated;display:none;align-items:center;justify-content:center}
.atkind{position:absolute;left:50%;top:calc(50% + ${u(8)});width:${u(16)};height:${u(2)};transform:translateX(-50%);background:#00000090;display:none}.atkind i{display:block;height:100%;background:#e8e8e8;width:0}
.dnums{position:absolute;inset:0;overflow:hidden}.dnums b{position:absolute;transform:translate(-50%,-50%);font-weight:normal;color:#ff6b6b;text-shadow:var(--sh);white-space:nowrap}.dnums b.crit{color:#ffd23a;font-size:calc(var(--fs)*1.3)}
#mc.cam2 .cross{display:none}
.pcol{display:flex;flex-direction:column;align-items:center;gap:${u(2)};align-self:center}
.pview{width:${u(26)};height:${u(52)};image-rendering:pixelated;display:block;background:#00000018}
#mc.short .pview{display:none}
.charwrap{display:flex;gap:${u(10)};align-items:flex-start;justify-content:center;flex-wrap:wrap}
.pview.big{width:${u(48)};height:${u(96)};background:#00000040;border:${u(1)} solid #000}
.charopts{grid-template-columns:repeat(2,${u(120)})}
.sw{display:inline-block;width:${u(7)};height:${u(7)};margin-right:${u(3)};border:${u(1)} solid #000;vertical-align:middle}
.chead .bookbtn{align-self:center;height:${u(14)};width:${u(16)};background-size:${u(12)} ${u(12)}}
.ico.sil{filter:brightness(0);opacity:.28}
.armcol{display:grid;grid-template-columns:${u(18)};align-self:center}
#mc.short .armcol{grid-template-columns:repeat(2,${u(18)})}
.armrow{display:flex}
.cursor.drag{transform:translateY(${u(-14)}) scale(1.45)}
.slot.hl.spread::after{background:#ffffa070}
.invgap{height:${u(4)}}
.craft{display:flex;align-items:center;gap:${u(4)};padding:${u(1)} ${u(6)} ${u(2)} 0;min-height:${u(40)}}
.craft .sp{min-width:${u(2)}}
.carrow{width:${u(22)};height:${u(15)};position:relative;background:var(--tx-arrow) 0 0/100% 100%;image-rendering:pixelated;flex:none}
.carrow i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--tx-arrowf) 0 0/${u(22)} ${u(15)} no-repeat;image-rendering:pixelated}
.bookbtn{flex:none;width:${u(20)};height:${u(18)};padding:0;background:#8b8b8b var(--tx-book) center/${u(16)} ${u(16)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated;align-self:flex-end}
.bookbtn:hover{background-color:#a4a4c8}.bookbtn.on{background-color:#79a85a}
.rbook{width:${u(147)};display:flex;flex-direction:column;gap:${u(3)}}.rbook .rgrid{flex:1 0 auto}
.rhead{display:flex;gap:${u(2)};align-items:center}
.rhead .mfield{flex:1;min-width:0;height:${u(14)};width:auto}
.rtabs{display:flex;gap:${u(1)}}
.rtab{flex:1;height:${u(14)};background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;color:#fff;text-shadow:var(--sh);cursor:pointer;padding:0;touch-action:manipulation}
.rtab.on{background:#d8d8d8;color:#404040;text-shadow:none;border-color:#fff #8b8b8b #8b8b8b #fff}
.rgrid{display:grid;grid-template-columns:repeat(5,${u(25)});grid-auto-rows:${u(25)};gap:${u(1)};justify-content:center;align-content:start;height:${u(104)}}
.rslot{position:relative;display:flex;align-items:center;justify-content:center;background:#8b8b8b;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;touch-action:manipulation}
.rslot.no{background:#a85c5c;border-color:#d89090 #5a2020 #5a2020 #d89090}
.rslot:hover::after{content:"";position:absolute;inset:0;background:#ffffff50}
.rslot .cnt{right:${u(1)};bottom:${u(1)}}
.rempty{grid-column:1/-1;text-align:center;margin:${u(10)} 0;color:#555}
.rpage{display:flex;align-items:center;justify-content:center;gap:${u(8)};min-height:${u(14)}}
.pg{width:${u(14)};height:${u(14)};padding:0;background:#8b8b8b var(--tx-pg) center/${u(7)} ${u(7)} no-repeat;border:${u(1)} solid;border-color:#fff #373737 #373737 #fff;cursor:pointer;image-rendering:pixelated}
.pg.prev{transform:scaleX(-1)}.pg[disabled]{opacity:.4;cursor:default}
.cr{margin:auto;display:flex;flex-direction:column;padding:${u(3)}}
.crtabs{display:flex;gap:${u(1)};align-items:flex-end;padding:0 ${u(2)};position:relative;z-index:1}
.crtab{width:${u(26)};height:${u(25)};padding:0;background:#9d9d9d;border:${u(1)} solid #000;border-bottom:0;box-shadow:inset ${u(2)} ${u(2)} #d8d8d8;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:${u(-1)};touch-action:manipulation}
.crtab.on{background:#c6c6c6;height:${u(28)};box-shadow:inset ${u(2)} ${u(2)} #fff}
.crtabs.bot{align-items:flex-start}.crtabs.bot .crtab{border-top:0;border-bottom:${u(1)} solid #000;margin:${u(-1)} 0 0;box-shadow:inset ${u(2)} 0 #d8d8d8}.crtabs.bot .crtab.on{box-shadow:inset ${u(2)} 0 #fff}
.crp{width:${u(195)};max-width:100%}
.csearch{width:100%;height:${u(14)};margin-bottom:${u(3)}}
.palette{display:grid;grid-template-columns:repeat(9,${u(18)});grid-auto-rows:${u(18)};height:${u(90)};overflow-y:auto;overscroll-behavior:contain;align-content:start;padding-right:${u(1)}}
@supports not selector(::-webkit-scrollbar){.palette{scrollbar-color:#c6c6c6 #8b8b8b}}
#mc.short .palette{height:${u(72)}}
#mc.short .cwrap{padding:${u(1)}}#mc.short .panel{padding:${u(4)} ${u(5)} ${u(5)}}#mc.short .chead{margin-bottom:${u(1)}}#mc.short .ctitle.sub{margin:${u(2)} 0 ${u(1)}}#mc.short .craft{min-height:0}#mc.short .edhint{display:none}
.palette::-webkit-scrollbar{width:${u(12)}}.palette::-webkit-scrollbar-track{background:#8b8b8b;box-shadow:inset ${u(1)} ${u(1)} #373737,inset ${u(-1)} ${u(-1)} #fff}.palette::-webkit-scrollbar-thumb{background:#c6c6c6;border:${u(1)} solid;border-color:#fff #555 #555 #fff}
.palette .pe{grid-column:1/-1;margin:${u(6)} 0}
.hotrow{display:flex;gap:${u(6)};align-items:center;margin-top:${u(4)}}
.furn{display:flex;align-items:center;justify-content:center;gap:${u(14)};padding:${u(2)} 0 ${u(4)}}
.fcol{display:flex;flex-direction:column;align-items:center;gap:${u(2)}}
.flame{width:${u(14)};height:${u(14)};position:relative;background:var(--tx-flameoff) 0 0/100% 100%;image-rendering:pixelated}
.flame i{position:absolute;left:0;right:0;bottom:0;height:0;background:var(--tx-flame) 0 100%/${u(14)} ${u(14)} no-repeat;image-rendering:pixelated}
.cursor{position:absolute;pointer-events:none;z-index:9;width:${u(16)};height:${u(16)};margin:${u(-8)} 0 0 ${u(-8)}}
.tip{position:absolute;pointer-events:none;z-index:10;background:#100010f0;padding:${u(3)} ${u(4)};display:none;white-space:nowrap;color:#fff;text-shadow:var(--sh);line-height:1.35}
.tip::before{content:"";position:absolute;inset:${u(1)};border:${u(1)} solid transparent;border-image:linear-gradient(#5000ffa0,#28007fa0) 1;pointer-events:none}
.tip .tl{color:#a8a8a8}
.touch-held{position:static;align-self:center;margin:0 auto ${u(2)};background:#000c;padding:${u(2)} ${u(5)};border:${u(1)} solid #777;display:none;align-items:center;gap:${u(3)};z-index:6;pointer-events:none;max-width:100%;text-shadow:var(--sh)}
#mc.touchui .touch-held{display:flex}
.held-slot{position:relative;width:${u(16)};height:${u(16)};flex:none}
/* touch controls */
.touch{position:absolute;inset:0;pointer-events:none;display:none;opacity:var(--to)}
#mc.touchui .touch{display:block}
.tc{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;touch-action:none;padding:0;margin:0}
.tc.off,.tc.cond-off{display:none}
.tb{background:#1e1e1e70 center/56% no-repeat;image-rendering:pixelated;border:${u(1)} solid #ffffff70;box-shadow:inset 0 0 0 ${u(1)} #00000050;border-radius:${u(2)};cursor:pointer}
.tb.down{background-color:#ffffff60}
.tb.on{background-color:#3f7a2da0;border-color:#a8f080}
.joy{border-radius:50%;background:#1e1e1e50;border:${u(1)} solid #ffffff60}
.joy i{position:absolute;left:50%;top:50%;width:42%;height:42%;margin:-21% 0 0 -21%;border-radius:50%;background:#ffffff70;border:${u(1)} solid #ffffffb0;pointer-events:none}
.dpad{display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);gap:5%}
.dpad b{display:block;background:#1e1e1e70 var(--ti-up) center/58% no-repeat;border:${u(1)} solid #ffffff70;border-radius:${u(2)};image-rendering:pixelated;pointer-events:none}
.dpad b.c{background-image:var(--ti-sneak)}.dpad b.c.on{background-color:#3f7a2da0;border-color:#a8f080}
.dpad b.x{visibility:hidden}.dpad b.down{background-color:#ffffff60;visibility:visible}
.dpad b[data-d=r]{transform:rotate(90deg)}.dpad b[data-d=d]{transform:rotate(180deg)}.dpad b[data-d=l]{transform:rotate(-90deg)}
.dpad b[data-d=ur]{transform:rotate(45deg)}.dpad b[data-d=ul]{transform:rotate(-45deg)}.dpad b[data-d=dr]{transform:rotate(135deg)}.dpad b[data-d=dl]{transform:rotate(-135deg)}
#mc.editing .touch{display:block;z-index:6;opacity:1}
#mc.editing .tc.off,#mc.editing .tc.cond-off{display:block}#mc.editing .dpad.off,#mc.editing .dpad.cond-off{display:grid}
#mc.editing .tc.off{opacity:.35}
#mc.editing .tc{outline:${u(1)} dashed #ffffffb0;outline-offset:${u(1)};cursor:grab}
#mc.editing .tc.sel{outline:${u(1)} solid #ffff55;z-index:1}
#mc.editing .tc::after{content:attr(data-label);position:absolute;left:50%;top:calc(100% + ${u(3)});transform:translateX(-50%);white-space:nowrap;background:#000b;padding:0 ${u(2)};text-shadow:var(--sh);color:#fff;pointer-events:none;font-size:var(--fs);line-height:1.3}
#mc.editing .tc.sel::after{color:#ffff55}
#mc.editing .bottom{z-index:6;opacity:.45;pointer-events:none}
#mc.editing .tools{display:none}
#mc.editing .bottom *{pointer-events:none}
.editor{position:absolute;inset:0;z-index:7;pointer-events:none}
.editor.grid{background-image:linear-gradient(#ffffff14 1px,transparent 1px),linear-gradient(90deg,#ffffff14 1px,transparent 1px);background-size:var(--snap,16px) var(--snap,16px)}
.edbar{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${u(170)};max-width:calc(100% - 8px);pointer-events:auto;background:#000000d0;border:${u(1)} solid #ffffff60;padding:${u(4)};display:flex;flex-direction:column;gap:${u(3)};text-shadow:var(--sh)}
.edbar.moved{transform:none}
.edhead{display:flex;align-items:center;gap:${u(3)};cursor:move;touch-action:none;color:#ffff55;min-height:${u(14)}}
.edhead span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.edbar.min>:not(.edhead){display:none}
.edsel{display:flex;align-items:center;gap:${u(3)}}.edsel b{flex:1;text-align:center;font-weight:normal}
.edhint{color:#a0a0a0;text-align:center;font-size:var(--fs)}`;

const SPLASH = ['무한한 세계!', '블록으로 무엇이든!', '밤에는 조심!', '다이아몬드를 찾아라!', '지하와 다른 차원을 탐험하세요!', '횃불은 소중해요', '작업대부터 만들어요', '이제 버튼도 옮길 수 있어요!', '설정이 더 많아졌어요!', '좀비는 햇빛을 싫어해요?', '모바일에서도 즐겨요!'];

// ── generated pixel textures for the GUI (no external UI images needed) ──
const UIT = {}, TICON = {};
function pixCanvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, w, h); return c; }
function pixURL(rows, colors) {
  return pixCanvas(rows[0].length, rows.length, g => { rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = colors[r[x]]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } } }); }).toDataURL();
}
// white icon with a soft dark drop shadow, used for touch buttons and small tool buttons
function iconURL(rows, color = '#ffffff') {
  const h = rows.length, w = rows[0].length;
  return pixCanvas(w + 1, h + 1, g => {
    for (const [dx, col] of [[1, 'rgba(0,0,0,.55)'], [0, color]]) { g.fillStyle = col; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') g.fillRect(x + dx, y + dx, 1, 1); }); }
  }).toDataURL();
}
const ICONS = {
  up: ['............', '.....##.....', '....####....', '...######...', '..########..', '.##########.', '....####....', '....####....', '....####....', '....####....', '....####....', '............'],
  sneak: ['............', '....####....', '....####....', '....####....', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............', '.##########.', '............'],
  mine: ['............', '..########..', '.##########.', '##...##...##', '#....##....#', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '............'],
  use: ['............', '.##########.', '.#........#.', '.#...##...#.', '.#...##...#.', '.#.######.#.', '.#.######.#.', '.#...##...#.', '.#...##...#.', '.#........#.', '.##########.', '............'],
  fly: ['............', '.....##.....', '....####....', '...##..##...', '..##....##..', '.....##.....', '....####....', '...##..##...', '..##....##..', '.##......##.', '............', '............'],
  sprint: ['............', '.##...##....', '..##...##...', '...##...##..', '....##...##.', '.....##...##', '....##...##.', '...##...##..', '..##...##...', '.##...##....', '............', '............'],
  drop: ['.....##.....', '.....##.....', '.....##.....', '...######...', '....####....', '.....##.....', '............', '.#........#.', '.#........#.', '.##########.', '............', '............'],
  chat: ['............', '.##########.', '.#........#.', '.#.######.#.', '.#........#.', '.#.####...#.', '.#........#.', '.####.#####.', '....#.#.....', '....##......', '....#.......', '............'],
  pause: ['............', '............', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '............', '............'],
  dots: ['............', '............', '............', '............', '............', '.##..##..##.', '.##..##..##.', '............', '............', '............', '............', '............'],
  full: ['............', '.####..####.', '.#........#.', '.#........#.', '.#........#.', '............', '............', '.#........#.', '.#........#.', '.#........#.', '.####..####.', '............'],
  bag: ['............', '....####....', '...#....#...', '.##########.', '.#........#.', '.#..####..#.', '.#..#..#..#.', '.#..####..#.', '.#........#.', '.#........#.', '.##########.', '............'],
  grid: ['............', '.####..####.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.', '............', '............', '.####..####.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.', '............'],
  view: ['............', '............', '...######...', '..#......#..', '.#...##...#.', '#...####...#', '#...####...#', '.#...##...#.', '..#......#..', '...######...', '............', '............'],
  swap: ['............', '..#.........', '.##.........', '#########...', '.##.........', '..#.........', '.........#..', '.........##.', '...#########', '.........##.', '.........#..', '............'],
  search: ['............', '...####.....', '..#....#....', '.#......#...', '.#......#...', '.#......#...', '.#......#...', '..#....#....', '...#####....', '.......###..', '........###.', '.........##.'],
};
function makeUITextures() {
  const rnd = mulberry32(7331);
  const stone = (base, spread, top) => pixCanvas(64, 20, g => {
    for (let y = 0; y < 20; y++) for (let x = 0; x < 64; x++) {
      let v = base + (rnd() - 0.5) * spread; if (rnd() < 0.06) v -= spread * 0.9; if (y < 2) v += top; v = clamp(Math.round(v), 0, 255);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
    }
  }).toDataURL();
  UIT.btn = stone(112, 13, 5); UIT.btnoff = stone(44, 8, 0);
  // hotbar strip (182×22) and selection frame (24×24)
  UIT.hot = pixCanvas(182, 22, g => {
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 180, 20);
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 20;
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 1, 2, 18, 18);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, 3, 16, 16);
      g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(x, 1, 20, 1); g.fillRect(x, 1, 1, 20);
      g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(x, 20, 20, 1); g.fillRect(x + 19, 1, 1, 20);
    }
    g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 182, 1); g.fillRect(0, 21, 182, 1); g.fillRect(0, 0, 1, 22); g.fillRect(181, 0, 1, 22);
  }).toDataURL();
  UIT.hsel = pixCanvas(24, 24, g => {
    g.fillStyle = '#000'; g.fillRect(1, 0, 22, 1); g.fillRect(1, 23, 22, 1); g.fillRect(0, 1, 1, 22); g.fillRect(23, 1, 1, 22);
    g.fillStyle = '#ffffff'; g.fillRect(1, 1, 22, 2); g.fillRect(1, 1, 2, 22);
    g.fillStyle = '#c8c8c8'; g.fillRect(1, 21, 22, 2); g.fillRect(21, 1, 2, 22);
    g.fillStyle = '#000'; g.fillRect(3, 3, 18, 1); g.fillRect(3, 20, 18, 1); g.fillRect(3, 3, 1, 18); g.fillRect(20, 3, 1, 18);
  }).toDataURL();
  UIT.hotend = pixCanvas(22, 22, g => {
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 20, 20);
    g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(1, 1, 20, 1); g.fillRect(1, 1, 1, 20);
    g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(1, 20, 20, 1); g.fillRect(20, 1, 1, 20);
    g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 22, 1); g.fillRect(0, 21, 22, 1); g.fillRect(0, 0, 1, 22); g.fillRect(21, 0, 1, 22);
    g.fillStyle = '#fff'; for (const x of [5, 10, 15]) g.fillRect(x, 10, 2, 2);
  }).toDataURL();
  const arrow = col => pixCanvas(22, 15, g => { g.fillStyle = col; for (let y = 0; y < 15; y++) for (let x = 0; x < 22; x++) { const head = x >= 13 && x - 13 <= 7 - Math.abs(y - 7), shaft = x < 13 && y >= 5 && y <= 9; if (head || shaft) g.fillRect(x, y, 1, 1); } }).toDataURL();
  UIT.arrow = arrow('#8b8b8b'); UIT.arrowf = arrow('#ffffff');
  const FL = ['......#.......', '......##......', '.....###......', '.....####.....', '....#####.#...', '...#######.#..', '...########...', '..##########..', '..####..####..', '.####....####.', '.###......###.', '.####....####.', '..##########..', '...########...'];
  UIT.flameoff = pixURL(FL, { '#': '#8b8b8b' });
  UIT.flame = pixCanvas(14, 14, g => { FL.forEach((r, y) => { for (let x = 0; x < 14; x++) if (r[x] === '#') { const t = y / 13; g.fillStyle = t < .35 ? '#ffe26a' : t < .7 ? '#ff9a1f' : '#e2461a'; g.fillRect(x, y, 1, 1); } }); }).toDataURL();
  UIT.book = pixURL(['................', '.##############.', '.#GGGGGGGGGGGW#.', '.#GLLLLLLLLLGW#.', '.#GLGGGGGGGLGW#.', '.#GLGYYYYYGLGW#.', '.#GLGGGGGGGLGW#.', '.#GLLLLLLLLLGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#GGGGGGGGGGGW#.', '.#DDDDDDDDDDDD#.', '.##############.', '................'],
    { '#': '#1e3a12', G: '#3f7d2a', L: '#6fb04a', Y: '#e8d27a', W: '#f2efe2', D: '#2a5a1a' });
  UIT.trash = pixURL(['................', '................', '...##......##...', '..#RR#....#RR#..', '..#RRR#..#RRR#..', '...#RRR##RRR#...', '....#RRRRRR#....', '.....#RRRR#.....', '.....#RRRR#.....', '....#RRRRRR#....', '...#RRR##RRR#...', '..#RRR#..#RRR#..', '..#RR#....#RR#..', '...##......##...', '................', '................'], { '#': '#3a0000', R: '#e23a3a' });
  UIT.x = pixURL(['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#'], { '#': '#ffffff' });
  UIT.pg = pixURL(['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....'], { '#': '#ffffff' });
  UIT.play = pixURL(['##.......', '####.....', '######...', '########.', '#########', '########.', '######...', '####.....', '##.......'], { '#': '#ffffff' });
  for (const k in ICONS) UIT['i_' + k] = iconURL(ICONS[k]);
  UIT.shield = pixURL(['................', '................', '...##########...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '...#XXXXXXXX#...', '....#XXXXXX#....', '....#XXXXXX#....', '.....#XXXX#.....', '......####......', '................', '................', '................', '................'], { '#': '#555', X: '#999' });
  UIT.offbg = pixCanvas(22, 22, g => { g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(1, 1, 20, 20); g.fillStyle = 'rgba(150,150,150,.85)'; g.fillRect(1, 1, 20, 1); g.fillRect(1, 1, 1, 20); g.fillStyle = 'rgba(80,80,80,.9)'; g.fillRect(1, 20, 20, 1); g.fillRect(20, 1, 1, 20); g.fillStyle = 'rgba(16,16,16,.95)'; g.fillRect(0, 0, 22, 1); g.fillRect(0, 21, 22, 1); g.fillRect(0, 0, 1, 22); g.fillRect(21, 0, 1, 22); }).toDataURL();
  Object.assign(TICON, { view: UIT.i_view, swap: UIT.i_swap, jump: UIT.i_up, mine: UIT.i_mine, use: UIT.i_use, sneak: UIT.i_sneak, sprint: UIT.i_sprint, fly: UIT.i_fly, down: iconURL(ICONS.up.slice().reverse()), drop: UIT.i_drop, chat: UIT.i_chat, pause: UIT.i_pause });
  // dark menu background made from the world's own dirt tile
  const dc = pixCanvas(16, 16, g => { const di = T.dirt; g.drawImage(atlasCanvas, (di % TPR) * TS, Math.floor(di / TPR) * TS, 16, 16, 0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, 16, 16); });
  UIT.dirt = dc.toDataURL();
  const mc = $('mc');
  for (const k of ['btn', 'btnoff', 'hot', 'hsel', 'hotend', 'offbg', 'arrow', 'arrowf', 'flameoff', 'flame', 'book', 'trash', 'x', 'pg', 'play', 'dirt']) mc.style.setProperty('--tx-' + k, `url(${UIT[k]})`);
  mc.style.setProperty('--ti-up', `url(${UIT.i_up})`); mc.style.setProperty('--ti-sneak', `url(${UIT.i_sneak})`);
  $('iInv').src = UIT.i_bag; $('iFull').src = UIT.i_full; $('iPause').src = UIT.i_pause;
}

function buildDOM() {
  root.innerHTML = `<style>${CSS}</style><section id="mc">
<canvas id="cv" tabindex="0" aria-label="3D 블록 월드"></canvas>
<div class="hud" id="hud">
 <div class="uw" id="uw"></div><div class="flash" id="flash"></div>
 <div class="cross" id="cross"></div><div class="atkind" id="atkind"><i></i></div><div class="dnums" id="dnums"></div><div class="iinfo" id="iinfo"></div><div class="sleepov" id="sleepov"></div>
 <div class="hinfo" id="hinfo"></div><div class="debug" id="debug"></div>
 <div class="chatlog" id="chatlog"></div>
 <div class="eat" id="eat"><i></i></div>
 <div class="tools"><button class="btn sq dk" id="bInv" aria-label="인벤토리" title="인벤토리 (E)"><img id="iInv" alt=""></button><button class="btn sq" id="bFull" aria-label="전체화면 전환" title="전체화면"><img id="iFull" alt=""></button><button class="btn sq dk" id="bPause" aria-label="일시정지" title="게임 메뉴 (Esc)"><img id="iPause" alt=""></button></div>
 <div class="touch" id="touch"></div>
 <div class="bottom" id="bottomHud"><div class="itemname" id="itemname"></div><div class="statrows"><div class="toprow"><div class="armor" id="armor"></div><div class="air" id="air"></div></div><div class="bars" id="bars"><div class="hr" id="hearts"></div><div class="hr food" id="food"></div></div></div><div class="hotbar" id="hotbar"></div></div>
</div>
<div class="screen" id="screen" hidden></div>
<div class="editor" id="editor" hidden></div>
<div class="toast" id="toast" role="status"></div>
<div class="cursor" id="cursor"></div><div class="tip" id="tip"></div>
</section>`;
  canvas = $('cv');
  $('hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="hs" data-hot="${i}" style="left:calc(var(--g)*${1 + i * 20})"></div>`).join('') + '<div class="hsel"></div><button id="hotInv" class="hot-inv" aria-label="인벤토리 열기"></button><div class="offhot" id="offhot" title="왼손"></div>';
  $('hearts').innerHTML = '<img alt="">'.repeat(10); $('food').innerHTML = '<img alt="">'.repeat(10); $('air').innerHTML = '<img alt="">'.repeat(10); $('armor').innerHTML = '<img alt="">'.repeat(10);
}
// GUI scale: "auto" picks the largest scale that still fits, like the original game's option
let guiG = 2;
function applyGui() {
  if (!root || !SAVE) return;
  const mc = $('mc'), W = mc.clientWidth || innerWidth, H = mc.clientHeight || innerHeight, tu = touchUI();
  let auto = 1; while (auto < 3 && W >= 320 * (auto + 1) && H >= 240 * (auto + 1)) auto++;
  if (tu && auto < 2 && Math.min(W, H) >= 300) auto = 2;
  guiG = clamp(+SAVE.settings.guiScale || auto, 1, 4);
  mc.style.setProperty('--g', guiG + 'px');
  mc.classList.toggle('narrow', W < 326 * guiG);
  mc.classList.toggle('short', H < 250 * guiG);
  mc.classList.toggle('touchui', tu);
}
function slotHTML(s) {
  if (!s) return '';
  const dm = durOf(s.id), dur = dm && s.dmg ? `<div class="dur"><i style="width:${Math.max(0, 100 - s.dmg / dm * 100)}%;background:hsl(${120 * (1 - s.dmg / dm)},90%,50%)"></i></div>` : '';
  return `<img class="ico" src="${ICON[s.id]}" alt="">${s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}${dur}`;
}
function tipHTML(id, s) {
  const inf = info(id); if (!inf) return '';
  let extra = '';
  const t = toolOf(id), a = armorOf(id), dm = durOf(id); if (dm && s) extra = `<div class="tl">내구도: ${dm - (s.dmg || 0)} / ${dm}</div>`;
  else if (inf.food) extra = `<div class="tl">허기 +${inf.food[0] / 2}</div>`;
  if (a) extra += `<div class="tl" style="color:#5555ff">방어력 +${a.def} (${ARMOR_SLOT_NAME[a.slot]})</div>`;
  if (inf.gadget === 'compass') extra += '<div class="tl">들고 있으면 리스폰 지점 방향을 알려줘요</div>';
  if (inf.gadget === 'clock') extra += '<div class="tl">들고 있으면 시간을 알려줘요</div>';
  if (t && t.aspd) extra += `<div class="tl" style="color:#55ff55">공격력 ${t.dmg} · 공격 속도 ${t.aspd}</div>`;
  return `<div>${esc(inf.name)}</div>${extra}`;
}
let nameTimer = 0, infoT = 0;
function updateHUD(dt) {
  if (!G) return;
  const st = SAVE.settings;
  if (invDirty) {
    invDirty = false;
    root.querySelectorAll('[data-hot]').forEach((el, i) => { el.innerHTML = slotHTML(G.inv[i]); });
    $('hotbar').style.setProperty('--sel', G.sel); updateArmorBar();
    const oh = $('offhot'); oh.innerHTML = slotHTML(G.off); oh.style.display = G.off ? 'flex' : 'none';
    if (TEL.swap) TEL.swap.classList.toggle('cond-off', !G.off);
    const s = held(); $('itemname').textContent = s ? info(s.id).name : ''; $('itemname').style.opacity = 1; nameTimer = 2.5;
  }
  if (nameTimer > 0) { nameTimer -= dt; if (nameTimer <= 0) $('itemname').style.opacity = 0; }
  const surv = G.mode === 'survival';
  $('bars').style.visibility = surv ? 'visible' : 'hidden';
  if (hudDirty && surv) {
    hudDirty = false;
    const hs = $('hearts').children, fs = $('food').children;
    for (let i = 0; i < 10; i++) {
      hs[i].src = HUDICON[P.health >= i * 2 + 2 ? 'heart_full' : P.health >= i * 2 + 1 ? 'heart_half' : 'heart_empty'];
      fs[i].src = HUDICON[P.hunger >= i * 2 + 2 ? 'food_full' : P.hunger >= i * 2 + 1 ? 'food_half' : 'food_empty'];
    }
    $('hearts').classList.toggle('shake', P.health <= 4);
    updateArmorBar();
  }
  $('sleepov').style.opacity = G.sleep > 0 ? Math.min(1, G.sleep / 1.6) : G.sleep < 0 ? -G.sleep : 0;
  { const ai = $('atkind'), str = attackStrength(), show = !G.ui && !classicCombat() && st.attackIndicator !== false && str < 0.999 && camView !== 2; ai.style.display = show ? 'block' : 'none'; if (show) ai.firstChild.style.width = (str * 100).toFixed(0) + '%'; }
  updateGadget();
  const bubbles = Math.ceil(P.airT / 1.5);
  const air = $('air');
  if (surv && P.airT < 15) { air.style.visibility = 'visible'; [...air.children].forEach((im, i) => { im.src = HUDICON.bubble; im.style.visibility = i < bubbles ? 'visible' : 'hidden'; }); } else air.style.visibility = 'hidden';
  if (G.hurtFlash > 0) { G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.5); }
  $('flash').style.opacity = G.hurtFlash || 0;
  $('uw').style.display = P.eyeInWater ? 'block' : 'none';
  const eat = $('eat'); eat.style.display = P.eating > 0 ? 'block' : 'none'; if (P.eating > 0) eat.firstChild.style.width = Math.min(100, P.eating / 1.6 * 100) + '%';
  if (TEL.fly) { TEL.fly.classList.toggle('cond-off', G.mode !== 'creative'); TEL.fly.classList.toggle('on', P.flying); }
  if (TEL.down) TEL.down.classList.toggle('cond-off', !P.flying && !P.inWater);
  if (TEL.sneak) TEL.sneak.classList.toggle('on', touchSneak);
  if (TEL.sprint) TEL.sprint.classList.toggle('on', touchSprint);
  if (TEL.move && st.moveStyle === 'dpad') { const c = TEL.move.querySelector('.c'); if (c) c.classList.toggle('on', touchSneak); }
  // optional coordinate / FPS overlay
  infoT -= dt;
  if (infoT <= 0) {
    infoT = 0.25;
    const lines = [];
    if (st.showFps) lines.push(`${fpsShow} FPS`);
    if (st.showCoords) lines.push(`위치: ${Math.floor(P.x)}, ${Math.floor(P.y)}, ${Math.floor(P.z)}`, `${dayCount()}일째 · ${['북', '동', '남', '서'][((Math.round(P.yaw / (Math.PI / 2)) % 4) + 4) % 4]}쪽`);
    const hi = $('hinfo'); hi.style.display = lines.length && !showDebug ? 'flex' : 'none'; hi.innerHTML = lines.map(l => `<div>${esc(l)}</div>`).join('');
  }
  // chat fade
  for (const el of $('chatlog').children) { const age = (performance.now() - el.dataset.t) / 1000; el.style.opacity = G.ui === 'chat' ? 1 : age > 8 ? 0 : 1; }
  while ($('chatlog').children.length > 10) $('chatlog').firstChild.remove();
}
function updateArmorBar() {
  const ar = $('armor'), [def] = armorPoints(), show = def > 0 && G.mode === 'survival';
  ar.style.visibility = show ? 'visible' : 'hidden';
  if (show) [...ar.children].forEach((im, i) => { im.src = HUDICON[def >= i * 2 + 2 ? 'armor_full' : def >= i * 2 + 1 ? 'armor_half' : 'armor_empty']; });
}
let gadgetKey = '';
function updateGadget() {
  const el = $('iinfo'), s = held(), g = s && ITEM[s.id] && ITEM[s.id].gadget;
  let key = '', html = '';
  if (g === 'compass' && !G.ui) {
    const dx = G.spawn.x - P.x, dz = G.spawn.z - P.z, d = Math.hypot(dx, dz), a = Math.atan2(dx, -dz) - P.yaw;
    key = 'c' + Math.round(d) + ',' + Math.round(a * 20);
    html = `<i class="ndl" style="transform:rotate(${a.toFixed(2)}rad)"></i><span>${d < 2 ? '리스폰 지점이에요' : `리스폰 지점까지 ${Math.round(d)}m`}</span>`;
  } else if (g === 'clock' && !G.ui) {
    const tt = W.time % DAY_TICKS, mins = Math.floor(((tt / 1000 + 6) % 24) * 60), hh = Math.floor(mins / 60), mm = mins % 60;
    const ph = tt < 12000 ? '낮' : tt < 13800 ? '해 질 녘' : tt < 22200 ? '밤' : '새벽';
    key = 't' + hh + ':' + mm; html = `<span>${dayCount()}일째 · ${ph} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`;
  }
  if (key === gadgetKey) return; gadgetKey = key;
  el.style.display = key ? 'flex' : 'none'; if (key) el.innerHTML = html;
}
let toastT = 0;
function toast(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { if (t.isConnected) t.style.opacity = 0; }, 2600); }
function chat(msg, color) { const d = document.createElement('div'); d.textContent = msg; d.dataset.t = performance.now(); if (color) d.style.color = color; $('chatlog').append(d); }
function buzz(ms) { if (SAVE && SAVE.settings.vibrate && touchUI() && navigator.vibrate) { try { navigator.vibrate(ms); } catch { } } }

// ── screen management ──
let cursorStack = null, quickMove = false, oneMode = false, creativeTab = '전체', creativeSearch = '';
let rbOpen = null, rbTab = '전체', rbSearch = '', rbCraftable = false, rbPage = 0, ghost = null;
function openScreen(kind) {
  if (G.ui === 'death') return;
  input.mine = input.use = input.jump = false; input.fwd = input.side = 0; input.sprintKey = touchSprint; resetTouchHolds(); P.mining = null;
  P.draw = 0; P.eating = 0; // opening a screen mid-draw used to fire the arrow from inside the inventory
  if (kind === 'table') G.craft = Array(9).fill(null), G.craftW = 3;
  else if (kind === 'inventory') G.craft = Array(4).fill(null), G.craftW = 2;
  G.ui = kind === 'table' || kind === 'inventory' || kind === 'creative' ? kind : (kind === 'furnace' || kind === 'chest') ? 'container' : kind;
  G.uiKind = kind; ghost = null; rbPage = 0;
  if (rbOpen === null) rbOpen = SAVE.settings.recipeBook ?? !($('mc').classList.contains('narrow') || ($('mc').classList.contains('short') && touchUI()));
  releasePointer();
  renderScreen();
}
function closeScreen() {
  if (!G) return;
  // return items in craft grid and cursor
  if (G.craft) { for (const s of G.craft) if (s) { const l = addToInventory(s.id, s.count, s.dmg); if (l) spawnItem(s.id, l, P.x, P.y + 1.2, P.z, s.dmg); } G.craft = null; }
  if (cursorStack) { const l = addToInventory(cursorStack.id, cursorStack.count, cursorStack.dmg); if (l) spawnItem(cursorStack.id, l, P.x, P.y + 1.2, P.z, cursorStack.dmg); cursorStack = null; }
  if (G.ui === 'container') G.container = null;
  G.ui = null; G.uiKind = null; ghost = null;
  hideScreens(); invChanged();
  capture();
}
function hideScreens() { menuScreen = null; const s = $('screen'); s.hidden = true; s.className = 'screen'; s.innerHTML = ''; $('cursor').innerHTML = ''; $('tip').style.display = 'none'; if (G && G.ui !== 'title') G.ui = null; }
function slotEl(ref, cls = '') { return `<div class="slot ${cls}" data-slot="${ref}"></div>`; }
function invGrid() {
  return `<div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('inv:' + (i + 9))).join('')}</div><div class="invgap"></div>
  <div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>`;
}
const touchTools = () => `<div class="mobtools"><button class="tgl ${quickMove ? 'on' : ''}" data-act="quick">빠른 이동</button><button class="tgl ${oneMode ? 'on' : ''}" data-act="one">1개씩</button></div>`;
const contHead = (title, extra = '') => `<div class="chead"><span class="ctitle">${title}</span>${extra}<span class="sp"></span>${touchTools()}<button class="xbtn" data-act="close" aria-label="닫기" title="닫기 (E)"></button></div>`;
const RB_TABS = [['전체', null], ['도구', ['도구', '전투']], ['블록', ['블록', '장식', '기능']], ['기타', ['재료', '음식']]];
function recipeBookHTML() {
  return `<div class="panel rbook" aria-label="레시피 책"><div class="rhead"><input class="mfield" id="rsearch" placeholder="검색..." value="${esc(rbSearch)}" aria-label="레시피 검색"><button class="tgl ${rbCraftable ? 'on' : ''}" data-act="rfilter" title="제작 가능한 것만 보기">제작 가능</button></div>
  <div class="rtabs">${RB_TABS.map(([t]) => `<button class="rtab ${t === rbTab ? 'on' : ''}" data-act="rtab" data-t="${t}">${t}</button>`).join('')}</div>
  <div class="rgrid" id="recipes"></div>
  <div class="rpage"><button class="pg prev" data-act="rprev" aria-label="이전 쪽"></button><span id="rpg">1/1</span><button class="pg" data-act="rnext" aria-label="다음 쪽"></button></div></div>`;
}
const CR_TABS = [['블록', BRICKS], ['장식', FLOWER_RED], ['기능', CHEST], ['도구', PICK0 + 2], ['전투', ARMOR0 + 9], ['음식', APPLE], ['재료', IRON]];
function renderScreen() {
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-cont'; menuScreen = 'cont';
  const k = G.uiKind; recipeCache = null;
  if (k === 'inventory' || k === 'table') {
    const w = G.craftW;
    s.innerHTML = `<div class="cwrap">${rbOpen ? recipeBookHTML() : ''}<div class="panel" role="dialog" aria-label="${k === 'table' ? '작업대' : '인벤토리'}">${contHead('제작', `<button class="bookbtn ${rbOpen ? 'on' : ''}" data-act="book" aria-label="레시피 책" title="레시피 책"></button>`)}
    <div class="craft">${k === 'inventory' ? `<div class="armcol" title="갑옷">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><div class="pcol"><canvas class="pview" id="pview" width="16" height="32" aria-label="내 캐릭터"></canvas>${slotEl('off:0')}</div>` : ''}<span class="sp"></span><div class="grid g${w}">${G.craft.map((_, i) => slotEl('craft:' + i)).join('')}</div><div class="carrow"></div>${slotEl('out', 'big')}</div>
    <div class="ctitle sub" id="invsub">인벤토리</div>${invGrid()}</div></div>`;
    const inp = $('rsearch'); if (inp) { inp.addEventListener('input', () => { rbSearch = inp.value; rbPage = 0; renderRecipes(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'creative') {
    const tab = creativeTab, title = tab === '전체' ? '아이템 검색' : tab === '인벤토리' ? '생존 인벤토리' : tab;
    const tabBtn = (t, icon, name) => `<button class="crtab ${t === tab ? 'on' : ''}" data-tab="${t}" data-name="${name || t}" aria-label="${name || t}"><img class="ico" src="${icon}" alt=""></button>`;
    s.innerHTML = `<div class="cr"><div class="crtabs">${CR_TABS.map(([t, id]) => tabBtn(t, ICON[id])).join('')}<span class="sp"></span>${tabBtn('전체', UIT.i_search, '아이템 검색')}</div>
    <div class="panel crp" role="dialog" aria-label="크리에이티브 인벤토리">${contHead(title)}
    ${tab === '인벤토리' ? `<div class="hotrow" style="margin:0 0 ${u(3)}"><span class="ctitle" id="invsub">갑옷</span><span class="sp"></span><div class="armrow">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><span class="ctitle">왼손</span>${slotEl('off:0')}</div>` + invGrid() + `<div class="hotrow"><span class="sp"></span><span class="ctitle">버리기</span>${slotEl('trash', 'trash')}</div>`
      : `${tab === '전체' ? `<input class="mfield csearch" id="csearch" placeholder="아이템 검색..." value="${esc(creativeSearch)}" aria-label="아이템 검색">` : ''}<div class="palette" id="palette"></div>
      <div class="hotrow"><div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>${slotEl('trash', 'trash')}</div>`}</div>
    <div class="crtabs bot"><span class="sp"></span>${tabBtn('인벤토리', ICON[CHEST], '생존 인벤토리')}</div></div>`;
    renderPalette();
    const inp = $('csearch'); if (inp) { inp.addEventListener('input', () => { creativeSearch = inp.value; renderPalette(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'furnace') {
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="화로">${contHead('화로')}
    <div class="furn"><div class="fcol">${slotEl('c:0')}<div class="flame"><i id="fflame"></i></div>${slotEl('c:1')}</div><div class="carrow"><i id="farrow"></i></div>${slotEl('c:2', 'big')}</div>
    <div class="ctitle sub">인벤토리</div>${invGrid()}</div></div>`;
  } else if (k === 'chest') {
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="상자">${contHead('상자')}
    <div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('c:' + i)).join('')}</div><div class="ctitle sub">인벤토리</div>${invGrid()}</div></div>`;
  }
  if (touchUI()) s.insertAdjacentHTML('beforeend', '<div class="touch-held" id="touchHeld" role="status"></div>');
  renderSlots();
}
function ghostMap() {
  if (ghost == null || !G.craft) return null;
  const r = RECIPES[ghost], m = {}, rep = k => typeof k === 'string' ? GROUP[k][0] : k;
  if (r.items) r.items.forEach((k, i) => { m[i] = rep(k); });
  else r.pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ' ') m[y * G.craftW + x] = rep(r.keys[row[x]]); });
  return m;
}
function renderSlots() {
  const s = $('screen'); if (s.hidden) return;
  const gm = ghostMap();
  s.querySelectorAll('[data-slot]').forEach(el => {
    const r = el.dataset.slot; if (r.startsWith('pal:') || r === 'trash') return;
    const st = getSlot(r);
    if (r.startsWith('craft:')) { const gi = +r.slice(6), gid = gm && !st ? gm[gi] : null; el.classList.toggle('ghosted', gid != null); el.innerHTML = st ? slotHTML(st) : gid != null ? `<img class="ico ghost" src="${ICON[gid]}" alt="">` : ''; return; }
    if (r === 'off:0') { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${UIT.shield}" alt="">`; el.title = '왼손'; return; }
    if (r.startsWith('arm:')) { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${ICON[ARMOR0 + 8 + +r.slice(4)]}" alt="">`; el.title = ARMOR_SLOT_NAME[+r.slice(4)]; return; }
    el.innerHTML = slotHTML(st);
  });
  const out = s.querySelector('[data-slot="out"]');
  if (out) { const r = craftResult(); out.classList.toggle('ghosted', !r && ghost != null); out.innerHTML = r ? slotHTML(r) : ghost != null ? `<img class="ico ghost" src="${ICON[RECIPES[ghost].out]}" alt="">` : ''; }
  $('cursor').innerHTML = slotHTML(cursorStack);
  const held = $('touchHeld'); if (held) { held.innerHTML = cursorStack ? `<span class="held-slot">${slotHTML(cursorStack)}</span><span>${esc(info(cursorStack.id).name)} · 놓을 칸을 누르거나, 끌어서 여러 칸에 나눠 놓으세요</span>` : '<span>끌어서 옮기기 · 길게 눌러 반 나누기 · 두 번 탭해 빠른 이동</span>'; }
  const pv = $('pview'); if (pv) drawPortrait(pv, G.armor);
  const sub = $('invsub'); if (sub && G.armor) { const [def] = armorPoints(); sub.textContent = (G.uiKind === 'creative' ? '갑옷' : '인벤토리') + (def ? ` · 방어력 ${def}` : ''); }
  if (G.uiKind === 'furnace' && G.container) { const te = G.container.te; const f = $('fflame'), a = $('farrow'); if (f) f.style.height = (te.burn > 0 ? te.burn / te.burnMax * 100 : 0) + '%'; if (a) a.style.width = (te.cook / SMELT_TIME * 100) + '%'; }
  if (G.uiKind === 'inventory' || G.uiKind === 'table') renderRecipes();
}
function getSlot(ref) {
  const [k, i] = ref.split(':');
  if (k === 'inv') return G.inv[+i];
  if (k === 'craft') return G.craft[+i];
  if (k === 'c') return G.container.te.slots[+i];
  if (k === 'arm') return G.armor[+i];
  if (k === 'off') return G.off;
  if (k === 'out') return craftResult();
  return null;
}
function setSlot(ref, v) {
  const [k, i] = ref.split(':');
  if (k === 'inv') G.inv[+i] = v; else if (k === 'craft') G.craft[+i] = v; else if (k === 'c') G.container.te.slots[+i] = v; else if (k === 'arm') G.armor[+i] = v; else if (k === 'off') G.off = v;
}
function craftResult() { if (!G.craft) return null; const r = craft(G.craft.map(s => s ? s.id : 0), G.craftW); return r ? { id: r.id, count: r.count, dmg: 0 } : null; }
function consumeGrid() { for (let i = 0; i < G.craft.length; i++) { const s = G.craft[i]; if (s) { s.count--; if (s.count <= 0) { G.craft[i] = s.id === WATER_BUCKET ? { id: BUCKET, count: 1, dmg: 0 } : null; } } } }
const clone = s => s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null;
const same = (a, b) => a && b && a.id === b.id && maxStack(a.id) > 1;
function moveToRange(stack, from, to, accept) {
  for (const pass of [0, 1]) for (let i = from; i < to; i++) {
    const ref = typeof accept === 'string' ? accept + i : 'inv:' + i;
    const cur = getSlot(ref);
    if (pass === 0 && same(cur, stack)) { const k = Math.min(maxStack(stack.id) - cur.count, stack.count); cur.count += k; stack.count -= k; }
    else if (pass === 1 && !cur) { setSlot(ref, clone(stack)); stack.count = 0; }
    if (!stack.count) return null;
  }
  return stack;
}
function shiftMove(ref) {
  const st = getSlot(ref); if (!st) return;
  const [k, idx] = ref.split(':'), i = +idx;
  let rest;
  const am = armorOf(st.id);
  if (k === 'inv' && am && (G.uiKind === 'inventory' || G.uiKind === 'creative') && !G.armor[am.slot]) { G.armor[am.slot] = st; setSlot(ref, null); sfx('equip'); return; }
  if (k === 'inv') {
    if (G.uiKind === 'chest') rest = moveToRange(st, 0, 27, 'c:');
    else if (G.uiKind === 'furnace') { const tgt = SMELT[st.id] != null ? 0 : FUEL[st.id] ? 1 : -1; rest = st; if (tgt >= 0) { const cur = G.container.te.slots[tgt]; if (!cur) { G.container.te.slots[tgt] = clone(st); rest = null; } else if (same(cur, st)) { const n = Math.min(maxStack(st.id) - cur.count, st.count); cur.count += n; st.count -= n; rest = st.count ? st : null; } } }
    else rest = i < 9 ? moveToRange(st, 9, 36) : moveToRange(st, 0, 9);
    setSlot(ref, rest && rest.count ? rest : null);
  } else {
    rest = moveToRange(st, 0, 36); setSlot(ref, rest && rest.count ? rest : null);
  }
}
function slotClick(ref, right, shift) {
  shift = shift || quickMove; right = right || oneMode;
  if (ghost != null && !ref.startsWith('pal:')) ghost = null;
  if (ref === 'trash') { if (shift && G.mode === 'creative') { for (let i = 0; i < 36; i++) G.inv[i] = null; } cursorStack = null; renderSlots(); invChanged(); return; }
  if (ref.startsWith('pal:')) {
    const id = +ref.slice(4);
    if (cursorStack) cursorStack = null;
    else if (shift) addToInventory(id, maxStack(id));
    else cursorStack = { id, count: right ? 1 : maxStack(id), dmg: 0 };
    renderSlots(); invChanged(); return;
  }
  if (ref === 'out') {
    const r = craftResult(); if (!r) return;
    if (shift) { let n = 0; while (n++ < 64) { const r2 = craftResult(); if (!r2 || r2.id !== r.id) break; const left = addToInventory(r2.id, r2.count); consumeGrid(); if (left) { spawnItem(r2.id, left, P.x, P.y + 1.2, P.z); break; } } }
    else if (!cursorStack) { cursorStack = r; consumeGrid(); }
    else if (cursorStack.id === r.id && cursorStack.count + r.count <= maxStack(r.id)) { cursorStack.count += r.count; consumeGrid(); }
    sfx('craft'); G.stats.crafted++;
    renderSlots(); invChanged(); return;
  }
  if (ref === 'c:2' && G.uiKind === 'furnace') {
    const st = getSlot(ref); if (!st) return;
    if (shift) { shiftMove(ref); }
    else if (!cursorStack) { cursorStack = st; setSlot(ref, null); }
    else if (same(cursorStack, st)) { const k = Math.min(maxStack(st.id) - cursorStack.count, st.count); cursorStack.count += k; st.count -= k; if (!st.count) setSlot(ref, null); }
    renderSlots(); invChanged(); return;
  }
  if (ref.startsWith('arm:')) {
    const ai = +ref.slice(4), st = G.armor[ai];
    if (shift) { if (st && !addToInventory(st.id, 1, st.dmg)) G.armor[ai] = null; }
    else if (cursorStack) {
      const a = armorOf(cursorStack.id);
      if (!a || a.slot !== ai) { toast(ARMOR_SLOT_NAME[ai] + ' 칸에는 ' + ARMOR_SLOT_NAME[ai] + ' 갑옷만 넣을 수 있어요.'); return; }
      G.armor[ai] = cursorStack; cursorStack = st; sfx('equip');
    } else if (st) { cursorStack = st; G.armor[ai] = null; }
    renderSlots(); invChanged(); return;
  }
  if (shift) { shiftMove(ref); renderSlots(); invChanged(); return; }
  const st = getSlot(ref);
  if (!right) {
    if (!cursorStack) { if (st) { cursorStack = st; setSlot(ref, null); } }
    else if (!st) { setSlot(ref, cursorStack); cursorStack = null; }
    else if (same(st, cursorStack)) { const k = Math.min(maxStack(st.id) - st.count, cursorStack.count); st.count += k; cursorStack.count -= k; if (!cursorStack.count) cursorStack = null; }
    else { setSlot(ref, cursorStack); cursorStack = st; }
  } else {
    if (!cursorStack) { if (st) { const h = Math.ceil(st.count / 2); cursorStack = { id: st.id, count: h, dmg: st.dmg }; st.count -= h; if (!st.count) setSlot(ref, null); } }
    else if (!st) { setSlot(ref, { id: cursorStack.id, count: 1, dmg: cursorStack.dmg }); cursorStack.count--; if (!cursorStack.count) cursorStack = null; }
    else if (same(st, cursorStack) && st.count < maxStack(st.id)) { st.count++; cursorStack.count--; if (!cursorStack.count) cursorStack = null; }
    else { setSlot(ref, cursorStack); cursorStack = st; }
  }
  renderSlots(); invChanged();
}
// recipe book
function recipeNeeds(r) {
  const need = [];
  if (r.items) r.items.forEach(k => need.push(k));
  else r.pattern.forEach(row => { for (const ch of row) if (ch !== ' ') need.push(r.keys[ch]); });
  return need;
}
function canFill(r) {
  if (r.pattern && (r.pattern.length > G.craftW || Math.max(...r.pattern.map(s => s.length)) > G.craftW)) return false;
  const pool = [...G.inv, ...G.craft].filter(Boolean).map(clone);
  for (const key of recipeNeeds(r)) { const s = pool.find(p => p.count > 0 && matches(key, p.id)); if (!s) return false; s.count--; }
  return true;
}
let recipeCache = null;
function recipeList() {
  const seen = new Set(), list = [];
  for (const r of RECIPES) { if (r.pattern && (r.pattern.length > G.craftW || Math.max(...r.pattern.map(s => s.length)) > G.craftW)) continue; if (seen.has(r.out)) continue; seen.add(r.out); list.push(r); }
  return list;
}
function renderRecipes() {
  const el = $('recipes'); if (!el) return;
  const q = rbSearch.trim(), tab = RB_TABS.find(t => t[0] === rbTab) || RB_TABS[0];
  let list = recipeList().filter(r => { const inf = info(r.out); if (q && !inf.name.includes(q)) return false; return !tab[1] || tab[1].includes(inf.cat || '블록'); });
  const ok = new Map(list.map(r => [r, canFill(r)]));
  if (rbCraftable) list = list.filter(r => ok.get(r));
  list.sort((a, b) => ok.get(b) - ok.get(a));
  const pages = Math.max(1, Math.ceil(list.length / 20)); rbPage = clamp(rbPage, 0, pages - 1);
  const key = [rbTab, q, rbCraftable, rbPage, G.craftW, list.map(r => RECIPES.indexOf(r) + (ok.get(r) ? '+' : '-')).join(',')].join('|');
  if (recipeCache === key && el.children.length) return;
  recipeCache = key;
  el.innerHTML = list.slice(rbPage * 20, rbPage * 20 + 20).map(r => `<div class="rslot ${ok.get(r) ? 'ok' : 'no'}" data-recipe="${RECIPES.indexOf(r)}" data-name="${esc(info(r.out).name)}${r.count > 1 ? ' ×' + r.count : ''}"><img class="ico" src="${ICON[r.out]}" alt="">${r.count > 1 ? `<span class="cnt">${r.count}</span>` : ''}</div>`).join('')
    || `<p class="rempty">${rbCraftable ? '지금 만들 수 있는 게 없어요' : '결과가 없어요'}</p>`;
  const pg = $('rpg'); if (pg) pg.textContent = `${rbPage + 1}/${pages}`;
  const sc = $('screen'); const pv = sc.querySelector('[data-act="rprev"]'), nx = sc.querySelector('[data-act="rnext"]'); if (pv) pv.disabled = rbPage <= 0; if (nx) nx.disabled = rbPage >= pages - 1;
}
function fillRecipe(ri) {
  const r = RECIPES[ri];
  // tapping the same recipe again adds one more set to every filled grid cell
  const cur = craftResult();
  if (cur && cur.id === r.out && ghost == null) {
    const need = {}; G.craft.forEach(s => { if (s) need[s.id] = (need[s.id] || 0) + 1; });
    if (G.craft.some(s => s && s.count >= maxStack(s.id))) { toast('더 이상 넣을 수 없어요.'); return; }
    for (const id in need) if (G.inv.reduce((a, s) => a + (s && s.id === +id ? s.count : 0), 0) < need[id]) { toast('재료가 부족해서 더 넣을 수 없어요.'); return; }
    for (const s of G.craft) if (s) { const i = G.inv.findIndex(x => x && x.id === s.id); G.inv[i].count--; if (!G.inv[i].count) G.inv[i] = null; s.count++; }
    renderSlots(); invChanged(); return;
  }
  if (!canFill(r)) {
    const names = {}; for (const k of recipeNeeds(r)) { const n = typeof k === 'string' ? ({ log: '아무 원목', planks: '나무 판자', wool: '양털' })[k] : info(k).name; names[n] = (names[n] || 0) + 1; }
    ghost = ri; renderSlots();
    toast('필요: ' + Object.entries(names).map(([n, c]) => `${n} ×${c}`).join(', ')); return;
  }
  ghost = null;
  for (let i = 0; i < G.craft.length; i++) if (G.craft[i]) { addToInventory(G.craft[i].id, G.craft[i].count, G.craft[i].dmg); G.craft[i] = null; }
  const take = key => { for (let i = 0; i < 36; i++) { const s = G.inv[i]; if (s && matches(key, s.id)) { s.count--; const one = { id: s.id, count: 1, dmg: 0 }; if (!s.count) G.inv[i] = null; return one; } } return null; };
  if (r.items) r.items.forEach((k, i) => { G.craft[i] = take(k); });
  else r.pattern.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ' ') G.craft[y * G.craftW + x] = take(r.keys[row[x]]); });
  renderSlots(); invChanged();
}
function renderPalette() {
  const el = $('palette'); if (!el) return;
  const ids = [];
  for (let id = 1; id < 256; id++) { const b = BLOCK[id]; if (b && b.creative !== false) ids.push(id); }
  for (const id in ITEM) ids.push(+id);
  const q = creativeTab === '전체' ? creativeSearch.trim() : '';
  const list = ids.filter(id => { const inf = info(id); if (q && !inf.name.includes(q)) return false; if (creativeTab === '전체') return true; return (inf.cat || '블록') === creativeTab; });
  el.innerHTML = list.map(id => `<div class="slot" data-slot="pal:${id}" data-name="${esc(info(id).name)}"><img class="ico" src="${ICON[id]}" alt=""></div>`).join('') || '<p class="pe">결과가 없어요.</p>';
}
let lastPtrSlot = 0;
function screenEvents() {
  const s = $('screen');
  const handle = (e, right) => {
    const sl = e.target.closest('[data-slot]'), rc = e.target.closest('[data-recipe]'), act = e.target.closest('[data-act]'), tab = e.target.closest('[data-tab]'), opt = e.target.closest('[data-opt]');
    if (e.target.closest('button,.we,[data-recipe]')) uiClick();
    if (sl && G && G.ui) { if (performance.now() - lastPtrSlot > 900) slotClick(sl.dataset.slot, right, e.shiftKey); return; }
    if (rc) { fillRecipe(+rc.dataset.recipe); return; }
    if (tab) { creativeTab = tab.dataset.tab; renderScreen(); return; }
    if (opt && opt.tagName === 'BUTTON') { cycleOpt(opt.dataset.opt, e.shiftKey ? -1 : 1, opt); return; }
    if (act && !act.disabled) menuAction(act.dataset.act, act, e);
  };
  ctx.on(s, 'click', e => handle(e, false));
  ctx.on(s, 'dblclick', e => { const w = e.target.closest('.we'); if (w) { selectedWorld = w.dataset.id; menuAction('play'); } });
  ctx.on(s, 'contextmenu', e => { e.preventDefault(); }); // right clicks on slots are handled by the pointer code below
  ctx.on(s, 'input', e => { const sl = e.target.closest('.slider [data-opt]'); if (sl) setOpt(sl.dataset.opt, +sl.value, sl); });
  ctx.on(s, 'pointermove', e => {
    const r = $('mc').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = $('cursor'); cur.style.left = x + 'px'; cur.style.top = y + 'px';
    const tip = $('tip'), el = e.target.closest('[data-slot],[data-recipe],.crtab');
    let html = '';
    if (el) {
      if (el.dataset.slot === 'out') { const o = craftResult(); if (o) html = tipHTML(o.id, o); else if (ghost != null) html = tipHTML(RECIPES[ghost].out); }
      else if (el.dataset.slot && el.dataset.slot.startsWith('pal:')) html = tipHTML(+el.dataset.slot.slice(4));
      else if (el.dataset.slot === 'trash') html = '<div>아이템 버리기</div>';
      else if (el.dataset.slot) { const st = getSlot(el.dataset.slot); if (st) html = tipHTML(st.id, st); }
      else if (el.dataset.recipe) { const rr = RECIPES[+el.dataset.recipe]; html = tipHTML(rr.out) + (canFill(rr) ? '' : '<div class="tl" style="color:#ff5555">재료가 부족해요</div>'); }
      else if (el.dataset.name) html = `<div>${esc(el.dataset.name)}</div>`;
    }
    if (html && e.pointerType === 'mouse' && !cursorStack) { tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 4) + 'px'; tip.style.top = Math.max(2, y - tip.offsetHeight - 6) + 'px'; } else tip.style.display = 'none';
  });
  // ── slot drag & drop (touch and mouse) ──
  // tap: pick up / put down · drag a stack: carry it to another slot (swaps if occupied, leftovers go back)
  // drag while already holding a stack: spread it evenly over every slot you cross (1 each in "1개씩" mode)
  // long-press: take half / place one · long-press the craft result: craft as many as possible
  // double-tap: quick-move to the other section · palette: swipe to scroll, hold then drag to take
  let D = null, lastTap = null;
  const placeable = r => !!r && !r.startsWith('pal:') && r !== 'out' && r !== 'trash' && !(r === 'c:2' && G.uiKind === 'furnace');
  const canSpread = r => placeable(r) && !r.startsWith('arm:') && !!cursorStack && (!getSlot(r) || (same(getSlot(r), cursorStack) && getSlot(r).count < maxStack(cursorStack.id)));
  const slotAt = (x, y) => { const rn = root.getRootNode ? root.getRootNode() : document, h = (rn && rn.elementFromPoint ? rn : document).elementFromPoint(x, y), el = h && h.closest ? h.closest('[data-slot]') : null; return el && s.contains(el) ? el : null; };
  const slotNode = r => s.querySelector(`[data-slot="${r}"]`);
  const clearHL = () => s.querySelectorAll('.slot.hl').forEach(e => e.classList.remove('hl', 'spread'));
  const dragCur = (on, x, y) => { const c = $('cursor'); c.classList.toggle('drag', on && D && D.touch); if (x != null) { const r = $('mc').getBoundingClientRect(); c.style.left = (x - r.left) + 'px'; c.style.top = (y - r.top) + 'px'; } };
  // Long-press is decided from the events' own timestamps, not from the timer firing first, so a busy
  // frame on a slow phone can't turn a quick drag into a long-press. The timer only gives feedback.
  const LONG_MS = 420;
  const isLong = (d, ts) => d.touch && !quickMove && ts - d.t0 >= LONG_MS;
  const longFeedback = d => { if (D !== d || d.moved || !G || !G.ui) return; buzz(15); d.el.classList.add('hl'); };
  const startDrag = (d, ts) => {
    if (isLong(d, ts) && !d.pal && d.ref !== 'out' && !d.had && getSlot(d.ref)) { slotClick(d.ref, true, false); d.mode = 'carry'; return; } // hold, then drag = take half
    if (isLong(d, ts) && d.pal) { const id = +d.ref.slice(4); cursorStack = { id, count: maxStack(id), dmg: 0 }; d.mode = 'carry'; renderSlots(); return; }
    if (d.pal) { if (Math.abs(d.y - d.y0) > Math.abs(d.x - d.x0)) { d.mode = 'scroll'; d.scrollEl = d.el.closest('.palette'); d.st0 = d.scrollEl ? d.scrollEl.scrollTop : 0; return; } const id = +d.ref.slice(4); cursorStack = { id, count: d.right ? 1 : maxStack(id), dmg: 0 }; d.mode = 'carry'; renderSlots(); return; }
    if (d.had && cursorStack) { d.mode = 'spread'; if (canSpread(d.ref)) d.visited.push(d.ref); return; }
    if (d.ref === 'out' ? !craftResult() : !getSlot(d.ref) || d.ref === 'trash') { d.mode = 'scroll'; d.scrollEl = s; d.st0 = s.scrollTop; return; }
    slotClick(d.ref, d.right, false); d.mode = cursorStack ? 'carry' : null;
  };
  ctx.on(s, 'pointerdown', e => {
    if (!G || !G.ui || D) return;
    const sl = e.target.closest('[data-slot]'); if (!sl) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const ref = sl.dataset.slot, touch = e.pointerType !== 'mouse';
    D = { pid: e.pointerId, ref, el: sl, t0: e.timeStamp, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch, right: e.button === 2, shift: e.shiftKey, moved: false, mode: null, had: !!cursorStack, visited: [], pal: ref.startsWith('pal:') };
    if (touch && !quickMove) { const d = D; d.timer = ctx.timeout(() => longFeedback(d), LONG_MS); }
    try { s.setPointerCapture(e.pointerId); } catch { }
  });
  ctx.on(s, 'pointermove', e => {
    const d = D; if (!d || d.pid !== e.pointerId) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(d.x - d.x0, d.y - d.y0) > (d.touch ? 9 : 4)) { d.moved = true; clearTimeout(d.timer); d.el.classList.remove('hl'); startDrag(d, e.timeStamp); }
    if (d.mode === 'scroll') { if (d.scrollEl) d.scrollEl.scrollTop = d.st0 - (d.y - d.y0); return; }
    if (!d.mode) return;
    clearHL(); dragCur(true, d.x, d.y);
    const tg = slotAt(d.x, d.y), tr = tg && tg.dataset.slot;
    if (d.mode === 'spread') {
      if (tr && !d.visited.includes(tr) && canSpread(tr)) d.visited.push(tr);
      d.visited.forEach(r => { const n = slotNode(r); if (n) n.classList.add('hl', 'spread'); });
    } else if (tg) tg.classList.add('hl');
  });
  const spread = (list, one) => {
    const per = one ? 1 : Math.max(1, Math.floor(cursorStack.count / list.length));
    for (const r of list) {
      if (!cursorStack) break;
      const cur = getSlot(r), k = Math.min(per, maxStack(cursorStack.id) - (cur ? cur.count : 0), cursorStack.count); if (k <= 0) continue;
      if (cur) cur.count += k; else setSlot(r, { id: cursorStack.id, count: k, dmg: cursorStack.dmg });
      cursorStack.count -= k; if (!cursorStack.count) cursorStack = null;
    }
  };
  const endDrag = e => {
    const d = D; if (!d || d.pid !== e.pointerId) return;
    D = null; clearTimeout(d.timer); clearHL(); dragCur(false); lastPtrSlot = performance.now();
    if (!G || !G.ui) return;
    // put whatever is still held back where it came from (merging with what stayed there)
    const back = () => {
      if (!cursorStack || !placeable(d.ref)) return;
      const o = getSlot(d.ref);
      if (!o) { setSlot(d.ref, cursorStack); cursorStack = null; }
      else if (same(o, cursorStack)) { const k = Math.min(maxStack(o.id) - o.count, cursorStack.count); o.count += k; cursorStack.count -= k; if (!cursorStack.count) cursorStack = null; }
    };
    if (e.type === 'pointercancel') { if (d.mode === 'carry') back(); renderSlots(); invChanged(); return; }
    if (!d.moved) {
      if (isLong(d, e.timeStamp)) { slotClick(d.ref, true, d.ref === 'out'); return; } // half / one · craft all on the result
      const now = e.timeStamp, dbl = d.touch && lastTap && lastTap.ref === d.ref && now - lastTap.t < 380 && lastTap.picked;
      const before = !!cursorStack, hadItem = !!getSlot(d.ref);
      slotClick(d.ref, d.right, d.shift);
      if (dbl && placeable(d.ref) && !cursorStack && getSlot(d.ref)) { shiftMove(d.ref); lastTap = null; renderSlots(); invChanged(); return; }
      lastTap = { ref: d.ref, t: now, picked: !before && hadItem && !!cursorStack };
      return;
    }
    const tg = slotAt(e.clientX, e.clientY), tr = tg && tg.dataset.slot;
    if (d.mode === 'carry') {
      if (tr && tr !== d.ref) { slotClick(tr, false, false); back(); }
      else if (d.pal) cursorStack = null;
      else back();
    } else if (d.mode === 'spread') {
      const list = d.visited.filter(canSpread);
      if (list.length > 1) spread(list, d.right || oneMode);
      else if (tr) slotClick(tr, d.right, false);
    }
    renderSlots(); invChanged();
  };
  ctx.on(s, 'pointerup', endDrag); ctx.on(s, 'pointercancel', endDrag);
}

// ── menus ──
let menuScreen = null, selectedWorld = null, createFrom = 'title', worldFilter = '';
function screenHTML(inner, bg = G ? 'game' : 'dirt') { const s = $('screen'); s.hidden = false; s.className = 'screen bg-' + bg; s.style.background = ''; s.innerHTML = inner; s.scrollTop = 0; }
function uiClick() { if (SAVE && SAVE.settings.uiSound !== false) { wake(); sfx('click'); } }
function showLanding() {
  G = null; W = null; menuScreen = 'landing';
  screenHTML(`<div class="tw"><div class="logo"><h1 aria-label="Minecraft Mini"><span class="lb" aria-hidden="true">MINECRAFT</span><span class="lf" aria-hidden="true">MINECRAFT</span></h1><div class="edition">MINI</div><div class="splash"><span>${esc(SPLASH[Math.floor(Math.random() * SPLASH.length)])}</span></div></div>
  <div class="tmenu"><button class="btn" data-act="worlds">싱글플레이</button><button class="btn" data-act="new">새로운 월드 만들기</button><button class="btn" data-act="help">조작법</button><div class="gap"></div>
  <div class="row"><button class="btn sq" data-act="layout" aria-label="터치 버튼 배치" title="터치 버튼 배치"><img src="${UIT.i_grid}" alt=""></button><button class="btn" data-act="settings">설정...</button><button class="btn sq" data-act="full" aria-label="전체화면" title="전체화면"><img src="${UIT.i_full}" alt=""></button></div></div>
  <div class="corner l">Minecraft Mini 2.0</div><div class="corner r">자체 제작 텍스처 · 원작 리소스 미사용</div></div>`, 'pano');
}
function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const DIFF_NAME = ['평화로움', '쉬움', '보통', '어려움'];
function showTitle() {
  G = null; W = null; menuScreen = 'worlds';
  const worlds = SAVE.worlds.slice().sort((a, b) => b.played - a.played);
  if (!selectedWorld || !worlds.find(w => w.id === selectedWorld)) selectedWorld = worlds[0] ? worlds[0].id : null;
  screenHTML(`<div class="ms full"><div class="mtitle">월드 선택</div><input class="mfield" id="wsearch" placeholder="검색..." value="${esc(worldFilter)}" aria-label="월드 검색" style="margin-bottom:${u(6)}">
  <div class="mlist"><div class="wl" role="listbox" aria-label="저장된 월드">${worlds.length ? worlds.map(w => `<div class="we ${w.id === selectedWorld ? 'sel' : ''}" data-act="pick" data-id="${w.id}" data-n="${esc(w.name.toLowerCase())}" role="option" aria-selected="${w.id === selectedWorld}">
    <div class="wi"><img src="${ICON[w.mode === 'creative' ? GRASS : DIAMOND_ORE]}" alt=""></div><div class="wt"><div>${esc(w.name)}</div><div class="ws">${fmtDate(w.played)}</div><div class="ws">${w.mode === 'creative' ? '크리에이티브' : '서바이벌'} 모드 · ${DIFF_NAME[w.difficulty ?? 2]} · 시드 ${esc(w.seedText)}</div></div></div>`).join('') : '<p class="empty">아직 월드가 없어요.<br>새로운 월드를 만들어 보세요!</p>'}</div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="play" ${selectedWorld ? '' : 'disabled'}>선택한 월드 플레이</button><button class="btn" data-act="new">새로운 월드 만들기</button></div>
  <div class="row w308"><button class="btn" data-act="delete" ${selectedWorld ? '' : 'disabled'}>삭제</button><button class="btn" data-act="title">취소</button></div>
  ${SAVE.storage ? '' : '<p class="desc">이 환경에서는 저장소를 쓸 수 없어 월드가 저장되지 않아요.</p>'}</div></div>`, 'dirt');
  const inp = $('wsearch'), filt = () => { worldFilter = inp.value; const q = worldFilter.trim().toLowerCase(); root.querySelectorAll('.we').forEach(e => { e.hidden = !!q && !e.dataset.n.includes(q); }); };
  inp.addEventListener('input', filt); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); filt();
}
function showDeleteConfirm() {
  const w = SAVE.worlds.find(x => x.id === selectedWorld); if (!w) return showTitle();
  menuScreen = 'confirmDelete';
  screenHTML(`<div class="ms center"><div class="mtitle">이 월드를 삭제할까요?</div><p class="desc">'${esc(w.name)}' 월드가 영원히 사라져요. 되돌릴 수 없어요!</p><div class="row w308"><button class="btn" data-act="delYes">삭제</button><button class="btn" data-act="worlds">취소</button></div></div>`, 'dirt');
}
let createOpts = { mode: 'survival', difficulty: 2, bonus: false, cheats: false, tab: 'game' };
const MODE_DESC = { survival: '자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.', creative: '모든 블록을 무한히 쓰고, 날아다니며, 다치지 않아요. 몬스터도 공격하지 않아요.' };
function showCreate(from) {
  createFrom = from || (menuScreen === 'worlds' ? 'worlds' : 'title'); menuScreen = 'create';
  createOpts = { mode: 'survival', difficulty: 2, bonus: false, cheats: false, tab: 'game' };
  screenHTML(`<div class="ms full"><div class="mtitle">새로운 월드 만들기</div>
  <div class="ctabs"><button class="btn ctabb on" data-act="ctab" data-t="game">게임</button><button class="btn ctabb" data-act="ctab" data-t="world">월드</button></div>
  <div class="mlist"><div id="ctGame" style="display:flex;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wname">월드 이름</label><input class="mfield" id="wname" maxlength="32" value="새로운 세계${SAVE.worlds.length ? ' ' + (SAVE.worlds.length + 1) : ''}">
   <div style="height:${u(8)}"></div><button class="btn w200" data-act="cmode" id="cMode">게임 모드: 서바이벌</button><p class="desc" id="modeDesc">${MODE_DESC.survival}</p>
   <button class="btn w200" data-act="cdiff" id="cDiff">난이도: 보통</button><p class="desc" id="diffDesc">몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.</p></div>
  <div id="ctWorld" style="display:none;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wseed">월드 생성기 시드</label><input class="mfield" id="wseed" maxlength="24" placeholder="비워 두면 무작위 시드"><p class="desc">같은 시드를 쓰면 같은 지형이 만들어져요.</p>
   <button class="btn w200" data-act="ccheats" id="cCheats">치트 허용: 끔</button><button class="btn w200" data-act="cbonus" id="cBonus">보너스 아이템: 끔</button><p class="desc">서바이벌을 시작할 때 원목, 사과, 나무 도구를 받아요.</p></div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="create">새로운 월드 만들기</button><button class="btn" data-act="ccancel">취소</button></div></div></div>`, 'dirt');
  root.querySelectorAll('#screen input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Escape') return; e.stopPropagation(); if (e.key === 'Enter') menuAction('create'); }));
}
function updateCreate() {
  $('cMode').textContent = '게임 모드: ' + (createOpts.mode === 'creative' ? '크리에이티브' : '서바이벌');
  $('modeDesc').textContent = MODE_DESC[createOpts.mode];
  $('cDiff').textContent = '난이도: ' + DIFF_NAME[createOpts.difficulty];
  $('diffDesc').textContent = ['몬스터가 나타나지 않고, 체력과 배고픔이 저절로 회복돼요.', '몬스터가 적게 나타나고 피해도 적어요.', '몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.', '몬스터가 많고 아파요. 굶으면 죽을 수도 있어요!'][createOpts.difficulty];
  $('cCheats').textContent='치트 허용: '+(createOpts.cheats?'켬':'끔');
  $('cBonus').textContent = '보너스 아이템: ' + (createOpts.bonus ? '켬' : '끔');
  root.querySelectorAll('.ctabb').forEach(b => b.classList.toggle('on', b.dataset.t === createOpts.tab));
  $('ctGame').style.display = createOpts.tab === 'game' ? 'flex' : 'none'; $('ctWorld').style.display = createOpts.tab === 'world' ? 'flex' : 'none';
}
function showPause() {
  if (!G || G.ui === 'death') return;
  G.ui = 'pause'; menuScreen = 'pause'; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="mtitle">게임 메뉴</div>
  <button class="btn w204" data-act="cheats">치트 허용: ${G.world.cheats?'켬':'끔'}</button>
  <button class="btn w204" data-act="resume">게임으로 돌아가기</button>
  <div class="row w204"><button class="btn" data-act="help">조작법</button><button class="btn" data-act="stats">통계</button></div>
  <div class="row w204"><button class="btn" data-act="settings">설정...</button>${touchUI() ? '<button class="btn" data-act="layout">버튼 배치...</button>' : '<button class="btn" data-act="page" data-p="keys">키 설정...</button>'}</div>
  ${G.mode==='creative'?`<div class="row w204"><button class="btn" data-act="dim-nether">네더 이동</button><button class="btn" data-act="dim-end">엔드 이동</button><button class="btn" data-act="dim-overworld">오버월드</button></div>`:''}
  <button class="btn w204" data-act="quit">저장 후 타이틀 화면으로</button>
  <p class="minfo">${esc(G.world.name)} · ${G.mode === 'creative' ? '크리에이티브' : '서바이벌'} · ${DIFF_NAME[W.difficulty]} · ${dayCount()}일째</p></div>`, 'game');
  ctx.setPaused(true);
}
// ── settings ──
const pct = v => v + '%', vol = v => v == 0 ? '끔' : v + '%', sensF = v => Math.round(v / 8 * 100) + '%';
const OPTS = {
  fov: { l: '시야각', min: 30, max: 110, f: v => v == 70 ? '보통' : v == 110 ? '최대' : v },
  difficulty: { l: '난이도', v: [0, 1, 2, 3], n: DIFF_NAME },
  guiScale: { l: 'GUI 크기', v: [0, 1, 2, 3, 4], n: ['자동', '1', '2', '3', '4'] },
  brightness: { l: '밝기', min: 0, max: 100, f: v => v == 0 ? '기본' : v == 100 ? '밝게' : '+' + v + '%' },
  cameraDistance: {l:'3인칭 카메라 거리',min:2,max:10,f:v=>v+' 블록'},
  renderDist: { l: '시야 거리', min: 2, max: 10, f: v => v + ' 청크' },
  renderScale: { l: '렌더 해상도', min: 50, max: 100, step: 5, f: pct },
  maxFps: { l: '최대 프레임', v: [30, 60, 0], n: ['30 FPS', '60 FPS', '무제한'] },
  particles: { l: '파티클', v: [2, 1, 0], n: ['모두', '감소', '최소'] },
  clouds: { l: '구름', b: 1 }, bob: { l: '걷기 흔들림', b: 1 }, fovEffect: { l: '달리기 시야 효과', b: 1 }, hurtShake: { l: '피격·폭발 흔들림', b: 1 },
  volMaster: { l: '주 음량', min: 0, max: 100, step: 5, f: vol }, volMusic: { l: '음악', min: 0, max: 100, step: 5, f: vol }, volBlocks: { l: '블록', min: 0, max: 100, step: 5, f: vol },
  volMobs: { l: '생물', min: 0, max: 100, step: 5, f: vol }, volPlayer: { l: '플레이어', min: 0, max: 100, step: 5, f: vol }, uiSound: { l: '버튼 클릭음', b: 1 },
  sens: { l: '마우스 감도', min: 1, max: 20, f: sensF }, invertY: { l: '마우스 반전', b: 1 }, autoJump: { l: '자동 점프', b: 1 },
  sneakToggle: { l: '웅크리기', v: [false, true], n: ['누르기', '전환'] }, sprintToggle: { l: '달리기', v: [false, true], n: ['누르기', '전환'] },
  touchMode: { l: '터치 컨트롤', v: ['auto', 'on', 'off'], n: ['자동', '항상 표시', '숨김'] },
  moveStyle: { l: '이동 방식', v: ['joystick', 'dpad'], n: ['조이스틱', '방향 패드'] },
  joyFloat: { l: '조이스틱', v: [false, true], n: ['고정 위치', '터치한 곳'] },
  touchSens: { l: '터치 시점 감도', min: 1, max: 20, f: sensF }, btnSize: { l: '버튼 크기', min: 60, max: 160, step: 5, f: pct },
  touchOpacity: { l: '버튼 불투명도', min: 20, max: 100, step: 5, f: pct }, tapPlace: { l: '탭해서 설치', b: 1 },
  holdDelay: { l: '꾹 눌러 캐기', min: 150, max: 600, step: 25, f: v => (v / 1000).toFixed(2) + '초' }, vibrate: { l: '진동', b: 1 }, leftHanded: { l: '좌우 반전 배치', b: 1 },
  hudScale: { l: 'HUD 크기', min: 50, max: 150, step: 5, f: pct }, chatOpacity: { l: '채팅 불투명도', min: 10, max: 100, step: 5, f: pct },
  crosshair: { l: '조준점', b: 1 }, itemNames: { l: '아이템 이름', b: 1 }, showCoords: { l: '좌표 표시', b: 1 }, showFps: { l: 'FPS 표시', b: 1 }, chatShow: { l: '채팅 표시', b: 1 },
  menuBlur: { l: '메뉴 배경 흐림', min: 0, max: 10, f: v => v == 0 ? '끔' : v }, panoSpeed: { l: '타이틀 배경 속도', min: 0, max: 200, step: 10, f: v => v == 0 ? '정지' : v + '%' },
  combat: { l: '전투 방식', v: ['modern', 'classic'], n: ['공격 쿨다운', '연타 (구버전)'] }, attackIndicator: { l: '공격 게이지', b: 1 }, dmgNumbers: { l: '데미지 숫자', b: 1 },
};
const PAGES = {
  main: ['설정', () => [G ? 'fov' : 'fov*', G ? 'difficulty' : null, '@video|비디오 설정...', '@sound|음악 및 소리...', '@controls|조작...', '@keys|키 설정...', '@touch|터치 컨트롤...', '@iface|인터페이스...', '@char|캐릭터...', '@combat|전투...']],
  combat: ['전투', () => ['combat*', 'attackIndicator', 'dmgNumbers']],
  video: ['비디오 설정', () => ['guiScale', 'brightness', 'renderDist', 'cameraDistance', 'renderScale', 'maxFps', 'particles', 'clouds', 'bob', 'fovEffect', 'hurtShake']],
  sound: ['음악 및 소리', () => ['volMaster*', 'volMusic', 'volBlocks', 'volMobs', 'volPlayer', 'uiSound*']],
  controls: ['조작', () => ['sens', 'invertY', 'autoJump', 'sneakToggle', 'sprintToggle', '@keys|키 설정...']],
  touch: ['터치 컨트롤', () => ['touchMode', 'moveStyle', 'joyFloat', 'touchSens', 'btnSize', 'touchOpacity', 'tapPlace', 'holdDelay', 'vibrate', 'leftHanded', '#버튼 배치', '!layout|버튼 배치 편집...', '!resetLayout|배치 초기화']],
  iface: ['인터페이스', () => ['hudScale', 'chatOpacity', 'crosshair', 'itemNames', 'showCoords', 'showFps', 'chatShow', 'menuBlur', 'panoSpeed*']],
};
const KEYDEF = [['#이동'], ['forward', '앞으로', 'KeyW'], ['back', '뒤로', 'KeyS'], ['left', '왼쪽', 'KeyA'], ['right', '오른쪽', 'KeyD'], ['jump', '점프', 'Space'], ['sneak', '웅크리기', 'ShiftLeft'], ['sprint', '달리기', 'ControlLeft'],
  ['#게임플레이'], ['inventory', '인벤토리 열기', 'KeyE'], ['drop', '아이템 버리기', 'KeyQ'], ['swap', '양손 바꾸기', 'KeyF'], ['view', '시점 전환', 'F5'], ['fly', '비행 전환 (크리에이티브)', 'KeyG'],
  ['#기타'], ['chat', '채팅 열기', 'KeyT'], ['command', '명령어 입력', 'Slash'], ['hideHud', 'HUD 숨기기', 'F1'], ['debug', '디버그 화면', 'F3']];
const DEFAULT_KEYS = Object.fromEntries(KEYDEF.filter(k => k[2]).map(k => [k[0], k[2]]));
function keyName(c) {
  if (!c) return '없음';
  const M = { Space: '스페이스', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', MetaLeft: '왼쪽 ⌘', MetaRight: '오른쪽 ⌘', Tab: 'Tab', Enter: 'Enter', Backspace: '백스페이스', CapsLock: 'Caps Lock', Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (M[c]) return M[c]; if (/^Key[A-Z]$/.test(c)) return c.slice(3); if (/^Digit\d$/.test(c)) return c.slice(5); if (/^Numpad/.test(c)) return '키패드 ' + c.slice(6); return c;
}
let setPage = 'main', keysParent = 'main', bindingKey = null;
const optGet = k => k === 'difficulty' ? (W ? W.difficulty : 2) : SAVE.settings[k];
function optLabel(k) { const o = OPTS[k], v = optGet(k); return o.b ? `${o.l}: ${v ? '켬' : '끔'}` : `${o.l}: ${o.n[Math.max(0, o.v.indexOf(v))]}`; }
function optHTML(tok) {
  const wide = tok.endsWith('*'); if (wide) tok = tok.slice(0, -1);
  const cls = wide ? ' wide' : '';
  if (tok[0] === '#') return `<div class="sect">${tok.slice(1)}</div>`;
  if (tok[0] === '@' || tok[0] === '!') { const [a, l] = tok.slice(1).split('|'); return tok[0] === '@' ? `<button class="btn${cls}" data-act="page" data-p="${a}">${l}</button>` : `<button class="btn${cls}" data-act="${a}">${l}</button>`; }
  const o = OPTS[tok], v = optGet(tok);
  if (o.min != null) return `<label class="slider${cls}"><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${v}" data-opt="${tok}" aria-label="${o.l}"><span class="lab">${o.l}: ${o.f ? o.f(v) : v}</span></label>`;
  return `<button class="btn${cls}" data-opt="${tok}">${optLabel(tok)}</button>`;
}
function setOpt(k, v, el) {
  SAVE.settings[k] = v;
  const o = OPTS[k]; if (el && el.nextElementSibling) el.nextElementSibling.textContent = `${o.l}: ${o.f ? o.f(v) : v}`;
  applyOpt(k);
}
function cycleOpt(k, dir, btn) {
  const o = OPTS[k], v = optGet(k);
  const nv = o.b ? !v : o.v[(o.v.indexOf(v) + dir + o.v.length) % o.v.length];
  if (k === 'difficulty') { if (!W) return; W.difficulty = nv; G.world.difficulty = nv; if (nv === 0) W.mobs = W.mobs.filter(m => !MOBDEF[m.type].hostile); }
  else SAVE.settings[k] = nv;
  if (btn) btn.textContent = optLabel(k);
  applyOpt(k);
}
function applyOpt(k) {
  if (G) G.settings = SAVE.settings;
  if (k === 'renderScale') resize();
  applyVisualSettings();
  if (k === 'touchMode' || k === 'moveStyle') renderTouch();
  saveSettingsSoon();
}
function showSettings(page = 'main') {
  setPage = page; menuScreen = 'settings';
  if (G) G.ui = 'settings';
  if (page === 'keys') return showKeys();
  if (page === 'char') return showCharacter();
  const [title, items] = PAGES[page];
  const desc = page === 'combat' ? `<p class="desc">공격 쿨다운: 무기마다 공격 속도가 있고, 게이지가 다 차야 최대 피해가 나요. 게이지가 찬 상태로 떨어지면서 때리면 치명타(×1.5), 달리면서 때리면 강한 밀치기, 검으로 땅에서 때리면 옆의 몹까지 휩쓸어요. 연타 방식은 쿨다운 없이 빠르게 때려요.</p>` : page === 'touch' ? `<p class="desc">'버튼 배치 편집'에서 버튼을 끌어 옮기고, 크기를 바꾸고, 숨길 수 있어요.${touchUI() ? '' : ' 지금은 터치 기기가 아니라서 버튼이 숨겨져 있어요.'}</p>` : '';
  screenHTML(`<div class="ms full"><div class="mtitle">${title}</div><div class="mlist">${desc}<div class="opts">${items().filter(Boolean).map(optHTML).join('')}</div></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">완료</button></div></div>`);
}
function showCharacter() {
  setPage = 'char'; menuScreen = 'settings'; if (G) G.ui = 'settings';
  const c = charOf(), rgb = a => `rgb(${a.join(',')})`, sw = a => `<i class="sw" style="background:${rgb(a)}"></i>`;
  const btn = (k, label) => `<button class="btn" data-act="charopt" data-k="${k}">${label}</button>`;
  screenHTML(`<div class="ms full"><div class="mtitle">캐릭터</div><div class="mlist"><div class="charwrap"><canvas class="pview big" id="charpv" width="16" height="32" aria-label="캐릭터 미리보기"></canvas>
  <div class="opts charopts"><div class="sect">기본 캐릭터</div>${CHAR_PRESETS.map((p, i) => `<button class="btn" data-act="charpreset" data-i="${i}">${p.name} (${p.model === 'slim' ? '슬림' : '클래식'})</button>`).join('')}
  <div class="sect">꾸미기</div>
  ${btn('model', `체형: ${c.slim ? '슬림 (얇은 팔)' : '클래식 (넓은 팔)'}`)}${btn('style', `머리 모양: ${c.style ? '긴 머리' : '짧은 머리'}`)}
  ${btn('skin', sw(CHAR_SKIN[c.skin]) + '피부색')}${btn('hair', sw(CHAR_HAIR[c.hair]) + '머리 색')}${btn('shirt', sw(CHAR_SHIRT[c.shirt]) + '상의 색')}${btn('pants', sw(CHAR_PANTS[c.pants]) + '하의 색')}</div></div>
  <p class="desc">3인칭 시점(PC: F5 · 터치: 오른쪽 위 눈 모양 버튼)에서 내 캐릭터를 볼 수 있어요. 1인칭에서도 팔 모양과 소매 색이 바뀌어요.</p></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">완료</button></div></div>`);
  drawPortrait($('charpv'), G ? G.armor : null);
}
function setCharacter(c) { SAVE.settings.char = c; paintCharacter(); saveSettingsSoon(); showCharacter(); }
function showKeys() {
  const K = SAVE.settings.keys;
  const rows = KEYDEF.map(k => {
    if (k[0][0] === '#') return `<div class="khead">${k[0].slice(1)}</div>`;
    const code = K[k[0]], conf = code && Object.entries(K).some(([a, c]) => a !== k[0] && c === code), lis = bindingKey === k[0];
    return `<div class="krow"><span>${k[1]}</span><button class="btn ${lis ? 'listen' : conf ? 'conf' : ''}" data-act="bind" data-k="${k[0]}">${lis ? `&gt; ${esc(keyName(code))} &lt;` : esc(keyName(code))}</button><button class="btn" data-act="kreset" data-k="${k[0]}" ${code === DEFAULT_KEYS[k[0]] ? 'disabled' : ''}>초기화</button></div>`;
  }).join('');
  screenHTML(`<div class="ms full"><div class="mtitle">키 설정</div><div class="mlist">${bindingKey ? '<p class="desc yellow">바꿀 키를 누르세요 (Esc: 취소)</p>' : ''}${rows}<p class="desc">방향키와 1~9 숫자 키, 마우스 버튼은 항상 함께 쓸 수 있어요.</p></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="kresetAll">모두 초기화</button><button class="btn" data-act="setback">완료</button></div></div></div>`);
}
function settingsBack() {
  bindingKey = null;
  if (setPage === 'keys') { if (keysParent === 'pause' && G) return showPause(); if (keysParent !== 'pause') return showSettings(keysParent); }
  if (setPage !== 'main') return showSettings('main');
  if (G) return showPause();
  showLanding();
}
function showHelp() {
  const from = G ? 'pause' : 'title'; if (G) G.ui = 'help'; menuScreen = 'help';
  const K = SAVE.settings.keys, kn = a => keyName(K[a]);
  screenHTML(`<div class="ms full"><div class="mtitle">조작법</div><div class="mlist"><div class="help">
  <h4>PC</h4><p>${kn('forward')}/${kn('left')}/${kn('back')}/${kn('right')} 이동 · 마우스 시점 · 좌클릭(꾹) 캐기·공격 · 우클릭 설치·사용·먹기 · 가운데 클릭 블록 집기</p>
  <p>${kn('jump')} 점프(크리에이티브에서 두 번: 비행) · ${kn('sneak')} 웅크리기 · ${kn('sprint')} 또는 ${kn('forward')} 두 번 달리기 · 1–9/휠 아이템 선택</p>
  <p>${kn('inventory')} 인벤토리 · ${kn('drop')} 버리기(Ctrl: 묶음) · ${kn('chat')} 채팅 · ${kn('command')} 명령어 · ${kn('hideHud')} HUD 숨기기 · ${kn('debug')} 디버그 · Esc 메뉴</p>
  <h4>모바일</h4><p>왼쪽 조이스틱(또는 방향 패드)으로 이동 · 화면 드래그로 시점 · 짧게 탭 설치·사용 · 꾹 누르기 캐기·공격 · 오른쪽 버튼 점프/캐기/놓기/웅크리기 · 핫바 옆 ⋯ 인벤토리</p>
  <p>크리에이티브 비행: 점프 버튼 두 번 탭 또는 비행 버튼 · 날 때 점프 = 위로, 내려가기/웅크리기 = 아래로(누르고 있는 동안)</p>
  <p>버튼 위치·크기는 설정 → 터치 컨트롤 → 버튼 배치 편집에서 바꿀 수 있어요.</p>
  <h4>인벤토리</h4><p>클릭: 집기/놓기 · 우클릭: 절반 집기/1개 놓기 · Shift+클릭: 빠른 이동 · 초록 책: 레시피 책(빨간 칸은 재료 부족, 같은 레시피를 다시 누르면 재료 한 세트 추가)</p>
  <p>끌어서 놓기: 아이템을 다른 칸으로 끌면 옮겨지고(다른 아이템이 있으면 맞바꿈), 아이템을 든 채로 여러 칸을 문지르면 고르게 나눠 놓아요. 터치: 길게 누르면 절반 집기, 두 번 탭하면 빠른 이동, 결과 칸을 길게 누르면 최대한 많이 제작.</p>
  <h4>전투</h4><p>무기마다 공격 속도가 있어 조준점 아래 게이지가 다 차야 최대 피해가 나요. 게이지가 찬 상태로 떨어지면서 때리면 치명타(×1.5, 노란 별), 달리면서 때리면 강한 밀치기, 검으로 땅에서 때리면 옆 몹까지 휩쓸기. 설정 → 전투에서 연타(구버전) 방식과 데미지 숫자를 켤 수 있어요.</p>
  <h4>왼손 · 캐릭터 · 시점</h4><p>${kn('swap')} 또는 터치 '양손 바꾸기' 버튼으로 손에 든 아이템과 왼손 아이템을 바꿔요. 인벤토리의 방패 모양 칸이 왼손이에요. 오른손으로 쓸 게 없으면 왼손 아이템(횃불, 블록, 음식, 화살 등)을 사용해요. 설정 → 캐릭터에서 클래식/슬림 체형과 색을 고르고, ${kn('view')} 또는 터치 '시점' 버튼으로 3인칭으로 볼 수 있어요.</p>
  <h4>갑옷과 도구</h4><p>갑옷(가죽·금·철·다이아몬드·사슬·네더라이트 투구/흉갑/레깅스/부츠)은 인벤토리 왼쪽 칸에 넣거나 손에 들고 사용하면 입어요. 방어력만큼 받는 피해가 줄고 갑옷 내구도가 닳아요. 가죽은 소에게서 얻어요.</p>
  <p>가위: 잎·양털을 빨리 캐고 잎 블록을 그대로 얻어요. 양에게 사용하면 양털을 깎아요 · 활: 사용 버튼을 누르고 있다가 떼면 발사(화살 필요) · 침대: 밤에 사용하면 아침까지 자고, 리스폰 지점이 돼요 · 나침반/시계: 들고 있으면 리스폰 방향과 시간을 알려줘요</p>
  <h4>시작 팁</h4><p>나무를 캐 원목 → 판자 → 작업대 → 나무 곡괭이 → 돌 → 화로 → 철. 밤에는 횃불(석탄+막대기)과 집이 필요해요.</p>
  <h4>명령어</h4><p>/gamemode survival|creative · /time set day|night · /give 아이템 [개수] · /tp x y z · /spawnpoint · /kill · /seed · /help</p></div></div>
  <div class="mfoot"><button class="btn w200" data-act="${from === 'pause' ? 'pause' : 'title'}">완료</button></div></div>`);
}
function fmtTime(s) { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}시간 ${m}분` : `${m}분 ${s % 60}초`; }
function showStats() {
  G.ui = 'stats'; menuScreen = 'stats'; const S = G.stats;
  const rows = [['생존한 날', dayCount() + '일'], ['플레이 시간', fmtTime(S.time)], ['걸은 거리', ((S.walk || 0) / 1000).toFixed(2) + ' km'], ['캔 블록', S.mined], ['설치한 블록', S.placed], ['만든 아이템', S.crafted], ['사망 횟수', S.deaths]];
  screenHTML(`<div class="ms full"><div class="mtitle">통계</div><div class="mlist">${rows.map(([a, b]) => `<div class="strow"><span>${a}</span><span>${b ?? 0}</span></div>`).join('')}</div><div class="mfoot"><button class="btn w200" data-act="pause">완료</button></div></div>`);
}
function showDeath(msg) {
  G.ui = 'death'; menuScreen = 'death'; releasePointer(); resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="dtitle">사망했습니다!</div><p>${esc(msg)}</p><p>생존: <span class="yellow">${dayCount()}</span>일째${G.mode === 'survival' ? ' · 소지품은 사망한 자리에 떨어졌어요' : ''}</p><div style="height:${u(16)}"></div>
  <button class="btn w200" data-act="respawn" disabled>부활</button><button class="btn w200" data-act="quit" disabled>타이틀 화면</button></div>`, 'death');
  ctx.timeout(() => { if (G && G.ui === 'death') root.querySelectorAll('#screen .btn').forEach(b => b.disabled = false); }, 1000);
}
function showLoading(pct) {
  const s = $('screen');
  if (!s.querySelector('#loadbar')) { menuScreen = 'loading'; screenHTML(`<div class="ms center"><div class="mtitle">월드 생성 중</div><p id="loadtxt">지형 생성 중...</p><div class="chunkmap" id="chunkmap">${'<i></i>'.repeat(25)}</div><div class="pbar"><i id="loadbar"></i></div></div>`, 'dirt'); }
  $('loadbar').style.width = Math.round(pct * 100) + '%'; $('loadtxt').textContent = `지형 생성 중... ${Math.round(pct * 100)}%`;
  if (P && W) { const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, cells = $('chunkmap').children; let i = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = getChunk(pcx + dx, pcz + dz); cells[i++].className = c ? (c.mesh ? 'm' : 'g') : ''; } }
}
function openChat(prefix = '') {
  G.ui = 'chat'; menuScreen = 'chat'; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-none';
  s.innerHTML = `<input id="chatin" class="chatin" maxlength="120" placeholder="메시지 또는 /명령어 (Enter 전송, Esc 닫기)" aria-label="채팅 입력">`;
  const inp = $('chatin'); inp.value = prefix; inp.focus();
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = inp.value.trim(); closeChat(); if (v) { if (v.startsWith('/')) command(v); else chat('<나> ' + v); } }
    else if (e.key === 'Escape') closeChat();
  });
  if (touchUI()) inp.addEventListener('blur', () => ctx.timeout(() => { if (G && G.ui === 'chat' && document.activeElement !== inp) closeChat(); }, 150));
}
function closeChat() { hideScreens(); if (G) G.ui = null; capture(); }
function dayCount() { return Math.floor(W.time / DAY_TICKS) + 1; }
async function toggleFull() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('mc').requestFullscreen) await $('mc').requestFullscreen(); else toast('이 브라우저에서는 전체화면을 지원하지 않아요.'); } catch { toast('전체화면을 열 수 없어요. 허브 상단 전체화면 버튼도 이용해 주세요.'); } }
function menuEscape() {
  if (bindingKey) return;
  switch (menuScreen) {
    case 'worlds': case 'help': showLanding(); break;
    case 'create': menuAction('ccancel'); break;
    case 'confirmDelete': showTitle(); break;
    case 'settings': settingsBack(); break;
    case 'layout': closeLayoutEditor(false); break;
  }
}

function menuAction(a, el) {
  switch (a) {
    case 'close': closeScreen(); break;
    case 'quick': quickMove = !quickMove; el.classList.toggle('on', quickMove); root.querySelectorAll('[data-act="quick"]').forEach(b => b.classList.toggle('on', quickMove)); break;
    case 'one': oneMode = !oneMode; root.querySelectorAll('[data-act="one"]').forEach(b => b.classList.toggle('on', oneMode)); break;
    case 'book': rbOpen = !rbOpen; SAVE.settings.recipeBook = rbOpen; saveSettingsSoon(); renderScreen(); break;
    case 'rfilter': rbCraftable = !rbCraftable; rbPage = 0; el.classList.toggle('on', rbCraftable); renderRecipes(); break;
    case 'rtab': rbTab = el.dataset.t; rbPage = 0; root.querySelectorAll('.rtab').forEach(b => b.classList.toggle('on', b.dataset.t === rbTab)); renderRecipes(); break;
    case 'rprev': rbPage--; renderRecipes(); break;
    case 'rnext': rbPage++; renderRecipes(); break;
    case 'pick': selectedWorld = el.dataset.id; root.querySelectorAll('.we').forEach(w => { const on = w.dataset.id === selectedWorld; w.classList.toggle('sel', on); w.setAttribute('aria-selected', on); }); root.querySelectorAll('[data-act="play"],[data-act="delete"]').forEach(b => b.disabled = false); break;
    case 'play': { const w = SAVE.worlds.find(x => x.id === selectedWorld); if (w) startWorld(w); break; }
    case 'new': showCreate(); break;
    case 'title': showLanding(); break;
    case 'worlds': showTitle(); break;
    case 'delete': if (selectedWorld) showDeleteConfirm(); break;
    case 'delYes': SAVE.worlds = SAVE.worlds.filter(w => w.id !== selectedWorld); selectedWorld = null; persist(); showTitle(); break;
    case 'ctab': createOpts.tab = el.dataset.t; updateCreate(); break;
    case 'cmode': createOpts.mode = createOpts.mode === 'survival' ? 'creative' : 'survival'; updateCreate(); break;
    case 'cdiff': createOpts.difficulty = (createOpts.difficulty + 1) % 4; updateCreate(); break;
    case 'ccheats': createOpts.cheats=!createOpts.cheats;updateCreate();break;
    case 'cheats':G.world.cheats=!G.world.cheats;persist();showPause();break;
    case 'cbonus': createOpts.bonus = !createOpts.bonus; updateCreate(); break;
    case 'ccancel': if (createFrom === 'worlds') showTitle(); else showLanding(); break;
    case 'create': {
      const name = ($('wname').value.trim() || '새로운 세계').slice(0, 32), seedText = $('wseed').value.trim() || String(Math.floor(Math.random() * 1e9));
      const w = { id: 'w' + Date.now().toString(36), name, mode: createOpts.mode, difficulty: createOpts.difficulty, bonus: createOpts.bonus, cheats:createOpts.cheats, seedText, seed: /^-?\d+$/.test(seedText) ? (+seedText | 0) >>> 0 : hashSeed(seedText), created: Date.now(), played: Date.now(), data: null };
      SAVE.worlds.push(w); selectedWorld = w.id; startWorld(w); break;
    }
    case 'settings': keysParent = 'main'; showSettings('main'); break;
    case 'page': { const p = el.dataset.p; if (menuScreen === 'settings') { if (p === 'keys') keysParent = setPage; showSettings(p); } else { keysParent = 'pause'; showSettings(p); } break; }
    case 'setback': settingsBack(); break;
    case 'bind': bindingKey = bindingKey === el.dataset.k ? null : el.dataset.k; showKeys(); break;
    case 'kreset': SAVE.settings.keys[el.dataset.k] = DEFAULT_KEYS[el.dataset.k]; saveSettingsSoon(); showKeys(); break;
    case 'kresetAll': SAVE.settings.keys = { ...DEFAULT_KEYS }; bindingKey = null; saveSettingsSoon(); showKeys(); break;
    case 'dim-nether': if(G.mode==='creative')travelDimension('nether');break;
    case 'dim-end': if(G.mode==='creative')travelDimension('end');break;
    case 'dim-overworld': if(G.mode==='creative')travelDimension('overworld');break;
    case 'resume': hideScreens(); G.ui = null; ctx.setPaused(false); capture(); break;
    case 'pause': showPause(); break;
    case 'help': showHelp(); break;
    case 'stats': showStats(); break;
    case 'quit': quitToTitle(); break;
    case 'respawn': respawn(); break;
    case 'layout': openLayoutEditor(menuScreen === 'settings' ? 'settings' : G ? 'pause' : 'title'); break;
    case 'resetLayout': SAVE.settings.layout = {}; saveSettingsSoon(); positionTouch(); toast('터치 버튼 배치를 기본값으로 되돌렸어요.'); break;
    case 'full': toggleFull(); break;
    case 'charpreset': setCharacter({ ...CHAR_PRESETS[+el.dataset.i] }); break;
    case 'charopt': {
      const c = charOf(), k = el.dataset.k, n = { skin: CHAR_SKIN.length, hair: CHAR_HAIR.length, shirt: CHAR_SHIRT.length, pants: CHAR_PANTS.length }[k];
      const nc = { model: c.model, skin: c.skin, hair: c.hair, style: c.style, shirt: c.shirt, pants: c.pants, name: c.name };
      if (k === 'model') nc.model = c.slim ? 'classic' : 'slim'; else if (k === 'style') nc.style = c.style ? 0 : 1; else nc[k] = (c[k] + 1) % n;
      setCharacter(nc); break;
    }
  }
}
