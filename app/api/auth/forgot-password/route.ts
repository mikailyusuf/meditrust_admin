import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.MEDITRUST_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 422 });
  }

  try {
    const backend = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await backend.json().catch(() => null);
    return NextResponse.json(
      payload || { success: false, message: "The password recovery service returned an invalid response." },
      { status: backend.status || 502 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "The password recovery service is unavailable. Please try again." },
      { status: 502 },
    );
  }
}
