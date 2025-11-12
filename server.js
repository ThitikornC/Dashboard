import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "menu.html"));
});


app.get("/gamematch", (req, res) => {
  res.sendFile(path.join(__dirname, "gamematch.html"));
});

app.get("/matchsetting", (req, res) => {
  res.sendFile(path.join(__dirname, "teachermatch.html"));
});

app.get("/catagoly", (req, res) => {
  res.sendFile(path.join(__dirname, "catagoly.html"));
});

app.get("/gamepicture", (req, res) => {
  res.sendFile(path.join(__dirname, "gamepicture.html"));
});

app.get("/teacherpicture", (req, res) => {
  res.sendFile(path.join(__dirname, "teacherpicture.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
