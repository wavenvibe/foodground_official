"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface ProductFiltersProps {
  currentCategory: string;
  categories: string[];
}

// @MX:NOTE: [AUTO] Client component — handles category filter interactivity for the product search page sidebar
export default function ProductFilters({
  currentCategory,
  categories,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filter changes
    params.delete("page");
    startTransition(() => {
      router.push(`/products?${params.toString()}`);
    });
  }

  const labelStyle = {
    color: "var(--ink-2)",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const selectStyle = {
    background: "var(--paper)",
    border: "1px solid var(--rule)",
    color: "var(--ink)",
    borderRadius: 8,
    padding: "8px 12px",
    width: "100%",
    fontSize: "0.875rem",
    opacity: isPending ? 0.6 : 1,
  };

  return (
    <aside
      aria-label="제품 필터"
      className="flex flex-col gap-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        padding: "16px",
        minWidth: 0,
      }}
    >
      <h2 style={{ color: "var(--green-900)", fontSize: "0.9375rem", fontWeight: 700 }}>
        필터
      </h2>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-category" style={labelStyle}>
          카테고리
        </label>
        <select
          id="filter-category"
          value={currentCategory}
          onChange={(e) => updateParam("category", e.target.value)}
          style={selectStyle}
          disabled={isPending}
        >
          <option value="">전체</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
