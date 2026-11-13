import { z } from "zod";
import { contactTopics, type ContactTopic } from "@/content/site";

// What the contact form and its server action agree on: field names, limits,
// the shape of the state passed between them, and the validation schema.
//
// Client components import only the types from this file. The few values they
// need (limits, the default topic, the decoy field's name) reach them as props
// from the server component, which keeps zod out of the browser bundle.

export const CONTACT_LIMITS = {
  nameMax: 80,
  emailMax: 254,
  messageMin: 10,
  messageMax: 4000,
} as const;
export type ContactLimits = typeof CONTACT_LIMITS;

export const DEFAULT_TOPIC: ContactTopic = "Just saying hi";

/**
 * The decoy field. It is hidden from people and from assistive technology, so
 * only a script that fills in every input will ever put something in it.
 */
export const HONEYPOT_FIELD = "subject";

/** In the order they appear in the form, which is also the order focus looks for the first error. */
export const CONTACT_FIELDS = ["name", "email", "topic", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactValues = Record<ContactField, string>;
export type ContactErrors = Partial<Record<ContactField, string>>;

export type ContactState = {
  /** idle: nothing sent yet. invalid: a field needs fixing. failed: valid, but it didn't go out. sent: delivered. */
  status: "idle" | "invalid" | "failed" | "sent";
  /** What the visitor entered, echoed back so the form can refill itself after React resets it. */
  values: ContactValues;
  /** One message per field that needs fixing. */
  errors: ContactErrors;
  /** What went wrong and what to do about it, for the line above the Send button. */
  message: string | null;
};

const count = new Intl.NumberFormat("en-NZ");

/** Everything the server says back to the visitor. Plain, specific, and never includes server details. */
export const contactMessages = {
  nameMissing: "Add your name.",
  nameTooLong: `Shorten your name to ${CONTACT_LIMITS.nameMax} characters or fewer.`,
  emailMissing: "Add your email address so I can reply.",
  emailInvalid: "Check the email address. It should look like name@example.com.",
  topicMissing: "Pick one of the topics.",
  messageMissing: "Write a message.",
  messageTooShort: `Write a little more. A message needs at least ${CONTACT_LIMITS.messageMin} characters.`,
  messageTooLong: `Shorten your message to ${count.format(CONTACT_LIMITS.messageMax)} characters or fewer.`,
  invalid: (fields: number) =>
    fields === 1 ? "Not sent yet. One field above needs fixing." : `Not sent yet. ${fields} fields above need fixing.`,
  rateLimited: (limit: number, windowMinutes: number, waitMinutes: number) =>
    `Not sent. You've reached the limit of ${limit} messages in ${windowMinutes} minutes. ` +
    `Your message is still in the form, so try again in ${waitMinutes === 1 ? "a minute" : `${waitMinutes} minutes`}.`,
  notConfigured:
    "Not sent. This form isn't set up to deliver messages yet. Your message is still in the form, so try again another day.",
  sendFailed: "Sending failed, so nothing went out. Your message is still in the form. Try again in a minute.",
} as const;

export const contactSchema = z.object({
  name: z.string().min(1, contactMessages.nameMissing).max(CONTACT_LIMITS.nameMax, contactMessages.nameTooLong),
  email: z
    .string()
    .min(1, contactMessages.emailMissing)
    .max(CONTACT_LIMITS.emailMax, contactMessages.emailInvalid)
    .pipe(z.email(contactMessages.emailInvalid)),
  topic: z.enum(contactTopics, contactMessages.topicMissing),
  message: z
    .string()
    .min(1, contactMessages.messageMissing)
    .min(CONTACT_LIMITS.messageMin, contactMessages.messageTooShort)
    .max(CONTACT_LIMITS.messageMax, contactMessages.messageTooLong),
});

/** A message that passed validation. */
export type ContactMessage = z.output<typeof contactSchema>;
