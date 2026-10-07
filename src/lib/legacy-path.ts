// Normalize an incoming request path to the form redirects.json uses:
// no /index.php prefix, %2E decoded to '.', no trailing slash (except root).
export function normalizePath(pathname: string) {
  let p = pathname.replace(/%2e/gi, '.')
  p = p.replace(/^\/index\.php(?=\/|$)/i, '') || '/'
  if (p.length > 1) p = p.replace(/\/+$/, '') || '/'
  return p
}
