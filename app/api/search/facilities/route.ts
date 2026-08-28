import { NextRequest, NextResponse } from "next/server";
import { searchPublicFacilities } from "@/lib/facilities";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const outcome = await searchPublicFacilities({
    q: params.get("q") ?? undefined,
    sido: params.get("sido") ?? undefined,
    businessType: params.get("businessType") ?? undefined,
    haccp: params.get("haccp") === "1",
    page: Number.parseInt(params.get("page") ?? "1", 10) || 1,
    pageSize: Number.parseInt(params.get("pageSize") ?? "20", 10) || 20,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, traceId: outcome.traceId },
      { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 },
    );
  }

  return NextResponse.json({ data: outcome.data, meta: outcome.meta, traceId: outcome.traceId });
}
