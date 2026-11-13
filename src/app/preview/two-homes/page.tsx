import type { Metadata } from "next";
import { TwoHomes } from "@/components/chapters/TwoHomes";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: TwoHomes", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <TwoHomes />
    </div>
  );
}
