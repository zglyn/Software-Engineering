import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { describe, it, expect, vi } from 'vitest';
import TeamStatsPage from '../../app/routes/team.$id';

vi.mock('../../app/data/mockStats', () => ({
  TEAMS_BY_ID: {
    '101': {
      name: 'Eagles',
      record: '10-2',
      trend: 'Winning streak',
      metrics: [{ label: 'Offensive Rating', value: 115.2 }],
      roster: []
    }
  }
}));

describe('TeamStatsPage', () => {
  it('renders missing team ID message when no ID is provided', () => {
    render(
      <MemoryRouter initialEntries={['/team']}>
        <Routes>
          <Route path="/team" element={<TeamStatsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Missing team ID.')).toBeInTheDocument();
  });

  it('renders team stats when a valid ID is provided', () => {
    render(
      <MemoryRouter initialEntries={['/team/101']}>
        <Routes>
          <Route path="/team/:id" element={<TeamStatsPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Eagles')).toBeInTheDocument();
    expect(screen.getByText('10-2')).toBeInTheDocument();
    expect(screen.getByText('Offensive Rating')).toBeInTheDocument();
  });
});