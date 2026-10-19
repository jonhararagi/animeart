const step = (id, title, description, why, advancedTip, action, actionLabel, secondaryAction = null, requiresImage = true) =>
  Object.freeze({ id, title, description, why, advancedTip, action, actionLabel, secondaryAction, requiresImage });

export const GUIDED_EDITING_FLOWS = Object.freeze([
  Object.freeze({ id: "portrait-clean", title: "Retrato anime limpio", summary: "Prepara un personaje, limpia el fondo y exporta un PNG con transparencia.", steps: Object.freeze([
    step("prepare", "Prepara el retrato", "Importa un retrato o personaje con Añadir. KapiArt lo incorpora como una capa independiente; encájalo en el lienzo sin estirar sus proporciones.", "Un encuadre claro ayuda a centrar la atención en el personaje y facilita el recorte posterior.", "Mantén la imagen original como capa editable. Si queda demasiado grande, usa Encajar imagen y ajusta su posición.", "import-image", "Importar imagen", Object.freeze({ action: "fit-image", label: "Encajar al lienzo" })),
    step("cutout", "Limpia el fondo", "Abre Quitar fondo, detecta o selecciona el color del fondo y revisa la vista previa. Aplica solo cuando los bordes se vean razonables; cancelar conserva el original.", "La transparencia permite reutilizar el retrato en portadas, stickers y composiciones sin un rectángulo detrás.", "Los fondos lisos suelen dar mejores resultados. Revisa pelo, gafas y otros bordes finos con el zoom y los ajustes disponibles.", "remove-background", "Abrir Quitar fondo"),
    step("finish", "Revisa y exporta", "Comprueba el borde del personaje sobre el tablero de transparencia. Ajusta el color si hace falta y exporta el retrato como PNG transparente cuando estés conforme.", "PNG conserva el canal alfa. El fondo cuadriculado es una ayuda visual y no se imprime en el archivo exportado.", "Antes de entregar, comprueba halos y píxeles residuales. El PNG es plano; el proyecto guardado localmente sigue siendo editable.", "export-transparent", "Exportar PNG transparente", Object.freeze({ action: "color-adjustments", label: "Ajustar color" }))
  ])}),
  Object.freeze({ id: "sticker-anime", title: "Sticker anime personalizado", summary: "Recorta un personaje o imagen propia para preparar un sticker reutilizable.", steps: Object.freeze([
    step("prepare", "Prepara el personaje", "Importa el personaje o la ilustración que quieres convertir en sticker. Selecciona su capa y encuadra la silueta sin deformarla.", "Un sujeto claro y bien encuadrado necesita menos retoque y funciona mejor en chats, carteles y collages.", "Evita cortar partes importantes del pelo, las manos o los accesorios. Puedes mover y escalar la capa antes de seguir.", "import-image", "Importar imagen", Object.freeze({ action: "fit-image", label: "Encajar al lienzo" })),
    step("cutout", "Separa la silueta", "Abre Quitar fondo y revisa el recorte en la vista previa. Aplica cuando el fondo haya desaparecido sin borrar partes necesarias del personaje.", "Un sticker necesita transparencia alrededor de la figura para integrarse sobre fondos de distintos colores.", "Si necesitas cambiar el encuadre, usa Refinar recorte. El borde exterior es opcional y no se simula si no existe una herramienta real para ello.", "remove-background", "Abrir Quitar fondo", Object.freeze({ action: "crop-image", label: "Refinar recorte" })),
    step("finish", "Comprueba y exporta", "Revisa que no quede un fondo sólido ni un borde accidental. Exporta el resultado en PNG transparente y conserva el proyecto para seguir ajustando sus capas.", "La transparencia permite colocar el sticker encima de cualquier imagen sin un bloque opaco.", "Verifica el archivo PNG final además de la vista previa. Un contorno decorativo no es lo mismo que quitar el fondo.", "export-transparent", "Exportar sticker PNG")
  ])}),
  Object.freeze({ id: "anime-cover", title: "Portada anime o kawaii", summary: "Combina un personaje con elementos, stickers y títulos editables para crear una portada.", steps: Object.freeze([
    step("prepare", "Prepara la imagen principal", "Importa un personaje o una ilustración que sirva como foco de la portada. Colócala en el lienzo y deja espacio para el título.", "Una imagen principal bien colocada crea una jerarquía visual clara y deja respirar al texto.", "Piensa primero dónde irá el título y evita que los detalles importantes queden demasiado cerca del borde del documento.", "import-image", "Importar imagen", Object.freeze({ action: "fit-image", label: "Encajar al lienzo" })),
    step("compose", "Compón el diseño", "Abre el Estudio creativo para añadir una portada, stickers o recursos gráficos originales. Cada elemento añadido se mantiene como una capa que puedes mover y ordenar.", "Las capas independientes permiten ajustar el equilibrio entre personaje, decoración y texto sin rehacer toda la imagen.", "Mantén un elemento dominante y usa los detalles decorativos para acompañarlo. Si falta un título, puedes añadirlo desde Texto.", "creative-studio", "Abrir Estudio creativo", Object.freeze({ action: "add-text", label: "Añadir título" })),
    step("finish", "Revisa y exporta", "Comprueba el recorte, el contraste y la legibilidad del título. Exporta PNG cuando la composición esté lista; la exportación no sustituye al proyecto editable.", "Un último vistazo a la jerarquía y a los bordes evita títulos ilegibles o elementos cortados.", "Revisa el diseño al tamaño al que se verá publicado. Las capas siguen disponibles en el proyecto guardado.", "export-png", "Exportar portada PNG")
  ])}),
  Object.freeze({ id: "cyberpunk-neon", title: "Anime cyberpunk neón", summary: "Construye una base de color futurista, añade recursos luminosos y exporta tu composición.", steps: Object.freeze([
    step("prepare", "Prepara el sujeto", "Importa un personaje o escena y encuádralo. Mantén el sujeto en una capa independiente para que puedas moverlo después.", "Una silueta clara ayuda a que los tonos intensos sigan leyendo bien.", "Encaja primero la imagen y reserva espacio para un título o un recurso luminoso.", "import-image", "Importar imagen", Object.freeze({ action: "fit-image", label: "Encajar al lienzo" })),
    step("color", "Aplica una base neón", "Aplica la receta editable Ice Blue para probar una base fría. Después puedes abrir el Estudio creativo para sumar recursos cyberpunk.", "El tono frío crea una base de color, pero no genera por sí solo un halo luminoso.", "La receta modifica los ajustes de la capa y admite Deshacer. Compara el resultado con el original antes de seguir.", "quick-recipe-ice-blue", "Aplicar Ice Blue", Object.freeze({ action: "creative-studio", label: "Añadir recursos cyberpunk" })),
    step("finish", "Añade detalles y exporta", "Si quieres, incorpora una plantilla o sticker luminoso desde el Estudio creativo. Revisa el contraste y exporta la composición como PNG.", "Los acentos brillantes funcionan mejor cuando compiten con pocos elementos principales.", "Comprueba que el texto destaque sobre el fondo y que no se pierdan detalles en las sombras.", "export-png", "Exportar PNG", Object.freeze({ action: "creative-studio", label: "Añadir detalles neón" }))
  ])}),
  Object.freeze({ id: "manga-vignette", title: "Viñeta manga", summary: "Encuadra una escena, aplica un acabado monocromático editable y añade texto si lo necesitas.", steps: Object.freeze([
    step("prepare", "Encuadra la viñeta", "Importa la escena y abre el recorte de imagen para ajustar el encuadre sin recortar el documento entero.", "Un recorte claro dirige la mirada hacia la acción principal.", "Deja espacio para bocadillos y evita cortar caras, manos o líneas de movimiento importantes.", "crop-image", "Recortar imagen", Object.freeze({ action: "fit-image", label: "Encajar primero" })),
    step("style", "Aplica estilo manga", "Prueba la receta Manga Ink en la capa seleccionada. Los ajustes se mantienen editables y puedes deshacerlos si el contraste queda demasiado fuerte.", "El contraste alto y la saturación cero crean una base monocromática útil para una viñeta.", "Revisa las sombras antes de añadir texto. Si se pierden detalles, usa Ajustes de imagen para retocar brillo y contraste.", "quick-recipe-manga-ink", "Aplicar Manga Ink", Object.freeze({ action: "color-adjustments", label: "Ajustar contraste" })),
    step("finish", "Añade texto y exporta", "Añade un título o bocadillo si corresponde, revisa la lectura de la escena y exporta la viñeta como PNG.", "El texto debe leerse sin tapar la acción ni confundirse con las líneas del dibujo.", "Prueba la composición al tamaño en el que se leerá. Conserva el proyecto para cambiar textos y capas después.", "export-png", "Exportar viñeta PNG", Object.freeze({ action: "add-text", label: "Añadir texto" }))
  ])}),
  Object.freeze({ id: "colored-illustration", title: "Ilustración coloreada", summary: "Conserva la referencia, añade una capa de dibujo independiente y colorea con el pincel.", steps: Object.freeze([
    step("prepare", "Prepara la ilustración", "Importa el boceto o el lineart que vas a colorear. Conserva esa referencia como una capa aparte.", "Separar el dibujo original de la pintura permite corregir los colores sin destruir las líneas.", "Si la imagen quedó fuera del lienzo, usa Encajar imagen antes de crear la capa de color.", "import-image", "Importar lineart", Object.freeze({ action: "fit-image", label: "Encajar al lienzo" })),
    step("color", "Crea una capa y colorea", "Crea una capa nueva y activa Dibujar en capa. Elige el color y el tamaño del pincel en los controles del editor; pinta en la capa recién creada.", "La capa independiente permite borrar o reajustar tus trazos sin alterar el lineart importado.", "Amplía el lienzo para trabajar los bordes y cambia entre pincel y borrador con cuidado. Deshacer revierte los trazos recientes.", "add-drawing-layer", "Crear capa de color", Object.freeze({ action: "draw-tool", label: "Activar pincel" })),
    step("finish", "Revisa y guarda", "Comprueba los bordes, el orden de las capas y los colores. Guarda el proyecto editable y exporta una copia PNG cuando quieras compartirlo.", "El proyecto conserva las capas; el PNG es una imagen compuesta para publicar o compartir.", "Antes de exportar, oculta temporalmente las capas de referencia si no deben aparecer en la imagen final.", "export-png", "Exportar ilustración PNG", Object.freeze({ action: "color-adjustments", label: "Ajustar color" }))
  ])}),
  Object.freeze({ id: "anime-wallpaper", title: "Fondo de pantalla anime", summary: "Crea un documento de tamaño personalizado, compón sus elementos y exporta la imagen.", steps: Object.freeze([
    step("prepare", "Elige el tamaño del lienzo", "Abre Nuevo y define la anchura y altura para tu pantalla. Crea el documento solo cuando estés listo; si el proyecto tiene cambios, KapiArt pedirá confirmación.", "Un documento con proporciones adecuadas evita recortes al usar la imagen como fondo.", "Puedes consultar la resolución de tu teléfono en Ajustes del sistema. El tamaño del lienzo no obliga a deformar los recursos que añadas.", "create-canvas", "Configurar lienzo", null, false),
    step("compose", "Compón el fondo", "Abre el Estudio creativo y añade una plantilla, personaje, sticker o elemento decorativo. Ajusta la posición de cada capa en el editor.", "Un fondo funciona mejor con una zona de lectura despejada para los iconos de la pantalla.", "Mantén el punto focal fuera de la zona cubierta por reloj e iconos y revisa el diseño en vertical.", "creative-studio", "Añadir recursos", Object.freeze({ action: "add-text", label: "Añadir título" }), false),
    step("finish", "Revisa y exporta", "Comprueba los bordes y la composición. Exporta una imagen PNG cuando estés conforme; conserva también el proyecto para poder editar las capas.", "La exportación crea una imagen final, mientras que el proyecto local permite reubicar cada elemento.", "Si la imagen es muy grande, elige una escala de exportación adecuada desde los controles existentes.", "export-document", "Exportar fondo PNG", Object.freeze({ action: "add-text", label: "Añadir texto" }), false)
  ])}),
  Object.freeze({ id: "photo-improve", title: "Mejorar foto o ilustración", summary: "Compara una receta reversible, afina los ajustes y exporta una copia para fotografía.", steps: Object.freeze([
    step("prepare", "Importa la imagen", "Importa la fotografía o ilustración y encuadra el contenido antes de aplicar cambios.", "Un encuadre limpio ayuda a comparar el resultado con el original.", "Conserva la capa original y comprueba que esté seleccionada antes de aplicar una receta.", "import-image", "Importar imagen", Object.freeze({ action: "fit-image", label: "Encajar imagen" })),
    step("adjust", "Prueba y afina el color", "Aplica la receta Soft Dream como punto de partida o abre Ajustes de imagen para controlar brillo, contraste, saturación, tono y desenfoque.", "Las recetas aceleran las tareas frecuentes, pero los parámetros se pueden ajustar a la imagen concreta.", "Si una receta se aleja del resultado buscado, usa Deshacer y prueba ajustes más sutiles.", "quick-recipe-soft-dream", "Probar Soft Dream", Object.freeze({ action: "color-adjustments", label: "Ajustes manuales" })),
    step("finish", "Revisa y exporta", "Compara el resultado con el original y exporta una copia JPEG cuando la foto no necesite transparencia.", "JPEG suele ser adecuado para fotografías; PNG conserva transparencia si la necesitas.", "La acción de exportación cambia el formato elegido a JPEG. El proyecto original sigue guardado localmente para volver a editar.", "export-jpeg", "Exportar foto en JPEG", Object.freeze({ action: "color-adjustments", label: "Volver a ajustes" }))
  ])})
]);

export function getGuidedFlow(flowId) { return GUIDED_EDITING_FLOWS.find(flow => flow.id === flowId) || null; }
export function getGuidedStep(flowId, stepIndex) {
  const flow = getGuidedFlow(flowId);
  if (!flow || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= flow.steps.length) return null;
  return flow.steps[stepIndex];
}
export function createGuidedProgress(flowId) {
  if (!getGuidedFlow(flowId)) throw new TypeError("Unknown guided-editing flow: " + String(flowId));
  return { flowId, stepIndex: 0, completedStepIds: [], launchedStepIds: [] };
}
function validateProgress(progress, flowId) {
  const flow = getGuidedFlow(flowId);
  if (!flow) throw new TypeError("Unknown guided-editing flow: " + String(flowId));
  if (!progress || progress.flowId !== flowId || !Number.isInteger(progress.stepIndex) || progress.stepIndex < 0 || progress.stepIndex >= flow.steps.length || !Array.isArray(progress.completedStepIds) || !Array.isArray(progress.launchedStepIds)) throw new TypeError("Invalid guided-editing progress");
  return flow;
}
export function recordGuidedActionLaunched(progress, flowId) {
  const flow = validateProgress(progress, flowId), current = flow.steps[progress.stepIndex];
  return { ...progress, launchedStepIds: [...new Set([...progress.launchedStepIds.filter(id => flow.steps.some(item => item.id === id)), current.id])] };
}
export function hasGuidedImage(document) {
  return Array.isArray(document?.layers) && document.layers.some(layer => layer?.contentType === "image");
}
export function isGuidedFlowComplete(progress, flowId) {
  const flow = validateProgress(progress, flowId);
  return flow.steps.every(item => progress.completedStepIds.includes(item.id));
}
export function canCompleteGuidedStep(progress, flowId, document) {
  const flow = validateProgress(progress, flowId), current = flow.steps[progress.stepIndex];
  if (progress.completedStepIds.includes(current.id)) return true;
  if (current.requiresImage && !hasGuidedImage(document)) return false;
  return progress.launchedStepIds.includes(current.id);
}
export function completeGuidedStep(progress, flowId, document) {
  const flow = validateProgress(progress, flowId), current = flow.steps[progress.stepIndex], completedStepIds = [...progress.completedStepIds];
  if (!completedStepIds.includes(current.id)) {
    if (!progress.launchedStepIds.includes(current.id)) throw new Error("Abre primero la herramienta indicada y revisa el resultado antes de confirmar este paso.");
    if (current.requiresImage && !hasGuidedImage(document)) throw new Error("Importa primero una imagen y vuelve a la guía para continuar.");
    completedStepIds.push(current.id);
  }
  const completed = flow.steps.every(item => completedStepIds.includes(item.id));
  const stepIndex = completed ? flow.steps.length - 1 : Math.min(progress.stepIndex + 1, flow.steps.length - 1);
  return { progress: { ...progress, stepIndex, completedStepIds }, completed };
}
export function persistGuidedEditingProgress(storage, key, snapshot) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try { storage.setItem(key, JSON.stringify(snapshot)); return true; }
  catch { return false; }
}
export function goToPreviousGuidedStep(progress, flowId) {
  validateProgress(progress, flowId);
  return { ...progress, stepIndex: Math.max(0, progress.stepIndex - 1) };
}
