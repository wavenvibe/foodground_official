// @MX:ANCHOR: [AUTO] Shared site header — rendered on every page
// @MX:REASON: Fan-in >= 3: app/page.tsx, app/search/page.tsx, app/b/[id]/page.tsx, and more

"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/recipes", label: "레시피" },
  { href: "/ingredients", label: "식재료" },
  { href: "/substitutes", label: "대체 식재료" },
  { href: "/facilities", label: "제조시설" },
] as const;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ background: "var(--slate)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity"
        >
          Food<span style={{ color: "var(--green-500)" }}>Ground</span>
        </Link>

        {/* Desktop navigation */}
        <nav
          className="hidden md:flex items-center gap-6"
          aria-label="주요 메뉴"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger button */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-8 h-8 text-white"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown navigation */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            background: "var(--slate)",
          }}
          aria-label="모바일 주요 메뉴"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
