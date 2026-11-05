import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Building things, then shipping them.</h1>
      <p>
        I&apos;m Nathan Felix — software engineer focused on practical systems,
        clean interfaces, and infrastructure you can actually maintain. This site
        is a living portfolio of that work.
      </p>
      <div className="cta-row">
        <Link href="/projects" className="button button-primary">
          View projects
        </Link>
        <Link href="/about" className="button button-ghost">
          About me
        </Link>
      </div>
    </section>
  );
}
