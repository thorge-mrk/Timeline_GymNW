import { parseRichText, type InlineSpan } from "@/lib/richText";

/**
 * Stellt einen Eintragstext dar. Gebaut aus React-Elementen — niemals aus
 * rohem HTML, damit sich nichts einschleusen lässt.
 */
function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === "bold") {
          return (
            <strong key={i} className="font-bold text-coal">
              {span.text}
            </strong>
          );
        }
        if (span.kind === "italic") {
          return (
            <em key={i} className="italic">
              {span.text}
            </em>
          );
        }
        return <span key={i}>{span.text}</span>;
      })}
    </>
  );
}

export default function RichText({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const blocks = parseRichText(text);
  if (!blocks.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h3
              key={i}
              className="pt-1 text-[17px] leading-snug font-bold text-coal"
            >
              <Spans spans={block.spans} />
            </h3>
          );
        }
        if (block.type === "h3") {
          return (
            <h4
              key={i}
              className="pt-0.5 text-[15px] leading-snug font-semibold text-coal"
            >
              <Spans spans={block.spans} />
            </h4>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-fox"
                  />
                  <span>
                    <Spans spans={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[15px] leading-relaxed">
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
