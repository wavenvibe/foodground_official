// @MX:ANCHOR: [AUTO] Shared site header — rendered on every page
// @MX:REASON: Fan-in >= 3: app/page.tsx, app/search/page.tsx, app/b/[id]/page.tsx, and more

import Link from "next/link";
import AuthButton from "./AuthButton";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ background: "var(--green-700)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity"
        >
          푸드그라운드
        </Link>

        {/* Navigation */}
        <nav
          className="hidden md:flex items-center gap-6"
          aria-label="주요 메뉴"
        >
          <Link
            href="/search"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            업체검색
          </Link>
          <Link
            href="/products"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            제품 검색
          </Link>
          <Link
            href="/saved"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            관심업체/제품
          </Link>
          <Link
            href="/alerts"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            알림
          </Link>
        </nav>

        {/* CTA */}
        <AuthButton />
      </div>
    </header>
  );
}
