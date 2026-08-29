import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import FacilityFilters from "@/components/facilities/FacilityFilters";
import FacilityListCard from "@/components/facilities/FacilityListCard";
import { searchPublicFacilities } from "@/lib/facilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface FacilitiesPageProps {
  searchParams: Promise<{
    q?: string;
    sido?: string;
    businessType?: string;
    haccp?: string;
    status?: string;
    page?: string;
    ingredient?: string;
    substitute?: string;
    recipe?: string;
  }>;
}

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return `/facilities${query ? `?${query}` : ""}`;
}

export default async function FacilitiesPage({ searchParams }: FacilitiesPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const sido = params.sido ?? "";
  const businessType = params.businessType ?? "";
  const haccp = params.haccp === "1";
  const status = params.status ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const ingredient = params.ingredient ?? "";
  const substitute = params.substitute ?? "";
  const recipe = params.recipe ?? "";

  const outcome = await searchPublicFacilities({
    q,
    sido,
    businessType,
    haccp,
    status: status || undefined,
    page,
  });

  // filter-only query (for search criteria display)
  const filterQuery = new URLSearchParams();
  if (q) filterQuery.set("q", q);
  if (sido) filterQuery.set("sido", sido);
  if (businessType) filterQuery.set("businessType", businessType);
  if (haccp) filterQuery.set("haccp", "1");
  if (status) filterQuery.set("status", status);

  // full query including context params (for pagination links and backUrl)
  const currentQuery = new URLSearchParams(filterQuery);
  if (ingredient) currentQuery.set("ingredient", ingredient);
  if (substitute) currentQuery.set("substitute", substitute);
  if (recipe) currentQuery.set("recipe", recipe);

  const backUrl = `/facilities${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading">
          <p className="eyebrow">DISCOVERY</p>
          <h1>제조업체 찾기</h1>
          <p>지역·업종·인증 조건을 조합해 제조시설을 찾고 공개정보를 확인하세요.</p>
        </header>

        <FacilityFilters q={q} sido={sido} businessType={businessType} haccp={haccp} status={status}
          ingredient={ingredient} substitute={substitute} recipe={recipe} />

        {(ingredient || substitute) && (
          <aside className="facility-context-note" aria-label="대체 식재료 선택 맥락">
            <p>
              {substitute && ingredient
                ? <>대체 후보 <strong>{substitute}</strong> (원 식재료: {ingredient})로 제조 가능 여부를 문의할 시설을 확인하고 있습니다.</>
                : <>식재료 <strong>{ingredient}</strong> 관련 시설을 확인하고 있습니다.</>}
            </p>
            <p className="facility-context-note__disclaimer">
              지역·업종·HACCP 인증은 시설 수준 공개 정보입니다. 제품·공정 적합 여부는 해당 시설에 직접 문의해 확인하세요.
            </p>
          </aside>
        )}

        <section className="facility-results" aria-labelledby="facility-results-title">
          <div className="facility-results__head">
            <div>
              <h2 id="facility-results-title">검색 결과</h2>
              {outcome.ok ? (
                <p>총 {outcome.meta.total.toLocaleString()}건 · 업체명순</p>
              ) : (
                <p>연결 상태를 확인해 주세요.</p>
              )}
            </div>
          </div>

          {!outcome.ok ? (
            <StatePanel
              tone="error"
              title="결과를 불러오지 못했습니다"
              description="잠시 후 다시 시도해 주세요. 문제가 계속되면 추적번호와 함께 문의해 주세요."
              traceId={outcome.traceId}
              actionHref={pageHref(currentQuery, page)}
              actionLabel="다시 시도"
            />
          ) : outcome.data.length === 0 ? (
            <StatePanel
              title="검색 결과가 없습니다"
              description="선택한 조건을 줄이거나 검색어를 바꿔보세요."
              actionHref="/facilities"
              actionLabel="조건 초기화"
            />
          ) : (
            <>
              <div className="facility-list">
                {outcome.data.map((facility) => (
                  <FacilityListCard key={facility.mgt_no} facility={facility} backUrl={backUrl}
                    ingredient={ingredient} substitute={substitute} recipe={recipe} />
                ))}
              </div>
              <nav className="pagination" aria-label="제조시설 검색 페이지">
                {outcome.meta.page > 1 ? (
                  <Link className="button button--secondary" href={pageHref(currentQuery, outcome.meta.page - 1)}>
                    이전
                  </Link>
                ) : (
                  <span />
                )}
                <span>{outcome.meta.page}페이지</span>
                {outcome.meta.page * outcome.meta.pageSize < outcome.meta.total ? (
                  <Link className="button button--secondary" href={pageHref(currentQuery, outcome.meta.page + 1)}>
                    다음
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
