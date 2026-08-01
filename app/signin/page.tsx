"use client";

import { useState, Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import supabase from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Step = "email" | "otp" | "done";

function SignInForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithOtp({ email });

    setLoading(false);
    if (authErr) {
      setError(authErr.message);
    } else {
      setStep("otp");
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "email",
    });

    setLoading(false);
    if (verifyErr) {
      setError("코드가 올바르지 않거나 만료되었습니다. 다시 확인해 주세요.");
    } else {
      setStep("done");
      setTimeout(() => router.push("/"), 800);
    }
  }

  return (
    <div
      className="w-full max-w-md rounded-xl p-8"
      style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
    >
      <h1
        className="text-2xl font-bold mb-2 text-center"
        style={{ color: "var(--green-900)" }}
      >
        푸드그라운드 로그인
      </h1>

      {step === "email" && (
        <>
          <p className="text-sm text-center mb-8" style={{ color: "var(--ink-2)" }}>
            이메일로 6자리 인증 코드를 보내드립니다.
          </p>
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signin-email" className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                이메일 주소
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@company.com"
                autoComplete="email"
                className="rounded-lg px-4 py-3 text-base outline-none focus:ring-2"
                style={{ border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--ink)" }}
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--warn)" }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg py-3 text-base font-semibold transition-opacity hover:opacity-90 mt-2 disabled:opacity-60"
              style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
            >
              {loading ? "전송 중..." : "인증 코드 받기"}
            </button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="text-sm text-center mb-2" style={{ color: "var(--ink-2)" }}>
            <strong style={{ color: "var(--ink)" }}>{email}</strong>으로<br />
            6자리 코드를 보내드렸습니다.
          </p>
          <p className="text-xs text-center mb-8" style={{ color: "var(--ink-2)" }}>
            받은편지함(스팸함도 확인)을 확인해 주세요.
          </p>
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signin-otp" className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                인증 코드 (6자리)
              </label>
              <input
                id="signin-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                placeholder="123456"
                autoComplete="one-time-code"
                className="rounded-lg px-4 py-3 text-xl text-center tracking-widest font-mono outline-none focus:ring-2"
                style={{ border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--ink)" }}
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--warn)" }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="rounded-lg py-3 text-base font-semibold transition-opacity hover:opacity-90 mt-2 disabled:opacity-60"
              style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
            >
              {loading ? "확인 중..." : "로그인"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(null); }}
              className="text-sm text-center underline"
              style={{ color: "var(--ink-2)" }}
            >
              이메일 다시 입력
            </button>
          </form>
        </>
      )}

      {step === "done" && (
        <p className="text-center text-base py-6 font-medium" style={{ color: "var(--green-700)" }}>
          로그인되었습니다. 이동 중...
        </p>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Suspense>
          <SignInForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
