import type { Project } from "@/lib/projects";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <h2>{project.title}</h2>
      <p>{project.summary}</p>
      <ul className="tag-list">
        {project.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className="project-links">
        {project.href ? (
          <a href={project.href} target="_blank" rel="noreferrer">
            Live site
          </a>
        ) : null}
        {project.repo ? (
          <a href={project.repo} target="_blank" rel="noreferrer">
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
