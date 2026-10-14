const dock = document.querySelector(".mobile-touch-dock");
const cropButton = document.querySelector("#crop-resize-image");
const status = document.querySelector("#status");

dock?.addEventListener("click", event => {
  const shortcut = event.target.closest('[data-touch-action="crop-image"]');
  if (!shortcut) return;

  document.body.classList.remove("mobile-tools-open", "mobile-layers-open");
  dock.querySelectorAll('[data-touch-action="more"], [data-touch-action="layers"]').forEach(button => {
    button.setAttribute("aria-expanded", "false");
  });

  if (!cropButton || cropButton.disabled) {
    if (status) status.textContent = "Seleccioná una imagen desbloqueada en el lienzo o en Capas para poder recortarla.";
    return;
  }

  cropButton.click();
});
