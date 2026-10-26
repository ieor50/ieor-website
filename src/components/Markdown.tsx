import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

// Bodies are GFM with inline HTML left over from Drupal. rehype-raw parses the
// HTML, then sanitize strips anything unsafe. The default schema already allows
// colSpan/rowSpan on every element; we add tel: links and iframes (src/title only).
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe'],
  attributes: { ...defaultSchema.attributes, iframe: ['src', 'title'] },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'tel'],
    src: ['http', 'https'],
  },
}

// Embeds the old site used. Anything else renders as a plain link.
const EMBED_HOSTS = new Set([
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'calendar.google.com',
  'docs.google.com',
  'www.google.com',
])
const mediaHost = process.env.MEDIA_BASE_URL ? new URL(process.env.MEDIA_BASE_URL).host : ''

const embedHost = (src?: string) => {
  try {
    const u = new URL(src ?? '')
    return u.protocol === 'https:' && (EMBED_HOSTS.has(u.host) || u.host === mediaHost) ? u.host : undefined
  } catch {
    return undefined
  }
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
          iframe: ({ src, title }) => {
            const host = embedHost(src)
            if (!host) return src && /^https?:/.test(src) ? <a href={src}>Embedded content</a> : null
            const video = /youtube|vimeo/.test(host)
            return (
              <iframe
                className={video ? 'embed embed-video' : 'embed'}
                src={src}
                title={title || (video ? 'Video' : 'Embedded content')}
                loading="lazy"
                allowFullScreen
                allow="encrypted-media; picture-in-picture; fullscreen"
              />
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
