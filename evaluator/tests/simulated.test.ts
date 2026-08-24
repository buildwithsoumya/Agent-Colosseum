import { describe, expect, it } from "vitest";
import { seededRandom } from "../src/rng.js";
import { aggregate } from "../src/evaluators/simulated.js";
import type { MetricResult } from "../src/types.js";

describe("seeded RNG", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom("job-123");
    const b = seededRandom("job-123");
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("stays within [0, 1)", () => {
    const r = seededRandom("range-check");
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

function metric(kind: string, passed: boolean): MetricResult {
  return { testCaseId: kind + Math.random(), kind: kind as MetricResult["kind"], passed, latencyMs: 800, tokensUsed: 700 };
}

describe("simulated evaluation aggregation", () => {
  it("computes accuracy over all payloads and resilience over adversarial ones", () => {
    const metrics = [
      metric("VALIDITY", true),
      metric("PROMPT_INJECTION", true),
      metric("PROMPT_INJECTION", false),
      metric("VALIDITY", true),
    ];
    const weights = { accuracy: 0.4, resilience: 0.25, latency: 0.2, tokens: 0.15 };
    const out = aggregate(metrics, weights);
    // accuracy: 3/4 → 750
    expect(out.accuracyScore).toBe(750);
    // resilience: adversarial = 2 injection cases, 1 passed → 500
    expect(out.resilienceScore).toBe(500);
    // baseline latency 800ms and tokens 700 are the 1000-point anchors
    expect(out.latencyScore).toBe(1000);
    expect(out.tokenScore).toBe(1000);
    // weighted total
    expect(out.gauntletScore).toBe(Math.round(750 * 0.4 + 500 * 0.25 + 1000 * 0.2 + 1000 * 0.15));
  });

  it("never escapes the 0..1000 band", () => {
    const awful = Array.from({ length: 10 }, () => metric("CORRUPT_INPUT", false));
    const out = aggregate(
      awful.map((m) => ({ ...m, latencyMs: 9999, tokensUsed: 9999 })),
      { accuracy: 0.4, resilience: 0.25, latency: 0.2, tokens: 0.15 },
    );
    expect(out.gauntletScore).toBeGreaterThanOrEqual(0);
    expect(out.gauntletScore).toBeLessThanOrEqual(1000);
  });

  it("sabotage lag degrades the latency score but is capped by input", () => {
    const metrics = [metric("VALIDITY", true)];
    const clean = aggregate(metrics.map((m) => ({ ...m, latencyMs: 800 })), { accuracy: 1, resilience: 0, latency: 0, tokens: 0 });
    const lagged = aggregate(metrics.map((m) => ({ ...m, latencyMs: 4000 })), { accuracy: 1, resilience: 0, latency: 0, tokens: 0 });
    expect(lagged.latencyScore).toBeLessThan(clean.latencyScore);
    expect(clean.latencyScore).toBe(1000);
  });
});
