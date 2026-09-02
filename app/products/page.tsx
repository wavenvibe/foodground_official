import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StatePanel from "@/components/StatePanel";
import { listSourceProductCategories, searchSourceProducts } from "@/lib/source-db";
import ProductFilters from "./ProductFilters";
import ProductSearchForm from "./ProductSearchForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProductsPageProps {
  searchParams: Promise<{ q?: string; category?: string; facility?: string; haccp?: string; page?: string }>;
}

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page"); else next.set("page", String(page));
  return `/products${next.size ? `?${next.toString()}` : ""}`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const category = params.category ?? "";
  const facility = params.facility ?? "";
  const haccp = params.haccp === "1";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [outcome, categories] = await Promise.all([
    searchSourceProducts({ q, category, facility, haccp, page }),
    listSourceProductCategories(),
  ]);
  const current = new URLSearchParams();
  if (q) current.set("q", q);
  if (category) current.set("category", category);
  if (facility) current.set("facility", facility);
  if (haccp) current.set("haccp", "1");

  return (
    <div className="app-shell">
      <Header />
      <main className="page-container">
        <header className="page-heading">
          <p className="eyebrow">PRODUCT EVIDENCE</p>
          <h1>제품·제조업체 연결 검색</h1>
          <p>식품 제품을 찾고 실제 제조업체, 스마트 HACCP 등록·CCP, 직접 연결된 안전정보까지 확인합니다.</p>
        </header>
        <ProductSearchForm defaultValue={q} />
        <div className="product-discovery-layout">
          <ProductFilters currentCategory={category} categories={categories} currentHaccp={haccp} />
          <section className="product-results" aria-labelledby="product-results-title">
            <div className="facility-results__head"><div>
              <h2 id="product-results-title">제품 검색 결과</h2>
              <p>{outcome.ok ? `${outcome.data.meta.totalIsEstimate ? "약 " : "총 "}${outcome.data.meta.total.toLocaleString()}건 · 품목보고번호순` : "원본 연결 상태를 확인해 주세요."}</p>
            </div></div>
            {!outcome.ok ? (
              <StatePanel tone="warning" title="제품 원본 데이터 연결이 필요합니다" description={outcome.error.message} traceId={outcome.traceId} />
            ) : outcome.data.items.length === 0 ? (
              <StatePanel title="검색 결과가 없습니다" description="제품명·제조업체명 검색어를 바꾸거나 카테고리·필터를 초기화해 보세요." actionHref="/products" actionLabel="조건 초기화" />
            ) : (
              <>
                {facility ? <aside className="data-note product-context-note">제조시설 관리번호 <strong>{facility}</strong>에 직접 연결된 제품만 표시합니다.</aside> : null}
                <div className="product-evidence-list">
                  {outcome.data.items.map((product) => (
                    <article className="product-evidence-card" key={product.report_no}>
                      <div className="product-evidence-card__head">
                        <div><p className="product-evidence-card__id">품목보고번호 {product.report_no}</p><h2><Link href={`/products/${encodeURIComponent(product.report_no)}`}>{product.product_name}</Link></h2></div>
                        <div className="facility-card__chips">{product.facility_is_haccp ? <span className="chip chip--success">스마트 HACCP 등록 시설</span> : null}{product.category ? <span className="chip">{product.category}</span> : null}</div>
                      </div>
                      <dl className="product-evidence-card__facts">
                        <div><dt>제조업체</dt><dd>{product.facility_mgt_no && product.facility_name ? <Link href={`/facilities/${encodeURIComponent(product.facility_mgt_no)}`}>{product.facility_name}</Link> : product.maker_name || "연결 정보 없음"}</dd></div>
                        <div><dt>지역</dt><dd>{[product.facility_region_sido, product.facility_region_sigungu].filter(Boolean).join(" ") || "-"}</dd></div>
                        <div><dt>신고일</dt><dd>{product.reported_at?.slice(0, 10) || "-"}</dd></div>
                      </dl>
                      <Link className="button button--secondary" href={`/products/${encodeURIComponent(product.report_no)}`}>연결 근거 보기</Link>
                    </article>
                  ))}
                </div>
                <nav className="pagination" aria-label="제품 검색 페이지">
                  {outcome.data.meta.page > 1 ? <Link className="button button--secondary" href={pageHref(current, outcome.data.meta.page - 1)}>이전</Link> : <span />}
                  <span>{outcome.data.meta.page}페이지</span>
                  {outcome.data.meta.page * outcome.data.meta.pageSize < outcome.data.meta.total ? <Link className="button button--secondary" href={pageHref(current, outcome.data.meta.page + 1)}>다음</Link> : <span />}
                </nav>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
