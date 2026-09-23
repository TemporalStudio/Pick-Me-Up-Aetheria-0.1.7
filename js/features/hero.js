import { getState } from "../core/state.js";
import { $ , escapeHtml } from "../ui/dom.js";

export function renderHeroPage() {
  const state = getState();
  const content = $("content");
  if (!content) return;

  const heroes = Array.isArray(state.heroes) ? state.heroes : [];

  content.innerHTML = `
    <div class="hero-roster-head">
      <div>
        <h2>Hero Roster</h2>
        <div class="sub">Manage recruited heroes, inspect progression and open individual profiles.</div>
      </div>
      <div class="hero-roster-count">
        <b>${heroes.length}</b>
        <span>HEROES</span>
      </div>
    </div>

    <div class="hero-card-grid">
      ${heroes.length ? heroes.map(renderHeroCard).join("") : `
        <div class="hero-empty-state">
          <div class="hero-empty-icon">♙</div>
          <b>NO HEROES RECRUITED</b>
          <span>Visit Recruitment Log to acquire your first hero.</span>
        </div>
      `}
    </div>
  `;

  content.querySelectorAll("[data-hero-profile]").forEach(card => {
    card.addEventListener("click", () => {
      const hero = heroes.find(h => h.id === card.dataset.heroProfile);
      if (hero) renderHeroProfile(hero);
    });
  });
}

function renderHeroCard(hero) {
  const star = Math.max(1, Number(hero.star || 1));
  const status = String(hero.status || "AVAILABLE").toUpperCase();
  const hp = Number(hero.hp ?? hero.maxHp ?? hero.primaryStats?.HP ?? 0);
  const atk = Number(hero.atk ?? hero.primaryStats?.ATK ?? 0);

  return `
    <button class="hero-card" data-hero-profile="${escapeHtml(hero.id)}">
      <div class="hero-card-top">
        <div class="hero-avatar">${escapeHtml((hero.name || "H").slice(0,2).toUpperCase())}</div>
        <div class="hero-card-heading">
          <div class="hero-card-stars">${"★".repeat(star)}</div>
          <div class="hero-status ${status === "BUSY" ? "busy" : ""}">${escapeHtml(status)}</div>
        </div>
      </div>
      <div class="hero-card-name">${escapeHtml(hero.name || "Unnamed Hero")}</div>
      <div class="hero-card-meta">
        ${escapeHtml(hero.race || "Unknown")} <i>•</i> ${escapeHtml(hero.role || "Unknown")}
      </div>
      <span class="hero-card-level">LV ${Number(hero.level || 1)}</span>
      <div class="hero-stat-grid">
        <div><small>HP</small><b>${hp.toLocaleString()}</b></div>
        <div><small>ATK</small><b>${atk.toLocaleString()}</b></div>
      </div>
    </button>
  `;
}

function renderHeroProfile(hero) {
  const content = $("content");
  if (!content) return;

  const stats = hero.primaryStats || {};
  const skills = hero.skills || {};

  content.innerHTML = `
    <div class="hero-profile-shell">
      <div class="hero-profile-banner">
        <div class="hero-profile-avatar">${escapeHtml((hero.name || "H").slice(0,2).toUpperCase())}</div>
        <div>
          <div class="hero-profile-name">${escapeHtml(hero.name || "Unnamed Hero")}</div>
          <div class="hero-profile-meta">
            ${escapeHtml(hero.race || "Unknown")} • ${escapeHtml(hero.role || "Unknown")}
            • ${"★".repeat(Math.max(1, Number(hero.star || 1)))}
          </div>
        </div>
        <div class="hero-profile-status">
          <b>${escapeHtml(String(hero.status || "AVAILABLE").toUpperCase())}</b>
          <small>Level ${Number(hero.level || 1)}</small>
        </div>
      </div>

      <div class="info">
        ${Object.entries(stats).map(([key,value]) => `
          <div class="info-item"><small>${escapeHtml(key)}</small><b>${Number(value || 0).toLocaleString()}</b></div>
        `).join("")}
      </div>

      <div>
        <div class="detail-heading">SKILLS</div>
        ${(Array.isArray(skills.basic) ? skills.basic : []).map(s => `
          <div class="skill-card"><b>BASIC</b><span>${escapeHtml(s)}</span></div>
        `).join("")}
        ${(Array.isArray(skills.traits) ? skills.traits : []).map(s => `
          <div class="skill-card"><b>TRAIT</b><span>${escapeHtml(s)}</span></div>
        `).join("")}
      </div>

      <button class="btn" id="backToHeroes">BACK TO ROSTER</button>
    </div>
  `;

  $("backToHeroes")?.addEventListener("click", renderHeroPage);
}
