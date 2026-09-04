import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.MEDITRUST_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function PATCH(request: Request) {
  const token = (await cookies()).get("meditrust_token")?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    current_password?: unknown;
    password?: unknown;
    password_confirmation?: unknown;
  } | null;
  const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmation = typeof body?.password_confirmation === "string" ? body.password_confirmation : "";

  if (!currentPassword) {
    return NextResponse.json({ success: false, message: "Enter your current password." }, { status: 422 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, message: "Your new password must contain at least 8 characters." }, { status: 422 });
  }
  if (password !== confirmation) {
    return NextResponse.json({ success: false, message: "The new passwords do not match." }, { status: 422 });
  }
  if (password === currentPassword) {
    return NextResponse.json({ success: false, message: "Your new password must be different from your current password." }, { status: 422 });
  }

  try {
    const backend = await fetch(`${API_BASE_URL}/v1/auth/change-password`, {
      method: "PATCH",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, password, password_confirmation: confirmation }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await backend.json().catch(() => null) as { success?: boolean; message?: string } | null;
    if (!backend.ok || !payload?.success) {
      return NextResponse.json(
        payload || { success: false, message: "Unable to change your password." },
        { status: backend.status || 502 },
      );
    }

    // Password changed — invalidate the temporary session so the user signs in fresh.
    const response = NextResponse.json({ success: true, message: payload.message || "Password changed." });
    response.cookies.set("meditrust_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "The password change service is unavailable. Please try again." },
      { status: 502 },
    );
  }
}
