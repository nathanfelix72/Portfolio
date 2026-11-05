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
    slug: "legoize",
    title: "Legoize",
    summary:
      "Capstone prototype: upload a photo, map it to a LEGO color grid, and inspect a 3D brick build with parts list and step-through instructions. Work in progress — try the live demo.",
    tags: ["Vite", "Three.js", "Computer vision", "WIP"],
    href: "https://nathanfelix72.com/legoize/",
    repo: "https://github.com/nathanfelix72/Legoize",
  },
  {
    slug: "portfolio",
    title: "This portfolio",
    summary:
      "A statically exported Next.js site on S3 and CloudFront, provisioned with Terraform and deployed from GitHub Actions.",
    tags: ["Next.js", "AWS", "Terraform"],
    href: "https://nathanfelix72.com/",
    repo: "https://github.com/nathanfelix72/Portfolio",
  },
];
