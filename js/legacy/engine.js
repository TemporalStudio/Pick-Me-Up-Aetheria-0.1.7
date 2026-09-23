/*
 * LEGACY ENGINE BRIDGE
 * --------------------
 * This file contains the remaining 0.1.7 game logic during the strangler migration.
 * Feature modules progressively replace sections of this bridge.
 *
 * The bridge is intentionally kept isolated from index.html. It is NOT loaded as a
 * classic script; main.js imports the modular feature renderers first and then loads
 * this compatibility engine.
 */


/* =========================================================
   AETHERIA — UPDATE 0.1.6
   JAVASCRIPT ARCHITECTURE
   ---------------------------------------------------------
   01. Configuration
   02. Initial Game State
   03. DOM References
   04. Screen Navigation
   05. Save System
   06. Master / Hero Helpers
   07. Fairy System
   08. Hub Rendering
   09. Page Renderers
   10. Town / Day Cycle
   11. Dungeon Analysis
   12. Modal System
   13. Event Binding
   14. Initialization
   ========================================================= */

/* =========================================================
   01. CONFIGURATION
   ========================================================= */
const CONFIG = {
  VERSION: "0.1.7",
  SAVE_KEY: "aetheria_game_saves_v1",
  MAX_TOWER_FLOOR: 100,
  MAX_SAVE_SLOTS: 10,
  STARTING_GOLD: 1000,
  STARTING_GEMS: 100,
  STARTING_TICKETS: 3,
  HERO_LEVEL_CAPS: { 1:20, 2:30, 3:40, 4:50, 5:60, 6:99 },
  HERO_EXP_BASE: 100,
  HERO_EXP_POWER: 1.4,
  HERO_TEST_EXP: 1000
};

/* =========================================================
   02. INITIAL GAME STATE
   ========================================================= */
// State is provided by js/core/state.js in the modular architecture.
let state = window.__AETHERIA_STATE__ || {};

let storyIndex = 0;
let activeSlot = null;

/* =========================================================
   03. DOM REFERENCES
   ========================================================= */
const $ = (id) => document.getElementById(id);

const screens = {
  title: $("title"),
  story: $("story"),
  creation: $("creation"),
  hub: $("hub")
};

/* =========================================================
   STORY DATA
   ========================================================= */
const STORY = [
  "THE WORLD HAS ALREADY ENDED.",

  "Aetheria was once a world of kingdoms, magic, and countless races.\nHumans. Elves. Dwarves. Beastfolk. Dragonkin. Demons. Merfolk.",

  "But everything changed.",

  "For thousands of years, Nythar, the Dark God, remained sealed away.\nThen the Cult of Eternal Night broke the seal.",

  "Reality collapsed. Cities fell. Kingdoms disappeared. Forests died.\nAETHERIA FELL.",

  "Then a tower appeared.\n\nTHE TOWER OF REBIRTH\n\n100 FLOORS.\n\nThe only known path toward Nythar.",

  "The Game Master System selected someone.\n\nYOU.\n\nTHE MASTER.",

  "You have no army. No kingdom. No legendary weapon.\nBut you have one final opportunity.\nClimb the Tower. Gather survivors. Discover the truth. Defeat Nythar.",

  "THE PACT\n\nReach Floor 100.\nDefeat Nythar.\nFulfill the pact.\n\nThen, perhaps, Aetheria can be reborn."
];

/* =========================================================
   04. SCREEN NAVIGATION
   ========================================================= */
function showScreen(screenName) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
  });

  if (!screens[screenName]) {
    console.warn(`Unknown screen: ${screenName}`);
    return;
  }

  screens[screenName].classList.add("active");
  state.currentScreen = screenName;

  if (screenName === "hub") {
    renderHub("overview");
  }
}

/* =========================================================
   MASTER RANK SYSTEM
   ---------------------------------------------------------
   Floor 0–9   = F
   Floor 10–19 = E
   ...
   ========================================================= */
function getMasterRank(floor) {
  const ranks = [
    "F-Rank",
    "E-Rank",
    "D-Rank",
    "C-Rank",
    "B-Rank",
    "A-Rank",
    "S-Rank",
    "SS-Rank",
    "SSS-Rank",
    "EX-Rank",
    "God-Rank"
  ];

  const index = Math.min(
    ranks.length - 1,
    Math.floor(floor / 10)
  );

  return ranks[index];
}

/* =========================================================
   05. SAVE / LOAD STORAGE CORE — V0.0.9
   ---------------------------------------------------------
   The old unified Load/Save manager has been removed.
   Save and Load now use independent public managers while
   sharing only this small storage adapter for persistence.
   ========================================================= */
const SaveStorage = (() => {
  const emptySlots = () => {
    const slots = {};
    for (let i = 1; i <= CONFIG.MAX_SAVE_SLOTS; i++) slots[i] = null;
    return slots;
  };

  function read() {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return emptySlots();
    try {
      const parsed = JSON.parse(raw);
      const slots = emptySlots();
      for (let i = 1; i <= CONFIG.MAX_SAVE_SLOTS; i++) {
        slots[i] = parsed && parsed[i] ? parsed[i] : null;
      }
      return slots;
    } catch (error) {
      console.error('AETHERIA save storage is invalid:', error);
      return emptySlots();
    }
  }

  function write(slots) {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(slots));
  }

  function get(slot) {
    return read()[Number(slot)] || null;
  }

  function put(slot, snapshot) {
    const slots = read();
    slots[Number(slot)] = structuredClone(snapshot);
    write(slots);
  }

  function remove(slot) {
    const slots = read();
    if (!slots[Number(slot)]) return false;
    slots[Number(slot)] = null;
    write(slots);
    return true;
  }

  return { read, write, get, put, remove };
})();

function formatSaveDate(value) {
  if (!value) return 'EMPTY';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildSaveSnapshot() {
  state = normalizeGameState(state);
  const snapshot = structuredClone(state);
  snapshot.version = CONFIG.VERSION;
  snapshot.masterRank = getMasterRank(snapshot.highestFloor);
  snapshot.lastSaved = new Date().toISOString();
  return snapshot;
}

/* =========================================================
   05A. SAVE GAME MANAGER — INDEPENDENT SYSTEM
   ========================================================= */
const SaveGameManager = {
  open() {
    this.render();
    openModal('SAVE GAME', $('saveManagerTemplate').innerHTML);
  },

  render() {
    const slots = SaveStorage.read();
    const markup = Array.from({ length: CONFIG.MAX_SAVE_SLOTS }, (_, i) => {
      const slot = i + 1;
      const data = slots[slot];
      return this.slot(slot, data);
    }).join('');

    $('saveManagerTemplate').innerHTML = `
      <div class="save-manager">
        <div class="save-manager-intro">
          <b>SAVE GAME MANAGEMENT</b>
          <span>Create a new save or overwrite an existing slot. Your current game state is stored exactly as shown.</span>
        </div>
        <div class="save-slot-grid">${markup}</div>
      </div>
    `;
  },

  slot(slot, data) {
    const filled = Boolean(data);
    const name = filled ? (data.masterName || 'UNKNOWN') : 'EMPTY';
    const id = filled ? (data.masterId || 'UNKNOWN') : 'EMPTY';
    const rank = filled ? (data.masterRank || getMasterRank(Number(data.highestFloor) || 0)) : 'EMPTY';
    const floor = filled ? `Floor ${Number(data.highestFloor) || 0} / ${CONFIG.MAX_TOWER_FLOOR}` : 'EMPTY';
    const saved = filled ? formatSaveDate(data.lastSaved) : 'EMPTY';

    return `
      <div class="save-slot ${filled ? 'filled' : 'empty'}">
        <div class="save-slot-head">
          <div><small>SAVE SLOT</small><strong>SLOT ${String(slot).padStart(2, '0')}</strong></div>
          <span class="slot-state ${filled ? 'used' : 'free'}">${filled ? 'USED' : 'EMPTY'}</span>
        </div>
        <div class="save-meta">
          <div><span>Master Name</span><b>${escapeHtml(name)}</b></div>
          <div><span>Master ID</span><b>${escapeHtml(id)}</b></div>
          <div><span>Master Rank</span><b>${escapeHtml(rank)}</b></div>
          <div><span>Tower Floor</span><b>${escapeHtml(floor)}</b></div>
          <div class="save-date"><span>Last Saved</span><b>${escapeHtml(saved)}</b></div>
        </div>
        <div class="save-slot-actions">
          <button class="btn primary" data-v02-save="${slot}">${filled ? 'SAVE / OVERWRITE' : 'SAVE GAME'}</button>
          <button class="btn danger" data-v02-delete="${slot}" ${filled ? '' : 'disabled'}>DELETE</button>
        </div>
      </div>
    `;
  },

  save(slot) {
    SaveStorage.put(slot, buildSaveSnapshot());
    activeSlot = Number(slot);
    this.open();
  },

  confirmDelete(slot) {
    const data = SaveStorage.get(slot);
    if (!data) return;
    const ok = window.confirm(`Delete Save Slot ${slot}?\n\n${data.masterName || 'UNKNOWN'}\n${data.masterId || 'UNKNOWN'}\nFloor ${Number(data.highestFloor) || 0}\n\nThis action cannot be undone.`);
    if (!ok) return;
    if (SaveStorage.remove(slot) && activeSlot === Number(slot)) activeSlot = null;
    this.open();
  }
};

/* =========================================================
   05B. LOAD GAME MANAGER — INDEPENDENT SYSTEM
   ========================================================= */
const LoadGameManager = {
  open() {
    this.render();
    openModal('LOAD GAME', $('loadManagerTemplate').innerHTML);
  },

  render() {
    const slots = SaveStorage.read();
    const markup = Array.from({ length: CONFIG.MAX_SAVE_SLOTS }, (_, i) => {
      const slot = i + 1;
      return this.slot(slot, slots[slot]);
    }).join('');

    $('loadManagerTemplate').innerHTML = `
      <div class="save-manager">
        <div class="save-manager-intro">
          <b>LOAD GAME MANAGEMENT</b>
          <span>Select a saved slot to restore the complete game state.</span>
        </div>
        <div class="save-slot-grid">${markup}</div>
      </div>
    `;
  },

  slot(slot, data) {
    const filled = Boolean(data);
    const name = filled ? (data.masterName || 'UNKNOWN') : 'EMPTY';
    const id = filled ? (data.masterId || 'UNKNOWN') : 'EMPTY';
    const rank = filled ? (data.masterRank || getMasterRank(Number(data.highestFloor) || 0)) : 'EMPTY';
    const floor = filled ? `Floor ${Number(data.highestFloor) || 0} / ${CONFIG.MAX_TOWER_FLOOR}` : 'EMPTY';
    const saved = filled ? formatSaveDate(data.lastSaved) : 'EMPTY';

    return `
      <div class="save-slot ${filled ? 'filled' : 'empty'}">
        <div class="save-slot-head">
          <div><small>LOAD SLOT</small><strong>SLOT ${String(slot).padStart(2, '0')}</strong></div>
          <span class="slot-state ${filled ? 'used' : 'free'}">${filled ? 'READY' : 'EMPTY'}</span>
        </div>
        <div class="save-meta">
          <div><span>Master Name</span><b>${escapeHtml(name)}</b></div>
          <div><span>Master ID</span><b>${escapeHtml(id)}</b></div>
          <div><span>Master Rank</span><b>${escapeHtml(rank)}</b></div>
          <div><span>Tower Floor</span><b>${escapeHtml(floor)}</b></div>
          <div class="save-date"><span>Last Saved</span><b>${escapeHtml(saved)}</b></div>
        </div>
        <div class="save-slot-actions">
          <button class="btn primary" data-v02-load="${slot}" ${filled ? '' : 'disabled'}>LOAD</button>
          <button class="btn danger" data-v02-load-delete="${slot}" ${filled ? '' : 'disabled'}>DELETE</button>
        </div>
      </div>
    `;
  },

  load(slot) {
    const data = SaveStorage.get(slot);
    if (!data) return false;
    state = normalizeGameState(data);
    state.masterRank = getMasterRank(Number(state.highestFloor) || 0);
    activeSlot = Number(slot);
    closeModal();
    showScreen('hub');
    renderHub('overview');
    return true;
  },

  confirmDelete(slot) {
    const data = SaveStorage.get(slot);
    if (!data) return;
    const ok = window.confirm(`Delete Save Slot ${slot}?\n\n${data.masterName || 'UNKNOWN'}\n${data.masterId || 'UNKNOWN'}\nFloor ${Number(data.highestFloor) || 0}\n\nThis action cannot be undone.`);
    if (!ok) return;
    SaveStorage.remove(slot);
    this.open();
  }
};

/* =========================================================
   06. MASTER / HERO HELPERS
   ========================================================= */
/* HERO_RACE_DATABASE moved to js/data/. */

/* HERO_STAR_DATABASE moved to js/data/. */


/* HERO_ROLE_DATABASE moved to js/data/. */


/* HERO_AGE_DATABASE moved to js/data/. */


/* HERO_ELEMENTS moved to js/data/. */


/* HERO_FACTIONS moved to js/data/. */


/* HERO_ROLE_SKILLS moved to js/data/. */



/* HERO_GENERATION_DEFAULTS moved to js/data/. */


function rngInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function rngPick(list) { return list[Math.floor(Math.random() * list.length)]; }

/**
 * Weighted hero faction picker.
 * "Ordinary Person" has a 70% chance to be selected.
 * The remaining 30% is distributed uniformly across all other factions.
 */
function pickHeroFaction() {
  if (Math.random() < 0.7) {
    return "Ordinary Person";
  }

  const otherFactions = HERO_FACTIONS.filter(faction => faction.name !== "Ordinary Person");
  return rngPick(otherFactions).name;
}

function weightedPick(table) {
  const total = Object.values(table).reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = Math.random() * total;
  for (const [key, entry] of Object.entries(table)) { roll -= Number(entry.weight || 0); if (roll < 0) return key; }
  return Object.keys(table)[Object.keys(table).length - 1];
}
function weightedStar() { return Number(weightedPick(HERO_STAR_DATABASE)); }
function getAgeCategory(age, race) {
  const span = race.ageMax - race.ageMin || 1;
  const ratio = (age - race.ageMin) / span;
  if (ratio <= HERO_AGE_DATABASE.Young.maxRatio) return 'Young';
  if (ratio <= HERO_AGE_DATABASE.Middle.maxRatio) return 'Middle';
  return 'Old';
}
function generateRaceName(raceName) {
  const race = HERO_RACE_DATABASE[raceName];
  const fallback = {
    Human:['Arven','Selene','Marek','Liora','Ronan','Elira','Kaelen','Serin'],
    Elf:['Aelwyn','Sylriel','Elaris','Faelion','Lyrieth','Eirwen','Thaliel','Ilyria'],
    Dwarf:['Brondor','Kharum','Durgan','Thrain','Gorim','Bromar','Dorin','Kragin'],
    Beastfolk:['Kairen','Mirako','Talira','Rakumi','Veyra','Nayomi','Sairen','Rinako'],
    Dragonkin:['Vaelor','Rhaelys','Zyrion','Kaelith','Azhara','Nyrion','Vyrak','Drakon']
  }[raceName] || ['Aether'];
  for (let attempt = 0; attempt < 20; attempt++) {
    let name = rngPick(race.prefixes) + rngPick(race.syllables) + rngPick(race.suffixes);
    name = name.replace(/[^A-Za-z]/g, '');
    if (name.length >= 5 && name.length <= 8) return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return rngPick(fallback);
}
function rollBaseStat(stat) { const range = HERO_GENERATION_DEFAULTS.baseStats[stat]; return rngInt(range[0], range[1]); }
function getFactionBonusObject(factionName) {
  const text = HERO_FACTIONS.find(f => f.name === factionName)?.bonus || '';
  const bonus = { hp:0, atk:0, def:0, spd:0, critRate:0, critDamage:0, evasion:0, resistance:0 };
  const m = text.match(/([+-]?\\d+)%\\s*(HP|ATK|DEF|SPD|Crit Rate|Crit Damage|Evasion|Resistance)/gi) || [];
  m.forEach(part => { const n = Number(part.match(/[+-]?\\d+/)?.[0] || 0); const key = part.toLowerCase(); if(key.includes('hp')) bonus.hp += n; else if(key.includes('atk')) bonus.atk += n; else if(key.includes('def')) bonus.def += n; else if(key.includes('spd')) bonus.spd += n; else if(key.includes('crit rate')) bonus.critRate += n; else if(key.includes('crit damage')) bonus.critDamage += n; else if(key.includes('evasion')) bonus.evasion += n; else if(key.includes('resistance')) bonus.resistance += n; });
  return bonus;
}
function pickUniqueSkills(pool, count) {
  const source = Array.isArray(pool) ? pool.slice() : [];
  const result = [];
  while (source.length && result.length < count) {
    const index = rngInt(0, source.length - 1);
    result.push(source.splice(index, 1)[0]);
  }
  return result;
}

function rollHeroSkillSet(star, skills) {
  const basic = pickUniqueSkills(skills.basic, 1);
  const traits = pickUniqueSkills(skills.traits, 1);
  const addBasic = () => basic.push(...pickUniqueSkills(skills.basic.filter(s => !basic.includes(s)), 1));
  const addTrait = () => traits.push(...pickUniqueSkills(skills.traits.filter(s => !traits.includes(s)), 1));

  if (star <= 2) {
    if (Math.random() < 0.25) addBasic();
  } else if (star <= 4) {
    if (Math.random() < 0.30) {
      addBasic();
      if (Math.random() < 0.40) addBasic();
    }
  } else {
    if (Math.random() < 0.50) {
      addBasic();
      if (Math.random() < 0.50) {
        addBasic();
        if (Math.random() < 0.50) addBasic();
      }
    }
  }

  if (star <= 2) {
    if (Math.random() < 0.25) addTrait();
  } else if (star <= 4) {
    if (Math.random() < 0.30) {
      addTrait();
      if (Math.random() < 0.40) addTrait();
    }
  } else {
    if (Math.random() < 0.50) {
      addTrait();
      if (Math.random() < 0.50) {
        addTrait();
        if (Math.random() < 0.50) addTrait();
      }
    }
  }

  return { basic, ultimate: star <= 3 ? null : rngPick(skills.ultimate), traits };
}

/* =========================================================
   HERO PROGRESSION CORE — UPDATE 0.1.6
   ---------------------------------------------------------
   All future EXP rewards must enter through distributeHeroExp()
   or distributePartyExp(). Level caps are enforced by star tier.
   EXP required for the next level follows:
     floor(100 * level^1.4)
   ========================================================= */
function getHeroMaxLevel(star) {
  const safeStar = Math.max(1, Math.min(6, Number(star) || 1));
  return CONFIG.HERO_LEVEL_CAPS[safeStar] || 20;
}

function getHeroExpRequired(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor(CONFIG.HERO_EXP_BASE * Math.pow(safeLevel, CONFIG.HERO_EXP_POWER));
}

function getHeroAgeGrowthMultiplier(hero) {
  const key = hero?.ageCategory === 'Middle-aged / Veteran' ? 'Middle' : hero?.ageCategory === 'Old / Master' ? 'Old' : (hero?.ageCategory || 'Young');
  return Number(HERO_AGE_DATABASE[key]?.growth || 1);
}

function getHeroStatAtLevel(hero, stat, targetLevel = hero.level) {
  const race = HERO_RACE_DATABASE[hero.race];
  const role = HERO_ROLE_DATABASE[hero.role];
  const starData = HERO_STAR_DATABASE[Math.max(1, Math.min(6, Number(hero.star) || 1))] || HERO_STAR_DATABASE[1];
  const ageKey = hero.ageCategory === 'Middle-aged / Veteran' ? 'Middle' : hero.ageCategory === 'Old / Master' ? 'Old' : (hero.ageCategory || 'Young');
  const ageData = HERO_AGE_DATABASE[ageKey] || HERO_AGE_DATABASE.Young;
  const factionBonus = hero.factionBonus || getFactionBonusObject(hero.faction);
  const base = Number(hero.baseStats?.[stat] || hero.primaryStats?.[stat] || hero[stat.toLowerCase()] || 1);
  const raceMult = Number(race?.multipliers?.[stat] || 1);
  const roleMult = Number(role?.[stat.toLowerCase()] || 1);
  const starMult = Number(starData?.multiplier || 1);
  const ageInitial = Number(ageData.initial || 1);
  const growth = Number(hero.growth?.[stat] || ageData.growth || 1);
  const level = Math.max(1, Math.min(getHeroMaxLevel(hero.star), Math.floor(Number(targetLevel) || 1)));

  const levelOne = base * raceMult * roleMult * starMult * ageInitial;
  let growthTotal = 0;
  for (let lv = 2; lv <= level; lv++) growthTotal += (0.055 * growth * Math.pow(lv - 1, 0.40));
  const factionPct = Number(factionBonus?.[stat.toLowerCase()] || 0) / 100;
  return Math.max(1, Math.round(levelOne * (1 + growthTotal) * (1 + factionPct)));
}

function recalculateHeroProgressionStats(hero) {
  if (!hero) return;
  const oldMaxHp = Math.max(1, Number(hero.maxHp || hero.primaryStats?.HP || 1));
  const oldHpRatio = Math.max(0, Math.min(1, Number(hero.hp ?? oldMaxHp) / oldMaxHp));
  const primary = hero.primaryStats || (hero.primaryStats = {});
  ['HP','ATK','DEF','SPD'].forEach(stat => {
    const value = getHeroStatAtLevel(hero, stat, hero.level);
    primary[stat] = value;
    hero[stat.toLowerCase()] = value;
  });
  hero.maxHp = primary.HP;
  hero.hp = Math.max(0, Math.min(hero.maxHp, Math.round(hero.maxHp * oldHpRatio)));
  if (Number(hero.level) === 1 && oldMaxHp === primary.HP) hero.hp = primary.HP;
  hero.rarity = (HERO_STAR_DATABASE[hero.star] || HERO_STAR_DATABASE[1]).label;
}

function normalizeHeroProgression(hero) {
  if (!hero) return hero;
  hero.star = Math.max(1, Math.min(6, Math.floor(Number(hero.star) || 1)));
  hero.level = Math.max(1, Math.min(getHeroMaxLevel(hero.star), Math.floor(Number(hero.level) || 1)));
  hero.experience = Math.max(0, Math.floor(Number(hero.experience) || 0));
  if (!hero.growth) {
    const ageKey = hero.ageCategory === 'Middle-aged / Veteran' ? 'Middle' : hero.ageCategory === 'Old / Master' ? 'Old' : (hero.ageCategory || 'Young');
    const ageGrowth = HERO_AGE_DATABASE[ageKey]?.growth || 1;
    hero.growth = { HP:ageGrowth, ATK:ageGrowth, DEF:ageGrowth, SPD:ageGrowth };
  }
  if (!hero.factionBonus) hero.factionBonus = getFactionBonusObject(hero.faction);
  if (!hero.primaryStats) hero.primaryStats = { HP:hero.hp || 1, ATK:hero.atk || 1, DEF:hero.def || 1, SPD:hero.spd || 1 };
  recalculateHeroProgressionStats(hero);
  if (hero.star >= 4 && !hero.skills?.ultimate) {
    const pool = HERO_ROLE_SKILLS[hero.role]?.ultimate || [];
    hero.skills = hero.skills || {basic:[],traits:[],ultimate:null};
    hero.skills.ultimate = pool.length ? rngPick(pool) : null;
  }
  if (hero.star < 4 && hero.skills) hero.skills.ultimate = null;
  return hero;
}

function distributeHeroExp(heroId, amount, source = 'SYSTEM') {
  const hero = state.heroes.find(h => h.id === heroId);
  const requested = Math.max(0, Math.floor(Number(amount) || 0));
  if (!hero) return { success:false, reason:'HERO_NOT_FOUND', heroId, requested };
  if (requested <= 0) return { success:false, reason:'INVALID_EXP', heroId, requested };
  normalizeHeroProgression(hero);
  const cap = getHeroMaxLevel(hero.star);
  const before = { level:hero.level, experience:hero.experience };
  let remaining = requested;
  let levelsGained = 0;
  while (remaining > 0 && hero.level < cap) {
    const required = getHeroExpRequired(hero.level);
    const needed = Math.max(0, required - hero.experience);
    const add = Math.min(remaining, needed);
    hero.experience += add;
    remaining -= add;
    if (hero.experience >= required && hero.level < cap) {
      hero.experience -= required;
      hero.level += 1;
      levelsGained += 1;
      recalculateHeroProgressionStats(hero);
    } else break;
  }
  if (hero.level >= cap) {
    hero.level = cap;
    hero.experience = 0;
  }
  recalculateHeroProgressionStats(hero);
  const result = { success:true, heroId, source, requested, applied:requested - remaining, remaining, levelsGained, before, after:{level:hero.level, experience:hero.experience, maxLevel:cap} };
  fairySay(`${hero.name} gained ${result.applied.toLocaleString()} EXP from ${source}.`);
  return result;
}

function distributePartyExp(partyId, amount, source = 'SYSTEM') {
  const party = getPartyById(partyId);
  const ids = party ? partyHeroIds(party) : [];
  if (!ids.length) return { success:false, reason:'PARTY_EMPTY', partyId, requested:Number(amount)||0, results:[] };
  const total = Math.max(0, Math.floor(Number(amount) || 0));
  const perHero = Math.floor(total / ids.length);
  const remainder = total - perHero * ids.length;
  const results = ids.map((id, i) => distributeHeroExp(id, perHero + (i === 0 ? remainder : 0), source));
  return { success:true, partyId, requested:total, perHero, results };
}

/* HERO_PROMOTION_REQUIREMENTS moved to js/data/. */


function getInventoryMaterialQuantity(itemId) {
  ensureInventoryState014(state);
  return state.materials.filter(x => x.itemId === itemId).reduce((sum,x) => sum + Number(x.quantity || 0), 0);
}

function consumeInventoryMaterial(itemId, quantity) {
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0));
  if (getInventoryMaterialQuantity(itemId) < remaining) return false;
  for (const stack of state.materials) {
    if (stack.itemId !== itemId || remaining <= 0) continue;
    const take = Math.min(remaining, Number(stack.quantity || 0));
    stack.quantity -= take;
    remaining -= take;
  }
  state.materials = state.materials.filter(x => Number(x.quantity || 0) > 0);
  return remaining === 0;
}

function getHeroPromotionStatus(hero) {
  if (!hero) return { canPromote:false, reason:'HERO_NOT_FOUND' };
  const current = Math.floor(Number(hero.star) || 1);
  const req = HERO_PROMOTION_REQUIREMENTS[current];
  if (!req) return { canPromote:false, reason:'MAX_STAR', message:'This hero is already at the maximum 6★ tier.' };
  const riftHave = getInventoryMaterialQuantity(req.riftId);
  const exploreHave = getInventoryMaterialQuantity(req.exploreId);
  const goldHave = Number(state.gold || 0);
  const missing = [];
  if (riftHave < req.riftQty) missing.push(`${req.riftName} ${riftHave}/${req.riftQty}`);
  if (exploreHave < req.exploreQty) missing.push(`${req.exploreName} ${exploreHave}/${req.exploreQty}`);
  if (goldHave < req.gold) missing.push(`Gold ${goldHave.toLocaleString()}/${req.gold.toLocaleString()}`);
  return { canPromote:missing.length===0, reason:missing.length?'INSUFFICIENT_RESOURCES':'READY', requirement:req, missing, riftHave, exploreHave, goldHave };
}

function promoteHero(heroId) {
  const hero = state.heroes.find(h => h.id === heroId);
  const status = getHeroPromotionStatus(hero);
  if (!status.canPromote) return status;
  const req = status.requirement;
  const oldMaxHp = Math.max(1, Number(hero.maxHp || 1));
  const hpRatio = Math.max(0, Math.min(1, Number(hero.hp ?? oldMaxHp) / oldMaxHp));
  consumeInventoryMaterial(req.riftId, req.riftQty);
  consumeInventoryMaterial(req.exploreId, req.exploreQty);
  state.gold -= req.gold;
  hero.star = req.target;
  hero.rarity = (HERO_STAR_DATABASE[hero.star] || HERO_STAR_DATABASE[6]).label;
  if (hero.star >= 4 && !hero.skills?.ultimate) {
    hero.skills = hero.skills || {basic:[],traits:[],ultimate:null};
    hero.skills.ultimate = rngPick(HERO_ROLE_SKILLS[hero.role]?.ultimate || []);
  }
  recalculateHeroProgressionStats(hero);
  hero.hp = Math.max(1, Math.min(hero.maxHp, Math.round(hero.maxHp * hpRatio)));
  fairySay(`${hero.name} promoted to ${hero.star}★. Level cap expanded to ${getHeroMaxLevel(hero.star)}.`);
  return { success:true, heroId, newStar:hero.star, maxLevel:getHeroMaxLevel(hero.star), goldSpent:req.gold, requirement:req };
}

function generateHero(options = {}) {
  const raceName = options.race || rngPick(Object.keys(HERO_RACE_DATABASE));
  const race = HERO_RACE_DATABASE[raceName];
  const role = options.role || rngPick(Object.keys(HERO_ROLE_DATABASE));
  const star = options.star || weightedStar();
  const starData = HERO_STAR_DATABASE[star];
  const roleData = HERO_ROLE_DATABASE[role];
  const age = options.age || rngInt(race.ageMin, race.ageMax);
  const ageCategory = getAgeCategory(age, race);
  const ageData = HERO_AGE_DATABASE[ageCategory];
  const faction = options.faction || pickHeroFaction();
  const element = options.element || rngPick(HERO_ELEMENTS);
  const skills = HERO_ROLE_SKILLS[role];
  const skillSet = rollHeroSkillSet(star, skills);
  const factionBonus = getFactionBonusObject(faction);
  const base = { HP:rollBaseStat('HP'), ATK:rollBaseStat('ATK'), DEF:rollBaseStat('DEF'), SPD:rollBaseStat('SPD') };
  const primary = {};
  for (const stat of ['HP','ATK','DEF','SPD']) {
    const roleMult = roleData[stat.toLowerCase()];
    const value = base[stat] * race.multipliers[stat] * roleMult * starData.multiplier * ageData.initial;
    primary[stat] = Math.max(1, Math.round(value * (1 + (factionBonus[stat.toLowerCase()] || 0) / 100)));
  }
  const secondary = {
    critRate: Math.min(100, +(HERO_GENERATION_DEFAULTS.critRate + roleData.critRate + (star - 1) * 1.5 + factionBonus.critRate).toFixed(2)),
    critDamage: +(HERO_GENERATION_DEFAULTS.critDamage + (star - 1) * 5 + factionBonus.critDamage).toFixed(2),
    evasion: Math.min(75, +(HERO_GENERATION_DEFAULTS.evasion + roleData.evasion + (ageCategory === 'Young' ? 2 : 0) + factionBonus.evasion).toFixed(2)),
    resistance: Math.min(90, +(HERO_GENERATION_DEFAULTS.resistance + roleData.resistance + (ageCategory === 'Old' ? 3 : 0) + factionBonus.resistance).toFixed(2))
  };
  const growth = {};
  for (const stat of ['HP','ATK','DEF','SPD']) growth[stat] = +(ageData.growth * (0.96 + Math.random() * 0.12)).toFixed(3);
  const id = 'HERO-' + Date.now().toString(36).toUpperCase() + '-' + rngInt(100,999);
  const name = options.name || generateRaceName(raceName);
  return {
    id, name, role, star, rarity:starData.label, status:options.status || 'AVAILABLE', level:1, experience:0,
    age, ageCategory, race:raceName, faction, factionBonus, element,
    baseStats:base, primaryStats:primary, growth,
    hp:primary.HP, maxHp:primary.HP, atk:primary.ATK, def:primary.DEF, spd:primary.SPD,
    critRate:secondary.critRate, critDamage:secondary.critDamage, evasion:secondary.evasion, resistance:secondary.resistance,
    secondaryStats:secondary,
    skills:{ basic:skillSet.basic, ultimate:skillSet.ultimate, traits:skillSet.traits }, equipment:[], condition:'Healthy', generatedAt:new Date().toISOString()
  };
}
function normalizeHero(hero) {
  if (!hero || typeof hero !== 'object') return generateHero();
  const star = Number(hero.star || 1);
  const normalized = structuredClone(hero);
  if (normalized.primaryStats && normalized.secondaryStats && normalized.race && normalized.faction && normalized.skills && !Array.isArray(normalized.skills)) {
    const skill = normalized.skills || {};
    normalized.skills = {
      basic: Array.isArray(skill.basic) ? skill.basic : (skill.basic ? [skill.basic] : []),
      ultimate: star <= 3 ? null : (skill.ultimate || null),
      traits: Array.isArray(skill.traits) ? skill.traits : (skill.traits ? [skill.traits] : (skill.trait ? [skill.trait] : []))
    };
    return normalizeHeroProgression(normalized);
  }
  const legacy = { ...hero };
  const generated = generateHero({ name:legacy.name || undefined, role:HERO_ROLE_DATABASE[legacy.role] ? legacy.role : undefined, star:star >= 1 && star <= 5 ? star : undefined, element:legacy.element && HERO_ELEMENTS.includes(legacy.element) ? legacy.element : undefined, status:legacy.status || 'AVAILABLE' });
  const legacySkills = legacy.skills || {};
  const migrated = { ...generated, ...legacy,
    primaryStats:legacy.primaryStats || generated.primaryStats,
    secondaryStats:legacy.secondaryStats || generated.secondaryStats,
    race:legacy.race || generated.race,
    age:legacy.age || generated.age,
    ageCategory:legacy.ageCategory || generated.ageCategory,
    faction:legacy.faction || generated.faction,
    growth:legacy.growth || generated.growth,
    skills:{
      basic:Array.isArray(legacySkills.basic) ? legacySkills.basic : (legacySkills.basic ? [legacySkills.basic] : generated.skills.basic),
      ultimate:star <= 3 ? null : (legacySkills.ultimate || generated.skills.ultimate || null),
      traits:Array.isArray(legacySkills.traits) ? legacySkills.traits : (legacySkills.traits ? [legacySkills.traits] : (legacySkills.trait ? [legacySkills.trait] : generated.skills.traits))
    },
    maxHp:legacy.maxHp || generated.maxHp, hp:legacy.hp || generated.hp, atk:legacy.atk || generated.atk, def:legacy.def || generated.def, spd:legacy.spd || generated.spd,
    critRate:legacy.critRate ?? generated.critRate, critDamage:legacy.critDamage ?? generated.critDamage, evasion:legacy.evasion ?? generated.evasion, resistance:legacy.resistance ?? generated.resistance
  };
  return normalizeHeroProgression(migrated);
}
function normalizeParty(party, fallbackIndex = 1) {
  const id = String(party?.id || `PARTY-${String(fallbackIndex).padStart(3, "0")}`).toUpperCase();
  const safeId = /^PARTY-\d{3}$/.test(id) ? id : `PARTY-${String(fallbackIndex).padStart(3, "0")}`;
  const front = Array.isArray(party?.slots?.front) ? party.slots.front : (Array.isArray(party?.front) ? party.front : []);
  const back = Array.isArray(party?.slots?.back) ? party.slots.back : (Array.isArray(party?.back) ? party.back : []);
  return {
    id: safeId,
    name: String(party?.name || `Party ${fallbackIndex}`).slice(0, 20),
    slots: {
      front: [front[0] || null, front[1] || null, front[2] || null],
      back: [back[0] || null, back[1] || null]
    }
  };
}

function normalizeParties(dataParties) {
  const source = Array.isArray(dataParties) ? dataParties : [];
  // Legacy v0.1.2 stored parties as arrays. Preserve any hero IDs found in those arrays.
  const normalized = source.slice(0, 20).map((party, i) => {
    if (Array.isArray(party)) {
      return normalizeParty({ id:`PARTY-${String(i+1).padStart(3,"0")}`, name:`Party ${i+1}`, slots:{ front:party.slice(0,3), back:party.slice(3,5) } }, i+1);
    }
    return normalizeParty(party, i+1);
  });
  const used = new Set();
  return normalized.map((party) => {
    let id = /^PARTY-\d{3}$/.test(party.id) && !used.has(party.id) ? party.id : null;
    if (!id) {
      for (let n=1; n<=MAX_PARTIES; n++) {
        const candidate=`PARTY-${String(n).padStart(3,"0")}`;
        if (!used.has(candidate)) { id=candidate; break; }
      }
    }
    used.add(id);
    return { ...party, id };
  });
}

function normalizeGameState(data) {
  const base = createInitialState();
  const merged = { ...base, ...structuredClone(data || {}) };
  merged.town = { ...base.town, ...(data?.town || {}) };
  merged.fairy = { ...base.fairy, ...(data?.fairy || {}) };
  merged.heroes = Array.isArray(data?.heroes) ? data.heroes.map(normalizeHero) : [];
  merged.parties = normalizeParties(data?.parties);
  merged.activePartyId = merged.parties.some(p => p.id === data?.activePartyId) ? data.activePartyId : (merged.parties[0]?.id || null);
  merged.heroGeneration = { ...base.heroGeneration, ...(data?.heroGeneration || {}) };
  syncHeroPartyStatuses(merged);
  return merged;
}

/* Backward-compatible legacy constructor. New recruitment uses generateHero(). */
function createHero(id, name, role, star, status = "AVAILABLE") {
  const hero = generateHero({ name, role, star, status });
  hero.id = id || hero.id;
  return hero;
}

/* =========================================================
   07. FAIRY SYSTEM
   ========================================================= */
function fairySay(text) {
  $("fairyMini").textContent = text;
}

function getFairyText() {
  if (!state.heroes.length) {
    return "Master, we have no heroes yet. I won't recommend anyone until an AVAILABLE hero exists.";
  }

  if (state.town.fear > 70) {
    return "Master, the town is afraid. I recommend stabilizing it before taking unnecessary risks.";
  }

  return "The current state is stable. I will continue learning from your decisions.";
}

function getFairyStatus() {
  const warnings = [];

  if (state.gold < 500) {
    warnings.push("Gold is getting low.");
  }

  if (state.town.fear > 50) {
    warnings.push("Town Fear is elevated.");
  }

  if (!warnings.length) {
    warnings.push("No critical warning detected.");
  }

  return warnings.join(" ");
}

function getPartyStrength() {
  const party = getActiveParty();
  if (party) {
    const power = getPartyCombatPower(party);
    const deployed = partyHeroIds(party).length;
    if (!deployed) return "0%";
    return `${Math.min(99, Math.round(35 + power / 120))}%`;
  }
  const availableHeroes = state.heroes.filter(hero => hero.status === "AVAILABLE");
  if (!availableHeroes.length) return "0%";
  const rawStrength = 40 + availableHeroes.reduce((total, hero) => total + hero.star * 7 + hero.level, 0);
  return `${Math.min(99, rawStrength)}%`;
}

/* =========================================================
   08. HUB RENDERING
   ========================================================= */
function renderHub(page = "overview") {
  renderHubHeader();

  document
    .querySelectorAll(".nav [data-open]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.open === page
      );
    });

  const pages = {
    overview: renderOverviewPage(),
    status: renderStatusPage(),
    recruitment: renderRecruitmentPage(),
    heroes: renderHeroPage(),
    party: renderPartyPage(),
    inventory: renderInventoryPage(),
    town: renderTownPage(),
    dungeon: renderDungeonPage(),
    fairy: renderFairyPage()
  };

  $("content").innerHTML =
    pages[page] || pages.overview;
}

function renderHubHeader() {
  $("mName").textContent =
    state.masterName || "MASTER";

  $("mId").textContent =
    state.masterId || "MASTER-000000";

  $("mRank").textContent =
    getMasterRank(state.highestFloor);

  $("mFloor").textContent =
    `Floor ${state.highestFloor} / ${CONFIG.MAX_TOWER_FLOOR}`;

  $("mHeroes").textContent =
    state.heroes.length;

  $("mGold").textContent =
    state.gold.toLocaleString();

  $("mGems").textContent =
    state.gems.toLocaleString();

  $("topFloor").textContent =
    `${state.highestFloor} / ${CONFIG.MAX_TOWER_FLOOR}`;

  $("happiness").textContent =
    `${state.town.happiness}%`;

  $("fear").textContent =
    `${state.town.fear}%`;

  $("mood").textContent =
    state.fairy.mood;
}

/* =========================================================
   09. PAGE RENDERERS
   ========================================================= */
function renderOverviewPage() {
  return `
    <h2>Main Menu</h2>
    <div class="sub">
      Master command center — Update ${CONFIG.VERSION}
    </div>

    <div class="grid">
      ${createCommand(
        "status",
        "◈",
        "Master Status",
        "Rank, tower, economy, town condition and warnings."
      )}

      ${createCommand(
        "recruitment",
        "✦",
        "Recruitment Log",
        "Review recruitment history and let Fairy analyze trends."
      )}

      ${createCommand(
        "heroes",
        "♙",
        "Hero Roster",
        "Filter heroes by role, status and star."
      )}

      ${createCommand(
        "party",
        "⚔",
        "Party Management",
        "Build parties using AVAILABLE heroes only."
      )}

      ${createCommand(
        "inventory",
        "▣",
        "Inventory",
        "Equipment, materials and resource overview."
      )}

      ${createCommand(
        "town",
        "⌂",
        "Town Square",
        "Facilities, happiness, fear, recovery and Skip Day report."
      )}

      ${createCommand(
        "dungeon",
        "◇",
        "Dungeon",
        "Pre-battle analysis, risk assessment and battle reports."
      )}

      ${createCommand(
        "fairy",
        "✦",
        "Fairy AI",
        "Living companion memory, mood, trust and knowledge."
      )}
    </div>

    <div class="conf">
      <b>FAIRY ADVISORY</b><br>
      ${getFairyText()}<br>
      <small>Confidence: HIGH</small>
    </div>
  `;
}

function renderStatusPage() {
  return `
    <h2>Master Status</h2>

    <div class="sub">
      Current Game State is the source of truth.
    </div>

    <div class="info">
      ${createInfoItem(
        "Master Rank",
        getMasterRank(state.highestFloor)
      )}

      ${createInfoItem(
        "Tower Progress",
        `Floor ${state.highestFloor} / ${CONFIG.MAX_TOWER_FLOOR}`
      )}

      ${createInfoItem(
        "Gold",
        state.gold.toLocaleString()
      )}

      ${createInfoItem(
        "Gems",
        state.gems.toLocaleString()
      )}

      ${createInfoItem(
        "Tickets",
        state.tickets
      )}

      ${createInfoItem(
        "Special Tickets",
        state.specialTickets
      )}

      ${createInfoItem(
        "Hero Count",
        state.heroes.length
      )}

      ${createInfoItem(
        "Town Happiness",
        `${state.town.happiness}%`
      )}

      ${createInfoItem(
        "Town Fear",
        `${state.town.fear}%`
      )}

      ${createInfoItem(
        "Fairy Trust",
        state.fairy.trust
      )}
    </div>

    <div class="conf">
      <b>FAIRY ANALYSIS</b><br>
      ${getFairyStatus()}
    </div>
  `;
}

function renderRecruitmentPage() {
  const cards = [
    { id:'standard', name:'STANDARD RECRUITMENT', range:'★1–★3', costType:'gold', cost:10000, icon:'◈', description:'A reliable recruitment pool for common to rare heroes.', button:'RECRUIT // 10,000 GOLD' },
    { id:'premium', name:'PREMIUM RECRUITMENT', range:'★1–★4', costType:'gems', cost:300, icon:'✦', description:'An enhanced pool with access to Epic heroes.', button:'RECRUIT // 300 GEMS' },
    { id:'elite', name:'ELITE RECRUITMENT', range:'★2–★4', costType:'tickets', cost:1, icon:'◆', description:'A focused recruitment pool that excludes Common heroes.', button:'RECRUIT // 1 TICKET' },
    { id:'special', name:'SPECIAL RECRUITMENT', range:'★5 GUARANTEED', costType:'specialTickets', cost:1, icon:'★', description:'A guaranteed Legendary hero recruitment.', button:'RECRUIT // 1 SPECIAL TICKET' }
  ];
  const resourceLabels = { gold:'Gold', gems:'Gems', tickets:'Tickets', specialTickets:'Special Tickets' };
  const resourceValues = { gold:state.gold, gems:state.gems, tickets:state.tickets, specialTickets:state.specialTickets };
  const logs = state.recruitmentLog.length ? state.recruitmentLog.slice().reverse() : [];

  return `
    <h2>Recruitment Log</h2>
    <div class="sub">Recruitment Center — choose a card, pay the required resource, and receive a complete RNG Hero profile.</div>

    <div class="recruitment-resources">
      ${Object.keys(resourceLabels).map(key => `<div class="resource-box"><small>${resourceLabels[key].toUpperCase()}</small><b>${Number(resourceValues[key] || 0).toLocaleString()}</b></div>`).join('')}
    </div>

    <div class="recruitment-grid">
      ${cards.map(card => {
        const affordable = Number(resourceValues[card.costType] || 0) >= card.cost;
        return `
          <article class="recruit-card ${affordable ? '' : 'locked'}">
            <div class="recruit-card-icon">${card.icon}</div>
            <div class="recruit-card-head"><b>${card.name}</b><span>${card.range}</span></div>
            <p>${card.description}</p>
            <div class="recruit-card-cost">COST <strong>${Number(card.cost).toLocaleString()} ${resourceLabels[card.costType].toUpperCase()}</strong></div>
            <button class="btn primary" data-recruit="${card.id}" ${affordable ? '' : 'disabled'}>${affordable ? card.button : `INSUFFICIENT ${resourceLabels[card.costType].toUpperCase()}`}</button>
          </article>`;
      }).join('')}
    </div>

    <div class="recruitment-history">
      <h3>RECRUITMENT HISTORY</h3>
      ${logs.length ? logs.map(entry => `
        <div class="log-item">
          <strong>${escapeHtml(entry.type || 'RECRUITMENT')}</strong> · ${escapeHtml(entry.cost || '—')}<br>
          ${escapeHtml(entry.heroId || '—')} — ${escapeHtml(entry.name || 'Unknown Hero')} · ${escapeHtml(entry.race || '—')} · ${escapeHtml(entry.role || '—')} · ${escapeHtml(entry.star || '—')}<br>
          ${escapeHtml(entry.newDuplicate || 'NEW')} · ${escapeHtml(entry.result || 'SUCCESS')}
        </div>`).join('') : `<div class="conf">No recruitment history yet. Your first successful recruitment will appear here.</div>`}
    </div>

    <div class="conf">
      <b>FAIRY RECRUITMENT ANALYSIS</b><br>
      ${state.recruitmentLog.length ? 'Recruitment records are being tracked for star distribution, resource usage, and duplicate trends.' : 'No recruitment trend exists yet. I will begin learning from the first result.'}
    </div>
  `;
}

function getRecruitmentCardConfig(cardId) {
  const cards = {
    standard:{ id:'standard', type:'STANDARD RECRUITMENT', minStar:1, maxStar:3, costType:'gold', cost:10000, resourceLabel:'Gold' },
    premium:{ id:'premium', type:'PREMIUM RECRUITMENT', minStar:1, maxStar:4, costType:'gems', cost:300, resourceLabel:'Gems' },
    elite:{ id:'elite', type:'ELITE RECRUITMENT', minStar:2, maxStar:4, costType:'tickets', cost:1, resourceLabel:'Ticket' },
    special:{ id:'special', type:'SPECIAL RECRUITMENT', minStar:5, maxStar:5, costType:'specialTickets', cost:1, resourceLabel:'Special Ticket' }
  };
  return cards[cardId] || null;
}

function recruitHero(cardId) {
  const card = getRecruitmentCardConfig(cardId);
  if (!card) return;
  const available = Number(state[card.costType] || 0);
  if (available < card.cost) {
    fairySay(`Recruitment failed: insufficient ${card.resourceLabel}.`);
    openModal('RECRUITMENT FAILED', `<div class="confirm-box"><h3>INSUFFICIENT RESOURCE</h3><p>You need <b>${card.cost.toLocaleString()} ${escapeHtml(card.resourceLabel)}</b> to use ${escapeHtml(card.type)}.</p></div>`);
    return;
  }

  state[card.costType] = available - card.cost;
  const star = card.minStar === card.maxStar ? card.minStar : rngInt(card.minStar, card.maxStar);
  const hero = generateHero({ star });
  const duplicate = state.heroes.some(existing => existing.name === hero.name);
  state.heroes.push(hero);
  state.heroGeneration.totalGenerated = Number(state.heroGeneration.totalGenerated || 0) + 1;
  state.heroGeneration.lastGeneratedId = hero.id;
  state.heroGeneration.lastGeneratedAt = hero.generatedAt;
  state.recruitmentLog.push({
    type:card.type,
    cost:`${card.cost.toLocaleString()} ${card.resourceLabel}`,
    heroId:hero.id,
    name:hero.name,
    race:hero.race,
    role:hero.role,
    star:'★'.repeat(hero.star),
    result:'SUCCESS',
    newDuplicate:duplicate ? 'DUPLICATE NAME' : 'NEW',
    element:hero.element,
    faction:hero.faction
  });
  state.fairy.memory.push(`${card.type}: ${hero.name}, ${hero.race}, ${hero.role}, ★${hero.star}, ${hero.element}.`);
  state.fairy.knowledge = Math.min(999, Number(state.fairy.knowledge || 1) + 1);
  fairySay(`${hero.name} has joined Aetheria. ${hero.rarity} ${hero.race} ${hero.role}.`);

  openModal('RECRUITMENT RESULT', `
    <div class="hero-profile">
      <div class="hero-profile-title"><b>${escapeHtml(hero.name)}</b><span>${'★'.repeat(hero.star)} ${escapeHtml(hero.rarity)}</span></div>
      <div class="info">
        ${createInfoItem('Race', escapeHtml(hero.race))}${createInfoItem('Role', escapeHtml(hero.role))}
        ${createInfoItem('Element', escapeHtml(hero.element))}${createInfoItem('Faction', escapeHtml(hero.faction))}
        ${createInfoItem('Age', `${hero.age} — ${escapeHtml(hero.ageCategory)}`)}${createInfoItem('ID', escapeHtml(hero.id))}
      </div>
      <div class="conf"><b>PRIMARY STATS</b><br>HP ${hero.hp.toLocaleString()} · ATK ${hero.atk.toLocaleString()} · DEF ${hero.def.toLocaleString()} · SPD ${hero.spd.toLocaleString()}</div>
      <button class="btn primary" id="recruitResultClose">RETURN TO RECRUITMENT</button>
    </div>
  `);
  $("recruitResultClose").addEventListener('click', () => { closeModal(); renderHub('recruitment'); });
  saveCurrentGameSilently();
}

function saveCurrentGameSilently() {
  if (!state.masterName) return;
  try {
    if (activeSlot) SaveStorage.put(activeSlot, buildSaveSnapshot());
  } catch (error) {
    console.warn('AETHERIA silent recruitment save skipped:', error);
  }
}

function getHeroRosterFilters() {
  return {
    role: document.querySelector('.hero-filter-chip[data-filter-group="role"].on')?.dataset.value || 'ALL',
    status: document.querySelector('.hero-filter-chip[data-filter-group="status"].on')?.dataset.value || 'ALL',
    star: Number(document.querySelector('.hero-filter-chip[data-filter-group="star"].on')?.dataset.value || 0)
  };
}

function getHeroStatusList() {
  const statuses = [...new Set(state.heroes.map(hero => String(hero.status || 'AVAILABLE').toUpperCase()))];
  const preferred = ['AVAILABLE', 'BUSY'];
  return [...preferred.filter(status => statuses.includes(status)), ...statuses.filter(status => !preferred.includes(status)).sort()];
}

function renderHeroFilterChips(group, options, activeValue) {
  return options.map(option => {
    const value = String(option.value);
    const active = value === String(activeValue);
    return `<button type="button" class="hero-filter-chip ${active ? 'on' : ''}" data-filter-group="${group}" data-value="${escapeHtml(value)}">${escapeHtml(option.label)}</button>`;
  }).join('');
}

function renderHeroPage() {
  const filters = getHeroRosterFilters();
  const statusOptions = getHeroStatusList().map(status => ({ value: status, label: status }));
  const roleOptions = ['ALL','Tank','DPS','Mage','Support','Archer'].map(role => ({ value: role, label: role === 'ALL' ? 'ALL' : role }));
  const starOptions = [
    { value: 0, label: 'ALL' },
    ...Array.from({length:7}, (_, i) => ({ value:i+1, label:`${i+1}★` }))
  ];
  return `
    <div class="hero-roster-head">
      <div>
        <h2>Hero Roster</h2>
        <div class="sub">Manage recruited heroes, inspect complete profiles, and filter the roster instantly.</div>
      </div>
      <div class="hero-roster-count"><b>${state.heroes.length}</b><span>HEROES</span></div>
    </div>

    <div class="hero-filter-panel">
      <div class="hero-filter-group">
        <span class="hero-filter-label">ROLE</span>
        <div class="hero-filter-chips">${renderHeroFilterChips('role', roleOptions, filters.role)}</div>
      </div>
      <div class="hero-filter-group">
        <span class="hero-filter-label">STATUS</span>
        <div class="hero-filter-chips">${renderHeroFilterChips('status', [{value:'ALL',label:'ALL'}, ...statusOptions], filters.status)}</div>
      </div>
      <div class="hero-filter-group">
        <span class="hero-filter-label">STAR RATING</span>
        <div class="hero-filter-chips">${renderHeroFilterChips('star', starOptions, filters.star)}</div>
      </div>
    </div>

    <div id="heroList">${renderHeroRows()}</div>
  `;
}

function getHeroAvatarLetters(hero) {
  const name = String(hero?.name || 'Hero').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function getHeroStatusClass(status) {
  const value=String(status||'AVAILABLE').toUpperCase();
  if(value==='AVAILABLE') return 'available';
  if(value==='IN-PARTY') return 'in-party';
  return 'busy';
}

function getHeroRoleIcon(role) {
  return ({Tank:'🛡',DPS:'⚔',Mage:'✦',Support:'✚',Archer:'🏹'})[role] || '♙';
}
function renderHeroRows() {
  if (!state.heroes.length) return `<div class="hero-empty-state"><div class="hero-empty-icon">♙</div><b>NO HEROES RECRUITED</b><span>Visit Recruitment Log to recruit your first hero.</span></div>`;
  const filters=getHeroRosterFilters();
  const filtered=state.heroes.filter(hero=>{
    const role=String(hero.role||'Unknown'), status=String(hero.status||'AVAILABLE').toUpperCase(), star=Number(hero.star||1);
    return (filters.role==='ALL'||role===filters.role)&&(filters.status==='ALL'||status===filters.status)&&(!filters.star||star>=filters.star);
  });
  if(!filtered.length) return `<div class="hero-empty-state"><div class="hero-empty-icon">⌕</div><b>NO MATCHING HEROES</b><span>Try changing the role, status, or minimum star filter.</span></div>`;
  return `<div class="hero-card-grid">${filtered.map(hero=>{
    const star=Math.max(1,Number(hero.star||1)); const stars='★'.repeat(star); const status=String(hero.status||'AVAILABLE').toUpperCase();
    const hp=Number(hero.hp??hero.maxHp??hero.primaryStats?.HP??0),atk=Number(hero.atk??hero.primaryStats?.ATK??0),def=Number(hero.def??hero.primaryStats?.DEF??0),spd=Number(hero.spd??hero.primaryStats?.SPD??0);
    const party=findHeroParty(hero.id); const available= status==='AVAILABLE';
    return `<article class="hero-card" data-hero-id="${escapeHtml(hero.id)}">
      <div class="hero-card-top"><div class="hero-avatar"><span class="hero-role-icon">${getHeroRoleIcon(hero.role)}</span></div><div class="hero-card-heading"><div class="hero-card-stars">${stars}</div><span class="hero-status ${getHeroStatusClass(status)}">${escapeHtml(status)}</span></div></div>
      <div class="hero-card-name">${escapeHtml(hero.name||'Unnamed Hero')}</div><div class="hero-card-meta">${escapeHtml(hero.race||'Unknown')} <i>•</i> ${escapeHtml(hero.role||'Unknown')} <i>•</i> ${escapeHtml(hero.element||'Neutral')}</div><div class="hero-card-level">LEVEL ${Number(hero.level||1)} / ${getHeroMaxLevel(hero.star)}</div>
      <div class="hero-stat-grid"><div><small>HP</small><b>${hp.toLocaleString()}</b></div><div><small>ATK</small><b>${atk.toLocaleString()}</b></div><div><small>DEF</small><b>${def.toLocaleString()}</b></div><div><small>SPD</small><b>${spd.toLocaleString()}</b></div></div>
      ${party?`<div class="hero-quick-note">DEPLOYED IN ${escapeHtml(party.id)} · ${escapeHtml(party.name)}</div>`:''}
      <div class="hero-card-actions"><button type="button" class="btn" data-hero-profile="${escapeHtml(hero.id)}">VIEW PROFILE</button>${available?`<button type="button" class="btn primary" data-hero-quick-party="${escapeHtml(hero.id)}">ASSIGN TO ACTIVE PARTY</button>`:''}</div>
      <div class="hero-card-footer"><span>${escapeHtml(hero.id)}</span><strong>${party?'IN-PARTY':'AVAILABLE'}</strong></div>
    </article>`;
  }).join('')}</div>`;
}

function showHeroDetail(heroId) {
  const hero = state.heroes.find(h => h.id === heroId);
  if (!hero) return;
  normalizeHeroProgression(hero);
  const stars = '★'.repeat(Math.max(1, Math.min(6, Number(hero.star || 1))));
  const skill = hero.skills || {};
  const avatar = getHeroAvatarLetters(hero);
  const status = String(hero.status || 'AVAILABLE').toUpperCase();
  const primary = hero.primaryStats || {};
  const secondary = hero.secondaryStats || {};
  const cap = getHeroMaxLevel(hero.star);
  const required = hero.level < cap ? getHeroExpRequired(hero.level) : 0;
  const exp = hero.level < cap ? Number(hero.experience || 0) : 0;
  const expPct = required ? Math.min(100, Math.round(exp / required * 100)) : 100;
  const promotion = getHeroPromotionStatus(hero);
  const primaryValue = (key, fallback) => Number(primary[key] ?? fallback ?? 0).toLocaleString();
  const skillBasic = Array.isArray(skill.basic) ? skill.basic : (skill.basic ? [skill.basic] : []);
  const traits = Array.isArray(skill.traits) ? skill.traits : (skill.trait ? [skill.trait] : []);
  const factionBonus = HERO_FACTIONS.find(f => f.name === hero.faction)?.bonus || 'No faction bonus recorded.';
  const ageKey = hero.ageCategory === 'Middle-aged / Veteran' ? 'Middle' : hero.ageCategory === 'Old / Master' ? 'Old' : hero.ageCategory;
  const ageDescription = HERO_AGE_DATABASE[ageKey]?.description || 'Growth data available.';
  const promotionText = promotion.canPromote ? `PROMOTE TO ${promotion.requirement.target}★` : (promotion.reason === 'MAX_STAR' ? 'MAX STAR' : 'INSUFFICIENT MATERIALS');
  const promotionDisabled = promotion.canPromote ? '' : 'disabled';

  openModal(`HERO PROFILE // ${hero.name}`, `
    <div class="hero-profile-shell">
      <div class="hero-profile-banner">
        <div class="hero-profile-avatar">${escapeHtml(avatar)}</div>
        <div>
          <div class="hero-profile-name">${escapeHtml(hero.name || 'Unnamed Hero')}</div>
          <div class="hero-card-stars">${stars} <span style="color:var(--muted);">${escapeHtml(hero.rarity || '')}</span></div>
          <div class="hero-profile-meta">${escapeHtml(hero.race || 'Unknown')} • ${escapeHtml(hero.role || 'Unknown')} • ${escapeHtml(hero.element || 'Neutral')} • LEVEL ${hero.level} / ${cap}</div>
        </div>
        <div class="hero-profile-status"><b class="${getHeroStatusClass(status)}">${escapeHtml(status)}</b><small>${escapeHtml(hero.condition || 'Healthy')}</small></div>
      </div>

      <div class="hero-progression-panel">
        <div class="hero-progression-head"><div><small>LEVEL PROGRESSION</small><strong>LEVEL ${hero.level} / ${cap}</strong></div><span>${exp.toLocaleString()} / ${required ? required.toLocaleString() : 'MAX'} EXP</span></div>
        <div class="hero-exp-track"><div class="hero-exp-fill" style="width:${expPct}%"></div></div>
        <div class="hero-exp-meta"><span>${required ? `${(required-exp).toLocaleString()} EXP TO NEXT LEVEL` : 'MAX LEVEL REACHED'}</span><span>${expPct}%</span></div>
        <div class="hero-progression-actions"><button class="btn primary" data-hero-test-exp="${escapeHtml(hero.id)}" ${hero.level>=cap?'disabled':''}>+${CONFIG.HERO_TEST_EXP.toLocaleString()} EXP TEST</button><button class="btn" data-hero-promote="${escapeHtml(hero.id)}" ${promotionDisabled}>${promotionText}</button></div>
      </div>

      <div class="conf"><b>PROMOTION REQUIREMENT</b><br>${promotion.reason === 'MAX_STAR' ? '6★ is the maximum tier.' : `${promotion.requirement.riftName}: ${promotion.riftHave}/${promotion.requirement.riftQty}<br>${promotion.requirement.exploreName}: ${promotion.exploreHave}/${promotion.requirement.exploreQty}<br>Gold: ${promotion.goldHave.toLocaleString()}/${promotion.requirement.gold.toLocaleString()}<br><span class="${promotion.canPromote?'good':'danger'}">${promotion.canPromote?'READY TO PROMOTE':'Requirements not yet satisfied.'}</span>`}</div>

      <div class="info">
        ${createInfoItem('ID', escapeHtml(hero.id))}${createInfoItem('Age', `${hero.age || '?'} — ${escapeHtml(hero.ageCategory || 'Unknown')}`)}${createInfoItem('Faction', escapeHtml(hero.faction || 'Unknown'))}${createInfoItem('Level Cap', String(cap))}${createInfoItem('Experience', `${exp.toLocaleString()} / ${required ? required.toLocaleString() : 'MAX'}`)}${createInfoItem('Condition', escapeHtml(hero.condition || 'Healthy'))}
      </div>

      <h3 class="detail-heading">PRIMARY STATS</h3>
      <div class="info">${createInfoItem('HP', primaryValue('HP', hero.hp ?? hero.maxHp))}${createInfoItem('ATK', primaryValue('ATK', hero.atk))}${createInfoItem('DEF', primaryValue('DEF', hero.def))}${createInfoItem('SPD', primaryValue('SPD', hero.spd))}</div>
      <h3 class="detail-heading">SECONDARY STATS</h3>
      <div class="info">${createInfoItem('CRT Rate', `${hero.critRate ?? secondary.critRate ?? 5}%`)}${createInfoItem('CRT Damage', `${hero.critDamage ?? secondary.critDamage ?? 150}%`)}${createInfoItem('Evasion', `${hero.evasion ?? secondary.evasion ?? 3}%`)}${createInfoItem('Resistance', `${hero.resistance ?? secondary.resistance ?? 5}%`)}</div>
      <div class="conf"><b>AGE GROWTH</b><br>${escapeHtml(ageDescription)}<br><small>Growth multiplier: ${getHeroAgeGrowthMultiplier(hero).toFixed(2)}×</small></div>
      <div class="conf"><b>FACTION BONUS</b><br>${escapeHtml(factionBonus)}</div>
      <h3 class="detail-heading">SKILL SET</h3>
      ${skillBasic.length ? skillBasic.map((item, i) => `<div class="skill-card"><b>BASIC ${i + 1} — ${escapeHtml(item?.name || 'Basic Skill')}</b><span>${escapeHtml(item?.effect || 'No effect data')}</span></div>`).join('') : `<div class="skill-card"><b>BASIC — NONE</b><span>No Basic Skill data recorded.</span></div>`}
      ${skill.ultimate ? `<div class="skill-card"><b>ULTIMATE — ${escapeHtml(skill.ultimate?.name || 'Ultimate Skill')}</b><span>${escapeHtml(skill.ultimate?.effect || 'No effect data')}</span></div>` : `<div class="skill-card"><b>ULTIMATE — LOCKED</b><span>Ultimate unlocks at 4★.</span></div>`}
      ${traits.length ? traits.map((item, i) => `<div class="skill-card"><b>TRAIT ${i + 1} — ${escapeHtml(item?.name || 'Trait')}</b><span>${escapeHtml(item?.effect || 'No effect data')}</span></div>`).join('') : `<div class="skill-card"><b>TRAIT — NONE</b><span>No Trait data recorded.</span></div>`}
      ${status === 'AVAILABLE' ? `<div class="hero-quick-actions"><button class="btn primary" data-modal-hero-assign="${escapeHtml(hero.id)}">ASSIGN TO ACTIVE PARTY</button><button class="btn" data-modal-party-page>OPEN PARTY MANAGEMENT</button></div>` : `<div class="hero-quick-note">Quick assignment is unavailable while this hero is ${escapeHtml(status)}.</div>`}
    </div>
  `);
}

/* =========================================================
   09B. PARTY MANAGEMENT — V0.1.3
   ========================================================= */
const MAX_PARTIES = 20;

function nextPartyId() {
  const used = new Set(state.parties.map(p => p.id));
  for (let i=1; i<=MAX_PARTIES; i++) {
    const id = `PARTY-${String(i).padStart(3,"0")}`;
    if (!used.has(id)) return id;
  }
  return null;
}

function getPartyById(id) { return state.parties.find(p => p.id === id) || null; }
function getActiveParty() {
  let party = getPartyById(state.activePartyId);
  if (!party) { party = state.parties[0] || null; state.activePartyId = party?.id || null; }
  return party;
}
function partyHeroIds(party) {
  return [...(party?.slots?.front || []), ...(party?.slots?.back || [])].filter(Boolean);
}
function getPartySlot(party, row, index) { return party?.slots?.[row]?.[index] || null; }
function isHeroAssigned(heroId, partyId = null) {
  return state.parties.some(p => (!partyId || p.id === partyId) && partyHeroIds(p).includes(heroId));
}
function findHeroParty(heroId) {
  return state.parties.find(p => partyHeroIds(p).includes(heroId)) || null;
}
function syncHeroPartyStatuses(targetState = state) {
  const assigned = new Set(targetState.parties.flatMap(p => [...p.slots.front, ...p.slots.back]).filter(Boolean));
  targetState.heroes.forEach(hero => {
    if (assigned.has(hero.id)) hero.status = "IN-PARTY";
    else if (hero.status === "IN-PARTY") hero.status = "AVAILABLE";
    if (!hero.condition) hero.condition = "Healthy";
  });
}
function getPartyCombatPower(party) {
  return partyHeroIds(party).reduce((total, id) => {
    const hero = state.heroes.find(h => h.id === id);
    if (!hero) return total;
    const hp = Number(hero.hp ?? hero.maxHp ?? hero.primaryStats?.HP ?? 0);
    const atk = Number(hero.atk ?? hero.primaryStats?.ATK ?? 0);
    const def = Number(hero.def ?? hero.primaryStats?.DEF ?? 0);
    const spd = Number(hero.spd ?? hero.primaryStats?.SPD ?? 0);
    return total + Math.round(hp / 10) + atk * 2 + def * 2 + spd + Number(hero.star || 1) * 50 + Number(hero.level || 1) * 10;
  }, 0);
}
function getPartyAdvisory(party) {
  const heroes = partyHeroIds(party).map(id => state.heroes.find(h => h.id === id)).filter(Boolean);
  const power = getPartyCombatPower(party);
  const roles = heroes.reduce((m,h) => { m[h.role]=(m[h.role]||0)+1; return m; }, {});
  const advice=[];
  if (!heroes.length) advice.push("Assign AVAILABLE heroes to begin building this formation.");
  else if (heroes.length < 3) advice.push(`Deployment is light (${heroes.length}/5). Add ${3-heroes.length} more hero${3-heroes.length===1?'':'es'} for a stable core.`);
  else if (heroes.length === 5) advice.push("Full deployment achieved. Fairy can evaluate the complete formation.");
  else advice.push("The formation is operational, but additional deployment can increase coverage.");
  if (!roles.Tank) advice.push("No Tank detected. Consider adding a front-line defender.");
  if (!roles.Support) advice.push("No Support detected. Sustained recovery may be limited.");
  if ((roles.DPS||0)+(roles.Mage||0)+(roles.Archer||0) < 2 && heroes.length >= 3) advice.push("Offensive coverage is limited; consider adding another damage-oriented role.");
  const front = party.slots.front.filter(Boolean).length;
  const back = party.slots.back.filter(Boolean).length;
  if (front < 2 && heroes.length) advice.push("Front-line is thin; place at least two heroes in the front row.");
  return { heroes, power, advice, deployed:heroes.length, front, back };
}
function createParty() {
  if (state.parties.length >= MAX_PARTIES) { fairySay("Master, the party limit is 20. Delete a party before creating another."); return; }
  const id = nextPartyId(); if (!id) return;
  const number = state.parties.length + 1;
  const party = { id, name:`Party ${number}`, slots:{front:[null,null,null], back:[null,null]} };
  state.parties.push(party); state.activePartyId=id;
  fairySay(`${id} is ready. Assign AVAILABLE heroes from the roster.`);
  renderHub("party");
}
function deleteParty(partyId) {
  const party=getPartyById(partyId); if (!party) return;
  if (!window.confirm(`Delete ${party.id} — ${party.name}?\nAssigned heroes will return to AVAILABLE.`)) return;
  state.parties = state.parties.filter(p=>p.id!==partyId);
  syncHeroPartyStatuses(state);
  state.activePartyId = state.parties[0]?.id || null;
  fairySay(`${party.id} deleted. Assigned heroes are available again.`);
  renderHub("party");
}
function setPartyActive(partyId) { if (!getPartyById(partyId)) return; state.activePartyId=partyId; renderHub("party"); }
function assignHeroToParty(heroId, partyId, row, index) {
  const hero=state.heroes.find(h=>h.id===heroId), party=getPartyById(partyId);
  if (!hero || !party) return false;
  if (hero.status !== "AVAILABLE") return false;
  if (!party.slots[row] || index<0 || index>=party.slots[row].length) return false;
  if (partyHeroIds(party).includes(heroId)) return false;
  const old=party.slots[row][index];
  if (old) { const oldHero=state.heroes.find(h=>h.id===old); if(oldHero) oldHero.status="AVAILABLE"; }
  party.slots[row][index]=heroId; hero.status="IN-PARTY"; state.activePartyId=party.id;
  return true;
}
function removeHeroFromParty(partyId,row,index) {
  const party=getPartyById(partyId); if(!party) return;
  const heroId=party.slots[row]?.[index]; if(!heroId) return;
  party.slots[row][index]=null;
  const hero=state.heroes.find(h=>h.id===heroId); if(hero) hero.status="AVAILABLE";
}
function getPartyHeroOptions(party, currentHeroId=null) {
  const assignedOther = new Set(partyHeroIds(party).filter(id=>id!==currentHeroId));
  return state.heroes.filter(h => (h.status === "AVAILABLE" || h.id===currentHeroId) && !assignedOther.has(h.id));
}
function renderPartySlot(party,row,index) {
  const currentId=getPartySlot(party,row,index), current=state.heroes.find(h=>h.id===currentId);
  const options=getPartyHeroOptions(party,currentId);
  return `<div class="party-slot ${current ? '' : 'empty'}">
    <select data-party-slot="${party.id}|${row}|${index}">
      <option value="">${current ? 'REMOVE HERO' : 'SELECT AVAILABLE HERO'}</option>
      ${options.map(h=>`<option value="${escapeHtml(h.id)}" ${h.id===currentId?'selected':''}>${escapeHtml(h.name)} · ${h.role} · ★${Number(h.star||1)}</option>`).join('')}
    </select>
    ${current ? `<div class="party-slot-meta"><span>HP<b>${Number(current.hp ?? current.maxHp ?? current.primaryStats?.HP ?? 0).toLocaleString()}</b></span><span>★<b>${Number(current.star||1)}</b></span><span>ROLE<b>${escapeHtml(current.role||'—')}</b></span></div>` : `<div class="party-slot-meta"><span>HP<b>—</b></span><span>★<b>—</b></span><span>ROLE<b>EMPTY</b></span></div>`}
  </div>`;
}
function renderPartyCard(party) {
  const advisory=getPartyAdvisory(party), active=state.activePartyId===party.id;
  return `<article class="party-card ${active?'active':''}">
    <div class="party-head">
      <div><div class="party-id">${party.id}</div>${active?'<span class="party-active-mark">ACTIVE PARTY</span>':''}</div>
      <input class="party-name-input" maxlength="20" value="${escapeHtml(party.name)}" data-party-name="${party.id}" aria-label="Party name">
      <div class="party-head-actions"><button class="btn ${active?'primary':''}" data-party-active="${party.id}">${active?'ACTIVE':'SET ACTIVE'}</button><button class="btn danger" data-party-delete="${party.id}">DELETE</button></div>
    </div>
    <div class="formation-section"><div class="formation-title">FRONT-LINE (3 SLOTS)</div><div class="formation-row">${[0,1,2].map(i=>renderPartySlot(party,'front',i)).join('')}</div></div>
    <div class="formation-section"><div class="formation-title">BACK-LINE (2 SLOTS)</div><div class="formation-row back">${[0,1].map(i=>renderPartySlot(party,'back',i)).join('')}</div></div>
    <div class="party-advisory"><div class="party-advisory-head"><b>FAIRY PARTY ADVISORY</b><span class="party-power">POWER ${advisory.power.toLocaleString()}</span></div><p>Deployment: <b>${advisory.deployed}/5</b> · Front ${advisory.front}/3 · Back ${advisory.back}/2</p><ul>${advisory.advice.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
  </article>`;
}

function renderPartyPage() {
  syncHeroPartyStatuses(state);
  const parties=state.parties.slice(0,MAX_PARTIES);
  return `
    <div class="party-toolbar">
      <div><h2>Party Management</h2><div class="sub">Build up to 20 formations using AVAILABLE heroes. The active party is the bridge between Party Management and Hero Roster.</div></div>
      <div><div class="party-count">Parties: <b>${parties.length} / ${MAX_PARTIES}</b></div><button class="btn primary" data-party-create ${parties.length>=MAX_PARTIES?'disabled':''}>+ CREATE NEW PARTY</button></div>
    </div>
    ${parties.length ? `<div class="party-grid">${parties.map(renderPartyCard).join('')}</div>` : `<div class="party-empty"><b>NO PARTIES CREATED</b><br><small>Create your first party to begin deployment.</small></div>`}
  `;
}

function renderInventoryPage() {
  return renderInventoryInterface014();
}

function renderTownPage() {
  return `
    <h2>Town Square</h2>

    <div class="sub">
      The town remembers what the Master does.
    </div>

    <div class="info">
      ${createInfoItem(
        "Happiness",
        `${state.town.happiness}%`
      )}

      ${createInfoItem(
        "Fear",
        `${state.town.fear}%`
      )}

      ${createInfoItem(
        "Facilities",
        "Active"
      )}

      ${createInfoItem(
        "Training",
        "Monitoring"
      )}
    </div>

    <button
      class="btn primary"
      style="margin-top: 12px;"
      id="skipDayButton"
    >
      SKIP DAY
    </button>

    <div class="conf">
      <b>FAIRY TOWN REPORT</b><br>
      ${
        state.town.happiness >= 60
          ? "The town feels hopeful."
          : "The town is fragile. Small decisions may affect morale."
      }
    </div>
  `;
}

function renderDungeonPage() {
  const dungeonOptions = [
    {
      icon: "♜",
      title: "Tower",
      description: "Climb the Tower and challenge progressively stronger encounters.",
      detail: "100 floors · Progressive difficulty"
    },
    {
      icon: "☠",
      title: "Raid Boss",
      description: "Face powerful raid bosses with a prepared party formation.",
      detail: "Boss encounters · Party-based combat"
    },
    {
      icon: "✦",
      title: "Rift Star",
      description: "Enter unstable rifts and pursue rare Star-related rewards.",
      detail: "Rift stages · Special rewards"
    },
    {
      icon: "⌁",
      title: "Explore Dungeon",
      description: "Explore dangerous zones, encounter enemies, and discover materials.",
      detail: "Exploration · Materials · Encounters"
    }
  ];

  return `
    <h2>Dungeon</h2>

    <div class="sub">
      Select a dungeon activity. All dungeon operations are currently under development.
    </div>

    <div class="dungeon-card-grid" aria-label="Dungeon selection">
      ${dungeonOptions.map((dungeon) => `
        <div class="command dungeon-disabled" aria-disabled="true">
          <div class="icon dungeon-card-icon">
            ${dungeon.icon}
            <span class="badge">COMING SOON</span>
          </div>

          <h3>${dungeon.title}</h3>
          <p>${dungeon.description}</p>
          <p><strong>${dungeon.detail}</strong></p>
          <div class="dungeon-coming-soon">DUNGEON CONTENT UNAVAILABLE</div>
        </div>
      `).join("")}
    </div>

    <div class="conf" style="margin-top:16px;">
      <b>DUNGEON STATUS</b><br>
      Tower, Raid Boss, Rift Star, and Explore Dungeon are reserved for a future content update.
    </div>
  `;
}

function renderFairyPage() {
  return `
    <h2>Fairy AI — Aetheria</h2>

    <div class="sub">
      Living companion state.
    </div>

    <div class="info">
      ${createInfoItem(
        "Mood",
        state.fairy.mood
      )}

      ${createInfoItem(
        "Personality",
        state.fairy.personality
      )}

      ${createInfoItem(
        "Trust",
        state.fairy.trust
      )}

      ${createInfoItem(
        "Knowledge",
        state.fairy.knowledge
      )}

      ${createInfoItem(
        "Memories",
        state.fairy.memory.length
      )}

      ${createInfoItem(
        "Mistakes Remembered",
        state.fairy.mistakes
      )}
    </div>

    <div class="conf">
      <b>CURRENT THOUGHT</b><br>
      ${getFairyText()}
      <br><br>

      <b>Core rule:</b>
      recommendations use only the current Game State
      and AVAILABLE heroes.
    </div>
  `;
}

function createCommand(
  page,
  icon,
  title,
  description
) {
  return `
    <div
      class="command"
      data-command="${page}"
    >
      <div class="icon">
        ${icon}
        <span class="badge">OPEN</span>
      </div>

      <h3>${title}</h3>

      <p>${description}</p>
    </div>
  `;
}

function createInfoItem(label, value) {
  return `
    <div class="info-item">
      <small>${label}</small>
      <b>${value}</b>
    </div>
  `;
}

/* =========================================================
   10. TOWN / DAY CYCLE
   ========================================================= */
function skipDay() {
  const recovered =
    state.heroes.filter(
      (hero) => hero.status !== "AVAILABLE"
    ).length;

  state.heroes.forEach((hero) => {
    if (hero.status !== "IN-PARTY") hero.status = "AVAILABLE";
    hero.condition = "Healthy";
    hero.hp = hero.maxHp;
  });

  state.town.happiness =
    Math.min(
      100,
      state.town.happiness + 2
    );

  state.town.fear =
    Math.max(
      0,
      state.town.fear - 1
    );

  state.skipDayReports.push({
    date: new Date().toISOString(),
    recovered,
    happiness: state.town.happiness,
    fear: state.town.fear
  });

  state.fairy.mood = "PROUD";

  state.fairy.memory.push(
    "Skip Day: heroes recovered and town condition changed."
  );

  fairySay(
    "A new day has passed, Master. The heroes are recovering, and the town feels a little steadier."
  );

  renderHub("town");
}

/* =========================================================
   11. DUNGEON / PRE-BATTLE ANALYSIS
   ========================================================= */
function runPreBattleAnalysis() {
  const availableHeroes =
    state.heroes.filter(
      (hero) => hero.status === "AVAILABLE"
    );

  const victoryEstimate =
    Math.min(
      95,
      35 +
        availableHeroes.length * 10 +
        availableHeroes.reduce(
          (total, hero) =>
            total + hero.star * 3,
          0
        )
    );

  const risk =
    victoryEstimate < 50
      ? "CRITICAL"
      : victoryEstimate < 70
        ? "HIGH"
        : victoryEstimate < 85
          ? "MEDIUM"
          : "LOW";

  const safeToEnter =
    victoryEstimate >= 60;

  const partyNames =
    availableHeroes
      .slice(0, 5)
      .map((hero) => hero.name)
      .join(", ") || "None";

  openModal(
    "Pre-Battle Recommendation",
    `
      <div class="info">
        ${createInfoItem(
          "Victory Estimate",
          `${victoryEstimate}%`
        )}

        ${createInfoItem(
          "Survival Estimate",
          `${Math.max(
            10,
            victoryEstimate - 8
          )}%`
        )}

        ${createInfoItem(
          "Risk Level",
          risk
        )}

        ${createInfoItem(
          "Recommended Party",
          partyNames
        )}
      </div>

      <div class="conf">
        <b>FAIRY DECISION</b><br>

        ${
          safeToEnter
            ? "I recommend entering only if the selected formation remains AVAILABLE and healthy."
            : "<span class='danger'>DO NOT ENTER.</span> The current probability is too low for a responsible recommendation."
        }

        <br><br>

        <b>Confidence:</b>
        ${
          availableHeroes.length >= 3
            ? "MEDIUM"
            : "LOW"
        }
      </div>
    `
  );
}

/* =========================================================
   12. MODAL SYSTEM
   ========================================================= */
function openModal(title, body) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modal").classList.add("show");
}

function closeModal() {
  $("modal").classList.remove("show");
}

/* =========================================================
   12B. V0.0.9 SAVE / LOAD UI TEMPLATES
   ---------------------------------------------------------
   These hidden containers hold only the independently rendered
   SaveGameManager and LoadGameManager interfaces.
   ========================================================= */
/* =========================================================
   13. EVENT BINDING
   ========================================================= */

/* TITLE */
$("newGame").addEventListener(
  "click",
  startNewGame
);


$("loadGameTitle").addEventListener(
  "click",
  () => LoadGameManager.open()
);

$("saveGameTitle").addEventListener(
  "click",
  () => SaveGameManager.open()
);

$("settings").addEventListener(
  "click",
  () => {
    openModal(
      "Settings",
      "Settings will be expanded in a later update. Core save data is preserved in this version."
    );
  }
);

$("exit").addEventListener(
  "click",
  showExitConfirmation
);

function showExitConfirmation() {
  openModal(
    "EXIT",
    `
      <div class="confirm-box">
        <h3>EXIT AETHERIA?</h3>
        <p>Are you sure you want to leave the game and return to the desktop/browser?</p>
        <div class="actions" style="margin-top:18px;">
          <button class="btn" id="exitNo">NO</button>
          <button class="btn danger" id="exitYes">YES</button>
        </div>
      </div>
    `
  );

  $("exitNo").addEventListener("click", closeModal);
  $("exitYes").addEventListener("click", () => {
    closeModal();
    window.close();

    // Browsers usually block window.close() for normal tabs.
    // If blocked, keep the user on the title screen safely.
    setTimeout(() => {
      if (!document.hidden) {
        showScreen("title");
          }
    }, 50);
  });
}

$("logout").addEventListener(
  "click",
  showLogoutModal
);

$("saveHub").addEventListener(
  "click",
  () => SaveGameManager.open()
);

$("loadHub").addEventListener(
  "click",
  () => LoadGameManager.open()
);

/* STORY */
$("next").addEventListener(
  "click",
  nextStory
);

$("skip").addEventListener(
  "click",
  skipStory
);

/* CREATION */
$("confirm").addEventListener(
  "click",
  confirmMaster
);

/* MODAL */
$("modalClose").addEventListener(
  "click",
  closeModal
);

$("modal").addEventListener(
  "click",
  (event) => {
    if (event.target === $("modal")) {
      closeModal();
    }
  }
);

/* HUB — EVENT DELEGATION */
$("content").addEventListener(
  "click",
  handleContentClick
);

$("content").addEventListener("input", handleContentInput);
$("content").addEventListener("change", handleContentChange);

document.querySelector(".nav").addEventListener(
  "click",
  handleNavigationClick
);

/* =========================================================
   EVENT HANDLERS
   ========================================================= */
function startNewGame() {
  storyIndex = 0;
  $("storyText").textContent =
    STORY[storyIndex];

  $("masterName").value = "";
  $("error").textContent = "";

  showScreen("story");
}

function nextStory() {
  storyIndex++;

  if (storyIndex >= STORY.length) {
    showScreen("creation");
    return;
  }

  $("storyText").textContent =
    STORY[storyIndex];
}

function skipStory() {
  storyIndex = STORY.length - 1;

  $("storyText").textContent =
    STORY[storyIndex];
}

function confirmMaster() {
  const name =
    $("masterName").value.trim();

  if (name.length < 3 || name.length > 20) {
    $("error").textContent =
      "Master name must be 3–20 characters.";

    return;
  }

  $("error").textContent = "";

  state = {
    ...createInitialState(),

    masterName: name,

    masterId:
      "MASTER-" +
      Math.floor(
        100000 +
        Math.random() * 900000
      ),

    createdAt:
      new Date()
        .toISOString()
        .slice(0, 10),

    lastSaved:
      new Date()
        .toISOString()
        .slice(0, 10)
  };

  SaveGameManager.save(1);

  activeSlot = 1;

  fairySay(
    "Master, I'm online. I will observe, remember, and warn you when your strategy is unsafe."
  );

  showScreen("hub");
}

function showLogoutModal() {
  openModal(
    "LOGOUT",
    `
      <div class="logout-confirm">
        <div class="save-manager-intro">
          <b>RETURN TO TITLE SCREEN?</b>
          <span>Your current session will end. Save your progress first if you want to keep the latest game state.</span>
        </div>
        <div class="actions" style="margin-top:18px;">
          <button class="btn" id="logoutCancel">CANCEL</button>
          <button class="btn primary" id="logoutSave">SAVE GAME</button>
          <button class="btn danger" id="logoutConfirm">LOGOUT / TITLE</button>
        </div>
      </div>
    `
  );

  $("logoutCancel").addEventListener("click", closeModal);
  $("logoutSave").addEventListener("click", () => {
    SaveGameManager.open();
  });
  $("logoutConfirm").addEventListener("click", () => {
    closeModal();
    showScreen("title");
  });
}

function handleNavigationClick(event) {
  const button =
    event.target.closest(
      "[data-open]"
    );

  if (!button) {
    return;
  }

  renderHub(
    button.dataset.open
  );
}

function handleContentClick(event) {
  const recruitButton=event.target.closest('[data-recruit]'); if(recruitButton){recruitHero(recruitButton.dataset.recruit);return;}
  const command=event.target.closest('[data-command]'); if(command){renderHub(command.dataset.command);return;}
  if(event.target.id==='skipDayButton'){skipDay();return;} if(event.target.id==='preBattleButton'){runPreBattleAnalysis();return;}
  const heroFilter=event.target.closest('.hero-filter-chip'); if(heroFilter){handleHeroFilterClick(heroFilter);return;}
  const profile=event.target.closest('[data-hero-profile]'); if(profile){showHeroDetail(profile.dataset.heroProfile);return;}
  const testExp=event.target.closest('[data-hero-test-exp]'); if(testExp){const result=distributeHeroExp(testExp.dataset.heroTestExp,CONFIG.HERO_TEST_EXP,'PROFILE TEST'); showHeroDetail(testExp.dataset.heroTestExp); return;}
  const promote=event.target.closest('[data-hero-promote]'); if(promote){const result=promoteHero(promote.dataset.heroPromote); if(!result.success){openModal('PROMOTION BLOCKED', `<div class="conf"><b>REQUIREMENTS NOT MET</b><br>${escapeHtml(result.missing?.join('<br>') || result.message || 'Promotion unavailable.')}</div>`); return;} showHeroDetail(promote.dataset.heroPromote); return;}
  const quick=event.target.closest('[data-hero-quick-party]'); if(quick){quickAssignHero(quick.dataset.heroQuickParty);return;}
  const modalAssign=event.target.closest('[data-modal-hero-assign]'); if(modalAssign){quickAssignHero(modalAssign.dataset.modalHeroAssign,true);return;}
  const modalParty=event.target.closest('[data-modal-party-page]'); if(modalParty){closeModal();renderHub('party');return;}
  const create=event.target.closest('[data-party-create]'); if(create){createParty();return;}
  const del=event.target.closest('[data-party-delete]'); if(del){deleteParty(del.dataset.partyDelete);return;}
  const active=event.target.closest('[data-party-active]'); if(active){setPartyActive(active.dataset.partyActive);return;}
  const chip=event.target.closest('.chip'); if(chip){handleFilterClick(chip);return;}
  const heroCard=event.target.closest('.hero-card'); if(heroCard && !event.target.closest('button')){showHeroDetail(heroCard.dataset.heroId);return;}
}

function handleContentInput(event) {
  const input=event.target.closest('[data-party-name]');
  if(input){const party=getPartyById(input.dataset.partyName);if(party)party.name=input.value.slice(0,20);}
}
function handleContentChange(event) {
  const select=event.target.closest('[data-party-slot]');
  if(select){const [partyId,row,index]=select.dataset.partySlot.split('|'); const value=select.value; if(value) assignHeroToParty(value,partyId,row,Number(index)); else removeHeroFromParty(partyId,row,Number(index)); renderHub('party'); return;}
}
function quickAssignHero(heroId, closeAfter=false) {
  const party=getActiveParty();
  if(!party){fairySay('Create or activate a party first.');return;}
  const hero=state.heroes.find(h=>h.id===heroId);
  if(!hero || hero.status!=='AVAILABLE'){if(closeAfter)closeModal();return;}
  let placed=false;
  for(const row of ['front','back']) {
    for(let i=0;i<party.slots[row].length;i++) {
      if(!party.slots[row][i]) { placed=assignHeroToParty(heroId,party.id,row,i); break; }
    }
    if(placed) break;
  }
  if(closeAfter)closeModal();
  if(placed){fairySay(`${hero.name} joined ${party.id}.`);renderHub('heroes');} else fairySay(`${party.id} has no empty slots.`);
}

function handleHeroFilterClick(chip) {
  const group = chip.dataset.filterGroup;
  document.querySelectorAll(`.hero-filter-chip[data-filter-group="${group}"]`).forEach(item => item.classList.remove('on'));
  chip.classList.add('on');
  const heroList = $('heroList');
  if (heroList) heroList.innerHTML = renderHeroRows();
}

function handleFilterClick(chip) {
  const group = chip.dataset.role ? '[data-role]' : chip.dataset.status ? '[data-status]' : '[data-star]';
  document.querySelectorAll(`.chip${group}`).forEach(item => item.classList.remove('on'));
  chip.classList.add('on');
  const heroList = $('heroList');
  if (heroList) heroList.innerHTML = renderHeroRows();
}

/* V0.0.9 SAVE / LOAD EVENT DELEGATION */
$("modalBody").addEventListener("click", (event) => {
  const save = event.target.closest("[data-v02-save]");
  if (save) { SaveGameManager.save(Number(save.dataset.v02Save)); return; }

  const saveDelete = event.target.closest("[data-v02-delete]");
  if (saveDelete) { SaveGameManager.confirmDelete(Number(saveDelete.dataset.v02Delete)); return; }

  const load = event.target.closest("[data-v02-load]");
  if (load) { LoadGameManager.load(Number(load.dataset.v02Load)); return; }

  const loadDelete = event.target.closest("[data-v02-load-delete]");
  if (loadDelete) { LoadGameManager.confirmDelete(Number(loadDelete.dataset.v02LoadDelete)); return; }
  const testExp = event.target.closest("[data-hero-test-exp]");
  if (testExp) { distributeHeroExp(testExp.dataset.heroTestExp, CONFIG.HERO_TEST_EXP, "PROFILE TEST"); showHeroDetail(testExp.dataset.heroTestExp); return; }

  const promote = event.target.closest("[data-hero-promote]");
  if (promote) {
    const result = promoteHero(promote.dataset.heroPromote);
    if (!result.success) {
      const missing = Array.isArray(result.missing) ? result.missing.join('<br>') : (result.message || 'Promotion unavailable.');
      openModal('PROMOTION BLOCKED', `<div class="conf"><b>REQUIREMENTS NOT MET</b><br>${missing}</div>`);
      return;
    }
    showHeroDetail(promote.dataset.heroPromote);
    return;
  }

  const modalAssign = event.target.closest("[data-modal-hero-assign]");
  if (modalAssign) { quickAssignHero(modalAssign.dataset.modalHeroAssign, true); return; }
  const modalParty = event.target.closest("[data-modal-party-page]");
  if (modalParty) { closeModal(); renderHub("party"); return; }
});

/* =========================================================
   14. INITIALIZATION
   ========================================================= */
function initializeGame() {

  fairySay(
    "I'm online, Master. I'll keep watching the state of Aetheria."
  );
}

initializeGame();
