"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSavedCount, SAVED_ITEMS_EVENT } from "@/lib/saved-items";

export default function ReviewTrayButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(getSavedCount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(SAVED_ITEMS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SAVED_ITEMS_EVENT, refresh);
    };
  }, []);

  return (
    <Link className="review-tray-fab" href="/saved" aria-label={`제품화 검토함 ${count}개`}>
      <span aria-hidden="true">▣</span>
      <strong>검토함</strong>
      <em>{count}</em>
    </Link>
  );
}
