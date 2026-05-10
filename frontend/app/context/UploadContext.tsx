import React, { createContext, useContext, useState, useCallback } from 'react';

export type VideoStatus = 'pending_analysis' | 'completed';

export interface ShotAccuracy {
  fgPercent: number;
  threePointPercent: number;
  byZone: { zone: string; made: number; attempted: number; percent: number }[];
}

export interface DefensivePositioning {
  contestRate: number;
  positioningScore: number;
  deflectionsPerGame: number;
}

export interface KeyStats {
  pts: number;
  reb: number;
  ast: number;
  stl?: number;
  blk?: number;
}

export interface AnalysisResult {
  heatmapImageUrl?: string;
  shotAccuracy: ShotAccuracy;
  defensivePositioning: DefensivePositioning;
  keyStats: KeyStats;
}

export interface VideoRecord {
  id: string;
  title: string;
  message?: string;
  thumbnailUrl?: string;
  status: VideoStatus;
  createdAt: number;
  analysis?: AnalysisResult;
}

type UploadContextValue = {
  videos: Record<string, VideoRecord>;
  addVideo: (record: VideoRecord) => void;
  getVideo: (id: string) => VideoRecord | undefined;
  updateVideoAnalysis: (id: string, analysis: AnalysisResult) => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<Record<string, VideoRecord>>({});

  const addVideo = useCallback((record: VideoRecord) => {
    setVideos(prev => ({ ...prev, [record.id]: record }));
  }, []);

  const getVideo = useCallback((id: string) => videos[id], [videos]);

  const updateVideoAnalysis = useCallback((id: string, analysis: AnalysisResult) => {
    setVideos(prev => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, status: 'completed', analysis } };
    });
  }, []);

  const value: UploadContextValue = { videos, addVideo, getVideo, updateVideoAnalysis };
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}
