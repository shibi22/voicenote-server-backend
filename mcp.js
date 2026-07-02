import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNote, listNotes, searchNotes, deleteNote } from "./db.js";

// One McpServer instance is reused across requests (stateless HTTP transport
// creates a fresh transport per request, but the tool definitions/handlers
// themselves are stateless and safe to share).
export function buildMcpServer() {
  const server = new McpServer({ name: "voicenote-mcp", version: "1.0.0" });

  server.registerTool(
    "save_note",
    {
      title: "Save a voice note",
      description: "Save a new text note (e.g. a voice transcript) to the notebook.",
      inputSchema: { text: z.string().min(1).describe("The note content") },
    },
    async ({ text }) => {
      const note = await createNote(text);
      return {
        content: [{ type: "text", text: `Saved note #${note.id}: "${note.text}"` }],
      };
    }
  );

  server.registerTool(
    "list_notes",
    {
      title: "List voice notes",
      description: "List the most recent saved notes, newest first.",
      inputSchema: { limit: z.number().int().min(1).max(200).optional().describe("Max notes to return (default 50)") },
    },
    async ({ limit }) => {
      const notes = await listNotes(limit ?? 50);
      return {
        content: [{ type: "text", text: JSON.stringify(notes, null, 2) }],
      };
    }
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search voice notes",
      description: "Search saved notes for a keyword or phrase (case-insensitive substring match).",
      inputSchema: {
        query: z.string().min(1).describe("Text to search for"),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ query, limit }) => {
      const notes = await searchNotes(query, limit ?? 20);
      return {
        content: [{
          type: "text",
          text: notes.length
            ? JSON.stringify(notes, null, 2)
            : `No notes matched "${query}".`,
        }],
      };
    }
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete a voice note",
      description: "Delete a note by its id.",
      inputSchema: { id: z.number().int().describe("The note id to delete") },
    },
    async ({ id }) => {
      const deleted = await deleteNote(id);
      return {
        content: [{
          type: "text",
          text: deleted ? `Deleted note #${id}.` : `No note found with id ${id}.`,
        }],
      };
    }
  );

  return server;
}
