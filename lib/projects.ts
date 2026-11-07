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
    slug: "scholarship-system",
    title: "Scholarship management system",
    summary:
      "Drupal CMS full-stack platform for the McKay School of Education supporting $3M+ in scholarship distribution across 800+ students, plus internal dashboards for administrative workflows.",
    tags: ["Drupal", "PHP", "Full stack", "BYU"],
  },
  {
    slug: "clear-sky-messaging",
    title: "Patient messaging integration",
    summary:
      "Serverless Charm Health ↔ Spruce Health bridge for Clear Sky Psychiatry that automates patient messages and reminders through one phone number—built on AWS Lambda and API Gateway.",
    tags: ["AWS Lambda", "API Gateway", "Integrations"],
  },
  {
    slug: "second-chair",
    title: "Second Chair.ai platform",
    summary:
      "NestJS backend and Next.js frontend over GraphQL with typed clients, reusable React components, OpenAI-powered workflows, and Braintrust monitoring for case-management pipelines.",
    tags: ["NestJS", "Next.js", "GraphQL", "OpenAI"],
  },
  {
    slug: "oit-monitoring",
    title: "BYU OIT monitoring & docs",
    summary:
      "Log analysis across seven environments, automated server-health alerting, and a GitHub–Brightspot integration that centralized technical documentation.",
    tags: ["Brightspot", "Monitoring", "GitHub"],
  },
  {
    slug: "event-tracker",
    title: "Event tracking web app",
    summary:
      "Full-stack event tracking application with Node.js and EJS, including backend logic and AWS cloud deployment.",
    tags: ["Node.js", "EJS", "AWS"],
  },
  {
    slug: "recommendation-system",
    title: "Recommendation system backend",
    summary:
      "Backend services for a recommendation system using C# and React, with cloud-based deployment on AWS.",
    tags: ["C#", "React", "AWS"],
  },
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
    slug: "quixx",
    title: "Quixx",
    summary:
      "Browser implementation of the Quixx dice game: two-player turns, colored number rows, dice rolls, and per-turn selection rules built with React and Vite.",
    tags: ["React", "TypeScript", "Vite", "Board game"],
    href: "https://nathanfelix72.com/quixx/",
    repo: "https://github.com/nathanfelix72/Board-Games",
  },
  {
    slug: "exercise-timer",
    title: "Exercise timer",
    summary:
      "Custom workout routine builder with drag-and-drop ordering, quick breaks, a circular progress timer, and audio cues. Routines persist in the browser via localStorage—no server required.",
    tags: ["Vanilla JS", "localStorage", "Timer"],
    href: "https://nathanfelix72.com/exercise-timer/",
    repo: "https://github.com/nathanfelix72/exercise-timer",
  },
  {
    slug: "wordle",
    title: "Wordle",
    summary:
      "Terminal-style port of my Python Wordle CLI: colored guess feedback, stats, and a word finder that filters candidates from grey/yellow/green criteria.",
    tags: ["Next.js", "React", "Games", "CLI"],
    href: "https://nathanfelix72.com/wordle/",
  },
  {
    slug: "is-590r-uno",
    title: "IS 590R Uno",
    summary:
      "Realtime multiplayer Uno inside the BYU IS 590R monorepo—Angular table UI, Laravel Uno engine, chat/broadcast moves, and AI-generated board backgrounds. Needs always-on EC2 + MySQL, so no live demo on this static host.",
    tags: ["Angular", "Laravel", "WebSockets", "Uno", "EC2"],
    repo: "https://github.com/nathanfelix72/byu-590r",
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
