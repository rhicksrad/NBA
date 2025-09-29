"""Generate player atlas profiles for active NBA players."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import socket
import unicodedata
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from scripts.build_insights import iter_player_statistics_rows
    from scripts.goat_metrics import (
        RECENT_SEASON_SPAN,
        RECENT_SEASON_START,
        compute_recent_goat_scores,
        format_season_span,
        format_season_window,
    )
except ModuleNotFoundError:  # pragma: no cover - fallback for direct execution
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts.build_insights import iter_player_statistics_rows  # type: ignore
    from scripts.goat_metrics import (  # type: ignore
        RECENT_SEASON_SPAN,
        RECENT_SEASON_START,
        compute_recent_goat_scores,
        format_season_span,
        format_season_window,
    )

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ACTIVE_ROSTER = ROOT / "data" / "2025-26" / "manual" / "roster_reference.json"
DEFAULT_ROSTER_SNAPSHOT = ROOT / "public" / "data" / "rosters.json"
DEFAULT_PLAYERS_CSV = ROOT / "Players.csv"
DEFAULT_TEAM_HISTORIES = ROOT / "TeamHistories.csv"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "player_profiles.json"
DEFAULT_GOAT_RECENT_OUTPUT = ROOT / "public" / "data" / "goat_recent.json"
DEFAULT_GOAT_SYSTEM = ROOT / "public" / "data" / "goat_system.json"
DEFAULT_BIRTHPLACE_FILES = [
    ROOT / "data" / "nba_birthplaces.csv",
    ROOT / "data" / "nba_draft_birthplaces.csv",
]

ACTIVE_SEASON_END_YEAR = 2026

RECENT_LEADERBOARD_LIMIT = 10
GOAT_RECENT_METRIC = "Rolling three-year GOAT index"

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

TEAM_METADATA = [
    {"team_id": "1610612737", "tricode": "ATL"},
    {"team_id": "1610612738", "tricode": "BOS"},
    {"team_id": "1610612751", "tricode": "BKN"},
    {"team_id": "1610612766", "tricode": "CHA"},
    {"team_id": "1610612741", "tricode": "CHI"},
    {"team_id": "1610612739", "tricode": "CLE"},
    {"team_id": "1610612742", "tricode": "DAL"},
    {"team_id": "1610612743", "tricode": "DEN"},
    {"team_id": "1610612765", "tricode": "DET"},
    {"team_id": "1610612744", "tricode": "GSW"},
    {"team_id": "1610612745", "tricode": "HOU"},
    {"team_id": "1610612754", "tricode": "IND"},
    {"team_id": "1610612746", "tricode": "LAC"},
    {"team_id": "1610612747", "tricode": "LAL"},
    {"team_id": "1610612763", "tricode": "MEM"},
    {"team_id": "1610612748", "tricode": "MIA"},
    {"team_id": "1610612749", "tricode": "MIL"},
    {"team_id": "1610612750", "tricode": "MIN"},
    {"team_id": "1610612740", "tricode": "NOP"},
    {"team_id": "1610612752", "tricode": "NYK"},
    {"team_id": "1610612760", "tricode": "OKC"},
    {"team_id": "1610612753", "tricode": "ORL"},
    {"team_id": "1610612755", "tricode": "PHI"},
    {"team_id": "1610612756", "tricode": "PHX"},
    {"team_id": "1610612757", "tricode": "POR"},
    {"team_id": "1610612758", "tricode": "SAC"},
    {"team_id": "1610612759", "tricode": "SAS"},
    {"team_id": "1610612761", "tricode": "TOR"},
    {"team_id": "1610612762", "tricode": "UTA"},
    {"team_id": "1610612764", "tricode": "WAS"},
]

TEAM_ID_TO_TRICODE = {meta["team_id"]: meta["tricode"] for meta in TEAM_METADATA}
TEAM_TRICODE_TO_ID = {meta["tricode"]: meta["team_id"] for meta in TEAM_METADATA}


def _default_season_end_year() -> int:
    """Return the default Basketball-Reference season end year."""

    return ACTIVE_SEASON_END_YEAR


@dataclass
class ActivePlayer:
    person_id: str
    first_name: str
    last_name: str
    team_id: str
    team_tricode: str | None = None

    @property
    def full_name(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.first_name or self.person_id


@dataclass
class RosterRow:
    person_id: str
    payload: dict[str, Any]


@dataclass
class BbrRosterEntry:
    name: str
    position: str | None = None


class _RosterTableParser(HTMLParser):
    """Minimal HTML parser for Basketball-Reference roster tables."""

    def __init__(self) -> None:
        super().__init__()
        self._in_roster = False
        self._in_tbody = False
        self._current_field: str | None = None
        self._skip_row = False
        self._current_name: list[str] = []
        self._current_position: list[str] = []
        self.entries: list[BbrRosterEntry] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "table" and attributes.get("id") == "roster":
            self._in_roster = True
        elif not self._in_roster:
            return
        elif tag == "tbody":
            self._in_tbody = True
        elif not self._in_tbody:
            return
        elif tag == "tr":
            class_attr = attributes.get("class") or ""
            if "thead" in class_attr.split():
                self._skip_row = True
            else:
                self._skip_row = False
                self._current_name = []
                self._current_position = []
        elif self._skip_row:
            return
        elif tag in {"th", "td"}:
            data_stat = attributes.get("data-stat")
            if data_stat == "player":
                self._current_field = "name"
            elif data_stat == "pos":
                self._current_field = "position"
            else:
                self._current_field = None
        elif tag == "a" and self._current_field == "name":
            # Keep capturing the player name inside anchor tags.
            return

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._in_roster:
            self._in_roster = False
            self._in_tbody = False
            self._skip_row = False
            self._current_field = None
        elif not self._in_roster:
            return
        elif tag == "tbody":
            self._in_tbody = False
            self._skip_row = False
            self._current_field = None
        elif not self._in_tbody:
            return
        elif tag == "tr":
            if not self._skip_row and self._current_name:
                name = "".join(self._current_name).strip()
                position = "".join(self._current_position).strip() or None
                if name:
                    self.entries.append(BbrRosterEntry(name=name, position=position))
            self._skip_row = False
            self._current_field = None
            self._current_name = []
            self._current_position = []
        elif tag in {"th", "td"}:
            self._current_field = None

    def handle_data(self, data: str) -> None:
        if not self._in_roster or not self._in_tbody or self._skip_row or not self._current_field:
            return
        if self._current_field == "name":
            self._current_name.append(data)
        elif self._current_field == "position":
            self._current_position.append(data)


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


def _load_reference_roster(path: Path) -> list[ActivePlayer]:
    data = json.loads(path.read_text(encoding="utf-8"))
    players: list[ActivePlayer] = []
    for entry in data:
        raw_person_id = entry.get("playerId")
        person_id = str(raw_person_id).strip() if raw_person_id not in (None, "") else ""
        first_name = str(entry.get("firstName") or "").strip()
        last_name = str(entry.get("lastName") or "").strip()
        raw_team_id = entry.get("teamId")
        team_id = str(raw_team_id).strip() if raw_team_id not in (None, "") else "0"
        raw_tricode = entry.get("teamTricode")
        team_tricode = str(raw_tricode).strip() if raw_tricode not in (None, "") else None
        players.append(
            ActivePlayer(
                person_id=person_id,
                first_name=first_name,
                last_name=last_name,
                team_id=team_id,
                team_tricode=team_tricode,
            )
        )
    return players


def _fetch_bbr_team_roster(tricode: str, season_end_year: int) -> list[BbrRosterEntry]:
    url = f"https://www.basketball-reference.com/teams/{tricode}/{season_end_year}.html"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=20) as response:  # nosec: B113 - trusted domain
        html = response.read().decode("utf-8", errors="replace")
    parser = _RosterTableParser()
    parser.feed(html)
    return parser.entries


def _build_name_index(roster_lookup: dict[str, RosterRow]) -> dict[str, list[RosterRow]]:
    index: dict[str, list[RosterRow]] = {}
    for row in roster_lookup.values():
        first = (row.payload.get("firstName") or "").strip()
        last = (row.payload.get("lastName") or "").strip()
        name = f"{first} {last}".strip()
        if not name:
            continue
        key = _normalize_name_key(name)
        index.setdefault(key, []).append(row)
    return index


def _best_roster_row(candidates: list[RosterRow]) -> RosterRow | None:
    if not candidates:
        return None

    def sort_key(row: RosterRow) -> tuple[int, int]:
        draft = _parse_int(row.payload.get("draftYear")) or 0
        try:
            person = int(row.person_id)
        except ValueError:
            person = 0
        return (draft, person)

    return max(candidates, key=sort_key)


def _resolve_active_player(
    name: str,
    roster_index: dict[str, list[RosterRow]],
    fallback_index: dict[str, list[ActivePlayer]] | None,
) -> tuple[str, str, str] | None:
    key = _normalize_name_key(name)
    if fallback_index and key in fallback_index:
        for candidate in fallback_index[key]:
            if candidate.person_id:
                return candidate.person_id, candidate.first_name, candidate.last_name

    candidates = roster_index.get(key)
    row = _best_roster_row(candidates or [])
    if not row or not row.person_id:
        return None

    first_name = (row.payload.get("firstName") or "").strip()
    last_name = (row.payload.get("lastName") or "").strip()
    if not first_name or not last_name:
        parts = name.split()
        if parts:
            first_name = first_name or parts[0]
            last_name = last_name or " ".join(parts[1:])
    return row.person_id, first_name, last_name


def _load_active_players_from_roster_snapshot(
    path: Path,
    *,
    fallback_players: list[ActivePlayer] | None = None,
) -> list[ActivePlayer]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Failed to read roster snapshot at {path}: {exc}") from exc

    teams = payload.get("teams")
    if not isinstance(teams, list):
        raise RuntimeError("Roster snapshot missing teams array")

    fallback_by_id = {player.person_id: player for player in fallback_players or []}
    players: dict[str, ActivePlayer] = {}

    for team in teams:
        if not isinstance(team, dict):
            continue

        abbr = (team.get("abbreviation") or "").strip().upper()
        team_id_raw = team.get("id")
        if isinstance(team_id_raw, int):
            team_id = str(team_id_raw)
        elif isinstance(team_id_raw, str) and team_id_raw.strip():
            team_id = team_id_raw.strip()
        else:
            team_id = TEAM_TRICODE_TO_ID.get(abbr, "0")
        if not team_id:
            team_id = "0"

        roster_entries = team.get("roster")
        if not isinstance(roster_entries, list):
            continue

        for entry in roster_entries:
            if not isinstance(entry, dict):
                continue

            player_id_raw = entry.get("id")
            if isinstance(player_id_raw, int):
                person_id = str(player_id_raw)
            elif isinstance(player_id_raw, str) and player_id_raw.strip():
                person_id = player_id_raw.strip()
            else:
                continue

            first_name = (entry.get("first_name") or "").strip()
            last_name = (entry.get("last_name") or "").strip()
            fallback = fallback_by_id.get(person_id)
            if fallback:
                if not first_name:
                    first_name = fallback.first_name
                if not last_name:
                    last_name = fallback.last_name
            if not first_name and not last_name:
                continue

            team_tricode = abbr or (fallback.team_tricode if fallback else None)
            candidate = ActivePlayer(
                person_id=person_id,
                first_name=first_name or "",
                last_name=last_name or "",
                team_id=team_id,
                team_tricode=team_tricode,
            )

            existing = players.get(person_id)
            if existing:
                replace = existing.team_id == "0" and candidate.team_id != "0"
                if not replace:
                    continue
            players[person_id] = candidate

    if fallback_players:
        for player in fallback_players:
            if player.person_id not in players and player.team_id == "0":
                players[player.person_id] = player

    return sorted(
        players.values(),
        key=lambda p: (
            p.team_tricode or p.team_id,
            p.last_name.lower(),
            p.first_name.lower(),
        ),
    )


def _fetch_active_players_from_bbr(
    roster_lookup: dict[str, RosterRow],
    *,
    season_end_year: int,
    fallback_players: list[ActivePlayer] | None = None,
) -> list[ActivePlayer]:
    roster_index = _build_name_index(roster_lookup)
    fallback_index: dict[str, list[ActivePlayer]] = {}
    if fallback_players:
        for player in fallback_players:
            fallback_index.setdefault(_normalize_name_key(player.full_name), []).append(player)

    active_players: dict[str, ActivePlayer] = {}
    missing: list[str] = []

    for meta in TEAM_METADATA:
        tricode = meta["tricode"]
        team_id = meta["team_id"]
        try:
            roster = _fetch_bbr_team_roster(tricode, season_end_year)
        except (HTTPError, URLError, TimeoutError, socket.timeout) as exc:
            raise RuntimeError(f"Failed to fetch roster for {tricode}: {exc}") from exc

        for entry in roster:
            resolved = _resolve_active_player(entry.name, roster_index, fallback_index or None)
            if not resolved:
                missing.append(f"{entry.name} ({tricode})")
                continue
            person_id, first_name, last_name = resolved
            active_players[person_id] = ActivePlayer(
                person_id=person_id,
                first_name=first_name,
                last_name=last_name,
                team_id=team_id,
                team_tricode=tricode,
            )

    if missing:
        warnings.warn(
            "Unable to map some Basketball-Reference roster entries to Players.csv identifiers: "
            + ", ".join(missing),
            RuntimeWarning,
            stacklevel=2,
        )

    if fallback_players:
        for player in fallback_players:
            if player.person_id not in active_players and player.team_id == "0":
                active_players[player.person_id] = player

    return sorted(active_players.values(), key=lambda p: (p.team_id, p.last_name, p.first_name))


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


def _format_recent_blurb(record: dict[str, Any]) -> str:
    games = int(record.get("games") or 0)
    wins = int(record.get("wins") or 0)
    losses = max(games - wins, 0)
    span_text = format_season_span(record.get("seasons") or [])
    parts: list[str] = []
    if games:
        parts.append(f"{games} games")
    if wins or losses:
        parts.append(f"{wins}-{losses} record")
    if span_text:
        parts.append(span_text)
    return " · ".join(parts)


def _build_recent_goat_leaderboard(
    players: list[ActivePlayer],
    recent_scores: dict[str, dict[str, Any]],
    team_lookup: dict[str, dict[str, str]],
    *,
    limit: int = RECENT_LEADERBOARD_LIMIT,
) -> list[dict[str, Any]]:
    if not recent_scores:
        return []

    index = {player.person_id: player for player in players}
    leaderboard: list[dict[str, Any]] = []
    for person_id, record in recent_scores.items():
        score = record.get("score")
        rank = record.get("rank")
        if score is None or rank is None:
            continue
        player = index.get(person_id)
        if not player:
            continue

        record_team_name = (record.get("teamName") or "").strip()
        record_team_city = (record.get("teamCity") or "").strip()
        resolved_meta: dict[str, str] | None = None
        resolved_tricode: str | None = None
        if record_team_name or record_team_city:
            name_key = record_team_name.lower()
            city_key = record_team_city.lower()
            for team_id, payload in team_lookup.items():
                nickname = (payload.get("nickname") or "").strip().lower()
                city = (payload.get("city") or "").strip().lower()
                if name_key and name_key != nickname:
                    continue
                if city_key and city_key != city:
                    continue
                resolved_meta = payload
                resolved_tricode = TEAM_ID_TO_TRICODE.get(team_id)
                break

        team_meta = resolved_meta or team_lookup.get(player.team_id, team_lookup.get("0", {}))
        team_name = record_team_name or team_meta.get("nickname") or team_meta.get("full") or "Free Agent"
        franchise = resolved_tricode or player.team_tricode
        entry = {
            "rank": int(rank),
            "personId": person_id,
            "name": player.full_name,
            "displayName": player.full_name,
            "team": team_name,
            "franchise": franchise,
            "score": float(score),
            "blurb": _format_recent_blurb(record),
        }
        leaderboard.append(entry)

    leaderboard.sort(key=lambda item: (item["rank"], -item["score"]))
    if limit > 0:
        return leaderboard[:limit]
    return leaderboard


def _build_recent_goat_payload(leaderboard: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "window": format_season_window(RECENT_SEASON_START, RECENT_SEASON_SPAN),
        "metric": GOAT_RECENT_METRIC,
        "players": leaderboard,
    }


def build_player_profiles(
    *,
    active_roster: Path = DEFAULT_ACTIVE_ROSTER,
    rosters_snapshot: Path = DEFAULT_ROSTER_SNAPSHOT,
    players_csv: Path = DEFAULT_PLAYERS_CSV,
    team_histories: Path = DEFAULT_TEAM_HISTORIES,
    birthplace_files: list[Path] = DEFAULT_BIRTHPLACE_FILES,
    goat_system: Path = DEFAULT_GOAT_SYSTEM,
    season_end_year: int | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    roster_lookup = _load_roster(players_csv)
    fallback_players: list[ActivePlayer] = []
    if active_roster and active_roster.exists():
        try:
            fallback_players = _load_reference_roster(active_roster)
        except (OSError, json.JSONDecodeError) as exc:
            warnings.warn(
                f"Failed to read fallback roster reference at {active_roster}: {exc}",
                RuntimeWarning,
                stacklevel=2,
            )

    players: list[ActivePlayer] | None = None
    if rosters_snapshot and rosters_snapshot.exists():
        try:
            players = _load_active_players_from_roster_snapshot(
                rosters_snapshot,
                fallback_players=fallback_players or None,
            )
        except RuntimeError as exc:
            warnings.warn(
                f"Failed to load Ball Don't Lie roster snapshot at {rosters_snapshot}: {exc}",
                RuntimeWarning,
                stacklevel=2,
            )

    if players is None:
        season_year = season_end_year or _default_season_end_year()
        try:
            players = _fetch_active_players_from_bbr(
                roster_lookup,
                season_end_year=season_year,
                fallback_players=fallback_players or None,
            )
        except RuntimeError as exc:
            if fallback_players:
                warnings.warn(
                    f"Falling back to local roster reference after Basketball-Reference fetch failure: {exc}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                players = fallback_players
            else:
                raise

    teams = _load_team_lookup(team_histories)
    birthplaces = _load_birthplaces(birthplace_files)
    goat_by_id, goat_by_name = _load_goat_scores(goat_system)
    recent_goat = compute_recent_goat_scores(
        iter_player_statistics_rows(), {player.person_id for player in players}
    )

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

        recent_meta = recent_goat.get(player.person_id, {})
        profile: dict[str, Any] = {
            "id": player_id,
            "name": name,
            "personId": player.person_id,
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

        recent_score = recent_meta.get("score") if isinstance(recent_meta, dict) else None
        recent_rank = recent_meta.get("rank") if isinstance(recent_meta, dict) else None
        if recent_score is not None:
            profile["goatRecentScore"] = recent_score
        if recent_rank is not None:
            profile["goatRecentRank"] = recent_rank

        profiles.append(profile)

    profiles.sort(key=lambda item: item["name"].lower())
    recent_leaderboard = _build_recent_goat_leaderboard(
        players, recent_goat, teams, limit=RECENT_LEADERBOARD_LIMIT
    )
    recent_payload = _build_recent_goat_payload(recent_leaderboard)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "metrics": METRICS_CATALOG,
        "players": profiles,
    }
    return payload, recent_payload


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the player profiles atlas payload.")
    parser.add_argument(
        "--active-roster",
        type=Path,
        default=DEFAULT_ACTIVE_ROSTER,
        help="Optional fallback roster reference JSON used if live Basketball-Reference fetch fails.",
    )
    parser.add_argument(
        "--rosters",
        type=Path,
        default=DEFAULT_ROSTER_SNAPSHOT,
        help="Path to the Ball Don't Lie roster snapshot JSON (rosters.json).",
    )
    parser.add_argument("--players-csv", type=Path, default=DEFAULT_PLAYERS_CSV, help="Path to Players.csv metadata table.")
    parser.add_argument("--team-histories", type=Path, default=DEFAULT_TEAM_HISTORIES, help="Path to TeamHistories.csv for franchise metadata.")
    parser.add_argument("--goat-system", type=Path, default=DEFAULT_GOAT_SYSTEM, help="Path to GOAT system rankings feed.")
    parser.add_argument(
        "--season-end-year",
        type=int,
        default=_default_season_end_year(),
        help="Season end year used for Basketball-Reference roster pages (for example 2026 for the 2025-26 season).",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Destination for the generated player_profiles.json file.")
    parser.add_argument(
        "--goat-recent-output",
        type=Path,
        default=DEFAULT_GOAT_RECENT_OUTPUT,
        help="Destination for the generated goat_recent.json leaderboard.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    payload, recent_payload = build_player_profiles(
        active_roster=args.active_roster,
        rosters_snapshot=args.rosters,
        players_csv=args.players_csv,
        team_histories=args.team_histories,
        goat_system=args.goat_system,
        season_end_year=args.season_end_year,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if recent_payload:
        args.goat_recent_output.parent.mkdir(parents=True, exist_ok=True)
        args.goat_recent_output.write_text(
            json.dumps(recent_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
