"use client";
import StatePanel from "@/components/StatePanel";
export default function ProductsError({ reset }: { reset: () => void }) {
  return <main className="page-container"><StatePanel tone="error" title="제품 화면을 열지 못했습니다" description="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" onAction={reset} /></main>;
}
