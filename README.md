# Model card to ODRL converter

## 1. What the tool is

The converter turns the structured content of an AI model card into an [ODRL](https://www.w3.org/TR/odrl-model/) policy that follows a profile for model cards. It takes the model card as structured JSON (it does not read PDF files) and works with any language model that is reachable through an OpenAI-compatible chat-completions endpoint, for example a local [Ollama](https://ollama.com) server or a hosted service.

How it works:

1. The system prompt (eleven rules, derived from the ODRL profile) and the JSON of the model card are sent to the language model in one call, with temperature 0 and the JSON output mode.
2. The model answers with a JSON-LD policy. The model details and the descriptive information (factors, evaluation, training data, limitations, bias, privacy concerns, risk factors) become literal properties of the target asset. Intended uses become permissions, prohibited uses become prohibitions, and commitments of the provider (mitigation, safety and security measures and policies, privacy policy, regulatory adherence, caveats and recommendations) become duties with the action `odrl:inform`.
3. The policy is checked against the SHACL shapes of the profile. This check covers the structure only; whether the content of the card was kept is measured with reference policies (Part 3).

The package also contains a converter without a language model (a fixed mapping of the fields) that serves as a reference, and the harness that runs the converters and computes the metrics.

## 2. Set up and run it with your own model

### Requirements

- Node.js 20 or later and npm.
- A language model that is served through an OpenAI-compatible chat-completions endpoint and supports the JSON output mode (`response_format: json_object`).

### Install

```bash
cd evaluation
npm install
```

Check the installation (no language model needed):

```bash
npm run test:shapes     # the valid policy conforms and each of the 18 faulty policies is rejected
npm run test:metrics    # unit test of the metrics
npm run test:corpus     # every reference policy conforms to the shapes
```

### Configure your model

Models are listed in `evaluation/models.json`. Add an entry for your model.

**Local Ollama** (no key needed):

```bash
ollama pull qwen2.5:7b-instruct      # or any other model
```

```json
{ "name": "my-local-model", "baseURL": "http://localhost:11434/v1", "model": "qwen2.5:7b-instruct" }
```

**Hosted or other endpoint.** The URL and the key go into an environment file and are never written into `models.json`. Create `evaluation/.env` (it is ignored by git):

```
LLM_BASE_URL=<base URL of the endpoint, usually ending in /v1>
LLM_API_KEY=<API key>
```

and add the entry:

```json
{ "name": "my-hosted-model", "baseURLEnv": "LLM_BASE_URL", "model": "<model identifier at the endpoint>", "apiKeyEnv": "LLM_API_KEY" }
```

Use other variable names (`baseURLEnv`, `apiKeyEnv`) if you configure several endpoints. Optional entry fields: `temperature` (default 0) and `stream: true` (reads the answer as a stream, for slow models behind a gateway that closes idle requests).

### Prepare your model card

Create `evaluation/src/corpus/<id>.json` with the structured content of your card. Leave a field as an empty string if the card does not contain it; the prompt tells the model to omit empty fields.

```json
{
  "id": "my-model-card",
  "repository": "Hugging Face",
  "source": "https://huggingface.co/<organization>/<model>",
  "modelCardContent": {
    "modelDetails": { "provider": "", "version": "", "type": "", "architecture": "", "description": "", "license": "" },
    "intendedUse": { "primaryIntendedUsers": "", "primaryIntendedDomain": "", "primaryIntendedUseCases": "", "secondaryIntendedUsers": "", "secondaryIntendedDomain": "", "secondaryIntendedUseCases": "" },
    "factors": { "hardware": "", "software": "" },
    "evaluation": { "metrics": "", "factors": "", "datasets": "", "performance": "" },
    "trainingData": { "algorithm": "", "dataset": "", "procedure": "" },
    "ethicalConsiderations": {
      "typeOfBias": "", "biasMitigation": "", "privacyConcerns": "", "privacyPolicy": "",
      "safetyMeasures": "", "securityMeasures": "", "safetyAndSecurityPolicy": "",
      "riskFactors": "", "riskSeverity": "", "riskMitigation": "",
      "unintendedUsers": "", "prohibitedDomains": "", "misuseCases": "",
      "regulatoryAdherence": "", "regulatoryCompliance": "", "limitations": ""
    },
    "caveatsAndRecommendations": ""
  }
}
```

The fields are defined in `evaluation/src/types.ts`; complete examples are the files in `evaluation/src/corpus/`. A reference policy is optional: add it as `referenceOdrl` if you want the extraction metrics (precision, recall, F1) for your card. Without it, validity and conformance with the profile are still computed.

### Run

```bash
cd evaluation
npm run harness -- --models=my-hosted-model --items=my-model-card --runs=1
```

`--models` takes the names from `models.json`, `--items` the ids of the corpus cards, `--runs` the number of runs per card (default 3). Without `--models` and `--items`, every model and every corpus card is run. The rule-based converter always runs once per card. Each run is appended to `evaluation/results/harness-run-<timestamp>.jsonl` as soon as it finishes; the file name is printed at the start. A hosted model can need several minutes per request.

Print the policy of a run and its conformance with the profile:

```bash
node -e "for(const l of require('fs').readFileSync(process.argv[1],'utf8').split('\n').filter(Boolean)){const r=JSON.parse(l);if(r.item===process.argv[2]&&r.converter===process.argv[3]){console.log('conforms:',r.metrics.profileConformance.conforms,r.metrics.profileConformance.violations);console.log(JSON.stringify(r.result.parsed,null,2))}}" results/harness-run-<timestamp>.jsonl my-model-card my-hosted-model
```

Summarize one or more run files (without arguments, every `harness-run-*.jsonl` in `results/` is used):

```bash
npm run aggregate -- results/harness-run-<timestamp>.jsonl
```

This prints one row per converter and writes `results/summary-<timestamp>.json`. The columns are the number of runs, the share of valid JSON, of outputs with all required keys and of outputs that conform to the shapes, the agreement between runs (`stability`, for cards with several runs), extraction precision, recall and F1, rule-type, left-operand and operator accuracy, the standard deviation of the F1 within a card, and the 95% interval over cards of the F1 and of the descriptive recall. The duration of a run is stored in each record (`result.meta.durationMs`).

## 3. The evaluation in this repository

The evaluation answers how well a language model converts a model card into a policy that conforms to the profile (conformance) and that keeps the content of the card (content recovery), how repeatable the conversion is, and how the results differ between a small and two larger language models.

### Model cards and reference policies

10 real model cards from four repositories, converted by hand into the structured input (`evaluation/src/corpus/*.json`; the texts of six of them are in `evaluation/src/corpus/raw/`). The reference policies were drafted by the first author and verified by two co-authors; they contain 95 constraint clauses (44 permission, 6 prohibition, 45 duty) and 61 descriptive properties, and each conforms to the SHACL shapes. The evaluation starts from structured input and does not include images or tables.

| Model card | Repository | Type | Clauses (permission / prohibition / duty) | Descriptive properties |
|---|---|---|---|---|
| Qwen3-0.6B | Hugging Face | small language model | 5 / 0 / 6 | 2 |
| chronos-2 | Hugging Face | time series | 4 / 0 / 2 | 5 |
| multilingual-e5-small | Hugging Face | text embedding | 4 / 0 / 3 | 7 |
| Z-Image-Turbo | Hugging Face | image generation | 3 / 0 / 0 | 7 |
| DeepSeek-V4-Pro | Hugging Face | mixture-of-experts language model | 7 / 0 / 3 | 6 |
| Llama 3.2 | Kaggle | language model | 5 / 3 / 13 | 11 |
| Perch | Kaggle | audio classifier | 4 / 0 / 4 | 7 |
| Segment Anything | Kaggle | image segmentation | 3 / 0 / 0 | 3 |
| Audio2Emotion | NVIDIA NGC | speech emotion recognition | 3 / 3 / 10 | 10 |
| Gemini Robotics ER 2 | Google Vertex Model Garden | robotics vision-language model | 6 / 0 / 4 | 3 |

### Converters and settings

| Name in `models.json` | Model | Served by |
|---|---|---|
| `qwen2.5-7b` | Qwen2.5-7B-Instruct, 7.6 billion parameters (Q4_K_M, GGUF, context length 32,768) | local Ollama |
| `qwen3.8-27b-aic` | Qwen3.8-27B (identifier `Qwen3.8-27B-AIC`), 27 billion parameters | hosted endpoint |
| `phi4-14b` | phi4-14b, 14 billion parameters | hosted endpoint |
| `rule-based` | fixed mapping of the fields, no language model | `evaluation/src/baselines/ruleBasedExtractor.ts` |

All language models received the same prompt (same hash) and the same settings: JSON output, temperature 0, no random seed. Each card was converted three times per model (30 runs per model; Qwen3.8-27B has 29 runs because Audio2Emotion has two). The rule-based converter ran once per card. The runs took place between 16 and 21 October 2026, and each run records the model identifier, the temperature, a hash of the prompt, the date and the duration. The models differ in size, quantization and serving environment, so differences between them cannot be attributed to the number of parameters alone.

### Metrics

Seven metrics are reported separately: (1) syntactic validity (valid JSON with the keys `@context`, `@type`, `profile`, `target`, `party`); (2) conformance with the profile (SHACL shapes); (3) extraction completeness (precision, recall and F1 of the constraint clauses); (4) rule-type accuracy (permission, prohibition, duty); (5) constraint accuracy (left operand and operator); (6) precision and recall of the descriptive properties; (7) stability (clauses that two runs of a card have in common divided by the different clauses of both runs, and the standard deviation of the F1 across the runs of a card). Two clauses match when at least half of their words are shared (Dice coefficient of at least 0.5, ignoring case and common words), and each clause is matched at most once. A descriptive property is recovered when its key is the same and its value matches by the same rule. The intervals are 95% intervals of the mean over cards.

### Results

| Metric | Qwen2.5-7B (30 runs) | Qwen3.8-27B (29 runs) | phi4-14b (30 runs) | Rule-based (10 runs) |
|---|---|---|---|---|
| Valid JSON | 100% | 100% | 100% | 100% |
| All required keys | 90% | 100% | 90% | 100% |
| Conformance with the profile | 100% | 100% | 30% | 100% |
| Extraction precision / recall / F1 | 0.45 / 0.32 / 0.34 | 0.92 / 0.99 / 0.95 | 0.94 / 0.74 / 0.80 | 1.00 / 0.97 / 0.98 |
| Interval of the mean F1 | 0.23 to 0.48 | 0.90 to 0.99 | 0.63 to 0.94 | 0.96 to 1.00 |
| Rule-type accuracy | 90% | 100% | 100% | 100% |
| Left-operand accuracy | 64% | 100% | 97% | 36% |
| Operator accuracy | 100% | 100% | 100% | 100% |
| Descriptive properties, precision / recall | 0.42 / 0.67 | 0.87 / 1.00 | 0.76 / 0.88 | 1.00 / 1.00 |
| Interval of the mean recall | 0.38 to 0.91 | 1.00 to 1.00 | 0.73 to 0.98 | 1.00 to 1.00 |
| Agreement between the runs of a card | 1.00 | 0.98 | 1.00 | not applicable |
| Standard deviation of the F1 within a card | 0.00 | 0.01 | 0.00 | not applicable |
| Mean duration of a run | 72 s | 435 s | 345 s | below 1 s |

Per card (means over the runs of a card; F1 of the extraction and recall of the descriptive properties):

| Model card | Reference clauses | F1 Qwen2.5 | F1 Qwen3.8 | F1 phi4 | Recall Qwen2.5 | Recall Qwen3.8 | Recall phi4 |
|---|---|---|---|---|---|---|---|
| Qwen3-0.6B | 11 | 0.09 | 0.81 | 0.59 | 0.00 | 1.00 | 1.00 |
| chronos-2 | 6 | 0.20 | 0.92 | 0.91 | 1.00 | 1.00 | 1.00 |
| multilingual-e5-small | 7 | 0.40 | 0.88 | 0.83 | 0.00 | 1.00 | 1.00 |
| Z-Image-Turbo | 3 | 0.25 | 1.00 | 1.00 | 0.86 | 1.00 | 0.71 |
| DeepSeek-V4-Pro | 10 | 0.14 | 1.00 | 1.00 | 0.00 | 1.00 | 1.00 |
| Llama 3.2 | 21 | 0.30 | 1.00 | 0.17 | 1.00 | 1.00 | 0.91 |
| Perch | 8 | 0.27 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Segment Anything | 3 | 0.75 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Audio2Emotion | 16 | 0.67 | 0.84 | 0.72 | 0.80 | 1.00 | 0.80 |
| Gemini Robotics ER 2 | 10 | 0.37 | 1.00 | 0.78 | 1.00 | 1.00 | 0.33 |

What the results show:

- All outputs of all models were valid JSON. Qwen2.5-7B and Qwen3.8-27B conformed to the profile in every run; phi4-14b in 9 of 30 runs, because on seven cards it wrote a prohibition rule without constraints although the cards have no prohibitions.
- The models differ strongly in the content that they keep: Qwen3.8-27B recovered 99% of the reference clauses (F1 0.95), phi4-14b 74% (F1 0.80) and Qwen2.5-7B 32% (F1 0.34). Conformance and content recovery therefore have to be assessed separately.
- The deviations have different causes. Qwen3.8-27B split clauses into several constraints on three cards (lower precision, not lower recall) and omitted the intended users and the intended domain of Audio2Emotion (recall 0.81). phi4-14b lost content (recall below 0.60 on three cards) and did not follow the structure of the profile for Llama 3.2 (F1 0.17). Qwen2.5-7B merged the clauses of a field into one constraint, wrote constraints that do not correspond to the card, and added duties such as "Not specified in the model card".
- At temperature 0, the runs of Qwen2.5-7B and phi4-14b were identical on every card. Qwen3.8-27B was not fully deterministic: its runs were identical for five cards and differed for five. On multilingual-e5-small, one run wrote related intended uses as separate clauses (seven permissions instead of four), so that the F1 of the three runs was 0.78, 0.93 and 0.93 with the same content. Identical runs do not indicate quality: the same errors recur in every run.
- The rule-based converter follows the same field mapping as the reference policies, so its F1 of 0.98 is an upper reference and not an independent comparison.
- Sensitivity to the matching threshold (0.4 and 0.6 instead of 0.5): the mean F1 is 0.41 and 0.25 for Qwen2.5-7B, 0.82 and 0.78 for phi4-14b, 0.95 and 0.94 for Qwen3.8-27B, and 0.98 at both thresholds for the rule-based converter. The ranking does not change.

### Re-run the evaluation

Recompute the metrics from the saved runs (no language model needed). `evaluation/results/rq4-final-3runs-phi4.jsonl` holds all runs above; `rescored-0.4-...`, `rescored-0.5-...` and `rescored-0.6-...` hold the same runs rescored at the three thresholds:

```bash
cd evaluation
npm run aggregate -- results/rq4-final-3runs-phi4.jsonl
npm run aggregate -- results/rescored-0.4-rq4-final-3runs-phi4.jsonl
npm run aggregate -- results/rescored-0.6-rq4-final-3runs-phi4.jsonl
```

The `stability` column shows `n/a` for this merged file; the agreement between runs is computed by the harness for the runs of one card within one harness run.

Repeat the conversions (needs the three models set up as in Part 2: `qwen2.5-7b` through Ollama, the other two through `evaluation/.env`):

```bash
cd evaluation
npm run harness -- --models=qwen2.5-7b,qwen3.8-27b-aic,phi4-14b --runs=3
npm run aggregate -- results/harness-run-<timestamp>.jsonl
```

Rescore a run file with another matching threshold (writes `results/rescored-<threshold>-<file>`):

```bash
MATCH_THRESHOLD=0.4 npm run rescore -- results/harness-run-<timestamp>.jsonl
```

### Files

| Path | Content |
|---|---|
| `server/prompts/modelCardToOdrl.prompt.ts` | The conversion prompt (eleven rules) |
| `server/llm/modelCardOdrlConverter.ts` | The model call of the converter (endpoint, model and key from `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`; default local Ollama `qwen2.5:7b-instruct`; run `npm install` in `server/` to install `openai`) |
| `evaluation/models.json` | The language models (name, endpoint, model identifier) |
| `evaluation/src/runHarness.ts` | Runs the converters on the corpus and writes one JSON line per run |
| `evaluation/src/converter/llmConverter.ts` | The same model call as `server/llm`, with a record of model, temperature, prompt hash and duration |
| `evaluation/src/baselines/ruleBasedExtractor.ts` | The converter without a language model |
| `evaluation/src/validation/shacl/modelcard-profile.shapes.ttl` | The SHACL shapes of the profile |
| `evaluation/src/validation/validateShacl.ts` | Applies the shapes to the expanded JSON-LD of a policy |
| `evaluation/src/metrics/` | The metrics |
| `evaluation/src/corpus/*.json` | The 10 model cards: structured input and reference policy |
| `evaluation/src/aggregateResults.ts` | Summarizes run files |
| `evaluation/src/rescore.ts` | Recomputes the content metrics with another matching threshold |
| `evaluation/src/test*.ts` | The three tests (`test:shapes`, `test:metrics`, `test:corpus`) |
| `evaluation/results/` | The saved runs of the evaluation and the rescored files |
| `figures/` | Figures and tables of the analysis of the model cards (RQ1 to RQ3) and the ODRL diagrams |
| `docs/` | Paper texts, response letter and the workbook with the coded model cards |
| `examples/` | Example model card JSON files and policies |
