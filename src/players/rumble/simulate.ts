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

function parseEraYear(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/\d{4}/);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

function eraMultiplier(player: Player, enabled: boolean): number {
  if (!enabled) {
    return 1;
  }
  const year = parseEraYear(player.era);
  if (!year) {
    return 1;
  }
  if (year < 1980) {
    return 1.15;
  }
  if (year < 1990) {
    return 1.1;
  }
  if (year < 2000) {
    return 1.05;
  }
  if (year < 2010) {
    return 1.02;
  }
  return 1;
}

function teamEraScale(players: Player[], enabled: boolean): number {
  if (!enabled || !players.length) {
    return 1;
  }
  const total = players.reduce((sum, player) => sum + eraMultiplier(player, enabled), 0);
  return total / players.length;
}

export function simulateSeries(
  teamA: Player[],
  teamB: Player[],
  optionsOrGames?: SimulationOptions | number,
  eraNormOverride?: boolean
): SimResult {
  const options: SimulationOptions =
    typeof optionsOrGames === "number" ? { games: optionsOrGames, eraNorm: eraNormOverride } : optionsOrGames ?? {};

  const games = Number.isFinite(options.games) && options.games ? Math.max(1, Math.floor(options.games)) : 100;
  const rng = options.rng ?? defaultRng;
  const eraNorm = Boolean(options.eraNorm);
  const chemistryA = buildChemistry(teamA);
  const chemistryB = buildChemistry(teamB);
  const matchup = evaluateMatchup(teamA, teamB);

  const scaleA = teamEraScale(teamA, eraNorm);
  const scaleB = teamEraScale(teamB, eraNorm);
  const baseStrengthA = (chemistryA.score + averageImpact(teamA) + matchup.advantageA) * scaleA;
  const baseStrengthB = (chemistryB.score + averageImpact(teamB) + matchup.advantageB) * scaleB;

  const margins: number[] = [];
  let totalScoreA = 0;
  let totalScoreB = 0;
  let teamAWins = 0;
  let teamBWins = 0;

  const paceA = averagePace(teamA);
  const paceB = averagePace(teamB);
  const paceAdjustment = eraNorm ? (paceA + paceB) / 2 : 0;

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
