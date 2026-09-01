import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ManufacturingBriefForm from "@/components/manufacturing/ManufacturingBriefForm";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import ProductizationContextPanel from "@/components/manufacturing/ProductizationContextPanel";
import { getManufacturingOptions } from "@/lib/manufacturing-match";
import type { ProductizationContext, ProductizationSourceType } from "@/lib/productization-context";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function ManufacturingBriefPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const source: ProductizationContext = {
    sourceType: (first(params.sourceType) || "direct") as ProductizationSourceType,
    sourceId: first(params.sourceId),
    sourceName: first(params.sourceName),
    recipeId: first(params.recipe),
    recipeName: first(params.recipeName),
    ingredientId: first(params.ingredientId),
    ingredientName: first(params.ingredient),
    substituteId: first(params.substituteId),
    substituteName: first(params.substitute),
    item: first(params.item),
  };
  const options = await getManufacturingOptions();
  return (
    <div className="app-shell"><Header /><main className="page-container manufacturing-page">
      <ProductizationFlow current="brief" context={source} />
      <header className="manufacturing-hero"><p className="eyebrow">PRODUCTIZATION BRIEF</p><h1>어떤 제품을, 어떤 공정으로 만들까요?</h1><p>제품유형과 필요한 공정을 확정하면 실제 시설키가 연결된 제조 프로필만 근거별로 비교합니다.</p></header>
      <ProductizationContextPanel context={source} />
      <ManufacturingBriefForm options={options} source={source} />
      <aside className="data-note">후보는 시설을 자동 선정하거나 제조 가능성을 보증하지 않습니다. 표시된 품목·CCP·지역·스마트 HACCP 근거를 확인한 뒤 설비용량·MOQ·납기·제품별 등록 적용범위는 업체에 추가 확인해야 합니다.</aside>
    </main><Footer /></div>
  );
}
