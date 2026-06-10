import { NextRequest, NextResponse } from "next/server";

import { backfillMissingEmbeddings } from "@/lib/beaker/embeddings";
import { assertCronAuthorized, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const embedded = await backfillMissingEmbeddings();
    return NextResponse.json({ embedded });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonError(error);
  }
}
