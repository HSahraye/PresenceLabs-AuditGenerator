import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/events";

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false, error: "Missing stripe signature." }, { status: 400 });

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logger.warn("stripe_webhook_signature_invalid", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, error: "Invalid stripe signature." }, { status: 400 });
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
  });
  if (existing) return NextResponse.json({ ok: true, deduped: true });

  await prisma.webhookEvent.create({
    data: {
      provider: "stripe",
      eventId: event.id,
      payloadJson: rawBody,
    },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const leadId = typeof session.metadata?.leadId === "string" ? session.metadata.leadId : "";
    if (leadId) {
      await prisma.paymentLog.create({
        data: {
          leadId,
          eventType: "paid",
          provider: "stripe",
          externalId: session.id,
          ip: null,
          userAgent: null,
        },
      });
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          paymentStatus: "paid",
          lastPaymentAt: new Date(),
        },
      });
      await trackEvent("payment_paid", { leadId, checkoutSessionId: session.id }, leadId);
    }
  }

  return NextResponse.json({ ok: true });
}
