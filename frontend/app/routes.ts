import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login/index.tsx"),
  route("auth/callback", "routes/auth/callback.ts"),
  route("auth/logout", "routes/auth/logout.ts"),
  layout("layouts/protected-layout.tsx", [
    index("routes/root-redirect.ts"),
    route("onboarding", "routes/onboarding.tsx"),
    route("select", "routes/start.tsx"),
    route("feed", "routes/feed.tsx"),
    route("players", "routes/players.tsx"),
    route("stats", "routes/stats.tsx"),
    route("management", "routes/management.tsx"),
    route("manage-coaches", "routes/ManageCoachesPage.tsx"),
    route("manage-players", "routes/ManagePlayersPage.tsx"),
    route("compare", "routes/compare.tsx"),
    route("compare-stats-only", "routes/compare-stats-only.tsx"),
    route("compare-money", "routes/compare-money.tsx"),
    route("uploads", "routes/uploads.tsx"),
    route("video/:id", "routes/video.$id.tsx"),
    route("player/:id", "routes/player.$id.tsx"),
    route("team/:id", "routes/team.$id.tsx"),
    route("create-team", "routes/create-team.tsx"),
    route("insights", "routes/insights.tsx"),
    route("profile", "routes/profile.tsx"),
  ]),
  route("*", "routes/$.ts"),
] satisfies RouteConfig;
