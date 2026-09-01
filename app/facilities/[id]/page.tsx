import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import ContactButton from "@/components/facilities/ContactButton";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import SaveButton from "@/components/saved/SaveButton";
import { getPublicFacility, type FacilityListItem } from "@/lib/facilities";
import { getSourceFacilityEvidence } from "@/lib/source-db";
import type { ProductizationContext, ProductizationSourceType } from "@/lib/productization-context";
import { SAVED_KEYS, type SavedFacility } from "@/lib/saved-items";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeBackUrl(back: string | undefined): string {
  if (!back) return "/facilities";
  try {
    const decoded = decodeURIComponent(back);
    if (/^\/facilities(\?[^<>"]*)?$/.test(decoded)) return decoded;
  } catch {
    // malformed percent-encoding — fall through to default
  }
  return "/facilities";
}

function safeHomepage(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

type MatchStatus = "일치" | "미충족" | "정보 없음";

interface FilterCondition {
  label: string;
  filterValue: string;
  facilityValue: string;
  status: MatchStatus;
}

function buildFilterConditions(
  backUrl: string,
  facility: FacilityListItem,
): FilterCondition[] {
  const qIdx = backUrl.indexOf("?");
  if (qIdx < 0) return [];
  const bp = new URLSearchParams(backUrl.slice(qIdx + 1));
  const conditions: FilterCondition[] = [];

  const sido = bp.get("sido");
  if (sido) {
    const fv = facility.region_sido;
    const status: MatchStatus = !fv ? "정보 없음" : fv === sido ? "일치" : "미충족";
    conditions.push({ label: "지역", filterValue: sido, facilityValue: fv ?? "-", status });
  }

  const bt = bp.get("businessType");
  if (bt) {
    const fv = facility.business_type;
    const status: MatchStatus = !fv ? "정보 없음" : fv === bt ? "일치" : "미충족";
    conditions.push({ label: "업종", filterValue: bt, facilityValue: fv ?? "-", status });
  }

  if (bp.get("haccp") === "1") {
    const status: MatchStatus = facility.is_haccp ? "일치" : "미충족";
    conditions.push({ label: "HACCP", filterValue: "인증", facilityValue: facility.is_haccp ? "인증" : "미인증", status });
  }

  const filterStatus = bp.get("status");
  if (filterStatus && filterStatus !== "all") {
    const fv = facility.status;
    const status: MatchStatus = !fv ? "정보 없음" : fv === filterStatus ? "일치" : "미충족";
    conditions.push({ label: "영업상태", filterValue: filterStatus, facilityValue: fv ?? "-", status });
  }

  return conditions;
}

const STATUS_CLASS: Record<MatchStatus, string> = {
  "일치": "filter-condition__status--match",
  "미충족": "filter-condition__status--mismatch",
  "정보 없음": "filter-condition__status--unknown",
};

function formatCcp(value: string | null): string {
  if (!value) return "공정·CCP 상세정보 없음";
  if (value.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string").join(" · ") || "공정·CCP 상세정보 없음";
    } catch {
      // Show the original source text when the legacy JSON is malformed.
    }
  }
  return value;
}

export default async function FacilityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; ingredient?: string; ingredientId?: string; substitute?: string; substituteId?: string; recipe?: string; recipeName?: string; product?: string; sourceType?: string; sourceId?: string; sourceName?: string; item?: string; region?: string; ccp?: string | string[]; cooking?: string; sterilize?: string; candidate?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backUrl = safeBackUrl(sp.back);
  const ingredient = sp.ingredient ?? "";
  const substitute = sp.substitute ?? "";
  const recipe = sp.recipe ?? "";
  const product = sp.product ?? "";
  const sourceType = sp.sourceType ?? "";
  const sourceId = sp.sourceId ?? "";
  const sourceName = sp.sourceName ?? "";
  const manufacturingItem = sp.item ?? "";
  const manufacturingRegion = sp.region ?? "";
  const manufacturingCcp = Array.isArray(sp.ccp) ? sp.ccp : sp.ccp ? [sp.ccp] : [];
  const manufacturingProcess = [sp.cooking === "1" ? "가열" : "", sp.sterilize === "1" ? "살균" : ""].filter(Boolean);
  const productizationContext: ProductizationContext = {
    sourceType: (sourceType || "direct") as ProductizationSourceType,
    sourceId,
    sourceName,
    recipeId: recipe,
    recipeName: sp.recipeName,
    ingredientId: sp.ingredientId,
    ingredientName: ingredient,
    substituteId: sp.substituteId,
    substituteName: substitute,
    item: manufacturingItem,
    region: manufacturingRegion,
    requiredCcp: manufacturingCcp,
    cooking: sp.cooking === "1",
    sterilize: sp.sterilize === "1",
  };

  const evidenceOutcome = await getSourceFacilityEvidence(id);
  const outcome = evidenceOutcome.ok && evidenceOutcome.data
    ? { ok: true as const, data: null, traceId: evidenceOutcome.traceId }
    : await getPublicFacility(id);

  const sourceFacility = evidenceOutcome.ok ? evidenceOutcome.data?.facility : null;
  const facility: FacilityListItem | null = outcome.ok && outcome.data
    ? outcome.data
    : sourceFacility
      ? {
          mgt_no: sourceFacility.mgt_no,
          name: sourceFacility.name,
          business_type: sourceFacility.business_type,
          status: sourceFacility.status ?? "정보 없음",
          region_sido: sourceFacility.region_sido,
          region_sigungu: sourceFacility.region_sigungu,
          is_haccp: sourceFacility.is_haccp,
          tel: sourceFacility.tel,
          homepage: sourceFacility.homepage,
          created_at: sourceFacility.updated_at,
          ingest_run_id: null,
        }
      : null;

  if (outcome.ok && !outcome.data && evidenceOutcome.ok && !evidenceOutcome.data) notFound();

  const filterConditions =
    facility ? buildFilterConditions(backUrl, facility) : [];

  const inquiryParams = new URLSearchParams();
  inquiryParams.set("facility", id);
  if (facility) inquiryParams.set("facilityName", facility.name);
  inquiryParams.set("back", `/facilities/${encodeURIComponent(id)}`);
  if (ingredient) inquiryParams.set("ingredient", ingredient);
  if (substitute) inquiryParams.set("substitute", substitute);
  if (recipe) inquiryParams.set("recipe", recipe);
  if (sp.recipeName) inquiryParams.set("recipeName", sp.recipeName);
  if (sp.ingredientId) inquiryParams.set("ingredientId", sp.ingredientId);
  if (sp.substituteId) inquiryParams.set("substituteId", sp.substituteId);
  if (sourceType) inquiryParams.set("sourceType", sourceType);
  if (sourceId) inquiryParams.set("sourceId", sourceId);
  if (sourceName) inquiryParams.set("sourceName", sourceName);
  if (manufacturingItem) inquiryParams.set("item", manufacturingItem);
  if (manufacturingCcp.length) inquiryParams.set("process", manufacturingCcp.join(", "));
  const inquiryHref = `/inquiry?${inquiryParams.toString()}`;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        {!facility ? (
          <StatePanel
            tone="error"
            title="업체 정보를 불러오지 못했습니다"
            description={!outcome.ok ? outcome.error.message : !evidenceOutcome.ok ? evidenceOutcome.error.message : "제조시설을 찾을 수 없습니다."}
            traceId={!outcome.ok ? outcome.traceId : evidenceOutcome.traceId}
            actionHref="/facilities"
            actionLabel="업체 검색으로"
          />
        ) : (
          <>
            <ProductizationFlow current="facility" context={productizationContext} />
            <nav className="facility-detail__back" aria-label="뒤로가기">
              <Link href={backUrl} className="button button--secondary">
                ← 검색 결과로 돌아가기
              </Link>
            </nav>

            {(ingredient || substitute || recipe) && (
              <aside className="facility-context-note facility-context-note--detail" aria-label="선택 맥락 참고정보">
                <p>
                  {substitute && ingredient
                    ? <>대체 후보 <strong>{substitute}</strong> (원 식재료: {ingredient}) 제조 가능 여부를 문의하기 위한 참고 시설입니다.</>
                    : ingredient
                    ? <>식재료 <strong>{ingredient}</strong> 관련 문의를 위한 참고 시설입니다.</>
                    : null}
                  {recipe && <>{" "}참고 레시피 #{recipe}.</>}
                </p>
                <p className="facility-context-note__disclaimer">
                  이 정보는 문의 맥락으로 전달된 참고 정보입니다. 시설 HACCP 인증은 시설 수준이며 제품·공정 적합 여부는 직접 문의하세요.
                </p>
              </aside>
            )}

            {product ? (
              <aside className="facility-context-note facility-context-note--detail" aria-label="제품 연결 맥락">
                <p>품목보고번호 <strong>{product}</strong>에서 직접 연결된 제조시설 근거를 확인하고 있습니다.</p>
              </aside>
            ) : null}

            {manufacturingItem ? (
              <aside className="facility-context-note facility-context-note--detail manufacturing-facility-context" aria-label="제품화 브리프 맥락">
                <p className="eyebrow">PRODUCTIZATION CONTEXT</p>
                <h2>{sp.candidate || facility.name} 후보 근거 검증</h2>
                <dl><div><dt>시작점</dt><dd>{sourceName ? `${sourceType === "recipe" ? "레시피" : "제품"} · ${sourceName}` : "직접 브리프"}{sourceId ? ` · ${sourceId}` : ""}</dd></div><div><dt>제품유형</dt><dd>{manufacturingItem}</dd></div><div><dt>희망지역</dt><dd>{manufacturingRegion || "전국"}</dd></div><div><dt>필수 CCP</dt><dd>{manufacturingCcp.join(", ") || "지정 없음"}</dd></div><div><dt>공정 묶음</dt><dd>{manufacturingProcess.join(", ") || "지정 없음"}</dd></div></dl>
                <p className="facility-context-note__disclaimer">아래 생산제품·HACCP·CCP·안전정보를 직접 검증한 뒤, 미확인 조건만 업체에 문의하세요.</p>
              </aside>
            ) : null}

            {filterConditions.length > 0 && (
              <aside className="facility-detail__filter-context" aria-label="검색 조건 충족 여부">
                <div className="filter-context__header">
                  <h2 className="filter-context__title">검색 조건 확인</h2>
                  <p className="filter-context__source">공개 제조시설 데이터 기준</p>
                </div>
                <ul className="filter-context__list" role="list">
                  {filterConditions.map(({ label, filterValue, facilityValue, status }) => (
                    <li key={label} className="filter-condition">
                      <span className="filter-condition__label">{label}</span>
                      <span className="filter-condition__values">
                        <span className="filter-condition__filter-val">{filterValue}</span>
                        <span className="filter-condition__arrow" aria-hidden="true">→</span>
                        <span className="filter-condition__facility-val">{facilityValue}</span>
                      </span>
                      <span
                        className={`filter-condition__status ${STATUS_CLASS[status]}`}
                        aria-label={`${label} ${status}`}
                      >
                        {status}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            <article className="facility-detail">
              <header>
                <p className="eyebrow">FACILITY</p>
                <h1>{facility.name}</h1>
                <div className="facility-card__chips">
                  {facility.is_haccp ? <span className="chip chip--success">HACCP 인증</span> : null}
                  {facility.business_type ? <span className="chip">{facility.business_type}</span> : null}
                  <span className="chip">{facility.status}</span>
                </div>
                <SaveButton<SavedFacility>
                  storageKey={SAVED_KEYS.facilities}
                  itemKey="mgt_no"
                  item={{ mgt_no: facility.mgt_no, name: facility.name, biz_type: facility.business_type, region_sido: facility.region_sido, region_sigungu: facility.region_sigungu, status: facility.status, is_haccp: facility.is_haccp, saved_at: new Date().toISOString() }}
                  label="제조 후보로 저장"
                  savedLabel="제조 후보 저장됨"
                />
              </header>
              <dl className="facility-detail__data">
                <div>
                  <dt>지역</dt>
                  <dd>{[facility.region_sido, facility.region_sigungu].filter(Boolean).join(" ") || "-"}</dd>
                </div>
                <div>
                  <dt>전화</dt>
                  <dd>
                    {facility.tel ? (
                      <a href={`tel:${facility.tel}`}>{facility.tel}</a>
                    ) : "-"}
                  </dd>
                </div>
                <div>
                  <dt>홈페이지</dt>
                  <dd>
                    {safeHomepage(facility.homepage) ? (
                      <a href={safeHomepage(facility.homepage)!} target="_blank" rel="noopener noreferrer">
                        {facility.homepage}
                      </a>
                    ) : "-"}
                  </dd>
                </div>
                <div>
                  <dt>공개정보 기준일</dt>
                  <dd>{facility.created_at?.slice(0, 10) || "-"}</dd>
                </div>
              </dl>
              <aside className="data-note">
                공공데이터를 바탕으로 제공하는 참고정보입니다. 계약이나 발주 전에는 업체에 직접 확인해 주세요.
              </aside>
              <section className="evidence-section facility-evidence" aria-labelledby="facility-products">
                <div className="evidence-section__head"><h2 id="facility-products">이 업체의 생산제품</h2><span>{evidenceOutcome.ok && evidenceOutcome.data ? `${evidenceOutcome.data.productTotal.toLocaleString()}건` : "연결 필요"}</span></div>
                {!evidenceOutcome.ok ? (
                  <StatePanel tone="warning" title="제품·인증 원본 연결이 필요합니다" description={evidenceOutcome.error.message} traceId={evidenceOutcome.traceId} />
                ) : evidenceOutcome.data ? (
                  <>
                    {evidenceOutcome.data.products.length ? <div className="linked-product-list">{evidenceOutcome.data.products.map((item) => <Link className="linked-product" key={item.report_no} href={`/products/${encodeURIComponent(item.report_no)}`}><span>{item.product_name}</span><small>{item.category || "유형 정보 없음"} · {item.reported_at?.slice(0, 10) || "신고일 없음"}</small></Link>)}</div> : <StatePanel title="연결된 생산제품이 없습니다" description="관리번호로 직접 연결된 품목보고 원본이 없습니다." />}
                    {evidenceOutcome.data.productTotal > evidenceOutcome.data.products.length ? <Link className="button button--secondary" href={`/products?facility=${encodeURIComponent(id)}`}>전체 생산제품 {evidenceOutcome.data.productTotal.toLocaleString()}건 보기</Link> : null}
                  </>
                ) : <StatePanel title="원본에서 시설을 찾지 못했습니다" description="현재 공개시설과 제품 원본의 관리번호 연결을 다시 확인해 주세요." />}
              </section>

              {evidenceOutcome.ok && evidenceOutcome.data ? (
                <>
                  <section className="evidence-section" aria-labelledby="facility-haccp"><div className="evidence-section__head"><h2 id="facility-haccp">HACCP 인증·CCP 정보</h2><span>{evidenceOutcome.data.haccp.length}건</span></div>
                    {evidenceOutcome.data.haccp.length ? <div className="evidence-grid">{evidenceOutcome.data.haccp.map((cert, index) => <article className="evidence-card" key={`${cert.cert_no ?? "cert"}-${index}`}><h3>{cert.cert_no || "인증번호 정보 없음"}</h3><p>인증일 {cert.cert_date?.slice(0, 10) || "-"}</p><p className="evidence-card__body">{formatCcp(cert.ccp_list)}</p></article>)}</div> : <StatePanel title="연결된 인증 원본이 없습니다" description="시설의 HACCP 표시와 인증서·CCP 원본 연결은 별도로 확인해야 합니다." />}
                  </section>
                  <section className="evidence-section" aria-labelledby="facility-safety"><div className="evidence-section__head"><h2 id="facility-safety">업체 직접 연결 안전정보</h2><span>{evidenceOutcome.data.safety.length}건</span></div>
                    {evidenceOutcome.data.safety.length ? <div className="evidence-grid">{evidenceOutcome.data.safety.map((item, index) => <article className="evidence-card evidence-card--warning" key={`${item.product_code ?? item.product_name ?? "safety"}-${index}`}><h3>{item.product_name || "제품명 정보 없음"}</h3><p>{item.reason || "사유 정보 없음"}</p><p className="evidence-card__body">{item.method || "조치정보 없음"} · {item.published_at?.slice(0, 10) || "공개일 없음"}</p></article>)}</div> : <StatePanel title="직접 연결된 안전정보 없음" description="안전 판정이 아니라 이 시설 관리번호에 직접 연결된 공개 안전정보가 없다는 뜻입니다." />}
                  </section>
                  <aside className="data-note">HACCP은 시설 수준 인증이며 특정 제품·모든 공정의 자동 적합 판정이 아닙니다. 안전정보도 관리번호로 직접 연결된 원본만 표시합니다.</aside>
                </>
              ) : null}

              <ContactButton
                facilityName={facility.name}
                isHaccp={facility.is_haccp}
              />

              {/* 문의 준비 링크 — URL 맥락 보존 */}
              <div style={{ marginTop: "1.5rem" }}>
                <Link
                  href={inquiryHref}
                  className="button button--point"
                  style={{ display: "inline-block" }}
                >
                  문의 준비하기
                </Link>
                <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--ink-2)" }}>
                  공개 전화·홈페이지로 직접 연락하는 문안을 작성합니다. 자동 발송하지 않습니다.
                </p>
              </div>
            </article>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
