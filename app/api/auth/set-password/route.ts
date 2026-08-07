import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Completes a password reset entirely server-side. The browser can only read
// the recovery access token from the URL hash fragment (never sent to the
// server automatically), so it posts that token here; all Supabase auth work —
// validating the token and changing the password — happens on the server.
export async function POST(request: NextRequest) {
  let body: { accessToken?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!accessToken) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Validate the recovery token and resolve which user it belongs to.
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, {
    password,
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
