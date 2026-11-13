import type { Metadata } from "next";
import { OffTheClock } from "@/components/chapters/OffTheClock";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: OffTheClock", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <OffTheClock />
    </div>
  );
}
