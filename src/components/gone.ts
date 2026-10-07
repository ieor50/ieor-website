// Body for 410 responses. The middleware returns it as a plain string
// (`new Response(GONE_HTML, { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } })`),
// so it is self-contained HTML with inline styles in the site palette.
export const GONE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Page removed · IEOR @ IIT Bombay</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<style>
body{margin:0;background:#f7f8f6;color:#0d2436;font:16px/1.65 system-ui,sans-serif}
header{background:#0a314e;color:#fff;padding:20px 24px}
header a{color:#fff;font-weight:800;text-decoration:none}
main{max-width:720px;margin:0 auto;padding:80px 24px}
.eyebrow{color:#075c9d;text-transform:uppercase;letter-spacing:.14em;font-size:.77rem;font-weight:800}
h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.15;margin:.4em 0}
a{color:#075c9d}
a:focus-visible{outline:3px solid #c89334;outline-offset:2px}
</style>
</head>
<body>
<header><a href="/">IEOR · IIT Bombay</a></header>
<main>
<div class="eyebrow">Error 410</div>
<h1>This page has been removed</h1>
<p>The content that used to be here is no longer published on the IEOR website.</p>
<p><a href="/">Go to the home page</a> or write to <a href="mailto:office.ieor@iitb.ac.in">office.ieor@iitb.ac.in</a>.</p>
</main>
</body>
</html>`
