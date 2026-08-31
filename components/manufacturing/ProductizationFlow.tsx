import Link from "next/link";
import { productizationHref, type ProductizationContext } from "@/lib/productization-context";

const STEPS = [
  ["source", "1", "시작"],
  ["ingredient", "2", "식재료"],
  ["substitute", "3", "대체안"],
  ["brief", "4", "제조요건"],
  ["facility", "5", "제조후보·업체검증"],
  ["inquiry", "6", "문의"],
] as const;

export type ProductizationStep = (typeof STEPS)[number][0];

function stepHref(step: ProductizationStep, context: ProductizationContext): string | null {
  if (step === "source") {
    if (context.sourceType === "recipe" && context.recipeId) return `/recipes/${encodeURIComponent(context.recipeId)}`;
    if (context.sourceType === "product" && context.sourceId) return `/products/${encodeURIComponent(context.sourceId)}`;
    if (context.sourceType === "ingredient" && context.ingredientId) return `/ingredients/${encodeURIComponent(context.ingredientId)}`;
    return null;
  }
  if (step === "ingredient" && context.ingredientId) {
    return productizationHref(`/ingredients/${encodeURIComponent(context.ingredientId)}`, context);
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
