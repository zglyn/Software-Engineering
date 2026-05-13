const axios = require('axios');

const STATS_TEAM_GAMELOG = 'https://stats.nba.com/stats/teamgamelog';
const STATS_BOXSCORE_SUMMARY_V2 = 'https://stats.nba.com/stats/boxscoresummaryv2';
const STATS_COMMON_PLAYER_INFO = 'https://stats.nba.com/stats/commonplayerinfo';
const NBA_CDN_BOXSCORE = 'https://cdn.nba.com/static/json/liveData/boxscore';
const STATS_SCOREBOARD_V2 = 'https://stats.nba.com/stats/scoreboardv2';
const STATS_LEAGUE_DASH_TEAM_STATS = 'https://stats.nba.com/stats/leaguedashteamstats';
const NBA_SCHEDULE_LEAGUE_V2 =
  'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';

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
    Origin: 'https://www.nba.com',
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

  const y = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
  }).format(d);

  const m = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
  }).format(d);

  const year = Number(y);
  const month = Number(m);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  if (month >= 10) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }

  return `${year - 1}-${String(year).slice(-2)}`;
}

function cleanStr(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function rowToObject(resultSet) {
  const headers = resultSet?.headers;
  const row = resultSet?.rowSet?.[0];

  if (!Array.isArray(headers) || !Array.isArray(row)) return null;

  const obj = {};

  for (let i = 0; i < headers.length; i += 1) {
    obj[headers[i]] = row[i];
  }

  return obj;
}

function resultSetRowsToObjects(resultSet) {
  const headers = resultSet?.headers;
  const rows = resultSet?.rowSet;

  if (!Array.isArray(headers) || !Array.isArray(rows)) return [];

  return rows.map((row) => {
    const obj = {};

    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = row[i];
    }

    return obj;
  });
}

function todayEtMmDdYyyy() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get('month')}/${get('day')}/${get('year')}`;
}

function etDateAddDays(daysToAdd) {
  const base = new Date();

  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);

  const get = (type) => etParts.find((p) => p.type === type)?.value;

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);

  return date;
}

function formatMmDdYyyy(date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const yyyy = date.getUTCFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

async function fetchScoreboardByDate(gameDate) {
  const params = new URLSearchParams({
    GameDate: gameDate,
    LeagueID: '00',
    DayOffset: '0',
  });

  const url = `${STATS_SCOREBOARD_V2}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);

  const sets = r.data?.resultSets;
  if (!Array.isArray(sets)) return [];

  const gameHeaderSet = sets.find((s) => String(s?.name) === 'GameHeader');
  return resultSetRowsToObjects(gameHeaderSet);
}

async function fetchTodayScoreboard() {
  return fetchScoreboardByDate(todayEtMmDdYyyy());
}

async function fetchUpcomingScoreboard(daysAhead = 14) {
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const gameDate = formatMmDdYyyy(etDateAddDays(offset));
    const games = await fetchScoreboardByDate(gameDate);

    if (Array.isArray(games) && games.length > 0) {
      return {
        gameDate,
        offset,
        games,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return {
    gameDate: formatMmDdYyyy(etDateAddDays(0)),
    offset: 0,
    games: [],
  };
}

async function fetchLeagueTeamStats(options = {}) {
  const Season =
    typeof options.season === 'string' && options.season.trim()
      ? options.season.trim()
      : process.env.NBA_SEASON || inferSeasonFromNowEt() || '2025-26';

  const SeasonType =
    typeof options.seasonType === 'string' && options.seasonType.trim()
      ? options.seasonType.trim()
      : process.env.NBA_SEASON_TYPE || 'Regular Season';

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
    PlayerExperience: '',
    PlayerPosition: '',
    PlusMinus: 'N',
    Rank: 'N',
    Season,
    SeasonSegment: '',
    SeasonType,
    ShotClockRange: '',
    StarterBench: '',
    TeamID: '0',
    TwoWay: '0',
    VsConference: '',
    VsDivision: '',
  });

  const url = `${STATS_LEAGUE_DASH_TEAM_STATS}?${params.toString()}`;
  const r = await axios.get(url, statsAxiosOpts);

  const set = r.data?.resultSets?.[0] || r.data?.resultSet;
  return resultSetRowsToObjects(set);
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

  return out.map((x) => ({
    teamId: x.teamId,
    pts: Number(x.pts),
  }));
}

async function fetchOpponentPointsForGame(gameId, teamId) {
  try {
    let line = await fetchTwoTeamScoresFromLiveBoxscore(gameId);

    if (!line) {
      line = await fetchTwoTeamScoresFromBoxscoreSummaryV2(gameId);
    }

    if (!line) return null;

    const tid = String(teamId);
    const opp = line.find((x) => String(x.teamId) !== tid);

    if (!opp) return null;

    return Number.isFinite(opp.pts) ? opp.pts : null;
  } catch (_) {
    return null;
  }
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

  const team_display = parts.length
    ? `${parts.join(' ')}${abbr ? ` (${abbr})` : ''}`
    : undefined;

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

async function fetchTeamGamelogRecent(teamId, options = {}) {
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

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return out;
}

async function fetchFutureScheduleGames(limit = 50) {
  const r = await axios.get(NBA_SCHEDULE_LEAGUE_V2, cdnBoxscoreAxiosOpts);

  const gameDates = r.data?.leagueSchedule?.gameDates;
  if (!Array.isArray(gameDates)) return [];

  const now = Date.now();
  const games = [];

  for (const dateBlock of gameDates) {
    for (const game of dateBlock.games || []) {
      const gameTimeRaw =
        game.gameDateTimeUTC ||
        game.gameDateEst ||
        game.gameDateTimeEst ||
        game.gameDate;

      const gameTime = gameTimeRaw ? new Date(gameTimeRaw).getTime() : null;

      if (gameTime != null && Number.isFinite(gameTime) && gameTime < now) {
        continue;
      }

      const home = game.homeTeam || {};
      const away = game.awayTeam || {};

      games.push({
        GAME_ID: game.gameId,
        GAME_DATE: game.gameDateEst || game.gameDate || dateBlock.gameDate,
        GAME_STATUS_TEXT:
          game.gameStatusText ||
          game.gameDateTimeEst ||
          game.gameDateTimeUTC ||
          'Scheduled',

        HOME_TEAM_ID: home.teamId,
        HOME_TEAM_CITY: home.teamCity,
        HOME_TEAM_NAME: home.teamName,
        HOME_TEAM_ABBREVIATION: home.teamTricode,

        VISITOR_TEAM_ID: away.teamId,
        VISITOR_TEAM_CITY: away.teamCity,
        VISITOR_TEAM_NAME: away.teamName,
        VISITOR_TEAM_ABBREVIATION: away.teamTricode,

        ARENA_NAME: game.arenaName || game.arena?.arenaName || '',
      });
    }
  }

  return games
    .sort((a, b) => {
      const da = new Date(a.GAME_DATE || a.GAME_STATUS_TEXT).getTime();
      const db = new Date(b.GAME_DATE || b.GAME_STATUS_TEXT).getTime();
      return da - db;
    })
    .slice(0, limit);
}

module.exports = {
  inferSeasonFromNowEt,
  fetchTeamGamelogRecent,
  fetchCommonPlayerInfo,
  fetchTodayScoreboard,
  fetchUpcomingScoreboard,
  fetchScoreboardByDate,
  fetchLeagueTeamStats,
  fetchFutureScheduleGames,
  statsAxiosOpts,
};