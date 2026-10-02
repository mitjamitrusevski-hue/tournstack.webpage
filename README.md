# TournStack website

A lightweight, static pre-launch website for TournStack. The repository root is the GitHub Pages publish directory; `CNAME` points to `tournstack.com`.

## Pages

- `index.html`: product overview, five key points, individual organizers and sports centers, Lisbon example, team and email contact.
- `vision.html`: source-grounded product vision, current status and next steps.

## Run locally

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`. No package installation, build step or JavaScript is required.

## Deployment

GitHub Pages is configured for the `main` branch, repository root. Push the website files to `main`. Keep the existing `CNAME` file intact. Verify the Pages deployment and both public URLs after publishing.

## Assets and styling

Original vector assets are in `assets/brand/`, with the supplied naming conventions preserved. All webpage images are SVG. The self-hosted Montserrat variable font is in `assets/fonts/` with its SIL Open Font License. CSS is in `assets/css/styles.css`.

The original transparent favicon is retained. Its `DeepSlateBG` derivative adds only a Deep Slate canvas for browser use.

Deep Slate (`#0F172A`) and Soft White (`#F8FAFC`) anchor the site. No pure black or pure white is defined. Blue controls and focus rings use the brand's accessible light and dark variants. The five-color gradient appears only as a decorative separator.

## Content maintenance

The app is clearly marked as in development. Avoid presenting planned leagues or additional sports as released features. Affordability is an aim; no pricing is confirmed. Padel and tennis are the initial focus.

Vision and founder copy is based on the supplied “WEB TournStack: Product Vision & Commercial Strategy” document. The Lisbon example describes one deployment on 28 September 2026; it does not establish validation across external organizers. The event link is `https://timelesspassion.fun/en/padel`.

All contact links use `info@tournstack.com`. There are no analytics, forms, tracking scripts or third-party runtime requests.

## Validation

Local checks passed for asset references, heading order, unique IDs, image alternative text, contact links, the event link, color definitions and text contrast. The existing `CNAME` is preserved. Desktop and mobile browser verification remains pending: the execution environment blocks the browser's required socket operations. The authored layouts include breakpoints for desktop, tablet and small screens, keyboard focus styles and reduced-motion preferences.
