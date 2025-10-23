export const ERA_STYLE_VALUES = ["current", "nineties", "pre3", "oldschool"] as const;

export type EraStyle = (typeof ERA_STYLE_VALUES)[number];

export type EraPreset = {
  poss: number;
  threeFactor: number;
  spacingBonus: number;
  postBoost: number;
  handcheck: number;
  orb: number;
  variance: number;
};

export const ERA_PRESETS: Record<EraStyle, EraPreset> = {
  current: {
    poss: 100,
    threeFactor: 1.0,
    spacingBonus: 1.0,
    postBoost: 0,
    handcheck: 0,
    orb: 1.0,
    variance: 1.0,
  },
  nineties: {
    poss: 88,
    threeFactor: 0.7,
    spacingBonus: 0.8,
    postBoost: 3,
    handcheck: 2,
    orb: 1.1,
    variance: 1.05,
  },
  pre3: {
    poss: 96,
    threeFactor: 0.0,
    spacingBonus: 0.3,
    postBoost: 4,
    handcheck: 1,
    orb: 1.15,
    variance: 1.1,
  },
  oldschool: {
    poss: 70,
    threeFactor: 0.0,
    spacingBonus: 0.0,
    postBoost: 5,
    handcheck: 3,
    orb: 1.2,
    variance: 1.2,
  },
};

export function isEraStyle(value: unknown): value is EraStyle {
  return typeof value === "string" && (ERA_STYLE_VALUES as readonly string[]).includes(value);
}
