import Link from "next/link";

export default function NotFound() {
  return (
    <section className="hero">
      <h1>Page not found</h1>
      <p>That route doesn&apos;t exist on this static site.</p>
      <div className="cta-row">
        <Link href="/" className="button button-primary">
          Back home
        </Link>
      </div>
    </section>
  );
}
