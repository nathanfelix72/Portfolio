import Image from "next/image";
import Link from "next/link";

function StickDoodle() {
  return (
    <svg
      className="hero-play-doodle"
      viewBox="0 0 40 48"
      width="28"
      height="34"
      aria-hidden="true"
    >
      <g className="hero-play-doodle-figure">
        <circle cx="20" cy="8" r="5.5" fill="none" strokeWidth="1.75" />
        <path
          d="M20 14v16M20 20l-9 5M20 20l9 5M20 30l-7 12M20 30l7 12"
          fill="none"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <circle className="hero-play-portal hero-play-portal-a" cx="6" cy="40" r="2.2" />
      <circle className="hero-play-portal hero-play-portal-b" cx="34" cy="40" r="2.2" />
    </svg>
  );
}

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
        <Link href="/play" className="hero-play-aside">
          <StickDoodle />
          <span className="hero-play-aside-copy">
            <span className="hero-play-aside-label">Play portal</span>
            <span className="hero-play-aside-text">
              A tiny stick-figure portal sandbox
            </span>
          </span>
        </Link>
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
