import React, { useState, useRef } from 'react';
import { useUpload } from '../context/UploadContext';
import type { VideoRecord } from '../context/UploadContext';
import './UploadModal.css';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: (id: string) => void;
}

export default function UploadModal({ open, onClose, onUploadComplete }: UploadModalProps) {
  const { addVideo } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
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

  const handleSubmit = () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    const duration = 2200;
    const interval = 50;
    let current = 0;
    const timer = setInterval(() => {
      current += interval;
      const p = Math.min(100, Math.round((current / duration) * 100));
      setProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        const id = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const record: VideoRecord = {
          id,
          title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
          message: message.trim() || undefined,
          thumbnailUrl: undefined,
          status: 'pending_analysis',
          createdAt: Date.now()
        };
        addVideo(record);
        reset();
        onClose();
        onUploadComplete(id);
      }
    }, interval);
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
              placeholder="e.g. Practice Feb 27"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={uploading}
            />
          </label>
          <label className="uploadLabel">
            Message
            <textarea
              className="uploadTextarea"
              placeholder="Add a note (optional)"
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
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
