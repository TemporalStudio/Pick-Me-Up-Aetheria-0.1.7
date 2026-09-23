import { CONFIG } from "./core/config.js";
import { getState, setState } from "./core/state.js";
import { $, escapeHtml } from "./ui/dom.js";
import { renderHeroPage } from "./features/hero.js";
import { renderInventoryPage } from "./features/inventory.js";

const featureRenderers = {
  heroes: renderHeroPage,
  inventory: renderInventoryPage
};

export function renderFeature(name, ...args) {
  const renderer = featureRenderers[name];
  if (typeof renderer !== "function") {
    console.warn(`[AETHERIA] No modular renderer registered for: ${name}`);
    return false;
  }
  renderer(...args);
  return true;
}

function bindNavigation() {
  document.querySelectorAll("[data-open]").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.open;

      // New modular feature pages take ownership here.
      if (featureRenderers[page]) {
        document.querySelectorAll(".nav .btn").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        renderFeature(page);
        return;
      }

      // Other legacy pages remain handled by the original engine.
      if (typeof window.__AETHERIA_LEGACY_NAV__ === "function") {
        window.__AETHERIA_LEGACY_NAV__(page);
      }
    });
  });
}

function exposeStateBridge() {
  // Compatibility only: legacy engine reads this adapter.
  // New modules should import state.js instead of reading window globals.
  window.__AETHERIA_STATE__ = getState();
  window.__AETHERIA_SET_STATE__ = setState;
}

async function boot() {
  exposeStateBridge();

  // Legacy engine is loaded as a module so no symbols leak into global scope.
  await import("./legacy/engine.js");

  // The old engine owns the title/story/save/etc. startup sequence.
  if (typeof window.__AETHERIA_LEGACY_INIT__ === "function") {
    window.__AETHERIA_LEGACY_INIT__();
  }

  bindNavigation();
}

document.addEventListener("DOMContentLoaded", boot);
export { CONFIG };
