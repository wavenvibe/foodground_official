import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import EvidenceStatus from "@/components/manufacturing/EvidenceStatus";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import ProductizationContextPanel from "@/components/manufacturing/ProductizationContextPanel";
import { matchManufacturingCandidates } from "@/lib/manufacturing-match";
import { appendProductizationContext, type ProductizationContext, type ProductizationSourceType } from "@/lib/productization-context";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function all(value: string | string[] | undefined): string[] { return Array.isArray(value) ? value : value ? [value] : []; }

export default async function ManufacturingCandidatesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const item = first(params.item);
  const region = first(params.region);
  const requiredCcp = all(params.ccp);
  const cooking = first(params.cooking) === "1";
  const sterilize = first(params.sterilize) === "1";
  const sourceType = first(params.sourceType);
  const sourceId = first(params.sourceId);
  const sourceName = first(params.sourceName);
  const context: ProductizationContext = {
    sourceType: (sourceType || "direct") as ProductizationSourceType,
    sourceId,
    sourceName,
    recipeId: first(params.recipe),
    recipeName: first(params.recipeName),
    ingredientId: first(params.ingredientId),
    ingredientName: first(params.ingredient),
    substituteId: first(params.substituteId),
    substituteName: first(params.substitute),
    item,
    region,
    requiredCcp,
    cooking,
    sterilize,
  };
  const outcome = item ? await matchManufacturingCandidates({ item, region, requiredCcp, cookingRequired: cooking, sterilizeRequired: sterilize, limit: 12 }) : null;
  const contextParams = appendProductizationContext(new URLSearchParams(), context);
  const editHref = `/manufacturing-brief?${contextParams.toString()}`;

  return <div className="app-shell"><Header /><main className="page-container manufacturing-page">
    <ProductizationFlow current="facility" context={context} />
    <header className="manufacturing-hero"><p className="eyebrow">EVIDENCE MATCH</p><h1>공동제조 후보 근거 비교</h1><p>점수 하나로 숨기지 않고, 요청한 조건마다 충족·미충족·미확인을 표시합니다.</p></header>
    <ProductizationContextPanel context={context} />
    {!item ? <StatePanel tone="warning" title="제품유형이 필요합니다" description="제품화 브리프에서 실제 제조할 제품유형을 먼저 선택해 주세요." actionHref={editHref} actionLabel="브리프 작성" /> : !outcome?.ok ? <StatePanel tone="warning" title="후보 근거를 불러올 수 없습니다" description={outcome?.error.message ?? "제품화 브리프를 다시 확인해 주세요."} traceId={outcome?.traceId} actionHref={editHref} actionLabel="요건 수정" /> : <>
      <section className="brief-summary" aria-label="확정한 제품화 요건"><div><p className="eyebrow">CURRENT BRIEF</p><h2>{sourceName || item}</h2>{sourceName ? <p>{sourceType === "recipe" ? "레시피" : "제품"}에서 시작 · 제품유형 {item}</p> : <p>제품유형 {item}</p>}</div><dl><div><dt>지역</dt><dd>{region || "전국"}</dd></div><div><dt>필수 CCP</dt><dd>{requiredCcp.join(", ") || "지정 없음"}</dd></div><div><dt>공정 묶음</dt><dd>{[cooking ? "가열" : "", sterilize ? "살균" : ""].filter(Boolean).join(", ") || "지정 없음"}</dd></div></dl><Link className="button button--secondary" href={editHref}>요건 수정</Link></section>
      <section className="candidate-summary" aria-label="후보 판정 요약"><div><strong>{outcome.data.totalItemMatched}</strong><span>제품유형 일치</span></div><div><strong>{outcome.data.qualifiedCount}</strong><span>전체 요건 충족</span></div><div><strong>{outcome.data.reviewCount}</strong><span>추가 확인</span></div><div><strong>{outcome.data.excludedReviewProfiles}</strong><span>매핑 검토대상 제외</span></div></section>
      {outcome.data.candidates.length === 0 ? <StatePanel title="정확히 일치하는 제조 프로필이 없습니다" description="가짜 유사 후보는 표시하지 않습니다. 제품유형을 다시 선택하거나 필수조건을 조정해 주세요." actionHref={editHref} actionLabel="요건 수정" /> : <><p className="candidate-list-note">판정 우선순위에 따라 상위 {outcome.data.candidates.length}개를 표시합니다. 전체 품목 일치 후보는 {outcome.data.totalItemMatched}개입니다.</p><ol className="manufacturing-candidate-list" aria-label="공동제조 후보 목록">{outcome.data.candidates.map((candidate) => {
        const facilityParams = new URLSearchParams(contextParams); facilityParams.set("candidate", candidate.companyName);
        return <li className="manufacturing-candidate" key={candidate.companyId}><header><div><span className={`candidate-verdict candidate-verdict--${candidate.verdict}`}>{candidate.verdict === "qualified" ? "요건 충족 후보" : "추가 확인 후보"}</span><h2>{candidate.facility?.name || candidate.companyName}</h2><p>{candidate.companyName !== candidate.facility?.name ? `프로필명 ${candidate.companyName} · ` : ""}{candidate.facility ? [candidate.facility.region_sido, candidate.facility.region_sigungu].filter(Boolean).join(" ") : "시설 기본정보 미확인"}</p></div><div className="candidate-evidence-count"><strong>{candidate.matchedEvidence}/{candidate.checkedEvidence}</strong><span>근거 충족</span></div></header><div className="candidate-evidence-grid">{candidate.evidence.map((entry) => <article key={entry.key}><div><strong>{entry.label}</strong><EvidenceStatus status={entry.status} /></div><dl><dt>요청</dt><dd>{entry.requiredValue}</dd><dt>근거</dt><dd>{entry.actualValue}</dd></dl></article>)}</div><footer><div className="ccp-list">{candidate.ccpCodes.length ? candidate.ccpCodes.map((code) => <span className="chip" key={code}>{code}</span>) : <span className="chip">표준 CCP 없음</span>}</div><Link className="button button--point" href={`/facilities/${encodeURIComponent(candidate.facilityMgtNo)}?${facilityParams.toString()}`}>업체 제품·스마트 HACCP 근거 검증</Link></footer></li>;
      })}</ol></>}
      <aside className="data-note">‘요건 충족’은 공개 프로필의 품목·CCP·지역 조건이 맞는다는 뜻입니다. 실제 제조 가능성, 설비용량, MOQ, 원가, 납기와 제품별 스마트 HACCP 적용범위는 시설 상세 근거 확인 후 업체에 직접 확인해야 합니다.</aside>
    </>}
  </main><Footer /></div>;
}
