import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import SaveButton from "@/components/saved/SaveButton";
import { getSourceProduct } from "@/lib/source-db";
import { SAVED_KEYS, type SavedProduct } from "@/lib/saved-items";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function splitCcp(value: string | null): string[] {
  if (value?.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    } catch {
      // Fall back to delimiter splitting for malformed legacy values.
    }
  }
  return value?.split(/[|,;]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

export default async function ProductDetailPage({ params }: { params: Promise<{ reportNo: string }> }) {
  const { reportNo } = await params;
  const outcome = await getSourceProduct(reportNo);
  if (outcome.ok && !outcome.data) notFound();

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <Link className="button button--secondary" href="/products">← 제품 검색으로</Link>
        {!outcome.ok ? (
          <div className="detail-state-wrap"><StatePanel tone="warning" title="제품 근거를 불러올 수 없습니다" description={outcome.error.message} traceId={outcome.traceId} /></div>
        ) : outcome.data ? (
          <article className="evidence-detail">
            <header className="evidence-detail__hero">
              <p className="eyebrow">PRODUCT TRACE</p>
              <h1>{outcome.data.product_name}</h1>
              <p>품목보고번호 {outcome.data.report_no}</p>
              <div className="facility-card__chips">{outcome.data.facility_is_haccp ? <span className="chip chip--success">HACCP 시설 연결</span> : <span className="chip">HACCP 연결정보 없음</span>}{outcome.data.category ? <span className="chip">{outcome.data.category}</span> : null}</div>
              <SaveButton<SavedProduct>
                storageKey={SAVED_KEYS.products}
                itemKey="report_no"
                item={{ report_no: outcome.data.report_no, product_name: outcome.data.product_name, category: outcome.data.category ?? null, facility_mgt_no: outcome.data.facility_mgt_no ?? "", facility_name: outcome.data.facility_name ?? outcome.data.maker_name ?? "", saved_at: new Date().toISOString() }}
                label="제품 검토함에 저장"
                savedLabel="제품 저장됨"
              />
            </header>

            <section className="evidence-section" aria-labelledby="product-facts"><h2 id="product-facts">제품 기본정보</h2><dl className="facility-detail__data">
              <div><dt>제품명</dt><dd>{outcome.data.product_name}</dd></div>
              <div><dt>유형</dt><dd>{outcome.data.category || "-"}</dd></div>
              <div><dt>제조사 표기</dt><dd>{outcome.data.maker_name || "-"}</dd></div>
              <div><dt>품목 신고일</dt><dd>{outcome.data.reported_at?.slice(0, 10) || "-"}</dd></div>
              <div><dt>소비기한·유통기한</dt><dd>{outcome.data.shelf_life_days ? `${outcome.data.shelf_life_days}일` : "-"}</dd></div>
              <div><dt>원재료 표기</dt><dd>{outcome.data.ingredients || "-"}</dd></div>
            </dl></section>

            <section className="evidence-section evidence-section--accent" aria-labelledby="manufacturer-link"><h2 id="manufacturer-link">실제 제조업체 연결</h2>
              {outcome.data.facility_mgt_no && outcome.data.facility_name ? <><p><strong>{outcome.data.facility_name}</strong> · {[outcome.data.facility_region_sido, outcome.data.facility_region_sigungu].filter(Boolean).join(" ") || "지역정보 없음"}</p><Link className="button button--point" href={`/facilities/${encodeURIComponent(outcome.data.facility_mgt_no)}?product=${encodeURIComponent(outcome.data.report_no)}`}>업체 제품·인증 근거 보기</Link></> : <p>이 제품과 관리번호로 직접 연결된 제조시설이 없습니다.</p>}
            </section>

            <section className="evidence-section productization-cta" aria-labelledby="productization-start"><div><p className="eyebrow">NEXT STEP</p><h2 id="productization-start">이 제품을 기준으로 제조 후보 비교</h2><p>제품유형을 확인하고 필요한 CCP·지역 조건을 추가해 다른 공동제조 후보도 근거별로 비교할 수 있습니다.</p></div><Link className="button button--point" href={`/manufacturing-brief?sourceType=product&sourceId=${encodeURIComponent(outcome.data.report_no)}&sourceName=${encodeURIComponent(outcome.data.product_name)}${outcome.data.category ? `&item=${encodeURIComponent(outcome.data.category)}` : ""}`}>제품화 브리프 작성</Link></section>

            <section className="evidence-section" aria-labelledby="haccp-evidence"><div className="evidence-section__head"><h2 id="haccp-evidence">HACCP 인증·CCP 근거</h2><span>{outcome.data.haccp.length}건</span></div>
              {outcome.data.haccp.length ? <div className="evidence-grid">{outcome.data.haccp.map((cert, index) => <article className="evidence-card" key={`${cert.cert_no ?? "cert"}-${index}`}><h3>{cert.cert_no || "인증번호 정보 없음"}</h3><p>인증일 {cert.cert_date?.slice(0, 10) || "-"}</p><div className="ccp-list">{splitCcp(cert.ccp_list).length ? splitCcp(cert.ccp_list).map((ccp) => <span className="chip chip--success" key={ccp}>{ccp}</span>) : <span>공정·CCP 상세정보 없음</span>}</div></article>)}</div> : <StatePanel title="연결된 HACCP 인증자료가 없습니다" description="시설의 인증 여부와 해당 제품·공정 적합성은 구분해서 확인해야 합니다." />}
            </section>

            <section className="evidence-section" aria-labelledby="safety-evidence"><div className="evidence-section__head"><h2 id="safety-evidence">제품 직접 연결 안전정보</h2><span>{outcome.data.safety.length}건</span></div>
              {outcome.data.safety.length ? <div className="evidence-grid">{outcome.data.safety.map((item, index) => <article className="evidence-card evidence-card--warning" key={`${item.product_code ?? item.product_name ?? "safety"}-${index}`}><h3>{item.product_name || outcome.data!.product_name}</h3><p>{item.reason || "사유 정보 없음"}</p><dl><dt>조치</dt><dd>{item.method || "-"}</dd><dt>공개일</dt><dd>{item.published_at?.slice(0, 10) || "-"}</dd></dl></article>)}</div> : <StatePanel tone="neutral" title="직접 연결된 안전정보 없음" description="안전하다는 판정이 아니라, 이 제품명·관리번호에 직접 연결된 공개 안전정보가 없다는 뜻입니다." />}
            </section>
            <aside className="data-note">HACCP 인증은 시설 수준 정보입니다. 이 화면은 실제 원본의 직접 키 연결만 보여주며, 인증이 특정 제품이나 모든 제조공정을 자동 보증하지 않습니다.</aside>
          </article>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
