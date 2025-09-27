"""Generate aggregated JSON snapshots from the full NBA CSV extracts.

This script powers the richer data visualizations on the static MVP by
condensing the large CSV extracts into lightweight JSON summaries.  It reads
all of the datasets in the repository – including the compressed team and
player statistics tables – and writes browser-friendly outputs to
``public/data``.

The script intentionally avoids external Python dependencies so it can run on
CI or a local workstation with nothing more than CPython, ``zipfile`` (from
the standard library), and the ``7z`` command line utility that ships with the
``p7zip-full`` package.  If the 7z binary is not available, a clear error
message is raised describing the installation step.
"""

from __future__ import annotations

import csv
import io
import json
import math
import shutil
import subprocess
import tempfile
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

import atexit

try:  # Optional dependency used when the 7z CLI is unavailable.
    import py7zr  # type: ignore
except Exception:  # pragma: no cover - fallback only triggered when module missing
    py7zr = None


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / "public" / "data"

_TEMP_PLAYER_STATS_DIR: Path | None = None


# ---------------------------------------------------------------------------
# Utility helpers


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _to_int(value: str | None) -> int | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    value = value.strip().lower()
    return value in {"1", "true", "yes", "t"}


def _year_from_date(raw: str | None) -> int | None:
    if raw is None:
        return None
    raw = raw.strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace(" ", "T")).year
    except ValueError:
        return None


def _decade_label(year: int) -> str:
    start = (year // 10) * 10
    return f"{start}s"


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_output_dir() -> None:
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _write_json(filename: str, payload: dict) -> None:
    _ensure_output_dir()
    path = PUBLIC_DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def _push_top(collection: list[tuple[float, dict]], key: float, item: dict, *, size: int) -> None:
    """Maintain a bounded min-heap of the largest ``size`` elements."""

    if math.isnan(key):
        return
    if len(collection) < size:
        collection.append((key, item))
        if len(collection) == size:
            collection.sort(key=lambda pair: pair[0])
        return

    if key <= collection[0][0]:
        return

    collection[0] = (key, item)
    # Re-establish min ordering for the first element.
    collection.sort(key=lambda pair: pair[0])


def _sorted_heap(heap: list[tuple[float, dict]], *, reverse: bool = True) -> list[dict]:
    return [item for _, item in sorted(heap, key=lambda pair: pair[0], reverse=reverse)]


class PlayerStatisticsStreamError(RuntimeError):
    """Raised when the PlayerStatistics archive cannot be streamed."""


def _cleanup_temp_dir() -> None:
    global _TEMP_PLAYER_STATS_DIR
    if _TEMP_PLAYER_STATS_DIR and _TEMP_PLAYER_STATS_DIR.exists():
        shutil.rmtree(_TEMP_PLAYER_STATS_DIR, ignore_errors=True)
    _TEMP_PLAYER_STATS_DIR = None


def _ensure_player_statistics_csv() -> Path:
    """Extract ``PlayerStatistics.csv`` to a temporary directory.

    The helper caches the extraction for the lifetime of the process so the
    heavy archive only needs to be unpacked once when the ``7z`` CLI is not
    available.
    """

    global _TEMP_PLAYER_STATS_DIR
    if _TEMP_PLAYER_STATS_DIR is not None and (_TEMP_PLAYER_STATS_DIR / "PlayerStatistics.csv").exists():
        return _TEMP_PLAYER_STATS_DIR / "PlayerStatistics.csv"

    if py7zr is None:
        raise PlayerStatisticsStreamError(
            "Unable to stream PlayerStatistics. Install the `p7zip-full` CLI or the `py7zr` Python package."
        )

    archive_path = ROOT / "PlayerStatistics.7z"
    if not archive_path.exists():
        raise PlayerStatisticsStreamError(
            "PlayerStatistics.7z is missing. Ensure the archive is present before running the build script."
        )

    temp_dir = Path(tempfile.mkdtemp(prefix="playerstats_"))
    with py7zr.SevenZipFile(archive_path, mode="r") as archive:
        archive.extract(path=temp_dir, targets=["PlayerStatistics.csv"])

    extracted_path = temp_dir / "PlayerStatistics.csv"
    if not extracted_path.exists():
        raise PlayerStatisticsStreamError("Failed to extract PlayerStatistics.csv from the archive using py7zr.")

    _TEMP_PLAYER_STATS_DIR = temp_dir
    atexit.register(_cleanup_temp_dir)
    return extracted_path


def iter_player_statistics_rows() -> Iterator[dict[str, str]]:
    """Yield rows from ``PlayerStatistics.7z``.

    The function prefers streaming via the ``7z`` CLI for speed. When the CLI
    is unavailable, it falls back to extracting the CSV with ``py7zr``.
    """

    archive_path = ROOT / "PlayerStatistics.7z"
    if not archive_path.exists():
        raise PlayerStatisticsStreamError(
            "PlayerStatistics.7z is missing. Ensure the archive is present before running the build script."
        )

    binary = None
    for candidate in ("7zz", "7zr", "7z"):
        if shutil.which(candidate):
            binary = candidate
            break

    if binary is not None:
        process = subprocess.Popen(
            [binary, "x", "-so", str(archive_path), "PlayerStatistics.csv"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
        )

        assert process.stdout is not None
        with io.TextIOWrapper(process.stdout, encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                yield row

        stderr_output = process.stderr.read().decode("utf-8", errors="ignore") if process.stderr else ""
        returncode = process.wait()
        if returncode != 0:
            raise PlayerStatisticsStreamError(
                f"Failed to stream PlayerStatistics.csv from the 7z archive (exit code {returncode}).\n{stderr_output.strip()}"
            )
        return

    csv_path = _ensure_player_statistics_csv()
    with csv_path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            yield row


# ---------------------------------------------------------------------------
# Players.csv snapshot


def build_players_overview() -> None:
    path = ROOT / "Players.csv"
    total_players = 0
    heights: list[float] = []
    weights: list[float] = []
    guard_count = 0
    forward_count = 0
    center_count = 0
    country_counts: Counter[str] = Counter()
    college_counts: Counter[str] = Counter()
    height_buckets: Counter[int] = Counter()
    tallest: list[tuple[float, dict[str, object]]] = []
    drafted = 0
    undrafted = 0
    draft_years: list[int] = []

    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            total_players += 1

            height = _to_float(row.get("height"))
            weight = _to_float(row.get("bodyWeight"))
            if height is not None:
                heights.append(height)
                bucket_start = int(height // 2 * 2)
                height_buckets[bucket_start] += 1
            if weight is not None and 120 <= weight <= 400:
                weights.append(weight)

            if _to_bool(row.get("guard")):
                guard_count += 1
            if _to_bool(row.get("forward")):
                forward_count += 1
            if _to_bool(row.get("center")):
                center_count += 1

            country = row.get("country", "").strip()
            if country:
                country_counts[country] += 1

            college = row.get("lastAttended", "").strip()
            if college:
                college_counts[college] += 1

            draft_year_raw = row.get("draftYear", "").strip()
            if draft_year_raw:
                year = _to_int(draft_year_raw)
                if year is not None:
                    drafted += 1
                    draft_years.append(year)
            else:
                undrafted += 1

            positions = []
            if _to_bool(row.get("guard")):
                positions.append("G")
            if _to_bool(row.get("forward")):
                positions.append("F")
            if _to_bool(row.get("center")):
                positions.append("C")

            has_valid_weight = weight is not None and 120 <= weight <= 400
            if height is not None:
                player_entry = {
                    "personId": row.get("personId"),
                    "name": f"{row.get('firstName', '').strip()} {row.get('lastName', '').strip()}".strip(),
                    "heightInches": height,
                    "weightPounds": weight if has_valid_weight else None,
                    "country": country or None,
                    "positions": positions,
                }
                _push_top(tallest, height, player_entry, size=12)

    average_height = sum(heights) / len(heights) if heights else 0.0
    average_weight = sum(weights) / len(weights) if weights else 0.0
    min_height = min(heights) if heights else None
    max_height = max(heights) if heights else None
    min_weight = min(weights) if weights else None
    max_weight = max(weights) if weights else None

    draft_decades: Counter[str] = Counter()
    for year in draft_years:
        draft_decades[_decade_label(year)] += 1

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "players": total_players,
            "averageHeightInches": round(average_height, 2),
            "averageWeightPounds": round(average_weight, 1),
            "guards": guard_count,
            "forwards": forward_count,
            "centers": center_count,
            "countriesRepresented": len(country_counts),
        },
        "heightSummary": {
            "minHeightInches": round(min_height, 2) if min_height is not None else None,
            "maxHeightInches": round(max_height, 2) if max_height is not None else None,
            "minWeightPounds": round(min_weight, 1) if min_weight is not None else None,
            "maxWeightPounds": round(max_weight, 1) if max_weight is not None else None,
        },
        "countries": [
            {"country": country, "players": count}
            for country, count in country_counts.most_common(12)
        ],
        "colleges": [
            {"program": college, "players": count}
            for college, count in college_counts.most_common(12)
        ],
        "heightBuckets": [
            {"bucketStart": bucket, "label": f"{bucket}-{bucket + 1}\"", "players": count}
            for bucket, count in sorted(height_buckets.items())
        ],
        "tallestPlayers": _sorted_heap(tallest),
        "draftSummary": {
            "draftedPlayers": drafted,
            "undraftedPlayers": undrafted,
            "earliestDraftYear": min(draft_years) if draft_years else None,
            "latestDraftYear": max(draft_years) if draft_years else None,
            "decadeCounts": [
                {"decade": decade, "players": count}
                for decade, count in sorted(draft_decades.items(), key=lambda item: item[0])
            ],
        },
    }

    _write_json("players_overview.json", payload)


# ---------------------------------------------------------------------------
# Games.csv snapshot


def build_games_snapshot() -> None:
    path = ROOT / "Games.csv"
    totals = Counter()
    totals_by_type: Counter[str] = Counter()
    games_by_decade: Counter[str] = Counter()
    highest_scoring: list[tuple[float, dict]] = []
    largest_margins: list[tuple[float, dict]] = []
    attendance_leaders: list[tuple[float, dict]] = []
    earliest_date: datetime | None = None
    latest_date: datetime | None = None

    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            totals["games"] += 1

            game_type = row.get("gameType", "").strip() or "Unknown"
            totals_by_type[game_type] += 1

            home_score = _to_int(row.get("homeScore")) or 0
            away_score = _to_int(row.get("awayScore")) or 0
            total_points = home_score + away_score
            margin = abs(home_score - away_score)
            attendance = _to_int(row.get("attendance"))

            date_raw = row.get("gameDate", "").strip()
            game_date: datetime | None = None
            if date_raw:
                try:
                    game_date = datetime.fromisoformat(date_raw.replace(" ", "T"))
                except ValueError:
                    game_date = None

            if game_date is not None:
                if earliest_date is None or game_date < earliest_date:
                    earliest_date = game_date
                if latest_date is None or game_date > latest_date:
                    latest_date = game_date
                games_by_decade[_decade_label(game_date.year)] += 1

            record = {
                "gameId": row.get("gameId"),
                "date": date_raw or None,
                "gameType": game_type,
                "home": {
                    "city": row.get("hometeamCity", "").strip(),
                    "name": row.get("hometeamName", "").strip(),
                    "score": home_score,
                },
                "away": {
                    "city": row.get("awayteamCity", "").strip(),
                    "name": row.get("awayteamName", "").strip(),
                    "score": away_score,
                },
                "totalPoints": total_points,
                "margin": margin,
                "attendance": attendance,
            }

            _push_top(highest_scoring, float(total_points), record, size=12)
            _push_top(largest_margins, float(margin), record, size=12)
            if attendance and attendance > 0:
                _push_top(attendance_leaders, float(attendance), record, size=12)

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "games": totals["games"],
            "byType": [
                {"gameType": game_type, "games": count}
                for game_type, count in totals_by_type.most_common()
            ],
            "firstGame": earliest_date.isoformat() if earliest_date else None,
            "latestGame": latest_date.isoformat() if latest_date else None,
        },
        "gamesByDecade": [
            {"decade": decade, "games": count}
            for decade, count in sorted(games_by_decade.items(), key=lambda item: item[0])
        ],
        "highestScoringGames": _sorted_heap(highest_scoring),
        "largestMargins": _sorted_heap(largest_margins),
        "attendanceLeaders": _sorted_heap(attendance_leaders),
    }

    _write_json("historic_games.json", payload)


# ---------------------------------------------------------------------------
# TeamStatistics.zip snapshot


@dataclass
class TeamAggregate:
    name: str
    games: int = 0
    wins: int = 0
    losses: int = 0
    points: float = 0.0
    opponent_points: float = 0.0
    assists: float = 0.0


def build_team_performance_snapshot() -> None:
    path = ROOT / "TeamStatistics.zip"
    if not path.exists():
        raise FileNotFoundError("TeamStatistics.zip is missing; cannot build team performance snapshot.")

    team_totals: dict[str, TeamAggregate] = {}
    scoring_highs: list[tuple[float, dict]] = []
    margin_highs: list[tuple[float, dict]] = []
    assist_highs: list[tuple[float, dict]] = []

    with zipfile.ZipFile(path) as archive:
        with archive.open("TeamStatistics.csv") as raw:
            handle = io.TextIOWrapper(raw, encoding="utf-8", newline="")
            reader = csv.DictReader(handle)
            for row in reader:
                team_id = row.get("teamId", "").strip()
                team_name = f"{row.get('teamCity', '').strip()} {row.get('teamName', '').strip()}".strip()
                if not team_name:
                    team_name = team_id or "Unknown"

                aggregate = team_totals.setdefault(team_id or team_name, TeamAggregate(name=team_name))
                aggregate.games += 1
                if row.get("win", "").strip() == "1":
                    aggregate.wins += 1
                else:
                    aggregate.losses += 1

                points = _to_float(row.get("teamScore")) or 0.0
                opponent_points = _to_float(row.get("opponentScore")) or 0.0
                assists = _to_float(row.get("assists")) or 0.0

                aggregate.points += points
                aggregate.opponent_points += opponent_points
                aggregate.assists += assists

                margin = points - opponent_points
                record = {
                    "gameId": row.get("gameId"),
                    "date": row.get("gameDate"),
                    "team": team_name,
                    "opponent": f"{row.get('opponentTeamCity', '').strip()} {row.get('opponentTeamName', '').strip()}".strip(),
                    "points": round(points, 1),
                    "opponentPoints": round(opponent_points, 1),
                    "margin": round(margin, 1),
                    "assists": round(assists, 1),
                    "gameType": row.get("gameType", "").strip() or None,
                    "home": row.get("home", "").strip() == "1",
                }

                _push_top(scoring_highs, points, record, size=12)
                if margin > 0:
                    _push_top(margin_highs, margin, record, size=12)
                if assists > 0:
                    _push_top(assist_highs, assists, record, size=12)

    win_pct_leaders = []
    for team_id, aggregate in team_totals.items():
        if aggregate.games < 500:
            continue
        win_pct = aggregate.wins / aggregate.games if aggregate.games else 0.0
        win_pct_leaders.append(
            {
                "teamId": team_id,
                "team": aggregate.name,
                "games": aggregate.games,
                "wins": aggregate.wins,
                "losses": aggregate.losses,
                "winPct": round(win_pct, 4),
                "pointsPerGame": round(aggregate.points / aggregate.games, 2) if aggregate.games else 0.0,
                "opponentPointsPerGame": round(aggregate.opponent_points / aggregate.games, 2) if aggregate.games else 0.0,
                "assistsPerGame": round(aggregate.assists / aggregate.games, 2) if aggregate.games else 0.0,
            }
        )

    win_pct_leaders.sort(key=lambda item: (item["winPct"], item["pointsPerGame"]), reverse=True)

    payload = {
        "generatedAt": _timestamp(),
        "winPctLeaders": win_pct_leaders[:12],
        "singleGameHighs": {
            "scoring": _sorted_heap(scoring_highs),
            "margins": _sorted_heap(margin_highs),
            "assists": _sorted_heap(assist_highs),
        },
    }

    _write_json("team_performance.json", payload)


# ---------------------------------------------------------------------------
# PlayerStatistics.7z snapshot


def build_player_leaders_snapshot() -> None:
    career_totals: dict[str, dict[str, object]] = {}
    points_highs: list[tuple[float, dict]] = []
    assists_highs: list[tuple[float, dict]] = []
    rebounds_highs: list[tuple[float, dict]] = []
    total_rows = 0
    earliest_season: int | None = None
    latest_season: int | None = None

    for row in iter_player_statistics_rows():
        total_rows += 1
        person_id = row.get("personId") or ""
        if not person_id:
            continue

        points = _to_float(row.get("points")) or 0.0
        assists = _to_float(row.get("assists")) or 0.0
        rebounds = _to_float(row.get("reboundsTotal")) or 0.0
        minutes = _to_float(row.get("numMinutes")) or 0.0
        win_flag = row.get("win", "").strip() == "1"
        game_type = row.get("gameType", "").strip() or "Unknown"
        game_date_raw = row.get("gameDate", "").strip()
        season_year = _year_from_date(game_date_raw)
        if season_year is not None:
            if earliest_season is None or season_year < earliest_season:
                earliest_season = season_year
            if latest_season is None or season_year > latest_season:
                latest_season = season_year

        career = career_totals.setdefault(
            person_id,
            {
                "personId": person_id,
                "firstName": row.get("firstName", "").strip(),
                "lastName": row.get("lastName", "").strip(),
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "wins": 0,
                "losses": 0,
                "gameTypes": Counter(),
                "teams": set(),
                "firstSeason": season_year,
                "lastSeason": season_year,
            },
        )

        if not career["firstName"] and row.get("firstName"):
            career["firstName"] = row.get("firstName", "").strip()
        if not career["lastName"] and row.get("lastName"):
            career["lastName"] = row.get("lastName", "").strip()

        career["games"] += 1
        career["points"] += points
        career["assists"] += assists
        career["rebounds"] += rebounds
        career["minutes"] += minutes
        if win_flag:
            career["wins"] += 1
        else:
            career["losses"] += 1
        career["gameTypes"][game_type] += 1

        team_name = f"{row.get('playerteamCity', '').strip()} {row.get('playerteamName', '').strip()}".strip()
        if team_name:
            career["teams"].add(team_name)

        if season_year is not None:
            if career["firstSeason"] is None or season_year < career["firstSeason"]:
                career["firstSeason"] = season_year
            if career["lastSeason"] is None or season_year > career["lastSeason"]:
                career["lastSeason"] = season_year

        single_game_record = {
            "personId": person_id,
            "name": f"{row.get('firstName', '').strip()} {row.get('lastName', '').strip()}".strip(),
            "gameId": row.get("gameId"),
            "gameDate": game_date_raw or None,
            "team": team_name or None,
            "opponent": f"{row.get('opponentteamCity', '').strip()} {row.get('opponentteamName', '').strip()}".strip() or None,
            "gameType": game_type,
            "points": round(points, 1),
            "assists": round(assists, 1),
            "rebounds": round(rebounds, 1),
            "minutes": round(minutes, 1),
        }

        _push_top(points_highs, points, single_game_record, size=12)
        _push_top(assists_highs, assists, single_game_record, size=12)
        _push_top(rebounds_highs, rebounds, single_game_record, size=12)

    career_list = []
    for stats in career_totals.values():
        games = stats["games"] or 1
        win_pct = stats["wins"] / games if games else 0.0
        entry = {
            "personId": stats["personId"],
            "name": f"{stats['firstName']} {stats['lastName']}".strip(),
            "games": stats["games"],
            "points": round(stats["points"], 1),
            "assists": round(stats["assists"], 1),
            "rebounds": round(stats["rebounds"], 1),
            "minutes": round(stats["minutes"], 1),
            "pointsPerGame": round(stats["points"] / games, 2),
            "assistsPerGame": round(stats["assists"] / games, 2),
            "reboundsPerGame": round(stats["rebounds"] / games, 2),
            "winPct": round(win_pct, 4),
            "teams": sorted(stats["teams"]),
            "firstSeason": stats["firstSeason"],
            "lastSeason": stats["lastSeason"],
        }
        career_list.append(entry)

    career_points = sorted(career_list, key=lambda item: (item["points"], item["pointsPerGame"]), reverse=True)[:15]
    career_assists = sorted(career_list, key=lambda item: (item["assists"], item["assistsPerGame"]), reverse=True)[:15]
    career_rebounds = sorted(career_list, key=lambda item: (item["rebounds"], item["reboundsPerGame"]), reverse=True)[:15]

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "playerGameRows": total_rows,
            "playersWithStats": len(career_list),
            "seasonCoverage": {
                "start": earliest_season,
                "end": latest_season,
            },
        },
        "careerLeaders": {
            "points": career_points,
            "assists": career_assists,
            "rebounds": career_rebounds,
        },
        "singleGameHighs": {
            "points": _sorted_heap(points_highs),
            "assists": _sorted_heap(assists_highs),
            "rebounds": _sorted_heap(rebounds_highs),
        },
    }

    _write_json("player_leaders.json", payload)


# ---------------------------------------------------------------------------
# Player season insight snapshot


def build_player_season_insights_snapshot() -> None:
    season_player_totals: dict[tuple[str, int], dict[str, object]] = {}
    player_meta: dict[str, dict[str, object]] = {}
    triple_double_counts: Counter[str] = Counter()
    triple_double_seasons: defaultdict[str, set[int]] = defaultdict(set)
    season_totals: defaultdict[int, dict[str, float]] = defaultdict(
        lambda: {"games": 0.0, "points": 0.0, "assists": 0.0, "rebounds": 0.0, "minutes": 0.0}
    )
    season_triple_counts: Counter[int] = Counter()
    player_best_triple: dict[str, dict[str, object]] = {}
    total_rows = 0
    earliest_season: int | None = None
    latest_season: int | None = None

    for row in iter_player_statistics_rows():
        total_rows += 1
        person_id = row.get("personId") or ""
        if not person_id:
            continue

        season_year = _year_from_date(row.get("gameDate"))
        if season_year is None:
            continue

        if earliest_season is None or season_year < earliest_season:
            earliest_season = season_year
        if latest_season is None or season_year > latest_season:
            latest_season = season_year

        first_name = row.get("firstName", "").strip()
        last_name = row.get("lastName", "").strip()
        team_name = f"{row.get('playerteamCity', '').strip()} {row.get('playerteamName', '').strip()}".strip()

        meta = player_meta.setdefault(
            person_id,
            {
                "personId": person_id,
                "firstName": first_name,
                "lastName": last_name,
                "teams": set(),
                "firstSeason": season_year,
                "lastSeason": season_year,
            },
        )
        if first_name and not meta.get("firstName"):
            meta["firstName"] = first_name
        if last_name and not meta.get("lastName"):
            meta["lastName"] = last_name

        if meta.get("firstSeason") is None or (isinstance(meta.get("firstSeason"), int) and season_year < meta["firstSeason"]):
            meta["firstSeason"] = season_year
        if meta.get("lastSeason") is None or (isinstance(meta.get("lastSeason"), int) and season_year > meta["lastSeason"]):
            meta["lastSeason"] = season_year

        if team_name:
            meta["teams"].add(team_name)

        key = (person_id, season_year)
        totals = season_player_totals.setdefault(
            key,
            {
                "personId": person_id,
                "season": season_year,
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "teams": set(),
                "tripleDoubles": 0,
            },
        )

        points = _to_float(row.get("points")) or 0.0
        assists = _to_float(row.get("assists")) or 0.0
        rebounds = _to_float(row.get("reboundsTotal")) or 0.0
        minutes = _to_float(row.get("numMinutes")) or 0.0

        totals["games"] = int(totals.get("games", 0)) + 1
        totals["points"] = float(totals.get("points", 0.0)) + points
        totals["assists"] = float(totals.get("assists", 0.0)) + assists
        totals["rebounds"] = float(totals.get("rebounds", 0.0)) + rebounds
        totals["minutes"] = float(totals.get("minutes", 0.0)) + minutes
        if team_name:
            totals["teams"].add(team_name)

        season_totals_entry = season_totals[season_year]
        season_totals_entry["games"] += 1
        season_totals_entry["points"] += points
        season_totals_entry["assists"] += assists
        season_totals_entry["rebounds"] += rebounds
        season_totals_entry["minutes"] += minutes

        triple_double = points >= 10 and assists >= 10 and rebounds >= 10
        if triple_double:
            totals["tripleDoubles"] = int(totals.get("tripleDoubles", 0)) + 1
            triple_double_counts[person_id] += 1
            triple_double_seasons[person_id].add(season_year)
            season_triple_counts[season_year] += 1

    season_records: list[dict[str, object]] = []
    for (person_id, season_year), totals in season_player_totals.items():
        games = int(totals.get("games", 0))
        if games == 0:
            continue

        meta = player_meta.get(person_id, {})
        name = f"{meta.get('firstName', '')} {meta.get('lastName', '')}".strip()
        teams = sorted(totals.get("teams", set()))

        record = {
            "personId": person_id,
            "name": name or person_id,
            "season": season_year,
            "games": games,
            "teams": teams,
            "pointsPerGame": round(float(totals.get("points", 0.0)) / games, 2),
            "assistsPerGame": round(float(totals.get("assists", 0.0)) / games, 2),
            "reboundsPerGame": round(float(totals.get("rebounds", 0.0)) / games, 2),
            "minutesPerGame": round(float(totals.get("minutes", 0.0)) / games, 1),
            "totalPoints": round(float(totals.get("points", 0.0)), 1),
            "totalAssists": round(float(totals.get("assists", 0.0)), 1),
            "totalRebounds": round(float(totals.get("rebounds", 0.0)), 1),
            "tripleDoubles": int(totals.get("tripleDoubles", 0)),
        }

        season_records.append(record)

        if record["tripleDoubles"] > 0:
            best = player_best_triple.get(person_id)
            if not best or record["tripleDoubles"] > best["tripleDoubles"]:
                player_best_triple[person_id] = {
                    "season": season_year,
                    "tripleDoubles": record["tripleDoubles"],
                }

    qualified = [record for record in season_records if record["games"] >= 40]

    scoring_leaders = sorted(
        qualified,
        key=lambda item: (item["pointsPerGame"], item["totalPoints"]),
        reverse=True,
    )[:12]

    assist_leaders = sorted(
        qualified,
        key=lambda item: (item["assistsPerGame"], item["totalAssists"]),
        reverse=True,
    )[:12]

    rebound_leaders = sorted(
        qualified,
        key=lambda item: (item["reboundsPerGame"], item["totalRebounds"]),
        reverse=True,
    )[:12]

    triple_double_leaders = []
    for person_id, count in triple_double_counts.most_common(12):
        meta = player_meta.get(person_id, {})
        name = f"{meta.get('firstName', '')} {meta.get('lastName', '')}".strip()
        triple_double_leaders.append(
            {
                "personId": person_id,
                "name": name or person_id,
                "tripleDoubles": int(count),
                "seasonsWithTripleDouble": len(triple_double_seasons.get(person_id, set())),
                "careerSpan": {
                    "start": meta.get("firstSeason"),
                    "end": meta.get("lastSeason"),
                },
                "bestSeason": player_best_triple.get(person_id),
            }
        )

    season_trends = []
    for season_year, totals in sorted(season_totals.items(), key=lambda item: item[0]):
        games = totals["games"] or 1.0
        season_trends.append(
            {
                "season": season_year,
                "playerGames": int(games),
                "avgPoints": round(totals["points"] / games, 2),
                "avgAssists": round(totals["assists"] / games, 2),
                "avgRebounds": round(totals["rebounds"] / games, 2),
                "avgMinutes": round(totals["minutes"] / games, 2),
                "tripleDoubles": int(season_triple_counts.get(season_year, 0)),
            }
        )

    overall_games = sum(entry["games"] for entry in season_totals.values())
    overall_points = sum(entry["points"] for entry in season_totals.values())
    overall_assists = sum(entry["assists"] for entry in season_totals.values())
    overall_rebounds = sum(entry["rebounds"] for entry in season_totals.values())

    totals_payload = {
        "playerGameRows": total_rows,
        "playersTracked": len(player_meta),
        "seasonsTracked": len(season_totals),
        "seasonCoverage": {"start": earliest_season, "end": latest_season},
        "tripleDoubleGames": int(sum(triple_double_counts.values())),
        "playersWithTripleDouble": sum(1 for count in triple_double_counts.values() if count > 0),
        "averagePlayerLine": {
            "points": round(overall_points / overall_games, 2) if overall_games else 0.0,
            "assists": round(overall_assists / overall_games, 2) if overall_games else 0.0,
            "rebounds": round(overall_rebounds / overall_games, 2) if overall_games else 0.0,
        },
    }

    if season_triple_counts:
        season, count = season_triple_counts.most_common(1)[0]
        totals_payload["mostTripleDoubleSeason"] = {"season": season, "tripleDoubles": int(count)}

    payload = {
        "generatedAt": _timestamp(),
        "totals": totals_payload,
        "seasonAverages": {
            "points": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "pointsPerGame": record["pointsPerGame"],
                    "totalPoints": record["totalPoints"],
                    "teams": record["teams"],
                }
                for record in scoring_leaders
            ],
            "assists": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "assistsPerGame": record["assistsPerGame"],
                    "totalAssists": record["totalAssists"],
                    "teams": record["teams"],
                }
                for record in assist_leaders
            ],
            "rebounds": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "reboundsPerGame": record["reboundsPerGame"],
                    "totalRebounds": record["totalRebounds"],
                    "teams": record["teams"],
                }
                for record in rebound_leaders
            ],
        },
        "tripleDoubleLeaders": triple_double_leaders,
        "seasonTrends": season_trends,
    }

    _write_json("player_season_insights.json", payload)


# ---------------------------------------------------------------------------


def main() -> None:
    build_players_overview()
    build_games_snapshot()
    build_team_performance_snapshot()
    build_player_leaders_snapshot()
    build_player_season_insights_snapshot()


if __name__ == "__main__":
    main()
