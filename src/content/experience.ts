import type { ExperienceRole } from "./types";

/**
 * Jobs and internships, newest first, shown in the Work chapter above the
 * projects. Kept short on purpose: the full detail lives in the CV PDF.
 */
export const experience: ExperienceRole[] = [
  {
    organisation: "Sandfield",
    role: "Software Developer Intern",
    dates: "Nov 2026 to Feb 2027",
    summary: "Summer internship as a software developer.",
    note: "Incoming",
  },
  {
    organisation: "Harmoney",
    role: "Software Engineer Intern",
    dates: "Nov 2025 to Feb 2026",
    summary:
      "Full-stack work at a market-leading fintech in Australia and New Zealand, all shipped to production. Built the internal Customer Loan Blocking tool, and the Rewrite feature for loan consolidation, which lifted retention by over 70%.",
  },
  {
    organisation: "PB Technologies",
    role: "Technical Assistant",
    dates: "Jul 2022 to Mar 2025",
    summary: "Helped customers choose the right technology, and set up their hardware and software.",
  },
];

export const experienceCopy = {
  heading: "Experience",
  /** The link to the full CV, beside the heading. */
  cv: "Full CV",
  cvFormat: "PDF",
};
