import { type NextRequest, NextResponse } from "next/server";
import { matchManufacturingCandidates } from "@/lib/manufacturing-match";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const outcome = await matchManufacturingCandidates({
    item: params.get("item") ?? "",
    region: params.get("region") ?? undefined,
    requiredCcp: params.getAll("ccp"),
    cookingRequired: params.get("cooking") === "1",
    sterilizeRequired: params.get("sterilize") === "1",
    limit: params.has("limit") ? Number(params.get("limit")) : undefined,
  });
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, traceId: outcome.traceId },
      { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 },
    );
  }
  return NextResponse.json({ data: outcome.data, traceId: outcome.traceId });
}
