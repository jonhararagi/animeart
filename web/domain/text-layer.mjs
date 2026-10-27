export const TEXT_FONT_FAMILIES = Object.freeze([
  "Arial", "Arial Black", "Impact", "Georgia", "Trebuchet MS", "Verdana",
  "Courier New", "Palatino Linotype", "Lucida Console", "sans-serif", "serif", "monospace"
]);

export const DEFAULT_TEXT_LAYER = Object.freeze({
  value: "AnimeArt", x: 40, y: 160, fontSize: 48, fontFamily: "Arial",
  fontWeight: "bold", color: "#172335", align: "left",
  letterSpacing: 0, lineHeight: 1.2,
  outlineColor: "#ffffff", outlineWidth: 0, shadowColor: "#000000",
  shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
});

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ALIGNMENTS = Object.freeze(["left", "center", "right"]);
const WEIGHTS = Object.freeze(["normal", "bold"]);
const MAX_TEXT_LENGTH = 500, MIN_FONT_SIZE = 8, MAX_FONT_SIZE = 240;
const MAX_OUTLINE_WIDTH = 24, MAX_SHADOW_BLUR = 48, MAX_SHADOW_OFFSET = 40;
export const TEXT_LETTER_SPACING_MIN = -8;
export const TEXT_LETTER_SPACING_MAX = 24;
export const TEXT_LINE_HEIGHT_MIN = 0.8;
export const TEXT_LINE_HEIGHT_MAX = 2.5;

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function safeColor(value, fallback) {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value : fallback;
}

export function normalizeTextLayer(value = {}) {
  const s = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const raw = typeof s.value === "string" ? s.value : DEFAULT_TEXT_LAYER.value;
  return {
    value: raw.replace(/\r\n?/g, "\n").slice(0, MAX_TEXT_LENGTH),
    x: clampNumber(s.x, 40, -100000, 100000),
    y: clampNumber(s.y, 160, -100000, 100000),
    fontSize: clampNumber(s.fontSize, 48, MIN_FONT_SIZE, MAX_FONT_SIZE),
    fontFamily: TEXT_FONT_FAMILIES.includes(s.fontFamily) ? s.fontFamily : "Arial",
    fontWeight: WEIGHTS.includes(s.fontWeight) ? s.fontWeight : "bold",
    color: safeColor(s.color, "#172335"),
    align: ALIGNMENTS.includes(s.align) ? s.align : "left",
    letterSpacing: clampNumber(s.letterSpacing, 0, TEXT_LETTER_SPACING_MIN, TEXT_LETTER_SPACING_MAX),
    lineHeight: clampNumber(s.lineHeight, 1.2, TEXT_LINE_HEIGHT_MIN, TEXT_LINE_HEIGHT_MAX),
    outlineColor: safeColor(s.outlineColor, "#ffffff"),
    outlineWidth: clampNumber(s.outlineWidth, 0, 0, MAX_OUTLINE_WIDTH),
    shadowColor: safeColor(s.shadowColor, "#000000"),
    shadowBlur: clampNumber(s.shadowBlur, 0, 0, MAX_SHADOW_BLUR),
    shadowOffsetX: clampNumber(s.shadowOffsetX, 0, -MAX_SHADOW_OFFSET, MAX_SHADOW_OFFSET),
    shadowOffsetY: clampNumber(s.shadowOffsetY, 0, -MAX_SHADOW_OFFSET, MAX_SHADOW_OFFSET)
  };
}

export function isValidTextLayer(value) {
  const v = value;
  return Boolean(v && typeof v === "object" && !Array.isArray(v) &&
    typeof v.value === "string" && v.value.length <= MAX_TEXT_LENGTH && !v.value.includes("\r") &&
    Number.isFinite(v.x) && Number.isFinite(v.y) &&
    Number.isFinite(v.fontSize) && v.fontSize >= MIN_FONT_SIZE && v.fontSize <= MAX_FONT_SIZE &&
    TEXT_FONT_FAMILIES.includes(v.fontFamily) && WEIGHTS.includes(v.fontWeight) &&
    typeof v.color === "string" && COLOR_PATTERN.test(v.color) && ALIGNMENTS.includes(v.align) &&
    (v.letterSpacing === undefined || (Number.isFinite(v.letterSpacing) && v.letterSpacing >= TEXT_LETTER_SPACING_MIN && v.letterSpacing <= TEXT_LETTER_SPACING_MAX)) &&
    (v.lineHeight === undefined || (Number.isFinite(v.lineHeight) && v.lineHeight >= TEXT_LINE_HEIGHT_MIN && v.lineHeight <= TEXT_LINE_HEIGHT_MAX)) &&
    typeof v.outlineColor === "string" && COLOR_PATTERN.test(v.outlineColor) &&
    Number.isFinite(v.outlineWidth) && v.outlineWidth >= 0 && v.outlineWidth <= MAX_OUTLINE_WIDTH &&
    typeof v.shadowColor === "string" && COLOR_PATTERN.test(v.shadowColor) &&
    Number.isFinite(v.shadowBlur) && v.shadowBlur >= 0 && v.shadowBlur <= MAX_SHADOW_BLUR &&
    Number.isFinite(v.shadowOffsetX) && Math.abs(v.shadowOffsetX) <= MAX_SHADOW_OFFSET &&
    Number.isFinite(v.shadowOffsetY) && Math.abs(v.shadowOffsetY) <= MAX_SHADOW_OFFSET);
}

export function estimateTextLayerBounds(value) {
  const t = normalizeTextLayer(value);
  const lines = t.value.split("\n");
  const widths = lines.map(line => {
    const count = Array.from(line).length;
    return count * t.fontSize * 0.68 + Math.max(0, count - 1) * t.letterSpacing;
  });
  const width = Math.max(t.fontSize * 0.35, ...widths);
  const pad = t.outlineWidth + t.shadowBlur + Math.max(Math.abs(t.shadowOffsetX), Math.abs(t.shadowOffsetY));
  const minX = (t.align === "center" ? t.x - width / 2 : t.align === "right" ? t.x - width : t.x) - pad;
  const lineStep = t.fontSize * t.lineHeight;
  return {
    minX,
    minY: t.y - t.fontSize - pad,
    maxX: minX + width + pad * 2,
    maxY: t.y + (lines.length - 1) * lineStep + t.fontSize * 0.25 + pad
  };
}
