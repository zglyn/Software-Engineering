import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UploadProvider } from './context/UploadContext';
import FeedPage from './FeedPage';
import CompareStatsOnly from './CompareStatsOnly';
import CompareWithMoney from './ComparewithMoney';
import Login from './Login';
import Profile from './Profile';
import VideoPage from './pages/VideoPage';
import MyUploadsPage from './pages/MyUploadsPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import TeamStatsPage from './pages/TeamStatsPage';
import CreateTeamPage from './pages/CreateTeamPage';
import ComparePage from './pages/ComparePage';
import InsightsPage from './pages/InsightsPage';
import StartPage from './pages/StartPage';
import PlayersPage from './pages/PlayersPage';
import StatsPage from './pages/StatsPage';
import ManagementPage from './pages/ManagementPage';

const App: React.FC = () => {
  return (
    <Router>
      <UploadProvider>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/management" element={<ManagementPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/compare-stats-only" element={<CompareStatsOnly />} />
          <Route path="/compare-money" element={<CompareWithMoney />} />
          <Route path="/uploads" element={<MyUploadsPage />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/player/:id" element={<PlayerStatsPage />} />
          <Route path="/team/:id" element={<TeamStatsPage />} />
          <Route path="/create-team" element={<CreateTeamPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/insights" element={<InsightsPage />} />
        </Routes>
      </UploadProvider>
    </Router>
  );
};

export default App;