import type { Metadata } from "next";
import { notFound } from "next/navigation";

// /preview/<chapter> shows one home-page chapter on its own, for checking work
// in development. These routes do not exist on the live site.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: LayoutProps<"/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
