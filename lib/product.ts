import { unstable_cache } from "next/cache";
import supabase from "./supabase";
import type { ProductCard, ProductSearchParams, ProductSearchResult } from "./types";

const PAGE_SIZE = 20;
const MAX_Q_LEN = 50;

// PostgREST `or()` 필터는 쉼표·괄호·별표·점·콜론을 문법 토큰으로 사용하므로
// 사용자 입력에서 이들을 제거해 인젝션·구문 파괴를 방지한다.
function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()*.:%\\]/g, " ") // 메타문자 제거 (+ % 와 \도 안전하게 처리)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_Q_LEN);
}

const EMPTY_RESULT = (page: number): ProductSearchResult => ({
  products: [],
  total: 0,
  page,
  pageSize: PAGE_SIZE,
});

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
  const { q, category, page = 1 } = params;
  const offset = (page - 1) * PAGE_SIZE;
  const trimmed = q ? sanitizeSearchTerm(q) : "";

  try {
    // 1단계: production_log 검색
    // count: "estimated" — 1M+ 행에서 exact 카운트는 시퀀셜 스캔 + 타임아웃 위험.
    // pg_class.reltuples 기반 통계 추정치로 충분히 페이지네이션 가능.
    let query = supabase
      .from("production_log")
      .select(
        "report_no,product_name,category,maker_name,reported_at,facility_mgt_no",
        { count: "estimated" }
      );

    if (trimmed) {
      const pattern = `%${trimmed}%`;
      query = query.or(
        `product_name.ilike.${pattern},category.ilike.${pattern},maker_name.ilike.${pattern}`
      );
    }
    if (category) query = query.eq("category", category);

    const { data, count, error } = await query
      .order("reported_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[searchProducts] supabase error:", error.message, error.details);
      return EMPTY_RESULT(page);
    }

    // 2단계: 해당 페이지의 업체 정보 일괄 조회
    const mgtNos = [
      ...new Set((data ?? []).map((r) => r.facility_mgt_no).filter(Boolean)),
    ];
    const facilityMap = new Map<string, Record<string, unknown>>();

    if (mgtNos.length > 0) {
      const { data: facilities, error: fErr } = await supabase
        .from("facility")
        .select("mgt_no,name,region_sido,region_sigungu,is_haccp")
        .in("mgt_no", mgtNos);
      if (fErr) {
        console.error("[searchProducts] facility lookup error:", fErr.message);
      } else {
        for (const f of facilities ?? [])
          facilityMap.set(f.mgt_no, f as Record<string, unknown>);
      }
    }

    const products = (data ?? []).map((row) => {
      const f = row.facility_mgt_no ? facilityMap.get(row.facility_mgt_no) : undefined;
      return {
        report_no: row.report_no,
        product_name: row.product_name,
        category: row.category,
        maker_name: row.maker_name,
        reported_at: row.reported_at,
        facility_mgt_no: row.facility_mgt_no ?? "",
        facility_name: (f?.name as string) ?? "",
        facility_region: f
          ? [f.region_sido, f.region_sigungu].filter(Boolean).join(" ")
          : null,
        facility_is_haccp: (f?.is_haccp as number) ?? 0,
      } as ProductCard;
    });

    return { products, total: count ?? 0, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("[searchProducts] unexpected error:", err);
    return EMPTY_RESULT(page);
  }
}

export const getTopCategories = unstable_cache(
  async (limit = 30): Promise<string[]> => {
    const { data } = await supabase.rpc("get_top_categories", { lim: limit });
    return (data ?? []).map((r: { category: string }) => r.category);
  },
  ["top-categories"],
  { revalidate: 86400 }
);
