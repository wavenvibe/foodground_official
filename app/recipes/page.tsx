import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import { searchPublicRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RecipesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryLarge?: string;
    categoryMid?: string;
    page?: string;
  }>;
}

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return `/recipes${query ? `?${query}` : ""}`;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const categoryLarge = params.categoryLarge ?? "";
  const categoryMid = params.categoryMid ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const outcome = await searchPublicRecipes({ q, categoryLarge, categoryMid, page });

  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (categoryLarge) currentQuery.set("categoryLarge", categoryLarge);
  if (categoryMid) currentQuery.set("categoryMid", categoryMid);

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading">
          <p className="eyebrow">DISCOVERY</p>
          <h1>레시피 찾기</h1>
          <p>레시피명으로 검색하고 식재료 구성을 확인하세요.</p>
        </header>

        <form className="resource-filters" method="get" action="/recipes" role="search">
          <div className="resource-filters__search">
            <label htmlFor="recipe-q">레시피 검색</label>
            <div>
              <input
                id="recipe-q"
                name="q"
                type="search"
                maxLength={100}
                defaultValue={q}
                placeholder="레시피명으로 검색"
              />
              <button className="button button--point" type="submit">검색</button>
            </div>
          </div>
          <div className="resource-filters__actions">
            <Link className="button button--secondary" href="/recipes">조건 초기화</Link>
            <button className="button button--slate" type="submit">조건 적용</button>
          </div>
        </form>

        <section aria-labelledby="recipe-results-title">
          <div className="resource-results__head">
            <div>
              <h2 id="recipe-results-title">검색 결과</h2>
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
              actionHref="/recipes"
              actionLabel="조건 초기화"
            />
          ) : (
            <>
              <div className="resource-list">
                {outcome.data.map((recipe) => (
                  <article key={recipe.recipe_id} className="resource-card">
                    <div>
                      <h2>
                        <Link href={`/recipes/${recipe.recipe_id}`}>{recipe.title}</Link>
                      </h2>
                      <div className="resource-card__chips">
                        {recipe.category_large ? <span className="chip">{recipe.category_large}</span> : null}
                        {recipe.category_mid ? <span className="chip">{recipe.category_mid}</span> : null}
                        {recipe.servings ? <span className="chip">{recipe.servings}인분</span> : null}
                      </div>
                    </div>
                    <div className="resource-card__foot">
                      <Link className="button button--secondary" href={`/recipes/${recipe.recipe_id}`}>
                        상세 보기
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <nav className="pagination" aria-label="레시피 검색 페이지">
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
