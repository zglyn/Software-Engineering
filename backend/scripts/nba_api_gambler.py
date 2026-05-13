import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd
from nba_api.stats.endpoints import leaguedashteamstats, scheduleleaguev2


def infer_season() -> str:
    now = datetime.now()
    year = now.year
    month = now.month

    if month >= 10:
        return f"{year}-{str(year + 1)[-2:]}"

    return f"{year - 1}-{str(year)[-2:]}"


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def safe_str(value: Any, default: str = "") -> str:
    try:
        if value is None or pd.isna(value):
            return default
        return str(value)
    except Exception:
        return default


def parse_dt(value: Any):
    if value is None or pd.isna(value):
        return None

    text = str(value).strip()
    if not text:
        return None

    try:
        if text.endswith("Z"):
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def odds_from_confidence(confidence: float) -> str:
    if confidence >= 70:
        return "-160"
    if confidence >= 64:
        return "-130"
    if confidence >= 58:
        return "-110"
    if confidence >= 52:
        return "+105"
    return "+125"


def build_pick(home_name: str, away_name: str, home_abbrev: str, away_abbrev: str, home_stats: Dict, away_stats: Dict):
    home_win_pct = safe_float(home_stats.get("W_PCT"))
    away_win_pct = safe_float(away_stats.get("W_PCT"))

    home_pts = safe_float(home_stats.get("PTS"))
    away_pts = safe_float(away_stats.get("PTS"))

    home_reb = safe_float(home_stats.get("REB"))
    away_reb = safe_float(away_stats.get("REB"))

    home_ast = safe_float(home_stats.get("AST"))
    away_ast = safe_float(away_stats.get("AST"))

    home_plus_minus = safe_float(home_stats.get("PLUS_MINUS"))
    away_plus_minus = safe_float(away_stats.get("PLUS_MINUS"))

    home_score = (
        home_win_pct * 45
        + home_pts * 0.12
        + home_reb * 0.04
        + home_ast * 0.06
        + home_plus_minus * 1.15
        + 2.5
    )

    away_score = (
        away_win_pct * 45
        + away_pts * 0.12
        + away_reb * 0.04
        + away_ast * 0.06
        + away_plus_minus * 1.15
    )

    diff = home_score - away_score
    home_selected = diff >= 0

    raw_confidence = 55 + abs(diff) * 1.65
    confidence = round(min(82, max(52, raw_confidence)), 1)
    edge = round(max(1.2, min(9.8, abs(diff) * 0.42)), 1)

    return {
        "selectedTeam": home_name if home_selected else away_name,
        "selectedAbbrev": home_abbrev if home_selected else away_abbrev,
        "confidence": confidence,
        "odds": odds_from_confidence(confidence),
        "edge": f"+{edge}%",
    }


def normalize_game(row: Dict, index: int, stats_by_team_id: Dict[int, Dict]) -> Dict:
    home_team_id = int(safe_float(row.get("homeTeam_teamId")))
    away_team_id = int(safe_float(row.get("awayTeam_teamId")))

    home_city = safe_str(row.get("homeTeam_teamCity"))
    home_team = safe_str(row.get("homeTeam_teamName"))
    home_abbrev = safe_str(row.get("homeTeam_teamTricode"))

    away_city = safe_str(row.get("awayTeam_teamCity"))
    away_team = safe_str(row.get("awayTeam_teamName"))
    away_abbrev = safe_str(row.get("awayTeam_teamTricode"))

    home_name = f"{home_city} {home_team}".strip() or home_abbrev or "Home Team"
    away_name = f"{away_city} {away_team}".strip() or away_abbrev or "Away Team"

    pick = build_pick(
        home_name=home_name,
        away_name=away_name,
        home_abbrev=home_abbrev,
        away_abbrev=away_abbrev,
        home_stats=stats_by_team_id.get(home_team_id, {}),
        away_stats=stats_by_team_id.get(away_team_id, {}),
    )

    game_id = safe_str(row.get("gameId"), f"game-{index + 1}")
    status = safe_str(row.get("gameStatusText"), "Scheduled")
    game_date = safe_str(row.get("gameDate"), "")
    game_time_est = safe_str(row.get("gameDateTimeEst") or row.get("gameTimeEst"), status)

    return {
        "id": index + 1,
        "gameId": game_id,
        "gameDate": game_date,
        "game": f"{away_name} vs {home_name}",
        "awayTeam": away_name,
        "homeTeam": home_name,
        "awayAbbrev": away_abbrev,
        "homeAbbrev": home_abbrev,
        "market": f"{pick['selectedTeam']} Moneyline",
        "selectedTeam": pick["selectedTeam"],
        "selectedAbbrev": pick["selectedAbbrev"],
        "odds": pick["odds"],
        "confidence": pick["confidence"],
        "edge": pick["edge"],
        "status": status,
        "arena": safe_str(row.get("arenaName"), ""),
        "gameTime": game_time_est,
    }


def main():
    season = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip() else infer_season()
    season_type = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].strip() else "Regular Season"
    limit = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 100

    warnings: List[str] = []

    schedule_endpoint = scheduleleaguev2.ScheduleLeagueV2(
        league_id="00",
        season=season,
        timeout=45,
    )

    schedule_df = schedule_endpoint.season_games.get_data_frame()

    now = datetime.now(timezone.utc)

    future_rows = []

    for _, row in schedule_df.iterrows():
        row_dict = row.to_dict()

        game_dt = parse_dt(row_dict.get("gameDateTimeUTC"))

        if game_dt is None:
            game_dt = parse_dt(row_dict.get("gameDateUTC"))

        if game_dt is None:
            continue

        if game_dt >= now:
            row_dict["_sortTime"] = game_dt.isoformat()
            future_rows.append(row_dict)

    future_rows.sort(key=lambda x: x.get("_sortTime", ""))

    try:
        team_stats_endpoint = leaguedashteamstats.LeagueDashTeamStats(
            season=season,
            season_type_all_star=season_type,
            timeout=45,
        )
        team_stats_df = team_stats_endpoint.league_dash_team_stats.get_data_frame()

        stats_by_team_id = {
            int(row["TEAM_ID"]): row.to_dict()
            for _, row in team_stats_df.iterrows()
            if "TEAM_ID" in row and pd.notna(row["TEAM_ID"])
        }
    except Exception as e:
        warnings.append(f"team stats failed: {str(e)}")
        stats_by_team_id = {}

    selected_rows = future_rows[:limit]

    picks = [
        normalize_game(row, index, stats_by_team_id)
        for index, row in enumerate(selected_rows)
    ]

    output = {
        "source": "python nba_api ScheduleLeagueV2 + LeagueDashTeamStats",
        "date": datetime.now().strftime("%m/%d/%Y"),
        "season": season,
        "seasonType": season_type,
        "count": len(picks),
        "warnings": warnings,
        "picks": picks,
    }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(
            json.dumps(
                {
                    "source": "python nba_api",
                    "date": datetime.now().strftime("%m/%d/%Y"),
                    "error": str(e),
                    "picks": [],
                }
            )
        )
        sys.exit(1)