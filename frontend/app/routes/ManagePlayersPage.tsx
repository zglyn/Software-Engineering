import React, { useState, useEffect } from 'react';
import { Link, redirect, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "~/services/dynamodb.server";
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

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  
  if (!user || !(user.groups ?? []).includes('coaches')) {
    throw redirect('/feed');
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'write_note') {
    const receiverId = formData.get('receiverId') as string;
    const noteText = formData.get('noteText') as string;

    try {
      await dynamo.send(new PutCommand({
        TableName: "Notes",
        Item: {
          sender_userid: user.id,
          receiver_userid: receiverId,
          message: noteText,
          createdAt: new Date().toISOString()
        }
      }));
      return { success: true };
    } catch (error) {
      console.error("DynamoDB Note Write Error:", error);
      return { error: "Failed to send note." };
    }
  }
  return null;
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
  const fetcher = useFetcher();
  
  const [players, setPlayers] = useState<Player[]>(loadedPlayers);
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('');
  const [newJersey, setNewJersey] = useState('');
  
  // Note Modal State
  const [noteModalPlayer, setNoteModalPlayer] = useState<Player | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    setPlayers(loadedPlayers);
  }, [loadedPlayers]);

  // Close the modal and clear text when the fetcher successfully submits
  useEffect(() => {
    if (fetcher.data?.success) {
      setNoteModalPlayer(null);
      setNoteText('');
      alert("Note sent successfully!");
    }
  }, [fetcher.data]);

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
                      {/* Name & Note Button Wrapper */}
                      <div className="managePlayersNameRow">
                        <span className="managePlayersName">{player.name}</span>
                        <button
                          className="managePlayersNoteBtn"
                          onClick={() => setNoteModalPlayer(player)}
                          title="Write a note"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                      
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

      {/* Note Writing Modal */}
      {noteModalPlayer && (
        <div className="managePlayersModalOverlay">
          <div className="managePlayersModal">
            <h3 className="managePlayersModalTitle">Note for {noteModalPlayer.name}</h3>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="write_note" />
              <input type="hidden" name="receiverId" value={noteModalPlayer.player_id} />
              <textarea
                name="noteText"
                className="managePlayersTextarea"
                placeholder="Type your note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                required
              />
              <div className="managePlayersModalActions">
                <button
                  type="button"
                  className="managePlayersBtnCancel"
                  onClick={() => setNoteModalPlayer(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="managePlayersBtnPrimary"
                  disabled={fetcher.state === "submitting" || !noteText.trim()}
                >
                  {fetcher.state === "submitting" ? "Sending..." : "Send Note"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePlayersPage;