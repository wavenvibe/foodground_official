#!/usr/bin/env node
/**
 * warm_isr.ts — ISR 캐시 웜업 스크립트
 *
 * 실행 전 Next.js 개발/프로덕션 서버가 올라와 있어야 합니다.
 *
 * 사용법:
 *   npx tsx scripts/warm_isr.ts
 *   BASE_URL=https://yoursite.com npx tsx scripts/warm_isr.ts
 *
 * 동작:
 *   1) Supabase에서 production_log 품목 수 기준 상위 10개 시설 mgt_no 조회
 *   2) 각 /b/[mgt_no] 페이지에 GET 요청 → ISR 캐시 생성
 *   3) 결과 출력 (응답 코드·소요시간)
 */

import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const TOP_N = 10;

async function getTopFacilities(): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Fallback: use SQLite via local API if Supabase not configured
    const res = await fetch(`${BASE_URL}/api/top-facilities?limit=${TOP_N}`);
    if (res.ok) {
      const json = (await res.json()) as { mgt_no: string }[];
      return json.map((r) => r.mgt_no);
    }
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 환경변수 없음, /api/top-facilities API도 없음"
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // production_log 품목 수 기준 시설 순위
  const { data, error } = await supabase
    .from("production_log")
    .select("facility_mgt_no")
    .not("facility_mgt_no", "is", null)
    .limit(1000); // 집계 후 상위 N개

  if (error) throw new Error(`Supabase 오류: ${error.message}`);

  // 클라이언트 측 집계
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const k = row.facility_mgt_no as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([mgt_no]) => mgt_no);
}

async function warmPage(mgtNo: string): Promise<{ mgtNo: string; status: number; ms: number }> {
  const url = `${BASE_URL}/b/${encodeURIComponent(mgtNo)}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "FoodgroundISRWarm/1.0" },
  });
  return { mgtNo, status: res.status, ms: Date.now() - t0 };
}

async function main() {
  console.log(`[warm_isr] 대상 서버: ${BASE_URL}`);

  let mgtNos: string[];
  try {
    mgtNos = await getTopFacilities();
    console.log(`[warm_isr] 상위 ${mgtNos.length}개 시설 조회 완료`);
  } catch (err) {
    console.error(`[warm_isr] 시설 조회 실패:`, err);
    process.exit(1);
  }

  const results = await Promise.all(mgtNos.map((id) => warmPage(id)));

  let ok = 0;
  for (const r of results) {
    const icon = r.status === 200 ? "✓" : "✗";
    console.log(`  ${icon} /b/${r.mgtNo}  HTTP ${r.status}  ${r.ms}ms`);
    if (r.status === 200) ok++;
  }

  console.log(`\n[warm_isr] 완료: ${ok}/${results.length} 성공`);
  if (ok < results.length) process.exit(1);
}

main();
