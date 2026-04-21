import React, { useState, useRef } from 'react';
import './UploadModal.css';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: (id: string) => void;
  userId: string | null;
  backendBaseUrl: string;
}

function postVideoUpload(
  backendBaseUrl: string,
  userId: string,
  file: File,
  title: string,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; videoId?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${backendBaseUrl}/api/upload-videos`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      let videoId: string | undefined;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const j = JSON.parse(xhr.responseText) as { videoId?: string };
          if (typeof j.videoId === 'string') videoId = j.videoId;
        } catch {
          videoId = undefined;
        }
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, videoId });
    };
    xhr.onerror = () => reject(new Error('network'));
    const fd = new FormData();
    fd.append('userId', userId);
    fd.append('title', title);
    fd.append('video', file);
    xhr.send(fd);
  });
}

export default function UploadModal({ open, onClose, onUploadComplete, userId, backendBaseUrl }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const titleMaxLen = userId ? Math.max(1, 255 - userId.length) : 255;
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setMessage('');
    setProgress(0);
    setUploading(false);
  };

  const handleClose = () => {
    if (!uploading) {
      reset();
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('video/')) setFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleSubmit = async () => {
    if (!file || !userId) return;
    setUploading(true);
    setProgress(0);
    try {
      const result = await postVideoUpload(backendBaseUrl, userId, file, title.trim(), setProgress);
      if (!result.ok || !result.videoId) {
        setUploading(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      reset();
      onClose();
      onUploadComplete(result.videoId);
    } catch {
      setUploading(false);
      setProgress(0);
    }
  };

  if (!open) return null;

  return (
    <div className="uploadModalOverlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="uploadModalTitle">
      <div className="uploadModal" onClick={e => e.stopPropagation()}>
        <div className="uploadModalHeader">
          <h2 id="uploadModalTitle" className="uploadModalTitle">Upload video</h2>
          <button type="button" className="uploadModalClose" onClick={handleClose} aria-label="Close" disabled={uploading}>
            ×
          </button>
        </div>
        <div className="uploadModalBody">
          <div
            className={`uploadDropZone ${file ? 'uploadDropZoneHasFile' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="uploadFileInput"
              aria-label="Choose video file"
            />
            {file ? (
              <span className="uploadFileName">{file.name}</span>
            ) : (
              <span className="uploadDropText">Drop a video here or click to browse</span>
            )}
          </div>
          <label className="uploadLabel">
            Title
            <input
              type="text"
              className="uploadInput"
              value={title}
              maxLength={titleMaxLen}
              onChange={e => setTitle(e.target.value.slice(0, titleMaxLen))}
              disabled={uploading}
            />
            <span className="uploadTitleHint">{title.length}/{titleMaxLen} characters max</span>
          </label>
          <label className="uploadLabel">
            Message
            <textarea
              className="uploadTextarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <div className="uploadProgressWrap">
              <div className="uploadProgressBar">
                <div className="uploadProgressFill" style={{ width: `${progress}%` }} />
              </div>
              <span className="uploadProgressText">{progress}%</span>
            </div>
          )}
        </div>
        <div className="uploadModalFooter">
          <button type="button" className="uploadBtn uploadBtnSecondary" onClick={handleClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="uploadBtn uploadBtnPrimary"
            onClick={() => void handleSubmit()}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
