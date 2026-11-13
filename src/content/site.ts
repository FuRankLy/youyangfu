import type { ChapterMeta, NavItem, Place } from "./types";

const hometown: Place = {
  name: "Zhengzhou",
  chinese: "郑州",
  lat: 34.7466,
  lon: 113.6253,
  tz: "Asia/Shanghai",
  latLabel: "34.7°N",
};

const home: Place = {
  name: "Auckland",
  lat: -36.8485,
  lon: 174.7633,
  tz: "Pacific/Auckland",
  latLabel: "36.8°S",
};

export const site = {
  name: {
    display: "Frank Fu",
    legal: "Youyang Fu",
    chinese: "付优扬",
    pinyin: "Fù Yōuyáng",
    /** One entry per character: pinyin and its tone contour on the Chao 1 to 5 scale. */
    syllables: [
      { char: "付", text: "fù", chao: [5, 1] },
      { char: "优", text: "yōu", chao: [5, 5] },
      { char: "扬", text: "yáng", chao: [3, 5] },
    ],
  },
  domain: "youyangfu.com",
  url: "https://youyangfu.com",
  intro: "Software engineering student at the University of Auckland. Born in Zhengzhou, raised in Hamilton.",
  description:
    "Frank Fu (Youyang Fu, 付优扬) is a software engineering student at the University of Auckland. Born in Zhengzhou, China, and raised in Hamilton, New Zealand.",
  education: {
    degree: "Bachelor of Engineering (Honours)",
    specialisation: "Software Engineering",
    institution: "University of Auckland",
    /** First day of the first academic year. The year of study is derived from this, never typed. */
    start: "2024-03-01",
    expectedEnd: "2027-11-30",
    years: 4,
  },
  links: {
    github: "https://github.com/FuRankLy" as string | null,
    linkedin: "https://www.linkedin.com/in/youyang-fu" as string | null,
    /** The CV as a PDF in /public. It carries the owner's phone number and email address, by their choice. */
    cv: "/Frank-Fu-CV.pdf",
  },
  places: { hometown, home },
  life: {
    // Month precision until the owner decides whether to publish exact days.
    born: "2006-03-15",
    bornLabel: "March 2006",
    /** Arrived in New Zealand, and grew up in Hamilton from then. */
    arrived: "2016-07-15",
    arrivedLabel: "July 2016",
    grewUpIn: "Hamilton",
    /** Moved to Auckland for university. */
    movedToAuckland: "2024-03",
    movedToAucklandLabel: "March 2024",
    approximate: true,
  },
  distanceKm: 10163,
  /** Shows small "placeholder content" notes on sections that still hold sample data. Development only; never on the live site. */
  showDraftNotes: true,
} as const;

export const chapters: ChapterMeta[] = [
  { id: "two-homes", numeral: "壹", title: "Two homes", blurb: "Ten years in Zhengzhou, then Hamilton, and now Auckland." },
  { id: "chart", numeral: "贰", title: "The chart", blurb: "My life so far, drawn the way a market would draw it." },
  { id: "work", numeral: "叁", title: "Work", blurb: "Where I've worked and what I've built." },
  { id: "stack", numeral: "肆", title: "Stack", blurb: "The languages and tools I work with." },
  { id: "play", numeral: "伍", title: "Off the clock", blurb: "Badminton and Hold'em." },
  { id: "connect", numeral: "陆", title: "Let's connect", blurb: "Work, a badminton hit, or just hello." },
];

export const chapterById = (id: string) => {
  const index = chapters.findIndex((c) => c.id === id);
  if (index < 0) throw new Error(`Unknown chapter: ${id}`);
  return { ...chapters[index], number: index + 1 };
};

/**
 * Explains a chapter numeral to anyone who doesn't read Chinese. Shown as a
 * tooltip on the numeral, which also carries its number in plain digits.
 */
export const numeralNote = (numeral: string, number: number) =>
  `${numeral} is ${number}, written the formal way Chinese banks and cheques use so the amount can't be altered.`;

export const nav: NavItem[] = [
  { label: "About", href: "/#two-homes", chapters: ["two-homes", "chart"] },
  { label: "Work", href: "/#work", chapters: ["work", "stack"] },
  { label: "Play", href: "/#play", chapters: ["play"] },
  { label: "Contact", href: "/#connect", chapters: ["connect"] },
  { label: "CV", href: "/Frank-Fu-CV.pdf" },
];

/** Topics offered as chips in the contact form. The chosen one becomes the email subject. */
export const contactTopics = ["Work", "Just saying hi", "Badminton hit", "Something else"] as const;
export type ContactTopic = (typeof contactTopics)[number];
