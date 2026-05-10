const axios = require('axios');
const fs = require('fs');
const path = require('path');

const STATS_LEAGUE_DASH_PLAYER_STATS = 'https://stats.nba.com/stats/leaguedashplayerstats';

const statsAxiosOpts = {
  timeout: 90000,
  headers: {
    Host: 'stats.nba.com',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    Referer: 'https://www.nba.com/',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    'Sec-Ch-Ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Fetch-Dest': 'empty',
  },
  decompress: true,
};

function inferSeasonFromNowEt() {
  const now = new Date();
  const y = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(now)
  );
  const m = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' }).format(now)
  );
  const start = m >= 10 ? y : y - 1;
  const end2 = String((start + 1) % 100).padStart(2, '0');
  return `${start}-${end2}`;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function csvEscapeField(s) {
  const str = s == null ? '' : String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return `"${str}"`;
}

function extractPlayerIdsFromTeamDyn(teamObj) {
  const players = teamObj?.players;
  const list = players?.L ?? players;
  if (!Array.isArray(list)) return [];
  const ids = [];
  for (const item of list) {
    if (item?.N != null) ids.push(String(item.N));
    else if (item?.M?.player_id?.N != null) ids.push(String(item.M.player_id.N));
  }
  return ids;
}

function toDynamoPlayerRanksMap(rankById) {
  const M = {};
  for (const [pid, rank] of rankById.entries()) {
    M[String(pid)] = { N: String(rank) };
  }
  return { M };
}

async function fetchPtsByTeamId(season, seasonType, nbaTeamId) {
  const params = new URLSearchParams({
    College: '',
    Conference: '',
    Country: '',
    DateFrom: '',
    DateTo: '',
    Division: '',
    DraftPick: '',
    DraftYear: '',
    GameScope: '',
    GameSegment: '',
    Height: '',
    ISTRound: '',
    LastNGames: '0',
    LeagueID: '00',
    Location: '',
    MeasureType: 'Base',
    Month: '0',
    OpponentTeamID: '0',
    Outcome: '',
    PORound: '0',
    Rank: 'Y',
    PerMode: 'PerGame',
    Period: '0',
    PlayerExperience: '',
    PlayerPosition: '',
    Season: season,
    SeasonSegment: '',
    SeasonType: seasonType,
    StarterBench: '',
    TeamID: String(nbaTeamId),
    VsConference: '',
    VsDivision: '',
    Weight: '',
  });
  const url = `${STATS_LEAGUE_DASH_PLAYER_STATS}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);
  const rs = r.data?.resultSets?.[0] || r.data?.resultSet;
  const headers = rs?.headers;
  const rows = rs?.rowSet;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return new Map();
  const norm = (x) => String(x ?? '').trim().toUpperCase();
  const iPid = headers.findIndex((h) => norm(h) === 'PLAYER_ID');
  const iPts = headers.findIndex((h) => norm(h) === 'PTS');
  if (iPid < 0 || iPts < 0) return new Map();
  const out = new Map();
  for (const row of rows) {
    const pid = row[iPid];
    if (pid == null) continue;
    const sid = String(pid);
    const pts = Number(row[iPts]);
    out.set(sid, Number.isFinite(pts) ? pts : -1);
  }
  return out;
}

function loadPtsJsonArg() {
  const a = process.argv.find((x) => x.startsWith('--pts-json='));
  if (!a) return null;
  const p = a.slice('--pts-json='.length);
  if (!p) return null;
  const raw = fs.readFileSync(path.resolve(p), 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const inPath = args[0] || path.join(__dirname, '..', 'results (1).csv');
  const useFallback = process.argv.includes('--fallback');
  const raw = fs.readFileSync(inPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.log('no rows');
    process.exit(1);
  }
  const header = '"team_id","name","stats","team","player_ranks_plain"';
  const dataRows = lines.slice(1);
  const season = process.env.NBA_SEASON || inferSeasonFromNowEt();
  const seasonType = process.env.NBA_SEASON_TYPE || 'Regular Season';

  const parsedRows = [];
  const allIds = new Set();
  for (const line of dataRows) {
    const cols = parseCsvLine(line);
    if (cols.length < 4) continue;
    const teamId = cols[0];
    const name = cols[1];
    const statsStr = cols[2];
    const teamStr = cols[3];
    let teamObj;
    try {
      teamObj = JSON.parse(teamStr);
    } catch {
      console.error('bad team json for', teamId);
      process.exit(1);
    }
    const pids = extractPlayerIdsFromTeamDyn(teamObj);
    for (const id of pids) allIds.add(id);
    parsedRows.push({ teamId, name, statsStr, teamObj, pids });
  }

  const ptsJson = loadPtsJsonArg();
  const ptsById = new Map();
  if (ptsJson && typeof ptsJson === 'object') {
    for (const id of allIds) {
      const v = ptsJson[id];
      const n = Number(v);
      ptsById.set(id, Number.isFinite(n) ? n : -1);
    }
  } else if (useFallback) {
    console.warn('using --fallback pseudo PTS; re-run with live NBA or --pts-json for real PPG ranks');
    for (const id of allIds) {
      ptsById.set(id, Number(id) % 10000);
    }
  } else {
    const uniqueTeamIds = [...new Set(parsedRows.map((r) => r.teamId))];
    try {
      for (const tid of uniqueTeamIds) {
        const m = await fetchPtsByTeamId(season, seasonType, tid);
        for (const [k, v] of m.entries()) {
          if (allIds.has(k)) ptsById.set(k, v);
        }
      }
    } catch (e) {
      console.error('NBA stats fetch failed. Use --pts-json=path.json or --fallback.');
      throw e;
    }
    for (const id of allIds) {
      if (!ptsById.has(id)) ptsById.set(id, -1);
    }
  }

  const rankKey = (teamId, playerId) => `${teamId}|${playerId}`;
  const rankByTeamAndPlayer = new Map();
  for (const row of parsedRows) {
    const sortedPids = [...row.pids].sort((a, b) => {
      const pa = ptsById.get(a) ?? -1;
      const pb = ptsById.get(b) ?? -1;
      if (pb !== pa) return pb - pa;
      return Number(a) - Number(b);
    });
    sortedPids.forEach((id, idx) => {
      rankByTeamAndPlayer.set(rankKey(row.teamId, id), idx + 1);
    });
  }

  const outLines = [header];
  for (const row of parsedRows) {
    const teamRanks = new Map();
    for (const id of row.pids) {
      teamRanks.set(id, rankByTeamAndPlayer.get(rankKey(row.teamId, id)));
    }
    const nextTeam = { ...row.teamObj, player_ranks: toDynamoPlayerRanksMap(teamRanks) };
    const plain = {};
    for (const id of row.pids) {
      const rk = teamRanks.get(id);
      if (rk != null) plain[String(id)] = rk;
    }
    outLines.push(
      [
        csvEscapeField(row.teamId),
        csvEscapeField(row.name),
        csvEscapeField(row.statsStr),
        csvEscapeField(JSON.stringify(nextTeam)),
        csvEscapeField(JSON.stringify(plain)),
      ].join(',')
    );
  }

  fs.writeFileSync(inPath, outLines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${inPath} per-team player_ranks (${allIds.size} players, ${season} ${seasonType})`);

  const seedDir = path.join(__dirname, '..', 'seed');
  fs.mkdirSync(seedDir, { recursive: true });
  const seedByTeam = {};
  for (const row of parsedRows) {
    const o = {};
    for (const id of row.pids) {
      const rk = rankByTeamAndPlayer.get(rankKey(row.teamId, id));
      if (rk != null) o[String(id)] = rk;
    }
    seedByTeam[String(row.teamId)] = o;
  }
  const seedPath = path.join(seedDir, 'player_ranks_by_team.json');
  fs.writeFileSync(seedPath, JSON.stringify(seedByTeam, null, 0) + '\n', 'utf8');
  console.log(`wrote ${seedPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
