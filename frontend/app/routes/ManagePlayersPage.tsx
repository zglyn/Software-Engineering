import React, { useState, useEffect } from 'react';
import { Link, redirect, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import './ManagePlayersPage.css';

interface Player {
  player_id: number;
  name: string;
  position?: string;
  jersey?: string;
  height?: string;
  weight?: string;
  draft_year?: string;
  birthdate?: string;
  headshot_url?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user || !(user.groups ?? []).includes('coaches')) {
    throw redirect('/feed');
  }

  const base = process.env.BACKEND_URL;
  let players: Player[] = [];
  let teamId: number | null = null;

  try {
    const res = await fetch(`${base}/api/players/by-coach?coachId=${user.id}`);
    if (res.ok) {
      const data = await res.json() as { players: Player[]; teamId: number };
      players = data.players ?? [];
      teamId = data.teamId ?? null;
    }
  } catch {
    players = [];
  }

  return { players, teamId };
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'F/C'];

const ManagePlayersPage: React.FC = () => {
  const { players: loadedPlayers } = useLoaderData<typeof loader>();
  const [players, setPlayers] = useState<Player[]>(loadedPlayers);
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('');
  const [newJersey, setNewJersey] = useState('');

  useEffect(() => {
    setPlayers(loadedPlayers);
  }, [loadedPlayers]);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPos || !newJersey.trim()) return;
    const newPlayer: Player = {
      player_id: Date.now(),
      name: newName.trim(),
      position: newPos,
      jersey: newJersey.trim(),
    };
    setPlayers(prev => [...prev, newPlayer]);
    setNewName('');
    setNewPos('');
    setNewJersey('');
  };

  return (
    <div className="managePlayersWrapper">
      <header className="managePlayersHeader">
        <Link to="/feed" className="managePlayersBackBtn">← Feed</Link>
      </header>

      <div className="managePlayersContainer">
        <div className="managePlayersCard">
          <h2 className="managePlayersCardTitle">Add New Player</h2>
          <form className="managePlayersForm" onSubmit={handleAddPlayer}>
            <div className="managePlayersInputGroup" style={{ flex: 2 }}>
              <label className="managePlayersLabel">Name</label>
              <input
                type="text"
                className="managePlayersInput"
                placeholder="e.g. D'Angelo Russell"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="managePlayersInputGroup">
              <label className="managePlayersLabel">Position</label>
              <select
                className="managePlayersSelect"
                value={newPos}
                onChange={e => setNewPos(e.target.value)}
              >
                <option value="">Select...</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="managePlayersInputGroup" style={{ maxWidth: '80px' }}>
              <label className="managePlayersLabel">Jersey</label>
              <input
                type="number"
                className="managePlayersInput"
                placeholder="00"
                value={newJersey}
                onChange={e => setNewJersey(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="managePlayersBtnPrimary"
              disabled={!newName.trim() || !newPos || !newJersey.trim()}
            >
              Add
            </button>
          </form>
        </div>

        <div className="managePlayersCard">
          <h2 className="managePlayersCardTitle">Current Roster</h2>
          {players.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No players found for your team.</p>
          ) : (
            <div className="managePlayersGrid">
              {players.map(player => (
                <div key={player.player_id} className="managePlayersGridItem">
                  <div className="managePlayersCardTop">
                    {player.headshot_url && (
                      <img
                        src={player.headshot_url}
                        alt={player.name}
                        className="managePlayersHeadshot"
                      />
                    )}
                    <div className="managePlayersCardIdentity">
                      <span className="managePlayersName">{player.name}</span>
                      <div className="managePlayersCardMeta">
                        <div className="managePlayersNumberBadge">#{player.jersey ?? '—'}</div>
                        <span className="managePlayersPos">{player.position ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="managePlayersCardStats">
                    <div className="managePlayersStatItem">
                      <span className="managePlayersStatLabel">Height</span>
                      <span className="managePlayersStatValue">{player.height ?? '—'}</span>
                    </div>
                    <div className="managePlayersStatItem">
                      <span className="managePlayersStatLabel">Weight</span>
                      <span className="managePlayersStatValue">{player.weight ? `${player.weight} lbs` : '—'}</span>
                    </div>
                    <div className="managePlayersStatItem">
                      <span className="managePlayersStatLabel">Draft</span>
                      <span className="managePlayersStatValue">{player.draft_year ?? '—'}</span>
                    </div>
                    <div className="managePlayersStatItem">
                      <span className="managePlayersStatLabel">Born</span>
                      <span className="managePlayersStatValue">
                        {player.birthdate ? player.birthdate.substring(0, 10) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagePlayersPage;
