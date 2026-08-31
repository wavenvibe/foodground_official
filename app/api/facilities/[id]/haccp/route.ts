import { type NextRequest, NextResponse } from "next/server";
import { getSourceFacilityEvidence } from "@/lib/source-db";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const outcome = await getSourceFacilityEvidence(id);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error, traceId: outcome.traceId }, { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 });
  if (!outcome.data) return NextResponse.json({ error: { code: "FG_NOT_FOUND", message: "시설을 찾을 수 없습니다." }, traceId: outcome.traceId }, { status: 404 });
  return NextResponse.json({ data: outcome.data.haccp, traceId: outcome.traceId });
}
