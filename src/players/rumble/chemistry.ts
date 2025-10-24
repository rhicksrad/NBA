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

function isPlaymaker(player: Player): boolean {
  return (
    hasArchetype(player, "Creator") ||
    hasArchetype(player, "Secondary") ||
    player.astPct >= 22
  );
}

function isConnector(player: Player): boolean {
  return hasArchetype(player, "Connector") || player.astPct >= 16 || player.impact >= 8;
}

function hasSpacingThreat(player: Player): boolean {
  return (
    hasArchetype(player, "Off-ball Shooter") ||
    hasArchetype(player, "Stretch Big") ||
    (Number.isFinite(player.threeP) && player.threeP >= 0.365 && player.threePA_rate >= 0.3)
  );
}

function isInteriorAnchor(player: Player): boolean {
  return (
    hasArchetype(player, "Rim Runner") ||
    hasArchetype(player, "Stretch Big") ||
    hasArchetype(player, "Switch Big") ||
    hasArchetype(player, "Rim Protector")
  );
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

      const playmakerA = isPlaymaker(a);
      const playmakerB = isPlaymaker(b);
      const connectorA = isConnector(a);
      const connectorB = isConnector(b);
      const interiorA = isInteriorAnchor(a);
      const interiorB = isInteriorAnchor(b);
      const spacingA = hasSpacingThreat(a);
      const spacingB = hasSpacingThreat(b);
      const poaA = hasArchetype(a, "POA Stopper");
      const poaB = hasArchetype(b, "POA Stopper");
      const rimAnchorA = hasArchetype(a, "Rim Protector") || hasArchetype(a, "Switch Big");
      const rimAnchorB = hasArchetype(b, "Rim Protector") || hasArchetype(b, "Switch Big");

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

      if ((interiorA && playmakerB) || (interiorB && playmakerA)) {
        delta += 2 + preset.postBoost * 0.6;
        reasons.push("inside-out game");
      }

      const hiLoEligible = preset.postBoost >= 2 && interiorA && interiorB && (connectorA || connectorB || spacingA || spacingB);
      if (hiLoEligible) {
        delta += 1 + preset.postBoost * 0.5;
        reasons.push("hi-lo threats");
      }

      if (
        (connectorA && (playmakerB || interiorB || spacingB)) ||
        (connectorB && (playmakerA || interiorA || spacingA))
      ) {
        delta += 1.8 + preset.spacingBonus * 1.2 + preset.postBoost * 0.1;
        reasons.push("connector boost");
      }

      if ((poaA && rimAnchorB) || (poaB && rimAnchorA)) {
        delta += 1.5 + preset.handcheck * 0.75;
        reasons.push("defensive spine");
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
