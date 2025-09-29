export const BREF_MAP: Record<string, string> = {
  ATL: "ATL",
  BOS: "BOS",
  BKN: "BRK",
  BRK: "BRK", // Nets
  CHA: "CHO",
  CHO: "CHO", // Hornets
  CHI: "CHI",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  GSW: "GSW",
  HOU: "HOU",
  IND: "IND",
  LAC: "LAC",
  LAL: "LAL",
  MEM: "MEM",
  MIA: "MIA",
  MIL: "MIL",
  MIN: "MIN",
  NOP: "NOP",
  NYK: "NYK",
  OKC: "OKC",
  ORL: "ORL",
  PHI: "PHI",
  PHX: "PHO",
  PHO: "PHO", // Suns
  POR: "POR",
  SAC: "SAC",
  SAS: "SAS",
  TOR: "TOR",
  UTA: "UTA",
  WAS: "WAS",
} as const;

export function brefTeam(abbr: string): string {
  const k = abbr.toUpperCase();
  const m = BREF_MAP[k];
  if (!m) throw new Error(`Unknown team abbr for Basketball-Reference: ${abbr}`);
  return m;
}

export async function fetchBref(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "nba-previews-bot/1.0 (+https://github.com/rhicksrad/NBA)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (res.status >= 500 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 400 * attempt));
    return fetchBref(url, attempt + 1);
  }
  return res;
}
