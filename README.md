# Presence Labs Audit Generator

Local-first MVP for auditing small local businesses and generating Presence Labs sales offers.

## Setup

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Optional Claude generation (preferred):

```bash
# Add your key to .env; do not commit it
ANTHROPIC_API_KEY="your_key_here"
```

Optional Gemini fallback:

```bash
GEMINI_API_KEY="your_key_here"
```

If both API keys are empty, the app uses a deterministic local fallback generator.

## Commands

- `npm run dev` — local app
- `npm run build` — production build validation
- `npm run lint` — lint validation
- `npm run db:push` — create/update local SQLite DB
- `npm run db:studio` — inspect leads

## Safety

- Local SQLite only by default.
- No GitHub push.
- No deployment configured.
- Secrets stay in `.env`.
