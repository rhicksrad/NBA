import type {
  Archetype,
  ChemistryEdge,
  MatchupAdjustment,
  Player,
  TeamChemistry,
} from "./types";
import { ERA_PRESETS, type EraPreset, type EraStyle } from "./era";
import { inferArchetypes } from "./archetypes";

function hasArchetype(player: Player, target: Archetype): boolean {
  return player.archetypes.includes(target);
}

function ensureArchetypes(player: Player): void {
  if (!player.archetypes.length) {
    player.archetypes = inferArchetypes(player);
  }
}

function describeEdge(a: Player, b: Player, delta: number, reasons: string[]): ChemistryEdge | null {
  if (!Number.isFinite(delta) || delta === 0) {
    return null;
  }
  return {
    source: a.id,
    target: b.id,
    weight: delta,
    reasons,
  };
}

export function buildChemistry(players: Player[], eraStyle: EraStyle = "current"): TeamChemistry {
  const entries = players.filter(Boolean);
  entries.forEach(ensureArchetypes);

  const edges: ChemistryEdge[] = [];
  let scoreDelta = 0;
  const reasonAccumulator = new Map<string, number>();
  const preset = ERA_PRESETS[eraStyle];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      let delta = 0;
      const reasons: string[] = [];

      const paceGap = Math.abs(a.paceZ - b.paceZ);
      if (paceGap < 0.5) {
        delta += 2;
        reasons.push("pace fit");
      }

      const creatorShooter =
        (hasArchetype(a, "Creator") || hasArchetype(a, "Secondary")) &&
        (hasArchetype(b, "Off-ball Shooter") || hasArchetype(b, "Stretch Big"));
      const shooterCreator =
        (hasArchetype(b, "Creator") || hasArchetype(b, "Secondary")) &&
        (hasArchetype(a, "Off-ball Shooter") || hasArchetype(a, "Stretch Big"));
      if (creatorShooter || shooterCreator) {
        delta += 3 * preset.threeFactor;
        reasons.push("creator → shooter");
      }

      if (a.threePA_rate > 0.5 && b.threePA_rate > 0.5) {
        delta += 2 * preset.spacingBonus;
        reasons.push("spacing stack");
      }

      if (a.usg > 28 && b.usg > 28 && a.astPct < 18 && b.astPct < 18) {
        delta -= 5;
        reasons.push("usage redundancy");
      }

      const defensiveGap =
        !hasArchetype(a, "POA Stopper") &&
        !hasArchetype(a, "Rim Protector") &&
        !hasArchetype(b, "POA Stopper") &&
        !hasArchetype(b, "Rim Protector");
      if (defensiveGap) {
        delta -= 6;
        reasons.push("defensive gaps");
      }

      if (delta !== 0) {
        scoreDelta += delta;
        reasons.forEach((reason) => {
          const weight = reasonAccumulator.get(reason) ?? 0;
          reasonAccumulator.set(reason, weight + delta);
        });
        const edge = describeEdge(a, b, delta, reasons);
        if (edge) {
          edges.push(edge);
        }
      }
    }
  }

  const baseScore = Math.max(0, 100 + scoreDelta);
  const sortedReasons = Array.from(reasonAccumulator.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 6)
    .map(([reason, weight]) => `${reason} (${weight > 0 ? "+" : ""}${weight.toFixed(1)})`);

  return {
    score: baseScore,
    edges,
    reasons: sortedReasons,
  };
}

interface SlotComparison {
  advantage: number;
  reasons: string[];
}

function compareSlot(attacker: Player, defender: Player, preset: EraPreset): SlotComparison {
  ensureArchetypes(attacker);
  ensureArchetypes(defender);

  let advantage = 0;
  const reasons: string[] = [];

  if (hasArchetype(attacker, "POA Stopper") && hasArchetype(defender, "Creator")) {
    advantage += 3 + preset.handcheck;
    reasons.push("POA vs Creator");
  }

  if (hasArchetype(attacker, "Rim Protector") && hasArchetype(defender, "Rim Runner")) {
    advantage += 2 + preset.postBoost * 0.3;
    reasons.push("Rim protection");
  }

  if (hasArchetype(attacker, "Off-ball Shooter") && !hasArchetype(defender, "Switch Big")) {
    advantage += 2 * preset.threeFactor;
    reasons.push("Spacing advantage");
  }

  return { advantage, reasons };
}

export function evaluateMatchup(teamA: Player[], teamB: Player[], eraStyle: EraStyle = "current"): MatchupAdjustment {
  const limit = Math.min(teamA.length, teamB.length);
  let advantageA = 0;
  let advantageB = 0;
  const reasonsA: string[] = [];
  const reasonsB: string[] = [];
  const preset = ERA_PRESETS[eraStyle];

  for (let i = 0; i < limit; i += 1) {
    const playerA = teamA[i];
    const playerB = teamB[i];
    if (!playerA || !playerB) {
      // ignore empty slots
      continue;
    }
    const forward = compareSlot(playerA, playerB, preset);
    if (forward.advantage !== 0) {
      advantageA += forward.advantage;
      reasonsA.push(`${playerA.name}: ${forward.reasons.join(", ")}`);
    }
    const reverse = compareSlot(playerB, playerA, preset);
    if (reverse.advantage !== 0) {
      advantageB += reverse.advantage;
      reasonsB.push(`${playerB.name}: ${reverse.reasons.join(", ")}`);
    }
  }

  return {
    advantageA,
    advantageB,
    reasonsA,
    reasonsB,
  };
}
