export function normalizePhoneForHref(phone: string) {
  return (phone || "").replace(/\D/g, "");
}

export function buildSmsHref(phone: string, body: string) {
  const normalizedPhone = normalizePhoneForHref(phone);
  if (!normalizedPhone) return "";
  return `sms:${normalizedPhone}?body=${encodeURIComponent(body || "")}`;
}

export function buildWhatsAppHref(phone: string, text: string) {
  const normalizedPhone = normalizePhoneForHref(phone);
  if (!normalizedPhone) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text || "")}`;
}

export function buildWhatsappHref(phone: string, body: string) {
  return buildWhatsAppHref(phone, body);
}

export function buildMailtoHref(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
}
