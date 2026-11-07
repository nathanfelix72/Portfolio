import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

const roles = [
  {
    title: "Senior Engineer / Full Stack Web Developer",
    org: "BYU McKay School of Education",
    dates: "Mar 2025 – Present",
    detail:
      "Building and maintaining Drupal CMS systems that support $3M+ in scholarship distribution for 800+ students, plus internal dashboards and content tools in a 9-person agile team.",
  },
  {
    title: "Full Stack Developer",
    org: "Second Chair.ai",
    dates: "Feb 2026 – May 2026",
    detail:
      "Shipped a NestJS and Next.js stack over GraphQL, reusable React UI, and LLM workflows with OpenAI and Braintrust monitoring.",
  },
  {
    title: "Developer / Consultant",
    org: "Clear Sky Psychiatry and Therapy",
    dates: "Apr 2026 – Sep 2026",
    detail:
      "Designed a serverless Charm Health ↔ Spruce Health integration on AWS Lambda and API Gateway to automate patient messaging without duplicate communications.",
  },
  {
    title: "Data Service Analyst",
    org: "BYU Office of IT",
    dates: "Apr 2026 – Sep 2026",
    detail:
      "Analyzed logs across 7 environments, built monitoring and alerting for server health, and integrated Brightspot docs with GitHub for a maintainable knowledge base.",
  },
  {
    title: "Teaching Assistant",
    org: "BYU Information Systems",
    dates: "Jan 2024 – Present",
    detail:
      "Tutored hundreds of students across 7 IS courses in programming, databases, and systems analysis while creating instructional materials and grading in Learning Suite and Canvas.",
  },
];

const skills = [
  "React",
  "Next.js",
  "TypeScript",
  "NestJS",
  "Vue.js",
  "PHP",
  "Drupal",
  "Python",
  "C#",
  "SQL",
  "GraphQL",
  "AWS",
  "CI/CD",
  "OpenAI API",
  "Langchain",
  "Braintrust",
];

export default function AboutPage() {
  return (
    <section>
      <h1 className="section-title">About</h1>
      <div className="about-copy">
        <p>
          I&apos;m a full stack software engineer finishing a Master of Information
          Systems Management at Brigham Young University&apos;s Marriott School of
          Business (Software Development emphasis, GPA 3.96). I turn business
          requirements into reliable web systems—often with PHP, Vue, React,
          Python, SQL, and AWS—and I&apos;ve spent years mentoring students as a
          teaching assistant across seven IS courses.
        </p>
        <p>
          Day to day I work as a senior full stack engineer at the McKay School
          of Education, where I help run scholarship and administrative platforms
          at university scale. I also use AI tools like Cursor and Claude to
          move faster on debugging, refactoring, and feature work.
        </p>
      </div>

      <h2 className="about-subtitle">Experience</h2>
      <ul className="experience-list">
        {roles.map((role) => (
          <li key={`${role.org}-${role.title}`}>
            <div className="experience-header">
              <strong>{role.title}</strong>
              <span>{role.dates}</span>
            </div>
            <div className="experience-org">{role.org}</div>
            <p>{role.detail}</p>
          </li>
        ))}
      </ul>

      <h2 className="about-subtitle">Education</h2>
      <ul className="experience-list">
        <li>
          <div className="experience-header">
            <strong>Master of Information Systems Management</strong>
            <span>Apr 2027</span>
          </div>
          <div className="experience-org">
            Brigham Young University · Marriott School of Business
          </div>
          <p>
            Software Development emphasis. Coursework in AI and agentic systems,
            full-stack development, cloud infrastructure, databases, machine
            learning, and cybersecurity. VP of Event Logistics for the
            Association of Information Systems; Phi Eta Sigma; Business School
            Dean&apos;s List; academic scholarships every semester.
          </p>
        </li>
        <li>
          <div className="experience-header">
            <strong>B.S. Information Systems</strong>
            <span>Apr 2026</span>
          </div>
          <div className="experience-org">
            Brigham Young University · Marriott School of Business
          </div>
        </li>
      </ul>

      <h2 className="about-subtitle">Skills</h2>
      <ul className="tag-list about-skills">
        {skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>

      <p className="about-contact">
        <a href="mailto:nathan.felix@gmail.com">nathan.felix@gmail.com</a>
        {" · "}
        <a
          href="https://www.linkedin.com/in/nathan-felix"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      </p>
    </section>
  );
}
