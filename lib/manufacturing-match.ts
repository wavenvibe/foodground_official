import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getSourceFacilitySummaries,
  isSupabaseActive,
  type SourceDataError,
  type SourceFacilitySummary,
  type SourceOutcome,
} from "@/lib/source-db";
import { loadManufacturingProfilesViaSupabase } from "@/lib/supabase-source";

const DEFAULT_PROFILE_PATH = path.join(
  process.cwd(),
  "03_공동제조 매칭 정확도(F1 SCORE)",
  "03_테스트데이터셋",
  "company_profiles.csv",
);
const DEFAULT_MAPPING_PATH = path.join(
  process.cwd(),
  "data",
  "derived",
  "chg-g6-002",
  "company_profile_facility_mapping.csv",
);
const MAX_CANDIDATES = 50;

export const CCP_OPTIONS = [
  ["CCP-S01", "원료입고", "원재료 입고 시 이물·규격 검사"],
  ["CCP-S02", "원료보관", "냉장·냉동 등 입고 후 원료 보관"],
  ["CCP-S03", "원료전처리", "세척·절단·해동 등 가공 준비"],
  ["CCP-S04", "배합·혼합", "원료 배합, 혼합, 반죽"],
  ["CCP-S05", "가열·살균", "가열, 살균, 멸균, 스팀처리"],
  ["CCP-S06", "냉각", "가열 후 즉시 냉각"],
  ["CCP-S07", "성형·압출", "성형, 압출, 제면"],
  ["CCP-S08", "건조", "건조, 동결건조, 훈연 건조"],
  ["CCP-S09", "튀김·로스팅", "튀김, 볶음, 로스팅, 직화"],
  ["CCP-S10", "포장", "내포장, 외포장, 밀봉"],
  ["CCP-S11", "금속검출", "금속검출기, X-ray 이물 검사"],
  ["CCP-S12", "냉장·냉동보관", "완제품 냉장·냉동 관리"],
  ["CCP-S13", "출하", "출하 전 검사·운반"],
  ["CCP-S14", "세척·소독", "설비·용기 세척·소독"],
  ["CCP-S15", "여과·정제", "여과, 정제, 분리"],
  ["CCP-S16", "발효", "발효, 숙성"],
  ["CCP-S17", "조미·소스", "소스 제조, 조미, 코팅"],
  ["CCP-S99", "기타", "표준코드 외 별도 공정"],
] as const;

const CCP_CODE_SET = new Set<string>(CCP_OPTIONS.map(([code]) => code));
const CCP_LABELS = Object.fromEntries(CCP_OPTIONS.map(([code, label]) => [code, label]));

const REGION_ALIASES: Record<string, string> = {
  서울: "서울특별시", 서울특별시: "서울특별시",
  부산: "부산광역시", 부산광역시: "부산광역시",
  대구: "대구광역시", 대구광역시: "대구광역시",
  인천: "인천광역시", 인천광역시: "인천광역시",
  광주: "광주광역시", 광주광역시: "광주광역시",
  대전: "대전광역시", 대전광역시: "대전광역시",
  울산: "울산광역시", 울산광역시: "울산광역시",
  세종: "세종특별자치시", 세종특별자치시: "세종특별자치시",
  경기: "경기도", 경기도: "경기도",
  강원: "강원특별자치도", 강원도: "강원특별자치도", 강원특별자치도: "강원특별자치도",
  충북: "충청북도", 충청북도: "충청북도",
  충남: "충청남도", 충청남도: "충청남도",
  전북: "전북특별자치도", 전라북도: "전북특별자치도", 전북특별자치도: "전북특별자치도",
  전남: "전라남도", 전라남도: "전라남도",
  경북: "경상북도", 경상북도: "경상북도",
  경남: "경상남도", 경상남도: "경상남도",
  제주: "제주특별자치도", 제주도: "제주특별자치도", 제주특별자치도: "제주특별자치도",
};

interface ManufacturingProfile {
  companyId: string;
  companyName: string;
  items: string[];
  ccpCodes: string[];
  hasCookingCcp: boolean;
  hasSterilizeCcp: boolean;
  region: string | null;
}

interface ProfileMapping {
  companyId: string;
  status: string;
  facilityMgtNo: string | null;
  matchBasis: string;
  needsReview: boolean;
}

interface LinkedProfile extends ManufacturingProfile {
  facilityMgtNo: string;
  matchBasis: string;
}

export interface ManufacturingOption {
  value: string;
  count: number;
}

export interface ManufacturingOptions {
  itemTypes: ManufacturingOption[];
  regions: ManufacturingOption[];
  linkedProfileCount: number;
  excludedReviewCount: number;
}

export type EvidenceStatus = "match" | "unmet" | "unknown";

export interface ManufacturingEvidence {
  key: string;
  label: string;
  requiredValue: string;
  actualValue: string;
  status: EvidenceStatus;
}

export interface ManufacturingCandidate {
  companyId: string;
  companyName: string;
  facilityMgtNo: string;
  facility: SourceFacilitySummary | null;
  items: string[];
  ccpCodes: string[];
  hasCookingCcp: boolean;
  hasSterilizeCcp: boolean;
  region: string | null;
  matchBasis: string;
  verdict: "qualified" | "review";
  matchedEvidence: number;
  checkedEvidence: number;
  evidence: ManufacturingEvidence[];
}

export interface ManufacturingMatchInput {
  item: string;
  region?: string;
  requiredCcp?: string[];
  cookingRequired?: boolean;
  sterilizeRequired?: boolean;
  limit?: number;
}

export interface ManufacturingMatchResult {
  input: Required<Omit<ManufacturingMatchInput, "limit">>;
  candidates: ManufacturingCandidate[];
  totalItemMatched: number;
  qualifiedCount: number;
  reviewCount: number;
  excludedReviewProfiles: number;
  ruleVersion: "evidence-v0.1";
}

let profileCacheSqlite: { linked: LinkedProfile[]; excludedReviewCount: number } | null = null;
let profileCacheSupabase: { linked: LinkedProfile[]; excludedReviewCount: number } | null = null;

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function csvRecords(filePath: string): Record<string, string>[] {
  const rows = parseCsv(readFileSync(filePath, "utf8"));
  const headers = (rows.shift() ?? []).map((header, index) => index === 0 ? header.replace(/^\uFEFF/, "") : header);
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function canonicalRegion(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  return REGION_ALIASES[clean] ?? clean;
}

function loadLinkedProfilesSqlite(): { linked: LinkedProfile[]; excludedReviewCount: number } {
  if (profileCacheSqlite) return profileCacheSqlite;
  const explicitProfilePath = process.env.FOODGROUND_MANUFACTURING_PROFILE_CSV?.trim();
  const explicitMappingPath = process.env.FOODGROUND_MANUFACTURING_MAPPING_CSV?.trim();
  const profilePath = explicitProfilePath
    ? path.resolve(/* turbopackIgnore: true */ explicitProfilePath)
    : DEFAULT_PROFILE_PATH;
  const mappingPath = explicitMappingPath
    ? path.resolve(/* turbopackIgnore: true */ explicitMappingPath)
    : DEFAULT_MAPPING_PATH;

  const profiles = csvRecords(profilePath).map<ManufacturingProfile>((row) => ({
    companyId: row.company_id,
    companyName: row.company_name,
    items: row.item_set.split("|").map((value) => value.trim()).filter(Boolean),
    ccpCodes: row.ccp_set_std.split("|").map((value) => value.trim()).filter((value) => CCP_CODE_SET.has(value)),
    hasCookingCcp: row.has_cooking_ccp.toLowerCase() === "true",
    hasSterilizeCcp: row.has_sterilize_ccp.toLowerCase() === "true",
    region: canonicalRegion(row.sido),
  }));
  const mappings = csvRecords(mappingPath).map<ProfileMapping>((row) => ({
    companyId: row.company_id,
    status: row.status,
    facilityMgtNo: row.facility_mgt_no || null,
    matchBasis: row.match_basis,
    needsReview: row.needs_review.toLowerCase() === "true",
  }));
  const byCompany = new Map(mappings.map((mapping) => [mapping.companyId, mapping]));
  const linked: LinkedProfile[] = [];
  let excludedReviewCount = 0;
  for (const profile of profiles) {
    const mapping = byCompany.get(profile.companyId);
    if (!mapping || mapping.status !== "linked" || mapping.needsReview || !mapping.facilityMgtNo || mapping.facilityMgtNo.includes("|")) {
      excludedReviewCount += 1;
      continue;
    }
    linked.push({ ...profile, facilityMgtNo: mapping.facilityMgtNo, matchBasis: mapping.matchBasis });
  }
  profileCacheSqlite = { linked, excludedReviewCount };
  return profileCacheSqlite;
}

async function loadLinkedProfilesFromSupabase(): Promise<{ linked: LinkedProfile[]; excludedReviewCount: number }> {
  if (profileCacheSupabase) return profileCacheSupabase;
  const { linked: rows, excludedReviewCount } = await loadManufacturingProfilesViaSupabase();
  const linked: LinkedProfile[] = rows.map((row) => ({
    companyId: row.companyId,
    companyName: row.companyName,
    facilityMgtNo: row.facilityMgtNo,
    items: row.items,
    ccpCodes: row.ccpCodes,
    hasCookingCcp: row.hasCookingCcp,
    hasSterilizeCcp: row.hasSterilizeCcp,
    region: row.region,
    matchBasis: row.matchBasis,
  }));
  profileCacheSupabase = { linked, excludedReviewCount };
  return profileCacheSupabase;
}

async function loadLinkedProfilesAsync(): Promise<{ linked: LinkedProfile[]; excludedReviewCount: number }> {
  if (isSupabaseActive()) return loadLinkedProfilesFromSupabase();
  return loadLinkedProfilesSqlite();
}

function manufacturingUnavailable(traceId: string): SourceOutcome<never> {
  return {
    ok: false,
    error: {
      code: "FG_DATA_UNAVAILABLE",
      message: "공동제조 프로필 또는 시설 원본을 불러오지 못했습니다.",
      retryable: false,
    },
    traceId,
  };
}

function manufacturingBadRequest<T>(traceId: string, message: string): SourceOutcome<T> {
  const error: SourceDataError = { code: "FG_BAD_REQUEST", message, retryable: false };
  return { ok: false, error, traceId };
}

export async function getManufacturingOptions(): Promise<ManufacturingOptions> {
  const { linked, excludedReviewCount } = await loadLinkedProfilesAsync();
  const itemCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  for (const profile of linked) {
    for (const item of new Set(profile.items)) itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
    if (profile.region) regionCounts.set(profile.region, (regionCounts.get(profile.region) ?? 0) + 1);
  }
  const sortOptions = (entries: Iterable<[string, number]>): ManufacturingOption[] =>
    [...entries].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ko"));
  return {
    itemTypes: sortOptions(itemCounts),
    regions: sortOptions(regionCounts),
    linkedProfileCount: linked.length,
    excludedReviewCount,
  };
}

function addEvidence(
  evidence: ManufacturingEvidence[],
  key: string,
  label: string,
  requiredValue: string,
  actualValue: string | null,
  matches: boolean | null,
): void {
  evidence.push({
    key,
    label,
    requiredValue,
    actualValue: actualValue || "확인자료 없음",
    status: matches === null ? "unknown" : matches ? "match" : "unmet",
  });
}

export async function matchManufacturingCandidates(
  input: ManufacturingMatchInput,
): Promise<SourceOutcome<ManufacturingMatchResult>> {
  const traceId = randomUUID();
  const item = input.item.trim().slice(0, 80);
  if (!item) return manufacturingBadRequest(traceId, "제품유형을 선택해 주세요.");
  const requiredCcp = [...new Set(input.requiredCcp ?? [])].filter((code) => CCP_CODE_SET.has(code));
  const region = canonicalRegion(input.region) ?? "";
  const cookingRequired = input.cookingRequired === true;
  const sterilizeRequired = input.sterilizeRequired === true;
  const limit = Math.max(1, Math.min(MAX_CANDIDATES, Math.floor(input.limit ?? 30)));

  try {
    const { linked, excludedReviewCount } = await loadLinkedProfilesAsync();
    const itemMatched = linked.filter((profile) => profile.items.some((value) => normalize(value) === normalize(item)));
    const facilityOutcome = await getSourceFacilitySummaries(itemMatched.map((profile) => profile.facilityMgtNo));
    if (!facilityOutcome.ok) return facilityOutcome as SourceOutcome<ManufacturingMatchResult>;

    const candidates = itemMatched.map<ManufacturingCandidate>((profile) => {
      const facility = facilityOutcome.data[profile.facilityMgtNo] ?? null;
      const evidence: ManufacturingEvidence[] = [];
      addEvidence(evidence, "item", "제품유형", item, profile.items.join(", "), true);
      addEvidence(evidence, "facility", "시설·HACCP 직접 연결", "직접 연결", facility ? `${facility.name} · ${profile.matchBasis}` : null, facility ? true : null);
      if (region) {
        const actualRegion = canonicalRegion(facility?.region_sido) ?? profile.region;
        addEvidence(evidence, "region", "희망지역", region, actualRegion, actualRegion ? actualRegion === region : null);
      }
      for (const code of requiredCcp) {
        addEvidence(evidence, code, `필수 CCP · ${CCP_LABELS[code] ?? code}`, code, profile.ccpCodes.includes(code) ? code : profile.ccpCodes.join(", ") || null, profile.ccpCodes.includes(code));
      }
      if (cookingRequired) addEvidence(evidence, "cooking", "가열공정", "필요", profile.hasCookingCcp ? "보유" : "미보유", profile.hasCookingCcp);
      if (sterilizeRequired) addEvidence(evidence, "sterilize", "살균공정", "필요", profile.hasSterilizeCcp ? "보유" : "미보유", profile.hasSterilizeCcp);
      const matchedEvidence = evidence.filter((entry) => entry.status === "match").length;
      const hasUnmetOrUnknown = evidence.some((entry) => entry.status !== "match");
      return {
        companyId: profile.companyId,
        companyName: profile.companyName,
        facilityMgtNo: profile.facilityMgtNo,
        facility,
        items: profile.items,
        ccpCodes: profile.ccpCodes,
        hasCookingCcp: profile.hasCookingCcp,
        hasSterilizeCcp: profile.hasSterilizeCcp,
        region: profile.region,
        matchBasis: profile.matchBasis,
        verdict: hasUnmetOrUnknown ? "review" : "qualified",
        matchedEvidence,
        checkedEvidence: evidence.length,
        evidence,
      };
    }).sort((a, b) => {
      if (a.verdict !== b.verdict) return a.verdict === "qualified" ? -1 : 1;
      if (a.matchedEvidence !== b.matchedEvidence) return b.matchedEvidence - a.matchedEvidence;
      return a.companyName.localeCompare(b.companyName, "ko");
    });

    return {
      ok: true,
      data: {
        input: { item, region, requiredCcp, cookingRequired, sterilizeRequired },
        candidates: candidates.slice(0, limit),
        totalItemMatched: candidates.length,
        qualifiedCount: candidates.filter((candidate) => candidate.verdict === "qualified").length,
        reviewCount: candidates.filter((candidate) => candidate.verdict === "review").length,
        excludedReviewProfiles: excludedReviewCount,
        ruleVersion: "evidence-v0.1",
      },
      traceId,
    };
  } catch (error) {
    console.warn("[manufacturing-match] unavailable", { traceId, reason: error instanceof Error ? error.name : "UnknownError" });
    return manufacturingUnavailable(traceId);
  }
}
