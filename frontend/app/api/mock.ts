export type PrivacyLevel = "PUBLIC" | "TEAM" | "GMS_ONLY";

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
};

export type StatPost = {
  id: string;
  title: string;
  privacy: PrivacyLevel;
  taggedPlayerIds: string[];
  createdAtISO: string;
};

const players: Player[] = [
  { id: "p1", name: "Jordan Smith", team: "Tandon Torches", position: "G" },
  { id: "p2", name: "Avery Lee", team: "Tandon Torches", position: "F" },
  { id: "p3", name: "Chris Patel", team: "Brooklyn Nets", position: "C" },
  { id: "p4", name: "Rohan Kumar", team: "Brooklyn Nets", position: "G" },
];

let posts: StatPost[] = [];

function sleep(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const api = {
  async listPlayers(query: string): Promise<Player[]> {
    await sleep();
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  },

  async getAllPlayers(): Promise<Player[]> {
    await sleep();
    return players;
  },

  async listPosts(): Promise<StatPost[]> {
    await sleep();
    return posts;
  },

  async createPost(input: Omit<StatPost, "id" | "createdAtISO">): Promise<StatPost> {
    await sleep();
    const post: StatPost = {
      ...input,
      id: `post_${Math.random().toString(16).slice(2)}`,
      createdAtISO: new Date().toISOString(),
    };
    posts = [post, ...posts];
    return post;
  },
};
