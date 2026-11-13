"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { sendMessage } from "@/app/actions/contact";
import { Button, chipClass, fieldClass } from "@/components/ui/Button";
import { Seal } from "@/components/ui/Seal";
import { cn } from "@/lib/cn";
import type { ContactField, ContactLimits, ContactState, ContactValues } from "@/lib/contact";
import { DURATION, EASE_POINTS } from "@/lib/motion";
import { ReplyEstimate } from "./ReplyEstimate";
import { SENT_SETTLED, SentNote, type Box } from "./SentNote";

// The contact form. Fields are uncontrolled: the server action echoes what was
// entered, and those values become the fields' defaults, so the text survives
// the reset React performs after every form action.

const UNREACHABLE =
  "Couldn't reach the server, so nothing was sent. Your message is still in the form. Check your connection and try again.";

/** Share of the message limit after which the character count stops being quiet. */
const NEAR_LIMIT = 0.9;

const numberFormat = new Intl.NumberFormat("en-NZ");

// The shared field look switches its outline off on focus and never back on, so a
// focused field shows no ring. Until that is fixed in ui/Button.tsx, turn it on here.
const field = cn(fieldClass, "focus-visible:outline-solid");

/**
 * Calls the server action. If the request itself fails (offline, a timeout, a
 * deploy in between), the form gets an ordinary "failed" state with the text
 * kept, where a rejected action would otherwise take the whole page down.
 */
async function submit(previous: ContactState, formData: FormData): Promise<ContactState> {
  try {
    return await sendMessage(previous, formData);
  } catch {
    const entered = (field: ContactField) => {
      const value = formData.get(field);
      return typeof value === "string" ? value : "";
    };
    return {
      status: "failed",
      values: { name: entered("name"), email: entered("email"), topic: entered("topic"), message: entered("message") },
      errors: {},
      message: UNREACHABLE,
    };
  }
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex gap-2.5 text-small">
      <span className="mt-[0.5em] size-1.5 shrink-0 bg-cinnabar" aria-hidden="true" />
      {children}
    </p>
  );
}

type ContactFormProps = {
  topics: readonly string[];
  defaultTopic: string;
  limits: ContactLimits;
  /** Name of the decoy field that only scripts fill in. */
  honeypot: string;
};

export function ContactForm({ topics, defaultTopic, limits, honeypot }: ContactFormProps) {
  const id = useId();
  const blank: ContactValues = { name: "", email: "", topic: defaultTopic, message: "" };
  const initial: ContactState = { status: "idle", values: blank, errors: {}, message: null };
  const [state, formAction, pending] = useActionState(submit, initial);

  // "Send another" puts the confirmation away. Remembering which result was
  // dismissed, not a flag, means the next successful send shows it again.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  // Length of the message as typed since the last response from the server.
  const [typed, setTyped] = useState<{ since: ContactState; length: number } | null>(null);
  // Where the message box was when Send was pressed, for the fold.
  const [foldFrom, setFoldFrom] = useState<Box | null>(null);

  const still = useReducedMotion() ?? false;
  const frameRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const sent = state.status === "sent" && state !== dismissed;
  // After a successful send the form empties itself behind the confirmation.
  const values = state.status === "sent" ? blank : state.values;
  const { errors } = state;
  const checkedTopic = topics.includes(values.topic) ? values.topic : defaultTopic;

  const length = typed?.since === state ? typed.length : values.message.length;
  const over = length - limits.messageMax;
  const nearLimit = length >= limits.messageMax * NEAR_LIMIT;
  const countText =
    over > 0
      ? `${numberFormat.format(over)} over the limit of ${numberFormat.format(limits.messageMax)}`
      : nearLimit
        ? `${numberFormat.format(-over)} of ${numberFormat.format(limits.messageMax)} characters left`
        : `${numberFormat.format(length)} / ${numberFormat.format(limits.messageMax)}`;

  // A validation error moves focus to the first field that needs fixing.
  // The server lists errors in the order the fields appear.
  useEffect(() => {
    if (state.status !== "invalid") return;
    const first = Object.keys(state.errors)[0];
    const control = first ? formRef.current?.elements.namedItem(first) : null;
    const target = control instanceof RadioNodeList ? control[0] : control;
    if (target instanceof HTMLElement) target.focus();
  }, [state]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    const frame = frameRef.current?.getBoundingClientRect();
    const box = messageRef.current?.getBoundingClientRect();
    if (frame && box) {
      setFoldFrom({ x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height });
    }
  };

  const sendAnother = () => {
    // Render the form as usable again first, so it can take focus.
    flushSync(() => setDismissed(state));
    nameRef.current?.focus();
  };

  const describedBy = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined;
  const announcement = pending ? "Sending your message." : sent ? "Message sent." : (state.message ?? "");

  return (
    // The form and the confirmation share one grid cell. Once the confirmation has
    // settled, the form's empty space folds away, so nothing is left hanging below
    // "Sent." (most of a screen on a phone). Overflow is clipped only while the
    // height moves, so focus rings at the edges are never cut off.
    <div ref={frameRef} className="@container relative grid">
      <motion.div
        className="[grid-area:1/1]"
        initial={false}
        animate={
          sent
            ? { opacity: 0, height: 0, overflow: "hidden" }
            : { opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }
        }
        transition={{
          duration: DURATION.micro / 1000,
          ease: EASE_POINTS.settle,
          height: {
            delay: sent ? (still ? DURATION.micro / 1000 : SENT_SETTLED) : 0,
            duration: still ? 0 : DURATION.ui / 1000,
            ease: EASE_POINTS.settle,
          },
        }}
      >
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          noValidate
          inert={sent}
          aria-label="Send a message"
          aria-busy={pending}
          className="grid gap-6"
        >
          <div className="grid gap-6 @md:grid-cols-2">
            <div className="grid content-start gap-2">
              <label htmlFor={`${id}-name`} className="text-small font-medium">
                Name
              </label>
              <input
                ref={nameRef}
                id={`${id}-name`}
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={limits.nameMax}
                defaultValue={values.name}
                readOnly={pending}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy(errors.name && `${id}-name-error`)}
                className={field}
              />
              {errors.name && <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>}
            </div>

            <div className="grid content-start gap-2">
              <label htmlFor={`${id}-email`} className="text-small font-medium">
                Email
              </label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={limits.emailMax}
                defaultValue={values.email}
                readOnly={pending}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy(errors.email && `${id}-email-error`)}
                className={field}
              />
              {errors.email && <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>}
            </div>
          </div>

          <fieldset
            role="radiogroup"
            aria-labelledby={`${id}-topic-legend`}
            className="grid min-w-0 gap-2"
            aria-invalid={errors.topic ? true : undefined}
            aria-describedby={describedBy(errors.topic && `${id}-topic-error`)}
          >
            <legend id={`${id}-topic-legend`} className="mb-2 text-small font-medium">What&apos;s it about?</legend>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <label
                  key={topic}
                  className={cn(
                    chipClass,
                    "relative cursor-pointer select-none pointer-coarse:h-11",
                    "has-checked:border-ink has-checked:bg-ink has-checked:text-paper",
                    "has-focus-visible:outline-[1.5px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-cinnabar",
                  )}
                >
                  <input
                    type="radio"
                    name="topic"
                    value={topic}
                    defaultChecked={topic === checkedTopic}
                    aria-disabled={pending || undefined}
                    // A radio can't be read-only, so while sending, a click is refused instead.
                    onClick={(event) => {
                      if (pending) event.preventDefault();
                    }}
                    className="sr-only"
                  />
                  {topic}
                </label>
              ))}
            </div>
            {errors.topic && <FieldError id={`${id}-topic-error`}>{errors.topic}</FieldError>}
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor={`${id}-message`} className="text-small font-medium">
              Message
            </label>
            <textarea
              ref={messageRef}
              id={`${id}-message`}
              name="message"
              rows={6}
              required
              defaultValue={values.message}
              readOnly={pending}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy(errors.message && `${id}-message-error`, `${id}-message-count`)}
              onChange={(event) => setTyped({ since: state, length: event.currentTarget.value.length })}
              onKeyDown={(event) => {
                // Ctrl or Cmd with Enter sends, since Enter alone starts a new line.
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className={cn(field, "block min-h-32 resize-y")}
            />
            <div className="flex items-start justify-between gap-6">
              {errors.message ? <FieldError id={`${id}-message-error`}>{errors.message}</FieldError> : <span />}
              <p
                id={`${id}-message-count`}
                className={cn(
                  // Nudged down to share a baseline with the error beside it, which is set a size larger.
                  "tnum mt-0.5 flex shrink-0 gap-2 text-tiny transition-colors duration-[160ms] ease-settle",
                  nearLimit ? "font-medium text-ink" : "text-ink-soft",
                )}
              >
                {over > 0 && <span className="mt-[0.4em] size-1.5 shrink-0 bg-cinnabar" aria-hidden="true" />}
                {countText}
              </p>
            </div>
          </div>

          {/* Decoy for scripts. Hidden from sight, from the tab order and from assistive technology. */}
          <div className="sr-only" aria-hidden="true" inert>
            <label htmlFor={`${id}-${honeypot}`}>Leave this field empty</label>
            <input id={`${id}-${honeypot}`} name={honeypot} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <div className="grid gap-4">
            {state.message && (
              <p id={`${id}-problem`} className="flex gap-2.5 text-small font-medium">
                <span className="mt-[0.5em] size-1.5 shrink-0 bg-cinnabar" aria-hidden="true" />
                {state.message}
              </p>
            )}
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                aria-disabled={pending || undefined}
                aria-describedby={describedBy(state.message !== null && `${id}-problem`)}
                className="min-w-36 aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {pending ? "Sending" : "Send message"}
              </Button>
              {/* The seal waits here, inks up while the message is on its way, and stamps it once it has gone. */}
              <Seal
                size={32}
                className={cn("transition-opacity duration-[320ms] ease-settle", pending ? "opacity-80" : "opacity-30")}
              />
            </div>
            <ReplyEstimate className="text-small text-ink-soft" />
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {sent && (
          <SentNote
            key="sent"
            from={foldFrom}
            name={state.values.name}
            email={state.values.email}
            onSendAnother={sendAnother}
          />
        )}
      </AnimatePresence>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
