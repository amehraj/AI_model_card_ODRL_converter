import type { OdrlPolicy } from "../types.ts";

export interface SyntacticValidityResult {
  parses: boolean;
  hasRequiredKeys: boolean;
  missingKeys: string[];
}

const REQUIRED_KEYS = ["@context", "@type", "profile", "target", "party"] as const;

// Metric 1: syntactic validity — does the output parse as JSON and carry the mandatory
// ODRL policy keys. This does NOT check semantic correctness.
export const checkSyntacticValidity = (
  raw: string,
  parsed: OdrlPolicy | null
): SyntacticValidityResult => {
  if (!parsed) {
    return { parses: false, hasRequiredKeys: false, missingKeys: [...REQUIRED_KEYS] };
  }
  const missingKeys = REQUIRED_KEYS.filter((key) => !(key in parsed));
  return { parses: true, hasRequiredKeys: missingKeys.length === 0, missingKeys };
};
