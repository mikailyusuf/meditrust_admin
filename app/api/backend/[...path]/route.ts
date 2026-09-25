import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.MEDITRUST_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get("meditrust_token")?.value;
  if (!token) return NextResponse.json({ success: false, message: "Your session has expired. Please sign in again." }, { status: 401 });

  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const target = `${API_BASE_URL}/${path.map(encodeURIComponent).join("/")}${sourceUrl.search}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  try {
    const backend = await fetch(target, {
      method: request.method,
      headers: {
        Accept: path.at(-1) === "print" ? "text/html" : "application/json",
        Authorization: `Bearer ${token}`,
        ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {}),
      },
      body,
      cache: "no-store",
    });
    const responseBody = await backend.text();
    return new Response(responseBody, {
      status: backend.status,
      headers: { "Content-Type": backend.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "The MediTrust API is unavailable." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
