# AI Coding Agent Instructions

## Project Overview
This is a React-based video analytics platform focused on basketball player performance analysis. The app allows users to upload game footage, receive AI-powered analysis (shooting accuracy, defensive positioning, key stats), and browse a curated feed of basketball content.

## Architecture

### Core Components
- **App.tsx**: Router setup with six main routes (Home, Feed, Video, MyUploads, PlayerStats, TeamStats)
- **UploadContext.tsx**: Global state for video records with analysis results. Provides `useUpload()` hook.
- **FeedPage.tsx**: Main content hub displaying mixed feed items (game results, player stats, team snapshots, trends)
- **UploadModal.tsx**: Modal component for video file uploads with progress tracking

### State Management Pattern
- **Context API** (not Redux): `UploadProvider` wraps entire app via `App.tsx`
- Videos stored as `Record<string, VideoRecord>` indexed by ID
- Actions: `addVideo()`, `getVideo()`, `updateVideoAnalysis()`
- **Video lifecycle**: `pending_analysis` → `completed` status transition

### Data Models
Key types in [UploadContext.tsx](src/context/UploadContext.tsx):
- `VideoRecord`: id, title, thumbnailUrl, status, createdAt, analysis
- `AnalysisResult`: shotAccuracy, defensivePositioning, keyStats, heatmapImageUrl
- `ShotAccuracy`: fgPercent, threePointPercent, byZone (zone-level breakdown)
- `DefensivePositioning`: contestRate, positioningScore, deflectionsPerGame

### Pages Structure
- `/`: HomePage - Minimal landing page
- `/feed`: FeedPage - Multi-type feed (game_result, player_stat, team_snapshot, trend_insight, etc.)
- `/video/:id`: VideoPage - Displays analysis results with simulated backend delay
- `/uploads`: MyUploadsPage - User's uploaded videos
- `/player/:id`: PlayerStatsPage - Player detail page with stats breakdown
- `/team/:id`: TeamStatsPage - Team overview with roster and metrics

## Developer Workflows

### Local Development
```bash
npm start          # Start dev server on port 3000
npm test           # Run tests (React Testing Library + Jest)
npm run build      # Production build
npm run eject      # Expose CRA config (one-way operation)
```

### Testing
- **Test runner**: react-scripts test (CRA wrapper around Jest)
- **Testing libraries**: @testing-library/react, @testing-library/jest-dom
- **Test files**: Named `*.test.tsx` (e.g., App.test.tsx)
- Convention: tests colocated with components

## Key Patterns & Conventions

### TypeScript Strict Mode
- **tsconfig.json** has `strict: true` enabled
- Always type component props and state
- Use explicit return type annotations: `React.FC` for components

### React Patterns
- **Functional components only** - No class components
- **Hooks convention**: `useUpload()` custom hook for context access
- Component imports: Named exports from components, default export from pages
- **No prop destructuring in component signature** - Use destructuring in function body (matches current codebase style)

### File Organization
```
src/
  components/     → Reusable UI components (UploadModal)
  context/        → Global state providers (UploadContext)
  pages/          → Route-level pages (VideoPage, PlayerStatsPage, etc.)
  data/           → Mock data and type definitions (mockStats.ts)
```

### Styling Approach
- **CSS modules implicit** - Component.tsx paired with Component.css
- **No CSS-in-JS library** - Plain CSS files
- CSS files import in components: `import './ComponentName.css'`

### Mock Data
- [mockStats.ts](src/data/mockStats.ts) contains `PLAYERS_BY_ID` and team data
- VideoPage uses `FAKE_ANALYSIS` constant for simulated backend response
- Simulated async delay: `setTimeout()` in useEffect for analysis completion

## Integration Patterns

### Upload Flow (UploadModal → UploadContext → VideoPage)
1. User selects file in UploadModal
2. On submit, `addVideo()` creates VideoRecord with `pending_analysis` status
3. VideoPage detects pending status, simulates analysis via setTimeout
4. `updateVideoAnalysis()` updates record → status becomes `completed`

### Feed Item Rendering (FeedPage)
- `FeedItem` union type covers 10 different content types
- Each type has optional nested object (gameResult, playerStat, teamSnapshot, etc.)
- Rendering determined by `type` property with conditional JSX

## Dependencies
- **react ^19.2.4** - App framework
- **react-router-dom ^7.13.1** - Client-side routing (BrowserRouter, Routes, useParams)
- **typescript ^4.9.5** - Type safety (target: ES5)
- **react-scripts 5.0.1** - CRA build tool (no custom webpack config)
- Testing: @testing-library/react, jest-dom

## Common Tasks

### Adding a New Page
1. Create file in [src/pages/](src/pages/)
2. Add Route in [App.tsx](src/App.tsx) with new path
3. Use `useUpload()` if needing video context access
4. Create accompanying .css file for styles

### Adding a New Feed Type
1. Add type to `FeedItemType` union in [FeedPage.tsx](src/FeedPage.tsx)
2. Add property to `FeedItem` interface
3. Add mock data to `FOR_YOU_MOCK` array
4. Add conditional rendering case for new type

### Accessing Video Data
Always use `const { videos, getVideo } = useUpload()` pattern; context hook throws if used outside UploadProvider.

## Gotchas & Conventions
- **No circular imports** - Context only imports types, components import context
- **useState objects**: Immutable pattern required (e.g., in updateVideoAnalysis)
- **useParams return type**: Must explicitly type generic `useParams<{ id: string }>()`
- **CSS imports order**: Import after JSX imports but before function definition
