/**
 * Gauntlet evaluation contracts.
 *
 * These interfaces are the seam where a real Docker-based execution layer
 * plugs in later. The demo ships `SimulatedEvaluator`; a future
 * `DockerEvaluator` would spin isolated containers per team agent, run the
 * same TestCases and emit identical EvaluationResults.
 */

export interface TestCase {
  id: string;
  kind: "VALIDITY" | "PROMPT_INJECTION" | "RATE_LIMIT" | "SCHEMA_DRIFT" | "CORRUPT_INPUT";
  prompt: string;
  passCondition: string;
}

export interface MetricResult {
  testCaseId: string;
  kind: TestCase["kind"];
  passed: boolean;
  latencyMs: number;
  tokensUsed: number;
  detail?: string;
}

export interface EvaluationJobPayload {
  jobId: string;
  submissionId: string;
  teamId: string;
}

export interface EvaluationOutput {
  metrics: MetricResult[];
  accuracyScore: number; // 0..1000 each — normalised by the evaluator implementation
  resilienceScore: number;
  latencyScore: number;
  tokenScore: number;
  gauntletScore: number;
}

export interface Evaluator {
  readonly name: string;
  evaluate(job: EvaluationJobPayload, cases: TestCase[]): Promise<EvaluationOutput>;
}
