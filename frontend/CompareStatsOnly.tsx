import React, { useState } from "react";
import "./ComparePage.css";

type Player = {
  name: string;
  points: number;
  rebounds: number;
  assists: number;
  fgPercent: number;
  threePPercent: number;
  ftPercent: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

type Team = {
  name: string;
  players: Player[];
};

const teams: Team[] = [
  {
    name: "Lakers",
    players: [
      { name: "LeBron James", points: 28, rebounds: 7, assists: 8, fgPercent: 51, threePPercent: 34, ftPercent: 69, steals: 1, blocks: 1, turnovers: 3 },
      { name: "AD", points: 22, rebounds: 9, assists: 3, fgPercent: 49, threePPercent: 30, ftPercent: 74, steals: 0, blocks: 2, turnovers: 2 },
    ],
  },
  {
    name: "Warriors",
    players: [
      { name: "Stephen Curry", points: 30, rebounds: 5, assists: 6, fgPercent: 48, threePPercent: 42, ftPercent: 91, steals: 2, blocks: 0, turnovers: 3 },
      { name: "Klay Thompson", points: 22, rebounds: 4, assists: 3, fgPercent: 45, threePPercent: 38, ftPercent: 85, steals: 1, blocks: 1, turnovers: 2 },
    ],
  },
  {
    name: "Heat",
    players: [
      { name: "Jimmy Butler", points: 27, rebounds: 6, assists: 7, fgPercent: 50, threePPercent: 30, ftPercent: 83, steals: 1, blocks: 1, turnovers: 3 },
      { name: "Bam Adebayo", points: 20, rebounds: 9, assists: 5, fgPercent: 51, threePPercent: 25, ftPercent: 72, steals: 1, blocks: 2, turnovers: 2 },
    ],
  },
];

const CompareStatsOnly: React.FC = () => {
  const [mode, setMode] = useState<"players" | "teams">("players");
  const [playerAIndex, setPlayerAIndex] = useState(0);
  const [playerBIndex, setPlayerBIndex] = useState(0);
  const [teamAIndex, setTeamAIndex] = useState(0);
  const [teamBIndex, setTeamBIndex] = useState(1);

  const sumStats = (team: Team) =>
    team.players.reduce(
      (acc, p) => {
        acc.points += p.points;
        acc.rebounds += p.rebounds;
        acc.assists += p.assists;
        acc.fgPercent += p.fgPercent;
        acc.threePPercent += p.threePPercent;
        acc.ftPercent += p.ftPercent;
        acc.steals += p.steals;
        acc.blocks += p.blocks;
        acc.turnovers += p.turnovers;
        return acc;
      },
      { points: 0, rebounds: 0, assists: 0, fgPercent: 0, threePPercent: 0, ftPercent: 0, steals: 0, blocks: 0, turnovers: 0 }
    );

  const efficiency = (p: Player) => p.points + p.rebounds + p.assists + p.steals + p.blocks - p.turnovers;

  const renderCompare = () => {
    if (mode === "players") {
      const pA = teams[0].players[playerAIndex];
      const pB = teams[1].players[playerBIndex];
      return (
        <div className="roundedBox">
          <table>
            <thead>
              <tr>
                <th>Stat</th>
                <th>{pA.name}</th>
                <th>{pB.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Points</td><td>{pA.points}</td><td>{pB.points}</td></tr>
              <tr><td>Rebounds</td><td>{pA.rebounds}</td><td>{pB.rebounds}</td></tr>
              <tr><td>Assists</td><td>{pA.assists}</td><td>{pB.assists}</td></tr>
              <tr><td>FG%</td><td>{pA.fgPercent}</td><td>{pB.fgPercent}</td></tr>
              <tr><td>3P%</td><td>{pA.threePPercent}</td><td>{pB.threePPercent}</td></tr>
              <tr><td>FT%</td><td>{pA.ftPercent}</td><td>{pB.ftPercent}</td></tr>
              <tr><td>Steals</td><td>{pA.steals}</td><td>{pB.steals}</td></tr>
              <tr><td>Blocks</td><td>{pA.blocks}</td><td>{pB.blocks}</td></tr>
              <tr><td>Turnovers</td><td>{pA.turnovers}</td><td>{pB.turnovers}</td></tr>
              <tr><td>Efficiency</td><td>{efficiency(pA)}</td><td>{efficiency(pB)}</td></tr>
            </tbody>
          </table>
        </div>
      );
    } else {
      const tA = teams[teamAIndex];
      const tB = teams[teamBIndex];
      const sA = sumStats(tA);
      const sB = sumStats(tB);
      return (
        <div className="roundedBox">
          <table>
            <thead>
              <tr>
                <th>Stat</th>
                <th>{tA.name}</th>
                <th>{tB.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Points</td><td>{sA.points}</td><td>{sB.points}</td></tr>
              <tr><td>Rebounds</td><td>{sA.rebounds}</td><td>{sB.rebounds}</td></tr>
              <tr><td>Assists</td><td>{sA.assists}</td><td>{sB.assists}</td></tr>
              <tr><td>FG%</td><td>{(sA.fgPercent/tA.players.length).toFixed(1)}</td><td>{(sB.fgPercent/tB.players.length).toFixed(1)}</td></tr>
              <tr><td>3P%</td><td>{(sA.threePPercent/tA.players.length).toFixed(1)}</td><td>{(sB.threePPercent/tB.players.length).toFixed(1)}</td></tr>
              <tr><td>FT%</td><td>{(sA.ftPercent/tA.players.length).toFixed(1)}</td><td>{(sB.ftPercent/tB.players.length).toFixed(1)}</td></tr>
              <tr><td>Steals</td><td>{sA.steals}</td><td>{sB.steals}</td></tr>
              <tr><td>Blocks</td><td>{sA.blocks}</td><td>{sB.blocks}</td></tr>
              <tr><td>Turnovers</td><td>{sA.turnovers}</td><td>{sB.turnovers}</td></tr>
              <tr><td>Efficiency</td>
                  <td>{((sA.points+sA.rebounds+sA.assists+sA.steals+sA.blocks-sA.turnovers)/tA.players.length).toFixed(1)}</td>
                  <td>{((sB.points+sB.rebounds+sB.assists+sB.steals+sB.blocks-sB.turnovers)/tB.players.length).toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div>
      <h1 className="ProfileCSS">Basketball Compare (Public)</h1>
      <div className="nav-tabs">
        <div className={`nav-tab ${mode==="players"?"active":""}`} onClick={()=>setMode("players")}>Players vs Players</div>
        <div className={`nav-tab ${mode==="teams"?"active":""}`} onClick={()=>setMode("teams")}>Teams vs Teams</div>
      </div>
      <div className="roundedBox ButtonAlign">
        {mode==="players"?(
          <>
            <select className="roundedButtons" value={playerAIndex} onChange={(e)=>setPlayerAIndex(parseInt(e.target.value))}>
              {teams[0].players.map((p,i)=><option key={i} value={i}>{p.name}</option>)}
            </select>
            <select className="roundedButtons" value={playerBIndex} onChange={(e)=>setPlayerBIndex(parseInt(e.target.value))}>
              {teams[1].players.map((p,i)=><option key={i} value={i}>{p.name}</option>)}
            </select>
          </>
        ):(
          <>
            <select className="roundedButtons" value={teamAIndex} onChange={(e)=>setTeamAIndex(parseInt(e.target.value))}>
              {teams.map((t,i)=><option key={i} value={i}>{t.name}</option>)}
            </select>
            <select className="roundedButtons" value={teamBIndex} onChange={(e)=>setTeamBIndex(parseInt(e.target.value))}>
              {teams.map((t,i)=><option key={i} value={i}>{t.name}</option>)}
            </select>
          </>
        )}
      </div>
      {renderCompare()}
    </div>
  );
};

export default CompareStatsOnly;