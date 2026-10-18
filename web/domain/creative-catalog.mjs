function colorOr(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
function textStyle(color, outlineColor, outlineWidth, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY) {
  return { fontFamily:"Arial Black", fontWeight:"bold", color, outlineColor, outlineWidth, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, align:"center" };
}
function subtitleStyle(color, outlineColor, outlineWidth, shadowColor, shadowBlur) {
  return { fontFamily:"Trebuchet MS", fontWeight:"bold", color, outlineColor, outlineWidth, shadowColor, shadowBlur, shadowOffsetX:1, shadowOffsetY:2, align:"center" };
}
export const CREATIVE_TEMPLATES = Object.freeze([
  {id:"anime-awakening",label:"Despertar shōnen",category:"Anime",description:"Rayos de energía y letras doradas de impacto.",keywords:"acción batalla poder protagonista anime portada manga",background:"#0b102a",accent:"#ffd84d",artStyle:"anime-awakening",defaultTitle:"NUEVO DESPERTAR",defaultSubtitle:"UN NUEVO ARCO COMIENZA",titleStyle:textStyle("#fff16b","#201042",7,"#f52d87",8,4,6),subtitleStyle:subtitleStyle("#ffffff","#201042",2,"#15102d",3)},
  {id:"galactic-dream",label:"Sueño galáctico",category:"Galaxia",description:"Planetas, órbitas y nebulosa violeta.",keywords:"espacio cosmos estrellas universo planetas sci-fi portada",background:"#080d2b",accent:"#b8a0ff",artStyle:"galaxy-orbit",defaultTitle:"BEYOND THE STARS",defaultSubtitle:"COSMIC STORY · VOL. 01",titleStyle:textStyle("#d5fbff","#302063",4,"#55dfff",12,1,3),subtitleStyle:subtitleStyle("#e6dfff","#251548",1,"#6f62ff",7)},
  {id:"sakura-night",label:"Sakura nocturna",category:"Romance",description:"Flores de cerezo y pétalos sobre la noche.",keywords:"sakura romance flores rosa noche anime shojo amor",background:"#1a102b",accent:"#ff82bd",artStyle:"sakura-night",defaultTitle:"SAKURA DREAM",defaultSubtitle:"LA ÚLTIMA PROMESA",titleStyle:textStyle("#ffd2e7","#652650",4,"#ff4fa6",10,2,4),subtitleStyle:subtitleStyle("#fff2fa","#59234c",1,"#f563b8",6)},
  {id:"cyber-idol",label:"Neon idol",category:"Cyberpunk",description:"Rejilla futurista y diagonales luminosas.",keywords:"cyberpunk neon idol música concierto futurista tecnología",background:"#08071f",accent:"#00eaff",artStyle:"cyber-idol",defaultTitle:"NEON//IDOL",defaultSubtitle:"LIVE FROM ANOTHER WORLD",titleStyle:textStyle("#8df8ff","#32145c",4,"#ff3ad7",12,1,4),subtitleStyle:subtitleStyle("#d8feff","#1e184d",1,"#00c9e8",7)},
  {id:"neon-vanguard",label:"Vanguardia neón",category:"Cyberpunk",description:"Marcos angulares, cian eléctrico y rosa holográfico para una protagonista futurista original.",keywords:"cyberpunk kawaii sci-fi mecha idol heroína neón cian rosa",background:"#100c24",accent:"#ff4fd8",artStyle:"cyber-idol",defaultTitle:"NEON//UNIT 07",defaultSubtitle:"TACTICAL IDOL · VOL. 01",titleStyle:textStyle("#f5fbff","#21102f",5,"#ff4fd8",14,2,5),subtitleStyle:subtitleStyle("#9af8ff","#17102b",2,"#00eaff",8)},
  {id:"manga-action",label:"Manga explosivo",category:"Manga",description:"Trama de puntos, explosión y diagonales de velocidad.",keywords:"manga cómic acción boom sfx velocidad impacto",background:"#f4f1ed",accent:"#ed3156",artStyle:"manga-action",defaultTitle:"BANG!!",defaultSubtitle:"CHAPTER 01 · THE NEW HERO",titleStyle:textStyle("#fff23a","#161322",8,"#d91f53",2,4,5),subtitleStyle:subtitleStyle("#ffffff","#151321",3,"#151321",1)},
  {id:"celestial-romance",label:"Romance celestial",category:"Romance",description:"Media luna, órbitas finas y brillos suaves.",keywords:"romance estrellas moon luna shojo pastel mágico sueño",background:"#11183a",accent:"#ffc6de",artStyle:"celestial-romance",defaultTitle:"STARDUST",defaultSubtitle:"UNA HISTORIA ENTRE ESTRELLAS",titleStyle:textStyle("#ffe3f0","#543c84",3,"#ff95d0",12,1,3),subtitleStyle:subtitleStyle("#dce9ff","#29275f",1,"#b8a0ff",5)},
  {id:"moon-magic",label:"Heroína lunar",category:"Fantasía",description:"Luna, constelaciones y un sello mágico.",keywords:"magia heroine luna estrellas fantasy magical anime",background:"#1b1652",accent:"#ffe58d",artStyle:"moon-magic",defaultTitle:"MOON MAGIC",defaultSubtitle:"THE POWER AWAKENS",titleStyle:textStyle("#fff2ac","#3c267a",4,"#bba2ff",10,2,4),subtitleStyle:subtitleStyle("#f7eeff","#302260",1,"#9f8cff",7)},
  {id:"poster",label:"Cartel editorial",category:"Diseño",description:"Marco limpio listo para títulos y subtítulos.",keywords:"poster editorial evento título composición",background:"#171324",accent:"#ff2b6d",artStyle:"poster",defaultTitle:"YOUR HEADLINE",defaultSubtitle:"ADD YOUR DETAILS HERE",titleStyle:textStyle("#ffffff","#ff2b6d",2,"#000000",14,0,5),subtitleStyle:subtitleStyle("#ffffff","#151515",0,"#000000",5)},
  {id:"comic",label:"Cómic clásico",category:"Manga",description:"Estallido de viñeta y letras contundentes.",keywords:"comic clásico superhero acción viñeta",background:"#151321",accent:"#ff2b6d",artStyle:"manga-action",defaultTitle:"BANG!!",defaultSubtitle:"ISSUE 01",titleStyle:textStyle("#fff200","#151321",6,"#151321",0,5,7),subtitleStyle:subtitleStyle("#ffffff","#151321",3,"#151321",0)},
  {id:"manga",label:"Manga elegante",category:"Manga",description:"Composición sobria para una portada narrativa.",keywords:"manga elegante novela gráfica blanco negro historia",background:"#f2f0f3",accent:"#543b76",artStyle:"sakura-night",defaultTitle:"LA NUEVA HISTORIA",defaultSubtitle:"CAPÍTULO 01",titleStyle:textStyle("#1b1630","#ffffff",1,"#ffffff",0,2,2),subtitleStyle:subtitleStyle("#1b1630","#ffffff",0,"#ffffff",0)}
]);
export const STICKER_CATALOG = Object.freeze([
  {id:"sakura-bloom",label:"Flor de sakura",category:"Anime",description:"Flor rosa de cinco pétalos.",keywords:"flor sakura pétalos romance rosa"},
  {id:"planet-ring",label:"Planeta orbital",category:"Galaxia",description:"Planeta con anillo y satélite.",keywords:"planeta saturno espacio cosmos"},
  {id:"star-spark",label:"Destellos mágicos",category:"Brillos",description:"Chispas brillantes para decorar.",keywords:"sparkle estrella magia brillo"},
  {id:"heart-holo",label:"Corazón holográfico",category:"Romance",description:"Corazón neón con brillo.",keywords:"heart love corazón amor shojo"},
  {id:"lightning-bolt",label:"Rayo de energía",category:"Anime",description:"Rayo amarillo de gran impacto.",keywords:"rayo poder shonen energía"},
  {id:"comic-burst",label:"Explosión cómic",category:"Manga",description:"Estallido gráfico para onomatopeyas.",keywords:"boom manga acción viñeta"},
  {id:"speed-lines",label:"Líneas de velocidad",category:"Manga",description:"Trazos cinéticos de movimiento.",keywords:"velocidad speedlines acción manga"},
  {id:"moon-stars",label:"Luna y estrellas",category:"Galaxia",description:"Media luna con constelación.",keywords:"luna estrellas magia night"},
  {id:"anime-cat",label:"Carita neko",category:"Anime",description:"Carita de gato original kawaii.",keywords:"gato neko kawaii anime cute"},
  {id:"crystal-prism",label:"Cristal prisma",category:"Fantasía",description:"Gema facetada para diseños mágicos.",keywords:"cristal gema prisma fantasía"},
  {id:"speech-bubble",label:"Globo manga",category:"Manga",description:"Globo decorativo para un diálogo.",keywords:"speech bubble diálogo manga comic"},
  {id:"orbit-frame",label:"Marco orbital",category:"Galaxia",description:"Aros cósmicos para rodear un título.",keywords:"aro marco orbital cosmos"}
]);
export const WORD_ART_PRESETS = Object.freeze([
  {id:"shonen-impact",label:"Impacto shōnen",sample:"覚醒!!",description:"Dorado, contorno oscuro y sombra potente.",keywords:"despertar power up acción japonés",style:textStyle("#ffe95a","#24123f",7,"#ff398a",9,4,5)},
  {id:"galactic-title",label:"Título estelar",sample:"STARDUST",description:"Cian luminoso con resplandor violeta.",keywords:"galaxia cosmos título sci-fi",style:textStyle("#d4fbff","#332064",4,"#58e5ff",13,1,3)},
  {id:"sakura-script",label:"Sueño sakura",sample:"桜の夢",description:"Rosa pastel con borde berenjena.",keywords:"sakura shojo romance flores",style:textStyle("#ffd1e8","#69284f",4,"#ff57ad",10,2,4)},
  {id:"cyber-idol",label:"Neon idol",sample:"NEON//IDOL",description:"Cian y magenta para portadas cyberpunk.",keywords:"neon cyberpunk idol música",style:textStyle("#8df8ff","#32145c",4,"#ff3ad7",12,1,4)},
  {id:"manga-sfx",label:"Sonido manga",sample:"ドン!!",description:"Amarillo fuerte con trazo negro.",keywords:"onomatopeya manga boom don sfx",style:textStyle("#fff23a","#111111",9,"#ed3156",2,4,5)},
  {id:"moon-magic-title",label:"Magia lunar",sample:"星の魔法",description:"Dorado suave con sombra violeta.",keywords:"moon magical girl magia estrellas",style:textStyle("#fff0a4","#332271",4,"#bba2ff",10,2,4)},
  {id:"pixel-pop",label:"Pixel pop",sample:"LEVEL UP!",description:"Menta vibrante para un estilo arcade.",keywords:"pixel game arcade level up",style:textStyle("#8affb7","#153529",4,"#101820",2,3,4)},
  {id:"romance-note",label:"Nota romántica",sample:"君と見た星",description:"Rosa perla con brillo sutil.",keywords:"romance cielo estrellas shojo pareja",style:textStyle("#ffd7e9","#544783",3,"#ff95d0",8,1,3)}
]);
export const STYLE_PACKS = Object.freeze([
  {id:"galaxy-idol",label:"Idol galáctica",description:"Título, subtítulo y planeta para una portada espacial.",keywords:"galaxy idol cosmic stardust espacio",titlePreset:"galactic-title",title:"STARDUST",subtitlePreset:"romance-note",subtitle:"COSMIC CLUB · VOL. 01",stickerId:"planet-ring",colors:["#b8a0ff","#00eaff","#ff55c8"]},
  {id:"sakura-dream",label:"Sueño sakura",description:"Romance, pétalos y tipografía rosa.",keywords:"sakura romance flores shojo pink",titlePreset:"sakura-script",title:"SAKURA DREAM",subtitlePreset:"romance-note",subtitle:"LA ÚLTIMA PROMESA",stickerId:"sakura-bloom",colors:["#ff82bd","#ffc6de","#8c5ac7"]},
  {id:"shonen-breaker",label:"Despertar shōnen",description:"Impacto, energía y una explosión de cómic.",keywords:"shonen batalla acción energía boom",titlePreset:"shonen-impact",title:"NUEVO DESPERTAR",subtitlePreset:"pixel-pop",subtitle:"ARCO · 01",stickerId:"comic-burst",colors:["#ffd84d","#ff3e80","#19132d"]},
  {id:"neon-afterdark",label:"Neon afterdark",description:"ID futurista, acentos eléctricos y un rayo.",keywords:"cyberpunk neon idol noche",titlePreset:"cyber-idol",title:"NEON//IDOL",subtitlePreset:"galactic-title",subtitle:"LIVE AFTER DARK",stickerId:"lightning-bolt",colors:["#00eaff","#ff3ad7","#20134b"]},
  {id:"neon-valkyrie",label:"Valkiria neón",description:"Un conjunto cyber-kawaii de contraste táctico, luces holográficas y títulos enérgicos.",keywords:"cyberpunk anime kawaii sci-fi protagonista mecha neon",titlePreset:"cyber-idol",title:"NEON//UNIT 07",subtitlePreset:"pixel-pop",subtitle:"TACTICAL IDOL · 001",stickerId:"crystal-prism",colors:["#ff4fd8","#00eaff","#151127"]}
]);
export function getCreativeTemplate(id) { return CREATIVE_TEMPLATES.find(item => item.id === id) || null; }
export function getSticker(id) { return STICKER_CATALOG.find(item => item.id === id) || null; }
export function getWordArtPreset(id) { return WORD_ART_PRESETS.find(item => item.id === id) || null; }
export function getStylePack(id) { return STYLE_PACKS.find(item => item.id === id) || null; }
export function svgDataUrl(svg) {
  if (typeof svg !== "string" || !svg.trim().startsWith("<svg")) throw new TypeError("A standalone SVG string is required");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
const STICKER_ART = Object.freeze({
  "sakura-bloom": '<g transform="translate(128 128)" stroke="#7b2d67" stroke-width="5" stroke-linejoin="round"><ellipse cy="-40" rx="28" ry="48" fill="#ffb5d5"/><ellipse cy="-40" rx="28" ry="48" fill="#ffd5e8" transform="rotate(72)"/><ellipse cy="-40" rx="28" ry="48" fill="#f991c4" transform="rotate(144)"/><ellipse cy="-40" rx="28" ry="48" fill="#ffd5e8" transform="rotate(216)"/><ellipse cy="-40" rx="28" ry="48" fill="#ffb5d5" transform="rotate(288)"/><circle r="24" fill="#ffe783"/><circle r="8" fill="#fff9d5" stroke="none"/></g><path d="M40 48l8 18 18 8-18 8-8 18-8-18-18-8 18-8z" fill="#ffffff" stroke="#f991c4" stroke-width="4"/>',
  "planet-ring": '<g stroke="#dce8ff" stroke-linejoin="round"><ellipse cx="128" cy="136" rx="105" ry="34" fill="#8c66db" stroke-width="10" transform="rotate(-22 128 136)"/><circle cx="128" cy="124" r="65" fill="url(#planet)" stroke-width="7"/><path d="M78 111q45-29 98 0M77 139q51 20 100-2" fill="none" stroke="#b9f9ff" stroke-width="8" stroke-linecap="round"/><ellipse cx="128" cy="136" rx="106" ry="34" fill="none" stroke="#ffe7ff" stroke-width="5" transform="rotate(-22 128 136)"/><path d="M211 51l7 15 15 7-15 7-7 15-7-15-15-7 15-7z" fill="#fff1a1" stroke="#6f56b7" stroke-width="3"/></g>',
  "star-spark": '<g stroke-linejoin="round"><path d="M128 9L151 94 241 115 151 139 128 236 103 139 15 115 103 94z" fill="#fff17a" stroke="#5e438f" stroke-width="7"/><path d="M52 32l11 28 28 11-28 11-11 28-11-28-28-11 28-11z" fill="#ff7fc4" stroke="#ffffff" stroke-width="5"/><path d="M205 165l9 22 22 9-22 9-9 22-9-22-22-9 22-9z" fill="#88f5ff" stroke="#ffffff" stroke-width="5"/></g>',
  "heart-holo": '<path d="M128 224C91 194 31 150 31 91c0-37 47-57 75-25l22 25 22-25c28-32 75-12 75 25 0 59-60 103-97 133z" fill="url(#heart)" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/><path d="M63 86q7-22 30-20" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/><path d="M203 36l7 15 15 7-15 7-7 15-7-15-15-7 15-7z" fill="#fff6a8" stroke="#a54da7" stroke-width="3"/>',
  "lightning-bolt": '<path d="M147 9L53 139h59L96 247 204 105h-64z" fill="#ffe94e" stroke="#2b1b50" stroke-width="13" stroke-linejoin="round"/><path d="M143 43L91 127h41l-12 70 53-93h-40z" fill="#fffbd0" opacity=".84"/>',
  "comic-burst": '<polygon points="128,9 149,66 207,31 190,91 248,92 201,131 246,171 184,172 190,235 141,194 111,246 98,185 42,211 66,158 9,139 67,111 26,65 92,78" fill="#fff25c" stroke="#191529" stroke-width="10" stroke-linejoin="round"/><path d="M127 30l8 69 55-37-37 55 66 5-63 18 48 44-59-26-8 57-17-58-47 33 25-53-60-5 56-23-37-45 50 29z" fill="#ff547f" opacity=".9"/>',
  "speed-lines": '<g fill="none" stroke-linecap="round"><path d="M8 60L220 20M5 91L245 43M4 126L215 98M7 168L251 145M27 209L224 194" stroke="#20153a" stroke-width="21"/><path d="M8 60L220 20M5 91L245 43M4 126L215 98M7 168L251 145M27 209L224 194" stroke="#87f5ff" stroke-width="8"/><path d="M61 24l-21 34 38-4-24 40 59-20" stroke="#ff4da3" stroke-width="7"/></g>',
  "moon-stars": '<path d="M174 22c-53 6-91 52-91 105 0 58 46 105 104 105 13 0 26-3 37-8-19 27-51 44-87 44-60 0-109-49-109-109S77 50 137 50c13 0 26 2 37 7z" fill="#ffeaa6" stroke="#7e67d4" stroke-width="9" stroke-linejoin="round"/><path d="M190 48l11 26 27 11-27 11-11 27-11-27-27-11 27-11zM58 148l8 18 18 8-18 8-8 18-8-18-18-8 18-8z" fill="#ffffff" stroke="#8c7be7" stroke-width="5"/>',
  "anime-cat": '<path d="M44 95L32 28 91 62Q128 45 165 62L224 28 212 95Q232 118 220 167Q202 225 128 230Q54 225 36 167Q24 118 44 95z" fill="#fff1f7" stroke="#633b88" stroke-width="10" stroke-linejoin="round"/><path d="M77 130q16-23 32 0M147 130q16-23 32 0" fill="none" stroke="#482b6a" stroke-width="9" stroke-linecap="round"/><path d="M116 159l12 8 12-8-12 18z" fill="#ff6ea9"/><path d="M111 192q17 12 34 0" fill="none" stroke="#633b88" stroke-width="7" stroke-linecap="round"/><path d="M43 159L10 150M44 179L11 187M213 159l33-9M212 179l33 8" stroke="#633b88" stroke-width="6" stroke-linecap="round"/><path d="M64 51l12 25 25 12-25 12-12 25-12-25-25-12 25-12z" fill="#8eeaff" stroke="#ffffff" stroke-width="4"/>',
  "crystal-prism": '<polygon points="128,9 213,80 182,206 128,247 74,206 43,80" fill="url(#crystal)" stroke="#ffffff" stroke-width="9" stroke-linejoin="round"/><path d="M128 9L105 111 43 80M128 9l30 102 55-31M105 111l23 136 30-136-30 0-55-31 55 31 85-31-55 31" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/><path d="M128 9L105 111h53z" fill="#ffffff" opacity=".28"/>',
  "speech-bubble": '<path d="M34 43Q34 23 55 23H201Q222 23 222 44V150Q222 171 201 171H119L76 221V171H55Q34 171 34 150z" fill="#ffffff" stroke="#241838" stroke-width="10" stroke-linejoin="round"/><path d="M58 61H198M58 96H178M58 131H147" stroke="#ff4b99" stroke-width="11" stroke-linecap="round"/><path d="M185 29l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#ffe96a"/>',
  "orbit-frame": '<ellipse cx="128" cy="128" rx="99" ry="65" fill="none" stroke="#b89cff" stroke-width="13" transform="rotate(-22 128 128)"/><ellipse cx="128" cy="128" rx="78" ry="105" fill="none" stroke="#65efff" stroke-width="7" transform="rotate(35 128 128)"/><circle cx="128" cy="128" r="16" fill="#fff4b0"/><path d="M39 41l9 20 20 9-20 9-9 20-9-20-20-9 20-9zM212 181l8 17 17 8-17 8-8 17-8-17-17-8 17-8z" fill="#ffffff" stroke="#7560bf" stroke-width="4"/>'
});
export function createStickerSvg(id) {
  if (!STICKER_CATALOG.some(item => item.id === id)) throw new RangeError("Unknown sticker preset");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6f6ff"/><stop offset=".48" stop-color="#9276f3"/><stop offset="1" stop-color="#ff75c6"/></linearGradient><linearGradient id="heart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb0d4"/><stop offset=".5" stop-color="#ff3d9b"/><stop offset="1" stop-color="#9f5dff"/></linearGradient><linearGradient id="crystal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d5ffff"/><stop offset=".43" stop-color="#a2a0ff"/><stop offset="1" stop-color="#ff96d7"/></linearGradient></defs>' + STICKER_ART[id] + '</svg>';
}
export function createPosterSvg(width,height,background,accent,styleId) {
  const w = Math.max(1,Math.min(8192,Math.round(Number(width)||1080)));
  const h = Math.max(1,Math.min(8192,Math.round(Number(height)||1350)));
  const bg = colorOr(background,"#171324"), fg = colorOr(accent,"#ff2b6d");
  const template = getCreativeTemplate(styleId), style = template ? template.artStyle : styleId || "poster";
  const band = Math.max(20,Math.round(h*.055)), stars = [];
  for (let i=0;i<34;i++) {
    const x=(i*137+29)%w, y=(i*197+43)%h, r=Math.max(1,Math.min(4,w*(i%5===0?.004:.002)));
    stars.push(i%4===0
      ? '<path d="M'+x+' '+(y-r*2)+'L'+(x+r*.6)+' '+(y-r*.6)+' '+(x+r*2)+' '+y+' '+(x+r*.6)+' '+(y+r*.6)+' '+x+' '+(y+r*2)+' '+(x-r*.6)+' '+(y+r*.6)+' '+(x-r*2)+' '+y+' '+(x-r*.6)+' '+(y-r*.6)+'Z" fill="#ffffff" opacity=".7"/>'
      : '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#ffffff" opacity="'+(i%3===0?".78":".42")+'"/>');
  }
  const circle = (x,y,r,fill,opacity) => '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" opacity="'+opacity+'"/>';
  let motif = "";
  if (style==="anime-awakening") {
    motif = circle(w*.5,h*.43,Math.min(w,h)*.30,"url(#glow)",".9");
    for(let i=0;i<24;i++) {
      const a=-Math.PI+i*Math.PI*2/24,r1=Math.min(w,h)*.10,r2=Math.min(w,h)*(.32+(i%3)*.07);
      motif += '<path d="M'+(w*.5+Math.cos(a)*r1)+' '+(h*.43+Math.sin(a)*r1)+'L'+(w*.5+Math.cos(a)*r2)+' '+(h*.43+Math.sin(a)*r2)+'" stroke="'+(i%2?fg:"#ffffff")+'" stroke-opacity="'+(i%3?".34":".58")+'" stroke-width="'+Math.max(2,w*.004)+'"/>';
    }
    motif += '<path d="M'+(w*.03)+' '+(h*.7)+'L'+(w*.32)+' '+(h*.30)+' '+(w*.44)+' '+(h*.78)+' '+(w*.69)+' '+(h*.17)+' '+(w*.97)+' '+(h*.68)+'" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(4,w*.015)+'" stroke-opacity=".42"/>';
  } else if(style==="galaxy-orbit") {
    motif = circle(w*.68,h*.38,Math.min(w,h)*.28,"url(#glow)",".9")+'<ellipse cx="'+(w*.68)+'" cy="'+(h*.38)+'" rx="'+(w*.36)+'" ry="'+(h*.105)+'" transform="rotate(-24 '+(w*.68)+' '+(h*.38)+')" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(4,w*.012)+'" stroke-opacity=".72"/>'+circle(w*.68,h*.38,Math.min(w,h)*.145,"url(#planet)","1")+'<path d="M'+(w*.58)+' '+(h*.34)+'q'+(w*.11)+' '+(-h*.09)+' '+(w*.23)+' 0M'+(w*.59)+' '+(h*.42)+'q'+(w*.10)+' '+(h*.065)+' '+(w*.21)+' 0" fill="none" stroke="#ffffff" stroke-width="'+Math.max(3,w*.008)+'" stroke-linecap="round"/>';
  } else if(style==="sakura-night") {
    motif = circle(w*.73,h*.29,Math.min(w,h)*.28,"url(#glow)",".7")+'<path d="M'+(w*.02)+' '+(h*.55)+'Q'+(w*.3)+' '+(h*.46)+' '+(w*.47)+' '+(h*.23)+'T'+(w*.94)+' '+(h*.12)+'" fill="none" stroke="#b47cc6" stroke-width="'+Math.max(5,w*.018)+'" stroke-linecap="round" opacity=".7"/>';
    const petals=[[.34,.42,.11],[.73,.24,.13],[.84,.60,.075]];
    petals.forEach((p,index)=>{
      const cx=w*p[0],cy=h*p[1],size=Math.min(w,h)*p[2],colors=["#ffb1d6","#ffc6e5","#f892c6"];
      motif+='<g transform="translate('+cx+' '+cy+')" fill="'+colors[index]+'" stroke="#9d447d" stroke-width="2.5">';
      for(let j=0;j<5;j++)motif+='<ellipse cy="'+(-size*.48)+'" rx="'+(size*.27)+'" ry="'+(size*.49)+'" transform="rotate('+(j*72)+')"/>';
      motif+='<circle r="'+(size*.17)+'" fill="#ffe98d" stroke="#fff8dc" stroke-width="2"/></g>';
    });
  } else if(style==="cyber-idol") {
    motif='<rect width="'+w+'" height="'+h+'" fill="url(#grid)" opacity=".56"/><path d="M'+(w*.1)+' '+(h*.28)+'L'+(w*.44)+' '+(h*.13)+' '+(w*.72)+' '+(h*.34)+' '+(w*.95)+' '+(h*.18)+'M'+(w*.05)+' '+(h*.62)+'L'+(w*.35)+' '+(h*.47)+' '+(w*.60)+' '+(h*.68)+' '+(w*.94)+' '+(h*.52)+'" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(5,w*.014)+'" stroke-linejoin="round" opacity=".85"/>'+circle(w*.78,h*.27,Math.min(w,h)*.13,"url(#glow)",".9")+'<circle cx="'+(w*.78)+'" cy="'+(h*.27)+'" r="'+(Math.min(w,h)*.085)+'" fill="none" stroke="#ffffff" stroke-width="'+Math.max(4,w*.007)+'" opacity=".78"/>';
  } else if(style==="manga-action") {
    const cx=w*.73,cy=h*.43,radius=Math.min(w,h)*.48,points=[];
    for(let i=0;i<32;i++){const a=-Math.PI/2+i*Math.PI/16,r=radius*(i%2===0?1:.63);points.push((cx+Math.cos(a)*r)+","+(cy+Math.sin(a)*r));}
    motif='<rect width="'+w+'" height="'+h+'" fill="url(#dots)" opacity=".5"/><polygon points="'+points.join(" ")+'" fill="'+fg+'" stroke="#171321" stroke-width="'+Math.max(5,w*.012)+'" stroke-linejoin="round" opacity=".38"/><path d="M'+(w*.02)+' '+(h*.12)+'L'+(w*.47)+' '+(h*.28)+'M'+(w*.02)+' '+(h*.23)+'L'+(w*.37)+' '+(h*.34)+'M'+(w*.11)+' '+(h*.88)+'L'+(w*.52)+' '+(h*.66)+'M'+(w*.04)+' '+(h*.78)+'L'+(w*.40)+' '+(h*.62)+'" fill="none" stroke="#171321" stroke-width="'+Math.max(5,w*.013)+'" stroke-linecap="round" opacity=".8"/>';
  } else if(style==="celestial-romance"||style==="moon-magic") {
    motif=circle(w*.69,h*.32,Math.min(w,h)*.24,"url(#glow)",".75")+'<path d="M'+(w*.72)+' '+(h*.15)+'a'+(Math.min(w,h)*.17)+' '+(Math.min(w,h)*.17)+' 0 1 0 0 '+(Math.min(w,h)*.34)+'a'+(Math.min(w,h)*.13)+' '+(Math.min(w,h)*.13)+' 0 1 1 0 '+(-Math.min(w,h)*.34)+'z" fill="#ffe5b0" stroke="#fff7df" stroke-width="'+Math.max(3,w*.005)+'"/><ellipse cx="'+(w*.68)+'" cy="'+(h*.33)+'" rx="'+(w*.31)+'" ry="'+(h*.09)+'" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(3,w*.006)+'" transform="rotate(-18 '+(w*.68)+' '+(h*.33)+')"/>';
  } else {
    motif=circle(w*.73,h*.32,Math.min(w,h)*.24,"url(#glow)",".72")+'<circle cx="'+(w*.73)+'" cy="'+(h*.32)+'" r="'+(Math.min(w,h)*.16)+'" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(3,w*.007)+'" opacity=".74"/><path d="M'+(w*.58)+' '+(h*.18)+'L'+(w*.84)+' '+(h*.47)+'M'+(w*.85)+' '+(h*.20)+'L'+(w*.59)+' '+(h*.47)+'" stroke="#ffffff" stroke-width="'+Math.max(2,w*.004)+'" opacity=".45"/>';
  }
  const secondary=style==="manga-action"?"#fff200":style==="sakura-night"?"#f4d9ef":fg;
  const gs=Math.max(24,Math.round(w*.045)),ds=Math.max(8,Math.round(w*.025));
  const defs='<defs><linearGradient id="cover-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+bg+'"/><stop offset=".57" stop-color="'+bg+'"/><stop offset="1" stop-color="'+fg+'" stop-opacity=".52"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="'+fg+'" stop-opacity=".9"/><stop offset="1" stop-color="'+fg+'" stop-opacity="0"/></radialGradient><linearGradient id="planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b7ffff"/><stop offset=".42" stop-color="#9983ff"/><stop offset="1" stop-color="#ff81cf"/></linearGradient><pattern id="grid" width="'+gs+'" height="'+gs+'" patternUnits="userSpaceOnUse"><path d="M '+gs+' 0 L 0 0 0 '+gs+'" fill="none" stroke="'+fg+'" stroke-opacity=".45" stroke-width="'+Math.max(1,w*.0015)+'"/></pattern><pattern id="dots" width="'+ds+'" height="'+ds+'" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="'+Math.max(1,w*.0028)+'" fill="#161321" opacity=".66"/></pattern></defs>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+defs+'<rect width="'+w+'" height="'+h+'" fill="url(#cover-bg)"/>'+stars.join("")+motif+'<path d="M'+(w*.06)+' '+(h*.13)+'H'+(w*.21)+'M'+(w*.06)+' '+(h*.13)+'V'+(h*.24)+'M'+(w*.94)+' '+(h*.78)+'H'+(w*.80)+'M'+(w*.94)+' '+(h*.78)+'V'+(h*.68)+'" fill="none" stroke="'+fg+'" stroke-width="'+Math.max(3,w*.006)+'" stroke-opacity=".78"/><rect width="'+w+'" height="'+band+'" fill="'+fg+'" opacity=".76"/><rect y="'+(h-band)+'" width="'+w+'" height="'+band+'" fill="'+secondary+'" opacity=".84"/><rect x="'+(w*.055)+'" y="'+(h*.14)+'" width="'+(w*.89)+'" height="'+(h*.72)+'" rx="'+(style==="manga-action"?w*.008:w*.025)+'" fill="none" stroke="'+fg+'" stroke-opacity=".68" stroke-width="'+Math.max(3,w*.005)+'"/></svg>';
}
