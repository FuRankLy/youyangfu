import { Chart } from "@/components/chapters/Chart";
import { Connect } from "@/components/chapters/Connect";
import { OffTheClock } from "@/components/chapters/OffTheClock";
import { Opening } from "@/components/chapters/Opening";
import { Stack } from "@/components/chapters/Stack";
import { TwoHomes } from "@/components/chapters/TwoHomes";
import { Work } from "@/components/chapters/Work";
import { site } from "@/content/site";

// Tells search engines that Frank Fu, Youyang Fu and 付优扬 are the same person.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name.display,
  alternateName: [site.name.legal, site.name.chinese],
  url: site.url,
  description: site.description,
  homeLocation: { "@type": "City", name: "Auckland, New Zealand" },
  // Grew up in Hamilton, New Zealand, from 2016 to 2024.
  birthPlace: { "@type": "City", name: "Zhengzhou, China" },
  alumniOf: { "@type": "CollegeOrUniversity", name: site.education.institution },
  sameAs: [site.links.github, site.links.linkedin].filter(Boolean),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
      />
      <Opening />
      <TwoHomes />
      <Chart />
      <Work />
      <Stack />
      <OffTheClock />
      <Connect />
    </>
  );
}
