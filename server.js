import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Rec Room at http://localhost:${PORT}`);
});
