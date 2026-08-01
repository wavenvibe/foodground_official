import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DataWarning from "@/components/DataWarning";
import ProductFilters from "./ProductFilters";
import ProductSearchForm from "./ProductSearchForm";
import ProductSaveButton from "./ProductSaveButton";
import { searchProducts, getTopCategories } from "@/lib/product";
import { getSyncStatus } from "@/lib/facility";

export const revalidate = 60;

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

function Pagination({
  page,
  total,
  pageSize,
  baseHref,
}: {
  page: number;
  total: number;
  pageSize: number;
  baseHref: string;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const makeHref = (p: number) => `${baseHref}&page=${p}`;

  // Show at most 5 page numbers centered around current page
  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    height: 36,
    padding: "0 8px",
    borderRadius: 6,
    fontSize: "0.875rem",
    border: "1px solid var(--rule)",
    background: "var(--paper)",
    color: "var(--ink)",
    textDecoration: "none",
  };

  const activeBtnStyle = {
    ...btnBase,
    background: "var(--green-500)",
    color: "var(--green-cta-text)",
    border: "1px solid var(--green-500)",
    fontWeight: 600,
  };

  return (
    <nav aria-label="페이지 이동" className="flex items-center gap-1 flex-wrap">
      {page > 1 && (
        <Link href={makeHref(page - 1)} style={btnBase} aria-label="이전 페이지">
          ‹ 이전
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={makeHref(p)}
          style={p === page ? activeBtnStyle : btnBase}
          aria-current={p === page ? "page" : undefined}
          aria-label={`${p} 페이지`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={makeHref(page + 1)} style={btnBase} aria-label="다음 페이지">
          다음 ›
        </Link>
      )}
    </nav>
  );
}

// @MX:ANCHOR: [AUTO] Product search page — primary entry point for product browsing feature
// @MX:REASON: Fan-in >= 3: Header, Footer, ProductFilters, DataWarning, searchProducts, getTopCategories
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const category = params.category ?? "";
  const page = Number(params.page) || 1;

  const [result, categories, syncStatus] = await Promise.all([
    searchProducts({
      q: q || undefined,
      category: category || undefined,
      page,
    }),
    getTopCategories(30),
    getSyncStatus(),
  ]);

  // Build base href for pagination (all current params except page)
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (category) baseParams.set("category", category);
  const baseHref = `/products?${baseParams.toString()}`;

  const pageTitle = q ? `"${q}" 제품 검색 결과` : "전체 제품 검색";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--green-900)" }}
          >
            {pageTitle}
          </h1>

          <Suspense fallback={null}>
            <ProductSearchForm defaultValue={q} />
          </Suspense>

          <div className="flex gap-6">
            {/* Sidebar filters */}
            <div className="hidden md:block w-56 flex-shrink-0">
              <Suspense fallback={null}>
                <ProductFilters
                  currentCategory={category}
                  categories={categories}
                />
              </Suspense>
            </div>

            {/* Results */}
            <section className="flex-1 min-w-0" aria-label="제품 검색 결과">
              {/* Result count */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                  총{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {result.total.toLocaleString()}
                  </strong>
                  건
                </p>
              </div>

              {/* Product list */}
              {result.products.length === 0 ? (
                <div
                  className="rounded-lg p-12 text-center"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <p
                    className="text-base font-medium mb-2"
                    style={{ color: "var(--ink)" }}
                  >
                    검색 결과가 없습니다.
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                    필터를 조정하거나 다른 검색어를 입력해 보세요.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3" role="list">
                  {result.products.map((product) => (
                    <li key={product.report_no}>
                      <article
                        className="rounded-lg p-4"
                        style={{
                          background: "var(--paper)",
                          border: "1px solid var(--rule)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          transition: "box-shadow 0.15s",
                        }}
                      >
                        {/* Product name + category badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h2
                            className="text-base font-semibold leading-snug"
                            style={{ color: "var(--ink)" }}
                          >
                            {product.product_name}
                          </h2>
                          {product.category && (
                            <span
                              className="flex-shrink-0 text-xs rounded-full px-2 py-0.5"
                              style={{
                                background: "var(--green-100)",
                                color: "var(--ink)",
                              }}
                            >
                              {product.category}
                            </span>
                          )}
                        </div>

                        {/* Facility link */}
                        <p className="text-sm mb-1" style={{ color: "var(--ink-2)" }}>
                          업체:{" "}
                          {product.facility_mgt_no && product.facility_name ? (
                            <Link
                              href={`/b/${product.facility_mgt_no}`}
                              style={{
                                color: "var(--green-700)",
                                textDecoration: "none",
                              }}
                              className="hover:underline"
                            >
                              {product.facility_name}
                            </Link>
                          ) : (
                            <span style={{ color: "var(--ink-2)" }}>정보 없음</span>
                          )}
                        </p>

                        {/* Maker + reported date */}
                        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                          {product.maker_name && (
                            <>제조사: {product.maker_name}</>
                          )}
                          {product.maker_name && product.reported_at && (
                            <span> · </span>
                          )}
                          {product.reported_at && (
                            <>신고일: {product.reported_at.slice(0, 10)}</>
                          )}
                        </p>

                        {/* Region */}
                        {product.facility_region && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--ink-2)" }}
                          >
                            {product.facility_region}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end">
                          <ProductSaveButton
                            reportNo={product.report_no}
                            productName={product.product_name}
                            category={product.category}
                            facilityMgtNo={product.facility_mgt_no}
                            facilityName={product.facility_name}
                          />
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}

              {/* Pagination */}
              {result.total > result.pageSize && (
                <div className="mt-6">
                  <Pagination
                    page={result.page}
                    total={result.total}
                    pageSize={result.pageSize}
                    baseHref={baseHref}
                  />
                </div>
              )}

              {/* Data warning */}
              <div className="mt-8">
                <DataWarning
                  productionAt={syncStatus.production_at}
                  facilityAt={syncStatus.facility_at}
                  suspensionAt={syncStatus.suspension_at}
                />
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
