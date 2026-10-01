// ─── Org name normalization ─────────────────────────────────────────────
// Applied on save to bx_organizations.name and bx_organizations.canonical_name.
// Rules:
//  - Title Case: first letter of every word capitalized
//  - Short articles/prepositions mid-name stay lowercase
//  - First word always capitalized
//  - Words ≤3 chars that are ALL-CAPS stay uppercase (BBS, AI, LLC, USA…)
//  - canonical_name = lowercased, trimmed (for fuzzy matching)

const LOWERCASE_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor",
  "at", "by", "in", "of", "on", "to", "up", "as",
]);

/**
 * Normalize an org name to Title Case with the agreed-upon rules.
 * e.g. "sleep model solutions" → "Sleep Model Solutions"
 *      "church of the highlands" → "Church of the Highlands"
 *      "bbs school" → "BBS School"
 */
export function normalizeOrgName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const words = trimmed.split(" ");
  return words
    .map((word, i) => {
      // Preserve existing ALL-CAPS abbreviations (≤3 chars)
      if (word.length <= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
        return word;
      }
      // Lowercase articles/prepositions mid-name
      const lower = word.toLowerCase();
      if (i > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      // Default: capitalize first letter
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * canonical_name: lowercased, trimmed — used for trigram similarity matching.
 */
export function canonicalOrgName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
