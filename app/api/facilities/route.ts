import { type NextRequest, NextResponse } from "next/server";
import { searchPublicFacilities } from "@/lib/facilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outcome = await searchPublicFacilities({
    q: sp.get("q") ?? undefined,
    sido: sp.get("sido") ?? undefined,
    businessType: sp.get("businessType") ?? undefined,
    haccp: sp.get("haccp") === "1" ? true : undefined,
    status: sp.get("status") ?? undefined,
    page: sp.has("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.has("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, traceId: outcome.traceId },
      { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 },
    );
  }

  return NextResponse.json({
    data: outcome.data,
    meta: outcome.meta,
    traceId: outcome.traceId,
  });
}
