import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { revokeGoogleToken } from "@/lib/google/calendar";
import { jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const { connectionId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: connection, error } = await supabase
      .from("calendar_connections")
      .select()
      .eq("id", connectionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!connection || connection.user_id !== user.id) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Revoke at Google so the grant is dropped, then remove the connection.
    // Deleting the row cascades to the meetings synced from this account.
    await revokeGoogleToken(connection.refresh_token ?? connection.access_token);

    const { error: deleteError } = await supabase.from("calendar_connections").delete().eq("id", connectionId);
    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.redirect(new URL(`/settings?disconnected=1`, env.APP_BASE_URL), { status: 303 });
  } catch (error) {
    return jsonError(error);
  }
}
