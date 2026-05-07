import { SavedIndex } from "./types";

const STORAGE_KEY = "poly8bit_indexes";
const ACTIVE_KEY = "poly8bit_active_index";

export function loadIndexes(): SavedIndex[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIndex(index: SavedIndex): void {
  try {
    const all = loadIndexes();
    all.push(index);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function deleteIndex(id: string): void {
  try {
    const all = loadIndexes().filter((idx) => idx.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function updateIndex(id: string, patch: Partial<SavedIndex>): void {
  try {
    const all = loadIndexes();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function getActiveIndexId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveIndexId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}
