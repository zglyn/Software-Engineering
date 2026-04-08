import React from 'react';
import { useParams, Link } from 'react-router';
import { PLAYERS_BY_ID } from '../data/mockStats';
import './PlayerStatsPage.css';

function trendSym(t: 'up' | 'down' | 'neutral') {
  return t === 'up' ? '↑' : t === 'down' ? '↓' : '−';
}

export default function PlayerStatsPage() {
  const { id } = useParams<{ id: string }>();
  const player = id ? PLAYERS_BY_ID[id] : undefined;

  if (!id) {
    return (
      <div className="playerStatsPage">
        <div className="playerStatsContent">
          <p className="playerStatsMessage">Missing player ID.</p>
          <Link to="/feed" className="playerStatsBack">← Feed</Link>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="playerStatsPage">
        <div className="playerStatsContent">
          <p className="playerStatsMessage">Player not found.</p>
          <Link to="/feed" className="playerStatsBack">← Feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="playerStatsPage">
      <header className="playerStatsHeader">
        <Link to="/feed" className="playerStatsBack">← Feed</Link>
      </header>
      <div className="playerStatsContent">
        <h1 className="playerStatsName">{player.name}</h1>
        <p className="playerStatsPosition">{player.position}</p>
        {player.gameContext && <p className="playerStatsGameContext">{player.gameContext}</p>}
        <section className="playerStatsSection">
          <h2 className="playerStatsSectionTitle">Stats</h2>
          <div className="playerStatsGrid">
            {player.stats.map((s, i) => (
              <div key={i} className="playerStatsCard">
                <span className="playerStatsLabel">{s.label}</span>
                <span className="playerStatsValue">{s.value}{s.trend ? ` ${trendSym(s.trend)}` : ''}</span>
              </div>
            ))}
          </div>
        </section>
        {player.shooting && player.shooting.length > 0 && (
          <section className="playerStatsSection">
            <h2 className="playerStatsSectionTitle">Shooting</h2>
            <div className="playerStatsGrid">
              {player.shooting.map((s, i) => (
                <div key={i} className="playerStatsCard">
                  <span className="playerStatsLabel">{s.label}</span>
                  <span className="playerStatsValue">{s.value}{s.trend ? ` ${trendSym(s.trend)}` : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {player.advanced && player.advanced.length > 0 && (
          <section className="playerStatsSection">
            <h2 className="playerStatsSectionTitle">Advanced</h2>
            <div className="playerStatsGrid">
              {player.advanced.map((s, i) => (
                <div key={i} className="playerStatsCard">
                  <span className="playerStatsLabel">{s.label}</span>
                  <span className="playerStatsValue">{s.value}{s.trend ? ` ${trendSym(s.trend)}` : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {player.trendSummary && (
          <section className="playerStatsSection">
            <h2 className="playerStatsSectionTitle">Trend</h2>
            <p className="playerStatsTrend">{player.trendSummary}</p>
          </section>
        )}
      </div>
    </div>
  );
}
