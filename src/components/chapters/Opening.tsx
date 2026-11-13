import { OpeningStage } from "@/components/squares/OpeningStage";
import { site } from "@/content/site";

/** The opening: 付优扬 written in squares, becoming "Frank Fu", then the seal. */
export function Opening() {
  const { syllables, display, chinese } = site.name;
  return (
    <OpeningStage
      chars={syllables.map((s) => s.char)}
      pinyin={syllables.map((s) => ({ text: s.text, chao: s.chao }))}
      latin={display}
      chinese={chinese}
      intro={site.intro}
    />
  );
}
