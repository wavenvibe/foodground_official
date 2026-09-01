"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { loadSaved, SAVED_KEYS, type SavedFacility } from "@/lib/saved-items";

const MAX_COMPARE = 4;

function valueOrUnknown(value: string | null | undefined): string {
  return value?.trim() || "정보 없음";
}

export default function FacilityComparePage() {
  const [mounted, setMounted] = useState(false);
  const [facilities, setFacilities] = useState<SavedFacility[]>([]);

  useEffect(() => {
    // Read browser-only persistence after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacilities(loadSaved<SavedFacility>(SAVED_KEYS.facilities));
    setMounted(true);
  }, []);

  const compared = facilities.slice(0, MAX_COMPARE);

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading">
          <p className="eyebrow">FACILITY COMPARISON</p>
          <h1>저장한 제조 후보 비교</h1>
          <p>검토함에 저장한 제조시설의 공개 조건을 한눈에 비교하고, 각 업체의 생산제품·HACCP·안전정보 근거로 이동합니다.</p>
        </header>

        {!mounted ? null : compared.length < 2 ? (
          <section className="review-empty review-empty--large">
            <h2>비교할 제조 후보를 2개 이상 저장해 주세요</h2>
            <p>제조시설 검색 결과에서 후보를 저장하면 이 화면에 자동으로 나타납니다.</p>
            <Link className="button button--point" href="/facilities">제조 후보 찾기</Link>
          </section>
        ) : (
          <>
            {facilities.length > MAX_COMPARE ? <aside className="data-note">한 번에 최대 {MAX_COMPARE}개까지 비교합니다. 현재는 먼저 저장된 {MAX_COMPARE}개를 표시합니다.</aside> : null}
            <div className="facility-compare-wrap">
              <table className="facility-compare-table">
                <caption>저장한 제조시설 공개정보 비교</caption>
                <thead><tr><th scope="col">비교 항목</th>{compared.map((item) => <th scope="col" key={item.mgt_no}>{item.name}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">지역</th>{compared.map((item) => <td key={item.mgt_no}>{valueOrUnknown([item.region_sido, item.region_sigungu].filter(Boolean).join(" "))}</td>)}</tr>
                  <tr><th scope="row">업종</th>{compared.map((item) => <td key={item.mgt_no}>{valueOrUnknown(item.biz_type)}</td>)}</tr>
                  <tr><th scope="row">영업 상태</th>{compared.map((item) => <td key={item.mgt_no}>{valueOrUnknown(item.status)}</td>)}</tr>
                  <tr><th scope="row">HACCP 시설</th>{compared.map((item) => <td key={item.mgt_no}>{item.is_haccp ? <span className="chip chip--success">인증</span> : <span className="chip">연결정보 없음</span>}</td>)}</tr>
                  <tr><th scope="row">원본 근거</th>{compared.map((item) => <td key={item.mgt_no}><Link className="button button--secondary" href={`/facilities/${encodeURIComponent(item.mgt_no)}`}>업체 근거 보기</Link></td>)}</tr>
                </tbody>
              </table>
            </div>
            <aside className="data-note">이 표는 공개 시설 수준 정보의 비교입니다. 특정 제품 생산 가능 여부와 공정 적합성은 각 업체 근거 화면의 제품·HACCP·CCP 정보를 검토하고 업체에 직접 확인해야 합니다.</aside>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
