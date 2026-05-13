"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("app_error_boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Something broke</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Unexpected error</h1>
        <p className="mt-3 text-sm text-slate-600">
          The team has been notified. You can retry this view.
        </p>
        <button
          onClick={reset}
          className="mt-5 h-11 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
