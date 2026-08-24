import type { Evaluator, EvaluationJobPayload, EvaluationOutput, TestCase } from "../types.js";

/**
 * DockerEvaluator — future execution layer seam.
 *
 * When real agent containers are introduced this evaluator will:
 *   1. pull the team's submitted image/repo,
 *   2. start an isolated container (no network egress except the harness),
 *   3. stream each TestCase payload,
 *   4. collect outputs/timings into MetricResults.
 *
 * Not implemented in the demo — EVALUATOR_MODE=simulated is used instead.
 */
export class DockerEvaluator implements Evaluator {
  readonly name = "docker";

  async evaluate(_job: EvaluationJobPayload, _cases: TestCase[]): Promise<EvaluationOutput> {
    throw new Error("DockerEvaluator not implemented yet — set EVALUATOR_MODE=simulated");
  }
}
