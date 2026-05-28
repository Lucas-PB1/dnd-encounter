import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface CombatSession {
  sessionCode: string;
  combatants: any[];
  currentTurnIndex: number;
  round: number;
  logs: any[];
  currentRoll: any | null;
  hasStarted: boolean;
  lastUpdated: number;
}

const sessions = new Map<string, CombatSession>();

// Periodically clean up sessions inactive for more than 12 hours to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;
  for (const [code, session] of sessions.entries()) {
    if (now - session.lastUpdated > twelveHours) {
      sessions.delete(code);
    }
  }
}, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  // 1. Create a new real-time sharing combat session
  app.post("/api/sessions", (req, res) => {
    // Generate a clean, readable 5-character session key
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid visually ambiguous chars like 1, 0, I, O
    let sessionCode = '';
    do {
      sessionCode = '';
      for (let i = 0; i < 5; i++) {
        sessionCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (sessions.has(sessionCode));

    const initialState: CombatSession = {
      sessionCode,
      combatants: req.body.combatants || [],
      currentTurnIndex: req.body.currentTurnIndex || 0,
      round: req.body.round || 1,
      logs: req.body.logs || [],
      currentRoll: req.body.currentRoll || null,
      hasStarted: req.body.hasStarted || false,
      lastUpdated: Date.now()
    };

    sessions.set(sessionCode, initialState);
    console.log(`[Session Created] Code: ${sessionCode}`);
    res.json({ sessionCode });
  });

  // 2. Load combat session details (Get state for spectator or fresh restore)
  app.get("/api/sessions/:sessionCode", (req, res) => {
    const code = req.params.sessionCode.toUpperCase();
    const session = sessions.get(code);
    
    if (!session) {
      return res.status(404).json({ error: "Sessão de combate não encontrada." });
    }

    res.json(session);
  });

  // 3. Update combat session state in real-time
  app.put("/api/sessions/:sessionCode", (req, res) => {
    const code = req.params.sessionCode.toUpperCase();
    const session = sessions.get(code);

    if (!session) {
      return res.status(404).json({ error: "Sessão de combate ativa não encontrada." });
    }

    // Overwrite fields
    session.combatants = req.body.combatants ?? session.combatants;
    session.currentTurnIndex = req.body.currentTurnIndex ?? session.currentTurnIndex;
    session.round = req.body.round ?? session.round;
    session.logs = req.body.logs ?? session.logs;
    session.currentRoll = req.body.currentRoll ?? session.currentRoll;
    session.hasStarted = req.body.hasStarted ?? session.hasStarted;
    session.lastUpdated = Date.now();

    sessions.set(code, session);
    res.json({ success: true, sessionCode: code });
  });

  // Server health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", activeSessions: sessions.size });
  });

  // Configure Vite or Static delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[D&D Server Info] Combat runner server is active at http://localhost:${PORT}`);
  });
}

startServer();
