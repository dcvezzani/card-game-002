import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handOfThirteen } from "./lib/fanEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const SPRITE = path.join(
  __dirname,
  "dcv",
  "Monochrome Numbered Card Row.png",
);

const app = express();

app.get("/api/hand", (_req, res) => {
  res.json(handOfThirteen());
});

app.get("/assets/cards.png", (_req, res) => {
  res.sendFile(SPRITE);
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Card fan at http://localhost:${PORT}`);
});
