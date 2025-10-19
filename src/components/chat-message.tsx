import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground"
        }`}
      >
        <div className="text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom renderers for beautiful styling
              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="my-3 ml-5 list-disc space-y-1.5 marker:text-current">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 ml-5 list-decimal space-y-1.5 marker:text-current">{children}</ol>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => (
                <code className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                  isUser ? "bg-primary-foreground/20" : "bg-muted"
                }`}>{children}</code>
              ),
              pre: ({ children }) => (
                <pre className={`my-3 overflow-x-auto rounded-md p-3 text-xs ${
                  isUser ? "bg-primary-foreground/10" : "bg-muted"
                }`}>{children}</pre>
              ),
              h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-bold first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h3>,
              blockquote: ({ children }) => (
                <blockquote className={`my-2 border-l-2 pl-3 italic ${
                  isUser ? "border-primary-foreground/30" : "border-muted-foreground/30"
                }`}>{children}</blockquote>
              ),
              a: ({ children, href }) => (
                <a href={href} className="underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
