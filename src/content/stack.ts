import type { Tool, ToolArea } from "./types";

/**
 * Tools, as casino plaques: one tower per area, one plaque per tool.
 * Taken from the CV. Within a tower, the first listed sits at the bottom.
 *
 * Optional: the year each tool was first used (`since`). A plaque without one
 * simply shows no year.
 */
export const stackIsPlaceholder = false;

export const areas: ToolArea[] = ["Languages", "Frontend", "Backend", "Data", "Tools"];

export const stackCopy = {
  /** Heading of the list screen readers get in place of the blocks. */
  groupLabel: "Tools, grouped by area",
  /** The one line beside the Reset button. */
  hint: "Drag the blocks around. Reset puts them back.",
  reset: "Reset",
  /** "7 tools", under each tower and in the list. */
  toolCount: (count: number) => `${count} ${count === 1 ? "tool" : "tools"}`,
  /** Read after a tool's name when the year is known. */
  since: (year: number) => `since ${year}`,
};

export const tools: Tool[] = [
  { name: "Java", area: "Languages" },
  { name: "TypeScript", area: "Languages" },
  { name: "JavaScript", area: "Languages" },
  { name: "Python", area: "Languages" },
  { name: "C", area: "Languages" },
  { name: "C#", area: "Languages" },
  { name: "MATLAB", area: "Languages" },
  { name: "React", area: "Frontend" },
  { name: "Next.js", area: "Frontend" },
  { name: "HTML and CSS", area: "Frontend" },
  { name: "JavaFX", area: "Frontend" },
  { name: "NestJS", area: "Backend" },
  { name: "Camunda", area: "Backend" },
  { name: "BPMN", area: "Backend" },
  { name: "Maven", area: "Backend" },
  { name: "PostgreSQL", area: "Data" },
  { name: "MongoDB", area: "Data" },
  { name: "Git", area: "Tools" },
  { name: "Docker", area: "Tools" },
  { name: "Postman", area: "Tools" },
  { name: "Lens", area: "Tools" },
];
