import { Outlet, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useEffect } from "react";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "~/services/session.server";
import { dynamo, USERS_TABLE } from "~/services/dynamodb.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user");
  if (!user) {
    console.log("[auth] not signed in →", request.url);
    throw redirect("/login");
  }
  console.log("[auth] signed in as", user.email, "groups:", user.groups, "→", request.url);

  const url = new URL(request.url);
  if (url.pathname !== "/onboarding") {
    const result = await dynamo.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId: user.id } })
    );
    const record = result.Item;
    if (!record || !record.onboardingComplete) {
      throw redirect("/onboarding");
    }
  }

  return { user };
}

export default function ProtectedLayout() {
  const { user } = useLoaderData<typeof loader>();

  useEffect(() => {
    console.log("[auth] signed in as:", user);
  }, [user]);

  return <Outlet />;
}
