import { getState } from "../core/state.js";
import { $ , escapeHtml } from "../ui/dom.js";

const TABS = [
  ["equipment", "Equipment"],
  ["medical", "Medical"],
  ["materials", "Materials"]
];

export function renderInventoryPage(activeTab = "equipment") {
  const state = getState();
  const content = $("content");
  if (!content) return;

  content.innerHTML = `
    <div class="inventory014">
      <div>
        <h2>Inventory</h2>
        <div class="sub">Central storage for equipment, medical supplies and materials.</div>
      </div>

      <div class="inventory-resource-bar">
        ${resource("◈","Gold",state.gold)}
        ${resource("◇","Gems",state.gems)}
        ${resource("▣","Tickets",state.tickets)}
        ${resource("✦","Special Tickets",state.specialTickets)}
      </div>

      <div class="inventory-tabs">
        ${TABS.map(([id,label]) => `
          <button class="inventory-tab ${id === activeTab ? "active" : ""}" data-inventory-tab="${id}">
            ${label}
            <small>${countItems(state,id)} entries</small>
          </button>
        `).join("")}
      </div>

      <div class="inventory-capacity">
        <span>Storage</span>
        <strong>${countItems(state,activeTab)} entries</strong>
      </div>

      <div class="inventory-card-grid">
        ${renderItems(state, activeTab)}
      </div>
    </div>
  `;

  content.querySelectorAll("[data-inventory-tab]").forEach(btn => {
    btn.addEventListener("click", () => renderInventoryPage(btn.dataset.inventoryTab));
  });
}

function resource(icon,label,value) {
  return `<div class="inventory-resource-card">
    <span class="inventory-resource-icon">${icon}</span>
    <small>${label}</small>
    <b>${Number(value || 0).toLocaleString()}</b>
  </div>`;
}

function countItems(state, kind) {
  const list = Array.isArray(state[kind]) ? state[kind] : [];
  if (kind === "equipment") return list.length;
  return list.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
}

function renderItems(state, kind) {
  const list = Array.isArray(state[kind]) ? state[kind] : [];
  if (!list.length) {
    return `<div class="inventory-empty">
      <div class="inventory-empty-icon">▣</div>
      <b>EMPTY STORAGE</b>
      <span>No ${escapeHtml(kind)} currently stored.</span>
    </div>`;
  }

  return list.map((item, index) => `
    <article class="inventory-card">
      <div class="inventory-card-top">
        <div class="inventory-item-icon">${kind === "equipment" ? "⚔" : kind === "medical" ? "✚" : "◆"}</div>
        <span class="inventory-tier">${escapeHtml(item.tier || item.rarity || "—")}</span>
      </div>
      <h3>${escapeHtml(item.name || item.itemId || "Unknown Item")}</h3>
      <div class="inventory-meta">ID: ${escapeHtml(item.itemId || item.id || "—")}</div>
      <div class="inventory-description">${escapeHtml(item.description || "No description available.")}</div>
      <div class="inventory-stack">Quantity: ${Number(item.quantity ?? 1).toLocaleString()}</div>
    </article>
  `).join("");
}
