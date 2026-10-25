import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validatePolicyAgainstProfile } from "./validation/validateShacl.ts";
import type { OdrlPolicy } from "./types.ts";

// Regression test for the profile SHACL shapes: the valid policy must conform and every mutation
// that breaks one profile rule must be reported. Run with `npm run test:shapes`.
const fixture = fileURLToPath(new URL("./validation/fixtures/valid-policy.json", import.meta.url));
const valid = JSON.parse(readFileSync(fixture, "utf-8"));
const clone = () => JSON.parse(JSON.stringify(valid));

const badCases: Record<string, (p: any) => void> = {
  "descriptive field used as duty leftOperand": (p) =>
    p.duty.push({ "@type": "odrl:Duty", action: "odrl:inform", constraint: [{ leftOperand: "ex:evaluationMetrics", operator: "odrl:eq", rightOperand: "x" }] }),
  "descriptive field nested in odrl:and inside a duty": (p) =>
    p.duty.push({ "@type": "odrl:Duty", action: "odrl:inform", constraint: [{ "odrl:and": [
      { leftOperand: "ex:biasMitigation", operator: "odrl:eq", rightOperand: "x" },
      { leftOperand: "ex:limitations", operator: "odrl:eq", rightOperand: "y" } ] }] }),
  "descriptive fields as bare ex: keys in a duty constraint": (p) => {
    p.duty[0].constraint = { "ex:limitations": "x", "ex:riskFactors": "y" };
  },
  "invalid operator IRI": (p) => { p.permission[0].constraint[0].operator = "odrl:eql"; },
  "logical word used as operator": (p) => { p.permission[0].constraint[0].operator = "odrl:and"; },
  "nested odrl:permission wrapper": (p) => {
    p.permission[0]["odrl:permission"] = { action: "odrl:use", constraint: p.permission[0].constraint };
  },
  "leftOperand is an object": (p) => {
    p.permission[0].constraint[0].leftOperand = { "@id": "https://example.com/x", "ex:kind": "dc:Statement" };
  },
  "leftOperand outside the ex: namespace": (p) => { p.permission[0].constraint[0].leftOperand = "odrl:purpose"; },
  "rightOperand is an object": (p) => { p.permission[0].constraint[0].rightOperand = { "ex:value": "x" }; },
  "constraint missing rightOperand": (p) => { delete p.permission[0].constraint[0].rightOperand; },
  "permission without action": (p) => { delete p.permission[0].action; },
  "duty without constraint": (p) => { delete p.duty[0].constraint; },
  "duty with action other than inform": (p) => { p.duty[0].action = "odrl:use"; },
  "permission with action other than use": (p) => { p.permission[0].action = "odrl:distribute"; },
  "descriptive property on the target is an object": (p) => { p.target["ex:limitations"] = { "ex:text": "x" }; },
  "target without title": (p) => { delete p.target["dc:title"]; },
  "policy without profile": (p) => { delete p.profile; },
};

const run = async () => {
  const ok = await validatePolicyAgainstProfile(valid as OdrlPolicy);
  assert.equal(ok.conforms, true, `valid policy rejected: ${JSON.stringify(ok.violations)}`);
  console.log("PASS  valid policy conforms");

  const noContext = clone();
  delete noContext["@context"];
  assert.equal((await validatePolicyAgainstProfile(noContext)).conforms, false);
  console.log("PASS  missing @context is rejected");

  let failures = 0;
  for (const [name, mutate] of Object.entries(badCases)) {
    const p = clone();
    mutate(p);
    const r = await validatePolicyAgainstProfile(p as OdrlPolicy).catch(() => ({ conforms: false }));
    if (r.conforms) {
      failures += 1;
      console.log(`FAIL  accepted: ${name}`);
    } else {
      console.log(`PASS  rejected: ${name}`);
    }
  }
  assert.equal(failures, 0, `${failures} invalid policies were accepted`);
};

run();
