type PrepLinkInput = {
  id: string;
  shortSlug?: string | null;
};

export function buildPrepPath(input: PrepLinkInput) {
  const prepKey = input.shortSlug || input.id;
  return `/prep/${encodeURIComponent(prepKey)}`;
}
