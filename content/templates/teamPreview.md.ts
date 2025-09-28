import { LeagueContext, TeamRecord } from "../../scripts/lib/types.js";

export interface TeamPreviewContent {
  heading: string;
  introParagraphs: string[];
  coreStrength: string;
  primaryRisk: string;
  swingFactor: string;
  seasonLabel: string;
}

const RISK_WORDS: Record<"low" | "medium" | "high", string> = {
  low: "low",
  medium: "medium",
  high: "elevated",
};

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function summarizeAdditions(team: TeamRecord): string {
  const rosterNames = new Set(team.roster.map((player) => player.name));
  const additions = team.keyAdditions.filter((name) => rosterNames.has(name));
  if (additions.length === 0) {
    return "The front office kept the core intact and will lean on internal development.";
  }
  return `${formatList(additions)} ${additions.length === 1 ? "is" : "are"} the headline addition${
    additions.length === 1 ? "" : "s"
  }, giving the staff new lineup flexibility.`;
}

function summarizeLosses(team: TeamRecord): string {
  if (team.keyLosses.length === 0) {
    return "No rotation regulars departed, so continuity remains a strength.";
  }
  if (team.keyLosses.length === 1) {
    return "One rotation regular left town, so minutes will be redistributed to younger depth.";
  }
  if (team.keyLosses.length <= 3) {
    return "A few trusted pieces exited, pushing the coaching staff to re-balance the rotation.";
  }
  return "Significant outgoing volume forces a full-on evaluation of the bench ecosystem.";
}

function coreStrength(team: TeamRecord): string {
  const srs = team.lastSeasonSRS ?? 0;
  if (srs > 4) {
    return "A top-tier efficiency profile remains the foundation; expect pace-and-space to set the tone.";
  }
  if (srs > 1) {
    return "Solid metrics and a dependable defensive spine give this group a high nightly floor.";
  }
  if (srs > -1) {
    return "The roster projects as league-average, but familiarity and defined roles should keep things steady.";
  }
  return "This is a developmental year, so cohesion and player growth drive the optimism.";
}

function primaryRisk(team: TeamRecord, ctx: LeagueContext): string {
  const injuries = ctx.injuries.filter((injury) => {
    const rosterNames = new Set(team.roster.map((player) => player.name));
    return rosterNames.has(injury.playerName);
  });
  if (injuries.length > 0) {
    const severity = injuries.some((injury) => injury.severity === "high")
      ? "high"
      : injuries.some((injury) => injury.severity === "medium")
      ? "medium"
      : "low";
    return `Health is the loudest question mark with a ${RISK_WORDS[severity]}-grade injury stack to monitor.`;
  }
  if (team.keyAdditions.length > 4) {
    return "Integrating so many new faces could scramble the defensive communication early.";
  }
  if (team.keyLosses.length > team.keyAdditions.length + 2) {
    return "Replacing outgoing production without proven scorers is the immediate hurdle.";
  }
  return "The margin for error is slim if the shooting variance swings the wrong way.";
}

function swingFactor(team: TeamRecord): string {
  const roster = team.roster;
  if (roster.length === 0) {
    return "Training camp is about establishing a rotation hierarchy from scratch.";
  }
  const youngGuard = roster.find((player) => player.position?.includes("G"));
  if (youngGuard) {
    return `${youngGuard.name}'s lead guard reps will determine how dynamic the offense looks.`;
  }
  const wing = roster.find((player) => player.position?.includes("F"));
  if (wing) {
    return `${wing.name} unlocking downhill force on the wing is the X-factor.`;
  }
  return `${roster[0].name} maintaining two-way consistency is the swing skill.`;
}

function corePlayers(team: TeamRecord): string {
  const core = team.roster.slice(0, 3).map((player) => player.name);
  if (core.length === 0) {
    return "The roster is still being finalized around training-camp invites.";
  }
  return `The core trio of ${formatList(core)} gives the staff a clear identity to start from.`;
}

export function buildTeamPreviewContent(team: TeamRecord, ctx: LeagueContext): TeamPreviewContent {
  return {
    heading: `${team.market} ${team.name}`,
    introParagraphs: [corePlayers(team), summarizeAdditions(team), summarizeLosses(team)],
    coreStrength: coreStrength(team),
    primaryRisk: primaryRisk(team, ctx),
    swingFactor: swingFactor(team),
    seasonLabel: ctx.season,
  };
}

export function renderTeamPreview(team: TeamRecord, ctx: LeagueContext): string {
  const content = buildTeamPreviewContent(team, ctx);
  const lines: string[] = [];
  lines.push(`# ${content.heading}`);
  lines.push("");
  lines.push(...content.introParagraphs);
  lines.push("");
  lines.push(`**Core strength:** ${content.coreStrength}`);
  lines.push(`**Primary risk:** ${content.primaryRisk}`);
  lines.push(`**Swing factor:** ${content.swingFactor}`);
  lines.push("");
  lines.push(`_Season: ${content.seasonLabel}_`);
  return lines.join("\n");
}
