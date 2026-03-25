import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [reactRouter(), tsconfigPaths()],
    server: {
      port: 3000,
    },
    define: {
      "process.env.COGNITO_CLIENT_ID": JSON.stringify(env.COGNITO_CLIENT_ID),
      "process.env.COGNITO_CLIENT_SECRET": JSON.stringify(env.COGNITO_CLIENT_SECRET),
      "process.env.COGNITO_DOMAIN": JSON.stringify(env.COGNITO_DOMAIN),
      "process.env.COGNITO_REDIRECT_URI": JSON.stringify(env.COGNITO_REDIRECT_URI),
      "process.env.APP_SECRET": JSON.stringify(env.APP_SECRET),
      "process.env.AWS_REGION": JSON.stringify(env.AWS_REGION),
      "process.env.AWS_ACCESS_KEY_ID": JSON.stringify(env.AWS_ACCESS_KEY_ID),
      "process.env.AWS_SECRET_ACCESS_KEY": JSON.stringify(env.AWS_SECRET_ACCESS_KEY),
      "process.env.DYNAMO_TABLE_NAME": JSON.stringify(env.DYNAMO_TABLE_NAME),
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    },
  };
});
