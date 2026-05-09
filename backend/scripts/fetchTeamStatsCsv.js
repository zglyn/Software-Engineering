const axios = require('axios');
const fs = require('fs');

const STATS_LEAGUE_DASH_TEAM_STATS = 'https://stats.nba.com/stats/leaguedashteamstats';

const statsAxiosOpts = {
  timeout: 25000,
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

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const season = process.env.NBA_SEASON || inferSeasonFromNowEt();
  const seasonType = process.env.NBA_SEASON_TYPE || 'Regular Season';
  const outFile = process.env.OUT || `team_stats_${season.replace('-', '_')}.csv`;

  const teamsRes = await axios.get(`${backendBaseUrl}/api/teams`, { timeout: 15000 });
  const teamIds = (teamsRes.data || [])
    .map((t) => String(t.team_id || '').trim())
    .filter(Boolean);
  const teamIdSet = new Set(teamIds);
  if (teamIds.length === 0) {
    console.log('no teams found from backend');
    process.exit(1);
  }

  const params = new URLSearchParams({
    Conference: '',
    DateFrom: '',
    DateTo: '',
    Division: '',
    GameScope: '',
    GameSegment: '',
    LastNGames: '0',
    LeagueID: '00',
    Location: '',
    MeasureType: 'Base',
    Month: '0',
    OpponentTeamID: '0',
    Outcome: '',
    PORound: '0',
    PaceAdjust: 'N',
    PerMode: 'PerGame',
    Period: '0',
    PlusMinus: 'N',
    Rank: 'N',
    Season: season,
    SeasonSegment: '',
    SeasonType: seasonType,
    ShotClockRange: '',
    StarterBench: '',
    TeamID: '0',
    TwoWay: '0',
    VsConference: '',
    VsDivision: '',
  });

  const url = `${STATS_LEAGUE_DASH_TEAM_STATS}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);
  const rs = r.data?.resultSets?.[0] || r.data?.resultSet;
  const headers = rs?.headers;
  const rows = rs?.rowSet;
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    console.log('unexpected response shape');
    console.log(JSON.stringify(r.data, null, 2).slice(0, 1200));
    process.exit(1);
  }

  const idxTeamId = headers.findIndex((h) => String(h).toUpperCase() === 'TEAM_ID');
  if (idxTeamId < 0) {
    console.log('TEAM_ID not found in headers');
    process.exit(1);
  }

  const outRows = [];
  for (const row of rows) {
    const tid = String(row[idxTeamId] ?? '').trim();
    if (!teamIdSet.has(tid)) continue;
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[String(headers[i])] = row[i];
    }
    outRows.push(obj);
  }

  const csvHeaders = ['team_id', ...headers.filter((h) => String(h).toUpperCase() !== 'TEAM_ID').map(String)];
  const lines = [];
  lines.push(csvHeaders.map(csvEscape).join(','));
  for (const o of outRows) {
    const line = [];
    line.push(o.TEAM_ID);
    for (const h of headers) {
      if (String(h).toUpperCase() === 'TEAM_ID') continue;
      line.push(o[String(h)]);
    }
    lines.push(line.map(csvEscape).join(','));
  }
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${outFile} (${outRows.length} teams)`);
}

main().catch((e) => {
  console.log('failed', e.response?.status || e.message);
  process.exit(1);
});

