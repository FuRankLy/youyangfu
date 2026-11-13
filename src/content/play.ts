import type { Game, Gear, Hand, Room, RoomId } from "./types";

/**
 * Off the clock: badminton gear, Hold'em, games.
 *
 * Only real content shows. Gear appears on the hologram once it is listed
 * here; an Arcade room returns when there are games to list.
 */
export const playIsPlaceholder = false;

/** The three rooms, in the order they stand side by side. */
export const rooms: Record<RoomId, Room> = {
  court: { id: "court", title: "Court", chinese: "球场" },
  table: { id: "table", title: "Table", chinese: "牌桌" },
  arcade: { id: "arcade", title: "Arcade", chinese: "游戏厅" },
};

/** Words in the Court. */
export const courtCopy = {
  stage: {
    /** Names the hologram for screen readers. */
    figure: "My badminton gear on a player built from small cubes, shown as a turning hologram.",
    /** In the stage's corner. */
    hint: "Drag to turn. Point at the gear.",
    /** Read after the name. */
    keys: "The left and right arrow keys turn it.",
    /** In the card under the stage on phones, until a piece of gear is chosen. */
    prompt: "Tap the racket, strings, grip, shoes or bag to see it.",
  },
  /** Names the row of gear buttons. */
  list: "My gear, top to bottom",
};

/**
 * My gear, as it appears on the hologram. Each piece's pixel art and colours
 * live in src/components/chapters/play/gear-art.ts.
 */
export const gear: Gear[] = [
  { slot: "racket", label: "Racket", name: "Victor Thruster Ryuga" },
  { slot: "strings", label: "Strings", name: "Yonex BG80" },
  { slot: "grip", label: "Grip", name: "Victor GR338" },
  { slot: "shoes", label: "Shoes", name: "Victor A970ACE" },
  { slot: "bag", label: "Bag", name: "Victor BR9611LZJ" },
];

/** Men's badminton smash world record in km/h, for the smash meter. */
export const smashRecordKmh = 565;

/** e.g. { title: "Valorant", hours: 312, rank: "Diamond", main: "Jett" }. Empty shows a "coming soon" line. */
export const games: Game[] = [];

/** Words in the Arcade. */
export const arcadeCopy = {
  list: "Save files",
  /** Shown while `games` is empty. */
  empty: "My save files are on their way.",
  rank: "Rank",
  main: "Main",
  /** Follows the hours played, e.g. "312 h". */
  hoursUnit: "h",
  hoursLabel: "hours played",
  /** Name of the one-button game whose cabinet waits under the save files. */
  rally: "Rally",
};

/**
 * My hand at the Table. The hole cards are face up; the board deals street by
 * street. The river isn't dealt: life is still early.
 */
export const hand: Hand = {
  hole: ["2♦", "7♦"],
  holeNote: "27, my birthday. A modest start, but suited.",
  streets: [
    {
      name: "Flop",
      cards: ["2♠", "6♦", "A♦"],
      note: "Paired up and improving: stronger than at the start, though not yet the strongest.",
    },
    {
      name: "Turn",
      cards: ["7♥"],
      note: "The more resilient I am, the stronger I grow, and the more opportunities open up.",
    },
    { name: "River", cards: [], note: "Not dealt yet. It's still early." },
  ],
};

/** Words at the Table. */
export const tableCopy = {
  hand: "My hand",
  board: "The board",
  /** Shown until a street has been dealt. */
  hint: "Press a card to deal that street.",
  turnAll: "Deal the board",
  reset: "Reset",
  /** Read for the river, which stays face down. */
  undealt: "not dealt yet",
};
