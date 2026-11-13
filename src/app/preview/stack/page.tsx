import type { Metadata } from "next";
import { Stack } from "@/components/chapters/Stack";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: Stack", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <Stack />
    </div>
  );
}
