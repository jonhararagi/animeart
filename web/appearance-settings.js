const STORAGE_KEY = "animeart-editor-appearance-v1";
const DEFAULTS = Object.freeze({ accent: "#ff4fd8", workspace: "#100d20", wallpaper: "", wallpaperName: "", editingHelpEnabled: true });
const MAX_WALLPAPER_BYTES = 2 * 1024 * 1024;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function validColor(value, fallback) {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value.toLowerCase() : fallback;
}
function relativeLuminance(color) {
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export function getAccentTextColor(value) {
  const accent = validColor(value, DEFAULTS.accent);
  const light = "#f8f6ff";
  const dark = "#000000";
  return contrastRatio(accent, light) >= contrastRatio(accent, dark) ? light : dark;
}
function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      accent: validColor(value.accent, DEFAULTS.accent),
      workspace: validColor(value.workspace, DEFAULTS.workspace),
      wallpaper: typeof value.wallpaper === "string" && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value.wallpaper) ? value.wallpaper : "",
      wallpaperName: typeof value.wallpaperName === "string" ? value.wallpaperName.slice(0, 180) : "",
      editingHelpEnabled: value.editingHelpEnabled !== false
    };
  } catch {
    return { ...DEFAULTS };
  }
}
function setWorkspaceWallpaper(value) {
  const canvasWrap = document.querySelector(".canvas-wrap");
  if (!canvasWrap) return;
  if (value) {
    canvasWrap.style.setProperty("--editor-wallpaper-overlay", "linear-gradient(#11131822,#11131822), url('" + value + "')");
    canvasWrap.style.backgroundSize = "cover";
    canvasWrap.style.backgroundPosition = "center";
  } else {
    canvasWrap.style.removeProperty("--editor-wallpaper-overlay");
    canvasWrap.style.backgroundSize = "";
    canvasWrap.style.backgroundPosition = "";
  }
}
function applySettings(settings) {
  const root = document.documentElement;
  root.style.setProperty("--accent", settings.accent);
  root.style.setProperty("--accent-strong", settings.accent);
  root.style.setProperty("--accent-contrast", getAccentTextColor(settings.accent));
  root.style.setProperty("--editor-workspace", settings.workspace);
  setWorkspaceWallpaper(settings.wallpaper);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = settings.accent;
  root.dataset.editorAccent = settings.accent;
  root.dataset.editorWorkspace = settings.workspace;
}
export function getEditingHelpPreference() {
  return readSettings().editingHelpEnabled !== false;
}
export function setEditingHelpPreference(enabled) {
  try {
    const settings = readSettings();
    settings.editingHelpEnabled = Boolean(enabled);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read wallpaper"));
    reader.readAsDataURL(file);
  });
}
export function initializeAppearanceSettings() {
  const dialog = document.querySelector("#appearance-dialog");
  const open = document.querySelector("#appearance-open");
  const form = document.querySelector("#appearance-form");
  if (!dialog || !open || !form) return;
  const accentInput = document.querySelector("#appearance-accent");
  const workspaceInput = document.querySelector("#appearance-workspace");
  const wallpaperInput = document.querySelector("#appearance-wallpaper-file");
  const wallpaperName = document.querySelector("#appearance-wallpaper-name");
  const status = document.querySelector("#appearance-status");
  let settings = readSettings();
  let draft = { ...settings };
  function updateDraft() {
    draft.accent = validColor(accentInput.value, DEFAULTS.accent);
    draft.workspace = validColor(workspaceInput.value, DEFAULTS.workspace);
    applySettings(draft);
    document.querySelectorAll("[data-accent-preset]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.accentPreset === draft.accent)));
    document.querySelectorAll("[data-workspace-preset]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.workspacePreset === draft.workspace)));
  }
  function showDialog() {
    draft = { ...settings };
    accentInput.value = draft.accent;
    workspaceInput.value = draft.workspace;
    wallpaperName.textContent = draft.wallpaper ? draft.wallpaperName || "Custom wallpaper loaded" : "No custom wallpaper selected.";
    updateDraft();
    if (!dialog.open) dialog.showModal();
  }
  open.addEventListener("click", showDialog);
  document.querySelector("#appearance-close")?.addEventListener("click", () => { applySettings(settings); dialog.close(); });
  accentInput.addEventListener("input", updateDraft);
  workspaceInput.addEventListener("input", updateDraft);
  document.querySelectorAll("[data-accent-preset]").forEach(button => button.addEventListener("click", () => {
    accentInput.value = button.dataset.accentPreset; updateDraft();
  }));
  document.querySelectorAll("[data-workspace-preset]").forEach(button => button.addEventListener("click", () => {
    workspaceInput.value = button.dataset.workspacePreset; updateDraft();
  }));
  wallpaperInput.addEventListener("change", async () => {
    const file = wallpaperInput.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      status.textContent = "Choose a PNG, JPEG or WebP wallpaper.";
      wallpaperInput.value = "";
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      status.textContent = "Wallpaper must be 2 MiB or smaller.";
      wallpaperInput.value = "";
      return;
    }
    try {
      draft.wallpaper = await readFileAsDataUrl(file);
      draft.wallpaperName = file.name.slice(0, 180);
      wallpaperName.textContent = draft.wallpaperName;
      applySettings(draft);
      status.textContent = "Wallpaper preview applied to the editor workspace only.";
    } catch (error) {
      status.textContent = error.message || "Could not load wallpaper.";
    }
  });
  document.querySelector("#appearance-clear-wallpaper")?.addEventListener("click", () => {
    draft.wallpaper = "";
    draft.wallpaperName = "";
    wallpaperInput.value = "";
    wallpaperName.textContent = "No custom wallpaper selected.";
    applySettings(draft);
    status.textContent = "Workspace wallpaper removed.";
  });
  document.querySelector("#appearance-reset")?.addEventListener("click", () => {
    draft = { ...DEFAULTS };
    accentInput.value = draft.accent;
    workspaceInput.value = draft.workspace;
    wallpaperInput.value = "";
    wallpaperName.textContent = "No custom wallpaper selected.";
    updateDraft();
    applySettings(draft);
    status.textContent = "Default appearance preview.";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      settings = { ...draft };
      applySettings(settings);
      status.textContent = "Appearance saved on this device.";
      dialog.close();
    } catch {
      status.textContent = "Could not save settings. Remove a large wallpaper and try again.";
      applySettings(settings);
    }
  });
  dialog.addEventListener("cancel", () => applySettings(settings));
  applySettings(settings);
}
