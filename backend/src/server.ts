import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes";
import farmRoutes from "./routes/farmRoutes";
import cropCycleRoutes from "./routes/cropCycleRoutes";
import caseRoutes from "./routes/caseRoutes";
import aiRoutes from "./routes/aiRoutes";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/farm", farmRoutes);
app.use("/api/v1/crop-cycles", cropCycleRoutes);
app.use("/api/v1/case", caseRoutes);
app.use("/api/v1/ai", aiRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
