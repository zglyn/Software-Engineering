import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import './InsightsPage.css';

type ApiTeamRow = {
  team_id?: number | string;
  name?: string;
  team?: { name?: string };
  stats?: unknown;
};

function decodeDynamoValue(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const obj = v as Record<string, unknown>;
  if (typeof obj.S === 'string') return obj.S;
  if (typeof obj.N === 'string') return Number(obj.N);
  if (obj.NULL === true) return null;
  if (Array.isArray(obj.L)) return obj.L.map(decodeDynamoValue);
  if (obj.M && typeof obj.M === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, vv] of Object.entries(obj.M as Record<string, unknown>)) out[k] = decodeDynamoValue(vv);
    return out;
  }
  return v;
}

function normalizeTeamStats(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return normalizeTeamStats(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw != null) {
    const obj = raw as Record<string, unknown>;
    if (obj.M) {
      const decoded = decodeDynamoValue(raw);
      if (decoded && typeof decoded === 'object') return decoded as Record<string, unknown>;
    }
    return obj;
  }
  return {};
}

type TeamRow = {
  id: string;
  name: string;
  stats: Record<string, unknown>;
};

function mapApiTeam(raw: ApiTeamRow): TeamRow | null {
  const tid = raw.team_id;
  if (tid == null || tid === '') return null;
  const id = String(tid);
  const name =
    (typeof raw.team?.name === 'string' && raw.team.name.trim()) ||
    (typeof raw.name === 'string' && raw.name.trim()) ||
    `Team ${id}`;
  return { id, name, stats: normalizeTeamStats(raw.stats) };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  const isCoach = Boolean(user && (user.groups ?? []).includes('coaches'));
  let defaultTeamId: string | null = null;

  let teams: TeamRow[] = [];
  try {
    const r = await fetch(`${base}/api/teams`);
    if (r.ok) {
      const data = (await r.json()) as ApiTeamRow[];
      teams = (Array.isArray(data) ? data : [])
        .map(mapApiTeam)
        .filter((t): t is TeamRow => t != null)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    teams = [];
  }

  if (isCoach && user?.id) {
    try {
      const r = await fetch(`${base}/api/players/by-coach?coachId=${encodeURIComponent(user.id)}`);
      if (r.ok) {
        const data = (await r.json()) as { teamId?: number | string };
        if (data.teamId != null && data.teamId !== '') defaultTeamId = String(data.teamId);
      }
    } catch { }
  }

  return { teams, defaultTeamId, backendBaseUrl: base };
}

const InsightsPage: React.FC = () => {
  const { teams, defaultTeamId, backendBaseUrl } = useLoaderData<typeof loader>();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(defaultTeamId ?? (teams[0]?.id ?? ''));
  const [recentGames, setRecentGames] = useState<{ gameDate: string | null; matchup: string | null; wl: string | null; scored: number | null; allowed: number | null }[]>([]);

  const teamsById = useMemo(() => {
    const m: Record<string, TeamRow> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  const team = teamsById[selectedTeamId] ?? null;

  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const fmt = (key: string, v: unknown) => {
    if (v == null || v === '') return '-';
    if (typeof v === 'number') {
      if (key.endsWith('_PCT')) return `${(v * 100).toFixed(1)}%`;
      if (Number.isInteger(v)) return String(v);
      return v.toFixed(2);
    }
    return String(v);
  };

  const rankOf = (key: string, dir: 'high' | 'low') => {
    const rows = teams
      .map((t) => ({ id: t.id, v: n(t.stats[key]) }))
      .filter((x): x is { id: string; v: number } => x.v != null);
    if (!team) return null;
    const me = n(team.stats[key]);
    if (me == null) return null;
    rows.sort((a, b) => (dir === 'high' ? b.v - a.v : a.v - b.v));
    const idx = rows.findIndex((r) => r.id === team.id);
    if (idx < 0) return null;
    return { rank: idx + 1, total: rows.length };
  };

  const fmtRk = (r: { rank: number; total: number } | null) => (r ? `${r.rank}/${r.total}` : '');

  const w = team ? n(team.stats.W) : null;
  const l = team ? n(team.stats.L) : null;
  const record = w != null && l != null ? `${w}-${l}` : '-';

  const pts = team ? n(team.stats.PTS) : null;
  const fg = team ? n(team.stats.FG_PCT) : null;
  const fg3 = team ? n(team.stats.FG3_PCT) : null;
  const ft = team ? n(team.stats.FT_PCT) : null;
  const pm = team ? n(team.stats.PLUS_MINUS) : null;
  const ast = team ? n(team.stats.AST) : null;
  const reb = team ? n(team.stats.REB) : null;
  const tov = team ? n(team.stats.TOV) : null;
  const stl = team ? n(team.stats.STL) : null;
  const blk = team ? n(team.stats.BLK) : null;
  const pf = team ? n(team.stats.PF) : null;

  const ptsRank = rankOf('PTS', 'high');
  const pmRank = rankOf('PLUS_MINUS', 'high');
  const fgRank = rankOf('FG_PCT', 'high');
  const threeRank = rankOf('FG3_PCT', 'high');
  const astRank = rankOf('AST', 'high');
  const rebRank = rankOf('REB', 'high');
  const tovRank = rankOf('TOV', 'low');
  const pfRank = rankOf('PF', 'low');

  useEffect(() => {
    let cancelled = false;
    if (!selectedTeamId) return;
    (async () => {
      try {
        const r = await fetch(`${backendBaseUrl}/api/team-gamelog?teamId=${encodeURIComponent(selectedTeamId)}&limit=5`);
        if (!r.ok) return;
        const data = (await r.json()) as { games?: any[] };
        const list = Array.isArray(data.games) ? data.games : [];
        const mapped = list.map((g) => ({
          gameDate: g?.gameDate ?? null,
          matchup: g?.matchup ?? null,
          wl: g?.wl ?? null,
          scored: typeof g?.scored === 'number' ? g.scored : (typeof g?.scored === 'string' ? Number(g.scored) : null),
          allowed: typeof g?.allowed === 'number' ? g.allowed : (typeof g?.allowed === 'string' ? Number(g.allowed) : null)
        }));
        if (!cancelled) setRecentGames(mapped);
      } catch {
        if (!cancelled) setRecentGames([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTeamId, backendBaseUrl]);

  return (
    <div className="insightsPageWrapper">
      <header className="insightsHeader">
        <Link to="/feed" className="insightsBackBtn">← Feed</Link>
      </header>

      <div className="insightsContainer">
        <div className="insightsControls">
          <label className="insightsLabel">Select Team to Analyze</label>
          <select
            className="insightsSelect"
            value={selectedTeamId}
            onChange={e => setSelectedTeamId(e.target.value)}
          >
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {team && (
          <div className="insightsGrid">
            <div className="insightsCard">
              <h2 className="insightsCardTitle">Season Overview</h2>

              <div className="insightsRecordBlock">
                <span className="insightsRecordValue">{record}</span>
                <span className="insightsRecordLabel">Current Win/Loss Record</span>
              </div>

              <div className="insightsMetricsList">
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Point Differential</span>
                  <span className="insightsMetricValue">{pm != null ? fmt('PLUS_MINUS', pm) : '-'}</span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Points Per Game</span>
                  <span className="insightsMetricValue">{pts != null ? fmt('PTS', pts) : '-'}</span>
                </div>
                <div className="insightsMetricItem insightsMetricItem--stacked">
                  <span className="insightsMetricLabel">Shooting</span>
                  <div className="insightsShootingStrip">
                    <div className="insightsShotChip">
                      <span className="insightsShotChipLab">FG</span>
                      <span className="insightsShotChipVal">{fg != null ? fmt('FG_PCT', fg) : '—'}</span>
                    </div>
                    <div className="insightsShotChip">
                      <span className="insightsShotChipLab">3P</span>
                      <span className="insightsShotChipVal">{fg3 != null ? fmt('FG3_PCT', fg3) : '—'}</span>
                    </div>
                    <div className="insightsShotChip">
                      <span className="insightsShotChipLab">FT</span>
                      <span className="insightsShotChipVal">{ft != null ? fmt('FT_PCT', ft) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="insightsCard insightsChartCard">
              <h2 className="insightsCardTitle">Recent Games (Last 5)</h2>

              {recentGames.length === 0 ? (
                <div className="compareEmpty">No recent game data.</div>
              ) : (
                <>
                  <div className="insightsChartLegend">
                    <div className="legendItem"><span className="legendBox scored"></span> Points Scored</div>
                    <div className="legendItem"><span className="legendBox allowed"></span> Opponent Points</div>
                  </div>

                  <div className="insightsChart">
                    {recentGames.map((game, index) => {
                      const scored = typeof game.scored === 'number' && Number.isFinite(game.scored) ? game.scored : 0;
                      const allowedNum =
                        typeof game.allowed === 'number' && Number.isFinite(game.allowed) ? game.allowed : null;
                      const hasAllowed = allowedNum != null;
                      const maxScore = Math.max(scored, hasAllowed ? allowedNum! : 0, 110);
                      const scoredHeight = (scored / maxScore) * 100;
                      const allowedHeight = hasAllowed ? (allowedNum! / maxScore) * 100 : Math.max(6, scoredHeight * 0.12);
                      return (
                        <div className="chartColumn" key={index}>
                          <div className="barGroup">
                            <div className="bar scoredBar" style={{ height: `${scoredHeight}%` }}>
                              <span className="barTooltip">{scored}</span>
                            </div>
                            <div
                              className={`bar allowedBar${hasAllowed ? '' : ' allowedBar--unknown'}`}
                              style={{ height: `${allowedHeight}%` }}
                            >
                              <span className="barTooltip">{hasAllowed ? allowedNum : '—'}</span>
                            </div>
                          </div>
                          <div className="chartXAxis">
                            <span className={`gameResult ${game.wl === 'W' ? 'textWin' : 'textLoss'}`}>
                              {game.wl || '-'}
                            </span>
                            <span className="gameOpponent">{game.matchup ? String(game.matchup) : '-'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <h2 className="insightsCardTitle" style={{ marginTop: '18px' }}>League Position</h2>

              <div className="insightsMetricsList">
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">PPG</span>
                  <span className="insightsMetricValue">
                    {pts != null ? fmt('PTS', pts) : '-'}
                    {ptsRank ? <span className="insightsMetricRank">{fmtRk(ptsRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Point Differential</span>
                  <span className="insightsMetricValue">
                    {pm != null ? fmt('PLUS_MINUS', pm) : '-'}
                    {pmRank ? <span className="insightsMetricRank">{fmtRk(pmRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">FG%</span>
                  <span className="insightsMetricValue">
                    {fg != null ? fmt('FG_PCT', fg) : '-'}
                    {fgRank ? <span className="insightsMetricRank">{fmtRk(fgRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">3P%</span>
                  <span className="insightsMetricValue">
                    {fg3 != null ? fmt('FG3_PCT', fg3) : '-'}
                    {threeRank ? <span className="insightsMetricRank">{fmtRk(threeRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Assists</span>
                  <span className="insightsMetricValue">
                    {ast != null ? fmt('AST', ast) : '-'}
                    {astRank ? <span className="insightsMetricRank">{fmtRk(astRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Rebounds</span>
                  <span className="insightsMetricValue">
                    {reb != null ? fmt('REB', reb) : '-'}
                    {rebRank ? <span className="insightsMetricRank">{fmtRk(rebRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Turnovers</span>
                  <span className="insightsMetricValue">
                    {tov != null ? fmt('TOV', tov) : '-'}
                    {tovRank ? <span className="insightsMetricRank">{fmtRk(tovRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Fouls</span>
                  <span className="insightsMetricValue">
                    {pf != null ? fmt('PF', pf) : '-'}
                    {pfRank ? <span className="insightsMetricRank">{fmtRk(pfRank)}</span> : null}
                  </span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Stocks (STL + BLK)</span>
                  <span className="insightsMetricValue">
                    {(stl != null ? fmt('STL', stl) : '-')}{' + '}{(blk != null ? fmt('BLK', blk) : '-')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsPage;
