# Deploying

The site is static: `docs/` is the whole build. Two hosts serve it; one custom domain points at Cloudflare.

## 1. Cloudflare Pages (free, unlimited bandwidth) — one-time, ~3 minutes
1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → **Connect to Git** → pick `Darshan-05032003/Portfolio`.
2. Project name: **darshan-portfolio** (this gives `darshan-portfolio.pages.dev`; if the name is taken, pick another and update the CNAME in step 2 below).
3. Build settings: Framework preset **None**, build command **empty**, build output directory **docs**. (`wrangler.toml` already says this.) Save and Deploy.
4. Every push to `main` redeploys automatically. No GitHub Actions involved.

## 2. Free subdomain darshan.is-a.dev — one pull request
1. Fork https://github.com/is-a-dev/register on GitHub.
2. In your fork add the file `domains/darshan.json` with the contents of `deploy/is-a-dev-darshan.json` (CNAME must match your `*.pages.dev` name).
3. Open a pull request to `is-a-dev/register`. Their bot checks the JSON; a maintainer merges, usually within a day. If `darshan` is already taken, the bot says so: use `darshan-sonawane.json` → `darshan-sonawane.is-a.dev`.
4. After the merge: Cloudflare → your Pages project → **Custom domains** → Set up a custom domain → `darshan.is-a.dev`. It activates once the DNS record resolves (minutes to an hour).

## 3. GitHub Pages (already live, stays as a mirror)
Settings → Pages → `main` / `docs`. URL: https://darshan-05032003.github.io/Portfolio/

## Real car model
Put a Creative-Commons `.glb` at `model/car.glb` (and its license text at `model/LICENSE.txt`), run `npm run build`, commit. The page loads it automatically; without it the code-built car is used.
