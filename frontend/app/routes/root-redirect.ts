import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getSession } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user");

  if (!user) throw redirect("/login");

  const groups = user.groups ?? [];

  if (groups.includes("admin") || groups.includes("coaches") || groups.length === 0 || (groups.length === 1 && groups[0] === "public")) {
    throw redirect("/feed");
  }

  throw redirect("/select");
}
