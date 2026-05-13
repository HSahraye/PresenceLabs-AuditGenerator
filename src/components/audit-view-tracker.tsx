"use client";

import { useEffect } from "react";

export function AuditViewTracker({ leadId }: { leadId: string }) {
  useEffect(() => {
    const key = `presence-audit-view:${leadId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void fetch("/api/audit-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
  }, [leadId]);

  return null;
}
