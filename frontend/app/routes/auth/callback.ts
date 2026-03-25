import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticator } from "~/services/auth.server";
import { commitSession, getSession } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  let user = await authenticator.authenticate("cognito-auth", request);

  if (!user) {
    console.log("[auth] callback: authentication failed");
    session.flash("error", "Authentication failed. Please try again.");
    return redirect("/login", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  console.log("[auth] callback: signed in as", user.email, "(id:", user.id + ")");
  session.set("user", user);
  return redirect("/", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
