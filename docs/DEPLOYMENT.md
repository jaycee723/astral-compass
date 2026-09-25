# Deployment Guide

Astral Compass requires a Node.js host because the server protects your Groq API key and proxies the horoscope API. Static-only hosting (GitHub Pages, Netlify static, plain shared hosting) will **not** work.

## Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com) — the free tier is generous
- Your copy of this repository

---

## Option 1 — Render (Recommended free tier)

1. Push this repo to GitHub.
2. Create an account at [render.com](https://render.com).
3. **New → Web Service** → connect your GitHub account → select this repo.
4. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variable: `GROQ_API_KEY=<your key>`
6. Click **Deploy**.
7. Render gives you a free `*.onrender.com` subdomain.

---

## Option 2 — Railway

1. Sign in at [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub repo** → select this repo.
3. In **Variables** tab add `GROQ_API_KEY`.
4. Railway auto-detects Node and starts `npm start`.
5. Click **Generate Domain** for a public URL.

---

## Option 3 — VPS / Ubuntu

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
git clone https://github.com/jaycee723/astral-compass.git
cd astral-compass
npm install
cp .env.example .env
nano .env           # add GROQ_API_KEY=your_key_here
npm install -g pm2
pm2 start server.js --name astral-compass
pm2 save && pm2 startup
```

Then put Caddy or Nginx in front for HTTPS.

---

## Custom Domain

On Render or Railway:
1. Project settings → **Custom Domain** → enter e.g. `oracle.yourdomain.com`
2. Add the CNAME they show to your DNS registrar.
3. HTTPS is provisioned automatically.

---

## Security Notes

- **Never commit `.env`** — it is in `.gitignore`.
- The Groq API key is only ever used server-side.
- Rotate your key before going public.
- Add a privacy policy if collecting user data beyond the browser session.
