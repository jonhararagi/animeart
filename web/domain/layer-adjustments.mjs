export const DEFAULT_LAYER_ADJUSTMENTS = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  temperature: 0,
  tint: 0,
  blur: 0
});

const RULES = Object.freeze({
  brightness: { min: 0, max: 200, fallback: 100, precision: 1 },
  contrast: { min: 0, max: 200, fallback: 100, precision: 1 },
  saturation: { min: 0, max: 200, fallback: 100, precision: 1 },
  hue: { min: -180, max: 180, fallback: 0, precision: 1 },
  temperature: { min: -100, max: 100, fallback: 0, precision: 1 },
  tint: { min: -100, max: 100, fallback: 0, precision: 1 },
  blur: { min: 0, max: 20, fallback: 0, precision: 10 }
});
const KEYS = Object.freeze(Object.keys(RULES));

export function normalizeLayerAdjustments(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {};
  for (const key of KEYS) {
    const rule = RULES[key];
    const raw = source[key];
    const numeric = raw === null || raw === "" || raw === undefined ? rule.fallback : Number(raw);
    const bounded = Number.isFinite(numeric)
      ? Math.min(rule.max, Math.max(rule.min, numeric))
      : rule.fallback;
    normalized[key] = Math.round(bounded * rule.precision) / rule.precision;
  }
  return normalized;
}

export function isValidLayerAdjustments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return KEYS.every(key => {
    const numeric = value[key];
    const rule = RULES[key];
    return typeof numeric === "number" &&
      Number.isFinite(numeric) &&
      numeric >= rule.min &&
      numeric <= rule.max;
  });
}

export function areLayerAdjustmentsEqual(left, right) {
  const a = normalizeLayerAdjustments(left);
  const b = normalizeLayerAdjustments(right);
  return KEYS.every(key => a[key] === b[key]);
}

export function isDefaultLayerAdjustments(value) {
  return areLayerAdjustmentsEqual(value, DEFAULT_LAYER_ADJUSTMENTS);
}

export function layerAdjustmentsToCanvasFilter(value) {
  const adjustments = normalizeLayerAdjustments(value);
  const filters = [];
  if (adjustments.brightness !== 100) filters.push("brightness(" + adjustments.brightness + "%)");
  if (adjustments.contrast !== 100) filters.push("contrast(" + adjustments.contrast + "%)");
  if (adjustments.saturation !== 100) filters.push("saturate(" + adjustments.saturation + "%)");
  if (adjustments.hue !== 0) filters.push("hue-rotate(" + adjustments.hue + "deg)");
  if (adjustments.temperature > 0) {
    filters.push("sepia(" + Math.round(adjustments.temperature * 0.42) + "%)");
  } else if (adjustments.temperature < 0) {
    filters.push("hue-rotate(" + Math.round(adjustments.temperature * 0.12) + "deg)");
    filters.push("saturate(" + (100 + Math.round(Math.abs(adjustments.temperature) * 0.12)) + "%)");
  }
  if (adjustments.tint !== 0) {
    filters.push("hue-rotate(" + Math.round(adjustments.tint * 0.18) + "deg)");
    filters.push("saturate(" + (100 + Math.round(Math.abs(adjustments.tint) * 0.1)) + "%)");
  }
  if (adjustments.blur > 0) filters.push("blur(" + adjustments.blur + "px)");
  return filters.length ? filters.join(" ") : "none";
}

export const LAYER_ADJUSTMENT_PRESETS = Object.freeze([
  Object.freeze({ id: "original", label: "Original", values: DEFAULT_LAYER_ADJUSTMENTS }),
  Object.freeze({ id: "anime", label: "Anime", values: Object.freeze({ brightness: 105, contrast: 114, saturation: 142, hue: 0, temperature: 0, tint: 0, blur: 0 }) }),
  Object.freeze({ id: "cinematic", label: "Cinematic", values: Object.freeze({ brightness: 92, contrast: 126, saturation: 112, hue: 8, temperature: -18, tint: 8, blur: 0 }) }),
  Object.freeze({ id: "manga", label: "Manga", values: Object.freeze({ brightness: 106, contrast: 152, saturation: 0, hue: 0, temperature: 0, tint: 0, blur: 0 }) }),
  Object.freeze({ id: "dream", label: "Dream", values: Object.freeze({ brightness: 108, contrast: 94, saturation: 118, hue: -12, temperature: 22, tint: -14, blur: 0.4 }) })
]);
