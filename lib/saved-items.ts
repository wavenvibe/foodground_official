export const SAVED_ITEMS_EVENT = "foodground:saved-items-changed";

export const SAVED_KEYS = {
  recipes: "fg_saved_recipes",
  substitutes: "fg_saved_substitutes",
  facilities: "fg_saved_facilities",
  products: "fg_saved_products",
} as const;

export interface SavedRecipe {
  recipe_id: string;
  title: string;
  category: string | null;
  saved_at: string;
}

export interface SavedSubstitute {
  standard_food_id: string;
  name: string;
  food_group: string | null;
  source_ingredient: string;
  score_final: number | null;
  saved_at: string;
}

export interface SavedFacility {
  mgt_no: string;
  name: string;
  biz_type: string | null;
  region_sido: string | null;
  region_sigungu?: string | null;
  status?: string | null;
  is_haccp?: boolean;
  saved_at: string;
}

export interface SavedProduct {
  report_no: string;
  product_name: string;
  category: string | null;
  facility_mgt_no: string;
  facility_name: string;
  saved_at: string;
}

export function loadSaved<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeSaved<T>(key: string, items: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(SAVED_ITEMS_EVENT));
}

export function getSavedCount(): number {
  return Object.values(SAVED_KEYS).reduce((total, key) => total + loadSaved(key).length, 0);
}
