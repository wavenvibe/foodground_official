export type ProductizationSourceType = "product" | "recipe" | "ingredient" | "direct";

export interface ProductizationContext {
  sourceType?: ProductizationSourceType;
  sourceId?: string;
  sourceName?: string;
  recipeId?: string;
  recipeName?: string;
  ingredientId?: string;
  ingredientName?: string;
  substituteId?: string;
  substituteName?: string;
  item?: string;
  region?: string;
  requiredCcp?: string[];
  cooking?: boolean;
  sterilize?: boolean;
}

const MAX_CONTEXT_VALUE = 160;

export function cleanContextValue(value: string | undefined): string {
  return (value ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT_VALUE);
}

export function appendProductizationContext(
  params: URLSearchParams,
  context: ProductizationContext,
): URLSearchParams {
  const values: Array<[string, string | undefined]> = [
    ["sourceType", context.sourceType],
    ["sourceId", context.sourceId],
    ["sourceName", context.sourceName],
    ["recipe", context.recipeId],
    ["recipeName", context.recipeName],
    ["ingredientId", context.ingredientId],
    ["ingredient", context.ingredientName],
    ["substituteId", context.substituteId],
    ["substitute", context.substituteName],
    ["item", context.item],
    ["region", context.region],
  ];

  values.forEach(([key, value]) => {
    const cleaned = cleanContextValue(value);
    if (cleaned) params.set(key, cleaned);
  });
  context.requiredCcp?.forEach((code) => {
    const cleaned = cleanContextValue(code);
    if (cleaned) params.append("ccp", cleaned);
  });
  if (context.cooking) params.set("cooking", "1");
  if (context.sterilize) params.set("sterilize", "1");
  return params;
}

export function productizationHref(path: string, context: ProductizationContext): string {
  const query = appendProductizationContext(new URLSearchParams(), context).toString();
  return query ? `${path}?${query}` : path;
}

export function sourceTypeLabel(sourceType: ProductizationContext["sourceType"]): string {
  if (sourceType === "recipe") return "레시피";
  if (sourceType === "product") return "제품";
  if (sourceType === "ingredient") return "식재료";
  return "직접 입력";
}
