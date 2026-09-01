import "server-only";

import categorySnapshot from "../data/derived/chg-g6-002/product_category_top30.json";
import { createPublicServerClient } from "./supabase-public-server";
import type {
  FacilityEvidenceBundle,
  HaccpEvidence,
  ProductSearchResult,
  SafetyEvidence,
  SourceFacilitySummary,
  SourceFacilitySummaryMap,
  SourceOutcome,
  SourceProductDetail,
  SourceProductListItem,
} from "./source-db";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 60;

function sanitizeSearchTerm(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function safeIdentifier(value: string): string {
  return value.trim().slice(0, 100);
}


function unavailable(traceId: string): SourceOutcome<never> {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "원본 데이터를 불러오지 못했습니다.",
      retryable: true,
    },
    traceId,
  };
}

function badRequest<T>(traceId: string, message: string): SourceOutcome<T> {
  return { ok: false, error: { code: "FG_BAD_REQUEST", message, retryable: false }, traceId };
}

// ---------------------------------------------------------------------------
// Row type helpers
// ---------------------------------------------------------------------------

type SupabaseProductRow = {
  report_no: string;
  product_name: string;
  category: string | null;
  maker_name: string | null;
  ingredients: string | null;
  shelf_life_days: number | null;
  facility_mgt_no: string | null;
  reported_at: string | null;
  updated_at: string | null;
  facilities: {
    name: string;
    status: string | null;
    region_sido: string | null;
    region_sigungu: string | null;
    is_haccp: boolean;
  } | null;
};

type SupabaseFacilityRow = {
  mgt_no: string;
  name: string;
  business_type: string | null;
  status: string | null;
  tel: string | null;
  homepage: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  is_haccp: boolean;
};

type SupabaseHaccpRow = {
  cert_no: string | null;
  cert_date: string | null;
  ccp_list: string | null;
  source_updated_at: string | null;
};

function mapProduct(row: SupabaseProductRow): SourceProductListItem {
  return {
    report_no: row.report_no,
    product_name: row.product_name,
    category: row.category,
    maker_name: row.maker_name,
    ingredients: row.ingredients,
    shelf_life_days: row.shelf_life_days,
    reported_at: row.reported_at,
    facility_mgt_no: row.facility_mgt_no,
    facility_name: row.facilities?.name ?? null,
    facility_status: row.facilities?.status ?? null,
    facility_region_sido: row.facilities?.region_sido ?? null,
    facility_region_sigungu: row.facilities?.region_sigungu ?? null,
    facility_is_haccp: row.facilities?.is_haccp ?? false,
  };
}

function mapFacility(row: SupabaseFacilityRow): SourceFacilitySummary {
  return {
    mgt_no: row.mgt_no,
    name: row.name,
    business_type: row.business_type,
    status: row.status,
    tel: row.tel,
    homepage: row.homepage,
    region_sido: row.region_sido,
    region_sigungu: row.region_sigungu,
    is_haccp: row.is_haccp,
    updated_at: null, // not exposed in public Supabase boundary
  };
}

function mapHaccp(row: SupabaseHaccpRow): HaccpEvidence {
  return {
    cert_no: row.cert_no,
    cert_date: row.cert_date,
    ccp_list: row.ccp_list,
    updated_at: row.source_updated_at,
  };
}

// ---------------------------------------------------------------------------
// Reusable select strings
// ---------------------------------------------------------------------------

const PRODUCT_COLS = "report_no,product_name,category,maker_name,ingredients,shelf_life_days,facility_mgt_no,reported_at,updated_at";
const FACILITY_EMBED = "facilities(name,status,region_sido,region_sigungu,is_haccp)";
const FACILITY_EMBED_INNER = "facilities!inner(name,status,region_sido,region_sigungu,is_haccp)";
const FACILITY_COLS = "mgt_no,name,business_type,status,tel,homepage,region_sido,region_sigungu,is_haccp";
const HACCP_COLS = "cert_no,cert_date,ccp_list,source_updated_at";
const SAFETY_COLS = "product_name,reason,method,batch_mfg_date,batch_exp_date,barcode,product_code,image_url,published_at";

// ---------------------------------------------------------------------------
// searchSourceProducts via Supabase
// ---------------------------------------------------------------------------

export async function searchSourceProductsViaSupabase(
  input: {
    q?: string;
    category?: string;
    facility?: string;
    haccp?: boolean;
    page?: number;
    pageSize?: number;
  },
  traceId: string,
): Promise<SourceOutcome<ProductSearchResult>> {
  const q = sanitizeSearchTerm(input.q);
  const category = sanitizeSearchTerm(input.category);
  const facility = safeIdentifier(input.facility ?? "");
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)));
  const offset = (page - 1) * pageSize;

  try {
    const supabase = createPublicServerClient();
    const facilityEmbed = input.haccp ? FACILITY_EMBED_INNER : FACILITY_EMBED;
    let matchedFacilityIds: string[] = [];

    // Company-name searches must resolve through the facility relation first.
    // products_public is indexed for product_name full-text search, while the
    // company label lives on public.facilities.  Looking up the small set of
    // matching facility keys keeps the 1M-row product query indexed and makes
    // the UI promise (product / company search) accurate.
    if (q) {
      const { data: facilityMatches, error: facilityMatchError } = await supabase
        .from("facilities")
        .select("mgt_no")
        .ilike("name", `%${q}%`)
        .limit(50);
      if (facilityMatchError) {
        console.warn("[supabase-products] facility-name lookup failed", {
          traceId,
          providerCode: facilityMatchError.code,
        });
        return unavailable(traceId);
      }
      matchedFacilityIds = (facilityMatches ?? []).map((row) => row.mgt_no as string);
    }
    const countMode: "exact" | "planned" = matchedFacilityIds.length > 0 ? "exact" : "planned";
    // @MX:NOTE: count="planned" uses Postgres EXPLAIN estimate — avoids seq-scan timeout on 1M rows.
    // Exact count with reported_at ORDER caused PG 57014 (~3.9s). report_no is the PK index.
    let query = supabase
      .from("products_public")
      .select(`${PRODUCT_COLS},${facilityEmbed}`, { count: countMode });

    if (q && matchedFacilityIds.length > 0) {
      query = query.in("facility_mgt_no", matchedFacilityIds);
    } else if (q) {
      // textSearch uses the GIN index on product_name with simple config (plainto_tsquery equivalent).
      // Covers Korean single-word and multi-word queries (e.g. 김치).
      // Company names are handled by the facility-key lookup above.
      query = query.textSearch("product_name", q, { config: "simple", type: "plain" });
    }
    if (category) query = query.eq("category", category);
    if (facility) query = query.eq("facility_mgt_no", facility);
    if (input.haccp) query = query.eq("facilities.is_haccp", true);

    const { data, count, error } = await query
      .order("report_no", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("[supabase-products] query failed", { traceId, providerCode: error.code });
      return unavailable(traceId);
    }

    const items = ((data ?? []) as unknown as SupabaseProductRow[]).map(mapProduct);
    return { ok: true, data: { items, meta: { page, pageSize, total: count ?? 0, totalIsEstimate: countMode === "planned" } }, traceId };
  } catch (err) {
    console.warn("[supabase-products] unavailable", { traceId, reason: err instanceof Error ? err.name : "UnknownError" });
    return unavailable(traceId);
  }
}

// ---------------------------------------------------------------------------
// getSourceProduct via Supabase
// ---------------------------------------------------------------------------

export async function getSourceProductViaSupabase(
  reportNo: string,
  traceId: string,
): Promise<SourceOutcome<SourceProductDetail | null>> {
  const safeReportNo = safeIdentifier(reportNo);
  if (!safeReportNo || !/^[0-9A-Za-z_-]+$/.test(safeReportNo)) {
    return badRequest(traceId, "제품 식별자가 올바르지 않습니다.");
  }

  try {
    const supabase = createPublicServerClient();

    const { data: product, error: productError } = await supabase
      .from("products_public")
      .select(`${PRODUCT_COLS},${FACILITY_EMBED}`)
      .eq("report_no", safeReportNo)
      .maybeSingle();

    if (productError) {
      console.warn("[supabase-product] query failed", { traceId, providerCode: productError.code });
      return unavailable(traceId);
    }
    if (!product) return { ok: true, data: null, traceId };

    const row = product as unknown as SupabaseProductRow;
    const facilityMgtNo = row.facility_mgt_no;

    let haccp: HaccpEvidence[] = [];
    let safety: SafetyEvidence[] = [];

    if (facilityMgtNo) {
      const [haccpRes, safetyRes] = await Promise.all([
        supabase
          .from("haccp_certifications_public")
          .select(HACCP_COLS)
          .eq("facility_mgt_no", facilityMgtNo)
          .order("cert_date", { ascending: false, nullsFirst: false }),
        supabase
          .from("facility_safety_public")
          .select(SAFETY_COLS)
          .eq("facility_mgt_no", facilityMgtNo)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(20),
      ]);
      if (haccpRes.error) {
        console.warn("[supabase-product] haccp subquery failed", { traceId, providerCode: haccpRes.error.code });
        return unavailable(traceId);
      }
      if (safetyRes.error) {
        console.warn("[supabase-product] safety subquery failed", { traceId, providerCode: safetyRes.error.code });
        return unavailable(traceId);
      }
      haccp = ((haccpRes.data ?? []) as unknown as SupabaseHaccpRow[]).map(mapHaccp);
      safety = (safetyRes.data ?? []) as SafetyEvidence[];
    }

    return { ok: true, data: { ...mapProduct(row), updated_at: row.updated_at, haccp, safety }, traceId };
  } catch (err) {
    console.warn("[supabase-product] unavailable", { traceId, reason: err instanceof Error ? err.name : "UnknownError" });
    return unavailable(traceId);
  }
}

// ---------------------------------------------------------------------------
// getSourceFacilityEvidence via Supabase
// ---------------------------------------------------------------------------

export async function getSourceFacilityEvidenceViaSupabase(
  mgtNo: string,
  traceId: string,
): Promise<SourceOutcome<FacilityEvidenceBundle | null>> {
  const safeMgtNo = safeIdentifier(mgtNo);
  if (!safeMgtNo || !/^[0-9A-Za-z_-]+$/.test(safeMgtNo)) {
    return badRequest(traceId, "제조시설 식별자가 올바르지 않습니다.");
  }

  try {
    const supabase = createPublicServerClient();

    const [facilityRes, productsRes, haccpRes, safetyRes] = await Promise.all([
      supabase.from("facilities").select(FACILITY_COLS).eq("mgt_no", safeMgtNo).maybeSingle(),
      supabase
        .from("products_public")
        .select("report_no,product_name,category,maker_name,ingredients,shelf_life_days,facility_mgt_no,reported_at,updated_at", { count: "planned" })
        .eq("facility_mgt_no", safeMgtNo)
        .order("report_no", { ascending: true })
        .limit(12),
      supabase
        .from("haccp_certifications_public")
        .select(HACCP_COLS)
        .eq("facility_mgt_no", safeMgtNo)
        .order("cert_date", { ascending: false, nullsFirst: false }),
      supabase
        .from("facility_safety_public")
        .select(SAFETY_COLS)
        .eq("facility_mgt_no", safeMgtNo)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

    if (facilityRes.error) {
      console.warn("[supabase-facility-evidence] facility query failed", { traceId, providerCode: facilityRes.error.code });
      return unavailable(traceId);
    }
    if (!facilityRes.data) return { ok: true, data: null, traceId };

    if (productsRes.error) {
      console.warn("[supabase-facility-evidence] products subquery failed", { traceId, providerCode: productsRes.error.code });
      return unavailable(traceId);
    }
    if (haccpRes.error) {
      console.warn("[supabase-facility-evidence] haccp subquery failed", { traceId, providerCode: haccpRes.error.code });
      return unavailable(traceId);
    }
    if (safetyRes.error) {
      console.warn("[supabase-facility-evidence] safety subquery failed", { traceId, providerCode: safetyRes.error.code });
      return unavailable(traceId);
    }

    const facility = mapFacility(facilityRes.data as unknown as SupabaseFacilityRow);
    const productTotal = productsRes.count ?? 0;

    // Products from products_public don't include facility columns in this query; fill from facility
    const products: SourceProductListItem[] = ((productsRes.data ?? []) as Array<{
      report_no: string;
      product_name: string;
      category: string | null;
      maker_name: string | null;
      ingredients: string | null;
      shelf_life_days: number | null;
      facility_mgt_no: string | null;
      reported_at: string | null;
      updated_at: string | null;
    }>).map((p) => ({
      report_no: p.report_no,
      product_name: p.product_name,
      category: p.category,
      maker_name: p.maker_name,
      ingredients: p.ingredients,
      shelf_life_days: p.shelf_life_days,
      reported_at: p.reported_at,
      facility_mgt_no: p.facility_mgt_no,
      facility_name: facility.name,
      facility_status: facility.status,
      facility_region_sido: facility.region_sido,
      facility_region_sigungu: facility.region_sigungu,
      facility_is_haccp: facility.is_haccp,
    }));

    const haccp: HaccpEvidence[] = ((haccpRes.data ?? []) as unknown as SupabaseHaccpRow[]).map(mapHaccp);
    const safety: SafetyEvidence[] = (safetyRes.data ?? []) as SafetyEvidence[];

    return { ok: true, data: { facility, products, productTotal, haccp, safety }, traceId };
  } catch (err) {
    console.warn("[supabase-facility-evidence] unavailable", { traceId, reason: err instanceof Error ? err.name : "UnknownError" });
    return unavailable(traceId);
  }
}

// ---------------------------------------------------------------------------
// getSourceFacilitySummaries via Supabase
// ---------------------------------------------------------------------------

export async function getSourceFacilitySummariesViaSupabase(
  mgtNos: string[],
  traceId: string,
): Promise<SourceOutcome<SourceFacilitySummaryMap>> {
  const identifiers = [...new Set(mgtNos.map(safeIdentifier).filter((v) => /^[0-9A-Za-z_-]+$/.test(v)))].slice(0, 100);
  if (identifiers.length === 0) return { ok: true, data: {}, traceId };

  try {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase
      .from("facilities")
      .select(FACILITY_COLS)
      .in("mgt_no", identifiers);

    if (error) {
      console.warn("[supabase-facility-summaries] query failed", { traceId, providerCode: error.code });
      return unavailable(traceId);
    }

    const result: SourceFacilitySummaryMap = {};
    for (const row of (data ?? []) as unknown as SupabaseFacilityRow[]) {
      result[row.mgt_no] = mapFacility(row);
    }
    return { ok: true, data: result, traceId };
  } catch (err) {
    console.warn("[supabase-facility-summaries] unavailable", { traceId, reason: err instanceof Error ? err.name : "UnknownError" });
    return unavailable(traceId);
  }
}

// ---------------------------------------------------------------------------
// listSourceProductCategories via Supabase
// @MX:NOTE: Aggregate snapshot — top 30 product categories ranked by filing count.
// Source: production_log (1,047,894 rows); source_db_sha256 recorded in
// data/derived/chg-g6-002/product_category_top30.json (non-sensitive aggregate artifact).
// Query: SELECT category, COUNT(*) n FROM production_log
//        WHERE category IS NOT NULL AND length(trim(category)) > 0
//        GROUP BY category ORDER BY n DESC, category ASC LIMIT 30
// Replaces the 30-sequential-request PostgREST keyset loop (028B) that caused
// ~7.75s first-load latency. No Supabase round-trips at runtime.
// ---------------------------------------------------------------------------

// @MX:NOTE: PRODUCT_CATEGORY_SNAPSHOT — validated at module load from JSON; rank-ordered names only, no counts. Safe for UI.
function buildCategorySnapshot(): readonly string[] {
  const rows = categorySnapshot.categories;
  if (rows.length !== 30) throw new Error("product_category_top30: expected 30 rows");
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rank !== i + 1) throw new Error("product_category_top30: ranks must be exactly 1..30");
    const name = row.name?.trim();
    if (!name) throw new Error("product_category_top30: empty category name");
    if (!Number.isInteger(row.count) || row.count <= 0) throw new Error("product_category_top30: count must be a positive integer");
    if (seen.has(name)) throw new Error("product_category_top30: duplicate category name");
    seen.add(name);
  }
  return rows.map((r) => r.name);
}

const PRODUCT_CATEGORY_SNAPSHOT: readonly string[] = buildCategorySnapshot();

export async function listSourceProductCategoriesViaSupabase(limit = 30): Promise<string[]> {
  const bound = Math.min(50, Math.max(1, limit));
  return PRODUCT_CATEGORY_SNAPSHOT.slice(0, bound) as string[];
}

// ---------------------------------------------------------------------------
// loadManufacturingProfilesViaSupabase
// Reads manufacturing_profiles_public (linked rows only, 265 rows in Approval C baseline).
// excludedReviewCount = 43: documented aggregate baseline (43 excluded review profiles per VS-C QA).
// Private mapping is not accessible via anon key; the 43 figure is returned as a constant.
// ---------------------------------------------------------------------------

export interface LinkedProfileSupabase {
  companyId: string;
  companyName: string;
  facilityMgtNo: string;
  items: string[];
  ccpCodes: string[];
  hasCookingCcp: boolean;
  hasSterilizeCcp: boolean;
  region: string | null;
  matchBasis: string;
}

export async function loadManufacturingProfilesViaSupabase(): Promise<{
  linked: LinkedProfileSupabase[];
  excludedReviewCount: number;
}> {
  const supabase = createPublicServerClient();
  const { data, error } = await supabase
    .from("manufacturing_profiles_public")
    .select("company_id,company_name,facility_mgt_no,item_set,ccp_set_std,has_cooking_ccp,has_sterilize_ccp,sido,match_basis")
    .order("company_id", { ascending: true });

  if (error) throw new Error(`manufacturing_profiles_public query failed: ${error.code}`);

  const CCP_CODE_PATTERN = /^CCP-S\d+$/;
  const linked: LinkedProfileSupabase[] = (data ?? []).map((row) => ({
    companyId: row.company_id as string,
    companyName: row.company_name as string,
    facilityMgtNo: row.facility_mgt_no as string,
    items: (row.item_set as string).split("|").map((v) => v.trim()).filter(Boolean),
    ccpCodes: ((row.ccp_set_std as string | null) ?? "").split("|").map((v) => v.trim()).filter((v) => CCP_CODE_PATTERN.test(v)),
    hasCookingCcp: row.has_cooking_ccp === true,
    hasSterilizeCcp: row.has_sterilize_ccp === true,
    region: (row.sido as string | null)?.trim() || null,
    matchBasis: row.match_basis as string,
  }));

  // 43 = excluded review profiles per docs/qa/chg-g6-002-vs-c-manufacturing-brief-match.md + data/derived/chg-g6-002/mapping_summary.json
  return { linked, excludedReviewCount: 43 };
}
