import Link from "next/link";
import type { SubstituteCandidate, StandardFood } from "@/lib/substitutes";
import SimilarityBar from "./SimilarityBar";
import NutritionTable from "./NutritionTable";

const SIM_LABELS: Record<string, string> = {
  sim_nutrition: "영양 성분",
  sim_ingredient_category: "재료 분류",
  sim_food_group: "식품군",
  sim_cooking_state: "조리 상태",
  sim_dish_type: "요리 유형",
  sim_companion: "배합 재료",
};

interface SubstituteCandidateListProps {
  candidates: SubstituteCandidate[];
  sourceFood: StandardFood | null;
  ingredient: string;
  recipe: string;
}

export default function SubstituteCandidateList({
  candidates,
  sourceFood,
  ingredient,
  recipe,
}: SubstituteCandidateListProps) {
  if (!sourceFood || candidates.length === 0) return null;
  return (
    <ol className="candidate-list" aria-label="대체 식재료 후보 목록">
      {candidates.map((c, idx) => {
        const food = c.candidate_food;
        const finalScore = c.score_final != null ? Math.round(c.score_final * 100) : null;

        const facilityParams = new URLSearchParams();
        if (ingredient) facilityParams.set("ingredient", ingredient);
        facilityParams.set("substitute", food.name);
        if (recipe) facilityParams.set("recipe", recipe);
        const facilityHref = `/facilities?${facilityParams.toString()}`;

        return (
          <li key={food.standard_food_id} className="candidate-card">
            <div className="candidate-card__header">
              <div className="candidate-card__rank" aria-label={`순위 ${idx + 1}`}>
                {idx + 1}
              </div>
              <div className="candidate-card__title-group">
                <h3 className="candidate-card__name">{food.name}</h3>
                {food.food_group && (
                  <span className="candidate-card__group">{food.food_group}</span>
                )}
              </div>
              {finalScore != null && (
                <div
                  className="candidate-card__score"
                  aria-label={`종합 점수 ${finalScore}점`}
                >
                  <span className="candidate-card__score-value">{finalScore}</span>
                  <span className="candidate-card__score-unit">점</span>
                </div>
              )}
            </div>

            <div className="candidate-card__body">
              <section className="candidate-card__sim" aria-label="유사도 지표">
                <h4 className="candidate-card__section-title">유사도 지표</h4>
                <div className="sim-bars">
                  <SimilarityBar label={SIM_LABELS.sim_nutrition} value={c.sim_nutrition} />
                  <SimilarityBar label={SIM_LABELS.sim_ingredient_category} value={c.sim_ingredient_category} />
                  <SimilarityBar label={SIM_LABELS.sim_food_group} value={c.sim_food_group} />
                  <SimilarityBar label={SIM_LABELS.sim_cooking_state} value={c.sim_cooking_state} />
                  <SimilarityBar label={SIM_LABELS.sim_dish_type} value={c.sim_dish_type} />
                  <SimilarityBar label={SIM_LABELS.sim_companion} value={c.sim_companion} />
                </div>
                {c.available_sim_count != null && c.available_sim_count < 6 && (
                  <p className="candidate-card__sim-note">
                    6개 지표 중 {c.available_sim_count}개 산출 가능 (나머지 측정불가)
                  </p>
                )}
              </section>

              <section className="candidate-card__nutrition" aria-label="영양성분 비교">
                <h4 className="candidate-card__section-title">영양성분 비교</h4>
                <NutritionTable source={sourceFood} candidate={food} />
              </section>
            </div>

            {c.basis_date && (
              <p className="candidate-card__basis">
                분석 기준일: {c.basis_date.slice(0, 10)}
              </p>
            )}

            <div className="candidate-card__action">
              <Link href={facilityHref} className="button button--secondary">
                이 후보로 제조시설 찾기
              </Link>
              <p className="candidate-card__action-note">
                제품·공정 적합 여부는 시설에 직접 확인해 주세요.
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
