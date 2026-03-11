import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Home</h1>
      <ul>
        <li><Link to="/start">Start</Link></li>
        <li><Link to="/public">Public</Link></li>
        <li><Link to="/feed">Feed</Link></li>
        <li><Link to="/uploads">My Uploads</Link></li>
        <li><Link to="/players">Players</Link></li>
        <li><Link to="/stats">Stats</Link></li>
        <li><Link to="/management">Management</Link></li>
        <li><Link to="/create-team">Create Team</Link></li>
        <li><Link to="/compare">Compare</Link></li>
        <li><Link to="/insights">Insights</Link></li>
        <li><Link to="/player/lebron-james">Player (sample)</Link></li>
        <li><Link to="/team/lakers">Team (sample)</Link></li>
        <li><Link to="/video/demo">Video (sample)</Link></li>
      </ul>
    </div>
  );
};
export default HomePage;