// Chinese characters, with the CJK compatibility block.
const HAN = /([㐀-鿿豈-﫿]+)/;

/**
 * Sets any Chinese in a string of copy in the Kai face and marks its language,
 * so content files can hold plain strings in both scripts.
 */
export function HanText({ children }: { children: string }) {
  const parts = children.split(HAN);
  if (parts.length === 1) return children;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="han" lang="zh-Hans">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
