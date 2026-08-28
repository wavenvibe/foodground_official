import "server-only";

import { randomUUID } from "node:crypto";
import { createPublicServerClient } from "./supabase-public-server";
import { USE_FIXTURES } from "./fixtures/index";
import fixtureRecipes from "./fixtures/recipes.json";
import fixtureIngredients from "./fixtures/ingredients.json";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;

export interface RecipeListItem {
  recipe_id: number;
  title: string;
  category_large: string | null;
  category_mid: string | null;
  category_small: string | null;
  servings: number | null;
}

export interface RecipeDetail extends RecipeListItem {
  ingest_run_id: string | null;
}

export interface RecipeIngredientRow {
  ingredient_id: number;
  ingredient_name: string;
  amount_raw: string | null;
  unit_raw: string | null;
  sort_order: number | null;
  is_seasoning: boolean | null;
}

export interface RecipeSearchInput {
  q?: string;
  categoryLarge?: string;
  categoryMid?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicDataError {
  code: "FG_BAD_REQUEST" | "FG_DATA_UNAVAILABLE";
  message: string;
  retryable: boolean;
  fallback: "adjust-input" | "retry";
}

export type RecipeSearchOutcome =
  | {
      ok: true;
      data: RecipeListItem[];
      meta: { page: number; pageSize: number; total: number };
      traceId: string;
    }
  | { ok: false; error: PublicDataError; traceId: string };

export type RecipeDetailOutcome =
  | {
      ok: true;
      data: (RecipeDetail & { ingredients: RecipeIngredientRow[] }) | null;
      traceId: string;
    }
  | { ok: false; error: PublicDataError; traceId: string };

function sanitize(value: string | undefined, maxLen = MAX_QUERY_LENGTH): string {
  return (value ?? "")
    .replace(/[,()*.:%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function unavailable(traceId: string): RecipeSearchOutcome {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "레시피 정보를 불러오지 못했습니다.",
      retryable: true,
      fallback: "retry",
    },
    traceId,
  };
}

const LIST_COLS =
  "recipe_id,title,category_large,category_mid,category_small,servings";

export async function searchPublicRecipes(
  input: RecipeSearchInput,
): Promise<RecipeSearchOutcome> {
  const traceId = randomUUID();

  if (USE_FIXTURES) {
    const fixtures = fixtureRecipes as RecipeListItem[];
    const q = sanitize(input.q).toLowerCase();
    const cl = sanitize(input.categoryLarge, 50).toLowerCase();
    const cm = sanitize(input.categoryMid, 50).toLowerCase();
    const filtered = fixtures.filter(
      (r) =>
        (!q || r.title.toLowerCase().includes(q)) &&
        (!cl || (r.category_large ?? "").toLowerCase() === cl) &&
        (!cm || (r.category_mid ?? "").toLowerCase() === cm),
    );
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 20)));
    const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { ok: true, data: sliced, meta: { page, pageSize, total: filtered.length }, traceId };
  }

  const q = sanitize(input.q);
  const categoryLarge = sanitize(input.categoryLarge, 50);
  const categoryMid = sanitize(input.categoryMid, 50);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? PAGE_SIZE)),
  );
  const offset = (page - 1) * pageSize;

  try {
    const supabase = createPublicServerClient();
    let query = supabase
      .from("recipes")
      .select(LIST_COLS, { count: "exact" });

    if (q) query = query.ilike("title", `%${q}%`);
    if (categoryLarge) query = query.eq("category_large", categoryLarge);
    if (categoryMid) query = query.eq("category_mid", categoryMid);

    const { data, count, error } = await query
      .order("title", { ascending: true })
      .order("recipe_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("[recipe-search] query failed", {
        traceId,
        providerCode: error.code,
      });
      return unavailable(traceId);
    }

    return {
      ok: true,
      data: (data ?? []) as RecipeListItem[],
      meta: { page, pageSize, total: count ?? 0 },
      traceId,
    };
  } catch (err) {
    console.warn("[recipe-search] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return unavailable(traceId);
  }
}

export async function getPublicRecipe(
  recipeId: string,
): Promise<RecipeDetailOutcome> {
  const traceId = randomUUID();
  const id = Number.parseInt(recipeId.trim(), 10);

  if (USE_FIXTURES) {
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        error: { code: "FG_BAD_REQUEST", message: "레시피 식별자가 올바르지 않습니다.", retryable: false, fallback: "adjust-input" },
        traceId,
      };
    }
    const recipes = fixtureRecipes as RecipeListItem[];
    const recipe = recipes.find((r) => r.recipe_id === id);
    if (!recipe) return { ok: true, data: null, traceId };
    const ingredients = (fixtureIngredients as { ingredient_id: number; ingredient_name: string }[]).map(
      (ing, idx) => ({
        ingredient_id: ing.ingredient_id,
        ingredient_name: ing.ingredient_name,
        amount_raw: null,
        unit_raw: null,
        sort_order: idx + 1,
        is_seasoning: idx >= 2,
      }),
    );
    return { ok: true, data: { ...recipe, ingest_run_id: null, ingredients }, traceId };
  }

  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: {
        code: "FG_BAD_REQUEST",
        message: "레시피 식별자가 올바르지 않습니다.",
        retryable: false,
        fallback: "adjust-input",
      },
      traceId,
    };
  }

  try {
    const supabase = createPublicServerClient();
    const [recipeResult, ingredientsResult] = await Promise.all([
      supabase
        .from("recipes")
        .select(`${LIST_COLS},ingest_run_id`)
        .eq("recipe_id", id)
        .maybeSingle(),
      supabase
        .from("recipe_ingredients")
        .select(
          "ingredient_id,amount_raw,unit_raw,sort_order,is_seasoning,ingredients(ingredient_name)",
        )
        .eq("recipe_id", id)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .limit(200),
    ]);

    if (recipeResult.error) {
      console.warn("[recipe-detail] query failed", {
        traceId,
        providerCode: recipeResult.error.code,
      });
      return {
        ok: false,
        error: {
          code: "FG_DATA_UNAVAILABLE",
          message: "레시피 정보를 불러오지 못했습니다.",
          retryable: true,
          fallback: "retry",
        },
        traceId,
      };
    }

    if (!recipeResult.data) {
      return { ok: true, data: null, traceId };
    }

    type IngRow = {
      ingredient_id: number;
      amount_raw: string | null;
      unit_raw: string | null;
      sort_order: number | null;
      is_seasoning: boolean | null;
      ingredients: { ingredient_name: string } | null;
    };

    const ingredientRows: RecipeIngredientRow[] = (
      (ingredientsResult.data ?? []) as unknown as IngRow[]
    ).map((row) => ({
      ingredient_id: row.ingredient_id,
      ingredient_name: row.ingredients?.ingredient_name ?? "",
      amount_raw: row.amount_raw,
      unit_raw: row.unit_raw,
      sort_order: row.sort_order,
      is_seasoning: row.is_seasoning,
    }));

    return {
      ok: true,
      data: {
        ...(recipeResult.data as RecipeDetail),
        ingredients: ingredientRows,
      },
      traceId,
    };
  } catch (err) {
    console.warn("[recipe-detail] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return {
      ok: false,
      error: {
        code: "FG_DATA_UNAVAILABLE",
        message: "레시피 정보를 불러오지 못했습니다.",
        retryable: true,
        fallback: "retry",
      },
      traceId,
    };
  }
}
