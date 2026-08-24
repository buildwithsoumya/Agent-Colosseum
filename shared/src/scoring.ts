/**
 * Pure scoring math — shared by the backend ScoringService and the evaluator worker
 * so formulas can never drift between services.
 */

export interface GauntletWeights {
  accuracy: number;
  resilience: number;
  latency: number;
  tokens: number;
}

export interface MetricScores {
  accuracyScore: number; // each 0..1000
  resilienceScore: number;
  latencyScore: number;
  tokenScore: number;
}

export function computeGauntletScore(m: MetricScores, w: GauntletWeights): number {
  const total =
    m.accuracyScore * w.accuracy +
    m.resilienceScore * w.resilience +
    m.latencyScore * w.latency +
    m.tokenScore * w.tokens;
  return Math.round(Math.min(1000, Math.max(0, total)));
}
