import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import SaveButton from "@/components/saved/SaveButton";
import { getPublicRecipe } from "@/lib/recipes";
import { productizationHref, type ProductizationContext } from "@/lib/productization-context";
import { SAVED_KEYS, type SavedRecipe } from "@/lib/saved-items";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function displayIngredientName(value: string): string {
  return value.replace(/^[?�]+(?=[가-힣])/, "").trim();
}

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
              <SaveButton<SavedRecipe>
                storageKey={SAVED_KEYS.recipes}
                itemKey="recipe_id"
                item={{
                  recipe_id: id,
                  title: outcome.data.title,
                  category: outcome.data.category_large ?? null,
                  saved_at: new Date().toISOString(),
                }}
                label="레시피 검토함에 저장"
                savedLabel="레시피 저장됨"
              />
            </header>

            {outcome.data.ingredients.length > 0 ? (
              <section className="recipe-ingredients">
                <h2>식재료</h2>
                <div className="recipe-ingredients__grid">
                  {outcome.data.ingredients
                    .filter((ing) => !ing.is_seasoning)
                    .map((ing) => {
                      const ingredientName = displayIngredientName(ing.ingredient_name);
                      return (
                      <div key={ing.ingredient_id} className="recipe-ingredient-row">
                        <Link href={productizationHref("/substitutes", { ...(recipeContext ?? {}), ingredientId: String(ing.ingredient_id), ingredientName })} className="recipe-ingredient-row__name">
                          {ingredientName}
                        </Link>
                        <span className="recipe-ingredient-row__amount">
                          {[ing.amount_raw, ing.unit_raw].filter(Boolean).join(" ") || "-"}
                        </span>
                      </div>
                    );})}
                </div>

                {outcome.data.ingredients.some((i) => i.is_seasoning) ? (
                  <>
                    <h3>양념</h3>
                    <div className="recipe-ingredients__grid">
                      {outcome.data.ingredients
                        .filter((ing) => ing.is_seasoning)
                        .map((ing) => {
                          const ingredientName = displayIngredientName(ing.ingredient_name);
                          return (
                          <div key={ing.ingredient_id} className="recipe-ingredient-row">
                            <Link href={productizationHref("/substitutes", { ...(recipeContext ?? {}), ingredientId: String(ing.ingredient_id), ingredientName })} className="recipe-ingredient-row__name">
                              {ingredientName}
                            </Link>
                            <span className="recipe-ingredient-row__amount">
                              {[ing.amount_raw, ing.unit_raw].filter(Boolean).join(" ") || "-"}
                            </span>
                          </div>
                        );})}
                    </div>
                  </>
                ) : null}
              </section>
            ) : (
              <p className="resource-detail__empty">식재료 정보가 없습니다.</p>
            )}

            <section className="evidence-section productization-cta" aria-labelledby="recipe-productization"><div><p className="eyebrow">NEXT STEP</p><h2 id="recipe-productization">식재료를 선택해 대체안 비교</h2><p>위 식재료 이름을 누르면 별도 식재료 페이지를 거치지 않고, 이 레시피 맥락을 유지한 채 영양·조리 유사도 기반 대체안을 바로 비교합니다.</p></div><Link className="button button--secondary" href="/substitutes">대체 식재료 직접 검색</Link></section>

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
