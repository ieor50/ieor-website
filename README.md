# IEOR IIT Bombay website export

This package contains the complete static website as published on 29 September 2026.

- `dist/` is the ready-to-host site (14 HTML pages and all local assets). Set it as the web root on a static host that serves directory `index.html` files.
- `build_pages.py` is the editable page generator. Run `python3 build_pages.py` from this directory to regenerate the HTML in `dist/`.
- `dist/assets/site.css` controls the visual design.

The website uses Google Fonts at runtime; it falls back to local sans-serif fonts if unavailable. The department photographs were obtained from the public IEOR IIT Bombay website. Confirm image reuse rights with the department before republishing elsewhere. Time-sensitive admissions and event links point to the existing department website.
