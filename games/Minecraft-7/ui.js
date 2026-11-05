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

const CSS_MODERN = `
/* modern (1.20+) widgets: flat sprite buttons with a white hover outline, blurred panorama menus */
.btn{background:#6f6f6f;border:${u(1)} solid #000;box-shadow:inset ${u(1)} ${u(1)} #a9a9a9,inset ${u(-1)} ${u(-2)} #565656;color:#fff}
.btn:hover,.btn:focus-visible{border-color:#fff;color:#fff;background:#7a7a7a}
.btn[disabled]{background:#2b2b2b;box-shadow:inset ${u(1)} ${u(1)} #3c3c3c,inset ${u(-1)} ${u(-2)} #1a1a1a;color:#a0a0a0}
.slider{background:#2b2b2b;box-shadow:inset ${u(1)} ${u(1)} #444,inset ${u(-1)} ${u(-1)} #1a1a1a}
.slider input::-webkit-slider-thumb{background:#6f6f6f;box-shadow:inset ${u(1)} ${u(1)} #a9a9a9,inset ${u(-1)} ${u(-2)} #565656}
.slider input::-moz-range-thumb{background:#6f6f6f}
.slider:hover{border-color:#fff}.slider:hover .lab{color:#fff}
.screen.bg-menu{background:#000 var(--tx-panoblur,url('textures/title-panorama.png')) 50% 50%/cover no-repeat}
.screen.bg-menu::before,.screen.bg-pano::before{content:"";position:fixed;inset:0;background:#00000055;pointer-events:none}
.screen.bg-pano::before{background:linear-gradient(#0000 55%,#0007)}
.screen>*{position:relative}
.screen.bg-game{background:#10101070;-webkit-backdrop-filter:blur(var(--blur));backdrop-filter:blur(var(--blur))}
.mlist{background:#0000007a;border-top:${u(2)} solid #ffffff1f;border-bottom:${u(2)} solid #ffffff1f;box-shadow:inset 0 ${u(1)} 0 #0009,inset 0 ${u(-1)} 0 #0009}
.mtitle{font-size:calc(var(--fs)*1.1)}
.logo .edition{background:none;border:0;box-shadow:none;letter-spacing:${u(2)};color:#e8e8e8;text-shadow:var(--sh);padding:0;margin-top:${u(2)};font-size:calc(var(--fs)*1.05)}
.btn.sq img{width:${u(14)};height:${u(14)}}
.chatlog{font-size:calc(var(--fs)*var(--chatfs,1))}
.we.lang{min-height:${u(26)};padding:${u(2)} ${u(6)}}
.opts .sect{color:#a0a0a0;margin-top:${u(6)}}
.tools{display:none!important}
.cmdsug{position:absolute;bottom:${u(15)};z-index:7;background:#000000d8;max-height:${u(112)};overflow-y:auto;overscroll-behavior:contain;pointer-events:auto;text-shadow:var(--sh);padding:${u(1)} 0;min-width:${u(60)};max-width:calc(100% - ${u(4)})}
.cmdsug div{padding:${u(1)} ${u(3)};color:#a8a8a8;white-space:nowrap;cursor:pointer;line-height:1.2;touch-action:manipulation}
.cmdsug div.on,.cmdsug div:hover{color:#ffff55}
.cmdsug .usage{color:#808080;cursor:default}
#mc.touchui .cmdsug div{padding:${u(2)} ${u(4)}}
#mc.scr:not(.editing) .touch,#mc.scr:not(.editing) .bottom,#mc.scr .chatlog{visibility:hidden}
#mc.scr.chatting .chatlog{visibility:visible}
.screen.bg-game{background-color:#000000a0}
#mc.hc .btn,#mc.hc .slider{border-color:#fff}#mc.hc .btn:hover{border-color:#ffff55;color:#ffff55}#mc.hc .mlist{background:#000d}#mc.hc .desc{color:#e0e0e0}
#mc.rm .splash span,#mc.rm .screen.bg-pano,#mc.rm .bars .shake img{animation:none!important}
#mc.rm .screen.bg-pano{background-position:50% 50%}
`;
const SPLASH = ['겉날개로 하늘을 날아요!', '마을을 찾아보세요!', '100개가 넘는 새 아이템!', '엔드 시티에 보물이!', '무너진 차원문을 조심!', '무한한 세계!', '블록으로 무엇이든!', '밤에는 조심!', '다이아몬드를 찾아라!', '지하와 다른 차원을 탐험하세요!', '횃불은 소중해요', '작업대부터 만들어요', '이제 버튼도 옮길 수 있어요!', '설정이 더 많아졌어요!', '좀비는 햇빛을 싫어해요?', '모바일에서도 즐겨요!'];

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
  globe: ['....####....', '..##.##.##..', '.#..#..#..#.', '.#..#..#..#.', '############', '#...#..#...#', '#...#..#...#', '############', '.#..#..#..#.', '.#..#..#..#.', '..##.##.##..', '....####....'],
  access: ['.....##.....', '.....##.....', '............', '############', '....####....', '....####....', '....####....', '....#..#....', '....#..#....', '...##..##...', '...#....#...', '............'],
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
  // blurred copy of the title panorama for the modern menu background
  try { const im = new Image(); im.onload = () => { try { const c = document.createElement('canvas'), k = 360 / im.naturalHeight; c.width = Math.round(im.naturalWidth * k); c.height = 360; const g = c.getContext('2d'); g.filter = 'blur(6px) brightness(0.8)'; g.drawImage(im, 0, 0, c.width, c.height); if (root && $('mc')) $('mc').style.setProperty('--tx-panoblur', `url(${c.toDataURL('image/jpeg', 0.8)})`); } catch { } }; im.src = 'textures/title-panorama.png'; } catch { }
}

function buildDOM() {
  root.innerHTML = `<style>${CSS}${CSS_MODERN}</style><section id="mc">
<canvas id="cv" tabindex="0" aria-label="3D world"></canvas>
<div class="hud" id="hud">
 <div class="uw" id="uw"></div><div class="flash" id="flash"></div>
 <div class="cross" id="cross"></div><div class="atkind" id="atkind"><i></i></div><div class="dnums" id="dnums"></div><div class="iinfo" id="iinfo"></div><div class="sleepov" id="sleepov"></div>
 <div class="hinfo" id="hinfo"></div><div class="debug" id="debug"></div>
 <div class="chatlog" id="chatlog"></div>
 <div class="eat" id="eat"><i></i></div>
 <div class="touch" id="touch"></div>
 <div class="bottom" id="bottomHud"><div class="itemname" id="itemname"></div><div class="statrows"><div class="toprow"><div class="armor" id="armor"></div><div class="air" id="air"></div></div><div class="bars" id="bars"><div class="hr" id="hearts"></div><div class="hr food" id="food"></div></div></div><div class="hotbar" id="hotbar"></div></div>
</div>
<div class="screen" id="screen" hidden></div>
<div class="editor" id="editor" hidden></div>
<div class="toast" id="toast" role="status"></div>
<div class="cursor" id="cursor"></div><div class="tip" id="tip"></div>
</section>`;
  canvas = $('cv');
  $('hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="hs" data-hot="${i}" style="left:calc(var(--g)*${1 + i * 20})"></div>`).join('') + '<div class="hsel"></div><button id="hotInv" class="hot-inv" aria-label="' + tr('인벤토리 열기') + '"></button><div class="offhot" id="offhot" title="' + tr('왼손') + '"></div>';
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
  const t = toolOf(id), a = armorOf(id), dm = durOf(id); if (dm && s) extra = `<div class="tl">${tr('내구도: {0} / {1}', dm - (s.dmg || 0), dm)}</div>`;
  else if (inf.food) extra = `<div class="tl">${tr('허기 +{0}', inf.food[0] / 2)}</div>`;
  if (a) extra += `<div class="tl" style="color:#5555ff">${tr('방어력 +{0} ({1})', a.def, tr(ARMOR_SLOT_NAME[a.slot]))}</div>`;
  if (inf.gadget === 'compass') extra += `<div class="tl">${tr('들고 있으면 리스폰 지점 방향을 알려줘요')}</div>`;
  if (inf.gadget === 'clock') extra += `<div class="tl">${tr('들고 있으면 시간을 알려줘요')}</div>`;
  if (inf.gadget === 'recovery') extra += `<div class="tl">${tr('들고 있으면 마지막으로 죽은 곳을 알려줘요')}</div>`;
  if (inf.potion) extra += `<div class="tl" style="color:#5555ff">${esc(inf.potion.effect)}${inf.potion.time ? ' (' + Math.floor(inf.potion.time / 60) + ':' + String(inf.potion.time % 60).padStart(2, '0') + ')' : ''}</div>`;
  if (id === ELYTRA) extra += `<div class="tl">${tr('공중에서 점프를 한 번 더 누르면 활공해요')}</div>`;
  if (id === FIREWORK) extra += `<div class="tl">${tr('활공 중에 사용하면 앞으로 가속해요')}</div>`;
  if (id === SPYGLASS) extra += `<div class="tl">${tr('사용 버튼을 누르고 있으면 확대해요')}</div>`;
  if (t && t.aspd) extra += `<div class="tl" style="color:#55ff55">${tr('공격력 {0} · 공격 속도 {1}', t.dmg, t.aspd)}</div>`;
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
    if (st.showCoords) lines.push(tr('위치: {0}, {1}, {2}', Math.floor(P.x), Math.floor(P.y), Math.floor(P.z)), tr('{0}일째 · {1}쪽', dayCount(), tr(['북', '동', '남', '서'][((Math.round(P.yaw / (Math.PI / 2)) % 4) + 4) % 4])));
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
  const needle = (tx, tz, near, far) => { const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz), a = Math.atan2(dx, -dz) - P.yaw; key = g + Math.round(d) + ',' + Math.round(a * 20); html = `<i class="ndl" style="transform:rotate(${a.toFixed(2)}rad)"></i><span>${d < 2 ? near : tr(far, Math.round(d))}</span>`; };
  if (g === 'compass' && !G.ui) needle(G.spawn.x, G.spawn.z, tr('리스폰 지점이에요'), '리스폰 지점까지 {0}m');
  else if (g === 'recovery' && !G.ui) { const d = G.lastDeath; if (d && d.dim === (W.dimension || 'overworld')) needle(d.x, d.z, tr('여기에서 죽었어요'), '마지막 사망 지점까지 {0}m'); else { key = 'r-none'; html = `<span>${tr('사망 기록이 없어요')}</span>`; } }
  else if (g === 'clock' && !G.ui) {
    const tt = W.time % DAY_TICKS, mins = Math.floor(((tt / 1000 + 6) % 24) * 60), hh = Math.floor(mins / 60), mm = mins % 60;
    const ph = tt < 12000 ? '낮' : tt < 13800 ? '해 질 녘' : tt < 22200 ? '밤' : '새벽';
    key = 't' + hh + ':' + mm; html = `<span>${tr('{0}일째 · {1} {2}', dayCount(), tr(ph), String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'))}</span>`;
  }
  if (key === gadgetKey) return; gadgetKey = key;
  el.style.display = key ? 'flex' : 'none'; if (key) el.innerHTML = html;
}
let toastT = 0;
// optional gameplay notices (tips, portal hints…): hidden unless 'game notices' is turned on
function hint(msg) { if (SAVE && SAVE.settings.systemMsgs) toast(msg); }
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
function hideScreens() { $('mc').classList.remove('scr', 'chatting'); menuScreen = null; const s = $('screen'); s.hidden = true; s.className = 'screen'; s.innerHTML = ''; $('cursor').innerHTML = ''; $('tip').style.display = 'none'; if (G && G.ui !== 'title') G.ui = null; }
function slotEl(ref, cls = '') { return `<div class="slot ${cls}" data-slot="${ref}"></div>`; }
function invGrid() {
  return `<div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('inv:' + (i + 9))).join('')}</div><div class="invgap"></div>
  <div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>`;
}
const touchTools = () => SAVE.settings.invHelpers ? `<div class="mobtools"><button class="tgl ${quickMove ? 'on' : ''}" data-act="quick">${tr('빠른 이동')}</button><button class="tgl ${oneMode ? 'on' : ''}" data-act="one">${tr('1개씩')}</button></div>` : '';
const contHead = (title, extra = '') => `<div class="chead"><span class="ctitle">${tr(title)}</span>${extra}<span class="sp"></span>${touchTools()}<button class="xbtn" data-act="close" aria-label="${tr('닫기')}" title="${tr('닫기')} (E)"></button></div>`;
const RB_TABS = [['전체', null], ['도구', ['도구', '전투']], ['블록', ['블록', '장식', '기능']], ['기타', ['재료', '음식']]];
function recipeBookHTML() {
  return `<div class="panel rbook" aria-label="${tr('레시피 책')}"><div class="rhead"><input class="mfield" id="rsearch" placeholder="${tr('검색...')}" value="${esc(rbSearch)}" aria-label="${tr('레시피 책')}"><button class="tgl ${rbCraftable ? 'on' : ''}" data-act="rfilter" title="${tr('제작 가능')}">${tr('제작 가능')}</button></div>
  <div class="rtabs">${RB_TABS.map(([t]) => `<button class="rtab ${t === rbTab ? 'on' : ''}" data-act="rtab" data-t="${t}">${tr(t)}</button>`).join('')}</div>
  <div class="rgrid" id="recipes"></div>
  <div class="rpage"><button class="pg prev" data-act="rprev" aria-label="&lt;"></button><span id="rpg">1/1</span><button class="pg" data-act="rnext" aria-label="&gt;"></button></div></div>`;
}
const CR_TABS = [['블록', BRICKS], ['장식', FLOWER_RED], ['기능', CHEST], ['도구', PICK0 + 2], ['전투', ARMOR0 + 9], ['음식', APPLE], ['재료', IRON]];
function renderScreen() {
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-cont'; menuScreen = 'cont'; $('mc').classList.add('scr');
  const k = G.uiKind; recipeCache = null;
  if (k === 'inventory' || k === 'table') {
    const w = G.craftW;
    s.innerHTML = `<div class="cwrap">${rbOpen ? recipeBookHTML() : ''}<div class="panel" role="dialog" aria-label="${tr(k === 'table' ? '작업대' : '인벤토리')}">${contHead('제작', `<button class="bookbtn ${rbOpen ? 'on' : ''}" data-act="book" aria-label="${tr('레시피 책')}" title="${tr('레시피 책')}"></button>`)}
    <div class="craft">${k === 'inventory' ? `<div class="armcol" title="갑옷">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><div class="pcol"><canvas class="pview" id="pview" width="16" height="32" aria-label="${tr('캐릭터')}"></canvas>${slotEl('off:0')}</div>` : ''}<span class="sp"></span><div class="grid g${w}">${G.craft.map((_, i) => slotEl('craft:' + i)).join('')}</div><div class="carrow"></div>${slotEl('out', 'big')}</div>
    <div class="ctitle sub" id="invsub">${tr('인벤토리')}</div>${invGrid()}</div></div>`;
    const inp = $('rsearch'); if (inp) { inp.addEventListener('input', () => { rbSearch = inp.value; rbPage = 0; renderRecipes(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'creative') {
    const tab = creativeTab, title = tab === '전체' ? '아이템 검색' : tab === '인벤토리' ? '생존 인벤토리' : tab;
    const tabBtn = (t, icon, name) => `<button class="crtab ${t === tab ? 'on' : ''}" data-tab="${t}" data-name="${tr(name || t)}" aria-label="${tr(name || t)}"><img class="ico" src="${icon}" alt=""></button>`;
    s.innerHTML = `<div class="cr"><div class="crtabs">${CR_TABS.map(([t, id]) => tabBtn(t, ICON[id])).join('')}<span class="sp"></span>${tabBtn('전체', UIT.i_search, '아이템 검색')}</div>
    <div class="panel crp" role="dialog" aria-label="${tr('크리에이티브 인벤토리')}">${contHead(title)}
    ${tab === '인벤토리' ? `<div class="hotrow" style="margin:0 0 ${u(3)}"><span class="ctitle" id="invsub">${tr('갑옷')}</span><span class="sp"></span><div class="armrow">${[0, 1, 2, 3].map(i => slotEl('arm:' + i)).join('')}</div><span class="ctitle">${tr('왼손')}</span>${slotEl('off:0')}</div>` + invGrid() + `<div class="hotrow"><span class="sp"></span><span class="ctitle">${tr('버리기')}</span>${slotEl('trash', 'trash')}</div>`
      : `${tab === '전체' ? `<input class="mfield csearch" id="csearch" placeholder="${tr('아이템 검색...')}" value="${esc(creativeSearch)}" aria-label="${tr('아이템 검색')}">` : ''}<div class="palette" id="palette"></div>
      <div class="hotrow"><div class="grid">${Array.from({ length: 9 }, (_, i) => slotEl('inv:' + i)).join('')}</div>${slotEl('trash', 'trash')}</div>`}</div>
    <div class="crtabs bot"><span class="sp"></span>${tabBtn('인벤토리', ICON[CHEST], '생존 인벤토리')}</div></div>`;
    renderPalette();
    const inp = $('csearch'); if (inp) { inp.addEventListener('input', () => { creativeSearch = inp.value; renderPalette(); }); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); }
  } else if (k === 'furnace') {
    const fname = G.container && BLOCK[getBlock(...G.container.pos.split(',').map(Number))]?.name || tr('화로');
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="${esc(fname)}">${contHead(fname)}
    <div class="furn"><div class="fcol">${slotEl('c:0')}<div class="flame"><i id="fflame"></i></div>${slotEl('c:1')}</div><div class="carrow"><i id="farrow"></i></div>${slotEl('c:2', 'big')}</div>
    <div class="ctitle sub">${tr('인벤토리')}</div>${invGrid()}</div></div>`;
  } else if (k === 'chest') {
    const cname = G.container && BLOCK[getBlock(...G.container.pos.split(',').map(Number))]?.name || tr('상자');
    s.innerHTML = `<div class="cwrap"><div class="panel" role="dialog" aria-label="${esc(cname)}">${contHead(cname)}
    <div class="grid">${Array.from({ length: 27 }, (_, i) => slotEl('c:' + i)).join('')}</div><div class="ctitle sub">${tr('인벤토리')}</div>${invGrid()}</div></div>`;
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
    if (r === 'off:0') { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${UIT.shield}" alt="">`; el.title = tr('왼손'); return; }
    if (r.startsWith('arm:')) { el.innerHTML = st ? slotHTML(st) : `<img class="ico sil" src="${ICON[ARMOR0 + 8 + +r.slice(4)]}" alt="">`; el.title = tr(ARMOR_SLOT_NAME[+r.slice(4)]); return; }
    el.innerHTML = slotHTML(st);
  });
  const out = s.querySelector('[data-slot="out"]');
  if (out) { const r = craftResult(); out.classList.toggle('ghosted', !r && ghost != null); out.innerHTML = r ? slotHTML(r) : ghost != null ? `<img class="ico ghost" src="${ICON[RECIPES[ghost].out]}" alt="">` : ''; }
  $('cursor').innerHTML = slotHTML(cursorStack);
  const held = $('touchHeld'); if (held) { held.style.visibility = cursorStack ? 'visible' : 'hidden'; held.innerHTML = cursorStack ? `<span class="held-slot">${slotHTML(cursorStack)}</span><span>${esc(info(cursorStack.id).name)}</span>` : ''; }
  const pv = $('pview'); if (pv) drawPortrait(pv, G.armor);
  const sub = $('invsub'); if (sub && G.armor) { const [def] = armorPoints(); sub.textContent = tr(G.uiKind === 'creative' ? '갑옷' : '인벤토리') + (def ? ' · ' + tr('방어력 {0}', def) : ''); }
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
      if (!a || a.slot !== ai) { toast(tr('{0} 칸에는 {0} 갑옷만 넣을 수 있어요.', tr(ARMOR_SLOT_NAME[ai]))); return; }
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
  let list = recipeList().filter(r => { const inf = info(r.out); if (q && !inf.name.toLowerCase().includes(q.toLowerCase()) && !(inf.nameKo || '').includes(q)) return false; return !tab[1] || tab[1].includes(inf.cat || '블록'); });
  const ok = new Map(list.map(r => [r, canFill(r)]));
  if (rbCraftable) list = list.filter(r => ok.get(r));
  list.sort((a, b) => ok.get(b) - ok.get(a));
  const pages = Math.max(1, Math.ceil(list.length / 20)); rbPage = clamp(rbPage, 0, pages - 1);
  const key = [rbTab, q, rbCraftable, rbPage, G.craftW, list.map(r => RECIPES.indexOf(r) + (ok.get(r) ? '+' : '-')).join(',')].join('|');
  if (recipeCache === key && el.children.length) return;
  recipeCache = key;
  el.innerHTML = list.slice(rbPage * 20, rbPage * 20 + 20).map(r => `<div class="rslot ${ok.get(r) ? 'ok' : 'no'}" data-recipe="${RECIPES.indexOf(r)}" data-name="${esc(info(r.out).name)}${r.count > 1 ? ' ×' + r.count : ''}"><img class="ico" src="${ICON[r.out]}" alt="">${r.count > 1 ? `<span class="cnt">${r.count}</span>` : ''}</div>`).join('')
    || `<p class="rempty">${tr(rbCraftable ? '지금 만들 수 있는 게 없어요' : '결과가 없어요')}</p>`;
  const pg = $('rpg'); if (pg) pg.textContent = `${rbPage + 1}/${pages}`;
  const sc = $('screen'); const pv = sc.querySelector('[data-act="rprev"]'), nx = sc.querySelector('[data-act="rnext"]'); if (pv) pv.disabled = rbPage <= 0; if (nx) nx.disabled = rbPage >= pages - 1;
}
function fillRecipe(ri) {
  const r = RECIPES[ri];
  // tapping the same recipe again adds one more set to every filled grid cell
  const cur = craftResult();
  if (cur && cur.id === r.out && ghost == null) {
    const need = {}; G.craft.forEach(s => { if (s) need[s.id] = (need[s.id] || 0) + 1; });
    if (G.craft.some(s => s && s.count >= maxStack(s.id))) { toast(tr('더 이상 넣을 수 없어요.')); return; }
    for (const id in need) if (G.inv.reduce((a, s) => a + (s && s.id === +id ? s.count : 0), 0) < need[id]) { toast(tr('재료가 부족해서 더 넣을 수 없어요.')); return; }
    for (const s of G.craft) if (s) { const i = G.inv.findIndex(x => x && x.id === s.id); G.inv[i].count--; if (!G.inv[i].count) G.inv[i] = null; s.count++; }
    renderSlots(); invChanged(); return;
  }
  if (!canFill(r)) {
    const names = {}; for (const k of recipeNeeds(r)) { const n = typeof k === 'string' ? tr(({ log: '아무 원목', planks: '나무 판자', wool: '양털', slab: '나무 반 블록' })[k]) : info(k).name; names[n] = (names[n] || 0) + 1; }
    ghost = ri; renderSlots();
    toast(tr('필요: ') + Object.entries(names).map(([n, c]) => `${n} ×${c}`).join(', ')); return;
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
  const ql = q.toLowerCase();
  const list = ids.filter(id => { const inf = info(id); if (q && !inf.name.toLowerCase().includes(ql) && !(inf.nameKo || '').includes(q) && !(inf.en || '').toLowerCase().includes(ql)) return false; if (creativeTab === '전체') return true; return (inf.cat || '블록') === creativeTab; });
  el.innerHTML = list.map(id => `<div class="slot" data-slot="pal:${id}" data-name="${esc(info(id).name)}"><img class="ico" src="${ICON[id]}" alt=""></div>`).join('') || '<p class="pe">' + tr('결과가 없어요') + '</p>';
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
      else if (el.dataset.slot === 'trash') html = '<div>' + tr('아이템 버리기') + '</div>';
      else if (el.dataset.slot) { const st = getSlot(el.dataset.slot); if (st) html = tipHTML(st.id, st); }
      else if (el.dataset.recipe) { const rr = RECIPES[+el.dataset.recipe]; html = tipHTML(rr.out) + (canFill(rr) ? '' : '<div class="tl" style="color:#ff5555">' + tr('재료가 부족해요') + '</div>'); }
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
function screenHTML(inner, bg = G ? 'game' : 'menu') { if (bg === 'dirt') bg = 'menu'; $('mc').classList.add('scr'); const s = $('screen'); s.hidden = false; s.className = 'screen bg-' + bg; s.style.background = ''; s.innerHTML = inner; s.scrollTop = 0; }
function uiClick() { if (SAVE && SAVE.settings.uiSound !== false) { wake(); sfx('click'); } }
function showLanding() {
  G = null; W = null; menuScreen = 'landing'; pageOrigin = null;
  screenHTML(`<div class="tw"><div class="logo"><h1 aria-label="Minecraft Mini"><span class="lb" aria-hidden="true">MINECRAFT</span><span class="lf" aria-hidden="true">MINECRAFT</span></h1><div class="edition">MINI EDITION</div><div class="splash"><span>${esc(tr(SPLASH[Math.floor(Math.random() * SPLASH.length)]))}</span></div></div>
  <div class="tmenu"><button class="btn" data-act="worlds">${tr('싱글플레이')}</button><button class="btn" data-act="new">${tr('새로운 월드 만들기')}</button><button class="btn" data-act="help">${tr('조작법')}</button><div class="gap"></div>
  <div class="row"><button class="btn sq" data-act="page" data-p="lang" aria-label="${tr('언어...')}" title="${tr('언어...')}"><img src="${UIT.i_globe}" alt=""></button><button class="btn" data-act="settings">${tr('설정...')}</button><button class="btn" data-act="full">${tr('전체화면')}</button><button class="btn sq" data-act="page" data-p="access" aria-label="${tr('접근성 설정...')}" title="${tr('접근성 설정...')}"><img src="${UIT.i_access}" alt=""></button></div></div>
  <div class="corner l">Minecraft Mini 3.0</div><div class="corner r">${tr('자체 제작 텍스처 · 원작 리소스 미사용')}</div></div>`, 'pano');
}
function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const DIFF_NAME = ['평화로움', '쉬움', '보통', '어려움'];
const diffName = i => tr(DIFF_NAME[i]);
function showTitle() {
  G = null; W = null; menuScreen = 'worlds';
  const worlds = SAVE.worlds.slice().sort((a, b) => b.played - a.played);
  if (!selectedWorld || !worlds.find(w => w.id === selectedWorld)) selectedWorld = worlds[0] ? worlds[0].id : null;
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('월드 선택')}</div><input class="mfield" id="wsearch" placeholder="${tr('검색...')}" value="${esc(worldFilter)}" aria-label="${tr('검색...')}" style="margin-bottom:${u(6)}">
  <div class="mlist"><div class="wl" role="listbox" aria-label="${tr('월드 선택')}">${worlds.length ? worlds.map(w => `<div class="we ${w.id === selectedWorld ? 'sel' : ''}" data-act="pick" data-id="${w.id}" data-n="${esc(w.name.toLowerCase())}" role="option" aria-selected="${w.id === selectedWorld}">
    <div class="wi"><img src="${ICON[w.mode === 'creative' ? GRASS : DIAMOND_ORE]}" alt=""></div><div class="wt"><div>${esc(w.name)}</div><div class="ws">${fmtDate(w.played)}</div><div class="ws">${tr(w.mode === 'creative' ? '크리에이티브 모드' : '서바이벌 모드')} · ${diffName(w.difficulty ?? 2)}${w.cheats ? ' · ' + tr('치트') : ''}</div></div></div>`).join('') : `<p class="empty">${tr('아직 월드가 없어요.')}<br>${tr('새로운 월드를 만들어 보세요!')}</p>`}</div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="play" ${selectedWorld ? '' : 'disabled'}>${tr('선택한 월드 플레이')}</button><button class="btn" data-act="new">${tr('새로운 월드 만들기')}</button></div>
  <div class="row w308"><button class="btn" data-act="delete" ${selectedWorld ? '' : 'disabled'}>${tr('삭제')}</button><button class="btn" data-act="title">${tr('뒤로')}</button></div>
  ${SAVE.storage ? '' : `<p class="desc">${tr('이 환경에서는 저장소를 쓸 수 없어 월드가 저장되지 않아요.')}</p>`}</div></div>`, 'menu');
  const inp = $('wsearch'), filt = () => { worldFilter = inp.value; const q = worldFilter.trim().toLowerCase(); root.querySelectorAll('.we').forEach(e => { e.hidden = !!q && !e.dataset.n.includes(q); }); };
  inp.addEventListener('input', filt); inp.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }); filt();
}
function showDeleteConfirm() {
  const w = SAVE.worlds.find(x => x.id === selectedWorld); if (!w) return showTitle();
  menuScreen = 'confirmDelete';
  screenHTML(`<div class="ms center"><div class="mtitle">${tr('이 월드를 삭제할까요?')}</div><p class="desc">${tr("'{0}' 월드가 영원히 사라져요. 되돌릴 수 없어요!", esc(w.name))}</p><div class="row w308"><button class="btn" data-act="delYes">${tr('삭제')}</button><button class="btn" data-act="worlds">${tr('취소')}</button></div></div>`, 'menu');
}
let createOpts = { mode: 'survival', difficulty: 2, bonus: false, cheats: false, structures: true, tab: 'game' };
const MODE_DESC = { survival: '자원을 모으고, 도구를 만들고, 밤의 몬스터로부터 살아남으세요. 체력과 배고픔이 있어요.', creative: '모든 블록을 무한히 쓰고, 날아다니며, 다치지 않아요. 몬스터도 공격하지 않아요.' };
function showCreate(from) {
  createFrom = from || (menuScreen === 'worlds' ? 'worlds' : 'title'); menuScreen = 'create';
  createOpts = { mode: 'survival', difficulty: 2, bonus: false, cheats: false, structures: true, tab: 'game' };
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('새로운 월드 만들기')}</div>
  <div class="ctabs"><button class="btn ctabb on" data-act="ctab" data-t="game">${tr('게임')}</button><button class="btn ctabb" data-act="ctab" data-t="world">${tr('월드')}</button></div>
  <div class="mlist"><div id="ctGame" style="display:flex;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wname">${tr('월드 이름')}</label><input class="mfield" id="wname" maxlength="32" value="${esc(tr('새로운 세계'))}${SAVE.worlds.length ? ' ' + (SAVE.worlds.length + 1) : ''}">
   <div style="height:${u(8)}"></div><button class="btn w200" data-act="cmode" id="cMode"></button><p class="desc" id="modeDesc"></p>
   <button class="btn w200" data-act="cdiff" id="cDiff"></button><p class="desc" id="diffDesc"></p>
   <button class="btn w200" data-act="ccheats" id="cCheats"></button><p class="desc">${tr('/gamemode, /give 같은 명령어를 쓸 수 있어요.')}</p></div>
  <div id="ctWorld" style="display:none;flex-direction:column;align-items:center;width:100%">
   <label class="mlabel" for="wseed">${tr('월드 생성기 시드')}</label><input class="mfield" id="wseed" maxlength="24" placeholder="${tr('비워 두면 무작위 시드')}"><p class="desc">${tr('같은 시드를 쓰면 같은 지형이 만들어져요.')}</p>
   <button class="btn w200" data-act="cstruct" id="cStruct"></button><p class="desc">${tr('마을, 무너진 차원문, 사막 피라미드, 이글루, 던전, 엔드 시티를 만들어요.')}</p>
   <button class="btn w200" data-act="cbonus" id="cBonus"></button><p class="desc">${tr('서바이벌을 시작할 때 원목, 사과, 나무 도구를 받아요.')}</p></div></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="create">${tr('새로운 월드 만들기')}</button><button class="btn" data-act="ccancel">${tr('취소')}</button></div></div></div>`, 'menu');
  root.querySelectorAll('#screen input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Escape') return; e.stopPropagation(); if (e.key === 'Enter') menuAction('create'); }));
  updateCreate();
}
function updateCreate() {
  const onoff = v => tr(v ? '켬' : '끔');
  $('cMode').textContent = tr('게임 모드: {0}', tr(createOpts.mode === 'creative' ? '크리에이티브' : '서바이벌'));
  $('modeDesc').textContent = tr(MODE_DESC[createOpts.mode]);
  $('cDiff').textContent = tr('난이도: {0}', diffName(createOpts.difficulty));
  $('diffDesc').textContent = tr(['몬스터가 나타나지 않고, 체력과 배고픔이 저절로 회복돼요.', '몬스터가 적게 나타나고 피해도 적어요.', '몬스터가 나타나고, 배고프면 체력이 1칸까지 줄어들어요.', '몬스터가 많고 아파요. 굶으면 죽을 수도 있어요!'][createOpts.difficulty]);
  $('cCheats').textContent = tr('치트 허용: {0}', onoff(createOpts.cheats));
  $('cBonus').textContent = tr('보너스 상자: {0}', onoff(createOpts.bonus));
  $('cStruct').textContent = tr('구조물 생성: {0}', onoff(createOpts.structures));
  root.querySelectorAll('.ctabb').forEach(b => b.classList.toggle('on', b.dataset.t === createOpts.tab));
  $('ctGame').style.display = createOpts.tab === 'game' ? 'flex' : 'none'; $('ctWorld').style.display = createOpts.tab === 'world' ? 'flex' : 'none';
}
function showPause() {
  if (!G || G.ui === 'death') return;
  G.ui = 'pause'; menuScreen = 'pause'; pageOrigin = null; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="mtitle">${tr('게임 메뉴')}</div>
  <button class="btn w204" data-act="resume">${tr('게임으로 돌아가기')}</button>
  <div class="row w204"><button class="btn" data-act="help">${tr('조작법')}</button><button class="btn" data-act="stats">${tr('통계')}</button></div>
  <div class="row w204"><button class="btn" data-act="settings">${tr('설정...')}</button><button class="btn" data-act="full">${tr('전체화면')}</button></div>
  <div class="row w204"><button class="btn" data-act="cheats">${tr('치트 허용: {0}', tr(G.world.cheats ? '켬' : '끔'))}</button>${touchUI() ? `<button class="btn" data-act="layout">${tr('버튼 배치...')}</button>` : `<button class="btn" data-act="page" data-p="keys">${tr('키 설정...')}</button>`}</div>
  ${G.mode === 'creative' ? `<div class="row w204"><button class="btn" data-act="dim-overworld">${tr('오버월드')}</button><button class="btn" data-act="dim-nether">${tr('네더')}</button><button class="btn" data-act="dim-end">${tr('엔드')}</button></div>` : ''}
  <button class="btn w204" data-act="quit">${tr('저장 후 타이틀 화면으로')}</button>
  <p class="minfo">${esc(G.world.name)} · ${tr(G.mode === 'creative' ? '크리에이티브' : '서바이벌')} · ${diffName(W.difficulty)} · ${tr('{0}일째', dayCount())}</p></div>`, 'game');
  ctx.setPaused(true);
}
const pct = v => v + '%', vol = v => v == 0 ? tr('끔') : v + '%', sensF = v => Math.round(v / 8 * 100) + '%';
const OPTS = {
  fov: { l: '시야각', min: 30, max: 110, f: v => v == 70 ? tr('보통') : v == 110 ? tr('최대') : v },
  difficulty: { l: '난이도', v: [0, 1, 2, 3], n: DIFF_NAME },
  guiScale: { l: 'GUI 크기', v: [0, 1, 2, 3, 4], n: ['자동', '1', '2', '3', '4'] },
  brightness: { l: '밝기', min: 0, max: 100, f: v => v == 0 ? tr('기본') : v == 100 ? tr('밝게') : '+' + v + '%' },
  cameraDistance: { l: '3인칭 카메라 거리', min: 2, max: 10, f: v => tr('{0} 블록', v) },
  renderDist: { l: '시야 거리', min: 2, max: 10, f: v => tr('{0} 청크', v) },
  renderScale: { l: '렌더 해상도', min: 50, max: 100, step: 5, f: pct },
  maxFps: { l: '최대 프레임', v: [30, 60, 0], n: ['30 FPS', '60 FPS', '무제한'] },
  particles: { l: '파티클', v: [2, 1, 0], n: ['모두', '감소', '최소'] },
  clouds: { l: '구름', b: 1 }, fog: { l: '안개', b: 1 }, showHand: { l: '손 표시', b: 1 }, bob: { l: '화면 흔들림', b: 1 }, fovEffect: { l: '시야 효과', b: 1 }, hurtShake: { l: '피격·폭발 흔들림', b: 1 },
  volMaster: { l: '주 음량', min: 0, max: 100, step: 5, f: vol }, volMusic: { l: '음악', min: 0, max: 100, step: 5, f: vol }, volBlocks: { l: '블록', min: 0, max: 100, step: 5, f: vol },
  volMobs: { l: '생물', min: 0, max: 100, step: 5, f: vol }, volPlayer: { l: '플레이어', min: 0, max: 100, step: 5, f: vol }, uiSound: { l: '버튼 클릭음', b: 1 },
  sens: { l: '마우스 감도', min: 1, max: 20, f: sensF }, invertY: { l: '마우스 반전', b: 1 }, autoJump: { l: '자동 점프', b: 1 }, scrollInvert: { l: '휠 방향 반전', b: 1 },
  sneakToggle: { l: '웅크리기', v: [false, true], n: ['누르기', '전환'] }, sprintToggle: { l: '달리기', v: [false, true], n: ['누르기', '전환'] },
  touchMode: { l: '터치 컨트롤', v: ['auto', 'on', 'off'], n: ['자동', '항상 표시', '숨김'] },
  moveStyle: { l: '이동 방식', v: ['joystick', 'dpad'], n: ['조이스틱', '방향 패드'] },
  joyFloat: { l: '조이스틱', v: [false, true], n: ['고정 위치', '터치한 곳'] },
  touchSens: { l: '터치 시점 감도', min: 1, max: 20, f: sensF }, btnSize: { l: '버튼 크기', min: 60, max: 160, step: 5, f: pct },
  touchOpacity: { l: '버튼 불투명도', min: 20, max: 100, step: 5, f: pct }, tapPlace: { l: '탭해서 설치', b: 1 },
  holdDelay: { l: '꾹 눌러 캐기', min: 150, max: 600, step: 25, f: v => tr('{0}초', (v / 1000).toFixed(2)) }, vibrate: { l: '진동', b: 1 }, leftHanded: { l: '좌우 반전 배치', b: 1 },
  invHelpers: { l: '인벤토리 보조 버튼', b: 1 }, hideMobileExtras: { l: '간단한 터치 버튼', b: 1 },
  hudScale: { l: 'HUD 크기', min: 50, max: 150, step: 5, f: pct }, chatOpacity: { l: '채팅 불투명도', min: 10, max: 100, step: 5, f: pct }, chatScale: { l: '채팅 글자 크기', min: 50, max: 150, step: 10, f: pct },
  crosshair: { l: '조준점', b: 1 }, itemNames: { l: '아이템 이름', b: 1 }, showCoords: { l: '좌표 표시', b: 1 }, showFps: { l: 'FPS 표시', b: 1 }, chatShow: { l: '채팅 표시', b: 1 },
  systemMsgs: { l: '게임 안내 메시지', b: 1 }, autoPause: { l: '창을 벗어나면 일시정지', b: 1 }, autosave: { l: '자동 저장', v: [30, 45, 120, 300], n: ['30초', '45초', '2분', '5분'] },
  menuBlur: { l: '메뉴 배경 흐림', min: 0, max: 10, f: v => v == 0 ? tr('끔') : v }, panoSpeed: { l: '타이틀 배경 속도', min: 0, max: 200, step: 10, f: v => v == 0 ? tr('정지') : v + '%' },
  highContrast: { l: '고대비 테두리', b: 1 }, reduceMotion: { l: '움직임 줄이기', b: 1 },
  combat: { l: '전투 방식', v: ['modern', 'classic'], n: ['공격 쿨다운', '연타 (구버전)'] }, attackIndicator: { l: '공격 게이지', b: 1 }, dmgNumbers: { l: '데미지 숫자', b: 1 },
};
const PAGES = {
  main: ['설정', () => ['fov', G ? 'difficulty' : 'guiScale', '@char|캐릭터 꾸미기...', '@sound|음악 및 소리...', '@video|비디오 설정...', '@controls|조작...', '@lang|언어...', '@chat|채팅 설정...', '@iface|인터페이스...', '@access|접근성 설정...', '@touch|터치 컨트롤...', '@combat|게임플레이...']],
  combat: ['게임플레이', () => ['combat*', 'attackIndicator', 'dmgNumbers', 'autosave', 'autoPause']],
  video: ['비디오 설정', () => ['guiScale', 'brightness', 'renderDist', 'renderScale', 'maxFps', 'particles', 'clouds', 'fog', 'showHand', 'cameraDistance', 'menuBlur', 'panoSpeed']],
  sound: ['음악 및 소리', () => ['volMaster*', 'volMusic', 'volBlocks', 'volMobs', 'volPlayer', 'uiSound*']],
  controls: ['조작', () => ['sens', 'invertY', 'autoJump', 'scrollInvert', 'sneakToggle', 'sprintToggle', '@keys|키 설정...*']],
  chat: ['채팅 설정', () => ['chatShow', 'systemMsgs', 'chatOpacity', 'chatScale']],
  touch: ['터치 컨트롤', () => ['touchMode', 'moveStyle', 'joyFloat', 'touchSens', 'btnSize', 'touchOpacity', 'tapPlace', 'holdDelay', 'vibrate', 'leftHanded', 'hideMobileExtras', 'invHelpers', '#버튼 배치', '!layout|버튼 배치 편집...', '!resetLayout|배치 초기화']],
  iface: ['인터페이스', () => ['hudScale', 'crosshair', 'itemNames', 'showCoords', 'showFps']],
  access: ['접근성 설정', () => ['highContrast', 'reduceMotion', 'bob', 'fovEffect', 'hurtShake', 'panoSpeed', 'menuBlur', 'chatScale']],
};
const KEYDEF = [['#이동'], ['forward', '앞으로 걷기', 'KeyW'], ['back', '뒤로 걷기', 'KeyS'], ['left', '왼쪽으로 걷기', 'KeyA'], ['right', '오른쪽으로 걷기', 'KeyD'], ['jump', '점프', 'Space'], ['sneak', '웅크리기', 'ShiftLeft'], ['sprint', '달리기', 'ControlLeft'],
  ['#게임플레이'], ['inventory', '인벤토리 열기', 'KeyE'], ['drop', '아이템 버리기', 'KeyQ'], ['swap', '양손 바꾸기', 'KeyF'], ['view', '시점 전환', 'F5'], ['fly', '비행 전환 (크리에이티브)', 'KeyG'],
  ['#기타'], ['chat', '채팅 열기', 'KeyT'], ['command', '명령어 입력', 'Slash'], ['hideHud', 'HUD 숨기기', 'F1'], ['debug', '디버그 화면', 'F3']];
const DEFAULT_KEYS = Object.fromEntries(KEYDEF.filter(k => k[2]).map(k => [k[0], k[2]]));
function keyName(c) {
  if (!c) return tr('없음');
  const M = { Space: '스페이스', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', MetaLeft: '왼쪽 ⌘', MetaRight: '오른쪽 ⌘', Tab: 'Tab', Enter: 'Enter', Backspace: '백스페이스', CapsLock: 'Caps Lock', Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (M[c]) return tr(M[c]); if (/^Key[A-Z]$/.test(c)) return c.slice(3); if (/^Digit\d$/.test(c)) return c.slice(5); if (/^Numpad/.test(c)) return tr('키패드 ') + c.slice(6); return c;
}
let setPage = 'main', keysParent = 'main', bindingKey = null, pageOrigin = null;
const optGet = k => k === 'difficulty' ? (W ? W.difficulty : 2) : SAVE.settings[k];
function optLabel(k) { const o = OPTS[k], v = optGet(k); return o.b ? `${tr(o.l)}: ${tr(v ? '켬' : '끔')}` : `${tr(o.l)}: ${tr(o.n[Math.max(0, o.v.indexOf(v))])}`; }
function optHTML(tok) {
  const wide = tok.endsWith('*'); if (wide) tok = tok.slice(0, -1);
  const cls = wide ? ' wide' : '';
  if (tok[0] === '#') return `<div class="sect">${tr(tok.slice(1))}</div>`;
  if (tok[0] === '@' || tok[0] === '!') { const [a, l] = tok.slice(1).split('|'); return tok[0] === '@' ? `<button class="btn${cls}" data-act="page" data-p="${a}">${tr(l)}</button>` : `<button class="btn${cls}" data-act="${a}">${tr(l)}</button>`; }
  const o = OPTS[tok], v = optGet(tok);
  if (o.min != null) return `<label class="slider${cls}"><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${v}" data-opt="${tok}" aria-label="${tr(o.l)}"><span class="lab">${tr(o.l)}: ${o.f ? o.f(v) : v}</span></label>`;
  return `<button class="btn${cls}" data-opt="${tok}">${optLabel(tok)}</button>`;
}
function setOpt(k, v, el) {
  SAVE.settings[k] = v;
  const o = OPTS[k]; if (el && el.nextElementSibling) el.nextElementSibling.textContent = `${tr(o.l)}: ${o.f ? o.f(v) : v}`;
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
  if (k === 'touchMode' || k === 'moveStyle' || k === 'hideMobileExtras') renderTouch();
  saveSettingsSoon();
}
function showSettings(page = 'main') {
  setPage = page; menuScreen = 'settings';
  if (G) G.ui = 'settings';
  if (page === 'keys') return showKeys();
  if (page === 'char') return showCharacter();
  if (page === 'lang') return showLanguage();
  const [title, items] = PAGES[page];
  const desc = page === 'combat' ? `<p class="desc">${tr('공격 쿨다운: 무기마다 공격 속도가 있고, 게이지가 다 차야 최대 피해가 나요. 연타 방식은 쿨다운 없이 빠르게 때려요.')}</p>`
    : page === 'touch' ? `<p class="desc">${tr("'간단한 터치 버튼'을 켜면 화면 탭·꾹 누르기와 겹치는 캐기/사용 버튼 등을 숨겨요. '버튼 배치 편집'에서 버튼을 옮기고 크기를 바꿀 수 있어요.")}${touchUI() ? '' : ' ' + tr('지금은 터치 기기가 아니라서 버튼이 숨겨져 있어요.')}</p>`
    : page === 'chat' ? `<p class="desc">${tr("'게임 안내 메시지'를 켜면 차원문·잠자기 같은 안내 문구를 화면에 보여줘요.")}</p>` : '';
  screenHTML(`<div class="ms full"><div class="mtitle">${tr(title)}</div><div class="mlist">${desc}<div class="opts">${items().filter(Boolean).map(optHTML).join('')}</div></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">${tr('완료')}</button></div></div>`);
}
function showLanguage() {
  setPage = 'lang'; menuScreen = 'settings'; if (G) G.ui = 'settings';
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('언어')}</div><div class="mlist"><div class="wl" role="listbox">${LANGS.map(([k, n, sub]) => `<div class="we lang ${k === curLang() ? 'sel' : ''}" data-act="setlang" data-l="${k}" role="option" aria-selected="${k === curLang()}"><div class="wt"><div>${n}</div><div class="ws">${sub}</div></div></div>`).join('')}</div>
  <p class="desc">${tr('메뉴, 설정, 아이템 이름, 안내 문구가 바뀌어요.')}</p></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">${tr('완료')}</button></div></div>`);
}
function showCharacter() {
  setPage = 'char'; menuScreen = 'settings'; if (G) G.ui = 'settings';
  const c = charOf(), rgb = a => `rgb(${a.join(',')})`, sw = a => `<i class="sw" style="background:${rgb(a)}"></i>`;
  const btn = (k, label) => `<button class="btn" data-act="charopt" data-k="${k}">${label}</button>`;
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('캐릭터 꾸미기')}</div><div class="mlist"><div class="charwrap"><canvas class="pview big" id="charpv" width="16" height="32" aria-label="${tr('캐릭터')}"></canvas>
  <div class="opts charopts"><div class="sect">${tr('기본 캐릭터')}</div>${CHAR_PRESETS.map((p, i) => `<button class="btn" data-act="charpreset" data-i="${i}">${tr(p.name)} (${tr(p.model === 'slim' ? '슬림' : '클래식')})</button>`).join('')}
  <div class="sect">${tr('꾸미기')}</div>
  ${btn('model', tr('체형: {0}', tr(c.slim ? '슬림 (얇은 팔)' : '클래식 (넓은 팔)')))}${btn('style', tr('머리 모양: {0}', tr(c.style ? '긴 머리' : '짧은 머리')))}
  ${btn('skin', sw(CHAR_SKIN[c.skin]) + tr('피부색'))}${btn('hair', sw(CHAR_HAIR[c.hair]) + tr('머리 색'))}${btn('shirt', sw(CHAR_SHIRT[c.shirt]) + tr('상의 색'))}${btn('pants', sw(CHAR_PANTS[c.pants]) + tr('하의 색'))}</div></div></div>
  <div class="mfoot"><button class="btn w200" data-act="setback">${tr('완료')}</button></div></div>`);
  drawPortrait($('charpv'), G ? G.armor : null);
}
function setCharacter(c) { SAVE.settings.char = c; paintCharacter(); saveSettingsSoon(); showCharacter(); }
function showKeys() {
  const K = SAVE.settings.keys;
  const rows = KEYDEF.map(k => {
    if (k[0][0] === '#') return `<div class="khead">${tr(k[0].slice(1))}</div>`;
    const code = K[k[0]], conf = code && Object.entries(K).some(([a, c]) => a !== k[0] && c === code), lis = bindingKey === k[0];
    return `<div class="krow"><span>${tr(k[1])}</span><button class="btn ${lis ? 'listen' : conf ? 'conf' : ''}" data-act="bind" data-k="${k[0]}">${lis ? `&gt; ${esc(keyName(code))} &lt;` : esc(keyName(code))}</button><button class="btn" data-act="kreset" data-k="${k[0]}" ${code === DEFAULT_KEYS[k[0]] ? 'disabled' : ''}>${tr('초기화')}</button></div>`;
  }).join('');
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('키 설정')}</div><div class="mlist">${bindingKey ? `<p class="desc yellow">${tr('바꿀 키를 누르세요 (Esc: 취소)')}</p>` : ''}${rows}<p class="desc">${tr('방향키와 1~9 숫자 키, 마우스 버튼은 항상 함께 쓸 수 있어요.')}</p></div>
  <div class="mfoot"><div class="row w308"><button class="btn" data-act="kresetAll">${tr('모두 초기화')}</button><button class="btn" data-act="setback">${tr('완료')}</button></div></div></div>`);
}
function settingsBack() {
  bindingKey = null;
  if (pageOrigin && setPage === pageOrigin.page) { const o = pageOrigin.from; pageOrigin = null; if (o === 'pause' && G) return showPause(); if (o === 'title') return showLanding(); }
  if (setPage === 'keys') { if (keysParent === 'pause' && G) return showPause(); if (keysParent !== 'pause') return showSettings(keysParent); }
  if (setPage !== 'main') return showSettings('main');
  if (G) return showPause();
  showLanding();
}
function showHelp() {
  const from = G ? 'pause' : 'title'; if (G) G.ui = 'help'; menuScreen = 'help';
  const K = SAVE.settings.keys, kn = a => keyName(K[a]);
  const sec = HELP_TEXT(kn).map(([h, ...ps]) => `<h4>${h}</h4>${ps.map(p => `<p>${p}</p>`).join('')}`).join('');
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('조작법')}</div><div class="mlist"><div class="help">${sec}</div></div>
  <div class="mfoot"><button class="btn w200" data-act="${from === 'pause' ? 'pause' : 'title'}">${tr('완료')}</button></div></div>`);
}
function fmtTime(s) { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? tr('{0}시간 {1}분', h, m) : tr('{0}분 {1}초', m, s % 60); }
function showStats() {
  G.ui = 'stats'; menuScreen = 'stats'; const S = G.stats;
  const rows = [['생존한 날', tr('{0}일', dayCount())], ['플레이 시간', fmtTime(S.time)], ['걸은 거리', ((S.walk || 0) / 1000).toFixed(2) + ' km'], ['캔 블록', S.mined], ['설치한 블록', S.placed], ['만든 아이템', S.crafted], ['사망 횟수', S.deaths]];
  screenHTML(`<div class="ms full"><div class="mtitle">${tr('통계')}</div><div class="mlist">${rows.map(([a, b]) => `<div class="strow"><span>${tr(a)}</span><span>${b ?? 0}</span></div>`).join('')}</div><div class="mfoot"><button class="btn w200" data-act="pause">${tr('완료')}</button></div></div>`);
}
function showDeath(msg) {
  G.ui = 'death'; menuScreen = 'death'; releasePointer(); resetTouchHolds();
  screenHTML(`<div class="ms center"><div class="dtitle">${tr('사망했습니다!')}</div><p>${esc(msg)}</p><p>${tr('생존: {0}일째', `<span class="yellow">${dayCount()}</span>`)}</p><div style="height:${u(16)}"></div>
  <button class="btn w200" data-act="respawn" disabled>${tr('부활')}</button><button class="btn w200" data-act="quit" disabled>${tr('타이틀 화면')}</button></div>`, 'death');
  ctx.timeout(() => { if (G && G.ui === 'death') root.querySelectorAll('#screen .btn').forEach(b => b.disabled = false); }, 1000);
}
function showLoading(pct) {
  const s = $('screen');
  if (!s.querySelector('#loadbar')) { menuScreen = 'loading'; screenHTML(`<div class="ms center"><div class="mtitle">${tr('월드 불러오는 중')}</div><p id="loadtxt"></p><div class="chunkmap" id="chunkmap">${'<i></i>'.repeat(25)}</div><div class="pbar"><i id="loadbar"></i></div></div>`, 'menu'); }
  $('loadbar').style.width = Math.round(pct * 100) + '%'; $('loadtxt').textContent = tr('지형 생성 중... {0}%', Math.round(pct * 100));
  if (P && W) { const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4, cells = $('chunkmap').children; let i = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = getChunk(pcx + dx, pcz + dz); cells[i++].className = c ? (c.mesh ? 'm' : 'g') : ''; } }
}
function openChat(prefix = '') {
  G.ui = 'chat'; menuScreen = 'chat'; releasePointer(); input.mine = input.use = false; resetTouchHolds();
  const s = $('screen'); s.hidden = false; s.className = 'screen bg-none'; $('mc').classList.add('scr', 'chatting');
  s.innerHTML = `<div class="cmdsug" id="cmdsug" hidden role="listbox"></div><input id="chatin" class="chatin" maxlength="256" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${tr('메시지 또는 /명령어 (Enter 전송, Esc 닫기)')}" aria-label="${tr('채팅')}">`;
  const inp = $('chatin'), box = $('cmdsug'); inp.value = prefix; inp.focus();
  let sug = null, sel = 0, hist = -1, typed = '';
  const measure = document.createElement('canvas').getContext('2d');
  const render = () => {
    const v = inp.value.slice(0, inp.selectionStart ?? inp.value.length);
    sug = v === inp.value ? commandSuggest(v) : null;
    if (!sug || (!sug.list.length && !sug.usage)) { box.hidden = true; return; }
    sel = clamp(sel, 0, Math.max(0, sug.list.length - 1));
    box.innerHTML = sug.list.length ? sug.list.map((c, i) => `<div class="${i === sel ? 'on' : ''}" data-i="${i}" role="option">${esc(c)}</div>`).join('') : `<div class="usage">${esc(tr(sug.usage))}</div>`;
    box.hidden = false; const cs = getComputedStyle(inp); measure.font = cs.font;
    box.style.left = Math.max(0, Math.min(inp.offsetLeft + parseFloat(cs.paddingLeft) + measure.measureText(inp.value.slice(0, sug.start)).width, inp.offsetLeft + inp.offsetWidth - box.offsetWidth)) + 'px';
    const on = box.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const apply = i => { if (!sug || !sug.list[i]) return; const c = sug.list[i]; inp.value = inp.value.slice(0, sug.start) + c + (c.endsWith('=') || c.endsWith('[') ? '' : ' '); inp.setSelectionRange(inp.value.length, inp.value.length); sel = 0; inp.focus(); render(); };
  inp.addEventListener('input', () => { sel = 0; hist = -1; render(); });
  inp.addEventListener('click', render);
  ctx.on(box, 'pointerdown', e => { const d = e.target.closest('[data-i]'); if (!d) return; e.preventDefault(); apply(+d.dataset.i); });
  ctx.on(box, 'mousedown', e => e.preventDefault());
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    const open = sug && sug.list.length && !box.hidden;
    if (e.key === 'Tab') { e.preventDefault(); if (open) apply(sel); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && open) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + sug.list.length) % sug.list.length; render(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { // sent-message history
      e.preventDefault(); if (!CHAT_HIST.length) return; if (hist < 0) typed = inp.value;
      hist = clamp(hist + (e.key === 'ArrowUp' ? 1 : -1), -1, CHAT_HIST.length - 1); inp.value = hist < 0 ? typed : CHAT_HIST[CHAT_HIST.length - 1 - hist]; render(); return;
    }
    if (e.key === 'Enter') { const v = inp.value.trim(); closeChat(); if (v) { if (CHAT_HIST[CHAT_HIST.length - 1] !== v) CHAT_HIST.push(v); if (CHAT_HIST.length > 50) CHAT_HIST.shift(); if (v.startsWith('/')) command(v); else chat('<' + tr('나') + '> ' + v); } }
    else if (e.key === 'Escape') closeChat();
  });
  render();
  if (touchUI()) inp.addEventListener('blur', () => ctx.timeout(() => { if (G && G.ui === 'chat' && document.activeElement !== inp) closeChat(); }, 150));
}
const CHAT_HIST = [];
function closeChat() { hideScreens(); if (G) G.ui = null; capture(); }
function dayCount() { return Math.floor(W.time / DAY_TICKS) + 1; }
async function toggleFull() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('mc').requestFullscreen) await $('mc').requestFullscreen(); else toast(tr('이 브라우저에서는 전체화면을 지원하지 않아요.')); } catch { toast(tr('전체화면을 열 수 없어요. 허브 상단 전체화면 버튼도 이용해 주세요.')); } }
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
      const name = ($('wname').value.trim() || tr('새로운 세계')).slice(0, 32), seedText = $('wseed').value.trim() || String(Math.floor(Math.random() * 1e9));
      const w = { id: 'w' + Date.now().toString(36), name, mode: createOpts.mode, difficulty: createOpts.difficulty, bonus: createOpts.bonus, cheats:createOpts.cheats, structures: createOpts.structures, seedText, seed: /^-?\d+$/.test(seedText) ? (+seedText | 0) >>> 0 : hashSeed(seedText), created: Date.now(), played: Date.now(), data: null };
      SAVE.worlds.push(w); selectedWorld = w.id; startWorld(w); break;
    }
    case 'settings': keysParent = 'main'; showSettings('main'); break;
    case 'page': { const p = el.dataset.p; if (menuScreen === 'settings') { if (p === 'keys') keysParent = setPage; showSettings(p); } else { keysParent = 'pause'; pageOrigin = { page: p, from: G ? 'pause' : 'title' }; showSettings(p); } break; }
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
    case 'resetLayout': SAVE.settings.layout = {}; saveSettingsSoon(); positionTouch(); toast(tr('터치 버튼 배치를 기본값으로 되돌렸어요.')); break;
    case 'setlang': SAVE.settings.lang = el.dataset.l; applyLanguage(); applyVisualSettings(); renderTouch(); saveSettingsSoon(); if (G) invChanged(); showLanguage(); break;
    case 'cstruct': createOpts.structures = !createOpts.structures; updateCreate(); break;
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
