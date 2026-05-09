const axios = require('axios');

const fs = require('fs');

const STATS_VIDEO_DETAILS_ASSET = 'https://stats.nba.com/stats/videodetailsasset';
const STATS_SCOREBOARD_V3 = 'https://stats.nba.com/stats/scoreboardv3';

const ALL_MEASURES = ['FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'AST', 'BLK', 'STL', 'TOV', 'REB', 'PTS'];

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

function inferSeasonType(gameId) {
  const pre = String(gameId).slice(0, 3);
  if (pre === '001') return 'Pre Season';
  if (pre === '002') return 'Regular Season';
  if (pre === '004' || pre === '005') return 'Playoffs';
  return 'Regular Season';
}

function parseArgs(argv) {
  const out = { gameId: null, season: '2025-26', seasonType: null, auto: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--auto') out.auto = true;
    else if (a.startsWith('--season=')) out.season = a.slice('--season='.length);
    else if (a.startsWith('--seasonType=')) out.seasonType = a.slice('--seasonType='.length);
    else if (!a.startsWith('--') && /^\d{10}$/.test(a)) out.gameId = a;
  }
  return out;
}

function ymdEt(offsetDays) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const t = Date.now() + offsetDays * 86400000;
  return formatter.format(new Date(t));
}

async function pickAutoGameId() {
  for (let d = 0; d <= 6; d++) {
    const ymd = ymdEt(-d);
    const params = new URLSearchParams({ GameDate: ymd, LeagueID: '00' });
    const res = await axios.get(`${STATS_SCOREBOARD_V3}?${params}`, statsAxiosOpts).catch(() => null);
    if (!res?.data) continue;
    const games = res.data?.scoreboard?.games || [];
    const fin = games.find((g) => String(g.gameStatus) === '3');
    if (fin) {
      return {
        gameId: String(fin.gameId),
        gameDate: ymd,
        label: `${fin.awayTeam?.teamTricode} @ ${fin.homeTeam?.teamTricode}`,
      };
    }
  }
  return null;
}

function buildParams({ gameId, season, seasonType, measure }) {
  return new URLSearchParams({
    LeagueID: '00',
    Season: season,
    SeasonType: seasonType,
    TeamID: '0',
    PlayerID: '0',
    GameID: gameId,
    Outcome: '',
    Location: '',
    Month: '0',
    SeasonSegment: '',
    DateFrom: '',
    DateTo: '',
    OpponentTeamID: '0',
    VsConference: '',
    VsDivision: '',
    Position: '',
    RookieYear: '',
    GameSegment: '',
    Period: '0',
    LastNGames: '0',
    ContextFilter: '',
    ContextMeasure: measure,
  });
}

async function fetchAllClipsForGame({ gameId, season, seasonType }) {
  const allClips = [];
  const allPlaylist = [];
  const seen = new Set();
  const summary = [];
  for (const m of ALL_MEASURES) {
    const params = buildParams({ gameId, season, seasonType, measure: m });
    const url = `${STATS_VIDEO_DETAILS_ASSET}?${params.toString()}`;
    try {
      const res = await axios.get(url, statsAxiosOpts);
      const urls = res.data?.resultSets?.Meta?.videoUrls || [];
      const pl = res.data?.resultSets?.playlist || [];
      let fresh = 0;
      for (let i = 0; i < urls.length; i++) {
        const u = urls[i];
        if (!seen.has(u.uuid)) {
          seen.add(u.uuid);
          allClips.push(u);
          allPlaylist.push({ ...(pl[i] || {}), measure: m });
          fresh++;
        }
      }
      summary.push({ measure: m, total: urls.length, unique: fresh });
      console.log(m, urls.length, 'clips,', fresh, 'new');
    } catch (e) {
      summary.push({ measure: m, error: e.response?.status || e.message });
      console.log(m, 'err', e.response?.status || e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { allClips, allPlaylist, summary };
}

async function main() {
  const args = parseArgs(process.argv);
  let gameId = args.gameId;
  let picked = null;
  if (args.auto || !gameId) {
    picked = await pickAutoGameId();
    if (!picked) {
      console.log('auto: no game found on recent scoreboards');
      process.exit(1);
    }
    gameId = picked.gameId;
    console.log('auto picked', picked.gameId, picked.label, picked.gameDate);
  }
  const seasonType = args.seasonType || inferSeasonType(gameId);
  const season = args.season;
  console.log('request', { gameId, season, seasonType });
  console.log('fetching all measures:', ALL_MEASURES.join(', '));
  try {
    const { allClips, allPlaylist, summary } = await fetchAllClipsForGame({ gameId, season, seasonType });
    const out = {
      gameId,
      season,
      seasonType,
      totalUniqueClips: allClips.length,
      measuredFetched: ALL_MEASURES,
      summary,
      videoUrls: allClips,
      playlist: allPlaylist,
    };
    const outFile = `game_video_clips_all_${gameId}.json`;
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(`\nsaved ${allClips.length} total unique clips to ${outFile}`);
    if (allClips.length > 0) {
      console.log('sample lurl (720p mp4)', allClips[0].lurl);
      console.log('sample lth  (thumb)', allClips[0].lth);
    } else {
      console.log('no clips (game may not be final yet, or wrong SeasonType/Season)');
    }
  } catch (e) {
    const st = e.response?.status;
    const body = e.response?.data;
    console.log('error', st || e.message, typeof body === 'object' ? JSON.stringify(body).slice(0, 500) : body);
    process.exit(1);
  }
}

main();
