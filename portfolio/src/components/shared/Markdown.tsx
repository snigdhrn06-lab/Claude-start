/**
 * Safe Markdown renderer for CMS content. Raw HTML is NOT rendered (react-markdown escapes it),
 * and link URLs are sanitised (javascript:, data: etc. are stripped).
 */
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ children, className }: { children: string; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <div className={cn("prose-site", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => defaultUrlTransform(url)}
        components={{
          a: ({ href, children: c }) => {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {c}
              </a>
            );
          },
          img: () => null, // images are managed through the media library, not inline markdown
          h1: ({ children: c }) => <h2>{c}</h2>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
