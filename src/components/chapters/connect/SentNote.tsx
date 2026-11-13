"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { useScroll } from "@/components/shell/SmoothScroll";
import { Button } from "@/components/ui/Button";
import { Seal } from "@/components/ui/Seal";
import { DURATION, EASE_POINTS, prefersReducedMotion } from "@/lib/motion";

/** A rectangle measured from the top left of the form's frame, in pixels. */
export type Box = { x: number; y: number; width: number; height: number };

// Sizes in pixels, on the 8px lattice.
const SQUARE = 96;
const SEAL = 64;
/** The fixed header, plus a little air. Anything above this line counts as out of view. */
const HEADER_CLEARANCE = 72;

// Timings in seconds. The message folds, the seal comes down on it, the words arrive.
const FADE = DURATION.micro / 1000;
const FOLD = DURATION.ui / 1000;
const STAMP_AT = FOLD + 0.04;
// The stamp matches the one in the opening: 460ms, the first 42% of it falling.
const STAMP = 0.46;
const IMPACT = 0.42;
const IMPACT_AT = STAMP_AT + STAMP * IMPACT;
const TEXT_AT = IMPACT_AT + 0.1;
/** Seconds from the start until the confirmation has fully arrived, after which the form's space can fold away. */
export const SENT_SETTLED = TEXT_AT + FOLD;
/** The fall speeds up all the way to the paper. */
const fall = (t: number) => Math.pow(t, 2.2);

type SentNoteProps = {
  /** Where the message box was when the visitor pressed Send. The square starts there. */
  from: Box | null;
  name: string;
  email: string;
  onSendAnother: () => void;
};

/**
 * The confirmation that takes the form's place. The message box folds into a
 * small square, the name seal stamps it, then the words appear. With reduced
 * motion everything is simply there, faded in.
 */
export function SentNote({ from, name, email, onSendAnother }: SentNoteProps) {
  const still = useReducedMotion() ?? false;
  const noteRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { scrollTo } = useScroll();

  useEffect(() => {
    const note = noteRef.current;
    const heading = headingRef.current;
    if (!note || !heading) return;
    heading.focus({ preventScroll: true });
    // On a phone the Send button sits most of a screen below the top of the form,
    // so the confirmation can appear above the visible page. Bring it into view.
    if (note.getBoundingClientRect().top < HEADER_CLEARANCE) scrollTo(note, { immediate: prefersReducedMotion() });
  }, [scrollTo]);

  const fold = !still && from !== null;

  return (
    <motion.div
      ref={noteRef}
      className="relative [grid-area:1/1]"
      initial={still ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE, ease: EASE_POINTS.settle }}
    >
      {/* The message, folded. */}
      <motion.div
        aria-hidden="true"
        className="absolute left-0 top-0 rounded-[2px] border border-line bg-surface"
        style={{ width: SQUARE, height: SQUARE }}
        initial={fold ? { x: from.x, y: from.y, width: from.width, height: from.height, scale: 1 } : false}
        animate={
          still
            ? { x: 0, y: 0, width: SQUARE, height: SQUARE, scale: 1 }
            : { x: 0, y: 0, width: SQUARE, height: SQUARE, scale: [1, 0.96, 1] }
        }
        transition={{
          duration: FOLD,
          ease: EASE_POINTS.flight,
          // The paper gives a little under the stamp.
          scale: { delay: IMPACT_AT, duration: 0.3, times: [0, 0.25, 1], ease: EASE_POINTS.settle },
        }}
      />

      {/* The seal, coming down on it. */}
      <div aria-hidden="true" className="absolute left-0 top-0 grid place-items-center" style={{ width: SQUARE, height: SQUARE }}>
        <motion.div
          initial={still ? false : { opacity: 0, scale: 1.6, rotate: -8 }}
          animate={
            still
              ? { opacity: 1, scale: 1, rotate: -2 }
              : {
                  opacity: 1,
                  scale: [1.6, 0.97, 1],
                  rotate: [-8, -2.5, -2],
                  filter: [
                    "drop-shadow(0px 17px 28px rgba(0, 0, 0, 0.28))",
                    "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.28))",
                    "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0))",
                  ],
                }
          }
          transition={{
            delay: STAMP_AT,
            duration: STAMP,
            times: [0, IMPACT, 1],
            ease: [fall, EASE_POINTS.settle],
            opacity: { delay: STAMP_AT, duration: (STAMP * IMPACT) / 2.4, ease: "linear" },
          }}
        >
          <Seal size={SEAL} />
        </motion.div>
      </div>

      <motion.div
        style={{ paddingTop: SQUARE + 32 }}
        initial={still ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: TEXT_AT, duration: FOLD, ease: EASE_POINTS.settle }}
      >
        <h3 ref={headingRef} tabIndex={-1} className="text-heading font-semibold outline-none">
          Sent.
        </h3>
        <p className="measure mt-3 text-lead text-ink-soft [overflow-wrap:anywhere]">
          Thanks, <span className="text-ink">{name}</span>. Your message is in my inbox, with <span className="text-ink">{email}</span> as the address to reply to.
        </p>
        <Button variant="outline" className="mt-8" onClick={onSendAnother}>
          Send another message
        </Button>
      </motion.div>
    </motion.div>
  );
}
