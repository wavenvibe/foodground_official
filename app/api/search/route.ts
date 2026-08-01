// Autocomplete endpoint consumed by the search bar component
// @MX:NOTE: [AUTO] Must use nodejs runtime — better-sqlite3 is a native module incompatible with edge runtime

import { NextRequest, NextResponse } from "next/server";
import { autocomplete } from "@/lib/facility";
import type { FacilityCard } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest
): Promise<NextResponse<{ results: FacilityCard[] }>> {
  const q = request.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json(
      { results: [] },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60" },
      }
    );
  }

  const results = await autocomplete(q);

  return NextResponse.json(
    { results },
    {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=60" },
    }
  );
}
