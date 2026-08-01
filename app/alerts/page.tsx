"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useUser } from "@/lib/useUser";

export default function AlertsPage() {
  const { user, loading } = useUser();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <h1
            className="text-2xl font-bold mb-6"
            style={{ color: "var(--green-900)" }}
          >
            알림
          </h1>

          <aside
            className="rounded-lg p-4 mb-8 text-sm"
            style={{
              background: "var(--green-50)",
              border: "1px solid var(--rule)",
              color: "var(--ink-2)",
            }}
          >
            알림은 배치 시점에만 생성되며, 실시간 푸시는 하지 않습니다.
          </aside>

          {loading ? null : !user ? (
            <div
              className="rounded-lg p-12 text-center"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              <p className="text-base font-medium mb-4" style={{ color: "var(--ink)" }}>
                로그인 후 관심업체 알림을 받아보세요.
              </p>
              <Link
                href="/signin"
                className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
              >
                로그인하기
              </Link>
            </div>
          ) : (
            <div
              className="rounded-lg p-12 text-center"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              <p className="text-base font-medium" style={{ color: "var(--ink)" }}>
                새로운 알림이 없습니다.
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
                관심업체에 변동이 생기면 여기에 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
