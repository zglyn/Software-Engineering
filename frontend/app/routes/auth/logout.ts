import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { destroySession, getSession } from "~/services/session.server";

function cognitoLogoutUrl() {
  const domain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const logoutUri = encodeURIComponent(
    process.env.COGNITO_LOGOUT_URI || "http://localhost:3000/login"
  );
  return `${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect(cognitoLogoutUrl(), {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect(cognitoLogoutUrl(), {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
