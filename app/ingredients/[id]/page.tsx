import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import { getPublicIngredient } from "@/lib/ingredients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
            <header>
              <p className="eyebrow">INGREDIENT</p>
              <h1>{outcome.data.ingredient_name}</h1>
            </header>
            <dl className="resource-detail__data">
              <div>
                <dt>식재료 ID</dt>
                <dd>{outcome.data.ingredient_id}</dd>
              </div>
            </dl>
            <aside className="data-note">
              공공데이터를 바탕으로 제공하는 참고정보입니다.
            </aside>
          </article>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
