import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler = async (event) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    console.log("[group-assign] skipping trigger source:", event.triggerSource);
    return event;
  }

  const { userPoolId, userName } = event;
  console.log("[group-assign] new confirmed user:", userName);

  try {
    const { Groups } = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: userName,
      })
    );
    const alreadyAssigned = Groups.some((g) => g.GroupName === "public");

    if (alreadyAssigned) {
      console.log("[group-assign] already in public group, skipping");
      return event;
    }

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: userName,
        GroupName: "public",
      })
    );

    console.log("[group-assign] assigned to public group:", userName);
  } catch (err) {
    console.error(`[group-assign] failed for ${userName} (pool: ${userPoolId}):`, err);
    throw err;
  }

  return event;
};
