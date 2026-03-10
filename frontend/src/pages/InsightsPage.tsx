import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TEAMS_BY_ID } from '../data/mockStats';
import './InsightsPage.css';

// Local mock data for game-by-game analysis and expected metrics
const MOCK_INSIGHTS_DATA: Record<string, any> = {
  'lakers': {
    expectedWins: '48.5',
    playoffProbability: '82%',
    offensivePotential: 'Elite (Top 5)',
    recentGames: [
      { opponent: 'BOS', scored: 112, allowed: 108, result: 'W' },
      { opponent: 'MIA', scored: 105, allowed: 110, result: 'L' },
      { opponent: 'GSW', scored: 124, allowed: 118, result: 'W' },
      { opponent: 'PHX', scored: 116, allowed: 110, result: 'W' },
      { opponent: 'DEN', scored: 102, allowed: 114, result: 'L' },
    ]
  },
  'celtics': {
    expectedWins: '60.2',
    playoffProbability: '99%',
    offensivePotential: 'Historic (Top 1)',
    recentGames: [
      { opponent: 'LAL', scored: 108, allowed: 112, result: 'L' },
      { opponent: 'MIA', scored: 118, allowed: 104, result: 'W' },
      { opponent: 'NYK', scored: 110, allowed: 105, result: 'W' },
      { opponent: 'PHI', scored: 122, allowed: 98, result: 'W' },
      { opponent: 'MIL', scored: 115, allowed: 110, result: 'W' },
    ]
  },
  'heat': {
    expectedWins: '44.0',
    playoffProbability: '65%',
    offensivePotential: 'Average (Top 15)',
    recentGames: [
      { opponent: 'BOS', scored: 104, allowed: 118, result: 'L' },
      { opponent: 'LAL', scored: 110, allowed: 105, result: 'W' },
      { opponent: 'ORL', scored: 98, allowed: 95, result: 'W' },
      { opponent: 'ATL', scored: 112, allowed: 115, result: 'L' },
      { opponent: 'IND', scored: 120, allowed: 111, result: 'W' },
    ]
  }
};

const InsightsPage: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('lakers');
  const teams = Object.values(TEAMS_BY_ID);

  const team = TEAMS_BY_ID[selectedTeamId];
  const insights = MOCK_INSIGHTS_DATA[selectedTeamId] || MOCK_INSIGHTS_DATA['lakers'];

  return (
    <div className="insightsPageWrapper">
      <header className="insightsHeader">
        <Link to="/feed" className="insightsBackBtn">← Feed</Link>
        <h1 className="insightsTitle">Team Insights</h1>
      </header>

      <div className="insightsContainer">
        <div className="insightsControls">
          <label className="insightsLabel">Select Team to Analyze</label>
          <select 
            className="insightsSelect" 
            value={selectedTeamId} 
            onChange={e => setSelectedTeamId(e.target.value)}
          >
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {team && (
          <div className="insightsGrid">
            {/* Record & Potentials Card */}
            <div className="insightsCard">
              <h2 className="insightsCardTitle">Season Overview</h2>
              
              <div className="insightsRecordBlock">
                <span className="insightsRecordValue">{team.record}</span>
                <span className="insightsRecordLabel">Current Win/Loss Record</span>
              </div>

              <div className="insightsMetricsList">
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Expected Wins</span>
                  <span className="insightsMetricValue">{insights.expectedWins}</span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Playoff Probability</span>
                  <span className="insightsMetricValue">{insights.playoffProbability}</span>
                </div>
                <div className="insightsMetricItem">
                  <span className="insightsMetricLabel">Offensive Potential</span>
                  <span className="insightsMetricValue">{insights.offensivePotential}</span>
                </div>
              </div>
            </div>

            {/* Game-by-Game Score Analysis */}
            <div className="insightsCard insightsChartCard">
              <h2 className="insightsCardTitle">Score Analysis (Last 5 Games)</h2>
              <div className="insightsChartLegend">
                <div className="legendItem"><span className="legendBox scored"></span> Points Scored</div>
                <div className="legendItem"><span className="legendBox allowed"></span> Points Allowed</div>
              </div>
              
              <div className="insightsChart">
                {insights.recentGames.map((game: any, index: number) => {
                  const maxScore = Math.max(game.scored, game.allowed, 130); // Base height off 130 max
                  const scoredHeight = (game.scored / maxScore) * 100;
                  const allowedHeight = (game.allowed / maxScore) * 100;

                  return (
                    <div className="chartColumn" key={index}>
                      <div className="barGroup">
                        <div className="bar scoredBar" style={{ height: `${scoredHeight}%` }}>
                          <span className="barTooltip">{game.scored}</span>
                        </div>
                        <div className="bar allowedBar" style={{ height: `${allowedHeight}%` }}>
                          <span className="barTooltip">{game.allowed}</span>
                        </div>
                      </div>
                      <div className="chartXAxis">
                        <span className={`gameResult ${game.result === 'W' ? 'textWin' : 'textLoss'}`}>
                          {game.result}
                        </span>
                        <span className="gameOpponent">vs {game.opponent}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsPage;