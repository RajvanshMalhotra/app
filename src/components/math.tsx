import katex from "katex";

/** Renders text where `$...$` segments are inline math. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith("$") && p.endsWith("$") ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }) }} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
