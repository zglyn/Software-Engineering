import { Authenticator } from "remix-auth";
import { OAuth2Strategy, CodeChallengeMethod } from "remix-auth-oauth2";
import type { OAuth2Tokens } from "arctic";
import jwt, { type JwtPayload } from "jsonwebtoken";

export type User = {
  id: string;
  email: string;
  name: string;
  groups: string[];
};

export const authenticator = new Authenticator<User>();

authenticator.use(
  new OAuth2Strategy<User>(
    {
      cookie: {
        name: "oauth2",
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
        secrets: [process.env.APP_SECRET || "dev-secret"],
      },
      clientId: process.env.COGNITO_CLIENT_ID || "",
      clientSecret: process.env.COGNITO_CLIENT_SECRET || "",
      authorizationEndpoint: `${process.env.COGNITO_DOMAIN}/oauth2/authorize`,
      tokenEndpoint: `${process.env.COGNITO_DOMAIN}/oauth2/token`,
      redirectURI: process.env.COGNITO_REDIRECT_URI || "http://localhost:3000/auth/callback",
      tokenRevocationEndpoint: `${process.env.COGNITO_DOMAIN}/oauth2/revoke`,
      scopes: ["openid", "email", "profile"],
      codeChallengeMethod: CodeChallengeMethod.S256,
    },
    async ({ tokens }) => {
      return getUser(tokens);
    }
  ),
  "cognito-auth"
);

function getUser(tokens: OAuth2Tokens): User {
  const idToken = tokens.idToken();
  const decoded = jwt.decode(idToken) as JwtPayload;
  return {
    id: decoded.sub as string,
    email: decoded.email as string,
    name: (decoded.name as string) || (decoded.email as string),
    groups: (decoded["cognito:groups"] as string[]) ?? [],
  };
}
