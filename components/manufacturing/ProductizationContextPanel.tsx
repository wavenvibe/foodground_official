import { sourceTypeLabel, type ProductizationContext } from "@/lib/productization-context";

export default function ProductizationContextPanel({ context }: { context: ProductizationContext }) {
  const rows = [
    context.sourceName ? ["시작점", `${sourceTypeLabel(context.sourceType)} · ${context.sourceName}`] : null,
    context.recipeName ? ["레시피", context.recipeName] : null,
    context.ingredientName ? ["원재료", context.ingredientName] : null,
    context.substituteName ? ["선택한 대체안", context.substituteName] : null,
    context.item ? ["제품유형", context.item] : null,
  ].filter((row): row is string[] => row !== null);

  if (!rows.length) return null;
  return (
    <aside className="productization-context-panel" aria-label="현재 제품화 선택">
      <p className="eyebrow">CURRENT WORK</p>
      <h2>현재 제품화 선택</h2>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p>제품유형과 제조 가능성은 이름으로 추정하지 않으며 다음 단계에서 직접 확인합니다.</p>
    </aside>
  );
}
