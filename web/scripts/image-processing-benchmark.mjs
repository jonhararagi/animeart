import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { replaceColorRange } from "../domain/color-replacement.mjs";
import { applyEraseStrokes, removeConnectedBackground } from "../domain/background-removal.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const dimensionsByMegapixel = new Map([
  [4, { width: 2000, height: 2000 }],
  [8, { width: 4000, height: 2000 }],
  [16, { width: 4000, height: 4000 }]
]);
const operations = ["replace-color-range", "remove-connected-background", "apply-erase-strokes"];
const MiB = 1024 * 1024;

function peakRssMiB(resourceUsage) {
  // Node reports maxRSS in KiB on Linux/Windows and bytes on macOS.
  return Number((resourceUsage.maxRSS / (process.platform === "darwin" ? MiB : 1024)).toFixed(1));
}
function cpuDeltaMs(before, after) {
  return {
    userCpuMs: Number(((after.userCPUTime - before.userCPUTime) / 1000).toFixed(1)),
    systemCpuMs: Number(((after.systemCPUTime - before.systemCPUTime) / 1000).toFixed(1))
  };
}
function createPixels(width, height, operation) {
  const data = new Uint8ClampedArray(width * height * 4);
  const background = operation === "remove-connected-background";
  const r = background ? 255 : 128;
  const g = background ? 255 : 96;
  const b = background ? 255 : 80;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}
function runScenario(megapixels, operation) {
  const { width, height } = dimensionsByMegapixel.get(megapixels);
  const imageData = createPixels(width, height, operation);
  const rssBefore = process.memoryUsage().rss;
  const externalBefore = process.memoryUsage().external;
  const cpuBefore = process.resourceUsage();
  const started = performance.now();
  let result;
  if (operation === "replace-color-range") {
    result = replaceColorRange(imageData, {
      sourceColor: "#806050", targetColor: "#c76cf2",
      tolerance: 0, softness: 0, preserveShading: true, mutate: true
    });
    if (result.data[0] === 128 && result.data[1] === 96 && result.data[2] === 80) {
      throw new Error("Recolor benchmark did not modify its target pixel");
    }
  } else if (operation === "remove-connected-background") {
    result = removeConnectedBackground(imageData, {
      targetColor: "#ffffff", tolerance: 0, feather: 0,
      protectLineArt: true, decontaminate: true, mutate: true
    });
    if (!result.changed || result.data[3] !== 0) {
      throw new Error("Background-removal benchmark did not create transparent pixels");
    }
  } else if (operation === "apply-erase-strokes") {
    result = applyEraseStrokes(imageData, [{
      size: 32, points: [{ x: width / 2, y: height / 2 }]
    }], { mutate: true });
    const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4 + 3;
    if (result.data[center] !== 0 || result.data[3] !== 255) {
      throw new Error("Erase benchmark failed its alpha-preservation checks");
    }
  } else {
    throw new TypeError("Unsupported benchmark operation: " + operation);
  }
  const elapsedMs = performance.now() - started;
  const cpuAfter = process.resourceUsage();
  const memoryAfter = process.memoryUsage();
  const output = {
    megapixels,
    width,
    height,
    operation,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    ...cpuDeltaMs(cpuBefore, cpuAfter),
    rssBeforeProcessingMiB: Number((rssBefore / MiB).toFixed(1)),
    rssAfterProcessingMiB: Number((memoryAfter.rss / MiB).toFixed(1)),
    peakRssMiB: peakRssMiB(process.resourceUsage()),
    externalBeforeProcessingMiB: Number((externalBefore / MiB).toFixed(1)),
    externalAfterProcessingMiB: Number((memoryAfter.external / MiB).toFixed(1)),
    rgbaBufferMiB: Number((imageData.data.byteLength / MiB).toFixed(1)),
    pixelChecks: "PASS"
  };
  console.log("ANIMEART_PIXEL_BENCHMARK " + JSON.stringify(output));
}

if (process.argv[2] === "--scenario") {
  const megapixels = Number(process.argv[3]);
  const operation = process.argv[4];
  if (!dimensionsByMegapixel.has(megapixels) || !operations.includes(operation)) {
    throw new Error("Usage: node image-processing-benchmark.mjs --scenario <4|8|16> <operation>");
  }
  runScenario(megapixels, operation);
} else {
  console.log("AnimeArt local pixel benchmark: isolated Node processes; diagnostic metrics, not device battery measurements.");
  for (const megapixels of dimensionsByMegapixel.keys()) {
    for (const operation of operations) {
      const child = spawnSync(process.execPath, [scriptPath, "--scenario", String(megapixels), operation], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        timeout: 180_000
      });
      if (child.stdout) process.stdout.write(child.stdout);
      if (child.status !== 0) {
        if (child.stderr) process.stderr.write(child.stderr);
        throw new Error("Benchmark failed: " + megapixels + " MP / " + operation +
          (child.signal ? " (signal " + child.signal + ")" : " (exit " + child.status + ")"));
      }
    }
  }
  console.log("ANIMEART_PIXEL_BENCHMARK_SUITE: PASS (9 scenarios; no hardware-specific time threshold)");
}
