"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

interface SearchFormProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  target?: string;
}

// @MX:NOTE: [AUTO] Client-only form island — only this component needs 'use client' on the home page
export default function SearchForm({
  defaultValue = "",
  placeholder = "업체명, 지역으로 검색...",
  className,
  target = "/facilities",
}: SearchFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(`${target}${q ? `?${params.toString()}` : ""}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className ?? "flex w-full max-w-xl gap-2"}
      role="search"
      aria-label="시설 검색"
    >
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label="검색어"
        className="flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
        style={{
          border: "1px solid var(--rule)",
          background: "var(--paper)",
          color: "var(--ink)",
          // @ts-expect-error CSS variable ring color
          "--tw-ring-color": "var(--green-500)",
        }}
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
        aria-label="검색 실행"
      >
        {isPending ? "검색 중..." : "검색"}
      </button>
    </form>
  );
}
