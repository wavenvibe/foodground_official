import "server-only";

import { randomUUID } from "node:crypto";
import { createPublicServerClient } from "./supabase-public-server";

const MAX_QUERY_LENGTH = 100;
const MAX_CANDIDATES = 10;

export type MatchType = "exact" | "substring" | "fuzzy" | "synonym" | "unmatched";

export interface PublicDataError {
  code: "FG_BAD_REQUEST" | "FG_DATA_UNAVAILABLE";
  message: string;
  retryable: boolean;
  fallback: "adjust-input" | "retry";
}

export interface StandardFood {
  standard_food_id: string;
  name: string;
  food_group: string | null;
  energy_kcal: number | null;
  water_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbohydrate_g: number | null;
  ash_g: number | null;
}

export interface SubstituteCandidate {
  candidate_food: StandardFood;
  sim_nutrition: number | null;
  sim_ingredient_category: number | null;
  sim_food_group: number | null;
  sim_cooking_state: number | null;
  sim_dish_type: number | null;
  sim_companion: number | null;
  score_composite: number | null;
  score_final: number | null;
  available_sim_count: number | null;
  basis_date: string | null;
}

export interface SubstituteResult {
  match_type: MatchType;
  match_confidence: number | null;
  input_name: string;
  basis_date: string | null;
  source_food: StandardFood | null;
  candidates: SubstituteCandidate[];
}

export type SubstituteOutcome =
  | { ok: true; data: SubstituteResult | null; traceId: string }
  | { ok: false; error: PublicDataError; traceId: string };

function sanitize(value: string | undefined): string {
  return (value ?? "")
    .replace(/[,()*.:%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function unavailable(traceId: string): SubstituteOutcome {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "대체 식재료 정보를 불러오지 못했습니다.",
      retryable: true,
      fallback: "retry",
    },
    traceId,
  };
}

export async function searchSubstitutes(
  ingredient: string | undefined,
): Promise<SubstituteOutcome> {
  const traceId = randomUUID();
  const q = sanitize(ingredient);

  if (!q) {
    return {
      ok: false,
      error: {
        code: "FG_BAD_REQUEST",
        message: "식재료 이름을 입력해 주세요.",
        retryable: false,
        fallback: "adjust-input",
      },
      traceId,
    };
  }

  try {
    const supabase = createPublicServerClient();

    // Step 1: Exact name lookup first (input_name is PK)
    const { data: exactRows, error: exactError } = await supabase
      .from("ingredient_name_match")
      .select("input_name,standard_food_id,match_type,match_confidence,basis_date")
      .eq("input_name", q)
      .limit(1);

    if (exactError) {
      console.warn("[substitutes] exact name-match query failed", {
        traceId,
        code: exactError.code,
      });
      return unavailable(traceId);
    }

    // Step 2a: Exact row found AND unmatched → early return with unmatched state
    if (exactRows && exactRows.length > 0 && exactRows[0].match_type === "unmatched") {
      const row = exactRows[0];
      return {
        ok: true,
        data: {
          match_type: "unmatched",
          match_confidence: (row.match_confidence as number | null) ?? null,
          input_name: row.input_name as string,
          basis_date: (row.basis_date as string | null) ?? null,
          source_food: null,
          candidates: [],
        },
        traceId,
      };
    }

    // Step 2b/2c: Use exact match if found (and not unmatched); else ilike fallback
    let match: Record<string, unknown> | null = null;

    if (exactRows && exactRows.length > 0) {
      match = exactRows[0] as Record<string, unknown>;
    } else {
      const { data: ilikeRows, error: ilikeError } = await supabase
        .from("ingredient_name_match")
        .select("input_name,standard_food_id,match_type,match_confidence,basis_date")
        .ilike("input_name", `%${q}%`)
        .neq("match_type", "unmatched")
        .not("standard_food_id", "is", null)
        .order("match_confidence", { ascending: false })
        .order("input_name", { ascending: true })
        .limit(1);

      if (ilikeError) {
        console.warn("[substitutes] ilike name-match query failed", {
          traceId,
          code: ilikeError.code,
        });
        return unavailable(traceId);
      }

      if (!ilikeRows || ilikeRows.length === 0) {
        return { ok: true, data: null, traceId };
      }

      match = ilikeRows[0] as Record<string, unknown>;
    }

    if (!match) {
      return { ok: true, data: null, traceId };
    }

    const standardFoodId = match.standard_food_id as string | null;
    if (!standardFoodId) {
      return { ok: true, data: null, traceId };
    }

    // Step 3: Fetch source food details
    const { data: sourceRow, error: sourceError } = await supabase
      .from("standard_foods")
      .select(
        "standard_food_id,name,food_group,energy_kcal,water_g,protein_g,fat_g,carbohydrate_g,ash_g",
      )
      .eq("standard_food_id", standardFoodId)
      .maybeSingle();

    if (sourceError || !sourceRow) {
      console.warn("[substitutes] source food lookup failed", {
        traceId,
        standardFoodId,
      });
      return unavailable(traceId);
    }

    // Step 4: Get substitute pairs ordered by score_final DESC
    // Use select("*") — the PostgREST TS type parser rejects Korean identifiers in select strings;
    // runtime filter on 기준식품ID works via the JS client's percent-encoded URL encoding.
    const { data: pairRows, error: pairError } = await supabase
      .from("substitute_pairs")
      .select("*")
      .eq("기준식품ID", standardFoodId)
      .order("score_final", { ascending: false })
      .limit(MAX_CANDIDATES);

    if (pairError) {
      console.warn("[substitutes] pairs query failed", {
        traceId,
        code: pairError.code,
      });
      return unavailable(traceId);
    }

    if (!pairRows || pairRows.length === 0) {
      return { ok: true, data: null, traceId };
    }

    // Step 5: Batch fetch candidate food details
    const candidateIds = (pairRows as unknown as Array<Record<string, unknown>>).map(
      (r) => r["후보식품ID"] as string,
    );
    const { data: candidateFoodRows, error: candidateError } = await supabase
      .from("standard_foods")
      .select(
        "standard_food_id,name,food_group,energy_kcal,water_g,protein_g,fat_g,carbohydrate_g,ash_g",
      )
      .in("standard_food_id", candidateIds);

    if (candidateError) {
      console.warn("[substitutes] candidate foods fetch failed", {
        traceId,
        code: candidateError.code,
      });
      return unavailable(traceId);
    }

    const foodMap = new Map<string, StandardFood>();
    for (const row of candidateFoodRows ?? []) {
      foodMap.set(
        (row as { standard_food_id: string }).standard_food_id,
        row as unknown as StandardFood,
      );
    }

    const candidates = (pairRows as unknown as Array<Record<string, unknown>>)
      .map((pair): SubstituteCandidate | null => {
        const candidateId = pair["후보식품ID"] as string;
        const food = foodMap.get(candidateId);
        if (!food) return null;
        return {
          candidate_food: food,
          sim_nutrition: (pair.sim_nutrition as number | undefined) ?? null,
          sim_ingredient_category: (pair.sim_ingredient_category as number | undefined) ?? null,
          sim_food_group: (pair.sim_food_group as number | undefined) ?? null,
          sim_cooking_state: (pair.sim_cooking_state as number | undefined) ?? null,
          sim_dish_type: (pair.sim_dish_type as number | undefined) ?? null,
          sim_companion: (pair.sim_companion as number | undefined) ?? null,
          score_composite: (pair.score_composite as number | undefined) ?? null,
          score_final: (pair.score_final as number | undefined) ?? null,
          available_sim_count: (pair.available_sim_count as number | undefined) ?? null,
          basis_date: (pair.basis_date as string | undefined) ?? null,
        };
      })
      .filter((c): c is SubstituteCandidate => c !== null);

    return {
      ok: true,
      data: {
        match_type: match.match_type as MatchType,
        match_confidence: (match.match_confidence as number | null) ?? null,
        input_name: match.input_name as string,
        basis_date: (match.basis_date as string | null) ?? null,
        source_food: sourceRow as unknown as StandardFood,
        candidates,
      },
      traceId,
    };
  } catch (err) {
    console.warn("[substitutes] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return unavailable(traceId);
  }
}
