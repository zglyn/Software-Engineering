import React, { useEffect, useMemo, useState } from 'react';
import { Link, redirect, useFetcher, useLoaderData, useNavigate, useRevalidator } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
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

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user?.id) throw redirect('/login');
  const formData = await request.formData();
  const intent = formData.get('intent');
  if (intent !== 'delete') return null;
  const path = String(formData.get('path') || '');
  const base = process.env.BACKEND_URL || 'http://localhost:3001';
  await fetch(`${base}/api/uploads/video?userId=${encodeURIComponent(user.id)}&path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  return null;
}

function VideoThumb({ src }: { src: string | null }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const stableSrc = useMemo(() => src, [src]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const run = async () => {
      setThumb(null);
      setErrored(false);
      if (!stableSrc) return;
      try {
        const res = await fetch(stableSrc);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.src = objectUrl;
        await new Promise<void>((resolve, reject) => {
          v.onloadeddata = () => resolve();
          v.onerror = () => reject(new Error('video load failed'));
        });
        const t = Math.min(0.1, Math.max(0, (v.duration || 0) / 10));
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => resolve();
          const onErr = () => reject(new Error('seek failed'));
          v.onseeked = onSeeked;
          v.onerror = onErr;
          try {
            v.currentTime = t;
          } catch {
            resolve();
          }
        });
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (cancelled) return;
        setThumb(dataUrl);
      } catch {
        if (cancelled) return;
        setErrored(true);
      }
    };
    if (typeof window !== 'undefined') void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stableSrc]);

  if (!stableSrc) return <div className="myUploadsCardPlaceholder" />;
  if (thumb) return <img src={thumb} alt="" className="myUploadsCardImg" />;
  if (errored) {
    return (
      <video
        src={stableSrc}
        className="myUploadsCardImg"
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          try {
            v.currentTime = Math.min(0.1, Math.max(0, (v.duration || 0) / 10));
          } catch {}
        }}
      />
    );
  }
  return <div className="myUploadsCardPlaceholder" />;
}

export default function MyUploadsPage() {
  const { items } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data !== undefined) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  return (
    <div className="myUploadsPage">
      <header className="myUploadsHeader">
        <button type="button" className="myUploadsBack" onClick={() => navigate('/feed')}>← Back</button>
        <h1 className="myUploadsTitle">My Uploads</h1>
      </header>
      <div className="myUploadsContent">
        {items.length === 0 ? (
          <p className="myUploadsEmpty">No uploads yet. Upload a video to get started.</p>
        ) : (
          <div className="myUploadsGrid">
            {items.map((video) => (
              <div key={video.path} className="myUploadsCard">
                <Link to={`/video/${video.videoId}`} className="myUploadsCardLink">
                  <div className="myUploadsCardThumb">
                    <VideoThumb src={video.signedUrl} />
                  </div>
                  <div className="myUploadsCardBody">
                    <h3 className="myUploadsCardTitle">{video.title}</h3>
                  </div>
                </Link>
                <fetcher.Form method="post" style={{ padding: '12px 12px 14px' }}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="path" value={video.path} />
                  <button type="submit" className="myUploadsDeleteBtn" disabled={fetcher.state !== 'idle'}>
                    Delete
                  </button>
                </fetcher.Form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
