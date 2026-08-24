import type { GameConfig } from "@ac/shared";
import { computeGauntletScore } from "@ac/shared";
import { clamp } from "../lib/rng.js";

/**
 * ScoringService — the ONLY place scoring formulas live.
 *
 * PRD master formula:
 *   Final Score = (Gauntlet Points × Casino Multiplier) + Credit Discipline Score
 *
 * Gauntlet (0..1000, weighted):
 *   Accuracy & Output Validity 40% · Adversarial Resilience 25%
 *   Latency & Execution Speed 20% · Token Efficiency 15%
 *
 * Credit Discipline (0..150):
 *   B = final balance at end of PHASE_3, T = threshold (100), S = starting (1000)
 *   score = 150 × (1 − (B − T) / (S − T))   floored at 0, capped at 150.
 *   A balance at/below the threshold scores the full 150.
 */
export function creditDisciplineScore(finalBalance: number, config: GameConfig): number {
  const { disciplineThresholdCc: T, disciplineStartCc: S, disciplineCapPoints: cap } = config;
  if (finalBalance <= T) return cap; // below/at threshold → full points
  const raw = cap * (1 - (finalBalance - T) / (S - T));
  return Math.round(clamp(raw, 0, cap));
}

export interface GauntletMetricScores {
  accuracyScore: number; // 0..1000 each
  resilienceScore: number;
  latencyScore: number;
  tokenScore: number;
}

export function gauntletScore(m: GauntletMetricScores, config: GameConfig): number {
  return computeGauntletScore(m, config.gauntletWeights);
}

export interface FinalScoreInput {
  teamName: string;
  gauntletScoreValue: number; // 0..1000
  casinoMultiplier: number; // 1 or 2.5
  finalBalanceAtPhaseEnd: number;
  payloadsPassed: number;
  payloadsTotal: number;
  perkNotes: string[];
}

export interface ScoreBreakdown {
  teamName: string;
  gauntletScore: number;
  casinoMultiplier: number;
  gauntletAfterMultiplier: number;
  disciplineScore: number;
  finalScore: number;
  explanation: {
    formula: string;
    payloadPassRate: string;
    disciplineNote: string;
    casinoNote: string;
    perks: string[];
  };
}

export function computeFinalScore(input: FinalScoreInput, config: GameConfig): ScoreBreakdown {
  const gauntletAfterMultiplier = Math.round(input.gauntletScoreValue * input.casinoMultiplier);
  const discipline = creditDisciplineScore(input.finalBalanceAtPhaseEnd, config);
  const final = gauntletAfterMultiplier + discipline;

  return {
    teamName: input.teamName,
    gauntletScore: input.gauntletScoreValue,
    casinoMultiplier: input.casinoMultiplier,
    gauntletAfterMultiplier,
    disciplineScore: discipline,
    finalScore: final,
    explanation: {
      formula: "(Gauntlet Points × Casino Multiplier) + Credit Discipline Score",
      payloadPassRate:
        input.payloadsTotal > 0
          ? `${input.payloadsPassed}/${input.payloadsTotal} adversarial payloads passed`
          : "No evaluation data yet",
      disciplineNote: `Final CC ${input.finalBalanceAtPhaseEnd} vs threshold ${config.disciplineThresholdCc} → ${discipline} pts`,
      casinoNote:
        input.casinoMultiplier > 1
          ? `High-Roller win — Gauntlet points multiplied by ×${input.casinoMultiplier}`
          : "No score multiplier won",
      perks: input.perkNotes,
    },
  };
}
