// Mirrors server/models/modelCardContent.ts — kept independent since evaluation/ is a standalone package.
export interface ModelCardContent {
  modelDetails: {
    provider?: string;
    version?: string;
    type?: string;
    architecture?: string;
    description?: string;
    license?: string;
  };
  intendedUse: {
    primaryIntendedUsers?: string;
    primaryIntendedDomain?: string;
    primaryIntendedUseCases?: string;
    secondaryIntendedUsers?: string;
    secondaryIntendedDomain?: string;
    secondaryIntendedUseCases?: string;
  };
  factors: {
    hardware?: string;
    software?: string;
  };
  evaluation: {
    metrics?: string;
    factors?: string;
    datasets?: string;
    performance?: string;
  };
  trainingData: {
    algorithm?: string;
    dataset?: string;
    procedure?: string;
  };
  ethicalConsiderations: {
    typeOfBias?: string;
    biasMitigation?: string;
    privacyConcerns?: string;
    privacyPolicy?: string;
    safetyMeasures?: string;
    securityMeasures?: string;
    safetyAndSecurityPolicy?: string;
    riskFactors?: string;
    riskSeverity?: string;
    riskMitigation?: string;
    unintendedUsers?: string;
    prohibitedDomains?: string;
    misuseCases?: string;
    regulatoryAdherence?: string;
    regulatoryCompliance?: string;
    limitations?: string;
  };
  caveatsAndRecommendations?: string;
  richFields?: { field: string; type: "image" | "json"; content: string }[];
}

// Minimal shape of the ODRL JSON-LD policy produced by any converter (LLM or rule-based).
export interface OdrlPolicy {
  "@context": unknown;
  "@type": "odrl:Policy";
  uid: string;
  profile: string;
  target: Record<string, unknown>;
  party: Record<string, unknown>[];
  permission?: Record<string, unknown>[];
  prohibition?: Record<string, unknown>[];
  duty?: Record<string, unknown>[];
  [key: string]: unknown;
}

// One row of the evaluation corpus: a real model card plus (optionally) a hand-authored reference policy.
export interface CorpusItem {
  id: string;
  repository: string;
  modelCardContent: ModelCardContent;
  referenceOdrl?: OdrlPolicy;
}

// Name of a converter: an entry of models.json (a language model) or "rule-based".
export type ConverterName = string;

// What is recorded with every language-model run (protocol reporting for the paper).
export interface RunMeta {
  model: string;
  temperature: number;
  promptSha256: string;
  promptVariant?: string;
  date: string;
  durationMs: number;
}

export interface ConversionResult {
  converter: ConverterName;
  corpusItemId: string;
  runIndex: number;
  raw: string;
  parsed: OdrlPolicy | null;
  parseError?: string;
  meta?: RunMeta;
}
