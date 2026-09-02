"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function ProductFilters({ currentCategory, categories, currentHaccp }: { currentCategory: string; categories: string[]; currentHaccp: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/products?${params.toString()}`));
  }
  return (
    <aside className="product-filters" aria-label="제품 필터" aria-busy={isPending}>
      <h2>제품 필터</h2>
      <label><span>식품 유형</span><select value={currentCategory} onChange={(event) => update("category", event.target.value)} disabled={isPending}><option value="">전체</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="product-filters__check"><input type="checkbox" checked={currentHaccp} onChange={(event) => update("haccp", event.target.checked ? "1" : "")} disabled={isPending} /><span>스마트 HACCP 등록 시설 생산제품만</span></label>
      <button className="button button--secondary" type="button" onClick={() => router.push("/products")}>필터 초기화</button>
    </aside>
  );
}
