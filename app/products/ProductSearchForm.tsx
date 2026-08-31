"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

interface ProductSearchFormProps {
  defaultValue?: string;
}

export default function ProductSearchForm({ defaultValue = "" }: ProductSearchFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(`/products${q ? `?${params.toString()}` : ""}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full gap-2 mb-6"
      role="search"
      aria-label="제품 검색"
    >
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="제품명으로 검색..."
        aria-label="제품 검색어"
        className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2"
        style={{
          border: "1px solid var(--rule)",
          background: "var(--paper)",
          color: "var(--ink)",
        }}
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
        aria-label="제품 검색 실행"
      >
        {isPending ? "검색 중..." : "검색"}
      </button>
    </form>
  );
}
