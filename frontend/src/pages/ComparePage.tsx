import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAYERS_BY_ID, TEAMS_BY_ID } from '../data/mockStats';
import './ComparePage.css';

type CompareMode = 'players' | 'teams';

const ComparePage: React.FC = () => {
  const [mode, setMode] = useState<CompareMode>('players');
  const [id1, setId1] = useState<string>('');
  const [id2, setId2] = useState<string>('');

  const handleModeChange = (newMode: CompareMode) => {
    setMode(newMode);
    setId1('');
    setId2('');
  };

  const players = Object.values(PLAYERS_BY_ID);
  const teams = Object.values(TEAMS_BY_ID);

  const getPlayerStat = (playerId: string, category: 'stats' | 'shooting' | 'advanced', label: string) => {
    if (!playerId) return '-';
    const player = PLAYERS_BY_ID[playerId];
    const statObj = player[category]?.find(s => s.label === label);
    return statObj ? statObj.value : '-';
  };

  const getTeamMetric = (teamId: string, category: 'metrics' | 'advancedMetrics', label: string) => {
    if (!teamId) return '-';
    const team = TEAMS_BY_ID[teamId];
    const metricObj = team[category]?.find(m => m.label === label);
    return metricObj ? metricObj.value : '-';
  };

  // Extract unique labels for players
  const playerBaseStats = ['PTS', 'REB', 'AST', 'STL', 'BLK'];
  const playerShootingStats = ['FG%', '3P%', 'FT%', 'eFG%', 'TS%'];
  const playerAdvancedStats = ['MPG', 'TOV', 'PF', '+/−'];

  // Extract unique labels for teams
  const teamBaseMetrics = ['PPG', 'Def Rtg', 'Pace', 'RPG', 'APG', '3P%'];
  const teamAdvancedMetrics = ['Off Rtg', 'Net Rtg', 'TOV%', 'Opp PPG'];

  const item1Name = mode === 'players' ? PLAYERS_BY_ID[id1]?.name : TEAMS_BY_ID[id1]?.name;
  const item2Name = mode === 'players' ? PLAYERS_BY_ID[id2]?.name : TEAMS_BY_ID[id2]?.name;

  return (
    <div className="comparePageWrapper">
      <header className="compareHeader">
        <Link to="/feed" className="compareBackBtn">← Feed</Link>
        <h1 className="compareTitle">Compare {mode === 'players' ? 'Players' : 'Teams'}</h1>
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
          <div className="compareSelectGroup">
            <label className="compareLabel">{mode === 'players' ? 'Player 1' : 'Team 1'}</label>
            <select className="compareSelect" value={id1} onChange={e => setId1(e.target.value)}>
              <option value="">Select...</option>
              {mode === 'players'
                ? players.map(p => <option key={`p1-${p.id}`} value={p.id}>{p.name}</option>)
                : teams.map(t => <option key={`t1-${t.id}`} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          
          <div className="compareVsBadge">VS</div>

          <div className="compareSelectGroup">
            <label className="compareLabel">{mode === 'players' ? 'Player 2' : 'Team 2'}</label>
            <select className="compareSelect" value={id2} onChange={e => setId2(e.target.value)}>
              <option value="">Select...</option>
              {mode === 'players'
                ? players.map(p => <option key={`p2-${p.id}`} value={p.id}>{p.name}</option>)
                : teams.map(t => <option key={`t2-${t.id}`} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {id1 && id2 && (
          <div className="compareTableCard">
            <div className="compareTableHeader">
              <div className="compareColItem">{item1Name}</div>
              <div className="compareColLabel">Stat</div>
              <div className="compareColItem">{item2Name}</div>
            </div>

            {mode === 'players' ? (
              <>
                <div className="compareSectionTitle">Per Game Stats</div>
                {playerBaseStats.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getPlayerStat(id1, 'stats', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getPlayerStat(id2, 'stats', label)}</div>
                  </div>
                ))}

                <div className="compareSectionTitle">Shooting</div>
                {playerShootingStats.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getPlayerStat(id1, 'shooting', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getPlayerStat(id2, 'shooting', label)}</div>
                  </div>
                ))}

                <div className="compareSectionTitle">Advanced</div>
                {playerAdvancedStats.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getPlayerStat(id1, 'advanced', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getPlayerStat(id2, 'advanced', label)}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="compareSectionTitle">Team Metrics</div>
                {teamBaseMetrics.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getTeamMetric(id1, 'metrics', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getTeamMetric(id2, 'metrics', label)}</div>
                  </div>
                ))}

                <div className="compareSectionTitle">Advanced Metrics</div>
                {teamAdvancedMetrics.map(label => (
                  <div className="compareTableRow" key={label}>
                    <div className="compareColItem">{getTeamMetric(id1, 'advancedMetrics', label)}</div>
                    <div className="compareColLabel">{label}</div>
                    <div className="compareColItem">{getTeamMetric(id2, 'advancedMetrics', label)}</div>
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