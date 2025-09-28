"""Generate player atlas profiles for active NBA players."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ACTIVE_ROSTER = ROOT / "data" / "active_players.json"
DEFAULT_PLAYERS_CSV = ROOT / "Players.csv"
DEFAULT_TEAM_HISTORIES = ROOT / "TeamHistories.csv"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "player_profiles.json"
DEFAULT_GOAT_SYSTEM = ROOT / "public" / "data" / "goat_system.json"
DEFAULT_BIRTHPLACE_FILES = [
    ROOT / "data" / "nba_birthplaces.csv",
    ROOT / "data" / "nba_draft_birthplaces.csv",
]

METRICS_CATALOG = [
    {
        "id": "offensive-creation",
        "label": "Offensive Creation",
        "description": "Self-creation volume and efficiency per 75 possessions.",
    },
    {
        "id": "half-court-shotmaking",
        "label": "Half-Court Shotmaking",
        "description": "Difficulty-adjusted shot quality and accuracy in half-court sets.",
    },
    {
        "id": "passing-vision",
        "label": "Passing Vision",
        "description": "High-value assists, skip reads, and delivery creativity.",
    },
    {
        "id": "rim-pressure",
        "label": "Rim Pressure",
        "description": "Drives and paint touches turning into rim attempts and fouls.",
    },
    {
        "id": "rebound-dominance",
        "label": "Rebound Dominance",
        "description": "Share of available rebounds secured across both ends.",
    },
    {
        "id": "defensive-playmaking",
        "label": "Defensive Playmaking",
        "description": "Stocks (steals + blocks) and deflection activity that swing possessions.",
    },
    {
        "id": "post-efficiency",
        "label": "Post Efficiency",
        "description": "Post-up scoring efficiency blended with playmaking kick-outs.",
    },
    {
        "id": "stretch-gravity",
        "label": "Stretch Gravity",
        "description": "Perimeter gravity measured by defender distance and 3-point volume.",
    },
    {
        "id": "tempo-control",
        "label": "Tempo Control",
        "description": "Pace orchestration, transition effectiveness, and flow control.",
    },
    {
        "id": "clutch-index",
        "label": "Clutch Index",
        "description": "Two-way impact during the final five minutes of close games.",
    },
    {
        "id": "durability-index",
        "label": "Durability Index",
        "description": "Availability and workload sustained over the last three seasons.",
    },
    {
        "id": "processing-speed",
        "label": "Processing Speed",
        "description": "Decision-making speed versus complex defensive coverages.",
    },
]

POSITION_NAMES = {"G": "guard", "F": "forward", "C": "center"}


@dataclass
class ActivePlayer:
    person_id: str
    first_name: str
    last_name: str
    team_id: str

    @property
    def full_name(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.first_name or self.person_id


@dataclass
class RosterRow:
    person_id: str
    payload: dict[str, Any]


def _slugify(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    lowered = stripped.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def _parse_float(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(result):
        return None
    return result


def _parse_int(value: Any) -> int | None:
    number = _parse_float(value)
    if number is None:
        return None
    return int(round(number))


def _format_height(raw: Any) -> str | None:
    inches = _parse_float(raw)
    if inches is None or inches <= 0:
        return None
    total = int(round(inches))
    feet, remainder = divmod(total, 12)
    return f"{feet}'{remainder}\""


def _format_weight(raw: Any) -> str | None:
    pounds = _parse_float(raw)
    if pounds is None or pounds < 100:
        return None
    return f"{int(round(pounds))} lbs"


def _normalize_name_key(value: str) -> str:
    slug = _slugify(value)
    return slug.replace("-", " ") if slug else value.lower()


def _format_birthdate(raw: str | None, location: str | None) -> str | None:
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None
    formatted = f"{dt.strftime('%B')} {dt.day}, {dt.year}"
    if location:
        return f"{formatted} · {location}"
    return formatted


def _format_draft(payload: dict[str, Any]) -> str | None:
    year = _parse_int(payload.get("draftYear"))
    if not year:
        return None
    pick = _parse_int(payload.get("draftNumber"))
    round_number = _parse_int(payload.get("draftRound"))
    def _ordinal(value: int) -> str:
        if 10 <= value % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
        return f"{value}{suffix}"
    if pick and round_number:
        return f"{year} · Pick {pick} ({_ordinal(round_number)} round)"
    if pick:
        return f"{year} · Pick {pick}"
    return f"{year} NBA Draft"


def _determine_era(roster_payload: dict[str, Any]) -> str:
    draft_year = _parse_int(roster_payload.get("draftYear"))
    if draft_year:
        decade = (draft_year // 10) * 10
        return f"{decade}s"
    return "2020s"


def _position_codes(roster_payload: dict[str, Any]) -> list[str]:
    codes: list[str] = []
    if str(roster_payload.get("guard")).lower() == "true":
        codes.append("G")
    if str(roster_payload.get("forward")).lower() == "true":
        codes.append("F")
    if str(roster_payload.get("center")).lower() == "true":
        codes.append("C")
    return codes


def _role_phrase(codes: list[str]) -> str:
    words = [POSITION_NAMES.get(code, "player") for code in codes]
    unique_words = []
    for word in words:
        if word not in unique_words:
            unique_words.append(word)
    if not unique_words:
        return "multi-skilled player"
    if len(unique_words) == 1:
        return unique_words[0]
    if len(unique_words) == 2:
        return f"{unique_words[0]}-{unique_words[1]}"
    return "versatile player"


def _archetype_from_positions(codes: list[str]) -> str:
    words = [POSITION_NAMES.get(code, "player") for code in codes]
    unique_words = []
    for word in words:
        if word not in unique_words:
            unique_words.append(word)
    if not unique_words:
        return "Versatile playmaker"
    if len(unique_words) == 1:
        return f"Modern {unique_words[0]}"
    if len(unique_words) == 2:
        return f"Hybrid {unique_words[0]}-{unique_words[1]}"
    return "Two-way cornerstone"


def _build_bio(
    name: str,
    first_name: str,
    team_name: str,
    role_phrase: str,
    hometown: str | None,
    draft_text: str | None,
) -> str:
    sentences: list[str] = []
    if team_name.lower() == "free agent":
        sentences.append(f"{name} is a {role_phrase} currently available in free agency.")
    else:
        sentences.append(f"{name} is a {role_phrase} for the {team_name}.")
    if hometown:
        sentences.append(f"They hail from {hometown}.")
    if draft_text:
        sentences.append(f"{first_name} entered the league in the {draft_text.split(' · ')[0]} NBA Draft.")
    else:
        sentences.append(f"Draft details for {first_name} are currently unavailable.")
    return " ".join(sentences)


def _build_keywords(
    player: ActivePlayer,
    team_meta: dict[str, str],
    codes: list[str],
    hometown: str | None,
) -> list[str]:
    keywords: set[str] = set()
    for value in [player.first_name, player.last_name, player.full_name, player.person_id]:
        if value:
            keywords.update(value.lower().split())
    for code in codes:
        keywords.add(code.lower())
        position_word = POSITION_NAMES.get(code)
        if position_word:
            keywords.add(position_word)
    if hometown:
        keywords.update(part.strip().lower() for part in re.split(r"[,/]+", hometown) if part.strip())
    if team_meta.get("full"):
        keywords.update(team_meta["full"].lower().split())
    if team_meta.get("nickname"):
        keywords.update(team_meta["nickname"].lower().split())
    if team_meta.get("city"):
        keywords.update(team_meta["city"].lower().split())
    if team_meta.get("full", "").lower() == "free agent":
        keywords.update({"free", "agent", "free agent"})
    return sorted(keywords)


def _load_active_players(path: Path) -> list[ActivePlayer]:
    data = json.loads(path.read_text(encoding="utf-8"))
    players: list[ActivePlayer] = []
    for entry in data:
        person_id = str(entry.get("playerId"))
        first_name = str(entry.get("firstName") or "").strip()
        last_name = str(entry.get("lastName") or "").strip()
        team_id = str(entry.get("teamId") or "0")
        players.append(ActivePlayer(person_id=person_id, first_name=first_name, last_name=last_name, team_id=team_id))
    return players


def _load_roster(path: Path) -> dict[str, RosterRow]:
    roster: dict[str, RosterRow] = {}
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            person_id = row.get("personId")
            if not person_id:
                continue
            roster[person_id] = RosterRow(person_id=person_id, payload=row)
    return roster


def _load_team_lookup(path: Path) -> dict[str, dict[str, str]]:
    lookup: dict[str, tuple[int, dict[str, str]]] = {}
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            if (row.get("seasonActiveTill") or "") != "2100":
                continue
            team_id = row.get("teamId")
            if not team_id:
                continue
            try:
                season = int(row.get("seasonFounded") or 0)
            except ValueError:
                season = 0
            full = " ".join(part for part in [row.get("teamCity"), row.get("teamName")] if part).strip() or "Free Agent"
            payload = {
                "full": full,
                "city": (row.get("teamCity") or "").strip(),
                "nickname": (row.get("teamName") or "").strip(),
            }
            if team_id not in lookup or season >= lookup[team_id][0]:
                lookup[team_id] = (season, payload)
    lookup["0"] = (0, {"full": "Free Agent", "city": "", "nickname": ""})
    return {team_id: payload for team_id, (season, payload) in lookup.items()}


def _load_birthplaces(paths: list[Path]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for path in paths:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                player_name = (row.get("player") or "").strip()
                birthplace = (row.get("birthplace") or "").strip()
                if not player_name or not birthplace:
                    continue
                key = _normalize_name_key(player_name)
                mapping.setdefault(key, birthplace)
    return mapping


def _load_goat_scores(path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Build lookup tables for GOAT system data keyed by personId and normalized name."""

    if not path.exists():
        return {}, {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}, {}

    players = data.get("players")
    if not isinstance(players, list):
        return {}, {}

    by_id: dict[str, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}
    for entry in players:
        if not isinstance(entry, dict):
            continue

        person_id_raw = entry.get("personId")
        person_id = str(person_id_raw).strip() if person_id_raw is not None else ""
        name = (entry.get("name") or "").strip()
        if not person_id and not name:
            continue

        record: dict[str, Any] = {
            "score": _parse_float(entry.get("goatScore")),
            "rank": _parse_int(entry.get("rank")),
            "tier": (entry.get("tier") or "").strip() or None,
            "resume": (entry.get("resume") or "").strip() or None,
        }

        if person_id:
            by_id[person_id] = record
        if name:
            by_name[_normalize_name_key(name)] = record

    return by_id, by_name


def build_player_profiles(
    *,
    active_roster: Path = DEFAULT_ACTIVE_ROSTER,
    players_csv: Path = DEFAULT_PLAYERS_CSV,
    team_histories: Path = DEFAULT_TEAM_HISTORIES,
    birthplace_files: list[Path] = DEFAULT_BIRTHPLACE_FILES,
    goat_system: Path = DEFAULT_GOAT_SYSTEM,
) -> dict[str, Any]:
    players = _load_active_players(active_roster)
    roster_lookup = _load_roster(players_csv)
    teams = _load_team_lookup(team_histories)
    birthplaces = _load_birthplaces(birthplace_files)
    goat_by_id, goat_by_name = _load_goat_scores(goat_system)

    profiles: list[dict[str, Any]] = []
    for player in players:
        roster_payload = roster_lookup.get(player.person_id, RosterRow(person_id=player.person_id, payload={"firstName": player.first_name, "lastName": player.last_name, "guard": "False", "forward": "False", "center": "False"}))
        team_meta = teams.get(player.team_id, teams["0"])

        full_name = roster_payload.payload.get("firstName") or player.first_name
        last_name = roster_payload.payload.get("lastName") or player.last_name
        name = f"{full_name} {last_name}".strip()
        if not name:
            name = player.full_name
        slug_base = _slugify(name) or _slugify(player.full_name) or "player"
        player_id = f"{slug_base}-{player.person_id}"

        height = _format_height(roster_payload.payload.get("height"))
        weight = _format_weight(roster_payload.payload.get("bodyWeight"))
        name_key = _normalize_name_key(name)
        hometown = birthplaces.get(name_key)
        if not hometown:
            alt_key = _normalize_name_key(player.full_name)
            hometown = birthplaces.get(alt_key)
        country = (roster_payload.payload.get("country") or "").strip() or None
        origin = hometown or country
        born = _format_birthdate((roster_payload.payload.get("birthdate") or "").strip() or None, origin)
        draft = _format_draft(roster_payload.payload)
        era = _determine_era(roster_payload.payload)
        codes = _position_codes(roster_payload.payload)
        position_display = " / ".join(codes) if codes else None
        role_phrase = _role_phrase(codes)
        archetype = _archetype_from_positions(codes)
        bio = _build_bio(
            name,
            full_name or player.first_name or name,
            team_meta.get("full", "Free Agent"),
            role_phrase,
            origin,
            draft,
        )
        keywords_list = _build_keywords(player, team_meta, codes, origin)

        goat_meta = goat_by_id.get(player.person_id)
        if not goat_meta:
            goat_meta = goat_by_name.get(name_key)
        if not goat_meta and name_key != _normalize_name_key(player.full_name):
            goat_meta = goat_by_name.get(_normalize_name_key(player.full_name))

        keywords = set(keywords_list)
        goat_score = None
        goat_rank = None
        goat_tier = None
        goat_resume = None
        if goat_meta:
            goat_score = goat_meta.get("score")
            goat_rank = goat_meta.get("rank")
            goat_tier = goat_meta.get("tier")
            goat_resume = goat_meta.get("resume")
            keywords.add("goat")
            if goat_tier:
                keywords.update(part for part in goat_tier.lower().split() if part)

        keywords = sorted(keywords)

        profiles.append(
            {
                "id": player_id,
                "name": name,
                "team": team_meta.get("full") or "Free Agent",
                "position": position_display,
                "height": height,
                "weight": weight,
                "born": born,
                "origin": origin,
                "draft": draft,
                "era": era,
                "archetype": archetype,
                "goatScore": goat_score,
                "goatRank": goat_rank,
                "goatTier": goat_tier,
                "goatResume": goat_resume,
                "bio": bio,
                "keywords": keywords,
                "metrics": {},
            }
        )

    profiles.sort(key=lambda item: item["name"].lower())
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "metrics": METRICS_CATALOG,
        "players": profiles,
    }
    return payload


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the player profiles atlas payload.")
    parser.add_argument("--active-roster", type=Path, default=DEFAULT_ACTIVE_ROSTER, help="Path to active_players.json roster feed.")
    parser.add_argument("--players-csv", type=Path, default=DEFAULT_PLAYERS_CSV, help="Path to Players.csv metadata table.")
    parser.add_argument("--team-histories", type=Path, default=DEFAULT_TEAM_HISTORIES, help="Path to TeamHistories.csv for franchise metadata.")
    parser.add_argument("--goat-system", type=Path, default=DEFAULT_GOAT_SYSTEM, help="Path to GOAT system rankings feed.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Destination for the generated player_profiles.json file.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    payload = build_player_profiles(
        active_roster=args.active_roster,
        players_csv=args.players_csv,
        team_histories=args.team_histories,
        goat_system=args.goat_system,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
