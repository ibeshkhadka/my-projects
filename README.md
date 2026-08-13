# My Projects — Project Archive

A living archive of everything I've built. Every repo, every live link, in one place — so I never forget a project again.

**Live site:** https://ibeshkhadka.github.io/my-projects/

## How it works

- `index.html` + `css/style.css` + `js/main.js` — a plain static site, no frameworks, no build step.
- The page fetches my repos **live from the GitHub API**, so any new repo I push appears automatically.
- `projects.json` is the curated layer: it maps each repo to its **live URL**, a human description, and tags (GitHub doesn't know about Vercel links, etc.).

## Adding a new project

Just push a repo to GitHub — it shows up automatically. To give it a live link, description, and tags, add an entry to `projects.json`:

```json
"my-new-project": {
  "liveUrl": "https://my-new-project.vercel.app",
  "description": "What it does.",
  "tags": ["web", "tool"]
}
```

## Local dev

```bash
python3 -m http.server 8000
# open http://localhost:8000
```