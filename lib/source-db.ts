import "server-only";

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  isPublicProductExcluded,
  PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS,
} from "./product-publication";
import {
  searchSourceProductsViaSupabase,
  getSourceProductViaSupabase,
  getSourceFacilityEvidenceViaSupabase,
  getSourceFacilitySummariesViaSupabase,
  listSourceProductCategoriesViaSupabase,
} from "./supabase-source";

export function isSupabaseActive(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

// Returns true when exactly one of the two Supabase env vars is set (misconfiguration).
// Must fail-closed: no SQLite fallback allowed, return FG_DATA_UNAVAILABLE.
function isPartialSupabaseConfig(): boolean {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return hasUrl !== hasKey;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 60;

export type SourceDataErrorCode =
  | "FG_BAD_REQUEST"
  | "FG_DATA_UNAVAILABLE";

export interface SourceDataError {
  code: SourceDataErrorCode;
  message: string;
  retryable: boolean;
}

export type SourceOutcome<T> =
  | { ok: true; data: T; traceId: string }
  | { ok: false; error: SourceDataError; traceId: string };

export interface SourceProductListItem {
  report_no: string;
  product_name: string;
  category: string | null;
  maker_name: string | null;
  ingredients: string | null;
  shelf_life_days: number | null;
  reported_at: string | null;
  facility_mgt_no: string | null;
  facility_name: string | null;
  facility_status: string | null;
  facility_region_sido: string | null;
  facility_region_sigungu: string | null;
  facility_is_haccp: boolean;
}

export interface HaccpEvidence {
  cert_no: string | null;
  cert_date: string | null;
  ccp_list: string | null;
  updated_at: string | null;
}

export interface SafetyEvidence {
  product_name: string | null;
  reason: string | null;
  method: string | null;
  batch_mfg_date: string | null;
  batch_exp_date: string | null;
  barcode: string | null;
  product_code: string | null;
  image_url: string | null;
  published_at: string | null;
}

export interface SourceProductDetail extends SourceProductListItem {
  updated_at: string | null;
  haccp: HaccpEvidence[];
  safety: SafetyEvidence[];
}

export interface SourceFacilitySummary {
  mgt_no: string;
  name: string;
  business_type: string | null;
  status: string | null;
  tel: string | null;
  homepage: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  is_haccp: boolean;
  updated_at: string | null;
}

export interface FacilityEvidenceBundle {
  facility: SourceFacilitySummary;
  products: SourceProductListItem[];
  productTotal: number;
  haccp: HaccpEvidence[];
  safety: SafetyEvidence[];
}

export interface ProductSearchResult {
  items: SourceProductListItem[];
  /** totalIsEstimate: true when the total is a Postgres EXPLAIN estimate (Supabase planned count path). */
  meta: { page: number; pageSize: number; total: number; totalIsEstimate?: boolean };
}

export type SourceFacilitySummaryMap = Record<string, SourceFacilitySummary>;

function sourceUnavailable(traceId: string): SourceOutcome<never> {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message:
        "제품·스마트 HACCP 원본 데이터가 이 실행환경에 연결되지 않았습니다. FOODGROUND_SOURCE_DB를 읽기 전용 원본 DB 경로로 설정해 주세요.",
      retryable: false,
    },
    traceId,
  };
}

function badRequest<T>(traceId: string, message: string): SourceOutcome<T> {
  return {
    ok: false,
    error: { code: "FG_BAD_REQUEST", message, retryable: false },
    traceId,
  };
}

function sanitizeSearchTerm(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function safeIdentifier(value: string): string {
  return value.trim().slice(0, 100);
}

function withSourceDb<T>(work: (db: Database.Database) => T): T | null {
  const sourcePath = process.env.FOODGROUND_SOURCE_DB?.trim();
  if (!sourcePath) return null;

  const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    db.pragma("query_only = ON");
    return work(db);
  } finally {
    db.close();
  }
}

interface RawProductRow extends Omit<SourceProductListItem, "facility_is_haccp"> {
  facility_is_haccp: number | null;
}

interface RawFacilityRow extends Omit<SourceFacilitySummary, "is_haccp" | "business_type"> {
  biz_type: string | null;
  is_haccp: number | null;
}

function mapFacility(row: RawFacilityRow): SourceFacilitySummary {
  return {
    mgt_no: row.mgt_no,
    name: row.name,
    business_type: row.biz_type,
    status: row.status,
    tel: row.tel,
    homepage: row.homepage,
    region_sido: row.region_sido,
    region_sigungu: row.region_sigungu,
    is_haccp: row.is_haccp === 1,
    updated_at: row.updated_at,
  };
}

function mapProduct(row: RawProductRow): SourceProductListItem {
  return { ...row, facility_is_haccp: row.facility_is_haccp === 1 };
}

const PRODUCT_SELECT = `
  SELECT
    p.report_no,
    p.product_name,
    p.category,
    p.maker_name,
    p.ingredients,
    p.shelf_life_days,
    p.reported_at,
    p.facility_mgt_no,
    f.name AS facility_name,
    f.status AS facility_status,
    f.region_sido AS facility_region_sido,
    f.region_sigungu AS facility_region_sigungu,
    f.is_haccp AS facility_is_haccp
  FROM production_log p
  LEFT JOIN facility f ON f.mgt_no = p.facility_mgt_no
`;

export async function searchSourceProducts(input: {
  q?: string;
  category?: string;
  facility?: string;
  haccp?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<SourceOutcome<ProductSearchResult>> {
  const traceId = randomUUID();
  if (isSupabaseActive()) return searchSourceProductsViaSupabase(input, traceId);
  if (isPartialSupabaseConfig()) return sourceUnavailable(traceId);
  const q = sanitizeSearchTerm(input.q);
  const category = sanitizeSearchTerm(input.category);
  const facility = safeIdentifier(input.facility ?? "");
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize ?? PAGE_SIZE)));
  const offset = (page - 1) * pageSize;

  try {
    const result = withSourceDb((db) => {
      const where: string[] = [];
      const bindings: Record<string, string | number> = { limit: pageSize, offset };
      const excludedProductBindings = PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS.map((reportNo, index) => {
        const key = `excludedProduct${index}`;
        bindings[key] = reportNo;
        return `@${key}`;
      });
      where.push(`p.report_no NOT IN (${excludedProductBindings.join(",")})`);
      if (q) {
        where.push("(p.product_name LIKE @q ESCAPE char(92) OR p.category LIKE @q ESCAPE char(92) OR p.maker_name LIKE @q ESCAPE char(92))");
        bindings.q = `%${escapeLike(q)}%`;
      }
      if (category) {
        where.push("p.category = @category");
        bindings.category = category;
      }
      if (facility) {
        where.push("p.facility_mgt_no = @facility");
        bindings.facility = facility;
      }
      if (input.haccp) where.push("f.is_haccp = 1");
      const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

      const items = db
        .prepare(`${PRODUCT_SELECT}${clause} ORDER BY CASE WHEN p.reported_at <= date('now', '+1 day') THEN p.reported_at ELSE '' END DESC, p.report_no ASC LIMIT @limit OFFSET @offset`)
        .all(bindings) as RawProductRow[];
      const count = db
        .prepare(`SELECT COUNT(*) AS total FROM production_log p LEFT JOIN facility f ON f.mgt_no = p.facility_mgt_no${clause}`)
        .get(bindings) as { total: number };
      return { items: items.map(mapProduct), meta: { page, pageSize, total: count.total } };
    });
    if (!result) return sourceUnavailable(traceId);
    return { ok: true, data: result, traceId };
  } catch (error) {
    console.warn("[source-products] unavailable", { traceId, reason: error instanceof Error ? error.name : "UnknownError" });
    return sourceUnavailable(traceId);
  }
}

export async function getSourceProduct(reportNo: string): Promise<SourceOutcome<SourceProductDetail | null>> {
  const traceId = randomUUID();
  if (isSupabaseActive()) return getSourceProductViaSupabase(reportNo, traceId);
  if (isPartialSupabaseConfig()) return sourceUnavailable(traceId);
  const safeReportNo = safeIdentifier(reportNo);
  if (!safeReportNo || !/^[0-9A-Za-z_-]+$/.test(safeReportNo)) {
    return badRequest(traceId, "제품 식별자가 올바르지 않습니다.");
  }
  if (isPublicProductExcluded(safeReportNo)) {
    return { ok: true, data: null, traceId };
  }

  try {
    const result = withSourceDb((db) => {
      const row = db.prepare(`${PRODUCT_SELECT} WHERE p.report_no = ? LIMIT 1`).get(safeReportNo) as RawProductRow | undefined;
      if (!row) return null;
      const updated = db.prepare("SELECT updated_at FROM production_log WHERE report_no = ? LIMIT 1").get(safeReportNo) as { updated_at: string | null };
      const haccp = row.facility_mgt_no
        ? (db.prepare("SELECT cert_no, cert_date, ccp_list, updated_at FROM haccp_cert WHERE facility_mgt_no = ? ORDER BY COALESCE(cert_date, '') DESC").all(row.facility_mgt_no) as HaccpEvidence[])
        : [];
      const safety = row.facility_mgt_no
        ? (db.prepare("SELECT product_name, reason, method, batch_mfg_date, batch_exp_date, barcode, product_code, image_url, published_at FROM sales_suspension WHERE facility_mgt_no = ? AND (product_name = ? OR product_code = ?) ORDER BY COALESCE(published_at, '') DESC").all(row.facility_mgt_no, row.product_name, safeReportNo) as SafetyEvidence[])
        : [];
      return { ...mapProduct(row), updated_at: updated.updated_at, haccp, safety };
    });
    if (result === null && !process.env.FOODGROUND_SOURCE_DB?.trim()) return sourceUnavailable(traceId);
    return { ok: true, data: result, traceId };
  } catch (error) {
    console.warn("[source-product-detail] unavailable", { traceId, reason: error instanceof Error ? error.name : "UnknownError" });
    return sourceUnavailable(traceId);
  }
}

export async function getSourceFacilityEvidence(mgtNo: string): Promise<SourceOutcome<FacilityEvidenceBundle | null>> {
  const traceId = randomUUID();
  if (isSupabaseActive()) return getSourceFacilityEvidenceViaSupabase(mgtNo, traceId);
  if (isPartialSupabaseConfig()) return sourceUnavailable(traceId);
  const safeMgtNo = safeIdentifier(mgtNo);
  if (!safeMgtNo || !/^[0-9A-Za-z_-]+$/.test(safeMgtNo)) {
    return badRequest(traceId, "제조시설 식별자가 올바르지 않습니다.");
  }

  try {
    const result = withSourceDb((db) => {
      const rawFacility = db.prepare("SELECT mgt_no, name, biz_type, status, tel, homepage, region_sido, region_sigungu, is_haccp, updated_at FROM facility WHERE mgt_no = ? LIMIT 1").get(safeMgtNo) as RawFacilityRow | undefined;
      if (!rawFacility) return null;
      const facility = mapFacility(rawFacility);
      const excludedPlaceholders = PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS.map(() => "?").join(",");
      const products = (db.prepare(`${PRODUCT_SELECT} WHERE p.facility_mgt_no = ? AND p.report_no NOT IN (${excludedPlaceholders}) ORDER BY CASE WHEN p.reported_at <= date('now', '+1 day') THEN p.reported_at ELSE '' END DESC, p.report_no ASC LIMIT 12`).all(safeMgtNo, ...PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS) as RawProductRow[]).map(mapProduct);
      const productTotal = (db.prepare(`SELECT COUNT(*) AS total FROM production_log WHERE facility_mgt_no = ? AND report_no NOT IN (${excludedPlaceholders})`).get(safeMgtNo, ...PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS) as { total: number }).total;
      const haccp = db.prepare("SELECT cert_no, cert_date, ccp_list, updated_at FROM haccp_cert WHERE facility_mgt_no = ? ORDER BY COALESCE(cert_date, '') DESC").all(safeMgtNo) as HaccpEvidence[];
      const safety = db.prepare("SELECT product_name, reason, method, batch_mfg_date, batch_exp_date, barcode, product_code, image_url, published_at FROM sales_suspension WHERE facility_mgt_no = ? ORDER BY COALESCE(published_at, '') DESC LIMIT 20").all(safeMgtNo) as SafetyEvidence[];
      return { facility, products, productTotal, haccp, safety };
    });
    if (result === null && !process.env.FOODGROUND_SOURCE_DB?.trim()) return sourceUnavailable(traceId);
    return { ok: true, data: result, traceId };
  } catch (error) {
    console.warn("[source-facility-evidence] unavailable", { traceId, reason: error instanceof Error ? error.name : "UnknownError" });
    return sourceUnavailable(traceId);
  }
}

export async function getSourceFacilitySummaries(
  mgtNos: string[],
): Promise<SourceOutcome<SourceFacilitySummaryMap>> {
  const traceId = randomUUID();
  if (isSupabaseActive()) return getSourceFacilitySummariesViaSupabase(mgtNos, traceId);
  if (isPartialSupabaseConfig()) return sourceUnavailable(traceId);
  const identifiers = [...new Set(mgtNos.map(safeIdentifier).filter((value) => /^[0-9A-Za-z_-]+$/.test(value)))].slice(0, 100);
  if (identifiers.length === 0) return { ok: true, data: {}, traceId };

  try {
    const result = withSourceDb((db) => {
      const placeholders = identifiers.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT mgt_no, name, biz_type, status, tel, homepage, region_sido, region_sigungu, is_haccp, updated_at FROM facility WHERE mgt_no IN (${placeholders})`)
        .all(...identifiers) as RawFacilityRow[];
      return Object.fromEntries(rows.map((row) => [row.mgt_no, mapFacility(row)]));
    });
    if (!result) return sourceUnavailable(traceId);
    return { ok: true, data: result, traceId };
  } catch (error) {
    console.warn("[source-facility-summaries] unavailable", { traceId, reason: error instanceof Error ? error.name : "UnknownError" });
    return sourceUnavailable(traceId);
  }
}

export async function listSourceProductCategories(limit = 30): Promise<string[]> {
  if (isSupabaseActive()) return listSourceProductCategoriesViaSupabase(limit);
  if (isPartialSupabaseConfig()) return [];
  try {
    return (
      withSourceDb((db) =>
        (db.prepare(`SELECT category FROM production_log WHERE category IS NOT NULL AND TRIM(category) <> '' AND report_no NOT IN (${PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS.map(() => "?").join(",")}) GROUP BY category ORDER BY COUNT(*) DESC, category ASC LIMIT ?`).all(...PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS, Math.max(1, Math.min(50, limit))) as { category: string }[]).map((row) => row.category),
      ) ?? []
    );
  } catch {
    return [];
  }
}
