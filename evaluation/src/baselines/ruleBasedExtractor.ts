import type { ConversionResult, ModelCardContent, OdrlPolicy } from "../types.ts";

const PROFILE_IRI = "http://example.org/odrl/profile/modelcard";
const BASE_IRI = "http://example.org/modelcard";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Splits a semicolon/comma-separated free-text field into discrete clauses.
// Deterministic and intentionally simple — this is the "does serial LLM prompting
// beat a naive schema-guided extractor" baseline, not a competing NLP pipeline.
const splitClauses = (text?: string): string[] => {
  if (!text) return [];
  return text
    .split(/;|(?<!\d)\.(?!\d)/)
    .map((clause) => clause.trim())
    .filter(Boolean);
};

const buildConstraintGroup = (leftOperand: string, clauses: string[]) => {
  const entries = clauses.map((rightOperand) => ({
    leftOperand,
    operator: "odrl:eq",
    rightOperand,
  }));
  if (entries.length <= 1) return entries[0] ?? null;
  return { "odrl:and": entries };
};

// Section-heading matching into an ODRL skeleton, following the same field mapping as the
// revised LLM prompt (server/prompts/modelCardToOdrl.prompt.ts), without any model inference.
export const convertWithRuleBasedExtractor = (
  modelCardContent: ModelCardContent,
  corpusItemId: string
): ConversionResult => {
  const { modelDetails, intendedUse, factors, evaluation, trainingData, ethicalConsiderations, caveatsAndRecommendations } =
    modelCardContent;

  const providerSlug = slugify(modelDetails.provider ?? "unknown-provider");
  const modelSlug = slugify(`${modelDetails.provider ?? "model"}-${modelDetails.version ?? corpusItemId}`);

  const descriptiveProperties: Record<string, string> = {};
  const addDescriptive = (key: string, value?: string) => {
    if (value) descriptiveProperties[`ex:${key}`] = value.trim();
  };
  addDescriptive("hardware", factors.hardware);
  addDescriptive("software", factors.software);
  addDescriptive("evaluationMetrics", evaluation.metrics);
  addDescriptive("evaluationPerformance", evaluation.performance);
  addDescriptive("evaluationDatasets", evaluation.datasets);
  addDescriptive("evaluationFactors", evaluation.factors);
  addDescriptive("trainingAlgorithm", trainingData.algorithm);
  addDescriptive("trainingDataset", trainingData.dataset);
  addDescriptive("trainingProcedure", trainingData.procedure);
  addDescriptive("limitations", ethicalConsiderations.limitations);
  addDescriptive("typeOfBias", ethicalConsiderations.typeOfBias);
  addDescriptive("privacyConcerns", ethicalConsiderations.privacyConcerns);
  addDescriptive("riskFactors", ethicalConsiderations.riskFactors);
  addDescriptive("riskSeverity", ethicalConsiderations.riskSeverity);

  const permissionConstraints = [
    buildConstraintGroup("ex:primaryIntendedDomain", splitClauses(intendedUse.primaryIntendedDomain)),
    buildConstraintGroup("ex:primaryIntendedUseCases", splitClauses(intendedUse.primaryIntendedUseCases)),
    buildConstraintGroup("ex:primaryIntendedUsers", splitClauses(intendedUse.primaryIntendedUsers)),
    buildConstraintGroup("ex:secondaryIntendedDomain", splitClauses(intendedUse.secondaryIntendedDomain)),
    buildConstraintGroup("ex:secondaryIntendedUseCases", splitClauses(intendedUse.secondaryIntendedUseCases)),
    buildConstraintGroup("ex:secondaryIntendedUsers", splitClauses(intendedUse.secondaryIntendedUsers)),
  ].filter(Boolean);

  const prohibitionConstraints = [
    buildConstraintGroup("ex:prohibitedDomains", splitClauses(ethicalConsiderations.prohibitedDomains)),
    buildConstraintGroup("ex:misuseCases", splitClauses(ethicalConsiderations.misuseCases)),
    buildConstraintGroup("ex:unintendedUsers", splitClauses(ethicalConsiderations.unintendedUsers)),
  ].filter(Boolean);

  const dutyFields: [string, string | undefined][] = [
    ["ex:biasMitigation", ethicalConsiderations.biasMitigation],
    ["ex:riskMitigation", ethicalConsiderations.riskMitigation],
    ["ex:safetyMeasures", ethicalConsiderations.safetyMeasures],
    ["ex:securityMeasures", ethicalConsiderations.securityMeasures],
    ["ex:safetyAndSecurityPolicy", ethicalConsiderations.safetyAndSecurityPolicy],
    ["ex:privacyPolicy", ethicalConsiderations.privacyPolicy],
    ["ex:regulatoryAdherence", ethicalConsiderations.regulatoryAdherence],
    ["ex:regulatoryCompliance", ethicalConsiderations.regulatoryCompliance],
    ["ex:caveatsAndRecommendations", caveatsAndRecommendations],
  ];

  const duty = dutyFields
    .map(([leftOperand, value]) => {
      const constraint = buildConstraintGroup(leftOperand, splitClauses(value));
      if (!constraint) return null;
      return { "@type": "odrl:Duty", action: "odrl:inform", constraint: [constraint] };
    })
    .filter(Boolean);

  const policy: OdrlPolicy = {
    "@context": [
      "http://www.w3.org/ns/odrl.jsonld",
      {
        dc: "http://purl.org/dc/elements/1.1/",
        dcterms: "http://purl.org/dc/terms/",
        foaf: "http://xmlns.com/foaf/0.1/",
        xsd: "http://www.w3.org/2001/XMLSchema#",
        ex: "http://example.org/modelcard/terms#",
      },
    ],
    "@type": "odrl:Policy",
    uid: `${BASE_IRI}/policy/${modelSlug}`,
    profile: PROFILE_IRI,
    target: {
      "@type": "odrl:Asset",
      "@id": `${BASE_IRI}/asset/${modelSlug}`,
      "dc:title": modelDetails.description ?? modelDetails.type ?? modelSlug,
      "dc:creator": { "@id": `${BASE_IRI}/party/${providerSlug}` },
      "dcterms:hasVersion": modelDetails.version ?? "",
      "dc:type": modelDetails.type ?? "",
      "dcterms:license": modelDetails.license ?? "",
      ...descriptiveProperties,
    },
    party: [
      {
        "@id": `${BASE_IRI}/party/${providerSlug}`,
        "foaf:name": modelDetails.provider ?? "",
        "odrl:role": "odrl:assigner",
      },
    ],
    permission: permissionConstraints.length
      ? [{ "@type": "odrl:Permission", action: "odrl:use", constraint: permissionConstraints }]
      : [],
    prohibition: prohibitionConstraints.length
      ? [{ "@type": "odrl:Prohibition", action: "odrl:use", constraint: prohibitionConstraints }]
      : [],
    duty: duty as Record<string, unknown>[],
  };

  return {
    converter: "rule-based",
    corpusItemId,
    runIndex: 0,
    raw: JSON.stringify(policy),
    parsed: policy,
  };
};
