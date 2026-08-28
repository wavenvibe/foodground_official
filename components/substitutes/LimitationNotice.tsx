export default function LimitationNotice() {
  return (
    <aside className="limitation-notice" role="note" aria-label="대체 식재료 이용 주의 안내">
      <p className="limitation-notice__title">이용 전 반드시 확인하세요</p>
      <ul className="limitation-notice__list">
        <li>이 결과는 영양 성분·조리 특성 등을 바탕으로 산출한 유사도 정보이며, 가격·식감·맛·품질을 보장하지 않습니다.</li>
        <li>의료·임상 또는 법적 목적으로 사용할 수 없습니다. 알레르기 또는 특별 식이 요건이 있는 경우 전문가와 상담하세요.</li>
        <li>부분 일치·유사 일치 결과는 이름 유사도로 추론된 것이므로 실제 식품과 다를 수 있습니다.</li>
      </ul>
    </aside>
  );
}
