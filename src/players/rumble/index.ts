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

interface GoatRecord {
  personId?: string | number;
  name?: string;
  careerSpan?: string | null;
  primeWindow?: string | null;
  franchises?: string[];
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

function deriveEra(span: string | null | undefined): string | null {
  if (!span) {
    return null;
  }
  const matches = span.match(/\d{4}/g);
  if (!matches || !matches.length) {
    return null;
  }
  const start = Number.parseInt(matches[0], 10);
  const end = Number.parseInt(matches[matches.length - 1], 10);
  if (!Number.isFinite(start)) {
    return null;
  }
  const startDecade = Math.floor(start / 10) * 10;
  const endDecade = Number.isFinite(end) ? Math.floor(end / 10) * 10 : startDecade;
  if (startDecade === endDecade) {
    return `${startDecade}s`;
  }
  return `${startDecade}s–${endDecade}s`;
}

function createProfileKey(profile: Pick<RawProfile, "personId" | "id" | "name">): string {
  if (profile.personId !== undefined && profile.personId !== null) {
    return String(profile.personId);
  }
  if (profile.id !== undefined && profile.id !== null) {
    return String(profile.id);
  }
  return profile.name.toLowerCase();
}

function enrichFromGoat(record: GoatRecord): RawProfile | null {
  if (!record || !record.name) {
    return null;
  }
  const franchises = Array.isArray(record.franchises) ? record.franchises : [];
  return {
    id: record.personId ?? record.name,
    personId: record.personId,
    name: record.name,
    era: deriveEra(record.primeWindow ?? record.careerSpan ?? null),
    team: franchises.length ? franchises[0] ?? null : null,
    teamAbbr: franchises.length ? franchises[0] ?? null : null,
    position: null,
    archetype: null,
  };
}

async function fetchProfiles(): Promise<Player[]> {
  const [profilesResponse, goatResponse] = await Promise.all([
    fetch(new URL("data/player_profiles.json", document.baseURI)),
    fetch(new URL("data/goat_system.json", document.baseURI)).catch(() => null),
  ]);

  if (!profilesResponse.ok) {
    throw new Error(`Failed to load player profiles: ${profilesResponse.status}`);
  }

  const json = await profilesResponse.json();
  const playerRecords = new Map<string, RawProfile>();

  const pushProfile = (profile: RawProfile | null | undefined) => {
    if (!profile || !profile.name) {
      return;
    }
    const key = createProfileKey(profile);
    if (playerRecords.has(key)) {
      const existing = playerRecords.get(key)!;
      if ((!existing.era || existing.era === "") && profile.era) {
        existing.era = profile.era;
      }
      if ((!existing.team || existing.team === "") && profile.team) {
        existing.team = profile.team;
      }
      if ((!existing.teamAbbr || existing.teamAbbr === "") && profile.teamAbbr) {
        existing.teamAbbr = profile.teamAbbr;
      }
      if ((!existing.position || existing.position === "") && profile.position) {
        existing.position = profile.position;
      }
      if ((!existing.archetype || existing.archetype === "") && profile.archetype) {
        existing.archetype = profile.archetype;
      }
      return;
    }
    playerRecords.set(key, { ...profile });
  };

  const profiles = Array.isArray(json?.players) ? json.players : [];
  profiles.forEach((profile: RawProfile) => pushProfile(profile));

  if (goatResponse && goatResponse.ok) {
    try {
      const goatJson = await goatResponse.json();
      const goatPlayers = Array.isArray(goatJson?.players) ? goatJson.players : [];
      goatPlayers.forEach((record: GoatRecord) => {
        const enriched = enrichFromGoat(record);
        if (enriched) {
          pushProfile(enriched);
        }
      });
    } catch (goatError) {
      console.warn("Unable to load GOAT system player pool", goatError);
    }
  }

  const merged = Array.from(playerRecords.values()).map((profile) => enrichProfile(profile));
  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

const DEFAULT_PRESETS: Record<string, string[]> = {
  "96Bulls": ["michael-jordan", "scottie-pippen", "dennis-rodman", "ron-harper", "steve-kerr"],
  "17Warriors": ["stephen-curry", "kevin-durant", "klay-thompson", "draymond-green", "andre-iguodala"],
};

type SetupOptions = {
  trigger?: HTMLElement;
  root: HTMLElement;
  mode?: "overlay" | "inline";
};

export async function mountRosterRumble({ trigger, root, mode = "overlay" }: SetupOptions): Promise<RumbleExperience> {
  const initialState = readHash();
  const experience = await createRumbleExperience({
    root,
    getPlayerPool: fetchProfiles,
    presets: DEFAULT_PRESETS,
    mode,
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
