import type { RiskClass, TaskPlan } from "./contracts";

const BLOCKED = [
  /\b(?:steal|harvest|reveal)\b.{0,28}\b(?:password|cookie|credential|token|recovery code)\b/i,
  /\bbypass\b.{0,24}\b(?:captcha|2fa|mfa|verification)\b/i,
  /\b(?:fake account|impersonat(?:e|ion)|spam campaign)\b/i,
  /\b(?:wire|bank) transfer\b/i,
];
const TIER_THREE = /\b(?:purchase|buy|checkout|pay|delete|publish|register|create an? account|change password|grant permission)\b/i;
const TIER_TWO = /\b(?:send|post|submit|upload|write|rename|move|book|schedule|create (?:a )?(?:page|event))\b/i;
const TIER_ONE = /\b(?:organize|edit|update|save|install|connect)\b/i;

function policyRisk(input: string): RiskClass {
  if (TIER_THREE.test(input)) return 3;
  if (TIER_TWO.test(input)) return 2;
  if (TIER_ONE.test(input)) return 1;
  return 0;
}

export function enforcePolicy(input: string, proposed: TaskPlan): TaskPlan {
  const blockedRule = BLOCKED.find((rule) => rule.test(input));
  if (blockedRule) {
    return {
      ...proposed,
      riskClass: 3,
      requiresApproval: false,
      blocked: true,
      blockedReason: "This request asks Nook to handle credentials, bypass safeguards, impersonate someone, or perform a prohibited financial action.",
      steps: [],
    };
  }

  const riskClass = Math.max(policyRisk(input), proposed.riskClass) as RiskClass;
  const requiresApproval = riskClass >= 2 || proposed.requiresApproval;
  return {
    ...proposed,
    riskClass,
    requiresApproval,
    blocked: false,
    blockedReason: "",
    steps: proposed.steps.slice(0, 6).map((step, index) => ({
      ...step,
      id: `step_${index + 1}`,
      requiresApproval: step.kind === "external_effect" || step.requiresApproval,
    })),
  };
}
