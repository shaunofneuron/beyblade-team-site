# Youth Beyblade Team Event Site

A static HTML/CSS site (no server code, database or build step) for a youth Beyblade X team event: event details, roster, parent registration, rules summary, team cards and official links.

## Enable GitHub Pages
1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.

`.nojekyll` is included so Pages serves files as-is.

## Set the Formspree form ID
1. Create a form at https://formspree.io and copy its ID (the part after `/f/`).
2. In `register.html`, replace `YOUR_FORM_ID` in `action="https://formspree.io/f/YOUR_FORM_ID"`.

## Privacy rule
Never post kids' full names, emails or addresses on the site. Roster and team pages use nicknames or first initials only. Registration details go privately to the organizer by email via Formspree and are never published.
