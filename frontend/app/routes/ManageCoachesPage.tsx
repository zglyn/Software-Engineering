import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ManageCoachesPage.css';

interface Coach {
  id: string;
  name: string;
  role: string;
}

const ManageCoachesPage: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([
    { id: 'c1', name: 'Darvin Ham', role: 'Head Coach' },
    { id: 'c2', name: 'Mike Hunt', role: 'Assistant Coach' }
  ]);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachRole, setNewCoachRole] = useState('');

  const handleAddCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoachName.trim() || !newCoachRole.trim()) return;

    const newCoach: Coach = {
      id: `c-${Date.now()}`,
      name: newCoachName,
      role: newCoachRole
    };

    setCoaches([...coaches, newCoach]);
    setNewCoachName('');
    setNewCoachRole('');
  };

  const handleRemoveCoach = (id: string) => {
    setCoaches(coaches.filter(coach => coach.id !== id));
  };

  return (
    <div className="manageCoachesWrapper">
      <header className="manageCoachesHeader">
        <Link to="/feed" className="manageCoachesBackBtn">← Feed</Link>
        <h1 className="manageCoachesTitle">Manager Dashboard: Coaches</h1>
      </header>

      <div className="manageCoachesContainer">
        
        {/* Add Coach Section */}
        <div className="manageCoachesCard">
          <h2 className="manageCoachesCardTitle">Add New Coach</h2>
          <form className="manageCoachesForm" onSubmit={handleAddCoach}>
            <div className="manageCoachesInputGroup">
              <label className="manageCoachesLabel">Name</label>
              <input
                type="text"
                className="manageCoachesInput"
                placeholder="e.g. Phil Jackson"
                value={newCoachName}
                onChange={e => setNewCoachName(e.target.value)}
              />
            </div>
            <div className="manageCoachesInputGroup">
              <label className="manageCoachesLabel">Role</label>
              <input
                type="text"
                className="manageCoachesInput"
                placeholder="e.g. Assistant Coach"
                value={newCoachRole}
                onChange={e => setNewCoachRole(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="manageCoachesBtnPrimary"
              disabled={!newCoachName.trim() || !newCoachRole.trim()}
            >
              Add
            </button>
          </form>
        </div>

        {/* Existing Coaches Section */}
        <div className="manageCoachesCard">
          <h2 className="manageCoachesCardTitle">Current Coaching Staff</h2>
          {coaches.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No coaches found.</p>
          ) : (
            <ul className="manageCoachesList">
              {coaches.map(coach => (
                <li key={coach.id} className="manageCoachesListItem">
                  <div className="manageCoachesInfo">
                    <span className="manageCoachesName">{coach.name}</span>
                    <span className="manageCoachesRole">{coach.role}</span>
                  </div>
                  <button 
                    className="manageCoachesBtnDanger"
                    onClick={() => handleRemoveCoach(coach.id)}
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

export default ManageCoachesPage;