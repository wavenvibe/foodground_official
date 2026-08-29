import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import ContactButton from "@/components/facilities/ContactButton";
import { getPublicFacility, type FacilityListItem } from "@/lib/facilities";

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

export default async function FacilityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; ingredient?: string; substitute?: string; recipe?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backUrl = safeBackUrl(sp.back);
  const ingredient = sp.ingredient ?? "";
  const substitute = sp.substitute ?? "";
  const recipe = sp.recipe ?? "";

  const outcome = await getPublicFacility(id);

  if (outcome.ok && !outcome.data) notFound();

  const filterConditions =
    outcome.ok && outcome.data ? buildFilterConditions(backUrl, outcome.data) : [];

  const inquiryParams = new URLSearchParams();
  inquiryParams.set("facility", id);
  if (outcome.ok && outcome.data) inquiryParams.set("facilityName", outcome.data.name);
  inquiryParams.set("back", `/facilities/${encodeURIComponent(id)}`);
  if (ingredient) inquiryParams.set("ingredient", ingredient);
  if (substitute) inquiryParams.set("substitute", substitute);
  if (recipe) inquiryParams.set("recipe", recipe);
  const inquiryHref = `/inquiry?${inquiryParams.toString()}`;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        {!outcome.ok ? (
          <StatePanel
            tone={outcome.error.retryable ? "error" : "warning"}
            title={outcome.error.retryable ? "업체 정보를 불러오지 못했습니다" : "올바르지 않은 업체 주소입니다"}
            description={outcome.error.message}
            traceId={outcome.traceId}
            actionHref="/facilities"
            actionLabel="업체 검색으로"
          />
        ) : outcome.data ? (
          <>
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
                <h1>{outcome.data.name}</h1>
                <div className="facility-card__chips">
                  {outcome.data.is_haccp ? <span className="chip chip--success">HACCP 인증</span> : null}
                  {outcome.data.business_type ? <span className="chip">{outcome.data.business_type}</span> : null}
                  <span className="chip">{outcome.data.status}</span>
                </div>
              </header>
              <dl className="facility-detail__data">
                <div>
                  <dt>지역</dt>
                  <dd>{[outcome.data.region_sido, outcome.data.region_sigungu].filter(Boolean).join(" ") || "-"}</dd>
                </div>
                <div>
                  <dt>전화</dt>
                  <dd>
                    {outcome.data.tel ? (
                      <a href={`tel:${outcome.data.tel}`}>{outcome.data.tel}</a>
                    ) : "-"}
                  </dd>
                </div>
                <div>
                  <dt>홈페이지</dt>
                  <dd>
                    {safeHomepage(outcome.data.homepage) ? (
                      <a href={safeHomepage(outcome.data.homepage)!} target="_blank" rel="noopener noreferrer">
                        {outcome.data.homepage}
                      </a>
                    ) : "-"}
                  </dd>
                </div>
                <div>
                  <dt>공개정보 기준일</dt>
                  <dd>{outcome.data.created_at?.slice(0, 10) || "-"}</dd>
                </div>
              </dl>
              <aside className="data-note">
                공공데이터를 바탕으로 제공하는 참고정보입니다. 계약이나 발주 전에는 업체에 직접 확인해 주세요.
              </aside>
              <ContactButton
                facilityName={outcome.data.name}
                isHaccp={outcome.data.is_haccp}
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
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
