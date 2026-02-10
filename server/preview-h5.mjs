import express from "express";
import path from "node:path";
import fs from "node:fs";

const app = express();
const root = path.resolve(process.cwd(), "dist/build/h5");
const startPort = Number(process.env.PREVIEW_PORT || 4173);

if (!fs.existsSync(root)) {
  console.error('[preview] dist/build/h5 not found. Run "npm run build:h5" first.');
  process.exit(1);
}

app.use(express.static(root));
app.get("*", (_req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

const listenWithFallback = (port, attemptsLeft) => {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`[preview] http://127.0.0.1:${port}`);
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.warn(`[preview] port ${port} in use, trying ${port + 1}`);
      listenWithFallback(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
};

listenWithFallback(startPort, 10);
