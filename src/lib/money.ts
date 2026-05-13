export const packageValues = {
  "Presence Labs Launch Package": 1500,
  "Presence Labs Conversion Upgrade": 3000,
  "Presence Labs Local Trust Tune-Up": 800,
} as const;

export function estimatedDealValue(packageName?: string | null, customPrice?: number | null) {
  if (typeof customPrice === "number" && customPrice > 0) return customPrice;
  if (!packageName) return 0;
  const normalized = packageName.toLowerCase();
  if (normalized.includes("conversion")) return packageValues["Presence Labs Conversion Upgrade"];
  if (normalized.includes("launch")) return packageValues["Presence Labs Launch Package"];
  if (normalized.includes("trust") || normalized.includes("tune")) return packageValues["Presence Labs Local Trust Tune-Up"];
  return 1500;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function weightedDealValue(status: string, value: number) {
  if (status === "Won") return value;
  if (status === "Follow-up") return value * 0.7;
  if (status === "Contacted") return value * 0.4;
  if (status === "New") return value * 0.2;
  return 0;
}
