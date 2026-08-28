"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "fg_saved_products";

interface SavedProduct {
  report_no: string;
  product_name: string;
  category: string | null;
  facility_mgt_no: string;
  facility_name: string;
  saved_at: string;
}

interface ProductSaveButtonProps {
  reportNo: string;
  productName: string;
  category: string | null | undefined;
  facilityMgtNo: string;
  facilityName: string;
}

function loadSaved(): SavedProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ProductSaveButton({
  reportNo,
  productName,
  category,
  facilityMgtNo,
  facilityName,
}: ProductSaveButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const items = loadSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(items.some((item) => item.report_no === reportNo));
    setMounted(true);
  }, [reportNo]);

  function handleClick() {
    const items = loadSaved();
    if (saved) {
      const next = items.filter((item) => item.report_no !== reportNo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(false);
    } else {
      const next: SavedProduct[] = [
        ...items,
        {
          report_no: reportNo,
          product_name: productName,
          category: category ?? null,
          facility_mgt_no: facilityMgtNo,
          facility_name: facilityName,
          saved_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
    }
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
      style={
        saved
          ? { color: "var(--green-700)", background: "transparent" }
          : { color: "var(--ink-2)", background: "transparent" }
      }
      aria-label={
        saved
          ? `${productName} 저장 취소`
          : `${productName} 관심제품으로 저장`
      }
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
