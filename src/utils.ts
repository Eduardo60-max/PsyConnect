const TITLE_PREFIX = /^(dra?|prof[a]?|sr[a]?)\.?\s+/i;

export function avatarInitial(name: string) {
  const cleaned = name.trim().replace(TITLE_PREFIX, "");
  return cleaned.charAt(0).toUpperCase() || "?";
}