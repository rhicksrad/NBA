import type { Player, SimResult } from "./types";
import { buildChemistry, evaluateMatchup } from "./chemistry";
import { ERA_PRESETS, isEraStyle, type EraPreset, type EraStyle } from "./era";

export interface SimulationOptions {
  games?: number;
  eraStyle?: EraStyle;
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

function normalizeEraStyle(options: Pick<SimulationOptions, "eraStyle" | "eraNorm">): EraStyle {
  if (isEraStyle(options.eraStyle)) {
    return options.eraStyle;
  }
  if (typeof options.eraNorm === "boolean") {
    return options.eraNorm ? "nineties" : "current";
  }
  return "current";
}

export function simulateSeries(
  teamA: Player[],
  teamB: Player[],
  optionsOrGames?: SimulationOptions | number,
  legacyEra?: EraStyle | boolean
): SimResult {
  let options: SimulationOptions;
  if (typeof optionsOrGames === "number") {
    options = { games: optionsOrGames };
    if (typeof legacyEra === "boolean") {
      options.eraNorm = legacyEra;
    } else if (isEraStyle(legacyEra)) {
      options.eraStyle = legacyEra;
    }
  } else {
    options = { ...(optionsOrGames ?? {}) };
  }

  const games = Number.isFinite(options.games) && options.games ? Math.max(1, Math.floor(options.games)) : 100;
  const rng = options.rng ?? defaultRng;
  const eraStyle = normalizeEraStyle(options);
  const preset = ERA_PRESETS[eraStyle] ?? ERA_PRESETS.current;
  const chemistryA = buildChemistry(teamA, eraStyle);
  const chemistryB = buildChemistry(teamB, eraStyle);
  const matchup = evaluateMatchup(teamA, teamB, eraStyle);

  const baseStrengthA = teamStrength(teamA, teamB, chemistryA.score, matchup.advantageA, preset);
  const baseStrengthB = teamStrength(teamB, teamA, chemistryB.score, matchup.advantageB, preset);

  const margins: number[] = [];
  let totalScoreA = 0;
  let totalScoreB = 0;
  let teamAWins = 0;
  let teamBWins = 0;

  const possScale = preset.poss / 100;

  for (let i = 0; i < games; i += 1) {
    const noiseA = gaussianNoise(rng) * 4 * preset.variance;
    const noiseB = gaussianNoise(rng) * 4 * preset.variance;
    const baseScoreA = 100 * possScale + (baseStrengthA / 2) * possScale;
    const baseScoreB = 100 * possScale + (baseStrengthB / 2) * possScale;
    const scoreA = baseScoreA + noiseA;
    const scoreB = baseScoreB + noiseB;
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

function averagePace(players: Player[]): number {
  if (!players.length) {
    return 0;
  }
  return players.reduce((sum, player) => sum + player.paceZ, 0) / players.length;
}

function countArchetype(players: Player[], archetype: Player["archetypes"][number]): number {
  return players.filter((player) => player.archetypes.includes(archetype)).length;
}

function countShooters(players: Player[]): number {
  return players.filter((player) =>
    player.archetypes.includes("Off-ball Shooter") ||
    player.archetypes.includes("Stretch Big") ||
    (Number.isFinite(player.threeP) && player.threeP >= 0.365 && player.threePA_rate >= 0.35)
  ).length;
}

function isInterior(player: Player): boolean {
  const pos = player.pos?.toUpperCase() ?? "";
  if (pos.includes("C")) return true;
  if (pos.includes("F")) return true;
  return player.archetypes.some((tag) =>
    tag === "Rim Runner" || tag === "Stretch Big" || tag === "Switch Big" || tag === "Rim Protector"
  );
}

function countInterior(players: Player[]): number {
  return players.filter((player) => isInterior(player)).length;
}

function countGuardCreators(players: Player[]): number {
  return players.filter((player) => {
    const pos = player.pos?.toUpperCase() ?? "";
    const isGuard = pos.includes("G");
    return isGuard && player.archetypes.includes("Creator");
  }).length;
}

function teamStrength(
  team: Player[],
  opponent: Player[],
  chemistryScore: number,
  matchupAdvantage: number,
  preset: EraPreset
): number {
  if (!team.length) {
    return 0;
  }

  const chemistryDelta = chemistryScore - 100;
  const impact = averageImpact(team) * 6;
  const pace = averagePace(team) * 4;
  const matchupBonus = matchupAdvantage * (2 + preset.handcheck * 0.25);

  const shooters = countShooters(team);
  const opponentShooters = countShooters(opponent);
  const spacingBonus = shooters * 4 * preset.threeFactor;
  const shooterDiffBonus = (shooters - opponentShooters) * 2.5 * preset.threeFactor;

  const interiorCount = countInterior(team);
  const postBonus = interiorCount * preset.postBoost;
  const orbBonus = interiorCount * Math.max(0, (preset.orb - 1) * 6);

  const poaStoppers = countArchetype(team, "POA Stopper");
  const guardCreators = countGuardCreators(team);
  const handcheckBonus = preset.handcheck * (poaStoppers * 1.5 - guardCreators);

  return (
    chemistryDelta +
    impact +
    pace +
    matchupBonus +
    spacingBonus +
    shooterDiffBonus +
    postBonus +
    orbBonus +
    handcheckBonus
  );
}
