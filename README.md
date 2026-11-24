# ReelStack

A video streaming platform with adaptive HLS playback, JWT auth with refresh-token rotation, and **Ask the Video**: ask questions about a video and get answers that link to the exact timestamp.

See [PLAN.md](PLAN.md) for the full roadmap.

## Stack
- **Client:** React + TypeScript + Vite + Tailwind CSS
- **Server (planned):** Node.js + Express + MongoDB + Redis + BullMQ + FFmpeg

## Getting started
```bash
npm install
npm run dev        # http://localhost:5173
```

## Git hooks
The repo ships hooks in `.githooks/`. Enable them once after cloning:
```bash
git config core.hooksPath .githooks
```
