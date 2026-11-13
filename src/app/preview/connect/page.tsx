import type { Metadata } from "next";
import { Connect } from "@/components/chapters/Connect";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: Connect", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <Connect />
    </div>
  );
}
