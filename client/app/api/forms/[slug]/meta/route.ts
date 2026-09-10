import { NextRequest, NextResponse } from "next/server";
import { getFormMeta, setFormMeta } from "@/app/lib/serverFormStore";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const meta = getFormMeta(slug);
  if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(meta);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json();
  setFormMeta(slug, { slug, ...body });
  return NextResponse.json({ ok: true });
}
