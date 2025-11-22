import ShopifyDashboardClient from "./ShopifyDashboardClient";

export const dynamic = "force-dynamic";

export default function ShopifyDashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: "2rem 1.5rem 3rem",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "1200px" }}>
        <ShopifyDashboardClient />
      </div>
    </main>
  );
}




