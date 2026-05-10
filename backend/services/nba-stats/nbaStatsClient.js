const axios = require('axios');

const STATS_TEAM_GAMELOG = 'https://stats.nba.com/stats/teamgamelog';
const STATS_BOXSCORE_SUMMARY_V2 = 'https://stats.nba.com/stats/boxscoresummaryv2';
const STATS_COMMON_PLAYER_INFO = 'https://stats.nba.com/stats/commonplayerinfo';
const NBA_CDN_BOXSCORE = 'https://cdn.nba.com/static/json/liveData/boxscore';

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

const cdnBoxscoreAxiosOpts = {
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    Accept: 'application/json',
  },
};

function inferSeasonFromNowEt() {
  const d = new Date();
  const y = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(d);
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' }).format(d);
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month >= 10) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

async function fetchTwoTeamScoresFromLiveBoxscore(gameId) {
  const url = `${NBA_CDN_BOXSCORE}/boxscore_${String(gameId)}.json`;
  const r = await axios.get(url, cdnBoxscoreAxiosOpts);
  const game = r.data?.game;
  const h = game?.homeTeam;
  const a = game?.awayTeam;
  if (!h || !a) return null;
  const hId = h.teamId;
  const aId = a.teamId;
  if (hId == null || aId == null) return null;
  const hScore = h.score === '' || h.score == null ? null : Number(h.score);
  const aScore = a.score === '' || a.score == null ? null : Number(a.score);
  if (!Number.isFinite(hScore) || !Number.isFinite(aScore)) return null;
  return [
    { teamId: hId, pts: hScore },
    { teamId: aId, pts: aScore },
  ];
}

async function fetchTwoTeamScoresFromBoxscoreSummaryV2(gameId) {
  const params = new URLSearchParams({
    GameID: String(gameId),
    LeagueID: '00',
  });
  const url = `${STATS_BOXSCORE_SUMMARY_V2}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);
  const sets = r.data?.resultSets;
  if (!Array.isArray(sets)) return null;
  const line = sets.find((s) => String(s?.name || '') === 'LineScore');
  const headers = line?.headers;
  const rows = line?.rowSet;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return null;
  const norm = (x) => String(x ?? '').trim().toUpperCase();
  const iTeamId = headers.findIndex((h) => norm(h) === 'TEAM_ID');
  const iPts = headers.findIndex((h) => norm(h) === 'PTS');
  if (iTeamId < 0 || iPts < 0) return null;
  const out = rows
    .map((row) => ({ teamId: row[iTeamId], pts: row[iPts] }))
    .filter((x) => x.teamId != null && x.pts != null);
  if (out.length < 2) return null;
  return out.map((x) => ({ teamId: x.teamId, pts: Number(x.pts) }));
}

async function fetchOpponentPointsForGame(gameId, teamId) {
  try {
    let line = await fetchTwoTeamScoresFromLiveBoxscore(gameId);
    if (!line) line = await fetchTwoTeamScoresFromBoxscoreSummaryV2(gameId);
    if (!line) return null;
    const tid = String(teamId);
    const me = line.find((x) => String(x.teamId) === tid);
    const opp = line.find((x) => String(x.teamId) !== tid);
    if (!opp) return null;
    return Number.isFinite(opp.pts) ? opp.pts : null;
  } catch (_) {
    return null;
  }
}

function rowToObject(resultSet) {
  const headers = resultSet?.headers;
  const row = resultSet?.rowSet?.[0];
  if (!Array.isArray(headers) || !Array.isArray(row)) return null;
  const o = {};
  for (let i = 0; i < headers.length; i += 1) o[headers[i]] = row[i];
  return o;
}

function cleanStr(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

async function fetchCommonPlayerInfo(playerId) {
  const pid = Number(playerId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  const params = new URLSearchParams({
    PlayerID: String(pid),
    LeagueID: '00',
  });
  const url = `${STATS_COMMON_PLAYER_INFO}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);
  const sets = r.data?.resultSets;
  if (!Array.isArray(sets)) return null;
  const infoSet = sets.find((s) => String(s?.name) === 'CommonPlayerInfo');
  const M = rowToObject(infoSet);
  if (!M) return null;
  const city = cleanStr(M.TEAM_CITY);
  const name = cleanStr(M.TEAM_NAME);
  const abbr = cleanStr(M.TEAM_ABBREVIATION);
  const parts = [city, name].filter(Boolean);
  const team_display = parts.length ? `${parts.join(' ')}${abbr ? ` (${abbr})` : ''}` : undefined;
  const headSet = sets.find((s) => String(s?.name) === 'PlayerHeadlineStats');
  const H = rowToObject(headSet);
  let headline = null;
  if (H) {
    headline = {
      pts: H.PTS,
      reb: H.REB,
      ast: H.AST,
      pie: H.PIE,
    };
  }
  return {
    school: cleanStr(M.SCHOOL),
    country: cleanStr(M.COUNTRY),
    last_affiliation: cleanStr(M.LAST_AFFILIATION),
    season_exp: M.SEASON_EXP,
    team_display,
    team_city: city,
    team_name: name,
    team_abbr: abbr,
    draft_round: cleanStr(M.DRAFT_ROUND),
    draft_number: cleanStr(M.DRAFT_NUMBER),
    from_year: cleanStr(M.FROM_YEAR),
    to_year: cleanStr(M.TO_YEAR),
    roster_status: cleanStr(M.ROSTERSTATUS),
    greatest_75_flag: cleanStr(M.GREATEST_75_FLAG),
    headline,
  };
}

async function fetchTeamGamelogRecent(teamId, options) {
  const lim = Number.isFinite(Number(options?.limit))
    ? Math.max(1, Math.min(20, Math.floor(Number(options.limit))))
    : 5;
  const Season =
    typeof options?.season === 'string' && options.season.trim()
      ? options.season.trim()
      : process.env.NBA_SEASON || inferSeasonFromNowEt() || '2025-26';
  const SeasonType =
    typeof options?.seasonType === 'string' && options.seasonType.trim()
      ? options.seasonType.trim()
      : process.env.NBA_SEASON_TYPE || 'Regular Season';

  const params = new URLSearchParams({
    TeamID: String(teamId),
    Season,
    SeasonType,
    LeagueID: '00',
  });
  const url = `${STATS_TEAM_GAMELOG}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);
  const rs = r.data?.resultSets?.[0] || r.data?.resultSet;
  const headers = rs?.headers;
  const rows = rs?.rowSet;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return [];

  const norm = (x) => String(x ?? '').trim().toUpperCase();
  const indexOf = (name) => headers.findIndex((h) => norm(h) === norm(name));
  const iGameId = indexOf('GAME_ID');
  const iGameDate = indexOf('GAME_DATE');
  const iMatchup = indexOf('MATCHUP');
  const iWl = indexOf('WL');
  const iPts = indexOf('PTS');

  const baseRows = rows.slice(0, lim).map((row) => ({
    gameId: iGameId >= 0 ? row[iGameId] ?? null : null,
    gameDate: iGameDate >= 0 ? row[iGameDate] ?? null : null,
    matchup: iMatchup >= 0 ? row[iMatchup] ?? null : null,
    wl: iWl >= 0 ? row[iWl] ?? null : null,
    scored: iPts >= 0 ? row[iPts] ?? null : null,
  }));

  const out = [];
  for (const g of baseRows) {
    let allowed = null;
    if (g.gameId) {
      allowed = await fetchOpponentPointsForGame(g.gameId, teamId);
    }
    out.push({
      ...g,
      scored: g.scored == null ? null : Number(g.scored),
      allowed,
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

module.exports = {
  inferSeasonFromNowEt,
  fetchTeamGamelogRecent,
  fetchCommonPlayerInfo,
  statsAxiosOpts,
};
