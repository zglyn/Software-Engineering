import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import './ComparePage.css';

interface TeamMetric {
  label: string;
  value: string;
}

interface CompareTeam {
  id: string;
  name: string;
  stats: Record<string, unknown>;
}

type ApiTeamRow = {
  team_id?: number | string;
  name?: string;
  team?: {
    name?: string;
    metrics?: TeamMetric[];
    advancedMetrics?: TeamMetric[];
  };
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

function mapApiTeamToCompareTeam(raw: ApiTeamRow): CompareTeam | null {
  const tid = raw.team_id;
  if (tid == null || tid === '') return null;
  const id = String(tid);
  const nested = raw.team && typeof raw.team === 'object' ? raw.team : {};
  const name =
    (typeof nested.name === 'string' && nested.name.trim()) ||
    (typeof raw.name === 'string' && raw.name.trim()) ||
    `Team ${id}`;
  return {
    id,
    name,
    stats: normalizeTeamStats(raw.stats),
  };
}

interface PlayerStats {
  ft0: number;
  ft1: number;
  p2_0: number;
  p2_1: number;
  p3_0: number;
  p3_1: number;
  total_points: number;
}

interface Player {
  player_id: number;
  name: string;
  position?: string;
  height?: string;
  weight?: string;
  jersey?: string;
  draft_year?: string;
  stats?: PlayerStats;
}

type CompareMode = 'players' | 'teams';

export async function loader({ request }: LoaderFunctionArgs) {
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  let players: Player[] = [];
  let teams: CompareTeam[] = [];
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  const isCoach = Boolean(user && (user.groups ?? []).includes('coaches'));
  let defaultTeamId: string | null = null;
  try {
    const [playersRes, teamsRes] = await Promise.all([
      fetch(`${base}/api/players`),
      fetch(`${base}/api/teams`),
    ]);
    if (playersRes.ok) {
      const data = await playersRes.json() as Player[];
      players = data.filter(p => p.player_id && p.name);
    }
    if (teamsRes.ok) {
      const data = await teamsRes.json() as ApiTeamRow[];
      teams = (Array.isArray(data) ? data : [])
        .map(mapApiTeamToCompareTeam)
        .filter((t): t is CompareTeam => t != null)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    players = [];
    teams = [];
  }
  if (isCoach && user?.id) {
    try {
      const r = await fetch(`${base}/api/players/by-coach?coachId=${encodeURIComponent(user.id)}`);
      if (r.ok) {
        const data = (await r.json()) as { teamId?: number | string };
        if (data.teamId != null && data.teamId !== '') defaultTeamId = String(data.teamId);
      }
    } catch {}
  }
  return { players, teams, defaultTeamId };
}

function pct(made: number, attempted: number): string {
  if (!attempted) return '-';
  return (made / attempted * 100).toFixed(1) + '%';
}

function deriveStats(s?: PlayerStats) {
  if (!s) return null;
  const fta = (s.ft0 ?? 0) + (s.ft1 ?? 0);
  const p2a = (s.p2_0 ?? 0) + (s.p2_1 ?? 0);
  const p3a = (s.p3_0 ?? 0) + (s.p3_1 ?? 0);
  return {
    'Total Points': s.total_points ?? '-',
    '2PM': s.p2_1 ?? 0,
    '2PA': p2a,
    '2P%': pct(s.p2_1 ?? 0, p2a),
    '3PM': s.p3_1 ?? 0,
    '3PA': p3a,
    '3P%': pct(s.p3_1 ?? 0, p3a),
    'FTM': s.ft1 ?? 0,
    'FTA': fta,
    'FT%': pct(s.ft1 ?? 0, fta),
  };
}

type DerivedStats = NonNullable<ReturnType<typeof deriveStats>>;

interface PlayerComboboxProps {
  players: Player[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
  excludeId: number | null;
}

function PlayerCombobox({ players, value, onChange, label, excludeId }: PlayerComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = players.find(p => p.player_id === value) ?? null;
  const filtered = players
    .filter(p => p.player_id !== excludeId)
    .filter(p => !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (p: Player) => {
    onChange(p.player_id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="compareSelectGroup" ref={ref}>
      <label className="compareLabel">{label}</label>
      <div className="compareComboboxWrap">
        <input
          type="text"
          className="compareComboboxInput"
          placeholder="Search player..."
          value={open ? query : (selected?.name ?? '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          autoComplete="off"
        />
        {selected && !open && (
          <button type="button" className="compareComboboxClear" onClick={handleClear}>✕</button>
        )}
        {open && filtered.length > 0 && (
          <ul className="compareComboboxDropdown">
            {filtered.map(p => (
              <li key={p.player_id} className="compareComboboxItem" onMouseDown={() => handleSelect(p)}>
                <span>{p.name}</span>
                {p.position && <span className="compareComboboxSub">{p.position}</span>}
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && filtered.length === 0 && (
          <div className="compareComboboxEmpty">No players match</div>
        )}
      </div>
    </div>
  );
}

const ComparePage: React.FC = () => {
  const { players, teams: teamsList, defaultTeamId } = useLoaderData<typeof loader>();
  const [mode, setMode] = useState<CompareMode>('players');
  const [id1, setId1] = useState<number | null>(null);
  const [id2, setId2] = useState<number | null>(null);
  const [teamId1, setTeamId1] = useState(defaultTeamId ?? '');
  const [teamId2, setTeamId2] = useState('');

  const teamsById = useMemo(() => {
    const m: Record<string, CompareTeam> = {};
    for (const t of teamsList) {
      m[t.id] = t;
    }
    return m;
  }, [teamsList]);

  const handleModeChange = (newMode: CompareMode) => {
    setMode(newMode);
    setId1(null);
    setId2(null);
    setTeamId1(defaultTeamId ?? '');
    setTeamId2('');
  };

  useEffect(() => {
    if (mode !== 'teams') return;
    if (teamId1) return;
    if (defaultTeamId) setTeamId1(defaultTeamId);
  }, [mode, teamId1, defaultTeamId]);

  const player1 = players.find(p => p.player_id === id1);
  const player2 = players.find(p => p.player_id === id2);
  const stats1 = deriveStats(player1?.stats);
  const stats2 = deriveStats(player2?.stats);
  const statKeys = stats1 ? Object.keys(stats1) as (keyof DerivedStats)[] : (stats2 ? Object.keys(stats2) as (keyof DerivedStats)[] : []);

  const profileFields: { label: string; key: keyof Player }[] = [
    { label: 'Position', key: 'position' },
    { label: 'Height', key: 'height' },
    { label: 'Weight (lbs)', key: 'weight' },
    { label: 'Jersey', key: 'jersey' },
    { label: 'Draft Year', key: 'draft_year' },
  ];

  const formatTeamStat = (key: string, v: unknown): string => {
    if (v == null || v === '') return '-';
    if (typeof v === 'number') {
      if (key.endsWith('_PCT')) return `${(v * 100).toFixed(1)}%`;
      if (Number.isInteger(v)) return String(v);
      return v.toFixed(2);
    }
    return String(v);
  };

  const getTeamStat = (teamId: string, key: string) => {
    if (!teamId) return '-';
    const team = teamsById[teamId];
    if (!team) return '-';
    return formatTeamStat(key, team.stats[key]);
  };

  const teamBaseStats: { label: string; key: string }[] = [
    { label: 'Games', key: 'GP' },
    { label: 'Wins', key: 'W' },
    { label: 'Losses', key: 'L' },
    { label: 'Win %', key: 'W_PCT' },
    { label: 'PPG', key: 'PTS' },
    { label: 'FG%', key: 'FG_PCT' },
    { label: '3P%', key: 'FG3_PCT' },
    { label: 'FT%', key: 'FT_PCT' },
    { label: 'REB', key: 'REB' },
    { label: 'AST', key: 'AST' },
    { label: 'TOV', key: 'TOV' },
    { label: '+/-', key: 'PLUS_MINUS' },
  ];

  const item1Name = mode === 'players' ? (player1?.name ?? '') : (teamsById[teamId1]?.name ?? '');
  const item2Name = mode === 'players' ? (player2?.name ?? '') : (teamsById[teamId2]?.name ?? '');
  const showComparison = mode === 'players' ? (id1 !== null && id2 !== null) : (!!teamId1 && !!teamId2);

  return (
    <div className="comparePageWrapper">
      <header className="compareHeader">
        <Link to="/feed" className="compareBackBtn">← Feed</Link>
      </header>

      <div className="compareContainer">
        <div className="compareTabs">
          <button
            className={`compareTab ${mode === 'players' ? 'compareTabActive' : ''}`}
            onClick={() => handleModeChange('players')}
          >
            Players
          </button>
          <button
            className={`compareTab ${mode === 'teams' ? 'compareTabActive' : ''}`}
            onClick={() => handleModeChange('teams')}
          >
            Teams
          </button>
        </div>

        <div className="compareControls">
          {mode === 'players' ? (
            <>
              <PlayerCombobox players={players} value={id1} onChange={setId1} label="Player 1" excludeId={id2} />
              <div className="compareVsBadge">VS</div>
              <PlayerCombobox players={players} value={id2} onChange={setId2} label="Player 2" excludeId={id1} />
            </>
          ) : (
            <>
              <div className="compareSelectGroup">
                <label className="compareLabel">Team 1</label>
                <select className="compareSelect" value={teamId1} onChange={e => setTeamId1(e.target.value)}>
                  <option value="">Select...</option>
                  {teamsList.filter(t => t.id !== teamId2).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="compareVsBadge">VS</div>
              <div className="compareSelectGroup">
                <label className="compareLabel">Team 2</label>
                <select className="compareSelect" value={teamId2} onChange={e => setTeamId2(e.target.value)}>
                  <option value="">Select...</option>
                  {teamsList.filter(t => t.id !== teamId1).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {showComparison && (
          <div className="compareTableCard">
            <div className="compareTableHeader">
              <div className="compareColItem">{item1Name}</div>
              <div className="compareColLabel">Stat</div>
              <div className="compareColItem">{item2Name}</div>
            </div>

            {mode === 'players' ? (
              <>
                <div className="compareSectionTitle">Profile</div>
                {profileFields.map(({ label, key }) => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{(player1?.[key] as string) ?? '-'}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{(player2?.[key] as string) ?? '-'}</div>
                  </div>
                ))}

                <div className="compareSectionTitle">Scoring</div>
                {statKeys.map(key => (
                  <div className="compareTableRow" key={key}>
                    <div className="compareColItem">{stats1 ? stats1[key] : '-'}</div>
                    <div className="compareColLabel">{key}</div>
                    <div className="compareColItem">{stats2 ? stats2[key] : '-'}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="compareSectionTitle">Team Stats</div>
                {teamBaseStats.map(({ label, key }) => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getTeamStat(teamId1, key)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getTeamStat(teamId2, key)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
