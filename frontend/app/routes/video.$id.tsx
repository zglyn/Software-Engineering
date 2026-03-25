import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router';
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

export default function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const { videos, updateVideoAnalysis } = useUpload();
  const video = id ? videos[id] : undefined;

  useEffect(() => {
    if (!video || video.status !== 'pending_analysis' || !id) return;
    const t = setTimeout(() => {
      updateVideoAnalysis(id, FAKE_ANALYSIS);
    }, 4000);
    return () => clearTimeout(t);
  }, [video?.status, id, updateVideoAnalysis]);

  if (!id) {
    return (
      <div className="videoPage">
        <div className="videoPageContent">
          <p className="videoPageMessage">Missing video ID.</p>
          <Link to="/feed" className="videoPageBack">Back to feed</Link>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="videoPage">
        <div className="videoPageContent">
          <p className="videoPageMessage">Video not found.</p>
          <Link to="/feed" className="videoPageBack">Back to feed</Link>
        </div>
      </div>
    );
  }

  const isPending = video.status === 'pending_analysis';
  const analysis = video.analysis;

  return (
    <div className="videoPage">
      <header className="videoPageHeader">
        <Link to="/feed" className="videoPageBack">← Feed</Link>
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
        {isPending && (
          <div className="videoPendingBlock">
            <p className="videoPendingText">Analysis in progress…</p>
            <p className="videoPendingSub">Performance metrics will appear here when ready. This may take a few minutes.</p>
          </div>
        )}
        {!isPending && analysis && (
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
