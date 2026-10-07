// Contract between the import (writes src/data/redirects.json) and the
// middleware + URL checker (read it). Paths are absolute, no host, no trailing slash.
export type Redirect =
  | { from: string; to: string; status: 301 }
  | { from: string; status: 410 }

export type RedirectTable = Redirect[]
