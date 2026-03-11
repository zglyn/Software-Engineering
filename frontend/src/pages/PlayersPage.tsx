import React from "react";
import { Link } from "react-router-dom";
import "./PlayersPage.css";

export default function PlayersPage() {
  return (
    <div className="playersPage">
      <div className="playersPageHeader">
        <Link to="/" className="playersPageBack">
          ← Back
        </Link>
      </div>

      <div className="playersPageContent">
        <p className="playersPageMessage">Player portal</p>
        <h1 className="playersPageTitle">Manage your stats and uploads</h1>
        <p className="playersPageSubtitle">
          Upload content, control privacy, and access your personal workspace.
        </p>

        <div className="playersPageGrid">
          <Link to="/stats" className="playersPageCard">
            <div className="playersPageCardTitle">Stats Page</div>
            <div className="playersPageCardText">
              Tag players, choose privacy, and publish stat updates.
            </div>
          </Link>

          <Link to="/uploads" className="playersPageCard">
            <div className="playersPageCardTitle">My Uploads</div>
            <div className="playersPageCardText">
              View uploaded clips and track processing status.
            </div>
          </Link>

          <div className="playersPageCard">
            <div className="playersPageCardTitle">Profile Controls</div>
            <div className="playersPageCardText">
              Manage what content is public, team-only, or GM-only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}