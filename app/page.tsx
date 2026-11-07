import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>Nathan Felix</h1>
        <p>
          Full stack software engineer building university-scale web apps,
          integrations, and AI-assisted workflows. Currently a senior engineer at
          BYU&apos;s McKay School of Education and finishing an MISM at the Marriott
          School.
        </p>
        <div className="cta-row">
          <Link href="/projects" className="button button-primary">
            View projects
          </Link>
          <Link href="/about" className="button button-ghost">
            About me
          </Link>
        </div>
      </div>
      <Image
        className="hero-photo"
        src="/nathan-felix.png"
        alt="Professional headshot of Nathan Felix"
        width={480}
        height={480}
        priority
      />
    </section>
  );
}
