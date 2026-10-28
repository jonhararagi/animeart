import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MULTIPAGE_PDF_PAGES,
  PDF_POINTS_PER_PIXEL,
  buildMultiPagePdf
} from "../domain/pdf-export.mjs";

function tinyJpeg(seed = 0) {
  return Uint8Array.of(0xff, 0xd8, seed & 0xff, 0x21, 0x32, 0xff, 0xd9);
}

test("builds a valid classic PDF structure for one page", () => {
  const bytes = buildMultiPagePdf([{
    width: 1080,
    height: 1350,
    imageWidth: 1080,
    imageHeight: 1350,
    jpegBytes: tinyJpeg()
  }]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Type \/Pages \/Count 1/);
  assert.match(text, /\/MediaBox \[0 0 810 1012\.5\]/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /%%EOF\n$/);

  const xrefOffset = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), "xref");
  const xrefLines = text.slice(xrefOffset).split("\n");
  assert.match(xrefLines[2], /^\d{10} 00000 n $/);
  const firstObjectOffset = Number(xrefLines[2].slice(0, 10));
  assert.equal(text.slice(firstObjectOffset, firstObjectOffset + 7), "1 0 obj");
});

test("writes distinct image objects and page sizes for a mixed-size document", () => {
  const bytes = buildMultiPagePdf([
    { width: 1080, height: 1350, jpegBytes: tinyJpeg(1) },
    { width: 1920, height: 1080, imageWidth: 1600, imageHeight: 900, jpegBytes: tinyJpeg(2) },
    { width: 1080, height: 1080, jpegBytes: tinyJpeg(3) }
  ]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /\/Type \/Pages \/Count 3/);
  assert.match(text, /\/Kids \[3 0 R 6 0 R 9 0 R\]/);
  assert.match(text, /\/MediaBox \[0 0 1440 810\]/);
  assert.match(text, /\/Width 1600 \/Height 900/);
  assert.equal((text.match(/\/Subtype \/Image/g) || []).length, 3);
  assert.equal(PDF_POINTS_PER_PIXEL, 0.75);
});

test("rejects missing pages, over-limit projects and invalid dimensions", () => {
  assert.throws(() => buildMultiPagePdf([]), /between 1 and 10 pages/i);
  assert.throws(() => buildMultiPagePdf(Array.from({ length: MAX_MULTIPAGE_PDF_PAGES + 1 }, () => ({
    width: 10, height: 10, jpegBytes: tinyJpeg()
  }))), /between 1 and 10 pages/i);
  assert.throws(() => buildMultiPagePdf([{ width: 0, height: 10, jpegBytes: tinyJpeg() }]), /Page width/i);
  assert.throws(() => buildMultiPagePdf([{ width: 8192, height: 8192, jpegBytes: tinyJpeg() }]), /40 megapixels/i);
});

test("rejects malformed or oversized embedded JPEG data", () => {
  assert.throws(() => buildMultiPagePdf([{ width: 20, height: 20, jpegBytes: new Uint8Array([1, 2, 3]) }]), /complete JPEG/i);
  assert.throws(() => buildMultiPagePdf([{ width: 5000, height: 5000, imageWidth: 5000, imageHeight: 5000, jpegBytes: tinyJpeg() }]), /16 megapixels/i);
});

test("keeps the JPEG payload intact inside its binary stream", () => {
  const jpeg = Uint8Array.of(0xff, 0xd8, 0x11, 0x22, 0x00, 0x7f, 0xff, 0xd9);
  const bytes = buildMultiPagePdf([{ width: 24, height: 24, jpegBytes: jpeg }]);
  const marker = new Uint8Array([0xff, 0xd8, 0x11, 0x22, 0x00, 0x7f, 0xff, 0xd9]);
  let found = false;
  outer: for (let i = 0; i <= bytes.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) if (bytes[i + j] !== marker[j]) continue outer;
    found = true; break;
  }
  assert.equal(found, true);
});
