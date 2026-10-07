import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

// Bodies are GFM with inline HTML left over from Drupal. rehype-raw parses the
// HTML, then sanitize strips anything unsafe. The default schema already allows
// colSpan/rowSpan on every element; we only add tel: links.
export const sanitizeSchema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), 'tel'] },
}

export function Markdown({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          table: ({ node: _node, ...props }) => (
            <div className="table-scroll">
              <table {...props} />
            </div>
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ node: _node, alt, ...props }) => <img alt={alt ?? ''} loading="lazy" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
