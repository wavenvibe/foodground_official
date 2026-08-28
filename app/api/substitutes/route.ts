import { type NextRequest, NextResponse } from "next/server";
import { searchSubstitutes } from "@/lib/substitutes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ingredient = req.nextUrl.searchParams.get("ingredient") ?? undefined;
  const outcome = await searchSubstitutes(ingredient);

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, traceId: outcome.traceId },
      { status: outcome.error.code === "FG_BAD_REQUEST" ? 400 : 503 },
    );
  }

  return NextResponse.json({ data: outcome.data, traceId: outcome.traceId });
}
