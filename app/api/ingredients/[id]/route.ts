import { type NextRequest, NextResponse } from "next/server";
import { getPublicIngredient } from "@/lib/ingredients";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const outcome = await getPublicIngredient(id);

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, traceId: outcome.traceId },
      { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 },
    );
  }

  if (!outcome.data) {
    return NextResponse.json(
      { error: { code: "FG_NOT_FOUND", message: "식재료를 찾을 수 없습니다." }, traceId: outcome.traceId },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: outcome.data, traceId: outcome.traceId });
}
