import type { Metadata } from "next";
import { Work } from "@/components/chapters/Work";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: Work", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <Work />
    </div>
  );
}
