import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import { getPublicRecipe } from "@/lib/recipes";
import { productizationHref, type ProductizationContext } from "@/lib/productization-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await getPublicRecipe(id);

  if (outcome.ok && !outcome.data) notFound();
  const recipeContext: ProductizationContext | null = outcome.ok && outcome.data ? {
    sourceType: "recipe",
    sourceId: id,
    sourceName: outcome.data.title,
    recipeId: id,
    recipeName: outcome.data.title,
  } : null;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        {!outcome.ok ? (
          <StatePanel
            tone={outcome.error.retryable ? "error" : "warning"}
            title={outcome.error.retryable ? "레시피 정보를 불러오지 못했습니다" : "올바르지 않은 레시피 주소입니다"}
            description={outcome.error.message}
            traceId={outcome.traceId}
            actionHref="/recipes"
            actionLabel="레시피 검색으로"
          />
        ) : outcome.data ? (
          <article className="resource-detail">
            <ProductizationFlow current="source" context={recipeContext ?? {}} />
            <header>
              <p className="eyebrow">RECIPE</p>
              <h1>{outcome.data.title}</h1>
              <div className="resource-detail__chips">
                {outcome.data.category_large ? <span className="chip">{outcome.data.category_large}</span> : null}
                {outcome.data.category_mid ? <span className="chip">{outcome.data.category_mid}</span> : null}
                {outcome.data.category_small ? <span className="chip">{outcome.data.category_small}</span> : null}
                {outcome.data.servings ? <span className="chip">{outcome.data.servings}인분</span> : null}
              </div>
            </header>

            {outcome.data.ingredients.length > 0 ? (
              <section className="recipe-ingredients">
                <h2>식재료</h2>
                <div className="recipe-ingredients__grid">
                  {outcome.data.ingredients
                    .filter((ing) => !ing.is_seasoning)
                    .map((ing) => (
                      <div key={ing.ingredient_id} className="recipe-ingredient-row">
                        <Link href={productizationHref(`/ingredients/${ing.ingredient_id}`, { ...(recipeContext ?? {}), ingredientId: String(ing.ingredient_id), ingredientName: ing.ingredient_name })} className="recipe-ingredient-row__name">
                          {ing.ingredient_name}
                        </Link>
                        <span className="recipe-ingredient-row__amount">
                          {[ing.amount_raw, ing.unit_raw].filter(Boolean).join(" ") || "-"}
                        </span>
                      </div>
                    ))}
                </div>

                {outcome.data.ingredients.some((i) => i.is_seasoning) ? (
                  <>
                    <h3>양념</h3>
                    <div className="recipe-ingredients__grid">
                      {outcome.data.ingredients
                        .filter((ing) => ing.is_seasoning)
                        .map((ing) => (
                          <div key={ing.ingredient_id} className="recipe-ingredient-row">
                            <Link href={productizationHref(`/ingredients/${ing.ingredient_id}`, { ...(recipeContext ?? {}), ingredientId: String(ing.ingredient_id), ingredientName: ing.ingredient_name })} className="recipe-ingredient-row__name">
                              {ing.ingredient_name}
                            </Link>
                            <span className="recipe-ingredient-row__amount">
                              {[ing.amount_raw, ing.unit_raw].filter(Boolean).join(" ") || "-"}
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                ) : null}
              </section>
            ) : (
              <p className="resource-detail__empty">식재료 정보가 없습니다.</p>
            )}

            <section className="evidence-section productization-cta" aria-labelledby="recipe-productization"><div><p className="eyebrow">NEXT STEP</p><h2 id="recipe-productization">원재료를 골라 대체안까지 검토</h2><p>위 식재료 이름을 선택하면 이 레시피 맥락을 유지한 채 대체안 비교와 제조요건 확인으로 이어집니다. 대체 검토가 필요 없다면 바로 브리프를 작성할 수 있습니다.</p></div><Link className="button button--secondary" href={productizationHref("/manufacturing-brief", recipeContext ?? {})}>대체 검토 없이 브리프 작성</Link></section>

            <aside className="data-note">
              공공데이터를 바탕으로 제공하는 참고정보입니다. 실제 조리 시 분량이나 재료가 다를 수 있습니다.
            </aside>
          </article>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
