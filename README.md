# NBA

## Web experience overview
- `public/index.html` now delivers the cinematic landing page that introduces the NBA Intelligence Hub.
- `public/franchise-explorer.html` contains the interactive dashboards for franchises, schedules, players, and historical leaders.

## Data dictionary conventions
- **Types.** Unless noted otherwise, `int` columns are whole numbers, `float` columns may contain decimal precision, `string` columns are UTF-8 text, `date` columns follow ISO-8601 (`YYYY-MM-DD` or `YYYY-MM-DD hh:mm:ss`), and `enum` columns contain a constrained vocabulary (often booleans expressed as `True`/`False` or `0`/`1`).
- **Nulls.** Missing values are stored as blank strings; numeric columns with blanks should be interpreted as `NA`.
- **Identifiers.** `personId`, `teamId`, `gameId`, and related identifiers match NBA Stats API identifiers and should be treated as strings to preserve leading zeros. No FIPS codes are currently included.

## Datasets

### Front-end snapshot
- **Description:** Lightweight JSON used by the interactive MVP in `public/franchise-explorer.html`.
- **How to regenerate:** Run `node scripts/build_snapshot.mjs` from the repository root. The script parses `TeamHistories.csv`, filters for active franchise eras, and writes `public/data/active_franchises.json`.
- **Why it matters:** Keeps the browser payload small while guaranteeing the visualization reflects the latest CSV sources.

### 2024-25 schedule snapshot
- **Description:** Aggregated JSON powering the league calendar insights section in `public/franchise-explorer.html`, summarizing monthly volume, team workloads, and tagged special events.
- **How to regenerate:** Run `node scripts/build_schedule_snapshot.mjs` from the repository root. The script reads `LeagueSchedule24_25.csv` and joins against `TeamHistories.csv` to provide friendly team names.
- **Why it matters:** Allows the MVP to surface upcoming season context without shipping the full 1,400-row CSV to the browser.

### Insight snapshots (players, games, teams)

- **Description:** Condensed JSON exports used by the "Global player pipeline", "Historic game spotlights", "Team performance benchmarks", and "All-time player leaders" sections in `public/index.html`.
- **How to regenerate:** Run `python scripts/build_insights.py`. The script streams (via the `7z` CLI when available, or falls back to the [`py7zr`](https://pypi.org/project/py7zr/) Python package):
  - `Players.csv` for roster metadata and height/position rollups,
  - `Games.csv` for league-wide matchup highlights,
  - `TeamStatistics.zip` for franchise benchmarks, and
  - `PlayerStatistics.7z` for career, single-game, and season leaderboards.
- **Outputs:** `public/data/players_overview.json`, `public/data/historic_games.json`, `public/data/team_performance.json`, `public/data/player_leaders.json`, and `public/data/player_season_insights.json`.
- **Why it matters:** Keeps the browser payload tiny while ensuring the MVP reflects every dataset shipped with the repository.

### Players.csv
- **Description:** Master roster metadata for players who have appeared in NBA history.
- **Row count:** 6,533 player records.
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| personId | int | Unique NBA player identifier. |
| firstName | string | Player first name. |
| lastName | string | Player last name. |
| birthdate | date | Date of birth (`YYYY-MM-DD`). |
| lastAttended | string | College or international program last attended. |
| country | string | Country of origin reported by the league. |
| height | float | Listed height in inches. |
| bodyWeight | float | Listed playing weight in pounds. |
| guard | enum | `True`/`False` flag indicating guard eligibility. |
| forward | enum | `True`/`False` flag indicating forward eligibility. |
| center | enum | `True`/`False` flag indicating center eligibility. |
| draftYear | int | Draft year (blank when undrafted). |
| draftRound | int | Draft round number (blank when undrafted). |
| draftNumber | int | Draft selection number (blank when undrafted). |

### Games.csv
- **Description:** Historical schedule and results, including regular season and postseason games.
- **Row count:** 71,879 game records.
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| gameId | string | NBA Stats game identifier. |
| gameDate | date | Tip-off date and time in UTC (`YYYY-MM-DD hh:mm:ss`). |
| hometeamCity | string | Home team city. |
| hometeamName | string | Home team nickname. |
| hometeamId | string | Home team NBA identifier. |
| awayteamCity | string | Away team city. |
| awayteamName | string | Away team nickname. |
| awayteamId | string | Away team NBA identifier. |
| homeScore | int | Final score for the home team. |
| awayScore | int | Final score for the away team. |
| winner | string | `teamId` of the winning team. |
| gameType | enum | Competition type (e.g., `Regular Season`, `Playoffs`). |
| attendance | int | Reported attendance (blank when unavailable). |
| arenaId | string | Arena identifier from NBA Stats. |
| gameLabel | string | League supplied series or event label. |
| gameSubLabel | string | Sub-label such as `Game 7` or neutral site note. |
| seriesGameNumber | int | Series game number for postseason play. |

### TeamHistories.csv
- **Description:** Franchise lineage including relocations and historical league participation.
- **Row count:** 140 franchise-era records.
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| teamId | string | NBA franchise identifier. |
| teamCity | string | City used during the listed era. |
| teamName | string | Team nickname used during the era. |
| teamAbbrev | string | Historical abbreviation as provided by the league. |
| seasonFounded | int | First season of the era (`YYYY`). |
| seasonActiveTill | int | Last season of the era (`YYYY`, `2100` indicates active). |
| league | enum | League membership (`BAA`, `NBA`, etc.). |

### LeagueSchedule24_25.csv
- **Description:** 2024-25 preseason and regular-season master schedule snapshot.
- **Row count:** 1,408 scheduled games. 
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| gameId | string | NBA Stats schedule identifier. |
| gameDateTimeEst | date | Scheduled start date/time with timezone offset. |
| gameDay | enum | Day-of-week abbreviation. |
| arenaCity | string | Arena city. |
| arenaState | string | Arena state or province (blank for international sites). |
| arenaName | string | Arena name. |
| gameLabel | enum | Event label (e.g., `Preseason`, `Regular Season`). |
| gameSubLabel | string | Secondary label such as `NBA Abu Dhabi Game`. |
| gameSubtype | enum | Additional classification (e.g., `Global Games`). |
| gameSequence | int | Sequential number within the day. |
| seriesGameNumber | int | Series game counter (blank when not applicable). |
| seriesText | string | Narrative series description. |
| weekNumber | int | League-provided week number. |
| hometeamId | string | Home team identifier. |
| awayteamId | string | Away team identifier. |

### PlayerStatistics.7z (PlayerStatistics.csv)
- **Description:** Player-level box score statistics for every recorded NBA game.
- **Row count:** 1,627,438 player-game records (extracted CSV).
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| firstName | string | Player first name. |
| lastName | string | Player last name. |
| personId | string | NBA player identifier. |
| gameId | string | Game identifier associated with the stat line. |
| gameDate | date | Game date/time (`YYYY-MM-DD hh:mm:ss`). |
| playerteamCity | string | Player's team city for the game. |
| playerteamName | string | Player's team nickname. |
| opponentteamCity | string | Opponent city. |
| opponentteamName | string | Opponent nickname. |
| gameType | enum | Competition type (e.g., `Regular Season`, `Playoffs`). |
| gameLabel | string | Series or event label (e.g., `NBA Finals`). |
| gameSubLabel | string | Sub-label such as `Game 7`. |
| seriesGameNumber | int | Series game number (blank for regular season). |
| win | enum | `1` if the player's team won, `0` otherwise. |
| home | enum | `1` if the player's team was the home team. |
| numMinutes | float | Minutes played (blank when unavailable). |
| points | float | Points scored. |
| assists | float | Assists recorded. |
| blocks | float | Blocks recorded. |
| steals | float | Steals recorded. |
| fieldGoalsAttempted | float | Field goal attempts. |
| fieldGoalsMade | float | Field goals made. |
| fieldGoalsPercentage | float | Field goal percentage (0–1). |
| threePointersAttempted | float | Three-point attempts. |
| threePointersMade | float | Three-pointers made. |
| threePointersPercentage | float | Three-point percentage (0–1). |
| freeThrowsAttempted | float | Free-throw attempts. |
| freeThrowsMade | float | Free throws made. |
| freeThrowsPercentage | float | Free-throw percentage (0–1). |
| reboundsDefensive | float | Defensive rebounds. |
| reboundsOffensive | float | Offensive rebounds. |
| reboundsTotal | float | Total rebounds. |
| foulsPersonal | float | Personal fouls. |
| turnovers | float | Turnovers committed. |
| plusMinusPoints | float | Plus/minus differential. |

### TeamStatistics.zip (TeamStatistics.csv)
- **Description:** Team aggregate box score results for every game, from both team and opponent perspectives.
- **Row count:** 143,758 team-game records (extracted CSV).
- **Provenance:** TBD.

| Column | Type | Description |
| --- | --- | --- |
| gameId | string | Game identifier associated with the stat line. |
| gameDate | date | Game date/time (`YYYY-MM-DD hh:mm:ss`). |
| teamCity | string | Team city for the game. |
| teamName | string | Team nickname for the game. |
| teamId | string | Team identifier. |
| opponentTeamCity | string | Opponent city. |
| opponentTeamName | string | Opponent nickname. |
| opponentTeamId | string | Opponent identifier. |
| home | enum | `1` if the team played at home. |
| win | enum | `1` if the team won the game. |
| teamScore | int | Points scored by the team. |
| opponentScore | int | Points scored by the opponent. |
| assists | float | Team assists. |
| blocks | float | Team blocks. |
| steals | float | Team steals. |
| fieldGoalsAttempted | float | Team field goal attempts. |
| fieldGoalsMade | float | Team field goals made. |
| fieldGoalsPercentage | float | Team field goal percentage (0–1). |
| threePointersAttempted | float | Team three-point attempts. |
| threePointersMade | float | Team three-pointers made. |
| threePointersPercentage | float | Team three-point percentage (0–1). |
| freeThrowsAttempted | float | Team free-throw attempts. |
| freeThrowsMade | float | Team free throws made. |
| freeThrowsPercentage | float | Team free-throw percentage (0–1). |
| reboundsDefensive | float | Defensive rebounds. |
| reboundsOffensive | float | Offensive rebounds. |
| reboundsTotal | float | Total rebounds. |
| foulsPersonal | float | Personal fouls committed. |
| turnovers | float | Turnovers committed. |
| plusMinusPoints | float | Point differential. |
| numMinutes | float | Total minutes logged (typically 240). |
| q1Points | float | Points scored in the first quarter. |
| q2Points | float | Points scored in the second quarter. |
| q3Points | float | Points scored in the third quarter. |
| q4Points | float | Points scored in the fourth quarter. |
| benchPoints | float | Points scored by bench players. |
| biggestLead | float | Largest lead held. |
| biggestScoringRun | float | Largest unanswered scoring run. |
| leadChanges | float | Number of lead changes. |
| pointsFastBreak | float | Fast-break points. |
| pointsFromTurnovers | float | Points scored off turnovers. |
| pointsInThePaint | float | Points scored in the paint. |
| pointsSecondChance | float | Second-chance points. |
| timesTied | float | Times the score was tied. |
| timeoutsRemaining | float | Timeouts remaining at game's end. |
| seasonWins | float | Cumulative wins entering the game. |
| seasonLosses | float | Cumulative losses entering the game. |
| coachId | string | Coach identifier (blank when unavailable). |

### Sharding layout
- Core CSVs stored at the repository root (Players, Games, TeamHistories, LeagueSchedule24_25) are already under the 25 MB guideline and are distributed as single files.
- `PlayerStatistics.7z` and `TeamStatistics.zip` currently contain monolithic CSV extracts that exceed the 25 MB limit when unpacked. Before committing new revisions of these tables, re-export them into logical shards (e.g., `PlayerStatistics/season=YYYY/part-*.csv` and `TeamStatistics/season=YYYY/part-*.csv`), each shard kept below 25 MB. Downstream consumers should glob those shard paths once available; until sharding is complete, extract the archive locally and work with the single CSV payload.
