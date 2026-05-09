import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader(_args: LoaderFunctionArgs) {
  throw redirect('/feed');
}

export default function ManagePlayersPage() {
  return null;
}
