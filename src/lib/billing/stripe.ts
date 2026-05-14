import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cachedStripe: Stripe | null = null;

export function getStripeClient() {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return cachedStripe;
}
