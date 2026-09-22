import { APP_NAME } from "@kantorcore/config";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{APP_NAME}</h1>
      <p style={{ color: "#555" }}>Foundation is live — Phase 0a.</p>
      <p>
        <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
