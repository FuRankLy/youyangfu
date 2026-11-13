import type { Metadata } from "next";
import { Chart } from "@/components/chapters/Chart";

// Development preview of one chapter on its own. Removed before launch.
export const metadata: Metadata = { title: "Preview: Chart", robots: { index: false } };

export default function Page() {
  return (
    <div className="pt-[var(--header-h)]">
      <Chart />
    </div>
  );
}
