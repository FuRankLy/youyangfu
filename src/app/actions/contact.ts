"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";
import { site } from "@/content/site";
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  HONEYPOT_FIELD,
  contactMessages,
  contactSchema,
  type ContactErrors,
  type ContactState,
  type ContactValues,
} from "@/lib/contact";

// The contact form's server action. Nothing returned from here may contain the
// destination address, the API key or a raw error: the return value is sent to
// the browser, and in development so is anything logged while the action runs.

// Rate limit: 3 messages per 10 minutes per IP address.
// The record lives in this server instance's memory, so each serverless
// instance keeps its own count and a cold start clears it. That is enough to
// stop one visitor or one script flooding the inbox. If spam appears, move the
// record to a shared store (Upstash Redis or Vercel KV) with the same key.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const sentAt = new Map<string, number[]>();

/** Takes one of the caller's slots in the current window, or says how long until one frees up. */
function takeSlot(key: string, now: number) {
  // Drop everything older than the window, so the map can't grow without bound.
  for (const [who, times] of sentAt) {
    const recent = times.filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length > 0) sentAt.set(who, recent);
    else sentAt.delete(who);
  }
  const times = sentAt.get(key) ?? [];
  if (times.length >= RATE_LIMIT) return { ok: false as const, waitMs: times[0] + RATE_WINDOW_MS - now };
  sentAt.set(key, [...times, now]);
  return { ok: true as const };
}

/** Gives a slot back when nothing went out, so a failed send doesn't count against the visitor. */
function returnSlot(key: string, takenAt: number) {
  const times = sentAt.get(key);
  if (!times) return;
  const index = times.indexOf(takenAt);
  if (index >= 0) times.splice(index, 1);
  if (times.length === 0) sentAt.delete(key);
}

/**
 * The visitor's address as the hosting platform reports it. On Vercel the
 * first entry of x-forwarded-for is set by the platform and can't be forged.
 */
async function callerKey() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * The submitted fields, tidied: whitespace trimmed, a name kept to one line,
 * and line breaks counted as one character (browsers submit them as two).
 * Each is capped well above its limit so an oversized post isn't echoed back whole.
 */
function readValues(formData: FormData): ContactValues {
  return {
    name: read(formData, "name").replace(/\s+/g, " ").trim().slice(0, CONTACT_LIMITS.nameMax * 2),
    email: read(formData, "email").trim().slice(0, CONTACT_LIMITS.emailMax * 2),
    topic: read(formData, "topic").trim().slice(0, 80),
    message: read(formData, "message").replace(/\r\n?/g, "\n").trim().slice(0, CONTACT_LIMITS.messageMax * 2),
  };
}

const sent = (values: ContactValues): ContactState => ({
  status: "sent",
  // The confirmation greets the visitor by name; the message itself isn't needed again.
  values: { ...values, message: "" },
  errors: {},
  message: null,
});

const failed = (values: ContactValues, message: string): ContactState => ({
  status: "failed",
  values,
  errors: {},
  message,
});

export async function sendMessage(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const values = readValues(formData);

  // A filled decoy field means a script. Answer as if it worked and send nothing.
  if (read(formData, HONEYPOT_FIELD).trim() !== "") return sent(values);

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    const errors: ContactErrors = {};
    for (const field of CONTACT_FIELDS) {
      const first = fieldErrors[field]?.[0];
      if (first) errors[field] = first;
    }
    return { status: "invalid", values, errors, message: contactMessages.invalid(Object.keys(errors).length) };
  }
  const message = parsed.data;

  const caller = await callerKey();
  const now = Date.now();
  const slot = takeSlot(caller, now);
  if (!slot.ok) {
    const waitMinutes = Math.max(1, Math.ceil(slot.waitMs / 60_000));
    return failed(values, contactMessages.rateLimited(RATE_LIMIT, RATE_WINDOW_MS / 60_000, waitMinutes));
  }

  const subject = `[${site.domain}] ${message.topic}: ${message.name}`;
  const text = [
    message.message,
    "",
    "--",
    `${message.name} <${message.email}>`,
    `Topic: ${message.topic}`,
    `Sent from the contact form on ${site.domain}. Reply to this email to answer ${message.name}.`,
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  // Until the domain is verified in Resend, its shared test sender is the only one allowed.
  const from = process.env.CONTACT_FROM_EMAIL || `${site.domain} <onboarding@resend.dev>`;

  if (!apiKey || !to) {
    if (process.env.NODE_ENV === "production") {
      console.error("[contact] RESEND_API_KEY or CONTACT_TO_EMAIL is not set, so a message could not be delivered.");
      returnSlot(caller, now);
      return failed(values, contactMessages.notConfigured);
    }
    // Development without credentials: show the message here so the whole flow can be tried.
    console.log(
      [
        "[contact] Email is not set up (RESEND_API_KEY or CONTACT_TO_EMAIL is missing), so nothing was sent.",
        "[contact] The message would have been:",
        `  Subject: ${subject}`,
        `  Reply-To: ${message.email}`,
        ...text.split("\n").map((line) => `  | ${line}`),
      ].join("\n"),
    );
    return sent(values);
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, replyTo: message.email, subject, text });
    if (error) {
      // The error's own text can quote the destination address, so only its code is logged.
      console.error("[contact] Resend refused the message:", error.name, error.statusCode ?? "");
      returnSlot(caller, now);
      return failed(values, contactMessages.sendFailed);
    }
  } catch (cause) {
    console.error("[contact] Sending threw:", cause instanceof Error ? cause.name : typeof cause);
    returnSlot(caller, now);
    return failed(values, contactMessages.sendFailed);
  }

  return sent(values);
}
