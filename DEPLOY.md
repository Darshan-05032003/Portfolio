# Deploy

## 1. Cloudflare Pages (done)
- Project **darshan-portfolio**, connected to this repo, no build command, output directory `docs`.
- Live at https://darshan-portfolio-6vo.pages.dev. Every push to `main` redeploys.

## 2. Free subdomain darshan-sonawane.is-a.dev
- `darshan` is already taken on is-a.dev, so the request is for `darshan-sonawane`.
- File `domains/darshan-sonawane.json` in the fork Darshan-05032003/register has the contents of `deploy/is-a-dev-darshan-sonawane.json`.
- Pull request to `is-a-dev/register`; a maintainer merges it, usually within a day or two.
- After the merge: Cloudflare → Pages project → **Custom domains** → Set up a custom domain → `darshan-sonawane.is-a.dev`. It goes live once DNS resolves.

## 3. Mirror
GitHub Pages serves the same `docs/` at https://darshan-05032003.github.io/Portfolio/.
