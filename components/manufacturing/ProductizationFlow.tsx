import Link from "next/link";
import { productizationHref, type ProductizationContext } from "@/lib/productization-context";

const STEPS = [
  ["source", "1", "레시피·제품"],
  ["substitute", "2", "대체재료"],
  ["brief", "3", "제조조건"],
  ["facility", "4", "제조후보·근거"],
  ["inquiry", "5", "문의"],
] as const;

export type ProductizationStep = (typeof STEPS)[number][0];

function stepHref(step: ProductizationStep, context: ProductizationContext): string | null {
  if (step === "source") {
    if (context.sourceType === "recipe" && context.recipeId) return `/recipes/${encodeURIComponent(context.recipeId)}`;
    if (context.sourceType === "product" && context.sourceId) return `/products/${encodeURIComponent(context.sourceId)}`;
    return null;
  }
  if (step === "substitute" && context.ingredientName) return productizationHref("/substitutes", context);
  if (step === "brief") return productizationHref("/manufacturing-brief", context);
  if (step === "facility" && context.item) return productizationHref("/manufacturing-candidates", context);
  return null;
}

export default function ProductizationFlow({
  current,
  context = {},
}: {
  current: ProductizationStep;
  context?: ProductizationContext;
}) {
  const currentIndex = STEPS.findIndex(([key]) => key === current);
  return (
    <nav className="productization-stepper" aria-label="제품화 진행 단계">
      <ol>
        {STEPS.map(([key, number, label], index) => {
          const href = stepHref(key, context);
          const content = <><span>{number}</span><strong>{label}</strong></>;
          return (
            <li className={`${key === current ? "is-current" : ""}${index < currentIndex ? " is-complete" : ""}`.trim()} key={key}>
              {href && key !== current
                ? <Link href={href}>{content}</Link>
                : <span aria-current={key === current ? "step" : undefined}>{content}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
