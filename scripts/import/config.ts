// Crawl lives outside the repo (private, untrusted input). Override with IEOR_CRAWL_DIR.
export const CRAWL_DIR =
  process.env.IEOR_CRAWL_DIR ||
  '/Users/harshitsinghbhandari/Downloads/side-quests/ieor-golden-jubilee/internal/research/ieor-crawl'
