import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UploadProvider } from './context/UploadContext';
import HomePage from './HomePage';
import FeedPage from './FeedPage';
import VideoPage from './pages/VideoPage';
import MyUploadsPage from './pages/MyUploadsPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import TeamStatsPage from './pages/TeamStatsPage';

const App: React.FC = () => {
  return (
    <Router>
      <UploadProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/uploads" element={<MyUploadsPage />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/player/:id" element={<PlayerStatsPage />} />
          <Route path="/team/:id" element={<TeamStatsPage />} />
        </Routes>
      </UploadProvider>
    </Router>
  );
};

export default App;