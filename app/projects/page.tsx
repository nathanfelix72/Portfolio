import type { Metadata } from "next";
import { ProjectCard } from "@/components/ProjectCard";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <section>
      <h1 className="section-title">Projects</h1>
      <p className="section-lead">
        A short list of things I&apos;ve built. Add new entries in{" "}
        <code>lib/projects.ts</code>.
      </p>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
