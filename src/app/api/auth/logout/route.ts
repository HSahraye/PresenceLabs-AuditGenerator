import { NextResponse } from "next/server";
import { signOutEverywhere } from "@/lib/auth";

export async function POST() {
  await signOutEverywhere();
  return NextResponse.json({ ok: true });
}
