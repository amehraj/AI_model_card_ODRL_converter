import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import jsonld from "jsonld";
import { Parser, Store } from "n3";
// @ts-expect-error -- rdf-validate-shacl ships without type declarations
import SHACLValidator from "rdf-validate-shacl";
import type { OdrlPolicy } from "../types.ts";

const SHAPES_PATH = fileURLToPath(new URL("./shacl/modelcard-profile.shapes.ttl", import.meta.url));

export interface ShaclValidationResult {
  conforms: boolean;
  violations: { message: string; path?: string; focusNode?: string }[];
}

const loadShapesStore = async (): Promise<Store> => {
  const turtle = await readFile(SHAPES_PATH, "utf-8");
  const quads = new Parser().parse(turtle);
  return new Store(quads);
};

// Expands the JSON-LD policy to RDF quads, loads them into an N3 store, and validates
// against the revised profile's SHACL shapes. This is the "machine-checked" conformance
// step required by W5 — every generated and reference policy must pass through here.
//
// SHACL only sees the RDF graph produced by JSON-LD expansion, not the raw JSON. A policy
// missing "@context" (or with a broken one) still "expands" to an almost-empty graph, which
// then vacuously satisfies every SHACL shape — a false pass. Both cases below are guarded
// against explicitly before handing anything to the SHACL validator.
export const validatePolicyAgainstProfile = async (
  policy: OdrlPolicy
): Promise<ShaclValidationResult> => {
  if (!("@context" in policy)) {
    return {
      conforms: false,
      violations: [{ message: "Policy is missing \"@context\"; cannot be interpreted as ODRL JSON-LD." }],
    };
  }

  const nquads = (await jsonld.toRDF(policy as object, { format: "application/n-quads" })) as unknown as string;
  const dataQuads = new Parser({ format: "application/n-quads" }).parse(nquads);

  if (dataQuads.length === 0) {
    return {
      conforms: false,
      violations: [{ message: "JSON-LD expansion produced zero RDF triples — the @context is likely broken or empty." }],
    };
  }

  const dataStore = new Store(dataQuads);
  const shapesStore = await loadShapesStore();

  const validator = new SHACLValidator(shapesStore, { factory: dataStore.factory ?? undefined });
  const report = validator.validate(dataStore);

  const violations = report.results.map((result: any) => ({
    message: result.message?.[0]?.value ?? "Unspecified SHACL violation",
    path: result.path?.value,
    focusNode: result.focusNode?.value,
  }));

  return { conforms: report.conforms, violations };
};
