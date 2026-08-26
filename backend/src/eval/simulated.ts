import { computeGauntletScore, type GauntletWeights } from "@ac/shared";
import { clamp, seededRandom } from "./rng.js";
import type { EvaluationJobPayload, EvaluationOutput, Evaluator, MetricResult, TestCase } from "./types.js";

/**
 * SimulatedEvaluator — deterministic demo evaluation.
 *
 * Outcomes are derived from a seed (jobId) so replays are reproducible, and
 * are influenced by real event state: teams that bought defensive buffs resist
 * injections better; sabotage effects applied by rivals degrade latency.
 * This keeps the economy strategically connected to the Gauntlet without
 * executing untrusted code in the demo.
 *
 * Sabotage impact is deliberately capped (review recommendation) so a
 * sabotaged team can still finish the run.
 */
export class SimulatedEvaluator implements Evaluator {
  readonly name = "simulated";

  constructor(
    private readonly opts: {
      weights: GauntletWeights;
      payloadCount: number;
      defensiveBuffsOwned: number;
      sabotageLagPenaltyMs: number; // capped per-payload latency penalty from rivals
      tier1Keys: boolean; // Overclock win — small latency/token bonus
    },
  ) {}

  async evaluate(job: EvaluationJobPayload, cases: TestCase[]): Promise<EvaluationOutput> {
    const rand = seededRandom(job.jobId);
    const metrics: MetricResult[] = [];

    const injectionResistBase = 0.35 + 0.12 * clamp(this.opts.defensiveBuffsOwned, 0, 3); // capped influence
    let latencyPenalty = this.opts.sabotageLagPenaltyMs;
    if (this.opts.tier1Keys) latencyPenalty = Math.max(0, latencyPenalty - 400);

    for (const tc of cases) {
      let passChance: number;
      switch (tc.kind) {
        case "PROMPT_INJECTION":
        case "CORRUPT_INPUT":
          passChance = injectionResistBase;
          break;
        case "RATE_LIMIT":
          passChance = 0.55;
          break;
        case "SCHEMA_DRIFT":
          passChance = 0.5 + 0.1 * clamp(this.opts.defensiveBuffsOwned, 0, 2);
          break;
        default:
          passChance = 0.8;
      }
      const passed = rand() < passChance;
      // latency: healthy agent ~900–2200ms; sabotage adds up to +2.5s (capped)
      const baseLatency = 900 + Math.floor(rand() * 1300);
      const latencyMs = baseLatency + (passed ? 0 : 300) + Math.floor(latencyPenalty * (0.7 + rand() * 0.6));
      // tokens: 700–2400 per turn, failures hallucinate more
      const tokensUsed = 700 + Math.floor(rand() * 1700) + (passed ? 0 : 250);

      metrics.push({
        testCaseId: tc.id,
        kind: tc.kind,
        passed,
        latencyMs,
        tokensUsed,
        detail: passed ? undefined : `Failed ${tc.kind.toLowerCase()} case`,
      });
    }

    return aggregate(metrics, this.opts.weights);
  }
}

export function aggregate(metrics: MetricResult[], weights: GauntletWeights): EvaluationOutput {
  const total = metrics.length || 1;

  // Accuracy & output validity: every payload must return valid output
  const accuracyPassed = metrics.filter((m) => m.passed).length;
  const accuracyScore = Math.round((accuracyPassed / total) * 1000);

  // Adversarial resilience: injection traps + corrupt inputs specifically
  const adversarial = metrics.filter((m) => m.kind === "PROMPT_INJECTION" || m.kind === "CORRUPT_INPUT");
  const advPassed = adversarial.filter((m) => m.passed).length;
  const resilienceScore = Math.round((advPassed / (adversarial.length || 1)) * 1000);

  const avgLatency = metrics.reduce((s, m) => s + m.latencyMs, 0) / total;
  // 800ms → ~1000 pts, 4800ms+ → 0
  const latencyScore = Math.round(clamp(1000 * (1 - (avgLatency - 800) / 4000), 0, 1000));

  const successful = metrics.filter((m) => m.passed);
  const avgTokens =
    (successful.length ? successful : metrics).reduce((s, m) => s + m.tokensUsed, 0) /
    (successful.length || total);
  // 700 tokens → ~1000 pts, 3200+ → 0
  const tokenScore = Math.round(clamp(1000 * (1 - (avgTokens - 700) / 2500), 0, 1000));

  return {
    metrics,
    accuracyScore,
    resilienceScore,
    latencyScore,
    tokenScore,
    gauntletScore: computeGauntletScore(
      { accuracyScore, resilienceScore, latencyScore, tokenScore },
      weights,
    ),
  };
}
