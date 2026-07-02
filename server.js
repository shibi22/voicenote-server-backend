import express from "express";
import cors from "cors";
import "dotenv/config";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./mcp.js";
import { initDb, createNote, listNotes, searchNotes, deleteNote } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------
// REST API — used by the PWA
// ---------------------------------------------------------------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/notes", async (req, res) => {
  try {
    const notes = await listNotes(Number(req.query.limit) || 50);
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/notes/search", async (req, res) => {
  try {
    const notes = await searchNotes(req.query.q || "", Number(req.query.limit) || 20);
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notes", async (req, res) => {
  try {
    const text = (req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const note = await createNote(text);
    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/notes/:id", async (req, res) => {
  try {
    const deleted = await deleteNote(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// MCP endpoint — used by Claude Desktop / Claude.ai custom connectors
//
// Stateless mode: a fresh McpServer + transport is created per request.
// This keeps the deployment simple (no in-memory session store to worry
// about, which matters on free hosts that can spin instances down) at the
// cost of not supporting server-initiated streaming between requests —
// fine for a tools-only server like this one.
// ---------------------------------------------------------------------
app.post("/mcp", async (req, res) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode does not support GET (server->client streams) or DELETE
// (session termination) — respond clearly rather than hanging.
app.get("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed — this server runs in stateless MCP mode." });
});
app.delete("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed — this server runs in stateless MCP mode." });
});

// ---------------------------------------------------------------------
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`voicenote server listening on port ${PORT}`);
      console.log(`  REST:  http://localhost:${PORT}/api/notes`);
      console.log(`  MCP:   http://localhost:${PORT}/mcp`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
