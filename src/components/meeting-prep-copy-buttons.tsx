"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function MeetingPrepCopyButtons({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition ${
        copied ? "bg-lime-100 text-lime-700" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}
