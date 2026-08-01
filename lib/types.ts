// @MX:ANCHOR: [AUTO] Core domain types — imported by facility.ts, API routes, and future UI layer
// @MX:REASON: Fan-in >= 3: lib/facility.ts, app/api/search/route.ts, app/api/healthz/route.ts

// ---------------------------------------------------------------------------
// Raw DB entities
// ---------------------------------------------------------------------------

export interface Facility {
  mgt_no: string;
  local_gov_code: string | null;
  name: string;
  biz_type: string | null;
  status: string;
  status_detail: string | null;
  licensed_at: string | null;
  closed_at: string | null;
  tel: string | null;
  road_addr: string | null;
  lot_addr: string | null;
  road_postal: string | null;
  coord_x: number | null;
  coord_y: number | null;
  homepage: string | null;
  updated_at: string | null;
  ingest_gubun: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  region_dong: string | null;
  is_haccp: number;
  suspension_count: number;
}

export interface ProductionLog {
  report_no: string;
  facility_mgt_no: string | null;
  product_name: string;
  category: string | null;
  maker_name: string | null;
  maker_addr: string | null;
  ingredients: string | null;
  shelf_life_days: number | null;
  reported_at: string | null;
  updated_at: string | null;
}

export interface HaccpCert {
  id: number;
  facility_mgt_no: string | null;
  biz_name: string;
  biz_addr: string | null;
  cert_no: string | null;
  cert_date: string | null;
  ccp_list: string | null;
  raw_payload: string | null;
  updated_at: string | null;
}

export interface SalesSuspension {
  id: number;
  facility_mgt_no: string | null;
  product_name: string;
  maker_name: string | null;
  maker_addr: string | null;
  reason: string | null;
  method: string | null;
  batch_mfg_date: string | null;
  batch_exp_date: string | null;
  barcode: string | null;
  product_code: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string | null;
}

export interface Alert {
  id: number;
  user_id: number;
  facility_mgt_no: string;
  alert_type: string;
  title: string;
  detail: string | null;
  ref_id: number | null;
  created_at: string | null;
  read_at: string | null;
}

export interface WatchlistItem {
  id: number;
  user_id: number;
  facility_mgt_no: string;
  created_at: string | null;
}

export interface IngestLog {
  id: number;
  dataset: string;
  started_at: string;
  finished_at: string | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  rows_deleted: number | null;
  status: string | null;
  error_message: string | null;
}

// ---------------------------------------------------------------------------
// View / projection types
// ---------------------------------------------------------------------------

/** Subset used in list/search results to minimise payload */
export interface FacilityCard {
  mgt_no: string;
  name: string;
  biz_type: string | null;
  status: string;
  region_sido: string | null;
  region_sigungu: string | null;
  is_haccp: number;
  suspension_count: number;
  tel: string | null;
}

/** Full detail object returned from getFacilityDetail */
export interface FacilityDetail extends FacilityCard {
  road_addr: string | null;
  coord_x: number | null;
  coord_y: number | null;
  homepage: string | null;
  production_logs: ProductionLog[];
  haccp_cert: HaccpCert | null;
  last_synced: string | null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchParams {
  q?: string;
  sido?: string;
  sigungu?: string;
  bizType?: string;
  haccp?: boolean;
  suspension?: "none" | "has";
  page?: number;
}

export interface SearchResult {
  facilities: FacilityCard[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Product search
// ---------------------------------------------------------------------------

export interface ProductCard {
  report_no: string;
  product_name: string;
  category: string | null;
  maker_name: string | null;
  reported_at: string | null;
  facility_mgt_no: string;
  facility_name: string;
  facility_region: string | null;
  facility_is_haccp: number;
}

export interface ProductSearchParams {
  q?: string;
  category?: string;
  page?: number;
}

export interface ProductSearchResult {
  products: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

export interface SyncStatus {
  facility_at: string;
  production_at: string;
  haccp_at: string;
  suspension_at: string;
}
