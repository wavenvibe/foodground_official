import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import { getPublicIngredient } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; recipe?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const recipe = sp.recipe ?? "";
  const outcome = await getPublicIngredient(id);

  if (outcome.ok && !outcome.data) notFound();

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        {!outcome.ok ? (
          <StatePanel
            tone={outcome.error.retryable ? "error" : "warning"}
            title={outcome.error.retryable ? "식재료 정보를 불러오지 못했습니다" : "올바르지 않은 식재료 주소입니다"}
            description={outcome.error.message}
            traceId={outcome.traceId}
            actionHref="/ingredients"
            actionLabel="식재료 검색으로"
          />
        ) : outcome.data ? (
          <article className="resource-detail">
            <nav aria-label="뒤로가기" style={{ marginBottom: "1rem" }}>
              {recipe ? (
                <Link href={`/recipes/${recipe}`} className="button button--secondary">
                  ← 레시피로 돌아가기
                </Link>
              ) : (
                <Link href="/ingredients" className="button button--secondary">
                  ← 식재료 목록으로
                </Link>
              )}
            </nav>

            <header>
              <p className="eyebrow">INGREDIENT</p>
              <h1>{outcome.data.ingredient_name}</h1>
            </header>

            <dl className="resource-detail__data">
              <div>
                <dt>식재료 명칭</dt>
                <dd>{outcome.data.ingredient_name}</dd>
              </div>
            </dl>

            {/* 대체 식재료 찾기 연결 */}
            <section
              style={{
                marginTop: "1.5rem",
                padding: "1rem 1.25rem",
                background: "var(--paper)",
                border: "1px solid var(--rule)",
                borderRadius: "8px",
              }}
              aria-labelledby="substitute-cta-title"
            >
              <h2
                id="substitute-cta-title"
                style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--ink)" }}
              >
                대체 식재료 찾기
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--ink-2)", marginBottom: "1rem" }}>
                <strong>{outcome.data.ingredient_name}</strong>와 영양 성분·조리 특성이 유사한 대체 식재료를 찾아보세요.
              </p>
              <Link
                href={`/substitutes?ingredient=${encodeURIComponent(outcome.data.ingredient_name)}${recipe ? `&recipe=${encodeURIComponent(recipe)}` : ""}`}
                className="button button--point"
              >
                대체 식재료 분석
              </Link>
              <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--ink-2)" }}>
                표준 식품 데이터와 연결된 경우 유사도 6개 지표와 영양 비교 결과를 확인할 수 있습니다.
              </p>
            </section>

            <aside className="data-note" style={{ marginTop: "1.5rem" }}>
              공공데이터를 바탕으로 제공하는 참고정보입니다. 조리·제조 전에는 전문가에게 확인해 주세요.
            </aside>
          </article>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
