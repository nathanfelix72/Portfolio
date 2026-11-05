import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <section>
      <h1 className="section-title">About</h1>
      <div className="about-copy">
        <p>
          This portfolio is intentionally small: a static Next.js export on S3
          and CloudFront, with Terraform owning the infrastructure and GitHub
          Actions publishing every push to <code>main</code>.
        </p>
        <p>
          Swap this copy for your own story — what you build, where you&apos;ve
          worked, and how people can reach you.
        </p>
      </div>
    </section>
  );
}
