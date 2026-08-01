import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const ts = Date.now();
  try {
    const { error } = await Promise.race([
      supabase.from("facility").select("mgt_no").limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB ping timed out after 500ms")), 500)
      ),
    ]);
    if (error) throw error;
    return NextResponse.json({ ok: true, ts, db: "up" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, ts, db: "down", err: errMsg }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
