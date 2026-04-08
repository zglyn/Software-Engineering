import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ManagePlayersPage.css';

interface Player {
  id: string;
  name: string;
  position: string;
  number: string;
}

const ManagePlayersPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([
    { id: 'p1', name: 'LeBron James', position: 'F', number: '23' },
    { id: 'p2', name: 'Anthony Davis', position: 'F/C', number: '3' },
    { id: 'p3', name: 'Austin Reaves', position: 'G', number: '15' }
  ]);
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState('');
  const [newPlayerNum, setNewPlayerNum] = useState('');

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerPos || !newPlayerNum.trim()) return;

    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      name: newPlayerName,
      position: newPlayerPos,
      number: newPlayerNum
    };

    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setNewPlayerPos('');
    setNewPlayerNum('');
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(players.filter(player => player.id !== id));
  };

  return (
    <div className="managePlayersWrapper">
      <header className="managePlayersHeader">
        <Link to="/feed" className="managePlayersBackBtn">← Feed</Link>
        <h1 className="managePlayersTitle">Coach Dashboard: Roster</h1>
      </header>

      <div className="managePlayersContainer">
        
        {/* Add Player Section */}
        <div className="managePlayersCard">
          <h2 className="managePlayersCardTitle">Add New Player</h2>
          <form className="managePlayersForm" onSubmit={handleAddPlayer}>
            <div className="managePlayersInputGroup" style={{ flex: 2 }}>
              <label className="managePlayersLabel">Name</label>
              <input
                type="text"
                className="managePlayersInput"
                placeholder="e.g. D'Angelo Russell"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
              />
            </div>
            <div className="managePlayersInputGroup">
              <label className="managePlayersLabel">Position</label>
              <select 
                className="managePlayersSelect" 
                value={newPlayerPos} 
                onChange={e => setNewPlayerPos(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="PG">PG</option>
                <option value="SG">SG</option>
                <option value="SF">SF</option>
                <option value="PF">PF</option>
                <option value="C">C</option>
                <option value="G">G</option>
                <option value="F">F</option>
                <option value="F/C">F/C</option>
              </select>
            </div>
            <div className="managePlayersInputGroup" style={{ maxWidth: '80px' }}>
              <label className="managePlayersLabel">Number</label>
              <input
                type="number"
                className="managePlayersInput"
                placeholder="00"
                value={newPlayerNum}
                onChange={e => setNewPlayerNum(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="managePlayersBtnPrimary"
              disabled={!newPlayerName.trim() || !newPlayerPos || !newPlayerNum.trim()}
            >
              Add
            </button>
          </form>
        </div>

        {/* Existing Roster Section */}
        <div className="managePlayersCard">
          <h2 className="managePlayersCardTitle">Current Roster</h2>
          {players.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No players on roster.</p>
          ) : (
            <ul className="managePlayersList">
              {players.map(player => (
                <li key={player.id} className="managePlayersListItem">
                  <div className="managePlayersInfo">
                    <div className="managePlayersNumberBadge">
                      {player.number}
                    </div>
                    <div className="managePlayersDetails">
                      <span className="managePlayersName">{player.name}</span>
                      <span className="managePlayersPos">{player.position}</span>
                    </div>
                  </div>
                  <button 
                    className="managePlayersBtnDanger"
                    onClick={() => handleRemovePlayer(player.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default ManagePlayersPage;