export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <h1>Dashboard MVP</h1>
      <p>Next.js placeholder – the UI will be implemented in later stages.</p>
    </main>
  );
}
