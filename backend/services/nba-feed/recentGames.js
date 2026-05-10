const axios = require('axios');

const FETCH_TIMEOUT_MS = 25000;
const STATS_SCOREBOARD_V3 = 'https://stats.nba.com/stats/scoreboardv3';
const NBA_TODAY_SCOREBOARD =
  'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';

const statsAxiosOpts = {
  timeout: FETCH_TIMEOUT_MS,
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

const cdnAxiosOpts = {
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; swe-backend-nba-feed/1.0; +https://github.com/)',
    Accept: 'application/json',
  },
};

function lastNCalendarDatesIsoInET(n) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const out = [];
  let t = Date.now();
  let guard = 0;
  while (out.length < n && guard < 168) {
    const ymd = formatter.format(new Date(t));
    if (!out.includes(ymd)) out.push(ymd);
    t -= 3600000;
    guard += 1;
  }
  return out;
}

function gamesFromLiveBoard(board, provider) {
  const games = [];
  if (!board || typeof board !== 'object') return games;
  const gameDate = board.gameDate || '';
  for (const g of board.games || []) {
    const home = g.homeTeam;
    const away = g.awayTeam;
    if (!home || !away) continue;
    const gst = g.gameStatus;
    const gstStr = gst != null && gst !== '' ? String(gst) : '';
    games.push({
      game_date: gameDate,
      nba_game_id: g.gameId,
      game_status: gstStr,
      status: g.gameStatusText || '',
      completed: gstStr === '3',
      home_team: home.teamTricode || '',
      home_team_name: home.teamName || '',
      home_score:
        home.score === '' || home.score == null ? null : Number(home.score),
      away_team: away.teamTricode || '',
      away_team_name: away.teamName || '',
      away_score:
        away.score === '' || away.score == null ? null : Number(away.score),
      provider,
    });
  }
  return games;
}

async function fetchScoreboardV3ForDate(isoDate) {
  const params = new URLSearchParams({
    GameDate: isoDate,
    LeagueID: '00',
  });
  const url = `${STATS_SCOREBOARD_V3}?${params.toString()}`;
  const res = await axios.get(url, statsAxiosOpts);
  const board = res.data?.scoreboard;
  return gamesFromLiveBoard(board, 'nba_stats_v3');
}

function parseNbaCdnScoreboard(data) {
  return gamesFromLiveBoard(data?.scoreboard, 'nba_cdn');
}

async function fetchNbaCdnToday() {
  const res = await axios.get(NBA_TODAY_SCOREBOARD, cdnAxiosOpts);
  return parseNbaCdnScoreboard(res.data);
}

function dedupeGamesById(games) {
  const map = new Map();
  for (const g of games) {
    const id = String(g.nba_game_id || '');
    if (!id) continue;
    if (!map.has(id)) map.set(id, g);
  }
  return [...map.values()];
}

function attachGameUrls(g) {
  const a = String(g.away_team || '').toLowerCase();
  const h = String(g.home_team || '').toLowerCase();
  const nbaId = g.nba_game_id != null && String(g.nba_game_id).trim() !== '' ? String(g.nba_game_id) : '';
  const out = { ...g };
  if (nbaId && a && h) {
    out.nba_game_url = `https://www.nba.com/game/${a}-vs-${h}-${nbaId}`;
  }
  return out;
}

async function fetchRecentGamesLast3Days() {
  try {
    const dates = lastNCalendarDatesIsoInET(3);
    const chunks = await Promise.all(
      dates.map((d) => fetchScoreboardV3ForDate(d).catch(() => []))
    );
    let merged = dedupeGamesById(chunks.flat());
    if (merged.length === 0) {
      const cdn = await fetchNbaCdnToday().catch(() => []);
      merged = dedupeGamesById(cdn);
    }
    merged.sort((a, b) => {
      if (a.game_date !== b.game_date) return String(b.game_date).localeCompare(String(a.game_date));
      return String(a.nba_game_id).localeCompare(String(b.nba_game_id));
    });
    const games = merged.map(attachGameUrls);
    return { games };
  } catch (err) {
    return { games: [], error: err.message || String(err) };
  }
}

module.exports = {
  fetchRecentGamesLast3Days,
};
