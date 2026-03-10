import React from "react";
import { Link } from "react-router-dom";

export default function PublicPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111217",
        color: "white",
        padding: "40px",
      }}
    >
      <Link to="/" style={{ color: "#a78bfa" }}>
        ← Back
      </Link>
      <h1>Public Page</h1>
      <p>This page is rendering.</p>
    </div>
  );
}