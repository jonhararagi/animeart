import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getAccentTextColor } from "../appearance-settings.js";

function luminance(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
test("dark editor text and helper labels meet WCAG AA contrast for normal text", async () => {
  const [html, css] = await Promise.all([readFile("index.html", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(html, /id="text-color" type="color" value="#f7f5fc"/);
  assert.match(css, /AA-A11Y-CONTRAST-001/);
  const pairs = [
    ["#f5f7ff", "#0b0e14", "primary text on app background"],
    ["#bdcbe0", "#111620", "muted text on editor surface"],
    ["#bdcbe0", "#0f121a", "helper text on input surface"],
    ["#b7c5d9", "#0f121a", "placeholder on text field"],
    ["#b7c5d9", "#17141e", "placeholder on dark dialog"]
  ];
  for (const [foreground, background, label] of pairs) {
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio >= 4.5, label + " must reach WCAG AA 4.5:1, got " + ratio.toFixed(2) + ":1");
  }
});
test("custom accent buttons choose a foreground with sufficient contrast", () => {
  for (const accent of ["#ff4fd8", "#21102e", "#ffffff", "#000000", "#67e8f9", "#502060"]) {
    const foreground = getAccentTextColor(accent);
    assert.ok(["#000000", "#f8f6ff"].includes(foreground), "only safe foreground colors may be chosen");
    const ratio = contrastRatio(foreground, accent);
    assert.ok(ratio >= 4.5, "accent " + accent + " with text " + foreground + " must reach WCAG AA; got " + ratio.toFixed(2) + ":1");
  }
});
