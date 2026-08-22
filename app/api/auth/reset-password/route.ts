import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.MEDITRUST_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    email?: unknown;
    otp?: unknown;
    password?: unknown;
    password_confirmation?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmation = typeof body?.password_confirmation === "string" ? body.password_confirmation : "";

  if (!email || !email.includes("@") || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ success: false, message: "Enter a valid email and six-digit reset code." }, { status: 422 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, message: "Your new password must contain at least 8 characters." }, { status: 422 });
  }
  if (password !== confirmation) {
    return NextResponse.json({ success: false, message: "The new passwords do not match." }, { status: 422 });
  }

  try {
    const backend = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, password, password_confirmation: confirmation }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await backend.json().catch(() => null);
    return NextResponse.json(
      payload || { success: false, message: "The password reset service returned an invalid response." },
      { status: backend.status || 502 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "The password reset service is unavailable. Please try again." },
      { status: 502 },
    );
  }
}
