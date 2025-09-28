import { InjuryRecord, PlayerRecord, RankedTeam, TeamRecord } from "../lib/types.js";

export interface RankContext {
  teams: TeamRecord[];
  players: PlayerRecord[];
  injuries: InjuryRecord[];
}

const WEIGHTS = Object.freeze({
  srs: 0.35,
  wins: 0.25,
  continuity: 0.15,
  star: 0.1,
  coach: 0.08,
  injury: 0.07,
});

const CLAMP = (value: number) => Math.max(0, Math.min(1, value));

export function rankTeams(context: RankContext): RankedTeam[] {
  const scores = context.teams.map((team) => {
    const metrics = computeMetrics(team, context);
    const score =
      WEIGHTS.srs * metrics.srs +
      WEIGHTS.wins * metrics.wins +
      WEIGHTS.continuity * metrics.continuity +
      WEIGHTS.star * metrics.star +
      WEIGHTS.coach * metrics.coach +
      WEIGHTS.injury * metrics.injury;
    return {
      tricode: team.tricode,
      score,
      metrics,
      team,
    };
  });

  scores.sort((a, b) => b.score - a.score || a.tricode.localeCompare(b.tricode));

  return scores.map((entry, index) => ({
    tricode: entry.tricode,
    score: Number(entry.score.toFixed(6)),
    rank: index + 1,
    statusLine: buildStatusLine(entry.team, entry.metrics, scores.map((item) => item.score)),
  }));
}

interface Metrics {
  srs: number;
  wins: number;
  continuity: number;
  star: number;
  coach: number;
  injury: number;
  injuryCount: number;
  additionPositions: string[];
}

function computeMetrics(team: TeamRecord, context: RankContext): Metrics {
  const srs = CLAMP(((team.lastSeasonSRS ?? 0) + 10) / 20);
  const wins = CLAMP((team.lastSeasonWins ?? 0) / 65);
  const returning = Math.max(team.roster.length - team.keyAdditions.length, 0);
  const continuity = team.roster.length === 0 ? 0.4 : CLAMP(returning / Math.max(team.roster.length, 1));
  const star = computeStarAvailability(team, context.players);
  const coach = team.coach?.isNew ? 0.55 : team.coach ? 0.85 : 0.5;
  const injuryInfo = computeInjuryPenalty(team, context.injuries);
  const additionPositions = team.keyAdditions
    .map((name) => team.roster.find((player) => player.name === name)?.position ?? "")
    .filter(Boolean);
  return {
    srs,
    wins,
    continuity,
    star,
    coach,
    injury: 1 - injuryInfo.penalty,
    injuryCount: injuryInfo.count,
    additionPositions,
  };
}

function computeStarAvailability(team: TeamRecord, players: PlayerRecord[]): number {
  const rosterNames = new Set(team.roster.map((player) => player.name));
  const stars = players.filter((player) => rosterNames.has(player.name) && isStarProfile(player));
  if (stars.length === 0) {
    return 0.35;
  }
  if (stars.length === 1) {
    return 0.65;
  }
  if (stars.length === 2) {
    return 0.8;
  }
  return 0.95;
}

function isStarProfile(player: PlayerRecord): boolean {
  if (player.status && player.status.toLowerCase().includes("two-way")) {
    return false;
  }
  if (!player.position) {
    return false;
  }
  return /G|F|C/.test(player.position) && !!player.name;
}

function computeInjuryPenalty(team: TeamRecord, injuries: InjuryRecord[]): {
  penalty: number;
  count: number;
} {
  const rosterNames = new Set(team.roster.map((player) => player.name));
  const relevant = injuries.filter((injury) => rosterNames.has(injury.playerName));
  const penalty = relevant.reduce((acc, injury) => {
    if (injury.severity === "high") return acc + 0.3;
    if (injury.severity === "medium") return acc + 0.2;
    return acc + 0.1;
  }, 0);
  const clampedPenalty = Math.min(0.9, penalty);
  return { penalty: clampedPenalty, count: relevant.length };
}

function buildStatusLine(team: TeamRecord, metrics: Metrics, scores: number[]): string {
  const median = scores[Math.floor(scores.length / 2)] ?? 0.5;
  const trend = metrics.srs + metrics.wins > 1.4
    ? "Uptrend"
    : team.lastSeasonSRS && team.lastSeasonSRS < -2
    ? "Rebuild"
    : metrics.srs + metrics.wins > median
    ? "Holding"
    : "Downtrend";
  const coachNote = team.coach?.isNew ? "New coach" : "Staff intact";
  const additionNote = describeAdditions(metrics.additionPositions);
  const injuryRisk = describeInjuryRisk(metrics.injuryCount);
  return `${trend} | ${coachNote} | ${additionNote} | Health risk: ${injuryRisk}`;
}

function describeAdditions(positions: string[]): string {
  if (positions.length === 0) {
    return "Banking on internal growth";
  }
  const counts = positions.reduce<Record<string, number>>((acc, pos) => {
    const bucket = pos.startsWith("C") ? "rim protection" : pos.startsWith("F") ? "switchable wings" : "ball handling";
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
  const [[label]] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return `Added ${label}`;
}

function describeInjuryRisk(count: number): string {
  if (count === 0) return "low";
  if (count === 1) return "medium";
  return "high";
}
