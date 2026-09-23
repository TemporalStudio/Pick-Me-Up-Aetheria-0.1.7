import { CONFIG } from "./config.js";

export function createInitialState() {
  return {
    version: CONFIG.VERSION,
    currentScreen: "title",
    masterName: "",
    masterId: "",
    highestFloor: 0,
    masterRank: "F-Rank",
    gold: CONFIG.STARTING_GOLD,
    gems: CONFIG.STARTING_GEMS,
    tickets: CONFIG.STARTING_TICKETS,
    specialTickets: 0,
    heroes: [],
    heroGeneration: { totalGenerated: 0, lastGeneratedId: "", lastGeneratedAt: "" },
    parties: [],
    activePartyId: null,
    equipment: [],
    medical: [],
    materials: [],
    town: { happiness: 50, fear: 0 },
    fairy: {
      mood: "CURIOUS", personality: "CURIOUS", trust: 10,
      knowledge: 1, memory: [], mistakes: 0
    },
    recruitmentLog: [],
    battleReports: [],
    explorationReports: [],
    skipDayReports: [],
    playTime: 0,
    lastSaved: "",
    createdAt: ""
  };
}

let state = createInitialState();
const listeners = new Set();

export function getState() { return state; }
export function setState(next) {
  state = next;
  listeners.forEach(fn => fn(state));
  return state;
}
export function patchState(patch) {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn(state));
  return state;
}
export function resetState() {
  state = createInitialState();
  listeners.forEach(fn => fn(state));
  return state;
}
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function mutateState(mutator) {
  mutator(state);
  listeners.forEach(fn => fn(state));
  return state;
}
