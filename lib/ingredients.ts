import "server-only";

import { randomUUID } from "node:crypto";
import { createPublicServerClient } from "./supabase-public-server";
import { USE_FIXTURES } from "./fixtures/index";
import fixtureData from "./fixtures/ingredients.json";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;

export interface IngredientListItem {
  ingredient_id: number;
  ingredient_name: string;
}

export interface IngredientSearchInput {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicDataError {
  code: "FG_BAD_REQUEST" | "FG_DATA_UNAVAILABLE";
  message: string;
  retryable: boolean;
  fallback: "adjust-input" | "retry";
}

export type IngredientSearchOutcome =
  | {
      ok: true;
      data: IngredientListItem[];
      meta: { page: number; pageSize: number; total: number };
      traceId: string;
    }
  | { ok: false; error: PublicDataError; traceId: string };

export type IngredientDetailOutcome =
  | { ok: true; data: IngredientListItem | null; traceId: string }
  | { ok: false; error: PublicDataError; traceId: string };

function sanitize(value: string | undefined): string {
  return (value ?? "")
    .replace(/[,()*.:%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function unavailable(traceId: string): IngredientSearchOutcome {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "식재료 정보를 불러오지 못했습니다.",
      retryable: true,
      fallback: "retry",
    },
    traceId,
  };
}

export async function searchPublicIngredients(
  input: IngredientSearchInput,
): Promise<IngredientSearchOutcome> {
  const traceId = randomUUID();

  if (USE_FIXTURES) {
    const fixtures = fixtureData as IngredientListItem[];
    const q = sanitize(input.q).toLowerCase();
    const filtered = q
      ? fixtures.filter((i) => i.ingredient_name.toLowerCase().includes(q))
      : fixtures;
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 20)));
    const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { ok: true, data: sliced, meta: { page, pageSize, total: filtered.length }, traceId };
  }

  const q = sanitize(input.q);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? PAGE_SIZE)),
  );
  const offset = (page - 1) * pageSize;

  try {
    const supabase = createPublicServerClient();
    let query = supabase
      .from("ingredients")
      .select("ingredient_id,ingredient_name", { count: "exact" });

    if (q) query = query.ilike("ingredient_name", `%${q}%`);

    const { data, count, error } = await query
      .order("ingredient_name", { ascending: true })
      .order("ingredient_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("[ingredient-search] query failed", {
        traceId,
        providerCode: error.code,
      });
      return unavailable(traceId);
    }

    return {
      ok: true,
      data: (data ?? []) as IngredientListItem[],
      meta: { page, pageSize, total: count ?? 0 },
      traceId,
    };
  } catch (err) {
    console.warn("[ingredient-search] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return unavailable(traceId);
  }
}

export async function getPublicIngredient(
  ingredientId: string,
): Promise<IngredientDetailOutcome> {
  const traceId = randomUUID();
  const id = Number.parseInt(ingredientId.trim(), 10);

  if (USE_FIXTURES) {
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        error: { code: "FG_BAD_REQUEST", message: "식재료 식별자가 올바르지 않습니다.", retryable: false, fallback: "adjust-input" },
        traceId,
      };
    }
    const fixtures = fixtureData as IngredientListItem[];
    const found = fixtures.find((i) => i.ingredient_id === id) ?? null;
    return { ok: true, data: found, traceId };
  }

  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      error: {
        code: "FG_BAD_REQUEST",
        message: "식재료 식별자가 올바르지 않습니다.",
        retryable: false,
        fallback: "adjust-input",
      },
      traceId,
    };
  }

  try {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase
      .from("ingredients")
      .select("ingredient_id,ingredient_name")
      .eq("ingredient_id", id)
      .maybeSingle();

    if (error) {
      console.warn("[ingredient-detail] query failed", {
        traceId,
        providerCode: error.code,
      });
      return {
        ok: false,
        error: {
          code: "FG_DATA_UNAVAILABLE",
          message: "식재료 정보를 불러오지 못했습니다.",
          retryable: true,
          fallback: "retry",
        },
        traceId,
      };
    }

    return { ok: true, data: data as IngredientListItem | null, traceId };
  } catch (err) {
    console.warn("[ingredient-detail] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return {
      ok: false,
      error: {
        code: "FG_DATA_UNAVAILABLE",
        message: "식재료 정보를 불러오지 못했습니다.",
        retryable: true,
        fallback: "retry",
      },
      traceId,
    };
  }
}
