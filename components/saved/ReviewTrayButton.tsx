"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSavedCount, SAVED_ITEMS_EVENT } from "@/lib/saved-items";

export default function ReviewTrayButton() {
  const [count, setCount] = useState(0);
  const [pastHero, setPastHero] = useState(false);
  const pathname = usePathname();

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

  useEffect(() => {
    if (pathname !== "/") return;
    const refresh = () => setPastHero(window.scrollY > 320);
    const frame = window.requestAnimationFrame(refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", refresh);
    };
  }, [pathname]);

  const visible = pathname !== "/" || pastHero;

  return (
    <Link className={`review-tray-fab${visible ? " review-tray-fab--visible" : ""}`} href="/saved" aria-label={`제품화 검토함 ${count}개`}>
      <span aria-hidden="true">▣</span>
      <strong>검토함</strong>
      <em>{count}</em>
    </Link>
  );
}
