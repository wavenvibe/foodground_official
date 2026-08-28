"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useUser } from "@/lib/useUser";

const FACILITIES_KEY = "fg_saved_facilities";
const PRODUCTS_KEY = "fg_saved_products";

interface SavedFacility {
  mgt_no: string;
  name: string;
  biz_type: string | null;
  region_sido: string | null;
  saved_at: string;
}

interface SavedProduct {
  report_no: string;
  product_name: string;
  category: string | null;
  facility_mgt_no: string;
  facility_name: string;
  saved_at: string;
}

function loadFacilities(): SavedFacility[] {
  try {
    const raw = localStorage.getItem(FACILITIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadProducts(): SavedProduct[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SavedPage() {
  const { user, loading: authLoading } = useUser();
  const [mounted, setMounted] = useState(false);
  const [facilities, setFacilities] = useState<SavedFacility[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacilities(loadFacilities());
    setProducts(loadProducts());
    setMounted(true);
  }, []);

  function handleRemoveFacility(mgtNo: string) {
    const next = facilities.filter((f) => f.mgt_no !== mgtNo);
    localStorage.setItem(FACILITIES_KEY, JSON.stringify(next));
    setFacilities(next);
  }

  function handleRemoveProduct(reportNo: string) {
    const next = products.filter((p) => p.report_no !== reportNo);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
    setProducts(next);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <h1
            className="text-2xl font-bold mb-6"
            style={{ color: "var(--green-900)" }}
          >
            관심업체/제품
          </h1>

          {/* Hint banner — only shown when not logged in */}
          {!authLoading && !user && (
            <aside
              className="rounded-lg p-4 mb-8 text-sm"
              style={{
                background: "var(--green-50)",
                border: "1px solid var(--rule)",
                color: "var(--ink-2)",
              }}
            >
              로그인하면 다른 기기에서도 관심업체/제품이 유지됩니다. 로그인 없이
              저장한 목록은 현재 브라우저에만 저장됩니다(localStorage).{" "}
              <Link
                href="/signin"
                className="font-medium underline"
                style={{ color: "var(--green-700)" }}
              >
                로그인하기
              </Link>
            </aside>
          )}

          {/* Saved Facilities Section */}
          <section className="mb-10" aria-labelledby="facilities-heading">
            <h2
              id="facilities-heading"
              className="text-lg font-bold mb-4"
              style={{ color: "var(--green-900)" }}
            >
              관심업체 ({mounted ? facilities.length : 0})
            </h2>

            {!mounted ? null : facilities.length === 0 ? (
              <div
                className="rounded-lg p-8 text-center"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--rule)",
                }}
              >
                <p
                  className="text-base font-medium mb-3"
                  style={{ color: "var(--ink)" }}
                >
                  저장된 업체가 없습니다.
                </p>
                <Link
                  href="/search"
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--green-500)",
                    color: "var(--green-cta-text)",
                  }}
                >
                  업체 검색하기
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3" role="list">
                {facilities.map((item) => (
                  <li
                    key={item.mgt_no}
                    className="rounded-lg p-4"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
                          <Link
                            href={`/b/${item.mgt_no}`}
                            className="hover:underline"
                            style={{ color: "var(--green-700)" }}
                          >
                            {item.name}
                          </Link>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {item.biz_type && (
                            <span
                              className="text-xs rounded-full px-2 py-0.5"
                              style={{
                                background: "var(--green-100)",
                                color: "var(--ink)",
                              }}
                            >
                              {item.biz_type}
                            </span>
                          )}
                          {item.region_sido && (
                            <span
                              className="text-xs"
                              style={{ color: "var(--ink-2)" }}
                            >
                              {item.region_sido}
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                          저장일: {item.saved_at.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFacility(item.mgt_no)}
                        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
                        style={{
                          background: "var(--paper)",
                          color: "var(--warn)",
                          border: "1px solid var(--rule)",
                        }}
                        aria-label={`${item.name} 저장 목록에서 제거`}
                      >
                        제거
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Saved Products Section */}
          <section aria-labelledby="products-heading">
            <h2
              id="products-heading"
              className="text-lg font-bold mb-4"
              style={{ color: "var(--green-900)" }}
            >
              관심제품 ({mounted ? products.length : 0})
            </h2>

            {!mounted ? null : products.length === 0 ? (
              <div
                className="rounded-lg p-8 text-center"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--rule)",
                }}
              >
                <p
                  className="text-base font-medium mb-3"
                  style={{ color: "var(--ink)" }}
                >
                  저장된 제품이 없습니다.
                </p>
                <Link
                  href="/products"
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--green-500)",
                    color: "var(--green-cta-text)",
                  }}
                >
                  제품 검색하기
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3" role="list">
                {products.map((item) => (
                  <li
                    key={item.report_no}
                    className="rounded-lg p-4"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold mb-1"
                          style={{ color: "var(--ink)" }}
                        >
                          {item.product_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {item.category && (
                            <span
                              className="text-xs rounded-full px-2 py-0.5"
                              style={{
                                background: "var(--green-100)",
                                color: "var(--ink)",
                              }}
                            >
                              {item.category}
                            </span>
                          )}
                          <span
                            className="text-xs"
                            style={{ color: "var(--ink-2)" }}
                          >
                            업체:{" "}
                            <Link
                              href={`/b/${item.facility_mgt_no}`}
                              className="hover:underline"
                              style={{ color: "var(--green-700)" }}
                            >
                              {item.facility_name}
                            </Link>
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                          저장일: {item.saved_at.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.report_no)}
                        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
                        style={{
                          background: "var(--paper)",
                          color: "var(--warn)",
                          border: "1px solid var(--rule)",
                        }}
                        aria-label={`${item.product_name} 저장 목록에서 제거`}
                      >
                        제거
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
