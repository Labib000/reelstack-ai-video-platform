# ReelStack

A video streaming platform with adaptive HLS playback, JWT auth with refresh-token rotation, and **Ask the Video**: ask questions about a video and get answers that link to the exact timestamp.

## Stack
- **Client:** React + TypeScript + Vite + Tailwind CSS
- **Server:** Node.js + Express 5 + TypeScript + MongoDB + Redis (BullMQ + FFmpeg worker planned)
- **Shared:** zod schemas and types used by both client and server

## Layout
```
shared/   zod schemas + TS types (API contracts)
server/   Express API
client/   React + Vite + Tailwind
```

## Getting started
```bash
npm install
cp .env.example .env    # then set JWT_ACCESS_SECRET
npm run infra:up        # mongo, redis, minio (Docker)
npm run dev             # client http://localhost:5173, API http://localhost:4000
curl localhost:4000/api/health
npm test
```

## Git hooks
The repo ships hooks in `.githooks/`. Enable them once after cloning:
```bash
git config core.hooksPath .githooks
```
