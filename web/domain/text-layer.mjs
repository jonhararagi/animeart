export const TEXT_FONT_FAMILIES = Object.freeze([
  "Arial",
  "Georgia",
  "Trebuchet MS",
  "Verdana",
  "Courier New",
  "sans-serif",
  "serif",
  "monospace"
]);

export const DEFAULT_TEXT_LAYER = Object.freeze({
  value: "AnimeArt",
  x: 40,
  y: 160,
  fontSize: 48,
  fontFamily: "Arial",
  fontWeight: "bold",
  color: "#172335",
  align: "left"
});

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ALIGNMENTS = Object.freeze(["left", "center", "right"]);
const WEIGHTS = Object.freeze(["normal", "bold"]);
const MAX_TEXT_LENGTH = 500;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 240;

export function normalizeTextLayer(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawText = typeof source.value === "string" ? source.value : DEFAULT_TEXT_LAYER.value;
  const size = Number(source.fontSize);
  const x = Number(source.x);
  const y = Number(source.y);
  return {
    value: rawText.replace(/\r\n?/g, "\n").slice(0, MAX_TEXT_LENGTH),
    x: Number.isFinite(x) ? x : DEFAULT_TEXT_LAYER.x,
    y: Number.isFinite(y) ? y : DEFAULT_TEXT_LAYER.y,
    fontSize: Number.isFinite(size) ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size)) : DEFAULT_TEXT_LAYER.fontSize,
    fontFamily: TEXT_FONT_FAMILIES.includes(source.fontFamily) ? source.fontFamily : DEFAULT_TEXT_LAYER.fontFamily,
    fontWeight: WEIGHTS.includes(source.fontWeight) ? source.fontWeight : DEFAULT_TEXT_LAYER.fontWeight,
    color: typeof source.color === "string" && COLOR_PATTERN.test(source.color) ? source.color : DEFAULT_TEXT_LAYER.color,
    align: ALIGNMENTS.includes(source.align) ? source.align : DEFAULT_TEXT_LAYER.align
  };
}

export function isValidTextLayer(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.value === "string" &&
    value.value.length <= MAX_TEXT_LENGTH &&
    !value.value.includes("\r") &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.fontSize) &&
    value.fontSize >= MIN_FONT_SIZE &&
    value.fontSize <= MAX_FONT_SIZE &&
    TEXT_FONT_FAMILIES.includes(value.fontFamily) &&
    WEIGHTS.includes(value.fontWeight) &&
    typeof value.color === "string" &&
    COLOR_PATTERN.test(value.color) &&
    ALIGNMENTS.includes(value.align)
  );
}

export function estimateTextLayerBounds(value) {
  const text = normalizeTextLayer(value);
  const lines = text.value.split("\n");
  const longestLine = Math.max(1, ...lines.map(line => Array.from(line).length));
  const width = Math.max(text.fontSize * 0.35, longestLine * text.fontSize * 0.68);
  const minX = text.align === "center" ? text.x - width / 2 : text.align === "right" ? text.x - width : text.x;
  const lineHeight = text.fontSize * 1.2;
  return {
    minX,
    minY: text.y - text.fontSize,
    maxX: minX + width,
    maxY: text.y + (lines.length - 1) * lineHeight + text.fontSize * 0.25
  };
}
