"""Generate data for the Insights Lab experience using league datasets."""
from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / "public" / "data"
GAMES_PATH = ROOT / "Games.csv"
TEAM_STATS_ARCHIVE = ROOT / "TeamStatistics.zip"

MONTH_LABELS = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


@dataclass
class MonthAggregate:
    label: str
    games: int = 0
    total_points: float = 0.0
    regular_games: int = 0
    regular_points: float = 0.0
    playoff_games: int = 0
    playoff_points: float = 0.0

    def to_dict(self) -> dict[str, object]:
        return {
            "month": self.label,
            "games": self.games,
            "averagePoints": (self.total_points / self.games) if self.games else None,
            "regularSeasonAverage": (self.regular_points / self.regular_games)
            if self.regular_games
            else None,
            "playoffAverage": (self.playoff_points / self.playoff_games)
            if self.playoff_games
            else None,
        }


@dataclass
class CloseBucket:
    label: str
    minimum: float
    maximum: float | None
    games: int = 0
    margin_sum: float = 0.0

    def contains(self, value: float) -> bool:
        if value < self.minimum:
            return False
        if self.maximum is None:
            return True
        return value <= self.maximum

    def to_dict(self, total_games: int) -> dict[str, object]:
        share = (self.games / total_games) if total_games else 0.0
        return {
            "label": self.label,
            "games": self.games,
            "share": share,
            "averageMargin": (self.margin_sum / self.games) if self.games else None,
        }


@dataclass
class RestBucket:
    label: str
    games: int = 0
    wins: int = 0
    margin_sum: float = 0.0

    def add_sample(self, won: bool, margin: float) -> None:
        self.games += 1
        if won:
            self.wins += 1
        self.margin_sum += margin

    def to_dict(self) -> dict[str, object]:
        return {
            "label": self.label,
            "games": self.games,
            "winPct": (self.wins / self.games) if self.games else None,
            "pointMargin": (self.margin_sum / self.games) if self.games else None,
        }


@dataclass
class OvertimeBucket:
    label: str
    games: int = 0
    road_wins: int = 0

    def add_sample(self, road_win: bool) -> None:
        self.games += 1
        if road_win:
            self.road_wins += 1

    def to_dict(self, total_games: int) -> dict[str, object]:
        share = (self.games / total_games) if total_games else 0.0
        return {
            "label": self.label,
            "games": self.games,
            "share": share,
            "roadWinPct": (self.road_wins / self.games) if self.games else None,
        }


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_output_dir() -> None:
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _write_json(filename: str, payload: dict[str, object]) -> None:
    _ensure_output_dir()
    path = PUBLIC_DATA_DIR / filename
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return None


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


def _season_from_date(dt: datetime) -> int:
    return dt.year + 1 if dt.month >= 7 else dt.year


def build_monthly_scoring() -> tuple[list[dict[str, object]], float, int]:
    aggregates: dict[int, MonthAggregate] = {}
    total_games = 0
    with GAMES_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            dt = _parse_datetime(row.get("gameDate"))
            if not dt:
                continue
            month = dt.month
            label = MONTH_LABELS.get(month, str(month))
            bucket = aggregates.setdefault(month, MonthAggregate(label=label))
            home_score = _to_float(row.get("homeScore")) or 0.0
            away_score = _to_float(row.get("awayScore")) or 0.0
            total = home_score + away_score
            bucket.games += 1
            bucket.total_points += total
            total_games += 1
            game_type = (row.get("gameType") or "").strip().lower()
            if game_type == "regular season":
                bucket.regular_games += 1
                bucket.regular_points += total
            elif game_type == "playoffs":
                bucket.playoff_games += 1
                bucket.playoff_points += total
    if not aggregates:
        return [], 0.0, 0

    ordered_months = [aggregates[key] for key in sorted(aggregates)]
    month_dicts = [entry.to_dict() for entry in ordered_months]
    averages = [entry["averagePoints"] for entry in month_dicts if entry["averagePoints"] is not None]
    swing = 0.0
    if averages:
        swing = max(averages) - min(averages)
    return month_dicts, swing, total_games


def build_close_margin_distribution(total_games: int) -> tuple[list[dict[str, object]], float]:
    buckets = [
        CloseBucket("0-2 pts", 0, 2),
        CloseBucket("3-5 pts", 3, 5),
        CloseBucket("6-10 pts", 6, 10),
        CloseBucket("11-15 pts", 11, 15),
        CloseBucket("16+ pts", 16, None),
    ]
    with GAMES_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            home_score = _to_float(row.get("homeScore"))
            away_score = _to_float(row.get("awayScore"))
            if home_score is None or away_score is None:
                continue
            margin = abs(home_score - away_score)
            for bucket in buckets:
                if bucket.contains(margin):
                    bucket.games += 1
                    bucket.margin_sum += margin
                    break
    distribution = [bucket.to_dict(total_games) for bucket in buckets if bucket.games]
    close_share = sum(bucket["share"] for bucket in distribution if bucket["label"] in {"0-2 pts", "3-5 pts"})
    return distribution, close_share


def _load_team_statistics() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with zipfile.ZipFile(TEAM_STATS_ARCHIVE) as archive:
        with archive.open("TeamStatistics.csv") as handle:
            text_stream = io.TextIOWrapper(handle, encoding="utf-8")
            reader = csv.DictReader(text_stream)
            for row in reader:
                game_id = (row.get("gameId") or "").strip()
                team_id = (row.get("teamId") or "").strip()
                dt = _parse_datetime(row.get("gameDate"))
                if not game_id or not team_id or not dt:
                    continue
                home = (row.get("home") or "").strip() == "1"
                win = (row.get("win") or "").strip() == "1"
                team_score = _to_float(row.get("teamScore")) or 0.0
                opponent_score = _to_float(row.get("opponentScore")) or 0.0
                num_minutes = _to_float(row.get("numMinutes"))
                row_payload = {
                    "game_id": game_id,
                    "team_id": team_id,
                    "game_date": dt,
                    "home": home,
                    "win": win,
                    "team_score": team_score,
                    "opponent_score": opponent_score,
                    "three_attempts": _to_float(row.get("threePointersAttempted")) or 0.0,
                    "field_goal_attempts": _to_float(row.get("fieldGoalsAttempted")) or 0.0,
                    "num_minutes": num_minutes,
                }
                rows.append(row_payload)
    rows.sort(key=lambda record: (record["game_date"], record["game_id"], record["team_id"]))
    return rows


def _annotate_rest_days(rows: list[dict[str, object]]) -> None:
    last_game_by_team: dict[str, datetime] = {}
    for row in rows:
        team_id = row["team_id"]
        previous = last_game_by_team.get(team_id)
        if previous is None:
            rest_days = None
        else:
            delta: timedelta = row["game_date"] - previous
            rest_days = delta.total_seconds() / 86400
        row["rest_days"] = rest_days
        last_game_by_team[team_id] = row["game_date"]


def _rest_bucket(road_rest: float, home_rest: float) -> str:
    rest_diff = road_rest - home_rest
    if road_rest < 1:
        return "Back-to-back"
    if rest_diff >= 2:
        return "+2 days"
    if rest_diff >= 1:
        return "+1 day"
    if rest_diff <= -2:
        return "-2 days"
    if rest_diff <= -1:
        return "-1 day"
    return "Even rest"


def build_rest_impact(rows: list[dict[str, object]]) -> tuple[list[dict[str, object]], float]:
    buckets: dict[str, RestBucket] = {
        "+2 days": RestBucket("+2 days"),
        "+1 day": RestBucket("+1 day"),
        "Even rest": RestBucket("Even rest"),
        "-1 day": RestBucket("-1 day"),
        "-2 days": RestBucket("-2 days"),
        "Back-to-back": RestBucket("Back-to-back"),
    }
    games: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        games[row["game_id"]].append(row)
    for pair in games.values():
        if len(pair) != 2:
            continue
        home_entry = next((item for item in pair if item["home"]), None)
        road_entry = next((item for item in pair if not item["home"]), None)
        if not home_entry or not road_entry:
            continue
        road_rest = road_entry.get("rest_days")
        home_rest = home_entry.get("rest_days")
        if road_rest is None or home_rest is None:
            continue
        bucket_label = _rest_bucket(road_rest, home_rest)
        bucket = buckets[bucket_label]
        road_win = bool(road_entry.get("win"))
        margin = (road_entry.get("team_score") or 0.0) - (road_entry.get("opponent_score") or 0.0)
        bucket.add_sample(road_win, margin)
    ordered = [
        buckets[label]
        for label in ["+2 days", "+1 day", "Even rest", "-1 day", "-2 days", "Back-to-back"]
        if buckets[label].games
    ]
    if not ordered:
        return [], 0.0
    stats = [bucket.to_dict() for bucket in ordered]
    positive = [entry for entry in stats if entry["label"].startswith("+")]
    negative = [entry for entry in stats if entry["label"].startswith("-") or entry["label"] == "Back-to-back"]
    best = max((entry for entry in positive if entry.get("winPct") is not None), default=None, key=lambda e: e["winPct"])
    worst = min((entry for entry in negative if entry.get("winPct") is not None), default=None, key=lambda e: e["winPct"])
    swing = 0.0
    if best and worst:
        swing = best["winPct"] - worst["winPct"]
    return stats, swing


def build_overtime_distribution(rows: list[dict[str, object]], total_games: int) -> list[dict[str, object]]:
    buckets: dict[str, OvertimeBucket] = {
        "Regulation": OvertimeBucket("Regulation"),
        "1 OT": OvertimeBucket("1 OT"),
        "2 OT": OvertimeBucket("2 OT"),
        "3 OT": OvertimeBucket("3 OT"),
        "4+ OT": OvertimeBucket("4+ OT"),
    }
    games: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        games[row["game_id"]].append(row)
    for pair in games.values():
        if len(pair) != 2:
            continue
        home_entry = next((item for item in pair if item["home"]), None)
        road_entry = next((item for item in pair if not item["home"]), None)
        if not home_entry or not road_entry:
            continue
        ot_counts = []
        for candidate in (home_entry, road_entry):
            minutes = candidate.get("num_minutes")
            if minutes is None:
                continue
            overtime = max(0.0, minutes - 240.0)
            periods = int(round(overtime / 25.0))
            ot_counts.append(periods)
        periods_played = max(ot_counts) if ot_counts else 0
        if periods_played <= 0:
            label = "Regulation"
        elif periods_played == 1:
            label = "1 OT"
        elif periods_played == 2:
            label = "2 OT"
        elif periods_played == 3:
            label = "3 OT"
        else:
            label = "4+ OT"
        bucket = buckets[label]
        bucket.add_sample(bool(road_entry.get("win")))
    return [bucket.to_dict(total_games) for bucket in buckets.values() if bucket.games]


def build_three_point_trend(rows: Iterable[dict[str, object]]) -> list[dict[str, object]]:
    aggregates: dict[int, dict[str, float]] = defaultdict(lambda: {"three": 0.0, "fga": 0.0, "wins": 0.0, "games": 0.0})
    for row in rows:
        dt: datetime = row["game_date"]
        season = _season_from_date(dt)
        stats = aggregates[season]
        stats["three"] += row.get("three_attempts") or 0.0
        stats["fga"] += row.get("field_goal_attempts") or 0.0
        stats["wins"] += 1.0 if row.get("win") else 0.0
        stats["games"] += 1.0
    trend = []
    for season in sorted(aggregates):
        stats = aggregates[season]
        if stats["games"] == 0:
            continue
        three_rate = (stats["three"] / stats["fga"]) if stats["fga"] else None
        trend.append(
            {
                "season": season,
                "threePointRate": three_rate,
                "teamWinPct": stats["wins"] / stats["games"],
            }
        )
    return trend


def main() -> None:
    months, scoring_swing, total_games = build_monthly_scoring()
    close_distribution, close_share = build_close_margin_distribution(total_games)
    team_rows = _load_team_statistics()
    _annotate_rest_days(team_rows)
    rest_buckets, rest_swing = build_rest_impact(team_rows)
    overtime = build_overtime_distribution(team_rows, total_games)
    three_trend = build_three_point_trend(team_rows)

    payload: dict[str, object] = {
        "generatedAt": _timestamp(),
        "sampleSize": total_games,
        "seasonalScoring": {
            "months": months,
            "swing": scoring_swing,
        },
        "restImpact": {
            "buckets": rest_buckets,
            "swing": rest_swing,
        },
        "closeMargins": {
            "distribution": close_distribution,
            "closeShare": close_share,
        },
        "overtime": {
            "categories": overtime,
        },
        "threePointTrend": {
            "seasons": three_trend,
        },
    }

    _write_json("insights_lab.json", payload)


if __name__ == "__main__":
    main()
