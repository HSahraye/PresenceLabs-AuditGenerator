import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getStripeClient } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/url";

export async function POST() {
  const session = await getCurrentSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "Stripe is not configured." }, { status: 503 });
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { stripeCustomerId: true },
  });
  if (!workspace?.stripeCustomerId) {
    return NextResponse.json({ ok: false, error: "No Stripe customer exists for this workspace." }, { status: 400 });
  }
  const appOrigin = getPublicBaseUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${appOrigin}/settings/billing`,
  });
  return NextResponse.json({ ok: true, url: portal.url });
}
