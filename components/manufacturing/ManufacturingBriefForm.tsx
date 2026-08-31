import { CCP_OPTIONS, type ManufacturingOptions } from "@/lib/manufacturing-match";
import type { ProductizationContext } from "@/lib/productization-context";

export default function ManufacturingBriefForm({ options, source }: { options: ManufacturingOptions; source: ProductizationContext }) {
  const initialItem = source.item?.trim() ?? "";
  const initialItemAvailable = options.itemTypes.some((option) => option.value === initialItem);
  return (
    <form action="/manufacturing-candidates" method="get" className="manufacturing-form">
      {source.sourceType ? <input type="hidden" name="sourceType" value={source.sourceType} /> : null}
      {source.sourceId ? <input type="hidden" name="sourceId" value={source.sourceId} /> : null}
      {source.sourceName ? <input type="hidden" name="sourceName" value={source.sourceName} /> : null}
      {source.recipeId ? <input type="hidden" name="recipe" value={source.recipeId} /> : null}
      {source.recipeName ? <input type="hidden" name="recipeName" value={source.recipeName} /> : null}
      {source.ingredientId ? <input type="hidden" name="ingredientId" value={source.ingredientId} /> : null}
      {source.ingredientName ? <input type="hidden" name="ingredient" value={source.ingredientName} /> : null}
      {source.substituteId ? <input type="hidden" name="substituteId" value={source.substituteId} /> : null}
      {source.substituteName ? <input type="hidden" name="substitute" value={source.substituteName} /> : null}

      <section className="manufacturing-form__section" aria-labelledby="brief-item-title">
        <div><p className="eyebrow">REQUIRED</p><h2 id="brief-item-title">제품유형 확인</h2><p>레시피·원재료·대체 후보 이름만으로 유형을 추정하지 않습니다. 실제 제조하려는 유형을 선택하세요.</p></div>
        <label className="manufacturing-field">
          <span>제품유형</span>
          <select name="item" defaultValue={initialItemAvailable ? initialItem : ""} required>
            <option value="">제품유형을 선택하세요</option>
            {options.itemTypes.map((option) => <option key={option.value} value={option.value}>{option.value} · 연결 프로필 {option.count}개</option>)}
          </select>
        </label>
        {initialItem && !initialItemAvailable ? <p className="manufacturing-form__warning">원본 제품유형 “{initialItem}”은 현재 265개 직접연결 프로필의 유형과 정확히 일치하지 않습니다. 아래에서 가까운 실제 유형을 직접 선택해 주세요.</p> : null}
      </section>

      <section className="manufacturing-form__section" aria-labelledby="brief-region-title">
        <div><p className="eyebrow">OPTIONAL</p><h2 id="brief-region-title">희망지역</h2><p>지역을 선택하지 않으면 전국의 직접연결 프로필을 비교합니다.</p></div>
        <label className="manufacturing-field"><span>시·도</span><select name="region" defaultValue=""><option value="">전국</option>{options.regions.map((option) => <option key={option.value} value={option.value}>{option.value} · {option.count}개</option>)}</select></label>
      </section>

      <section className="manufacturing-form__section" aria-labelledby="brief-process-title">
        <div><p className="eyebrow">OPTIONAL</p><h2 id="brief-process-title">필수 CCP·공정</h2><p>필수 조건만 체크하세요. 체크하지 않은 공정은 후보 판정에 사용하지 않습니다.</p></div>
        <fieldset className="manufacturing-check-grid"><legend>표준 CCP</legend>{CCP_OPTIONS.map(([code, label, description]) => <label key={code}><input type="checkbox" name="ccp" value={code} /><span><strong>{code} · {label}</strong><small>{description}</small></span></label>)}</fieldset>
        <fieldset className="manufacturing-check-grid manufacturing-check-grid--binary"><legend>공정 묶음</legend>
          <label><input type="checkbox" name="cooking" value="1" /><span><strong>가열공정 필요</strong><small>프로필의 조리 CCP 보유 여부를 확인</small></span></label>
          <label><input type="checkbox" name="sterilize" value="1" /><span><strong>살균공정 필요</strong><small>프로필의 살균 CCP 보유 여부를 확인</small></span></label>
        </fieldset>
      </section>

      <div className="manufacturing-form__submit"><p>직접연결 {options.linkedProfileCount}개만 비교하며 검토대상 {options.excludedReviewCount}개는 후보에서 제외합니다.</p><button className="button button--point" type="submit">이 요건으로 제조 후보 확인</button></div>
    </form>
  );
}
