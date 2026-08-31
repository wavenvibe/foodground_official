import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StatePanel from "@/components/StatePanel";
import MatchTypeBadge from "@/components/substitutes/MatchTypeBadge";
import ProvenanceBadge from "@/components/substitutes/ProvenanceBadge";
import LimitationNotice from "@/components/substitutes/LimitationNotice";
import SubstituteCandidateList from "@/components/substitutes/SubstituteCandidateList";
import ProductizationContextPanel from "@/components/manufacturing/ProductizationContextPanel";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import { searchSubstitutes } from "@/lib/substitutes";
import { productizationHref, type ProductizationContext } from "@/lib/productization-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SubstitutesPageProps {
  searchParams: Promise<{ ingredient?: string; ingredientId?: string; recipe?: string; recipeName?: string; sourceType?: string; sourceId?: string; sourceName?: string }>;
}

export default async function SubstitutesPage({ searchParams }: SubstitutesPageProps) {
  const params = await searchParams;
  const ingredientQuery = (params.ingredient ?? "").trim();
  const recipe = (params.recipe ?? "").trim();
  const context: ProductizationContext = {
    sourceType: recipe ? "recipe" : ingredientQuery ? "ingredient" : "direct",
    sourceId: params.sourceId || recipe || params.ingredientId,
    sourceName: params.sourceName || params.recipeName || ingredientQuery,
    recipeId: recipe,
    recipeName: params.recipeName,
    ingredientId: params.ingredientId,
    ingredientName: ingredientQuery,
  };

  const outcome = ingredientQuery ? await searchSubstitutes(ingredientQuery) : null;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <ProductizationFlow current="substitute" context={context} />
        <header className="page-heading">
          <p className="eyebrow">SUBSTITUTE</p>
          <h1>대체 식재료 찾기</h1>
          <p>식재료 이름을 입력하면 영양 성분과 조리 특성을 기준으로 유사한 대체 식재료를 찾아드립니다.</p>
        </header>

        <LimitationNotice />

        <form
          className="substitute-search-form"
          method="get"
          action="/substitutes"
          role="search"
          aria-label="대체 식재료 검색"
        >
          <div className="substitute-search-form__row">
            <label htmlFor="substitute-input" className="substitute-search-form__label">
              식재료 이름
            </label>
            <div className="substitute-search-form__field">
              {recipe && <input type="hidden" name="recipe" value={recipe} />}
              {params.recipeName && <input type="hidden" name="recipeName" value={params.recipeName} />}
              {params.ingredientId && <input type="hidden" name="ingredientId" value={params.ingredientId} />}
              {params.sourceType && <input type="hidden" name="sourceType" value={params.sourceType} />}
              {params.sourceId && <input type="hidden" name="sourceId" value={params.sourceId} />}
              {params.sourceName && <input type="hidden" name="sourceName" value={params.sourceName} />}
              <input
                id="substitute-input"
                type="search"
                name="ingredient"
                defaultValue={ingredientQuery}
                placeholder="예: 돼지고기, 두부, 양파"
                className="substitute-search-form__input"
                maxLength={100}
                autoComplete="off"
                aria-required="true"
              />
              <button type="submit" className="button button--point">
                검색
              </button>
            </div>
          </div>
        </form>

        <ProductizationContextPanel context={context} />

        {/* Initial state — no query yet */}
        {!ingredientQuery && (
          <StatePanel
            title="식재료 이름을 검색하세요"
            description="검색창에 식재료 이름을 입력하고 검색 버튼을 누르면 유사한 대체 식재료 목록을 확인할 수 있습니다."
          />
        )}

        {/* Malformed or empty input returned as error */}
        {outcome && !outcome.ok && outcome.error.code === "FG_BAD_REQUEST" && (
          <StatePanel
            tone="warning"
            title="검색어를 확인해 주세요"
            description={outcome.error.message}
            traceId={outcome.traceId}
          />
        )}

        {/* Data unavailable */}
        {outcome && !outcome.ok && outcome.error.code === "FG_DATA_UNAVAILABLE" && (
          <StatePanel
            tone="error"
            title="결과를 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요. 문제가 계속되면 추적번호와 함께 문의해 주세요."
            traceId={outcome.traceId}
            actionHref={productizationHref("/substitutes", context)}
            actionLabel="다시 시도"
          />
        )}

        {/* No candidate found */}
        {outcome && outcome.ok && outcome.data === null && (
          <StatePanel
            title="대체 식재료를 찾지 못했습니다"
            description="검색한 식재료에 대한 대체 후보 정보가 없습니다. 다른 이름으로 검색해 보세요."
            actionHref="/substitutes"
            actionLabel="다시 검색"
          />
        )}

        {/* Unmatched — known input with no standard food link */}
        {outcome && outcome.ok && outcome.data?.match_type === "unmatched" && (
          <section className="substitute-results substitute-results--unmatched" aria-label="미매칭 결과">
            <div className="substitute-results__head">
              <div className="substitute-results__meta">
                <h2>
                  <span className="substitute-results__source">{outcome.data.input_name}</span>
                </h2>
                <div className="substitute-results__badges">
                  <MatchTypeBadge
                    matchType="unmatched"
                    confidence={outcome.data.match_confidence}
                  />
                </div>
              </div>
            </div>
            <StatePanel
              title="표준 식품 데이터와 연결되지 않은 식재료입니다"
              description="이 이름은 데이터베이스에 등록되어 있지만 표준 식품과 연결이 없어 대체 후보를 찾을 수 없습니다. 다른 이름이나 일반 명칭으로 검색해 보세요."
              actionHref="/substitutes"
              actionLabel="다시 검색"
            />
          </section>
        )}

        {/* Results */}
        {outcome && outcome.ok && outcome.data !== null && outcome.data.match_type !== "unmatched" && outcome.data.source_food !== null && (
          <section className="substitute-results" aria-labelledby="substitute-results-title">
            <div className="substitute-results__head">
              <div className="substitute-results__meta">
                <h2 id="substitute-results-title">
                  <span className="substitute-results__source">{outcome.data.source_food.name}</span>의 대체 식재료
                </h2>
                <div className="substitute-results__badges">
                  <MatchTypeBadge
                    matchType={outcome.data.match_type}
                    confidence={outcome.data.match_confidence}
                  />
                  {outcome.data.source_food.food_group && (
                    <span className="food-group-badge">{outcome.data.source_food.food_group}</span>
                  )}
                </div>
              </div>
              <p className="substitute-results__count">
                {outcome.data.candidates.length}건의 후보가 있습니다 · 종합 점수 순
              </p>
            </div>

            <ProvenanceBadge
              matchType={outcome.data.match_type}
              inputName={ingredientQuery}
              matchedName={outcome.data.source_food.name}
            />

            <SubstituteCandidateList
              candidates={outcome.data.candidates}
              sourceFood={outcome.data.source_food}
              ingredient={ingredientQuery}
              ingredientId={params.ingredientId ?? ""}
              recipe={recipe}
              recipeName={params.recipeName ?? ""}
              sourceType={context.sourceType}
              sourceId={context.sourceId ?? ""}
              sourceName={context.sourceName ?? ""}
            />

            {outcome.data.basis_date && (
              <p className="substitute-results__basis">
                매칭 기준일: {outcome.data.basis_date.slice(0, 10)}
              </p>
            )}
            <div className="substitute-results__facility-link">
              <Link
                href={`/facilities?ingredient=${encodeURIComponent(ingredientQuery)}${recipe ? `&recipe=${encodeURIComponent(recipe)}` : ""}`}
                className="button button--secondary"
              >
                전체 제조시설 찾기
              </Link>
              <p>후보를 선택하지 않고 원 식재료 기준으로 제조시설을 검색합니다.</p>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
