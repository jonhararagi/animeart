const step = (id, title, description, why, advancedTip, action, actionLabel, secondaryAction = null) => Object.freeze({ id, title, description, why, advancedTip, action, actionLabel, secondaryAction, requiresImage: true });

export const GUIDED_EDITING_FLOWS = Object.freeze([
  Object.freeze({ id: "portrait-clean", title: "Retrato anime limpio", summary: "Prepara un personaje, limpia el fondo y exporta un PNG con transparencia.", steps: Object.freeze([
    step("prepare", "Prepara el retrato", "Importa un retrato o personaje con Añadir. KapiArt lo incorpora como una capa independiente; encájalo en el lienzo sin estirar sus proporciones.", "Un encuadre claro ayuda a centrar la atención en el personaje y facilita el recorte posterior.", "Mantén la imagen original como capa editable. Si queda demasiado grande, usa Encajar imagen y ajusta su posición.", "import-image", "Importar imagen", Object.freeze({action:"fit-image",label:"Encajar al lienzo"})),
    step("cutout", "Limpia el fondo", "Abre Quitar fondo, detecta o selecciona el color del fondo y revisa la vista previa. Aplica solo cuando los bordes se vean razonables; cancelar conserva el original.", "La transparencia permite reutilizar el retrato en portadas, stickers y composiciones sin un rectángulo detrás.", "Los fondos lisos suelen dar mejores resultados. Revisa pelo, gafas y otros bordes finos con el zoom y los ajustes disponibles.", "remove-background", "Abrir Quitar fondo"),
    step("finish", "Revisa y exporta", "Comprueba el borde del personaje sobre el tablero de transparencia. Puedes ajustar el color y, cuando estés conforme, exportar el retrato como PNG transparente.", "PNG conserva el canal alfa. El fondo cuadriculado es una ayuda visual y no se imprime en el archivo exportado.", "Antes de entregar, comprueba halos y píxeles residuales. La imagen exportada es plana; el proyecto de KapiArt sigue siendo editable localmente.", "export-transparent", "Exportar PNG transparente", Object.freeze({action:"color-adjustments",label:"Ajustar color"}))
  ])}),
  Object.freeze({ id: "sticker-anime", title: "Sticker anime personalizado", summary: "Recorta un personaje o imagen propia para preparar un sticker reutilizable.", steps: Object.freeze([
    step("prepare", "Prepara el personaje", "Importa el personaje o la ilustración que quieres convertir en sticker. Selecciona su capa y encuadra la silueta sin deformarla.", "Un sujeto claro y bien encuadrado necesita menos retoque y funciona mejor en chats, carteles y collages.", "Evita cortar partes importantes del pelo, las manos o los accesorios. Puedes mover y escalar la capa antes de seguir.", "import-image", "Importar imagen", Object.freeze({action:"fit-image",label:"Encajar al lienzo"})),
    step("cutout", "Separa la silueta", "Abre Quitar fondo y revisa el recorte en la vista previa. Aplica cuando el fondo haya desaparecido sin borrar partes necesarias del personaje.", "Un sticker necesita transparencia alrededor de la figura para integrarse sobre fondos de distintos colores.", "Si necesitas cambiar el encuadre, usa Refinar recorte. KapiArt no añadirá automáticamente un borde exterior si esa opción no existe en la herramienta actual.", "remove-background", "Abrir Quitar fondo", Object.freeze({action:"crop-image",label:"Refinar recorte"})),
    step("finish", "Comprueba y exporta", "Revisa que no quede un fondo sólido ni un borde accidental. Exporta el resultado en PNG transparente y conserva el proyecto para seguir ajustando sus capas.", "La transparencia permite colocar el sticker encima de cualquier imagen sin un bloque opaco.", "Verifica el archivo PNG final además de la vista previa. Un contorno decorativo es opcional y no debe confundirse con quitar el fondo.", "export-transparent", "Exportar sticker PNG")
  ])}),
  Object.freeze({ id: "anime-cover", title: "Portada anime o kawaii", summary: "Combina un personaje con elementos, stickers y títulos editables para crear una portada.", steps: Object.freeze([
    step("prepare", "Prepara la imagen principal", "Importa un personaje o una ilustración que sirva como foco de la portada. Colócala en el lienzo y deja espacio para el título.", "Una imagen principal bien colocada crea una jerarquía visual clara y deja respirar al texto.", "Piensa primero dónde irá el título y evita que los detalles importantes queden demasiado cerca del borde del documento.", "import-image", "Importar imagen", Object.freeze({action:"fit-image",label:"Encajar al lienzo"})),
    step("compose", "Compón el diseño", "Abre el Estudio creativo para añadir una portada, stickers o recursos gráficos originales. Cada elemento añadido se mantiene como una capa que puedes mover y ordenar.", "Las capas independientes permiten ajustar el equilibrio entre personaje, decoración y texto sin rehacer toda la imagen.", "Mantén un elemento dominante y usa los detalles decorativos para acompañarlo. Si aún falta un título, puedes añadirlo desde Texto.", "creative-studio", "Abrir Estudio creativo", Object.freeze({action:"add-text",label:"Añadir título"})),
    step("finish", "Revisa y exporta", "Comprueba el recorte, el contraste y la legibilidad del título. Exporta una imagen PNG cuando la composición esté lista; la exportación no sustituye al proyecto editable.", "Un último vistazo a la jerarquía y a los bordes evita títulos ilegibles o elementos cortados.", "Revisa el diseño al tamaño al que se verá publicado. El PNG es plano, pero las capas siguen disponibles en el proyecto guardado localmente.", "export-png", "Exportar portada PNG")
  ])})
]);

export function getGuidedFlow(flowId) { return GUIDED_EDITING_FLOWS.find(flow => flow.id === flowId) || null; }
export function getGuidedStep(flowId, stepIndex) {
  const flow=getGuidedFlow(flowId);
  if(!flow||!Number.isInteger(stepIndex)||stepIndex<0||stepIndex>=flow.steps.length)return null;
  return flow.steps[stepIndex];
}
export function createGuidedProgress(flowId) {
  if(!getGuidedFlow(flowId))throw new TypeError("Unknown guided-editing flow: "+String(flowId));
  return {flowId,stepIndex:0,completedStepIds:[],launchedStepIds:[]};
}
function validateProgress(progress,flowId) {
  const flow=getGuidedFlow(flowId);
  if(!flow)throw new TypeError("Unknown guided-editing flow: "+String(flowId));
  if(!progress||progress.flowId!==flowId||!Number.isInteger(progress.stepIndex)||progress.stepIndex<0||progress.stepIndex>=flow.steps.length||!Array.isArray(progress.completedStepIds)||!Array.isArray(progress.launchedStepIds))throw new TypeError("Invalid guided-editing progress");
  return flow;
}
export function recordGuidedActionLaunched(progress,flowId) {
  const flow=validateProgress(progress,flowId),current=flow.steps[progress.stepIndex];
  return {...progress,launchedStepIds:[...new Set([...progress.launchedStepIds.filter(id=>flow.steps.some(item=>item.id===id)),current.id])]};
}
export function hasGuidedImage(document) { return Array.isArray(document?.layers)&&document.layers.some(layer=>layer?.contentType==="image"); }
export function isGuidedFlowComplete(progress,flowId) {
  const flow=validateProgress(progress,flowId);
  return flow.steps.every(item=>progress.completedStepIds.includes(item.id));
}
export function canCompleteGuidedStep(progress,flowId,document) {
  const flow=validateProgress(progress,flowId),current=flow.steps[progress.stepIndex];
  if(progress.completedStepIds.includes(current.id))return true;
  if(current.requiresImage&&!hasGuidedImage(document))return false;
  return progress.launchedStepIds.includes(current.id);
}
export function completeGuidedStep(progress,flowId,document) {
  const flow=validateProgress(progress,flowId),current=flow.steps[progress.stepIndex],completedStepIds=[...progress.completedStepIds];
  if(!completedStepIds.includes(current.id)){
    if(!progress.launchedStepIds.includes(current.id))throw new Error("Abre primero la herramienta indicada y revisa el resultado antes de confirmar este paso.");
    if(current.requiresImage&&!hasGuidedImage(document))throw new Error("Importa primero una imagen y vuelve a la guía para continuar.");
    completedStepIds.push(current.id);
  }
  const completed=flow.steps.every(item=>completedStepIds.includes(item.id));
  const stepIndex=completed?flow.steps.length-1:Math.min(progress.stepIndex+1,flow.steps.length-1);
  return {progress:{...progress,stepIndex,completedStepIds},completed};
}
export function goToPreviousGuidedStep(progress,flowId) {
  validateProgress(progress,flowId);
  return {...progress,stepIndex:Math.max(0,progress.stepIndex-1)};
}
