# voicenote — server (step 2 of 2)

One Node.js/Express app, two faces on the same data:

- **REST API** (`/api/notes`) — used by the PWA to save/list/search notes
- **MCP endpoint** (`/mcp`) — used by Claude to call the same data as tools

Both read/write the same SQLite database (local file by default, or a free
hosted Turso database — see the top-level `DEPLOYMENT_GUIDE.md`).

## Endpoints

| Method | Path                  | Purpose                       |
|--------|-----------------------|--------------------------------|
| GET    | `/health`              | Liveness check                |
| GET    | `/api/notes`           | List notes (`?limit=`)        |
| GET    | `/api/notes/search`    | Search notes (`?q=&limit=`)   |
| POST   | `/api/notes`           | Create a note (`{ "text": "" }`) |
| DELETE | `/api/notes/:id`       | Delete a note                 |
| POST   | `/mcp`                 | MCP JSON-RPC endpoint         |

## MCP tools exposed

- `save_note(text)`
- `list_notes(limit?)`
- `search_notes(query, limit?)`
- `delete_note(id)`

These are defined in `mcp.js` using `@modelcontextprotocol/sdk`'s
`registerTool` API, backed by the same functions in `db.js` that the REST
routes use.

## Run locally

```bash
npm install
cp .env.example .env   # optional — blank env vars = local SQLite file
npm run dev
```

Server starts on `http://localhost:3000`. Test it:

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"text":"my first note"}'

curl http://localhost:3000/api/notes
```

## Why stateless MCP mode

`server.js` creates a fresh `McpServer` + `StreamableHTTPServerTransport`
per request (`sessionIdGenerator: undefined`). This is the simplest correct
way to run MCP over HTTP on a free host:

- No in-memory session store to lose when the process restarts (Render
  free tier spins your service down after inactivity)
- Every request is self-contained — safe if a platform load-balances
  across multiple instances

The trade-off: no server-initiated push between requests. For a small
tools-only server like this, you won't notice — every tool call is a
single request/response anyway.

## Full deployment steps (Turso + Render)

See `../DEPLOYMENT_GUIDE.md` in the project root.
