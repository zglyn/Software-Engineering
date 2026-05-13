import React from 'react';
import { redirect, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/services/session.server';
import { PLAYERS_BY_ID } from '~/data/mockStats';
import {
  PlayerProfileView,
  buildViewModelFromApi,
  buildViewModelFromMock,
  type PlayerPageViewModel,
} from '~/components/playerProfile/PlayerProfileView';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) throw redirect('/login');
  const userName =
    (typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const userId =
    (typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null) ??
    (typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null);
  const groups = user.groups ?? [];
  const isCoach = groups.includes('coaches');
  const isAdmin = groups.includes('admin');
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const id = params.id?.trim();
  if (!id) {
    return {
      model: null as PlayerPageViewModel | null,
      userId: userId ?? '',
      userName: userName ?? '',
      backendBaseUrl,
      isAdmin,
      assignedUserId: undefined as string | undefined,
      canViewNotes: false,
      canWriteNotes: false,
      notesRecipientId: '',
      notesUsePlayerThread: false,
      showAdminRemove: false,
    };
  }
  let assignedUserId: string | undefined;
  let model: PlayerPageViewModel | null = null;
  try {
    const r = await fetch(`${backendBaseUrl}/api/player/${encodeURIComponent(id)}`);
    if (r.ok) {
      const raw = (await r.json()) as Record<string, unknown>;
      const ru = raw.user_id;
      if (ru != null && String(ru).trim() !== '') {
        assignedUserId = String(ru).trim();
      }
      model = buildViewModelFromApi(raw);
    }
  } catch {
    const mock = PLAYERS_BY_ID[id];
    model = mock ? buildViewModelFromMock(mock) : null;
  }
  if (!model) {
    const mock = PLAYERS_BY_ID[id];
    model = mock ? buildViewModelFromMock(mock) : null;
  }
  const notesRecipientId = model ? String(model.profile.id) : '';
  const linkedSelf =
    assignedUserId != null &&
    userId != null &&
    String(assignedUserId).trim() === String(userId).trim();
  const canViewNotes = (isCoach && !isAdmin) || Boolean(linkedSelf);
  const canWriteNotes = isCoach && !isAdmin;
  const notesUsePlayerThread = Boolean(linkedSelf);

  return {
    model,
    userId: userId ?? '',
    userName: userName ?? '',
    backendBaseUrl,
    isAdmin,
    assignedUserId,
    canViewNotes,
    canWriteNotes,
    notesRecipientId,
    notesUsePlayerThread,
    showAdminRemove: true,
  };
}

export default function PlayerStatsPage() {
  const data = useLoaderData<typeof loader>();
  return <PlayerProfileView {...data} />;
}
