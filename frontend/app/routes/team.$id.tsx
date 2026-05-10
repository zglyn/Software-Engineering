import React from 'react';
import { useParams, Link } from 'react-router';
import { TEAMS_BY_ID } from '../data/mockStats';
import './TeamStatsPage.css';

export default function TeamStatsPage() {
  const { id } = useParams<{ id: string }>();
  const team = id ? TEAMS_BY_ID[id] : undefined;

  if (!id) {
    return (
      <div className="teamStatsPage">
        <div className="teamStatsContent">
          <p className="teamStatsMessage">Missing team ID.</p>
          <Link to="/feed" className="teamStatsBack">← Feed</Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="teamStatsPage">
        <div className="teamStatsContent">
          <p className="teamStatsMessage">Team not found.</p>
          <Link to="/feed" className="teamStatsBack">← Feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="teamStatsPage">
      <header className="teamStatsHeader">
        <Link to="/feed" className="teamStatsBack">← Feed</Link>
      </header>
      <div className="teamStatsContent">
        <h1 className="teamStatsName">{team.name}</h1>
        <p className="teamStatsRecord">{team.record}</p>
        <p className="teamStatsTrend">{team.trend}</p>
        <section className="teamStatsSection">
          <h2 className="teamStatsSectionTitle">Team metrics</h2>
          <div className="teamStatsGrid">
            {team.metrics.map((m, i) => (
              <div key={i} className="teamStatsCard">
                <span className="teamStatsLabel">{m.label}</span>
                <span className="teamStatsValue">{m.value}</span>
              </div>
            ))}
          </div>
        </section>
        {team.advancedMetrics && team.advancedMetrics.length > 0 && (
          <section className="teamStatsSection">
            <h2 className="teamStatsSectionTitle">Advanced metrics</h2>
            <div className="teamStatsGrid">
              {team.advancedMetrics.map((m, i) => (
                <div key={i} className="teamStatsCard">
                  <span className="teamStatsLabel">{m.label}</span>
                  <span className="teamStatsValue">{m.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {team.roster.length > 0 && (
          <section className="teamStatsSection">
            <h2 className="teamStatsSectionTitle">Top performers</h2>
            <ul className="teamStatsRoster">
              {team.roster.map((entry, i) => (
                <li key={i} className="teamStatsRosterItem">
                  <span className="teamStatsRosterName">{entry.name}</span>
                  <span className="teamStatsRosterValue">{entry.value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
