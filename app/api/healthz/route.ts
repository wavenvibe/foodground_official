import { NextResponse } from "next/server";
import { createPublicServerClient } from "@/lib/supabase-public-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_PING_TIMEOUT_MS = 2_000;

export async function GET(): Promise<NextResponse> {
  const ts = Date.now();
  try {
    const supabase = createPublicServerClient();
    const { error } = await Promise.race([
      supabase.from("facilities").select("mgt_no").limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`DB ping timed out after ${DB_PING_TIMEOUT_MS}ms`)),
          DB_PING_TIMEOUT_MS,
        )
      ),
    ]);
    if (error) throw error;
    return NextResponse.json({ ok: true, ts, db: "up" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, ts, db: "down", err: errMsg }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
