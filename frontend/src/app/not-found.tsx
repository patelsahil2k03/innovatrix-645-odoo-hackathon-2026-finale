import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: "center" }}>
        {/* A chair with one leg off, the tenon still visible on the loose piece —
            repairable rather than destroyed. A 404 here is a wrong turn, not a
            catastrophe, and the picture should say the same thing the copy does. */}
        <Image
          className="notfound-art"
          src="/img/scene/error.webp"
          alt=""
          width={520}
          height={520}
          aria-hidden="true"
          unoptimized
          priority
        />
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
