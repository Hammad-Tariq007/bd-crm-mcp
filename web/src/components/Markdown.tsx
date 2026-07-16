import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Tailwind-styled element mappings that reproduce the previous renderer's look
// (compact tables, subtle code chips, tight spacing).
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mt-3 mb-1 text-[1.3em] font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1 text-[1.18em] font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 text-[1.05em] font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) return <code className={className}>{children}</code>;
    return <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[0.88em]">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-[10px] bg-surface2 px-3.5 py-3 font-mono text-[0.86em]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-surface2 px-3.5 py-2.5 text-left font-semibold whitespace-nowrap text-fg">
      {children}
    </th>
  ),
  tr: ({ children }) => <tr className="border-t border-border first:border-t-0 hover:bg-hover">{children}</tr>,
  td: ({ children }) => (
    <td className="px-3.5 py-2.5 text-left whitespace-nowrap text-fg2">{children}</td>
  ),
};

/** Renders assistant markdown (GFM tables, bold, code, lists). */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
