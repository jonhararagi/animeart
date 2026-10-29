const PARTS = Object.freeze(["eyes", "hair", "face", "expression"]);
const COLOR_RE = /^#[0-9a-f]{6}$/i;

function freezeComponent(component) {
  return Object.freeze({
    ...component,
    tags: Object.freeze([...component.tags]),
    visualTraits: Object.freeze([...component.visualTraits]),
    defaultColors: Object.freeze({ ...component.defaultColors }),
    originType: "generated",
    license: "SVG original generado por KapiArt; no utiliza un archivo de terceros.",
    provenance: "Dibujo vectorial original creado por KapiArt mediante trazados locales incluidos en el programa."
  });
}

export const ANIME_STYLE_COMPONENTS = Object.freeze([
  freezeComponent({ id:"eyes-round-glossy", part:"eyes", label:"Ojos grandes brillantes", description:"Iris amplios, pupilas redondas y reflejos dobles para una mirada kawaii.", tags:["ojos","redondos","brillo","kawaii","shojo","iris grande"], visualTraits:["iris amplio","reflejos dobles","curva suave"], defaultColors:{primary:"#402744",eye:"#6dd6e8",skin:"#f4c7b7"} }),
  freezeComponent({ id:"eyes-almond-elegant", part:"eyes", label:"Ojos almendrados elegantes", description:"Apertura horizontal alargada, párpado fino y brillo discreto.", tags:["ojos","almendrados","elegantes","finos","seinen","pestañas"], visualTraits:["apertura alargada","párpado fino","iris estrecho"], defaultColors:{primary:"#33283b",eye:"#a58af0",skin:"#f4c7b7"} }),
  freezeComponent({ id:"eyes-sharp-action", part:"eyes", label:"Ojos afilados de acción", description:"Esquinas marcadas y pestañas angulares para una expresión decidida.", tags:["ojos","afilados","acción","shonen","intensos","angulares"], visualTraits:["esquinas agudas","pestañas angulares","ceja firme"], defaultColors:{primary:"#201d35",eye:"#ee557e",skin:"#eebaa9"} }),
  freezeComponent({ id:"eyes-sleepy-soft", part:"eyes", label:"Ojos tranquilos semicerrados", description:"Párpados relajados y pupilas pequeñas para una expresión serena.", tags:["ojos","semicerrados","tranquilos","suaves","relajados","expresión"], visualTraits:["párpado bajo","iris pequeño","cejas relajadas"], defaultColors:{primary:"#453444",eye:"#7bc9a9",skin:"#f4c7b7"} }),
  freezeComponent({ id:"hair-spiky-short", part:"hair", label:"Cabello corto puntiagudo", description:"Mechones elevados y silueta irregular de energía shonen.", tags:["cabello","pelo","corto","puntiagudo","mechones","shonen"], visualTraits:["puntas altas","nuca corta","flequillo quebrado"], defaultColors:{primary:"#3a2b45",eye:"#72dbe8",skin:"#f2c4b4"} }),
  freezeComponent({ id:"hair-straight-bob", part:"hair", label:"Bob recto con flequillo", description:"Silueta compacta, laterales rectos y flequillo definido.", tags:["cabello","pelo","bob","corte recto","flequillo","shojo"], visualTraits:["silueta compacta","flequillo recto","laterales simétricos"], defaultColors:{primary:"#3b2943",eye:"#9d7aef",skin:"#f2c4b4"} }),
  freezeComponent({ id:"hair-long-swept", part:"hair", label:"Melena larga barrida", description:"Cabello largo con raya lateral y mechones que cruzan la frente.", tags:["cabello","pelo","largo","melena","raya lateral","mechones"], visualTraits:["largo hasta el pecho","flequillo lateral","puntas curvas"], defaultColors:{primary:"#2e263d",eye:"#7bdac9",skin:"#f2c4b4"} }),
  freezeComponent({ id:"hair-twin-tails", part:"hair", label:"Coletas gemelas", description:"Dos coletas con lazos y flequillo segmentado, con una silueta diferente al bob y la melena.", tags:["cabello","pelo","coletas","gemelas","lazos","idol","kawaii"], visualTraits:["dos coletas","lazos visibles","flequillo dividido"], defaultColors:{primary:"#ca639c",eye:"#6acfe6",skin:"#f4c7b7"} }),
  freezeComponent({ id:"face-round-soft", part:"face", label:"Rostro redondeado suave", description:"Mejillas anchas y mentón corto para una proporción amable.", tags:["rostro","cara","redondo","mejillas","suave","kawaii"], visualTraits:["mejillas anchas","mentón corto","mandíbula curva"], defaultColors:{primary:"#35263b",eye:"#604060",skin:"#f4c7b7"} }),
  freezeComponent({ id:"face-oval-balanced", part:"face", label:"Rostro ovalado equilibrado", description:"Frente media y mandíbula gradual para una base facial versátil.", tags:["rostro","cara","ovalado","equilibrado","base","proporciones"], visualTraits:["óvalo vertical","mandíbula gradual","mentón medio"], defaultColors:{primary:"#35263b",eye:"#604060",skin:"#f2c4b4"} }),
  freezeComponent({ id:"face-angular-defined", part:"face", label:"Rostro anguloso definido", description:"Pómulos marcados y mandíbula geométrica para un diseño más adulto.", tags:["rostro","cara","anguloso","mandíbula","pómulos","adulto"], visualTraits:["pómulos marcados","mandíbula definida","mentón anguloso"], defaultColors:{primary:"#282437",eye:"#604060",skin:"#eebaa9"} }),
  freezeComponent({ id:"face-long-oval", part:"face", label:"Rostro ovalado alargado", description:"Mayor longitud vertical y mentón fino, con rasgos más espaciados.", tags:["rostro","cara","alargado","ovalado","mentón fino","proporciones"], visualTraits:["longitud vertical","mentón fino","rasgos espaciados"], defaultColors:{primary:"#35263b",eye:"#604060",skin:"#f2c4b4"} }),
  freezeComponent({ id:"expression-soft-smile", part:"expression", label:"Sonrisa suave", description:"Boca curvada y rubor ligero para una expresión amable y tranquila.", tags:["expresión","sonrisa","amable","suave","feliz","boca"], visualTraits:["curva ascendente","boca cerrada","rubor discreto"], defaultColors:{primary:"#e89a9c",eye:"#604060",skin:"#f4c7b7"} }),
  freezeComponent({ id:"expression-open-happy", part:"expression", label:"Sonrisa abierta", description:"Boca abierta con dientes visibles para una expresión alegre y enérgica.", tags:["expresión","sonrisa abierta","feliz","alegre","dientes","boca"], visualTraits:["boca abierta","dientes visibles","comisuras elevadas"], defaultColors:{primary:"#e89a9c",eye:"#604060",skin:"#f4c7b7"} }),
  freezeComponent({ id:"expression-confident-smirk", part:"expression", label:"Sonrisa ladeada", description:"Comisura asimétrica para una actitud segura o pícara, sin cambiar los ojos.", tags:["expresión","sonrisa ladeada","segura","pícara","asimétrica","boca"], visualTraits:["comisura asimétrica","boca estrecha","gesto lateral"], defaultColors:{primary:"#d78a95",eye:"#604060",skin:"#f2c4b4"} }),
  freezeComponent({ id:"expression-surprised", part:"expression", label:"Sorpresa", description:"Boca pequeña y abierta para sorpresa, asombro o una reacción inesperada.", tags:["expresión","sorpresa","asombro","boca abierta","reacción","anime"], visualTraits:["boca ovalada","apertura vertical","gesto sorprendido"], defaultColors:{primary:"#e89a9c",eye:"#604060",skin:"#f4c7b7"} })
]);

function normalizeSearch(value) {
  return String(value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function getAnimeStyleComponent(id) {
  return ANIME_STYLE_COMPONENTS.find(component => component.id === String(id)) || null;
}

export function searchAnimeStyleComponents(query = "", part = "all") {
  const term = normalizeSearch(query);
  const selectedPart = PARTS.includes(part) ? part : "all";
  return ANIME_STYLE_COMPONENTS.filter(component => {
    if (selectedPart !== "all" && component.part !== selectedPart) return false;
    if (!term) return true;
    const haystack = normalizeSearch([
      component.id, component.part, component.label, component.description,
      ...component.tags, ...component.visualTraits
    ].join(" "));
    return haystack.includes(term);
  });
}

function safeColor(value, fallback) {
  return typeof value === "string" && COLOR_RE.test(value) ? value : fallback;
}

function svgRoot(label, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="' + label + '">' + body + "</svg>";
}

const HAIR_FACE_MARKER = "<!--KAPIART_FACE_DETAILS-->";

function eyesArtwork(id, dark, iris) {
  const round = '<path d="M29 112 Q64 64 108 109 Q72 151 29 112Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M148 109 Q192 64 227 112 Q184 151 148 109Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><circle cx="70" cy="108" r="19" fill="' + iris + '"/><circle cx="186" cy="108" r="19" fill="' + iris + '"/><circle cx="70" cy="111" r="10" fill="' + dark + '"/><circle cx="186" cy="111" r="10" fill="' + dark + '"/><circle cx="63" cy="99" r="7" fill="#fff"/><circle cx="179" cy="99" r="7" fill="#fff"/><circle cx="79" cy="118" r="3" fill="#fff"/><circle cx="195" cy="118" r="3" fill="#fff"/><path d="M35 95 Q67 70 103 92 M153 92 Q189 70 221 95" fill="none" stroke="' + dark + '" stroke-width="7" stroke-linecap="round"/>';
  const almond = '<path d="M27 112 Q59 84 109 107 Q74 130 27 112Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M147 107 Q197 84 229 112 Q182 130 147 107Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><ellipse cx="72" cy="108" rx="13" ry="15" fill="' + iris + '"/><ellipse cx="184" cy="108" rx="13" ry="15" fill="' + iris + '"/><ellipse cx="72" cy="111" rx="6" ry="9" fill="' + dark + '"/><ellipse cx="184" cy="111" rx="6" ry="9" fill="' + dark + '"/><circle cx="68" cy="102" r="4" fill="#fff"/><circle cx="180" cy="102" r="4" fill="#fff"/><path d="M28 108 L16 98 M35 101 L27 87 M102 102 L111 96 M228 108 L240 98 M221 101 L229 87 M154 102 L145 96" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><path d="M38 91 Q67 78 101 92 M155 92 Q189 78 218 91" fill="none" stroke="' + dark + '" stroke-width="6" stroke-linecap="round"/>';
  const sharp = '<path d="M22 115 L45 91 Q80 75 111 104 L76 128 Q46 129 22 115Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M145 104 Q176 75 211 91 L234 115 Q210 129 180 128Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M67 91 L74 121 L92 115 L94 98Z M162 98 L164 115 L182 121 L189 91Z" fill="' + iris + '"/><path d="M74 96 L81 118 L91 113 L89 98Z M165 98 L163 113 L173 118 L180 96Z" fill="' + dark + '"/><circle cx="76" cy="96" r="4" fill="#fff"/><circle cx="178" cy="96" r="4" fill="#fff"/><path d="M24 108 L9 96 M33 101 L22 85 M103 97 L115 87 M232 108 L247 96 M223 101 L234 85 M153 97 L141 87" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><path d="M39 83 L94 78 M217 83 L162 78" stroke="' + dark + '" stroke-width="7" stroke-linecap="round"/>';
  const sleepy = '<path d="M29 115 Q60 86 108 112 Q70 132 29 115Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M148 112 Q196 86 227 115 Q186 132 148 112Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><ellipse cx="69" cy="112" rx="11" ry="12" fill="' + iris + '"/><ellipse cx="187" cy="112" rx="11" ry="12" fill="' + iris + '"/><ellipse cx="69" cy="116" rx="5" ry="7" fill="' + dark + '"/><ellipse cx="187" cy="116" rx="5" ry="7" fill="' + dark + '"/><path d="M30 109 Q64 87 107 107 M149 107 Q192 87 226 109" fill="none" stroke="' + dark + '" stroke-width="8" stroke-linecap="round"/><path d="M43 88 Q66 79 86 87 M170 87 Q190 79 213 88" fill="none" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><path d="M52 134 Q69 139 84 133 M172 133 Q189 139 204 134" fill="none" stroke="#d98f9e" stroke-width="3" stroke-linecap="round"/>';
  return ({ "eyes-round-glossy":round, "eyes-almond-elegant":almond, "eyes-sharp-action":sharp, "eyes-sleepy-soft":sleepy })[id];
}

function hairArtwork(id, hair, skin, dark, iris) {
  const face = '<path d="M74 83 Q128 46 182 83 L180 155 Q169 202 128 212 Q87 202 76 155Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/><path d="M91 132 Q105 126 116 132 M140 132 Q153 126 166 132" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><circle cx="105" cy="143" r="6" fill="' + iris + '"/><circle cx="152" cy="143" r="6" fill="' + iris + '"/><path d="M129 148 L124 164 L132 164 M114 181 Q128 191 143 180" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/><path d="M83 160 Q96 167 104 159 M153 159 Q162 167 174 160" fill="none" stroke="#e89a9c" stroke-width="5" stroke-linecap="round"/>';
  const shapes = {
    "hair-spiky-short": '<path d="M63 126 L43 89 L73 94 L65 53 L100 77 L111 31 L132 72 L163 43 L159 85 L200 70 L188 108 L207 127 L181 147 L178 102 Q155 122 141 106 L124 126 L104 104 L80 130 L78 184 L56 172Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M75 99 L98 119 L108 87 L126 108 L150 78 L153 111 L178 93" fill="none" stroke="#ffffff" stroke-opacity=".42" stroke-width="5" stroke-linecap="round"/>',
    "hair-straight-bob": '<path d="M60 131 Q43 67 83 40 Q128 8 173 40 Q213 68 196 151 L190 203 L160 220 L92 220 L65 202Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M72 69 Q95 83 123 81 L128 105 L139 82 Q163 86 184 67 L178 113 Q159 128 143 110 L128 127 L110 110 Q90 127 74 111Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4" stroke-linejoin="round"/><path d="M76 139 L82 196 M181 137 L173 197 M100 45 Q124 30 145 42" fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="4" stroke-linecap="round"/>',
    "hair-long-swept": '<path d="M57 137 Q34 86 61 49 Q93 11 145 30 Q207 31 210 91 L201 231 L170 241 L169 155 L150 119 L128 93 L104 117 L87 152 L84 239 L52 229Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M65 84 Q105 34 174 47 Q150 72 124 91 Q101 111 88 146 L73 117 Q91 85 111 72 Q90 70 65 84Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4" stroke-linejoin="round"/><path d="M70 166 Q77 198 68 218 M185 126 Q194 177 187 214 M111 42 Q147 33 174 47" fill="none" stroke="#ffffff" stroke-opacity=".36" stroke-width="4" stroke-linecap="round"/>',
    "hair-twin-tails": '<path d="M65 89 Q25 45 30 119 Q33 171 56 207 L81 194 L70 127Z M191 89 Q231 45 226 119 Q223 171 200 207 L175 194 L186 127Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M65 126 Q46 55 93 34 Q128 13 163 34 Q210 55 191 126 L183 170 L166 135 Q146 123 128 102 Q111 127 90 136 L74 170Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M84 84 Q110 60 126 77 L128 104 L145 78 Q164 64 177 85 L169 111 Q150 118 128 102 Q106 120 87 109Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4" stroke-linejoin="round"/><path d="M47 81 L67 93 L53 108 L34 94Z M190 93 L210 81 L223 94 L203 108Z" fill="#fff0a8" stroke="' + dark + '" stroke-width="4" stroke-linejoin="round"/><path d="M42 126 Q51 159 61 178 M214 126 Q205 159 195 178 M98 45 Q128 31 157 45" fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="4" stroke-linecap="round"/>'
  };
  return shapes[id] + HAIR_FACE_MARKER + face + '<path d="M72 113 Q88 98 105 109 M151 109 Q168 98 183 113" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/>';
}

function faceArtwork(id, skin, dark, iris) {
  const shapes = {
    "face-round-soft": '<path d="M47 118 Q42 64 83 42 Q128 15 173 42 Q214 64 209 118 Q204 192 128 221 Q52 192 47 118Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M47 105 Q31 108 41 136 Q49 147 55 132 M209 105 Q225 108 215 136 Q207 147 201 132" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/><path d="M76 115 Q92 105 108 115 M148 115 Q164 105 180 115" fill="none" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><ellipse cx="96" cy="126" rx="8" ry="10" fill="' + iris + '"/><ellipse cx="160" cy="126" rx="8" ry="10" fill="' + iris + '"/><path d="M128 133 L122 154 L132 155 M106 177 Q128 190 150 177" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/><path d="M63 154 Q78 164 91 154 M165 154 Q178 164 193 154" fill="none" stroke="#e89a9c" stroke-width="6" stroke-linecap="round"/>',
    "face-oval-balanced": '<path d="M62 111 Q59 59 91 39 Q128 17 165 39 Q197 59 194 111 L181 164 Q162 204 128 214 Q94 204 75 164Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M62 105 Q47 108 54 132 Q60 144 68 130 M194 105 Q209 108 202 132 Q196 144 188 130" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/><path d="M83 115 Q98 105 112 115 M144 115 Q158 105 173 115" fill="none" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/><ellipse cx="99" cy="126" rx="7" ry="9" fill="' + iris + '"/><ellipse cx="157" cy="126" rx="7" ry="9" fill="' + iris + '"/><path d="M128 132 L123 153 L132 154 M109 178 Q128 187 147 178" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/>',
    "face-angular-defined": '<path d="M51 96 Q55 48 92 34 Q128 18 164 34 Q201 48 205 96 L190 153 L162 190 L128 220 L94 190 L66 153Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M51 96 L66 153 L94 190 M205 96 L190 153 L162 190" fill="none" stroke="' + dark + '" stroke-width="3" stroke-opacity=".42"/><path d="M76 109 L112 113 M144 113 L180 109" fill="none" stroke="' + dark + '" stroke-width="5" stroke-linecap="round"/><path d="M83 121 L110 120 M146 120 L173 121" fill="none" stroke="' + dark + '" stroke-width="3"/><ellipse cx="98" cy="132" rx="7" ry="8" fill="' + iris + '"/><ellipse cx="158" cy="132" rx="7" ry="8" fill="' + iris + '"/><path d="M128 136 L120 158 L133 159 M111 181 L128 186 L145 181" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/>',
    "face-long-oval": '<path d="M67 109 Q61 58 93 38 Q128 16 163 38 Q195 58 189 109 L177 172 Q158 213 128 229 Q98 213 79 172Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M67 105 Q52 108 58 130 Q63 142 73 129 M189 105 Q204 108 198 130 Q193 142 183 129" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/><path d="M83 113 Q98 107 112 113 M144 113 Q158 107 173 113" fill="none" stroke="' + dark + '" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="98" cy="124" rx="6" ry="8" fill="' + iris + '"/><ellipse cx="158" cy="124" rx="6" ry="8" fill="' + iris + '"/><path d="M128 132 L124 160 L132 161 M113 188 Q128 193 143 188" fill="none" stroke="' + dark + '" stroke-width="3" stroke-linecap="round"/>'
  };
  return shapes[id];
}


function faceBaseArtwork(id, skin, dark) {
  const shapes = {
    "face-round-soft": '<path d="M47 118 Q42 64 83 42 Q128 15 173 42 Q214 64 209 118 Q204 192 128 221 Q52 192 47 118Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M47 105 Q31 108 41 136 Q49 147 55 132 M209 105 Q225 108 215 136 Q207 147 201 132" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/>',
    "face-oval-balanced": '<path d="M62 111 Q59 59 91 39 Q128 17 165 39 Q197 59 194 111 L181 164 Q162 204 128 214 Q94 204 75 164Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M62 105 Q47 108 54 132 Q60 144 68 130 M194 105 Q209 108 202 132 Q196 144 188 130" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/>',
    "face-angular-defined": '<path d="M51 96 Q55 48 92 34 Q128 18 164 34 Q201 48 205 96 L190 153 L162 190 L128 220 L94 190 L66 153Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M51 96 L66 153 L94 190 M205 96 L190 153 L162 190" fill="none" stroke="' + dark + '" stroke-width="3" stroke-opacity=".42"/>',
    "face-long-oval": '<path d="M67 109 Q61 58 93 38 Q128 16 163 38 Q195 58 189 109 L177 172 Q158 213 128 229 Q98 213 79 172Z" fill="' + skin + '" stroke="' + dark + '" stroke-width="5" stroke-linejoin="round"/><path d="M67 105 Q52 108 58 130 Q63 142 73 129 M189 105 Q204 108 198 130 Q193 142 183 129" fill="' + skin + '" stroke="' + dark + '" stroke-width="4"/>'
  };
  return shapes[id];
}

function expressionArtwork(id, dark, accent) {
  const nose = '<path d="M128 143 L123 151 Q128 155 133 151" fill="none" stroke="' + dark + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';
  const cheeks = '<path d="M65 156 Q77 163 91 156 M165 156 Q179 163 191 156" fill="none" stroke="' + accent + '" stroke-opacity=".78" stroke-width="5.5" stroke-linecap="round"/>';
  const shapes = {
    "expression-soft-smile": '<path d="M109 173 Q128 186 147 173" fill="none" stroke="' + dark + '" stroke-width="4" stroke-linecap="round"/>',
    "expression-open-happy": '<path d="M110 168 Q128 158 146 168 Q144 190 128 191 Q112 190 110 168Z" fill="#5b243f" stroke="' + dark + '" stroke-width="3.8" stroke-linejoin="round"/><path d="M116 168 Q128 164 140 168 L137 174 L119 174Z" fill="#fffaf7" stroke="' + dark + '" stroke-width="1.8" stroke-linejoin="round"/>',
    "expression-confident-smirk": '<path d="M105 174 Q122 180 137 173 Q145 168 152 164" fill="none" stroke="' + dark + '" stroke-width="4.2" stroke-linecap="round"/><path d="M143 166 L151 164" fill="none" stroke="' + dark + '" stroke-width="2.5" stroke-linecap="round"/>',
    "expression-surprised": '<ellipse cx="128" cy="176" rx="8.5" ry="12" fill="#5b243f" stroke="' + dark + '" stroke-width="3.5"/><ellipse cx="128" cy="174" rx="3.6" ry="4.2" fill="#fffaf7"/>'
  };
  return nose + cheeks + shapes[id];
}

function hairFrontArtwork(id, hair, dark) {
  const shapes = {
    "hair-spiky-short": '<path d="M69 91 L91 108 L104 81 L125 109 L149 76 L154 107 L184 87 L177 116 Q155 126 128 105 Q104 129 78 116Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4.5" stroke-linejoin="round"/>',
    "hair-straight-bob": '<path d="M72 76 Q98 68 123 76 L128 104 L141 76 Q163 78 183 65 L180 112 Q162 124 144 108 L128 126 L110 109 Q90 124 75 108Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4.5" stroke-linejoin="round"/>',
    "hair-long-swept": '<path d="M62 78 Q98 46 133 68 L126 101 Q110 99 94 118 L78 145 L75 112 Q87 90 111 71 Q83 69 62 87Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4.5" stroke-linejoin="round"/>',
    "hair-twin-tails": '<path d="M83 68 Q106 48 126 69 L128 103 L145 73 Q166 61 178 80 L169 107 Q150 116 128 97 Q106 116 87 105Z" fill="' + hair + '" stroke="' + dark + '" stroke-width="4.5" stroke-linejoin="round"/>'
  };
  return shapes[id] || "";
}

/**
 * Creates a character composition as five aligned, editable SVG image layers.
 * The parts share a viewBox but stay independent in the editor and history.
 */
export function createAnimeCharacterParts({
  eyesId,
  hairId,
  faceId,
  expressionId = "expression-soft-smile",
  hairColor,
  eyeColor,
  skinColor,
  lineColor
} = {}) {
  const eyes = getAnimeStyleComponent(eyesId);
  const hair = getAnimeStyleComponent(hairId);
  const face = getAnimeStyleComponent(faceId);
  const expression = getAnimeStyleComponent(expressionId);
  if (!eyes || eyes.part !== "eyes" || !hair || hair.part !== "hair" || !face || face.part !== "face" ||
      !expression || expression.part !== "expression") {
    throw new TypeError("A character needs valid eyes, hair, face and expression components");
  }

  const safeHair = safeColor(hairColor, hair.defaultColors.primary);
  const safeEyes = safeColor(eyeColor, eyes.defaultColors.eye);
  const safeSkin = safeColor(skinColor, face.defaultColors.skin);
  const safeLine = safeColor(lineColor, "#2b2035");
  const fullHairBody = hairArtwork(hair.id, safeHair, safeSkin, safeLine, safeEyes);
  const hairBackBody = fullHairBody.split(HAIR_FACE_MARKER)[0];

  return Object.freeze({
    hairBack: svgRoot("Cabello base: " + hair.label, hairBackBody),
    face: svgRoot("Rostro: " + face.label, faceBaseArtwork(face.id, safeSkin, safeLine)),
    hairFront: svgRoot("Flequillo: " + hair.label, hairFrontArtwork(hair.id, safeHair, safeLine)),
    eyes: svgRoot("Ojos: " + eyes.label, eyesArtwork(eyes.id, safeLine, safeEyes)),
    expression: svgRoot("Expresión: " + expression.label, expressionArtwork(expression.id, safeLine, safeColor(expression.defaultColors.primary, "#e89a9c"))),
    componentIds: Object.freeze({ eyes: eyes.id, hair: hair.id, face: face.id, expression: expression.id }),
    colors: Object.freeze({ hair: safeHair, eyes: safeEyes, skin: safeSkin, line: safeLine })
  });
}

export function createAnimeStyleComponentSvg(id, options = {}) {
  const component = getAnimeStyleComponent(id);
  if (!component) throw new TypeError("Unknown anime style component: " + String(id));
  const colors = component.defaultColors;
  const primary = safeColor(options.primaryColor, colors.primary);
  const iris = safeColor(options.eyeColor, colors.eye);
  const skin = safeColor(options.skinColor, colors.skin);
  const dark = safeColor(options.lineColor, "#2b2035");
  let body;
  if (component.part === "eyes") body = eyesArtwork(id, dark, iris);
  else if (component.part === "hair") body = hairArtwork(id, primary, skin, dark, iris).replace(HAIR_FACE_MARKER, "");
  else if (component.part === "face") body = faceArtwork(id, skin, dark, iris);
  else body = expressionArtwork(id, dark, safeColor(primary, colors.primary));
  return svgRoot(component.label, body);
}
