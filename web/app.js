const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const layersEl = document.querySelector("#layers");

const state = {
  tool: "brush",
  drawing: false,
  layerIndex: 0,
  layers: [{ id: crypto.randomUUID(), name: "Layer 1" }],
  history: [],
  historyIndex: -1,
  strokes: []
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}

function redraw() {
  const rect = canvas.getBoundingClientRect();
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  for (const stroke of state.strokes) {
    if (stroke.layerIndex !== state.layerIndex || stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : "#111318";
    ctx.stroke();
  }
  ctx.restore();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function commitHistory() {
  const snapshot = JSON.stringify(state.strokes);
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
}

function renderLayers() {
  layersEl.replaceChildren();
  [...state.layers].reverse().forEach((layer, reverseIndex) => {
    const li = document.createElement("li");
    li.textContent = layer.name;
    if (state.layers.length - 1 - reverseIndex === state.layerIndex) li.dataset.selected = "true";
    layersEl.appendChild(li);
  });
}

canvas.addEventListener("pointerdown", event => {
  if (state.tool === "pan") return;
  state.drawing = true;
  canvas.setPointerCapture(event.pointerId);
  const p = pointFromEvent(event);
  state.strokes.push({ layerIndex: state.layerIndex, tool: state.tool, size: 5, points: [p] });
});

canvas.addEventListener("pointermove", event => {
  if (!state.drawing) return;
  const stroke = state.strokes.at(-1);
  if (!stroke) return;
  stroke.points.push(pointFromEvent(event));
  redraw();
});

canvas.addEventListener("pointerup", event => {
  if (!state.drawing) return;
  state.drawing = false;
  const stroke = state.strokes.at(-1);
  if (stroke && stroke.points.length > 1) commitHistory();
  status.textContent = "Unsaved local changes";
});

document.querySelectorAll(".tool").forEach(button => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach(b => b.classList.toggle("active", b === button));
  });
});

document.querySelector("#add-layer").addEventListener("click", () => {
  state.layers.push({ id: crypto.randomUUID(), name: "Layer " + (state.layers.length + 1) });
  state.layerIndex = state.layers.length - 1;
  renderLayers();
});

document.querySelector("#clear").addEventListener("click", () => {
  state.strokes = state.strokes.filter(stroke => stroke.layerIndex !== state.layerIndex);
  commitHistory();
  redraw();
});

document.querySelector("#save").addEventListener("click", () => {
  localStorage.setItem("animeart-web-document", JSON.stringify({
    version: 1,
    layers: state.layers,
    strokes: state.strokes
  }));
  status.textContent = "Saved locally";
});

function load() {
  const raw = localStorage.getItem("animeart-web-document");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.layers) && Array.isArray(saved.strokes)) {
      state.layers = saved.layers;
      state.strokes = saved.strokes;
      state.layerIndex = Math.max(0, state.layers.length - 1);
      status.textContent = "Recovered local project";
    }
  } catch {
    status.textContent = "New local project";
  }
}

window.addEventListener("resize", resizeCanvas);
load();
renderLayers();
resizeCanvas();
