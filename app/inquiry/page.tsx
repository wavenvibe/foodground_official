import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InquiryForm from "./InquiryForm";
import { getPublicFacility } from "@/lib/facilities";
import ProductizationFlow from "@/components/manufacturing/ProductizationFlow";
import type { ProductizationContext, ProductizationSourceType } from "@/lib/productization-context";

export const dynamic = "force-dynamic";

interface InquiryPageProps {
  searchParams: Promise<{
    facility?: string;
    facilityName?: string;
    ingredient?: string;
    substitute?: string;
    recipe?: string;
    recipeName?: string;
    ingredientId?: string;
    substituteId?: string;
    sourceType?: string;
    sourceId?: string;
    back?: string;
    sourceName?: string;
    item?: string;
    process?: string;
  }>;
}

function safeBack(back: string | undefined): string {
  if (!back) return "/facilities";
  try {
    const decoded = decodeURIComponent(back);
    if (/^\/facilities(?:\/[0-9A-Za-z_-]+)?(?:\?[^<>"]*)?$/.test(decoded)) return decoded;
  } catch {
    // malformed percent-encoding — fall through to default
  }
  return "/facilities";
}

export default async function InquiryPage({ searchParams }: InquiryPageProps) {
  const params = await searchParams;
  const facilityId = params.facility ?? "";
  const facilityName = params.facilityName ?? "";
  const ingredient = params.ingredient ?? "";
  const substitute = params.substitute ?? "";
  const recipe = params.recipe ?? "";
  const recipeName = params.recipeName ?? "";
  const sourceName = params.sourceName ?? "";
  const item = params.item ?? "";
  const process = params.process ?? "";
  const backUrl = safeBack(params.back);
  const context: ProductizationContext = {
    sourceType: (params.sourceType || (recipe ? "recipe" : "direct")) as ProductizationSourceType,
    sourceId: params.sourceId,
    sourceName,
    recipeId: recipe,
    recipeName,
    ingredientId: params.ingredientId,
    ingredientName: ingredient,
    substituteId: params.substituteId,
    substituteName: substitute,
    item,
  };

  // Fetch facility contact info if ID is present
  const facilityOutcome = facilityId ? await getPublicFacility(facilityId) : null;
  const facilityData = facilityOutcome?.ok ? facilityOutcome.data : null;
  const facilityTel = facilityData?.tel ?? null;
  const facilityHomepage = facilityData?.homepage
    ? /^https?:\/\//i.test(facilityData.homepage) ? facilityData.homepage : null
    : null;

  const contextLost = !facilityId;

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <ProductizationFlow current="inquiry" context={context} />
        <nav aria-label="뒤로가기" style={{ marginBottom: "1rem" }}>
          <Link href={backUrl} className="button button--secondary">
            ← 시설 정보로 돌아가기
          </Link>
        </nav>

        <header className="page-heading">
          <p className="eyebrow">INQUIRY</p>
          <h1>문의 준비</h1>
          <p>
            아래 문의 내용을 확인하고 수정한 뒤 복사해 시설에 직접 연락하세요.
            내용은 저장·전송되지 않습니다.
          </p>
        </header>

        {/* Context summary */}
        {(facilityName || ingredient || substitute || recipe || sourceName || item || process) && (
          <aside
            className="inquiry-context"
            aria-label="문의 맥락"
          >
            <h2 className="inquiry-context__title">선택한 맥락</h2>
            <dl className="inquiry-context__list">
              {recipe && (
                <>
                  <dt>레시피</dt>
                  <dd>{recipeName || `레시피 #${recipe}`}</dd>
                </>
              )}
              {ingredient && (
                <>
                  <dt>식재료</dt>
                  <dd>{ingredient}</dd>
                </>
              )}
              {substitute && (
                <>
                  <dt>대체 후보</dt>
                  <dd>{substitute}</dd>
                </>
              )}
              {sourceName && <><dt>제품화 시작점</dt><dd>{sourceName}</dd></>}
              {item && <><dt>제품유형</dt><dd>{item}</dd></>}
              {process && <><dt>필수 공정·CCP</dt><dd>{process}</dd></>}
              {facilityName && (
                <>
                  <dt>문의 시설</dt>
                  <dd>{facilityName}</dd>
                </>
              )}
            </dl>
            <p className="inquiry-context__notice">
              위 정보는 문의 내용 초안에 반영됩니다. 직접 수정할 수 있습니다.
            </p>
          </aside>
        )}

        {contextLost && (
          <aside className="inquiry-context-lost" role="alert" aria-label="맥락 없음 안내">
            <p>
              <strong>직접 진입 또는 맥락 없음</strong> — 시설을 특정하지 않고 문의 내용을 작성합니다.
              시설을 먼저 찾으려면{" "}
              <Link href="/facilities" className="link">제조시설 목록</Link>으로 이동하세요.
            </p>
            <p className="inquiry-context-lost__sub">
              아래 문안을 직접 수정해 사용할 수 있습니다.
            </p>
          </aside>
        )}

        {!contextLost && (
          <aside className="inquiry-facility-contact" aria-label="시설 연락처">
            <h2 className="inquiry-facility-contact__title">연락 수단 (공개 정보)</h2>
            <dl className="inquiry-facility-contact__list">
              <div>
                <dt>전화</dt>
                <dd>
                  {facilityTel
                    ? <a href={`tel:${facilityTel}`}>{facilityTel}</a>
                    : <span className="text-muted">정보 없음</span>}
                </dd>
              </div>
              <div>
                <dt>홈페이지</dt>
                <dd>
                  {facilityHomepage
                    ? <a href={facilityHomepage} target="_blank" rel="noopener noreferrer">{facilityHomepage}</a>
                    : <span className="text-muted">정보 없음</span>}
                </dd>
              </div>
            </dl>
            <p className="inquiry-facility-contact__note">
              이메일 주소 추정·자동 발송하지 않습니다. 전화 또는 홈페이지로 직접 연락하세요.
            </p>
          </aside>
        )}

        <InquiryForm
          facilityId={facilityId}
          facilityName={facilityName}
          ingredient={ingredient}
          substitute={substitute}
          recipe={recipe}
          recipeName={recipeName}
          sourceName={sourceName}
          item={item}
          process={process}
        />

        <aside className="data-note" style={{ marginTop: "1.5rem" }}>
          문의 내용은 브라우저에서만 작성되며 저장·전송되지 않습니다.
          제품·공정 HACCP 적합 여부는 시설에 직접 확인해 주세요.
        </aside>
      </main>
      <Footer />
    </div>
  );
}
