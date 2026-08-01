import { unstable_cache } from "next/cache";
import supabase from "./supabase";
import type {
  FacilityCard,
  FacilityDetail,
  HaccpCert,
  ProductionLog,
  SearchParams,
  SearchResult,
  SyncStatus,
} from "./types";

const PAGE_SIZE = 20;

export async function searchFacilities(params: SearchParams): Promise<SearchResult> {
  const { q, sido, sigungu, bizType, haccp, suspension, page = 1 } = params;
  const offset = (page - 1) * PAGE_SIZE;
  const trimmed = q?.trim();

  let query = supabase
    .from("facility")
    .select(
      "mgt_no,name,biz_type,status,region_sido,region_sigungu,is_haccp,suspension_count,tel",
      { count: "exact" }
    )
    .like("status", "영업%");

  if (sido) query = query.eq("region_sido", sido);
  if (sigungu) query = query.eq("region_sigungu", sigungu);
  if (bizType) query = query.eq("biz_type", bizType);
  if (haccp) query = query.eq("is_haccp", 1);
  if (suspension === "none") query = query.eq("suspension_count", 0);
  if (suspension === "has") query = query.gt("suspension_count", 0);
  if (trimmed) {
    query = query.or(`name.ilike.%${trimmed}%,road_addr.ilike.%${trimmed}%`);
  }

  const { data, count, error } = await query
    .order("name")
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  return {
    facilities: (data ?? []) as FacilityCard[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getFacilityDetail(mgtNo: string): Promise<FacilityDetail | null> {
  const [facilityRes, productionRes, haccpRes, syncRes] = await Promise.all([
    supabase
      .from("facility")
      .select("mgt_no,name,biz_type,status,region_sido,region_sigungu,is_haccp,suspension_count,tel,road_addr,coord_x,coord_y,homepage")
      .eq("mgt_no", mgtNo)
      .maybeSingle(),
    supabase
      .from("production_log")
      .select("report_no,facility_mgt_no,product_name,category,maker_name,maker_addr,ingredients,shelf_life_days,reported_at,updated_at")
      .eq("facility_mgt_no", mgtNo)
      .order("reported_at", { ascending: false })
      .limit(10),
    supabase
      .from("haccp_cert")
      .select("id,facility_mgt_no,biz_name,biz_addr,cert_no,cert_date,ccp_list,raw_payload,updated_at")
      .eq("facility_mgt_no", mgtNo)
      .order("cert_date", { ascending: false })
      .limit(1),
    supabase
      .from("ingest_log")
      .select("finished_at")
      .eq("status", "ok")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  if (!facilityRes.data) return null;

  return {
    ...facilityRes.data,
    production_logs: (productionRes.data ?? []) as ProductionLog[],
    haccp_cert: (haccpRes.data?.[0] ?? null) as HaccpCert | null,
    last_synced: syncRes.data?.[0]?.finished_at ?? null,
  };
}

export async function autocomplete(q: string): Promise<FacilityCard[]> {
  if (!q?.trim()) return [];
  const { data } = await supabase
    .from("facility")
    .select("mgt_no,name,biz_type,status,region_sido,region_sigungu,is_haccp,suspension_count,tel")
    .like("status", "영업%")
    .ilike("name", `%${q.trim()}%`)
    .order("name")
    .limit(10);
  return (data ?? []) as FacilityCard[];
}

export const getSyncStatus = unstable_cache(
  async (): Promise<SyncStatus> => {
    try {
      const { data } = await supabase
        .from("ingest_log")
        .select("dataset,finished_at")
        .eq("status", "ok")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false });

      const map = new Map<string, string>();
      for (const row of data ?? []) {
        if (!map.has(row.dataset)) map.set(row.dataset, row.finished_at);
      }
      return {
        facility_at: map.get("facility") ?? "",
        production_at: map.get("production") ?? "",
        haccp_at: map.get("haccp") ?? "",
        suspension_at: map.get("suspension") ?? "",
      };
    } catch {
      return { facility_at: "", production_at: "", haccp_at: "", suspension_at: "" };
    }
  },
  ["sync-status"],
  { revalidate: 3600 }
);
