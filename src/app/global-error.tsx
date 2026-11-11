"use client";

/** Last-resort screen when even the main layout fails. Plain styles: the app's CSS may not have loaded. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa", minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>
        <div>
          <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>Aoient</p>
          <h1 style={{ fontSize: 20, margin: "20px 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#a3a3a3", maxWidth: 360, margin: "0 auto 20px", fontSize: 14 }}>The app couldn&apos;t load. Your data is safe. Please try again in a moment.</p>
          {error.digest && <p style={{ color: "#a3a3a3", fontSize: 12, fontFamily: "monospace" }}>Code: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 8, background: "#fafafa", color: "#0a0a0a", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
