import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const DB_FILE = path.resolve(__dirname, 'data.csv');
const SQLITE_FILE = path.resolve(__dirname, 'app.db');

const db = new Database(SQLITE_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    day TEXT,
    timeMin INTEGER,
    timestamp INTEGER
  )
`);

// API routes
app.get("/api/csv", (req, res) => {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    res.json({ data });
  } else {
    res.json({ data: null });
  }
});

app.post("/api/csv", (req, res) => {
  const { data } = req.body;
  if (typeof data === 'string') {
    fs.writeFileSync(DB_FILE, data, 'utf-8');
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

app.get("/api/reports", (req, res) => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const stmt = db.prepare('SELECT room, day, timeMin FROM reports WHERE timestamp > ?');
  const reports = stmt.all(twoHoursAgo);
  res.json({ reports });
});

app.post("/api/report", (req, res) => {
  const { room, day, timeMin } = req.body;
  const stmt = db.prepare('INSERT INTO reports (room, day, timeMin, timestamp) VALUES (?, ?, ?, ?)');
  stmt.run(room, day, timeMin, Date.now());
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
