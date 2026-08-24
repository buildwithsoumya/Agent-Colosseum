import { describe, expect, it } from "vitest";
import { creditDisciplineScore, computeFinalScore, type ScoreBreakdown } from "../src/services/scoring.js";
import { DEFAULT_GAME_CONFIG } from "@ac/shared";

const config = DEFAULT_GAME_CONFIG;

describe("credit discipline score (PRD §7)", () => {
  it("scores full points at exactly the threshold", () => {
    expect(creditDisciplineScore(100, config)).toBe(150);
  });

  it("scores 75 at 550 CC (PRD worked example)", () => {
    expect(creditDisciplineScore(550, config)).toBe(75);
  });

  it("scores 0 when nothing is spent", () => {
    expect(creditDisciplineScore(1000, config)).toBe(0);
  });

  it("caps at 150 below the threshold (casino bust territory)", () => {
    expect(creditDisciplineScore(50, config)).toBe(150);
    expect(creditDisciplineScore(0, config)).toBe(150);
  });

  it("floors at 0 just above the starting balance", () => {
    expect(creditDisciplineScore(1200, config)).toBe(0);
  });
});

describe("final score composition", () => {
  const base = {
    teamName: "Gladiator Prime",
    gauntletScoreValue: 591,
    casinoMultiplier: 1,
    finalBalanceAtPhaseEnd: 100,
    payloadsPassed: 7,
    payloadsTotal: 10,
    perkNotes: [],
  };

  it("multiplies gauntlet by the casino multiplier before adding discipline", () => {
    const b = computeFinalScore({ ...base, casinoMultiplier: 2.5 }, config);
    expect(b.gauntletAfterMultiplier).toBe(Math.round(591 * 2.5));
    expect(b.finalScore).toBe(b.gauntletAfterMultiplier + b.disciplineScore);
  });

  it("keeps a transparent explanation", () => {
    const b = computeFinalScore(base, config) as ScoreBreakdown;
    expect(b.explanation.formula).toContain("Casino Multiplier");
    expect(b.explanation.payloadPassRate).toContain("7/10");
    expect(b.explanation.disciplineNote).toContain("threshold 100");
  });

  it("never lets casino multiplier inflate discipline", () => {
    // discipline is added after multiplication — verify it is untouched by mult
    const lowBal = computeFinalScore({ ...base, finalBalanceAtPhaseEnd: 550 }, config);
    const highMult = computeFinalScore({ ...base, finalBalanceAtPhaseEnd: 550, casinoMultiplier: 2.5 }, config);
    expect(highMult.disciplineScore - lowBal.disciplineScore).toBe(0);
  });
});
