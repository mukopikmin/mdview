import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

export type MarkdownPreviewProps = {
  markdown: string;
};

const trimFinalNewline = (value: string): string => value.replace(/\n$/, "");

const components: Components = {
  code({ children, className, ...props }) {
    const language = className?.match(/\blanguage-([^\s]+)/)?.[1];
    if (language === "mermaid") {
      return (
        <pre className="mermaid">
          {trimFinalNewline(String(children))}
        </pre>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export const MarkdownPreview = ({ markdown }: MarkdownPreviewProps) => (
  <ReactMarkdown
    components={components}
    rehypePlugins={[
      rehypeSlug,
      [rehypeAutolinkHeadings, {
        behavior: "wrap",
        properties: { className: "heading-anchor" },
      }],
      rehypeHighlight,
    ]}
    remarkPlugins={[remarkGfm]}
  >
    {markdown}
  </ReactMarkdown>
);
