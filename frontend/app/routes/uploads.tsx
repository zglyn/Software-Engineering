import React from 'react';
import { Link, redirect, useLoaderData, useNavigate } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Buffer } from 'node:buffer';
import { getSession } from '~/services/session.server';
import './MyUploadsPage.css';

export type UploadListItem = {
  path: string;
  name: string;
  title: string;
  createdAt: string | null;
  signedUrl: string | null;
  videoId: string;
  statsGenerated?: boolean;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user?.id) throw redirect('/login');
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  const res = await fetch(`${base}/api/uploads/videos?userId=${encodeURIComponent(user.id)}`);
  if (!res.ok) return { items: [] as UploadListItem[] };
  const data = (await res.json()) as { items?: { path: string; name: string; title?: string; createdAt: string | null; signedUrl: string | null; statsGenerated?: boolean }[] };
  const raw = data.items ?? [];
  const items: UploadListItem[] = raw.map((row) => ({
    path: row.path,
    name: row.name,
    title: typeof row.title === 'string' && row.title ? row.title : row.name,
    createdAt: row.createdAt,
    signedUrl: row.signedUrl,
    statsGenerated: row.statsGenerated,
    videoId: Buffer.from(row.path, 'utf8').toString('base64url'),
  }));
  return { items };
}

export default function MyUploadsPage() {
  const { items } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="myUploadsPage">
      <header className="myUploadsHeader">
        <button type="button" className="myUploadsBack" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="myUploadsTitle">My Uploads</h1>
      </header>
      <div className="myUploadsContent">
        {items.length === 0 ? (
          <p className="myUploadsEmpty">No uploads yet. Upload a video to get started.</p>
        ) : (
          <div className="myUploadsGrid">
            {items.map((video) => (
              <Link to={`/video/${video.videoId}`} key={video.path} className="myUploadsCard">
                <div className="myUploadsCardThumb">
                  {video.signedUrl ? (
                    <video src={video.signedUrl} className="myUploadsCardImg" muted playsInline preload="metadata" />
                  ) : (
                    <div className="myUploadsCardPlaceholder" />
                  )}
                </div>
                <div className="myUploadsCardBody">
                  <h3 className="myUploadsCardTitle">{video.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
