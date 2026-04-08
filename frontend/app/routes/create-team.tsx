import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { TEAMS_BY_ID } from '../data/mockStats';
import './CreateTeamPage.css';

const CreateTeamPage: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      
      const newTeamId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      TEAMS_BY_ID[newTeamId] = {
        id: newTeamId,
        name: teamName,
        record: '0–0',
        trend: description || 'Newly created team.',
        metrics: [
          { label: 'PPG', value: '0.0' },
          { label: 'Def Rtg', value: '0.0' },
          { label: 'Pace', value: '0.0' },
        ],
        advancedMetrics: [],
        roster: []
      };

      navigate(`/team/${newTeamId}`);
    }, 800);
  };

  return (
    <div className="createTeamWrapper">
      <div className="createTeamContainer">
        <div className="createTeamHeader">
          <h1 className="createTeamTitle">Create a New Team</h1>
          <p className="createTeamSubtitle">Set up your roster, track stats, and manage highlights.</p>
        </div>

        <form className="createTeamCard" onSubmit={handleSubmit}>
          <label className="createTeamLabel">
            Team Name
            <input
              type="text"
              className="createTeamInput"
              placeholder="e.g. Los Angeles Lakers"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="createTeamLabel">
            Description
            <textarea
              className="createTeamTextarea"
              placeholder="Add a short description about the team (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </label>

          <div className="createTeamToggleWrap">
            <label className="createTeamCheckboxLabel">
              <input
                type="checkbox"
                className="createTeamCheckbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                disabled={loading}
              />
              <span className="createTeamToggleText">
                <strong>Make Team Private</strong>
                <small>Only invited members can view stats and highlights.</small>
              </span>
            </label>
          </div>

          <div className="createTeamFooter">
            <button 
              type="button" 
              className="createTeamBtn createTeamBtnSecondary" 
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="createTeamBtn createTeamBtnPrimary"
              disabled={!teamName.trim() || loading}
            >
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamPage;
