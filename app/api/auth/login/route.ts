import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.MEDITRUST_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string; remember?: boolean } | null;
  if (!body?.identifier || !body.password) {
    return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 422 });
  }

  try {
    const backend = await fetch(`${API_BASE_URL}/v1/auth/staff/login`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: body.identifier, password: body.password }),
      cache: "no-store",
    });
    const payload = await backend.json().catch(() => null) as { success?: boolean; message?: string; data?: { user?: unknown; token?: string } } | null;
    if (!backend.ok || !payload?.success || !payload.data?.token || !payload.data.user) {
      return NextResponse.json(payload || { success: false, message: "Unable to sign in." }, { status: backend.status || 502 });
    }

    const response = NextResponse.json({ success: true, message: payload.message, data: { user: payload.data.user } });
    response.cookies.set("meditrust_token", payload.data.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(body.remember ? { maxAge: 60 * 60 * 24 * 14 } : {}),
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "The MediTrust API is unavailable. Confirm the backend is running on port 8000." }, { status: 502 });
  }
}
