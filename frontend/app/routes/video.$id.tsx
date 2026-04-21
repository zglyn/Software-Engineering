import React, { useEffect } from 'react';
import { Link, redirect, useLoaderData, useParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Buffer } from 'node:buffer';
import { getSession } from '~/services/session.server';
import { storageUserSegment } from '~/utils/storageUserSegment';
import { useUpload } from '../context/UploadContext';
import type { AnalysisResult } from '../context/UploadContext';
import './VideoPage.css';

const FAKE_ANALYSIS: AnalysisResult = {
  shotAccuracy: {
    fgPercent: 48.2,
    threePointPercent: 36.1,
    byZone: [
      { zone: 'Paint', made: 12, attempted: 18, percent: 66.7 },
      { zone: 'Mid-range', made: 5, attempted: 11, percent: 45.5 },
      { zone: 'Left corner 3', made: 2, attempted: 4, percent: 50 },
      { zone: 'Right corner 3', made: 1, attempted: 3, percent: 33.3 },
      { zone: 'Top of key 3', made: 3, attempted: 9, percent: 33.3 }
    ]
  },
  defensivePositioning: {
    contestRate: 72,
    positioningScore: 84,
    deflectionsPerGame: 2.1
  },
  keyStats: {
    pts: 24,
    reb: 7,
    ast: 6,
    stl: 1.2,
    blk: 0.8
  }
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  if (!id) return { mode: 'missing' as const };
  if (id.startsWith('vid-')) return { mode: 'context' as const, id };
  let objectPath: string;
  try {
    objectPath = Buffer.from(id, 'base64url').toString('utf8');
  } catch {
    return { mode: 'context' as const, id };
  }
  if (!objectPath.includes('/') || objectPath.includes('..') || objectPath.startsWith('/')) {
    return { mode: 'context' as const, id };
  }
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user?.id) throw redirect('/login');
  const uidSeg = storageUserSegment(user.id);
  if (!objectPath.startsWith(`${uidSeg}/`)) {
    return { mode: 'forbidden' as const };
  }
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  const res = await fetch(
    `${base}/api/uploads/video-url?userId=${encodeURIComponent(user.id)}&path=${encodeURIComponent(objectPath)}`
  );
  if (!res.ok) return { mode: 'context' as const, id };
  const j = (await res.json()) as { signedUrl?: string; name?: string };
  if (!j.signedUrl) return { mode: 'context' as const, id };
  let statsGenerated = false;
  let stats: { ft_0: number; ft_1: number; p2_0: number; p2_1: number; p3_0: number; p3_1: number; total_points: number } | null = null;
  try {
    const metaRes = await fetch(
      `${base}/api/videos/by-object-path?userId=${encodeURIComponent(user.id)}&path=${encodeURIComponent(objectPath)}`
    );
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { statsGenerated?: boolean; ft_0?: number; ft_1?: number; p2_0?: number; p2_1?: number; p3_0?: number; p3_1?: number; total_points?: number };
      statsGenerated = !!meta.statsGenerated;
      stats = {
        ft_0: Number(meta.ft_0) || 0,
        ft_1: Number(meta.ft_1) || 0,
        p2_0: Number(meta.p2_0) || 0,
        p2_1: Number(meta.p2_1) || 0,
        p3_0: Number(meta.p3_0) || 0,
        p3_1: Number(meta.p3_1) || 0,
        total_points: Number(meta.total_points) || 0,
      };
    }
  } catch {
    statsGenerated = false;
    stats = null;
  }
  return {
    mode: 'storage' as const,
    title: j.name ?? objectPath.split('/').pop() ?? 'Video',
    signedUrl: j.signedUrl,
    statsGenerated,
    stats,
  };
}

export default function VideoPage() {
  const loaderData = useLoaderData<typeof loader>();
  const { id: paramId } = useParams<{ id: string }>();
  const { videos, updateVideoAnalysis } = useUpload();

  if (loaderData.mode === 'missing' || !paramId) {
    return (
      <div className="videoPage">
        <div className="videoPageContent">
          <p className="videoPageMessage">Missing video ID.</p>
          <Link to="/uploads" className="videoPageBack">My uploads</Link>
        </div>
      </div>
    );
  }

  if (loaderData.mode === 'forbidden') {
    return (
      <div className="videoPage">
        <div className="videoPageContent">
          <p className="videoPageMessage">You do not have access to this video.</p>
          <Link to="/uploads" className="videoPageBack">My uploads</Link>
        </div>
      </div>
    );
  }

  if (loaderData.mode === 'storage') {
    return (
      <div className="videoPage">
        <header className="videoPageHeader">
          <Link to="/uploads" className="videoPageBack">← My uploads</Link>
        </header>
        <div className="videoPageContent">
          <h1 className="videoPageTitle">{loaderData.title}</h1>
          <div className="videoThumbWrap">
            <video className="videoThumbImg" src={loaderData.signedUrl} controls playsInline />
          </div>
          {!loaderData.statsGenerated && (
            <p className="videoPageNoStats">Stats not yet generated, please check again soon!</p>
          )}
          {loaderData.statsGenerated && loaderData.stats && (
            <div className="videoStats">
              <section className="videoStatSection">
                <h2 className="videoStatSectionTitle">Shooting stats</h2>
                <div className="videoDefensiveGrid">
                  <div className="videoDefensiveCard">
                    <span className="videoDefensiveLabel">FT</span>
                    <span className="videoDefensiveValue">{loaderData.stats.ft_1}/{loaderData.stats.ft_0 + loaderData.stats.ft_1}</span>
                  </div>
                  <div className="videoDefensiveCard">
                    <span className="videoDefensiveLabel">2PT</span>
                    <span className="videoDefensiveValue">{loaderData.stats.p2_1}/{loaderData.stats.p2_0 + loaderData.stats.p2_1}</span>
                  </div>
                  <div className="videoDefensiveCard">
                    <span className="videoDefensiveLabel">3PT</span>
                    <span className="videoDefensiveValue">{loaderData.stats.p3_1}/{loaderData.stats.p3_0 + loaderData.stats.p3_1}</span>
                  </div>
                  <div className="videoDefensiveCard">
                    <span className="videoDefensiveLabel">Points</span>
                    <span className="videoDefensiveValue">{loaderData.stats.total_points}</span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    );
  }

  const id = loaderData.id;
  const video = id ? videos[id] : undefined;

  useEffect(() => {
    if (!video || video.status !== 'pending_analysis' || !id) return;
    const t = setTimeout(() => {
      updateVideoAnalysis(id, FAKE_ANALYSIS);
    }, 4000);
    return () => clearTimeout(t);
  }, [video?.status, id, updateVideoAnalysis]);

  if (!video) {
    return (
      <div className="videoPage">
        <div className="videoPageContent">
          <p className="videoPageMessage">Video not found.</p>
          <Link to="/uploads" className="videoPageBack">My uploads</Link>
        </div>
      </div>
    );
  }

  const analysis = video.analysis;

  return (
    <div className="videoPage">
      <header className="videoPageHeader">
        <Link to="/uploads" className="videoPageBack">← My uploads</Link>
      </header>
      <div className="videoPageContent">
        <h1 className="videoPageTitle">{video.title}</h1>
        <div className="videoThumbWrap">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt="" className="videoThumbImg" />
          ) : (
            <div className="videoThumbPlaceholder" aria-hidden>No thumbnail</div>
          )}
        </div>
        {video.message && <p className="videoPageUserMessage">{video.message}</p>}
        {!analysis && (
          <p className="videoPageNoStats">Stats not yet generated, please check again soon!</p>
        )}
        {analysis && (
          <div className="videoStats">
            <section className="videoStatSection">
              <h2 className="videoStatSectionTitle">Shot accuracy</h2>
              <div className="videoShotSummary">
                <div className="videoShotSummaryItem">
                  <span className="videoShotLabel">FG%</span>
                  <span className="videoShotValue">{analysis.shotAccuracy.fgPercent}%</span>
                </div>
                <div className="videoShotSummaryItem">
                  <span className="videoShotLabel">3P%</span>
                  <span className="videoShotValue">{analysis.shotAccuracy.threePointPercent}%</span>
                </div>
              </div>
              <div className="videoZoneTableWrap">
                <table className="videoZoneTable">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Made</th>
                      <th>Attempted</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.shotAccuracy.byZone.map((row, i) => (
                      <tr key={i}>
                        <td>{row.zone}</td>
                        <td>{row.made}</td>
                        <td>{row.attempted}</td>
                        <td>{row.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="videoStatSection">
              <h2 className="videoStatSectionTitle">Defensive positioning</h2>
              <div className="videoDefensiveGrid">
                <div className="videoDefensiveCard">
                  <span className="videoDefensiveLabel">Contest rate</span>
                  <span className="videoDefensiveValue">{analysis.defensivePositioning.contestRate}%</span>
                </div>
                <div className="videoDefensiveCard">
                  <span className="videoDefensiveLabel">Positioning score</span>
                  <span className="videoDefensiveValue">{analysis.defensivePositioning.positioningScore}</span>
                </div>
                <div className="videoDefensiveCard">
                  <span className="videoDefensiveLabel">Deflections / game</span>
                  <span className="videoDefensiveValue">{analysis.defensivePositioning.deflectionsPerGame}</span>
                </div>
              </div>
            </section>
            <section className="videoStatSection">
              <h2 className="videoStatSectionTitle">Key stats</h2>
              <div className="videoKeyStatsGrid">
                <div className="videoKeyStatItem"><span className="videoKeyStatLabel">PTS</span><span className="videoKeyStatValue">{analysis.keyStats.pts}</span></div>
                <div className="videoKeyStatItem"><span className="videoKeyStatLabel">REB</span><span className="videoKeyStatValue">{analysis.keyStats.reb}</span></div>
                <div className="videoKeyStatItem"><span className="videoKeyStatLabel">AST</span><span className="videoKeyStatValue">{analysis.keyStats.ast}</span></div>
                {analysis.keyStats.stl != null && <div className="videoKeyStatItem"><span className="videoKeyStatLabel">STL</span><span className="videoKeyStatValue">{analysis.keyStats.stl}</span></div>}
                {analysis.keyStats.blk != null && <div className="videoKeyStatItem"><span className="videoKeyStatLabel">BLK</span><span className="videoKeyStatValue">{analysis.keyStats.blk}</span></div>}
              </div>
            </section>
            {analysis.heatmapImageUrl && (
              <section className="videoStatSection">
                <h2 className="videoStatSectionTitle">Movement heatmap</h2>
                <div className="videoHeatmapWrap">
                  <img src={analysis.heatmapImageUrl} alt="Movement heatmap" className="videoHeatmapImg" />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

