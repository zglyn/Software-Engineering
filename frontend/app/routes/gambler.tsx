import { useEffect, useMemo, useState } from "react";
import "~/app.css";

type SportsbookSide = {
  name: string;
  price: number | null;
  point: number | null;
};

type Pick = {
  id: number;
  gameId: string;
  gameDate?: string;
  game: string;
  awayTeam: string;
  homeTeam: string;
  awayAbbrev: string;
  homeAbbrev: string;
  market: string;
  selectedTeam: string;
  selectedAbbrev: string;
  odds: string;
  confidence: number;
  edge: string;
  status: string;
  arena: string;
  gameTime: string;

  oddsSource?: string;
  sportsbookKey?: string | null;
  impliedProbability?: number | null;
  oddsLastUpdate?: string | null;
  oddsWarning?: string | null;

  moneyline?: {
    home: SportsbookSide;
    away: SportsbookSide;
  } | null;

  spread?: {
    home: SportsbookSide;
    away: SportsbookSide;
  } | null;

  total?: {
    over: SportsbookSide;
    under: SportsbookSide;
  } | null;
};

type GamblerResponse = {
  source: string;
  date: string;
  season?: string;
  seasonType?: string;
  count?: number;
  warnings?: string[];
  error?: string;
  oddsProvider?: string;
  oddsRequestsRemaining?: string | number | null;
  preferredBookmaker?: string;
  picks: Pick[];
};

type ActiveTab = "recommended" | "saved" | "history" | "simulator";

type SimulationResult = {
  id: string;
  createdAt: string;
  balance: number;
  unitSize: number;
  maxPicks: number;
  selectedCount: number;
  totalRisk: number;
  projectedProfit: number;
  projectedLoss: number;
  avgConfidence: number;
  bestPick: string;
};

const API_BASE = "http://localhost:3001";
const SAVED_PICKS_KEY = "baller_saved_gambler_picks";
const SIM_HISTORY_KEY = "baller_gambler_sim_history";

function prettyGameDate(raw?: string) {
  if (!raw) return "";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw.split(" ")[0] || raw;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRealMatchup(pick: Pick) {
  return (
    pick.awayTeam !== "Away Team" &&
    pick.homeTeam !== "Home Team" &&
    pick.awayAbbrev !== "" &&
    pick.homeAbbrev !== ""
  );
}

function formatOdds(price?: number | string | null) {
  if (price == null) return "—";

  const n = Number(price);

  if (!Number.isFinite(n)) return "—";

  return n > 0 ? `+${n}` : `${n}`;
}

function formatPoint(point?: number | string | null) {
  if (point == null) return "";

  const n = Number(point);

  if (!Number.isFinite(n)) return "";

  return n > 0 ? `+${n}` : `${n}`;
}

function formatTotal(label: "Over" | "Under", side?: SportsbookSide | null) {
  if (!side) return "—";

  const point = side.point == null ? "" : `${side.point}`;

  return `${label} ${point} ${formatOdds(side.price)}`;
}

function hasSportsbookLines(pick: Pick) {
  return Boolean(pick.moneyline || pick.spread || pick.total);
}

function getSelectedMoneylineOdds(pick: Pick) {
  if (pick.selectedTeam === pick.homeTeam && pick.moneyline?.home?.price != null) {
    return String(pick.moneyline.home.price);
  }

  if (pick.selectedTeam === pick.awayTeam && pick.moneyline?.away?.price != null) {
    return String(pick.moneyline.away.price);
  }

  return pick.odds;
}

function americanOddsProfit(stake: number, odds: string) {
  const n = Number(String(odds).replace("+", ""));

  if (!Number.isFinite(n) || n === 0) return 0;

  if (n > 0) {
    return stake * (n / 100);
  }

  return stake * (100 / Math.abs(n));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return fallback;

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function GamblerPage() {
  const [data, setData] = useState<GamblerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search] = useState("");
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("recommended");

  const [savedPicks, setSavedPicks] = useState<Pick[]>([]);
  const [simHistory, setSimHistory] = useState<SimulationResult[]>([]);

  const [balance, setBalance] = useState("1000");
  const [unitSize, setUnitSize] = useState("2");
  const [maxPicks, setMaxPicks] = useState("5");
  const [latestSimulation, setLatestSimulation] = useState<SimulationResult | null>(null);

  useEffect(() => {
    setSavedPicks(loadJson<Pick[]>(SAVED_PICKS_KEY, []));
    setSimHistory(loadJson<SimulationResult[]>(SIM_HISTORY_KEY, []));
  }, []);

  async function loadPicks() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE}/api/gambler/picks?limit=100`);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const json = (await response.json()) as GamblerResponse;

      setData(json);

      if (json.error) {
        setError(json.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NBA picks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPicks();
  }, []);

  const allBackendPicks = useMemo(() => {
    let picks = data?.picks ?? [];

    if (!showPlaceholders) {
      picks = picks.filter(isRealMatchup);
    }

    return picks;
  }, [data, showPlaceholders]);

  const filteredRecommendedPicks = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return allBackendPicks;

    return allBackendPicks.filter((pick) => {
      return (
        pick.game.toLowerCase().includes(q) ||
        pick.market.toLowerCase().includes(q) ||
        pick.selectedTeam.toLowerCase().includes(q) ||
        pick.awayTeam.toLowerCase().includes(q) ||
        pick.homeTeam.toLowerCase().includes(q) ||
        pick.awayAbbrev.toLowerCase().includes(q) ||
        pick.homeAbbrev.toLowerCase().includes(q)
      );
    });
  }, [allBackendPicks, search]);

  const filteredSavedPicks = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return savedPicks;

    return savedPicks.filter((pick) => {
      return (
        pick.game.toLowerCase().includes(q) ||
        pick.market.toLowerCase().includes(q) ||
        pick.selectedTeam.toLowerCase().includes(q) ||
        pick.awayTeam.toLowerCase().includes(q) ||
        pick.homeTeam.toLowerCase().includes(q)
      );
    });
  }, [savedPicks, search]);

  const displayPicks =
    activeTab === "saved" ? filteredSavedPicks : filteredRecommendedPicks;

  const avgConfidence = useMemo(() => {
    if (filteredRecommendedPicks.length === 0) return "0%";

    const total = filteredRecommendedPicks.reduce(
      (sum, pick) => sum + Number(pick.confidence || 0),
      0
    );

    return `${Math.round(total / filteredRecommendedPicks.length)}%`;
  }, [filteredRecommendedPicks]);

  const sportsbookCount = useMemo(() => {
    return filteredRecommendedPicks.filter(
      (pick) => pick.oddsSource && pick.oddsSource !== "model" && !pick.oddsWarning
    ).length;
  }, [filteredRecommendedPicks]);

  const topPick = filteredRecommendedPicks[0];

  function isSaved(pick: Pick) {
    return savedPicks.some((saved) => saved.gameId === pick.gameId);
  }

  function toggleSavePick(pick: Pick) {
    let next: Pick[];

    if (isSaved(pick)) {
      next = savedPicks.filter((saved) => saved.gameId !== pick.gameId);
    } else {
      next = [pick, ...savedPicks];
    }

    setSavedPicks(next);
    saveJson(SAVED_PICKS_KEY, next);
  }

  function clearSavedPicks() {
    setSavedPicks([]);
    saveJson(SAVED_PICKS_KEY, []);
  }

  function runSimulation() {
    const parsedBalance = Number(balance);
    const parsedUnitSize = Number(unitSize);
    const parsedMaxPicks = Number(maxPicks);

    if (
      !Number.isFinite(parsedBalance) ||
      parsedBalance <= 0 ||
      !Number.isFinite(parsedUnitSize) ||
      parsedUnitSize <= 0 ||
      !Number.isFinite(parsedMaxPicks) ||
      parsedMaxPicks <= 0
    ) {
      setError("Simulation inputs must be positive numbers.");
      setActiveTab("simulator");
      return;
    }

    setError("");

    const picksToUse = filteredRecommendedPicks
      .slice()
      .sort((a, b) => Number(b.confidence) - Number(a.confidence))
      .slice(0, Math.floor(parsedMaxPicks));

    const stakePerPick = parsedBalance * (parsedUnitSize / 100);
    const totalRisk = stakePerPick * picksToUse.length;

    const projectedProfit = picksToUse.reduce((sum, pick) => {
      const confidenceWeight = Number(pick.confidence || 0) / 100;
      const oddsToUse = getSelectedMoneylineOdds(pick);
      const profitIfWin = americanOddsProfit(stakePerPick, oddsToUse);
      const expected =
        profitIfWin * confidenceWeight - stakePerPick * (1 - confidenceWeight);

      return sum + expected;
    }, 0);

    const projectedLoss = totalRisk;

    const avg =
      picksToUse.length === 0
        ? 0
        : picksToUse.reduce((sum, pick) => sum + Number(pick.confidence || 0), 0) /
          picksToUse.length;

    const result: SimulationResult = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toLocaleString(),
      balance: parsedBalance,
      unitSize: parsedUnitSize,
      maxPicks: Math.floor(parsedMaxPicks),
      selectedCount: picksToUse.length,
      totalRisk,
      projectedProfit,
      projectedLoss,
      avgConfidence: Math.round(avg * 10) / 10,
      bestPick: picksToUse[0]?.market || "No pick available",
    };

    const nextHistory = [result, ...simHistory].slice(0, 20);

    setLatestSimulation(result);
    setSimHistory(nextHistory);
    saveJson(SIM_HISTORY_KEY, nextHistory);
    setActiveTab("simulator");
  }

  function clearHistory() {
    setSimHistory([]);
    setLatestSimulation(null);
    saveJson(SIM_HISTORY_KEY, []);
  }

  return (
    <div className="feedPageWrapper gamblerPageWrapper">
      <main className="feedPage gamblerPage">
        <section className="feedLayout gamblerLayout">
          <section className="gamblerHeroPro">
            <div className="gamblerHeroContent">
              <div className="feedTypeLabel gamblerEyebrow">
                NBA betting analytics
              </div>

              <h1 className="gamblerHeroTitle">Sportsbook Dashboard</h1>

              <p className="gamblerHeroSubtitle">
                View upcoming NBA matchups, sportsbook lines, model picks, and
                simulated bankroll outcomes in one clean board.
              </p>

              <div className="gamblerHeroActions">
                <button className="gamblerPrimaryBtn" onClick={loadPicks}>
                  Refresh lines
                </button>

                <button className="gamblerSecondaryBtn" onClick={runSimulation}>
                  Run model
                </button>

                <label className="gamblerToggle">
                  <input
                    type="checkbox"
                    checked={showPlaceholders}
                    onChange={(event) => setShowPlaceholders(event.target.checked)}
                  />
                  Show future TBD
                </label>
              </div>
            </div>

            <div className="gamblerHeroPanel">
              <div className="gamblerDatePill">{data?.date || "Loading..."}</div>

              {topPick ? (
                <div className="gamblerTopPick">
                  <span>Top Pick</span>
                  <strong>{topPick.selectedAbbrev || topPick.selectedTeam}</strong>
                  <small>
                    {topPick.confidence}% confidence
                    {topPick.oddsSource && topPick.oddsSource !== "model"
                      ? ` · ${topPick.oddsSource}`
                      : ""}
                  </small>
                </div>
              ) : (
                <div className="gamblerTopPick">
                  <span>Status</span>
                  <strong>{loading ? "Loading" : "No picks"}</strong>
                  <small>Waiting for live board</small>
                </div>
              )}
            </div>
          </section>

          {Array.isArray(data?.warnings) && data.warnings.length > 0 && (
            <section className="feedCard gamblerStateCard">
              <div className="feedTypeLabel">Warnings</div>
              <p className="feedSummary">{data.warnings.join(" · ")}</p>
            </section>
          )}

          <section className="gamblerStatsGridPro">
            <StatCard
              label="Matchups"
              value={String(filteredRecommendedPicks.length)}
              meta="Upcoming NBA games"
            />
            <StatCard
              label="Live Lines"
              value={String(sportsbookCount)}
              meta="Sportsbook matched"
            />
            <StatCard
              label="Model Confidence"
              value={avgConfidence}
              meta="Average pick strength"
            />
            <StatCard
              label="Saved"
              value={String(savedPicks.length)}
              meta="Betslip picks"
            />
          </section>

          <section className="gamblerTabsPro">
            <button
              className={activeTab === "recommended" ? "gamblerTabActive" : ""}
              onClick={() => setActiveTab("recommended")}
            >
              Recommended
            </button>

            <button
              className={activeTab === "saved" ? "gamblerTabActive" : ""}
              onClick={() => setActiveTab("saved")}
            >
              Saved
            </button>

            <button
              className={activeTab === "history" ? "gamblerTabActive" : ""}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>

            <button
              className={activeTab === "simulator" ? "gamblerTabActive" : ""}
              onClick={() => setActiveTab("simulator")}
            >
              Simulator
            </button>
          </section>

          {loading && (
            <section className="gamblerStateCard">
              <div className="feedLoader">
                Loading NBA games and sportsbook lines...
              </div>
            </section>
          )}

          {!loading && error && (
            <section className="feedCard gamblerStateCard">
              <div className="feedTypeLabel">Message</div>
              <h2 className="feedCardTitle gamblerSectionTitle">{error}</h2>
              <button className="gamblerPrimaryBtn" onClick={loadPicks}>
                Try Again
              </button>
            </section>
          )}

          {!loading &&
            !error &&
            activeTab !== "history" &&
            activeTab !== "simulator" && (
              <div className="gamblerContentGridPro">
                <section className="gamblerMainPanel">
                  <div className="gamblerPanelHeader">
                    <div>
                      <h2>
                        {activeTab === "saved" ? "Saved Betslip" : "NBA Lines Board"}
                      </h2>
                      <p>
                        {activeTab === "saved"
                          ? "Your saved picks and tracked matchups."
                          : "Moneyline, spread, and total markets with model-side recommendations."}
                      </p>
                    </div>

                    <div className="gamblerHeaderActions">
                      {activeTab === "saved" && savedPicks.length > 0 && (
                        <button
                          className="gamblerSecondaryBtn"
                          onClick={clearSavedPicks}
                        >
                          Clear saved
                        </button>
                      )}

                      <button className="gamblerSecondaryBtn" onClick={loadPicks}>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {displayPicks.length === 0 ? (
                    <div className="gamblerEmptyBox">
                      {activeTab === "saved"
                        ? "No saved picks yet. Save a game from Recommended."
                        : "No known future matchups found."}
                    </div>
                  ) : (
                    <div className="gamblerPickListPro">
                      {displayPicks.map((pick) => (
                        <PickCard
                          key={pick.gameId || pick.id}
                          pick={pick}
                          saved={isSaved(pick)}
                          onToggleSave={() => toggleSavePick(pick)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <SimulatorPanel
                  balance={balance}
                  unitSize={unitSize}
                  maxPicks={maxPicks}
                  setBalance={setBalance}
                  setUnitSize={setUnitSize}
                  setMaxPicks={setMaxPicks}
                  runSimulation={runSimulation}
                  latestSimulation={latestSimulation}
                />
              </div>
            )}

          {!loading && !error && activeTab === "simulator" && (
            <div className="gamblerContentGridPro">
              <SimulatorPanel
                balance={balance}
                unitSize={unitSize}
                maxPicks={maxPicks}
                setBalance={setBalance}
                setUnitSize={setUnitSize}
                setMaxPicks={setMaxPicks}
                runSimulation={runSimulation}
                latestSimulation={latestSimulation}
              />

              <section className="gamblerMainPanel">
                <div className="gamblerPanelHeader">
                  <div>
                    <h2>Simulation Preview</h2>
                    <p>The simulator uses the highest-confidence model picks.</p>
                  </div>
                </div>

                <div className="gamblerPickListPro">
                  {filteredRecommendedPicks
                    .slice()
                    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
                    .slice(0, Number(maxPicks) || 5)
                    .map((pick) => (
                      <PickCard
                        key={pick.gameId || pick.id}
                        pick={pick}
                        saved={isSaved(pick)}
                        onToggleSave={() => toggleSavePick(pick)}
                      />
                    ))}
                </div>
              </section>
            </div>
          )}

          {!loading && !error && activeTab === "history" && (
            <section className="gamblerMainPanel">
              <div className="gamblerPanelHeader">
                <div>
                  <h2>Simulation History</h2>
                  <p>Your last 20 simulations are saved locally in this browser.</p>
                </div>

                {simHistory.length > 0 && (
                  <button className="gamblerSecondaryBtn" onClick={clearHistory}>
                    Clear history
                  </button>
                )}
              </div>

              {simHistory.length === 0 ? (
                <div className="gamblerEmptyBox">
                  No simulation history yet. Run the simulator first.
                </div>
              ) : (
                <div className="gamblerHistoryList">
                  {simHistory.map((item) => (
                    <article key={item.id} className="gamblerHistoryCard">
                      <div>
                        <strong>{item.createdAt}</strong>
                        <span>{item.bestPick}</span>
                      </div>

                      <div>
                        <small>Picks</small>
                        <strong>{item.selectedCount}</strong>
                      </div>

                      <div>
                        <small>Risk</small>
                        <strong>${item.totalRisk.toFixed(2)}</strong>
                      </div>

                      <div>
                        <small>Projected EV</small>
                        <strong>${item.projectedProfit.toFixed(2)}</strong>
                      </div>

                      <div>
                        <small>Avg Conf.</small>
                        <strong>{item.avgConfidence}%</strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function PickCard({
  pick,
  saved,
  onToggleSave,
}: {
  pick: Pick;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const hasBook = hasSportsbookLines(pick);

  if (hasBook) {
    return (
      <article className="gamblerPickCardPro gamblerSportsbookCard">
        <div className="gamblerBookHeader">
          <div>
            <div className="gamblerPickMeta">
              <span>{prettyGameDate(pick.gameDate)}</span>
              <span>{pick.status}</span>
              <span>{pick.oddsSource || "Sportsbook"}</span>
              {pick.selectedAbbrev && (
                <span>Model Pick: {pick.selectedAbbrev}</span>
              )}
            </div>

            <h3>{pick.game}</h3>
            {pick.arena && <small>Arena: {pick.arena}</small>}
          </div>

          <button className="gamblerSaveBtn" onClick={onToggleSave}>
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>

        <div className="gamblerBookTable">
          <div className="gamblerBookRow gamblerBookRowHead">
            <span>Market</span>
            <span>{pick.awayAbbrev || "Away"}</span>
            <span>{pick.homeAbbrev || "Home"}</span>
          </div>

          <div className="gamblerBookRow">
            <div className="gamblerBookMarket">Moneyline</div>

            <div
              className={
                pick.selectedTeam === pick.awayTeam
                  ? "gamblerBookCell gamblerBookCellActive"
                  : "gamblerBookCell"
              }
            >
              <span>{pick.awayTeam}</span>
              <strong>{formatOdds(pick.moneyline?.away?.price)}</strong>
            </div>

            <div
              className={
                pick.selectedTeam === pick.homeTeam
                  ? "gamblerBookCell gamblerBookCellActive"
                  : "gamblerBookCell"
              }
            >
              <span>{pick.homeTeam}</span>
              <strong>{formatOdds(pick.moneyline?.home?.price)}</strong>
            </div>
          </div>

          <div className="gamblerBookRow">
            <div className="gamblerBookMarket">Spread</div>

            <div className="gamblerBookCell">
              <span>{formatPoint(pick.spread?.away?.point)}</span>
              <strong>{formatOdds(pick.spread?.away?.price)}</strong>
            </div>

            <div className="gamblerBookCell">
              <span>{formatPoint(pick.spread?.home?.point)}</span>
              <strong>{formatOdds(pick.spread?.home?.price)}</strong>
            </div>
          </div>

          <div className="gamblerBookRow">
            <div className="gamblerBookMarket">Total</div>

            <div className="gamblerBookCell">
              <span>Over</span>
              <strong>{formatTotal("Over", pick.total?.over)}</strong>
            </div>

            <div className="gamblerBookCell">
              <span>Under</span>
              <strong>{formatTotal("Under", pick.total?.under)}</strong>
            </div>
          </div>
        </div>

        <div className="gamblerModelStrip">
          <div>
            <span>Model Pick</span>
            <strong>{pick.market}</strong>
          </div>

          <div>
            <span>Confidence</span>
            <strong>{pick.confidence}%</strong>
          </div>

          <div>
            <span>Implied</span>
            <strong>
              {pick.impliedProbability == null ? "—" : `${pick.impliedProbability}%`}
            </strong>
          </div>

          <div>
            <span>Edge</span>
            <strong>{pick.edge}</strong>
          </div>
        </div>

        <div className="gamblerConfidenceTrack">
          <div
            className="gamblerConfidenceFill"
            style={{ width: `${Math.min(100, Math.max(0, pick.confidence))}%` }}
          />
        </div>

        {pick.oddsWarning && <p className="gamblerOddsWarning">{pick.oddsWarning}</p>}
      </article>
    );
  }

  return (
    <article className="gamblerPickCardPro">
      <div className="gamblerPickLeft">
        <div className="gamblerPickMeta">
          <span>{prettyGameDate(pick.gameDate)}</span>
          <span>{pick.status}</span>
          <span>{pick.oddsSource || "Model"}</span>
          {pick.selectedAbbrev && <span>Pick: {pick.selectedAbbrev}</span>}
        </div>

        <h3>{pick.game}</h3>
        <p>{pick.market}</p>

        {pick.arena && <small>Arena: {pick.arena}</small>}
        {pick.oddsWarning && <p className="gamblerOddsWarning">{pick.oddsWarning}</p>}
      </div>

      <div className="gamblerPickRight">
        <div className="gamblerOddsPro">
          <strong>{pick.odds}</strong>
          <span>Odds</span>
        </div>

        <div className="gamblerEdgePro">
          <span>Edge</span>
          <strong>{pick.edge}</strong>
        </div>

        <button className="gamblerSaveBtn" onClick={onToggleSave}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="gamblerConfidencePro">
        <div>
          <span>Confidence</span>
          <strong>{pick.confidence}%</strong>
        </div>

        <div className="gamblerConfidenceTrack">
          <div
            className="gamblerConfidenceFill"
            style={{ width: `${Math.min(100, Math.max(0, pick.confidence))}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function SimulatorPanel({
  balance,
  unitSize,
  maxPicks,
  setBalance,
  setUnitSize,
  setMaxPicks,
  runSimulation,
  latestSimulation,
}: {
  balance: string;
  unitSize: string;
  maxPicks: string;
  setBalance: (value: string) => void;
  setUnitSize: (value: string) => void;
  setMaxPicks: (value: string) => void;
  runSimulation: () => void;
  latestSimulation: SimulationResult | null;
}) {
  return (
    <aside className="gamblerSidePanel">
      <section className="gamblerSideCard">
        <h2>Bankroll Simulator</h2>
        <p>Estimate exposure and expected value using the selected moneyline odds.</p>

        <form className="gamblerFormPro">
          <label>
            <span>Starting Balance</span>
            <input
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="1000"
              inputMode="decimal"
            />
          </label>

          <label>
            <span>Unit Size (%)</span>
            <input
              value={unitSize}
              onChange={(event) => setUnitSize(event.target.value)}
              placeholder="2"
              inputMode="decimal"
            />
          </label>

          <label>
            <span>Max Picks</span>
            <input
              value={maxPicks}
              onChange={(event) => setMaxPicks(event.target.value)}
              placeholder="5"
              inputMode="numeric"
            />
          </label>

          <button
            type="button"
            className="gamblerPrimaryBtn gamblerFullBtn"
            onClick={runSimulation}
          >
            Run Simulation
          </button>
        </form>
      </section>

      {latestSimulation && (
        <section className="gamblerSideCard">
          <h2>Latest Result</h2>

          <div className="gamblerResultGrid">
            <div>
              <small>Picks Used</small>
              <strong>{latestSimulation.selectedCount}</strong>
            </div>

            <div>
              <small>Total Risk</small>
              <strong>${latestSimulation.totalRisk.toFixed(2)}</strong>
            </div>

            <div>
              <small>Projected EV</small>
              <strong>${latestSimulation.projectedProfit.toFixed(2)}</strong>
            </div>

            <div>
              <small>Worst Case</small>
              <strong>-${latestSimulation.projectedLoss.toFixed(2)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="gamblerSideCard">
        <h2>Model Notes</h2>

        <div className="gamblerNoteList">
          <div>
            <span>Markets</span>
            <p>Moneyline, spread, and over/under totals.</p>
          </div>

          <div>
            <span>Model</span>
            <p>Recommendations are ranked by team performance and implied probability.</p>
          </div>

          <div>
            <span>Warning</span>
            <p>Analytics only. No guaranteed outcomes.</p>
          </div>
        </div>
      </section>
    </aside>
  );
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <section className="gamblerStatCardPro">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{meta}</span>
    </section>
  );
}