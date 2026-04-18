function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Phase 1 Foundation</p>
        <h1>paper-cleaner</h1>
        <p className="description">
          Frontend and backend scaffolding are in place. Editor features,
          document workflows, and exports will be added in later phases.
        </p>
      </section>
      <section className="status-grid" aria-label="Project status">
        <article className="status-card">
          <h2>Frontend</h2>
          <p>Vite, React, TypeScript, and pnpm-based scripts are configured.</p>
        </article>
        <article className="status-card">
          <h2>Backend</h2>
          <p>FastAPI is bootable with an `/api/health` endpoint.</p>
        </article>
        <article className="status-card">
          <h2>Docker</h2>
          <p>Multi-stage packaging is prepared for a single runtime container.</p>
        </article>
      </section>
    </main>
  );
}

export default App;
