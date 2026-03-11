import React from "react";
import { useNavigate } from "react-router-dom";
import "./StartPage.css";

type Mode = "PUBLIC" | "PLAYER" | "MANAGEMENT" | null;

export default function StartPage() {
  const [selected, setSelected] = React.useState<Mode>(null);
  const navigate = useNavigate();

  const goNext = () => {
    if (selected === "PUBLIC") navigate("/public");
    if (selected === "PLAYER") navigate("/players");
    if (selected === "MANAGEMENT") navigate("/management");
  };

  return (
    <div className="startPage">
      <div className="startPageHeader">
        <div className="startPageInner">
          <div className="startPageEyebrow">Baller</div>
          <h1 className="startPageTitle">Choose how you want to enter</h1>
          <p className="startPageSubtitle">
            Enter as a public viewer, player, or management member.
          </p>
        </div>
      </div>

      <div className="startPageContent">
        <div className="startPageGrid">
          <button
            className={`startPageCard ${selected === "PUBLIC" ? "startPageCardActive" : ""}`}
            onClick={() => setSelected("PUBLIC")}
          >
            <div className="startPageCardTitle">Public</div>
            <div className="startPageCardText">
              View public highlights, player stats, and comparisons.
            </div>
          </button>

          <button
            className={`startPageCard ${selected === "PLAYER" ? "startPageCardActive" : ""}`}
            onClick={() => setSelected("PLAYER")}
          >
            <div className="startPageCardTitle">Players</div>
            <div className="startPageCardText">
              Upload stats, tag players, manage privacy, and review your own content.
            </div>
          </button>

          <button
            className={`startPageCard ${selected === "MANAGEMENT" ? "startPageCardActive" : ""}`}
            onClick={() => setSelected("MANAGEMENT")}
          >
            <div className="startPageCardTitle">Management</div>
            <div className="startPageCardText">
              Manage roles, review internal data, and oversee team operations.
            </div>
          </button>
        </div>

        <div className="startPageActions">
          <button
            className="startPageContinue"
            disabled={!selected}
            onClick={goNext}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}