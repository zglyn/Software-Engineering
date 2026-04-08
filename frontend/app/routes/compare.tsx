import React, { useState, useRef, useEffect } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { TEAMS_BY_ID } from '../data/mockStats';
import './ComparePage.css';

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
  const base = process.env.BACKEND_URL;
  let players: Player[] = [];
  try {
    const res = await fetch(`${base}/api/players`);
    if (res.ok) {
      const data = await res.json() as Player[];
      players = data.filter(p => p.player_id && p.name);
    }
  } catch {
    players = [];
  }
  return { players };
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
  const { players } = useLoaderData<typeof loader>();
  const [mode, setMode] = useState<CompareMode>('players');
  const [id1, setId1] = useState<number | null>(null);
  const [id2, setId2] = useState<number | null>(null);
  const [teamId1, setTeamId1] = useState('');
  const [teamId2, setTeamId2] = useState('');

  const teams = Object.values(TEAMS_BY_ID);

  const handleModeChange = (newMode: CompareMode) => {
    setMode(newMode);
    setId1(null);
    setId2(null);
    setTeamId1('');
    setTeamId2('');
  };

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

  const getTeamMetric = (teamId: string, category: 'metrics' | 'advancedMetrics', label: string) => {
    if (!teamId) return '-';
    const team = TEAMS_BY_ID[teamId];
    const metricObj = team[category]?.find(m => m.label === label);
    return metricObj ? metricObj.value : '-';
  };

  const teamBaseMetrics = ['PPG', 'Def Rtg', 'Pace', 'RPG', 'APG', '3P%'];
  const teamAdvancedMetrics = ['Off Rtg', 'Net Rtg', 'TOV%', 'Opp PPG'];

  const item1Name = mode === 'players' ? (player1?.name ?? '') : TEAMS_BY_ID[teamId1]?.name;
  const item2Name = mode === 'players' ? (player2?.name ?? '') : TEAMS_BY_ID[teamId2]?.name;
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
                  {teams.filter(t => t.id !== teamId2).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="compareVsBadge">VS</div>
              <div className="compareSelectGroup">
                <label className="compareLabel">Team 2</label>
                <select className="compareSelect" value={teamId2} onChange={e => setTeamId2(e.target.value)}>
                  <option value="">Select...</option>
                  {teams.filter(t => t.id !== teamId1).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                <div className="compareSectionTitle">Team Metrics</div>
                {teamBaseMetrics.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getTeamMetric(teamId1, 'metrics', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getTeamMetric(teamId2, 'metrics', label)}</div>
                  </div>
                ))}
                <div className="compareSectionTitle">Advanced Metrics</div>
                {teamAdvancedMetrics.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getTeamMetric(teamId1, 'advancedMetrics', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getTeamMetric(teamId2, 'advancedMetrics', label)}</div>
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
