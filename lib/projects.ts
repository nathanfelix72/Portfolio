export type Project = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  href?: string;
  repo?: string;
};

export const projects: Project[] = [
  {
    slug: "portfolio",
    title: "This portfolio",
    summary:
      "A statically exported Next.js site on S3 and CloudFront, provisioned with Terraform and deployed from GitHub Actions.",
    tags: ["Next.js", "AWS", "Terraform"],
    repo: "https://github.com/nathanfelix72/Portfolio",
  },
  {
    slug: "sample-api",
    title: "Sample project",
    summary:
      "Placeholder card for your next build. Replace this entry in lib/projects.ts.",
    tags: ["Coming soon"],
  },
];
