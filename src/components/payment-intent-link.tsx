"use client";

import type { ReactNode } from "react";

export function PaymentIntentLink({ leadId, href, className, children }: { leadId: string; href: string; className: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        void fetch("/api/payment-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId }),
          keepalive: true,
        });
      }}
    >
      {children}
    </a>
  );
}
