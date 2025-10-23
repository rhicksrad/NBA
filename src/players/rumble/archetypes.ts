import type { Archetype, Player } from "./types";

export type ArchetypeOverrideMap = ReadonlyMap<string, readonly Archetype[]>;

const DEFAULT_ARCHETYPES: ReadonlyArray<Archetype> = [];

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function rateToPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, 0, 1) * 100;
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 1) {
    return clamp(value, 0, 100);
  }
  return clamp(value * 100, 0, 100);
}

function ensureArchetypeList(archetypes: readonly Archetype[] | undefined | null): Archetype[] {
  if (!archetypes) {
    return [];
  }
  return Array.from(new Set(archetypes));
}

function deriveFromStats(player: Player): Archetype[] {
  const tags = new Set<Archetype>();
  const threeRate = rateToPercent(player.threePA_rate);
  const threePct = normalizePercent(player.threeP);
  const usage = normalizePercent(player.usg);
  const playmaking = normalizePercent(player.astPct);
  const steals = normalizePercent(player.stl);
  const blocks = normalizePercent(player.blk);
  const pace = player.paceZ;
  const impact = player.impact;
  const position = player.pos?.toUpperCase() ?? "";

  if (playmaking >= 28 || (usage >= 28 && playmaking >= 18)) {
    tags.add("Creator");
  }

  if (!tags.has("Creator") && (playmaking >= 20 || usage >= 24)) {
    tags.add("Secondary");
  }

  if (threeRate >= 45 && threePct >= 36) {
    tags.add("Off-ball Shooter");
  } else if (threeRate >= 36 && threePct >= 34) {
    tags.add("Connector");
  }

  if ((position.includes("F") || position.includes("C")) && pace >= 0.2 && impact >= 5) {
    tags.add("Switch Big");
  }

  if ((position.includes("C") || position.includes("F")) && blocks >= 4) {
    tags.add("Rim Protector");
  }

  if ((position.includes("C") || position.includes("F")) && pace >= 0.3 && impact >= 3) {
    tags.add("Rim Runner");
  }

  if (threePct >= 35 && threeRate >= 30 && playmaking >= 12 && usage <= 24) {
    tags.add("Connector");
  }

  if (steals >= 3.2 && pace >= 0) {
    tags.add("POA Stopper");
  }

  if (impact >= 6 && playmaking >= 16 && usage <= 22) {
    tags.add("Connector");
  }

  if (tags.size === 0 && impact >= 8) {
    tags.add("Connector");
  }

  return Array.from(tags);
}

export function inferArchetypes(
  player: Player,
  overrides?: ArchetypeOverrideMap | Map<string, readonly Archetype[]> | Record<string, readonly Archetype[]>
): Archetype[] {
  const overrideEntry =
    overrides instanceof Map
      ? overrides.get(player.id)
      : overrides && typeof overrides === "object"
        ? (overrides as Record<string, readonly Archetype[]>)[player.id]
        : undefined;

  if (overrideEntry && overrideEntry.length) {
    return ensureArchetypeList(overrideEntry);
  }

  const provided = ensureArchetypeList(player.archetypes ?? DEFAULT_ARCHETYPES);
  if (provided.length) {
    return provided;
  }

  return deriveFromStats(player);
}
