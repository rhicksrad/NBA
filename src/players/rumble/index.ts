import { inferArchetypes } from "./archetypes";
import { decodeMatchup, readHash } from "./state";
import type { Player } from "./types";
import { createRumbleExperience, type RumbleExperience } from "./ui";

interface RawProfile {
  id?: string | number;
  personId?: string | number;
  name: string;
  era?: string | null;
  position?: string | null;
  team?: string | null;
  teamAbbr?: string | null;
  archetype?: string | null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function seededRange(hash: number, min: number, max: number): number {
  const fraction = hash / 0xffffffff;
  return min + (max - min) * fraction;
}

function parseArchetype(label: string | null | undefined): string[] {
  if (!label) {
    return [];
  }
  const normalized = label.toLowerCase();
  const tags: string[] = [];
  if (normalized.includes("creator")) tags.push("Creator");
  if (normalized.includes("shooter")) tags.push("Off-ball Shooter");
  if (normalized.includes("rim")) tags.push("Rim Runner");
  if (normalized.includes("switch")) tags.push("Switch Big");
  if (normalized.includes("protector")) tags.push("Rim Protector");
  if (normalized.includes("connector") || normalized.includes("glue")) tags.push("Connector");
  if (normalized.includes("secondary")) tags.push("Secondary");
  if (normalized.includes("stopper")) tags.push("POA Stopper");
  if (normalized.includes("stretch")) tags.push("Stretch Big");
  return tags;
}

function enrichProfile(profile: RawProfile): Player {
  const id = String(profile.personId ?? profile.id ?? profile.name);
  const name = profile.name || id;
  const seedBase = `${id}:${name}`;
  const baseHash = hashString(seedBase);
  const player: Player = {
    id,
    name,
    era: profile.era ?? null,
    pos: profile.position ?? null,
    franchise: profile.teamAbbr ?? profile.team ?? null,
    threeP: seededRange(hashString(`${seedBase}:3P`), 0.26, 0.45),
    threePA_rate: seededRange(hashString(`${seedBase}:3PA`), 0.18, 0.65),
    astPct: seededRange(hashString(`${seedBase}:AST`), 0.08, 0.42),
    usg: seededRange(hashString(`${seedBase}:USG`), 0.16, 0.36),
    stl: seededRange(hashString(`${seedBase}:STL`), 0.01, 0.045),
    blk: seededRange(hashString(`${seedBase}:BLK`), 0.005, 0.045),
    paceZ: seededRange(hashString(`${seedBase}:PACE`), -1, 1),
    impact: seededRange(baseHash, 2, 12),
    archetypes: parseArchetype(profile.archetype).map((tag) => tag as Player["archetypes"][number]),
  };

  if (!player.archetypes.length) {
    player.archetypes = inferArchetypes(player);
  }

  return player;
}

async function fetchProfiles(): Promise<Player[]> {
  const response = await fetch(new URL("data/player_profiles.json", document.baseURI));
  if (!response.ok) {
    throw new Error(`Failed to load player profiles: ${response.status}`);
  }
  const json = await response.json();
  const players = Array.isArray(json?.players) ? json.players : [];
  return players.map((profile: RawProfile) => enrichProfile(profile));
}

const DEFAULT_PRESETS: Record<string, string[]> = {
  "96Bulls": ["michael-jordan", "scottie-pippen", "dennis-rodman", "ron-harper", "steve-kerr"],
  "17Warriors": ["stephen-curry", "kevin-durant", "klay-thompson", "draymond-green", "andre-iguodala"],
};

type SetupOptions = {
  trigger?: HTMLElement;
  root: HTMLElement;
};

export async function mountRosterRumble({ trigger, root }: SetupOptions): Promise<RumbleExperience> {
  const initialState = readHash();
  const experience = await createRumbleExperience({
    root,
    getPlayerPool: fetchProfiles,
    presets: DEFAULT_PRESETS,
  });

  if (initialState) {
    experience.open(initialState);
  }

  if (trigger) {
    trigger.addEventListener("click", () => {
      experience.open();
    });
  }

  return experience;
}

export { decodeMatchup, readHash };
export type { Player };
