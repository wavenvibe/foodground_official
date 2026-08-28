"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "fg_saved_facilities";

interface SavedFacility {
  mgt_no: string;
  name: string;
  biz_type: string | null;
  region_sido: string | null;
  saved_at: string;
}

interface FacilitySaveButtonProps {
  mgtNo: string;
  name: string;
  bizType: string | null | undefined;
  regionSido: string | null | undefined;
}

function loadSaved(): SavedFacility[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function FacilitySaveButton({
  mgtNo,
  name,
  bizType,
  regionSido,
}: FacilitySaveButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const items = loadSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(items.some((item) => item.mgt_no === mgtNo));
    setMounted(true);
  }, [mgtNo]);

  function handleClick() {
    const items = loadSaved();
    if (saved) {
      const next = items.filter((item) => item.mgt_no !== mgtNo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(false);
    } else {
      const next: SavedFacility[] = [
        ...items,
        {
          mgt_no: mgtNo,
          name,
          biz_type: bizType ?? null,
          region_sido: regionSido ?? null,
          saved_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
    }
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{
          background: "var(--paper)",
          color: "var(--ink-2)",
          border: "1px solid var(--rule)",
        }}
        aria-label={`${name} 관심업체로 저장`}
        disabled
      >
        ♡ 관심 저장
      </button>
    );
  }

  return saved ? (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
      style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
      aria-label={`${name} 저장 취소`}
    >
      ♥ 저장됨
    </button>
  ) : (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
        border: "1px solid var(--rule)",
      }}
      aria-label={`${name} 관심업체로 저장`}
    >
      ♡ 관심 저장
    </button>
  );
}
