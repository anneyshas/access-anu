# AccessANU

Pathfindable indoor map of ANU campus buildings — QR-code location detection, room-to-room navigation, and an accessibility mode that routes around stairs.

Built by GDG on Campus ANU.

## Stack
- **Client:** React (Vite) + Mapbox GL JS
- **Server:** Node.js + Express + MongoDB (Mongoose)

## Structure
```
access-anu/
├── client/    # React + Mapbox frontend
└── server/    # Express + MongoDB API
```

## Getting started

### Server
```
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI
npm run dev
```

### Client
```
cd client
npm install
cp .env.example .env   # fill in VITE_MAPBOX_TOKEN, VITE_API_BASE_URL
npm run dev
```

## Data model
- **Node** — a room, corridor, stair, lift, WC, or service point on a floor
- **Edge** — a connection between two nodes (door, passage, stairs, lift), flagged `accessible` or not

Accessibility Mode filters edges to exclude non-accessible connections (e.g. stairs), so routing only returns stair-free paths.
