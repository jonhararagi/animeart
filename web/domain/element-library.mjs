const ELEMENT_ART = Object.freeze({
  "bubble-thought": '<g fill="#fff" stroke="#33264e" stroke-width="8" stroke-linejoin="round"><circle cx="75" cy="58" r="16"/><circle cx="46" cy="91" r="10"/><path d="M56 123Q40 95 61 72Q83 50 111 67Q142 47 169 69Q200 63 216 90Q239 119 215 145Q207 171 174 173H82Q51 166 56 123Z"/><circle cx="64" cy="197" r="10"/><circle cx="91" cy="218" r="6"/></g><path d="M89 108h78M89 133h56" stroke="#ff65aa" stroke-width="8" stroke-linecap="round"/>',
  "bubble-shout": '<path d="M128 8L151 38 183 18 190 55 231 50 219 85 252 104 223 128 246 161 208 171 216 209 177 203 163 245 132 220 103 250 88 213 49 228 51 189 12 183 31 150 4 127 36 103 18 68 57 65 61 28 96 44Z" fill="#ffe95f" stroke="#24172d" stroke-width="10" stroke-linejoin="round"/><path d="M61 89h135M53 126h151M72 163h105" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M128 16v27M20 128h22M211 128h25" stroke="#ff4a9a" stroke-width="7" stroke-linecap="round"/>',
  "bubble-rounded": '<path d="M43 39Q43 22 62 22H194Q215 22 215 43V151Q215 172 194 172H112L70 220V172H62Q43 172 43 151Z" fill="#fffaff" stroke="#35264c" stroke-width="9" stroke-linejoin="round"/><path d="M70 73h118M70 105h93M70 137h76" stroke="#c38bea" stroke-width="9" stroke-linecap="round"/><path d="M181 36l6 13 13 6-13 6-6 13-6-13-13-6 13-6z" fill="#ff75b9"/>',
  "manga-caption": '<path d="M23 35L233 19 230 211 26 230Z" fill="#fff" stroke="#171324" stroke-width="10" stroke-linejoin="round"/><path d="M23 35L233 19 229 66 24 82Z" fill="#ffe75e" stroke="#171324" stroke-width="7" stroke-linejoin="round"/><path d="M54 116L200 104M55 153L189 143M57 190L160 181" stroke="#aaa0b6" stroke-width="8" stroke-linecap="round"/><path d="M196 24l8 18 18 8-18 8-8 18-8-18-18-8 18-8z" fill="#ff4e9e"/>',
  "frame-neon": '<rect x="24" y="24" width="208" height="208" rx="18" fill="none" stroke="#00eaff" stroke-width="7"/><rect x="38" y="38" width="180" height="180" rx="10" fill="none" stroke="#ff4fd8" stroke-width="3" stroke-dasharray="14 9"/><path d="M24 78V24H78M178 24h54v54M24 178v54h54M178 232h54v-54" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="square"/><circle cx="42" cy="42" r="5" fill="#ffe95f"/><circle cx="214" cy="42" r="5" fill="#ffe95f"/>',
  "frame-manga": '<path d="M32 17H224L239 224H17Z" fill="none" stroke="#171324" stroke-width="12" stroke-linejoin="round"/><path d="M48 34H208L221 207H35Z" fill="none" stroke="#ed3156" stroke-width="4" stroke-linejoin="round"/><path d="M32 17h55M169 17h55M17 80v-63M239 80V17M17 224h55M184 224h55M17 164v60M239 164v60" stroke="#171324" stroke-width="9" stroke-linecap="square"/>',
  "halftone-rose": '<g fill="#ff65ad" opacity=".92"><circle cx="50" cy="50" r="7"/><circle cx="83" cy="50" r="7"/><circle cx="116" cy="50" r="7"/><circle cx="149" cy="50" r="7"/><circle cx="182" cy="50" r="7"/><circle cx="215" cy="50" r="7"/><circle cx="50" cy="83" r="7"/><circle cx="83" cy="83" r="7"/><circle cx="116" cy="83" r="7"/><circle cx="149" cy="83" r="7"/><circle cx="182" cy="83" r="7"/><circle cx="215" cy="83" r="7"/><circle cx="50" cy="116" r="7"/><circle cx="83" cy="116" r="7"/><circle cx="116" cy="116" r="7"/><circle cx="149" cy="116" r="7"/><circle cx="182" cy="116" r="7"/><circle cx="215" cy="116" r="7"/><circle cx="50" cy="149" r="7"/><circle cx="83" cy="149" r="7"/><circle cx="116" cy="149" r="7"/><circle cx="149" cy="149" r="7"/><circle cx="182" cy="149" r="7"/><circle cx="215" cy="149" r="7"/><circle cx="50" cy="182" r="7"/><circle cx="83" cy="182" r="7"/><circle cx="116" cy="182" r="7"/><circle cx="149" cy="182" r="7"/><circle cx="182" cy="182" r="7"/><circle cx="215" cy="182" r="7"/></g><circle cx="128" cy="128" r="105" fill="none" stroke="#fff" stroke-width="7" opacity=".72"/>',
  "sakura-petals": '<g fill="#ff8bc4" stroke="#8d3d91" stroke-width="5"><ellipse cx="128" cy="56" rx="25" ry="42"/><ellipse cx="173" cy="92" rx="25" ry="42" transform="rotate(72 173 92)"/><ellipse cx="155" cy="146" rx="25" ry="42" transform="rotate(144 155 146)"/><ellipse cx="97" cy="146" rx="25" ry="42" transform="rotate(216 97 146)"/><ellipse cx="82" cy="92" rx="25" ry="42" transform="rotate(288 82 92)"/></g><circle cx="128" cy="111" r="15" fill="#ffe95f" stroke="#fff" stroke-width="5"/><path d="M31 42l6 13 13 6-13 6-6 13-6-13-13-6 13-6zM221 184l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#fff" stroke="#e65a9f" stroke-width="3"/>',
  "sparkle-burst": '<g fill="#fff8ca" stroke="#8d69d6" stroke-width="5" stroke-linejoin="round"><path d="M128 8L148 92 232 113 148 135 128 222 107 135 24 113 107 92Z"/><path d="M201 157l10 25 25 10-25 10-10 25-10-25-25-10 25-10z" fill="#ff70bd"/><path d="M53 27l8 19 19 8-19 8-8 19-8-19-19-8 19-8z" fill="#8cecff"/></g>',
  "washi-tape": '<g stroke-linejoin="round"><path d="M18 51L234 30 246 70 30 92Z" fill="#ff93c9" opacity=".9"/><path d="M28 59L230 39M34 72L236 52" stroke="#fff" stroke-width="4" stroke-dasharray="8 8"/><path d="M27 164L224 181 220 221 23 204Z" fill="#8cecff" opacity=".92"/><path d="M32 178L218 194M30 191L217 207" stroke="#fff" stroke-width="4" stroke-dasharray="10 8"/></g>',
  "neon-arrow": '<path d="M34 198Q43 101 127 101Q168 101 185 68" fill="none" stroke="#ff4fd8" stroke-width="22" stroke-linecap="round"/><path d="M143 41L191 49 199 97" fill="none" stroke="#00eaff" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 198Q45 101 127 101Q168 101 185 68" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 10"/>',
  "speedlines-cyan": '<g stroke="#00eaff" stroke-width="8" stroke-linecap="round"><path d="M12 35L143 75M5 75L113 104M9 120L87 135M18 165L117 157M29 210L165 184M112 17L177 59M147 223L244 195M177 133L245 139M183 87L249 67"/></g><g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"><path d="M12 47L143 87M7 88L112 114M24 178L118 169M123 27L175 62"/></g>',
  "anime-sweat-drop": '<path d="M131 19Q94 77 72 118Q49 163 81 194Q110 225 151 204Q190 181 172 139Q157 95 131 19Z" fill="#78ddff" stroke="#345b98" stroke-width="9" stroke-linejoin="round"/><path d="M113 73Q93 106 89 131" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/><circle cx="147" cy="167" r="8" fill="#fff" opacity=".8"/>',
  "kawaii-blush": '<g fill="#ff78ad" opacity=".86"><ellipse cx="73" cy="130" rx="42" ry="20" transform="rotate(-12 73 130)"/><ellipse cx="183" cy="130" rx="42" ry="20" transform="rotate(12 183 130)"/></g><g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M49 128l9-2M69 123l9-2M88 120l9-2M158 120l9 2M178 123l9 2M198 128l9 2"/></g>',
  "comic-star": '<path d="M128 13L157 87 237 91 176 143 195 222 128 180 61 222 80 143 19 91 99 87Z" fill="#ffe95f" stroke="#21162f" stroke-width="12" stroke-linejoin="round"/><path d="M128 13L157 87 237 91 176 143 195 222 128 180 61 222 80 143 19 91 99 87Z" fill="none" stroke="#ff4fd8" stroke-width="4" stroke-linejoin="round"/><circle cx="168" cy="107" r="7" fill="#fff"/>',
  "cloud-kawaii": '<path d="M53 177Q25 176 25 147Q25 119 54 113Q57 76 94 76Q117 42 151 66Q177 70 183 100Q223 95 229 133Q238 172 199 179Z" fill="#e8fbff" stroke="#6a64aa" stroke-width="9" stroke-linejoin="round"/><path d="M90 139q11-13 22 0M146 139q11-13 22 0" fill="none" stroke="#3d335d" stroke-width="7" stroke-linecap="round"/><path d="M116 156q12 10 24 0" fill="none" stroke="#ff72a8" stroke-width="6" stroke-linecap="round"/><circle cx="77" cy="157" r="8" fill="#ff9fca"/><circle cx="181" cy="157" r="8" fill="#ff9fca"/>'
});

const ELEMENT_CATALOG = Object.freeze([
  {id:"bubble-thought",label:"Globo de pensamiento",category:"Globos y diálogo",description:"Burbuja de pensamiento para monólogos y escenas cómicas.",keywords:"dialogo pensamiento manga nube comic personaje"},
  {id:"bubble-shout",label:"Globo de grito",category:"Globos y diálogo",description:"Globo explosivo para gritos y reacciones.",keywords:"grito shout boom manga dialogo explosion"},
  {id:"bubble-rounded",label:"Globo suave",category:"Globos y diálogo",description:"Globo redondeado para conversaciones y notas breves.",keywords:"hablar dialogo texto comic manga suave"},
  {id:"manga-caption",label:"Cartela de narración",category:"Manga",description:"Cartela para narrador, lugar o cambio de escena.",keywords:"narrador caja texto manga comic viñeta caption"},
  {id:"frame-neon",label:"Marco neón",category:"Marcos",description:"Marco rectangular luminoso con esquinas técnicas.",keywords:"borde marco cyberpunk neón tarjeta interfaz"},
  {id:"frame-manga",label:"Marco de viñeta",category:"Marcos",description:"Borde de viñeta con esquinas inclinadas para páginas manga.",keywords:"panel viñeta manga comic borde marco"},
  {id:"halftone-rose",label:"Trama de puntos rosa",category:"Texturas",description:"Trama de semitono para fondos pop y manga.",keywords:"halftone dots rosa puntos textura pop manga"},
  {id:"sakura-petals",label:"Ráfaga de pétalos",category:"Flores y naturaleza",description:"Pétalos flotantes para diseños shojo y fondos kawaii.",keywords:"sakura flor pétalos primavera romance shojo"},
  {id:"sparkle-burst",label:"Constelación de destellos",category:"Brillos",description:"Grupo de destellos para enfatizar detalles.",keywords:"estrellas brillo sparkle magia luz decoración"},
  {id:"washi-tape",label:"Cinta decorativa",category:"Decoración",description:"Cinta ilustrada para fotos, notas y collages.",keywords:"cinta tape papel scrapbook collage decorar"},
  {id:"neon-arrow",label:"Flecha luminosa",category:"Formas y flechas",description:"Flecha curva para dirigir la mirada hacia un detalle.",keywords:"flecha arrow apuntar dirección tutorial llamada"},
  {id:"speedlines-cyan",label:"Líneas cinéticas cian",category:"Manga",description:"Líneas de movimiento en cian para escenas de velocidad.",keywords:"speedlines cinetico velocidad manga movimiento"},
  {id:"anime-sweat-drop",label:"Gota de anime",category:"Kawaii y reacciones",description:"Gota azul para sorpresa o incomodidad cómica.",keywords:"gota sudor reaccion anime kawaii sorpresa"},
  {id:"kawaii-blush",label:"Rubor kawaii",category:"Kawaii y reacciones",description:"Rubor rosa en trazos para retratos y personajes.",keywords:"rubor mejillas blush kawaii rostro anime"},
  {id:"comic-star",label:"Estrella de cómic",category:"Formas y flechas",description:"Estrella de doble contorno para destacar algo.",keywords:"estrella star comic destacar sticker forma"},
  {id:"cloud-kawaii",label:"Nube kawaii",category:"Kawaii y reacciones",description:"Nube redondeada para decorar esquinas o textos.",keywords:"nube cloud kawaii suave fondo decoración"}
]);

function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function getDesignElement(id) {
  return ELEMENT_CATALOG.find(element => element.id === String(id)) || null;
}

export function searchDesignElements(query = "", category = "all") {
  const term = normalizeSearch(query);
  const categoryKey = String(category || "all");
  return ELEMENT_CATALOG.filter(element => {
    if (categoryKey !== "all" && element.category !== categoryKey) return false;
    if (!term) return true;
    const haystack = normalizeSearch([element.label,element.category,element.description,element.keywords].join(" "));
    return haystack.includes(term);
  });
}

export function createDesignElementSvg(id) {
  if (!Object.hasOwn(ELEMENT_ART, String(id)) || !getDesignElement(id)) {
    throw new RangeError("Unknown local design element");
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' + ELEMENT_ART[id] + "</svg>";
}

export { ELEMENT_CATALOG };
