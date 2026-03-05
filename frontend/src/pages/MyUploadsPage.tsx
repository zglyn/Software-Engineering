import React from 'react';
import { Link } from 'react-router-dom';
import { useUpload } from '../context/UploadContext';
import './MyUploadsPage.css';

export default function MyUploadsPage() {
  const { videos } = useUpload();
  const list = Object.values(videos).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="myUploadsPage">
      <header className="myUploadsHeader">
        <Link to="/feed" className="myUploadsBack">← Feed</Link>
        <h1 className="myUploadsTitle">My Uploads</h1>
      </header>
      <div className="myUploadsContent">
        {list.length === 0 ? (
          <p className="myUploadsEmpty">No uploads yet. Upload a video to get started.</p>
        ) : (
          <div className="myUploadsGrid">
            {list.map((video) => (
              <Link to={`/video/${video.id}`} key={video.id} className="myUploadsCard">
                <div className="myUploadsCardThumb">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" className="myUploadsCardImg" />
                  ) : (
                    <div className="myUploadsCardPlaceholder" />
                  )}
                  <span className={`myUploadsCardStatus ${video.status === 'completed' ? 'myUploadsCardStatusDone' : ''}`}>
                    {video.status === 'completed' ? 'Done' : 'Analyzing…'}
                  </span>
                </div>
                <div className="myUploadsCardBody">
                  <h3 className="myUploadsCardTitle">{video.title}</h3>
                  {video.message && <p className="myUploadsCardMessage">{video.message}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
