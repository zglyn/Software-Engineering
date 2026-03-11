import React from "react";
import { Link } from "react-router-dom";
import { api, type Player, type PrivacyLevel, type StatPost } from "../api/mock";
import "./StatsPage.css";

export default function StatsPage() {
  const [title, setTitle] = React.useState("");
  const [privacy, setPrivacy] = React.useState<PrivacyLevel>("TEAM");
  const [search, setSearch] = React.useState("");
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = React.useState<Player[]>([]);
  const [tagged, setTagged] = React.useState<string[]>([]);
  const [posts, setPosts] = React.useState<StatPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const [filteredPlayers, everyone, existingPosts] = await Promise.all([
        api.listPlayers(""),
        api.getAllPlayers(),
        api.listPosts(),
      ]);

      if (!alive) return;
      setPlayers(filteredPlayers);
      setAllPlayers(everyone);
      setPosts(existingPosts);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    api.listPlayers(search).then((result: Player[]) => {
      if (alive) setPlayers(result);
    });
    return () => {
      alive = false;
    };
  }, [search]);

  const playerNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    allPlayers.forEach((player: Player) => map.set(player.id, player.name));
    return map;
  }, [allPlayers]);

  function toggleTag(playerId: string) {
    setTagged((prev: string[]) =>
      prev.includes(playerId)
        ? prev.filter((id: string) => id !== playerId)
        : [...prev, playerId]
    );
  }

  const canPublish = title.trim().length > 0;

  return (
    <div className="statsPage">
      <div className="statsPageHeader">
        <Link to="/players" className="statsPageBack">
          ← Back
        </Link>
      </div>

      <div className="statsPageContent">
        <p className="statsPageMessage">Player stats workspace</p>
        <h1 className="statsPageTitle">Create and publish stat updates</h1>
        <p className="statsPageSubtitle">
          Tag players, set privacy, and publish game-by-game updates.
        </p>

        <section className="statsPageSection">
          <h2 className="statsPageSectionTitle">Connected Pages</h2>

          <div className="statsPostList">
            <Link to="/player-stats" className="statsNavCard">
              <div className="statsPostTitle">Player Stats</div>
              <div className="statsPostMeta">
                Open the player stats page built by your teammate.
              </div>
            </Link>

            <Link to="/team-stats" className="statsNavCard">
              <div className="statsPostTitle">Team Stats</div>
              <div className="statsPostMeta">
                Jump to the team stats page and compare team-level performance.
              </div>
            </Link>

            <Link to="/videos" className="statsNavCard">
              <div className="statsPostTitle">Video Page</div>
              <div className="statsPostMeta">
                View uploaded clips, highlights, and related video content.
              </div>
            </Link>

            <Link to="/my-uploads" className="statsNavCard">
              <div className="statsPostTitle">My Uploads</div>
              <div className="statsPostMeta">
                See uploaded files and connect this stats workflow to uploads.
              </div>
            </Link>
          </div>
        </section>

        <section className="statsPageSection">
          <h2 className="statsPageSectionTitle">Create Stat Post</h2>

          <div className="statsCard">
            <input
              className="statsInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (ex: Game vs Rutgers — shooting + hustle)"
            />

            <select
              className="statsSelect"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
            >
              <option value="PUBLIC">Public</option>
              <option value="TEAM">Team</option>
              <option value="GMS_ONLY">GM’s Only</option>
            </select>

            <input
              className="statsInput"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players to tag..."
            />

            <div className="statsTagList">
              {players.slice(0, 12).map((player) => {
                const active = tagged.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`statsTag ${active ? "statsTagActive" : ""}`}
                    onClick={() => toggleTag(player.id)}
                    title={`${player.team} • ${player.position}`}
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>

            <div className="statsSelectedTags">
              Tagged:{" "}
              {tagged.length > 0
                ? tagged.map((id: string) => playerNameMap.get(id) ?? id).join(", ")
                : "None"}
            </div>

            <button
              className="statsPrimaryBtn"
              disabled={!canPublish}
              onClick={async () => {
                const created = await api.createPost({
                  title: title.trim(),
                  privacy,
                  taggedPlayerIds: tagged,
                });
                setPosts((prev: StatPost[]) => [created, ...prev]);
                setTitle("");
                setTagged([]);
                setSearch("");
              }}
            >
              Publish
            </button>
          </div>
        </section>

        <section className="statsPageSection">
          <h2 className="statsPageSectionTitle">Posts</h2>

          {loading ? (
            <div className="statsCard">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="statsCard">No posts yet.</div>
          ) : (
            <div className="statsPostList">
              {posts.map((post: StatPost) => (
                <div key={post.id} className="statsPost">
                  <div className="statsPostHeader">
                    <div className="statsPostTitle">{post.title}</div>
                    <div className="statsPostPrivacy">{post.privacy}</div>
                  </div>

                  <div className="statsPostMeta">
                    {new Date(post.createdAtISO).toLocaleString()}
                  </div>

                  <div className="statsPostTags">
                    Tagged:{" "}
                    {post.taggedPlayerIds.length > 0
                      ? post.taggedPlayerIds
                          .map((id: string) => playerNameMap.get(id) ?? id)
                          .join(", ")
                      : "None"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}