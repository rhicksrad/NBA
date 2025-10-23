import type { Player, SimResult } from "./types";
import { buildChemistry, evaluateMatchup } from "./chemistry";

export interface SimulationOptions {
  games?: number;
  eraNorm?: boolean;
  rng?: () => number;
}

function defaultRng(): number {
  return Math.random();
}

function gaussianNoise(rng: () => number): number {
  // Box-Muller transform
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function averageImpact(players: Player[]): number {
  if (!players.length) {
    return 0;
  }
  return players.reduce((sum, player) => sum + player.impact, 0) / players.length;
}

function averagePace(players: Player[]): number {
  if (!players.length) {
    return 0;
  }
  return players.reduce((sum, player) => sum + player.paceZ, 0) / players.length;
}

export function simulateSeries(teamA: Player[], teamB: Player[], options: SimulationOptions = {}): SimResult {
  const games = Number.isFinite(options.games) && options.games ? Math.max(1, Math.floor(options.games)) : 100;
  const rng = options.rng ?? defaultRng;
  const chemistryA = buildChemistry(teamA);
  const chemistryB = buildChemistry(teamB);
  const matchup = evaluateMatchup(teamA, teamB);

  const baseStrengthA = chemistryA.score + averageImpact(teamA) + matchup.advantageA;
  const baseStrengthB = chemistryB.score + averageImpact(teamB) + matchup.advantageB;

  const margins: number[] = [];
  let totalScoreA = 0;
  let totalScoreB = 0;
  let teamAWins = 0;
  let teamBWins = 0;

  const paceA = averagePace(teamA);
  const paceB = averagePace(teamB);
  const paceAdjustment = options.eraNorm ? (paceA + paceB) / 2 : 0;

  for (let i = 0; i < games; i += 1) {
    const noise = gaussianNoise(rng) * 5;
    const uniform = rng() * 10;
    const scoreA = 100 + baseStrengthA / 2 + uniform + noise - paceAdjustment;
    const scoreB = 100 + baseStrengthB / 2 + rng() * 10 + gaussianNoise(rng) * 5 - paceAdjustment;
    const margin = scoreA - scoreB;
    if (margin >= 0) {
      teamAWins += 1;
    } else {
      teamBWins += 1;
    }
    totalScoreA += scoreA;
    totalScoreB += scoreB;
    margins.push(margin);
  }

  return {
    teamAWins,
    teamBWins,
    avgScoreA: margins.length ? totalScoreA / margins.length : 0,
    avgScoreB: margins.length ? totalScoreB / margins.length : 0,
    margins,
  };
}
