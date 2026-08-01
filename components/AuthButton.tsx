"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) return <div className="w-16 h-8" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-sm text-white/70 max-w-[140px] truncate">
          {user.email}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/signin"
      className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
    >
      로그인
    </Link>
  );
}
