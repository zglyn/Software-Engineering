import csv
import json
import math
import sys
from pathlib import Path


def is_number(s: str) -> bool:
    try:
        if s is None:
            return False
        t = str(s).strip()
        if t == "":
            return False
        v = float(t)
        return math.isfinite(v)
    except Exception:
        return False


def to_dynamo_attr(v: str):
    if v is None:
        return {"NULL": True}
    t = str(v).strip()
    if t == "":
        return {"NULL": True}
    if is_number(t):
        n = str(float(t))
        if n.endswith(".0"):
            n = n[:-2]
        return {"N": n}
    return {"S": t}


def to_dynamo_map(obj: dict):
    m = {}
    for k, v in obj.items():
        if k is None:
            continue
        key = str(k).strip()
        if key == "":
            continue
        m[key] = to_dynamo_attr(v)
    return {"M": m}


def load_stats(stats_csv_path: Path):
    with stats_csv_path.open("r", newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        if not r.fieldnames or "team_id" not in r.fieldnames:
            raise ValueError("stats csv must include team_id column")
        by_id = {}
        for row in r:
            tid = str(row.get("team_id", "")).strip()
            if tid == "":
                continue
            payload = {k: v for k, v in row.items() if k != "team_id"}
            by_id[tid] = payload
        return by_id


def main():
    if len(sys.argv) < 3:
        print("usage: python mergeTeamStatsIntoTeamsCsv.py <teams_export_csv> <team_stats_csv> [out_csv]")
        sys.exit(2)

    teams_path = Path(sys.argv[1]).resolve()
    stats_path = Path(sys.argv[2]).resolve()
    out_path = Path(sys.argv[3]).resolve() if len(sys.argv) >= 4 else teams_path.with_name("teams_with_stats.csv")

    stats_by_id = load_stats(stats_path)

    with teams_path.open("r", newline="", encoding="utf-8") as f_in:
        r = csv.DictReader(f_in)
        if not r.fieldnames:
            raise ValueError("teams export csv missing header")
        fieldnames = list(r.fieldnames)
        if "stats" not in fieldnames:
            fieldnames.append("stats")

        rows = list(r)

    updated = 0
    for row in rows:
        tid = str(row.get("team_id", "")).strip().strip('"')
        if tid in stats_by_id:
            row["stats"] = json.dumps(to_dynamo_map(stats_by_id[tid]), separators=(",", ":"))
            updated += 1
        else:
            row["stats"] = row.get("stats", "") or ""

    with out_path.open("w", newline="", encoding="utf-8") as f_out:
        w = csv.DictWriter(f_out, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    print(f"wrote {out_path} (updated {updated} teams, stats rows {len(stats_by_id)})")


if __name__ == "__main__":
    main()

