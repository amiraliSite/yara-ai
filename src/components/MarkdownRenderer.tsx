import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeText = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div dir="ltr" className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3.5 py-2 text-xs text-slate-400">
        <span className="font-mono">{match ? match[1] : "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "کپی شد" : "کپی"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed font-mono">
        <code>{codeText}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose-container space-y-2.5 text-[15px] leading-[1.75] text-slate-800 dark:text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-[1.75]">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-bold text-slate-900 dark:text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base font-bold text-slate-900 dark:text-white">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-[15px] font-semibold text-slate-900 dark:text-white">{children}</h3>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1.5 pr-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1.5 pr-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-700 underline decoration-teal-500/40 underline-offset-4 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-right text-sm tabular-nums">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800/70 dark:text-slate-300">
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className) || String(children).includes("\n");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                dir="ltr"
                className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-teal-800 dark:bg-slate-800 dark:text-teal-300"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
