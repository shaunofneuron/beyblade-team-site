# Zen Blitz — Youth Beyblade Team Event Site

Static HTML/CSS site (no server code, database, or build step) for the Zen Blitz youth Beyblade X event: event details, roster, parent registration placeholder, rules summary, team cards, and official links.

**Event:** November 7th and 8th (evening or midday). **Location:** Shaun’s two-acre backyard. The site itself is the public message; no organizer phone or email is published here.

## Enable GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under “Build and deployment”, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.

`.nojekyll` is included so Pages serves files as-is.

Live URL (once Pages is on): https://shaunofneuron.github.io/beyblade-team-site/

## Registration (hard constraint)

Parent registration posts to a Google Apps Script web app (sheet-backed).

**Do not commit** form IDs, field names, embed URLs, share links, or other form-related identifiers to this public repo. Keep those in a gitignored config, an environment secret, or another Pages-safe injection path that never lands in source. Wire the web app `/exec` URL via gitignored `assets/form-config.js` (see `assets/form-config.example.js`) or CI secret injection — never commit the URL. Public roster shows nicknames only.

There is no Formspree or other third-party form endpoint in this repo.

## Privacy rule

Never post kids’ full names, emails, or addresses on the site. Roster and team pages use nicknames or first initials only. Registration emails and parent names stay in the private sheet; only player nicknames appear on the roster.
