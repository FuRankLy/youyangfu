const HAN_RUN = /([㐀-鿿]+)/;

/** Sets any Chinese inside a sentence in the Kai face, marked up as Chinese. */
export function withHan(text: string) {
  return text.split(HAN_RUN).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="han" lang="zh-Hans">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
