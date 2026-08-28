import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import { searchPublicIngredients } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface IngredientsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return `/ingredients${query ? `?${query}` : ""}`;
}

export default async function IngredientsPage({ searchParams }: IngredientsPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const outcome = await searchPublicIngredients({ q, page });

  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading">
          <p className="eyebrow">DISCOVERY</p>
          <h1>식재료 찾기</h1>
          <p>식재료명으로 검색하고 사용된 레시피를 확인하세요.</p>
        </header>

        <form className="resource-filters" method="get" action="/ingredients" role="search">
          <div className="resource-filters__search">
            <label htmlFor="ingredient-q">식재료 검색</label>
            <div>
              <input
                id="ingredient-q"
                name="q"
                type="search"
                maxLength={100}
                defaultValue={q}
                placeholder="식재료명으로 검색"
              />
              <button className="button button--point" type="submit">검색</button>
            </div>
          </div>
          <div className="resource-filters__actions">
            <Link className="button button--secondary" href="/ingredients">조건 초기화</Link>
          </div>
        </form>

        <section aria-labelledby="ingredient-results-title">
          <div className="resource-results__head">
            <div>
              <h2 id="ingredient-results-title">검색 결과</h2>
              {outcome.ok ? (
                <p>총 {outcome.meta.total.toLocaleString()}건 · 이름순</p>
              ) : (
                <p>연결 상태를 확인해 주세요.</p>
              )}
            </div>
          </div>

          {!outcome.ok ? (
            <StatePanel
              tone="error"
              title="결과를 불러오지 못했습니다"
              description="잠시 후 다시 시도해 주세요."
              traceId={outcome.traceId}
              actionHref={pageHref(currentQuery, page)}
              actionLabel="다시 시도"
            />
          ) : outcome.data.length === 0 ? (
            <StatePanel
              title="검색 결과가 없습니다"
              description="다른 검색어를 사용해 보세요."
              actionHref="/ingredients"
              actionLabel="조건 초기화"
            />
          ) : (
            <>
              <div className="resource-list resource-list--compact">
                {outcome.data.map((ingredient) => (
                  <article key={ingredient.ingredient_id} className="resource-card resource-card--compact">
                    <Link href={`/ingredients/${ingredient.ingredient_id}`} className="resource-card__name">
                      {ingredient.ingredient_name}
                    </Link>
                    <Link className="button button--secondary" href={`/ingredients/${ingredient.ingredient_id}`}>
                      상세
                    </Link>
                  </article>
                ))}
              </div>
              <nav className="pagination" aria-label="식재료 검색 페이지">
                {outcome.meta.page > 1 ? (
                  <Link className="button button--secondary" href={pageHref(currentQuery, outcome.meta.page - 1)}>이전</Link>
                ) : <span />}
                <span>{outcome.meta.page}페이지</span>
                {outcome.meta.page * outcome.meta.pageSize < outcome.meta.total ? (
                  <Link className="button button--secondary" href={pageHref(currentQuery, outcome.meta.page + 1)}>다음</Link>
                ) : <span />}
              </nav>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
