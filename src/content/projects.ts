import type { Project } from "./types";

/**
 * Projects, newest first. Each one gets a row in Work and a case study page
 * at /work/<slug>.
 *
 * The case studies hold what the CV says, plus the notes the owner has added.
 * Expand each one's sections with the full story: the problem, what you
 * built, the decisions, and what happened.
 *
 * Each project's cover is pixel art drawn in
 * src/components/chapters/work/art.ts, keyed by slug.
 */
export const projects: Project[] = [
  {
    slug: "meddomain",
    title: "MedDomain",
    year: 2026,
    role: "Co-founder and developer",
    stack: ["Cloudflare", "Stripe"],
    status: "seasonal",
    summary:
      "An AI practice app for the MMI, the admissions interview for medicine, made for first-year students at the University of Auckland.",
    links: [{ label: "Website", href: "https://meddomain.org" }],
    sections: [
      {
        heading: "Overview",
        body: [
          "MedDomain is an AI practice app for the Multiple Mini Interview (MMI), the admissions interview for medicine. It is made for first-year students at the University of Auckland.",
          "I co-founded it and built it.",
        ],
      },
      {
        heading: "How it works",
        body: [
          "A student picks a station and answers out loud on camera, timed like the real interview or with no clock.",
          "The answer is transcribed on their own device, then marked against real medical students' answers and the eight attributes the MMI is scored on, with written feedback on what to fix.",
          "The question bank holds more than 400 real MMI questions across five station types: moral and ethical judgement, career motivation, personal insight and experience, New Zealand health issues, and Hauora Māori.",
        ],
      },
      {
        heading: "Seasonal",
        body: [
          "MedDomain runs once a year, in the lead-up to the interviews, and rests in between.",
          "It is resting now, and opens again around September.",
        ],
      },
      {
        heading: "First season",
        body: ["2026 was its first year. It earned more than NZ$3,000 in revenue and had close to 100 concurrent users."],
      },
    ],
  },
  {
    slug: "web3-uoa",
    title: "WEB3 UoA",
    year: 2026,
    role: "Project manager and developer",
    stack: ["React", "Next.js", "PostgreSQL"],
    status: "live",
    summary: "The website and member profile system for the WEB3 club at the University of Auckland.",
    links: [
      { label: "Live site", href: "https://web3uoa.nz" },
      { label: "Source on GitHub", href: "https://github.com/UoaWDCC/web3" },
    ],
    sections: [
      {
        heading: "Overview",
        body: [
          "A website and user profile system for the WEB3 club at the University of Auckland, built by a student team at the Web Development Consulting Club (WDCC).",
          "I led the project as its project manager and worked on it as a developer.",
        ],
      },
    ],
  },
  {
    slug: "loan-blocking",
    title: "Temporary & UL Blocking",
    year: 2025,
    role: "Developer, Harmoney internship",
    stack: ["React", "Next.js", "PostgreSQL", "BPMN", "Postman"],
    status: "shipped",
    summary: "An internal tool at Harmoney for handling the different ways a customer's loan can be blocked.",
    links: [{ label: "Harmoney", href: "https://www.harmoney.co.nz" }],
    sections: [
      {
        heading: "Overview",
        body: [
          "Built during my software engineering internship at Harmoney, a market-leading fintech in Australia and New Zealand.",
          "The Customer Loan Blocking tool streamlines loan-disbursement management, gives the team real-time controls for exceptions, and simplifies how blocked accounts are handled.",
          "Like the rest of my work there, it went to production.",
          "It is internal tooling, so I can't show it in action here.",
        ],
      },
    ],
  },
  {
    slug: "bookminton",
    title: "Bookminton",
    year: 2025,
    role: "Developer",
    stack: ["JavaScript", "HTML", "CSS", "Java"],
    status: "deprecated",
    summary: "A Chrome extension that tackles the hardest part of badminton in Auckland: getting a court at the ABA.",
    links: [{ label: "Source on GitHub", href: "https://github.com/FuRankLy/Bookminton" }],
    sections: [
      {
        heading: "Overview",
        body: [
          "Bookminton automates court booking at the Auckland Badminton Association through its web APIs, with a monitoring bot that watches for free courts around the clock.",
          "It is written in two languages: JavaScript for the browser extension and Java for the bot.",
          "The Auckland Badminton Association has since changed how its website is managed, which has made the extension deprecated.",
        ],
      },
    ],
  },
];

export const projectsHavePlaceholders = projects.some((p) => p.placeholder);

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);

export const STATUS_LABEL: Record<Project["status"], string> = {
  live: "Live",
  seasonal: "Seasonal",
  shipped: "Shipped",
  "in-progress": "In progress",
  archived: "Archived",
  deprecated: "Deprecated",
};

/** The words around the index and the case study pages. */
export const workCopy = {
  columns: {
    project: "Project",
    year: "Year",
    role: "Role",
    stack: "Stack",
    status: "Status",
    links: "Links",
  },
  /** Heading above the project index. */
  projects: "Projects",
  /** Under the index. */
  note: "Each row opens its case study.",
  /** The link from a case study back to the index. */
  back: "All work",
  /** Above the link to the following case study. */
  next: "Next project",
};

/** The project after this one in the list, wrapping round to the first. */
export const nextProject = (slug: string) => {
  const index = projects.findIndex((p) => p.slug === slug);
  return projects[(index + 1) % projects.length];
};
