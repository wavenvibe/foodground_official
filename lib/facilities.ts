import "server-only";

import { randomUUID } from "node:crypto";
import { createPublicServerClient } from "./supabase-public-server";
import { USE_FIXTURES } from "./fixtures/index";
import fixtureData from "./fixtures/facilities.json";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 50;

// Approved public columns only (per migration 0025b ACL)
export interface FacilityListItem {
  mgt_no: string;
  name: string;
  business_type: string | null;
  status: string;
  region_sido: string | null;
  region_sigungu: string | null;
  is_haccp: boolean;
  tel: string | null;
  homepage: string | null;
  created_at: string | null;
  ingest_run_id: string | null;
}

export interface FacilitySearchInput {
  q?: string;
  sido?: string;
  businessType?: string;
  haccp?: boolean;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicDataError {
  code: "FG_BAD_REQUEST" | "FG_DATA_UNAVAILABLE";
  message: string;
  retryable: boolean;
  fallback: "adjust-input" | "retry";
}

export type FacilitySearchOutcome =
  | {
      ok: true;
      data: FacilityListItem[];
      meta: { page: number; pageSize: number; total: number };
      traceId: string;
    }
  | { ok: false; error: PublicDataError; traceId: string };

export type FacilityDetailOutcome =
  | { ok: true; data: FacilityListItem | null; traceId: string }
  | { ok: false; error: PublicDataError; traceId: string };

function sanitizeSearchTerm(value: string | undefined): string {
  return (value ?? "")
    .replace(/[,()*.:%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function sanitizeSelectValue(value: string | undefined): string {
  return sanitizeSearchTerm(value).slice(0, 30);
}

function unavailable(traceId: string): FacilitySearchOutcome {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "제조시설 정보를 불러오지 못했습니다.",
      retryable: true,
      fallback: "retry",
    },
    traceId,
  };
}

const SELECT_COLS =
  "mgt_no,name,business_type,status,region_sido,region_sigungu,is_haccp,tel,homepage,created_at";

export async function searchPublicFacilities(
  input: FacilitySearchInput,
): Promise<FacilitySearchOutcome> {
  const traceId = randomUUID();

  if (USE_FIXTURES) {
    const fixtures = fixtureData as FacilityListItem[];
    const q = sanitizeSearchTerm(input.q).toLowerCase();
    const filtered = fixtures.filter(
      (f) =>
        (!q || f.name.toLowerCase().includes(q)) &&
        (!input.sido || f.region_sido === input.sido) &&
        (!input.businessType || f.business_type === input.businessType) &&
        (!input.haccp || f.is_haccp) &&
        (input.status === "all"
          ? true
          : !input.status
            ? f.status.startsWith("영업")
            : f.status === input.status),
    );
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 20)));
    const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { ok: true, data: sliced, meta: { page, pageSize, total: filtered.length }, traceId };
  }

  const q = sanitizeSearchTerm(input.q);
  const sido = sanitizeSelectValue(input.sido);
  const businessType = sanitizeSelectValue(input.businessType);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? PAGE_SIZE)),
  );
  const offset = (page - 1) * pageSize;

  try {
    const supabase = createPublicServerClient();
    let query = supabase
      .from("facilities")
      .select(SELECT_COLS, { count: "exact" });

    // Apply status filter: "all" = no filter, undefined/"" = default to 영업%, specific value = exact match
    if (input.status === "all") {
      // no status filter — return all records regardless of status
    } else if (!input.status) {
      query = query.ilike("status", "영업%");
    } else {
      query = query.eq("status", input.status);
    }

    if (q) query = query.ilike("name", `%${q}%`);
    if (sido) query = query.eq("region_sido", sido);
    if (businessType) query = query.eq("business_type", businessType);
    if (input.haccp) query = query.eq("is_haccp", true);

    const { data, count, error } = await query
      .order("name", { ascending: true })
      .order("mgt_no", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (error.code === "PGRST103") {
        let countQuery = supabase
          .from("facilities")
          .select("mgt_no", { count: "exact", head: true });
        if (input.status === "all") {
          // no status filter
        } else if (!input.status) {
          countQuery = countQuery.ilike("status", "영업%");
        } else {
          countQuery = countQuery.eq("status", input.status);
        }
        if (q) countQuery = countQuery.ilike("name", `%${q}%`);
        if (sido) countQuery = countQuery.eq("region_sido", sido);
        if (businessType) countQuery = countQuery.eq("business_type", businessType);
        if (input.haccp) countQuery = countQuery.eq("is_haccp", true);
        const { count: total, error: countError } = await countQuery;
        if (!countError) {
          return { ok: true, data: [], meta: { page, pageSize, total: total ?? 0 }, traceId };
        }
      }
      console.warn("[facility-search] query failed", {
        traceId,
        providerCode: error.code,
      });
      return unavailable(traceId);
    }

    return {
      ok: true,
      data: (data ?? []) as FacilityListItem[],
      meta: { page, pageSize, total: count ?? 0 },
      traceId,
    };
  } catch (err) {
    console.warn("[facility-search] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return unavailable(traceId);
  }
}

export async function getPublicFacility(
  mgtNo: string,
): Promise<FacilityDetailOutcome> {
  const traceId = randomUUID();
  const safeId = mgtNo.trim().slice(0, 80);

  if (USE_FIXTURES) {
    const fixtures = fixtureData as FacilityListItem[];
    const found = fixtures.find((f) => f.mgt_no === safeId) ?? null;
    return { ok: true, data: found, traceId };
  }

  if (!safeId || !/^[0-9A-Za-z_-]+$/.test(safeId)) {
    return {
      ok: false,
      error: {
        code: "FG_BAD_REQUEST",
        message: "제조시설 식별자가 올바르지 않습니다.",
        retryable: false,
        fallback: "adjust-input",
      },
      traceId,
    };
  }

  try {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase
      .from("facilities")
      .select(SELECT_COLS)
      .eq("mgt_no", safeId)
      .maybeSingle();

    if (error) {
      console.warn("[facility-detail] query failed", {
        traceId,
        providerCode: error.code,
      });
      return {
        ok: false,
        error: {
          code: "FG_DATA_UNAVAILABLE",
          message: "제조시설 정보를 불러오지 못했습니다.",
          retryable: true,
          fallback: "retry",
        },
        traceId,
      };
    }

    return { ok: true, data: data as FacilityListItem | null, traceId };
  } catch (err) {
    console.warn("[facility-detail] unavailable", {
      traceId,
      reason: err instanceof Error ? err.name : "UnknownError",
    });
    return {
      ok: false,
      error: {
        code: "FG_DATA_UNAVAILABLE",
        message: "제조시설 정보를 불러오지 못했습니다.",
        retryable: true,
        fallback: "retry",
      },
      traceId,
    };
  }
}
