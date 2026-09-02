// @MX:ANCHOR: [AUTO] Shared site header — rendered on every public page
// @MX:REASON: Fan-in >= 3: home, product, recipe, substitute, manufacturing, and facility routes

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSavedCount, SAVED_ITEMS_EVENT } from "@/lib/saved-items";

const NAV_LINKS = [
  { href: "/products", label: "제품" },
  { href: "/recipes", label: "레시피" },
  { href: "/substitutes", label: "대체 식재료" },
  { href: "/manufacturing-brief", label: "공동제조" },
  { href: "/facilities", label: "제조시설" },
] as const;

export default function Header({ variant = "default" }: { variant?: "default" | "home" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const refresh = () => setSavedCount(getSavedCount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(SAVED_ITEMS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SAVED_ITEMS_EVENT, refresh);
    };
  }, []);

  if (variant === "home") {
    return (
      <header className="home-v3-header">
        <nav className="home-v3-header__nav home-v3-header__nav--left" aria-label="홈 주요 메뉴 왼쪽">
          {NAV_LINKS.slice(0, 3).map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
        </nav>

        <Link href="/" className="home-v3-brand" aria-label="FoodGround 홈">
          <span aria-hidden="true" />FoodGround
        </Link>

        <div className="home-v3-header__right">
          <nav className="home-v3-header__nav" aria-label="홈 주요 메뉴 오른쪽">
            {NAV_LINKS.slice(3).map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <Link className="home-v3-header__review" href="/saved">검토함 <span>{savedCount}</span></Link>
          <button
            type="button"
            className="home-v3-header__menu"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls="home-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "×" : "☰"}
          </button>
        </div>

        {menuOpen ? (
          <nav id="home-mobile-nav" className="home-v3-header__mobile" aria-label="모바일 주요 메뉴">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </nav>
        ) : null}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: "var(--slate)" }}>
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-8 px-5 sm:px-10">
        <Link href="/" className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity">
          Food<span style={{ color: "var(--green-500)" }}>Ground</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7" aria-label="주요 메뉴">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm font-medium text-white/75 transition-colors hover:text-white">{label}</Link>
          ))}
          <Link href="/saved" className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
            검토함
          </Link>
        </nav>
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-8 h-8 text-white"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "×" : "☰"}
        </button>
      </div>
      {menuOpen ? (
        <nav id="mobile-nav" className="md:hidden border-t" style={{ borderColor: "rgba(255,255,255,0.1)", background: "var(--slate)" }} aria-label="모바일 주요 메뉴">
          {[...NAV_LINKS, { href: "/saved", label: "검토함" }].map(({ href, label }) => (
            <Link key={href} href={href} className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>{label}</Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
