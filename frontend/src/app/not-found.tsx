import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div>
          <h1>Page not found</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-md)", fontWeight: 400, marginTop: "var(--s-2)" }}>
            That page doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        </div>
        <div>
          <Link href="/" className="btn btn-primary">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
