import { Chapter } from "@/components/ui/Chapter";
import { contactTopics } from "@/content/site";
import { CONTACT_LIMITS, DEFAULT_TOPIC, HONEYPOT_FIELD } from "@/lib/contact";
import { ConnectLinks } from "./connect/ConnectLinks";
import { ContactForm } from "./connect/ContactForm";

/**
 * Let's connect: links on the left, a working contact form on the right.
 * The form's limits and topics are handed down from here, so the client
 * bundle never imports the validation schema (see src/lib/contact.ts).
 */
export function Connect() {
  return (
    <Chapter id="connect">
      <div className="grid-12 gap-y-14">
        <div data-assemble="left" className="col-span-12 md:col-span-4">
          <ConnectLinks />
        </div>
        <div data-assemble="right" className="col-span-12 md:col-span-7 md:col-start-6 lg:col-span-6 lg:col-start-7">
          <ContactForm
            topics={contactTopics}
            defaultTopic={DEFAULT_TOPIC}
            limits={CONTACT_LIMITS}
            honeypot={HONEYPOT_FIELD}
          />
        </div>
      </div>
    </Chapter>
  );
}
