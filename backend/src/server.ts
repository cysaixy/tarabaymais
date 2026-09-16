import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes";
import farmRoutes from "./routes/farmRoutes";
import cropCycleRoutes from "./routes/cropCycleRoutes";
import caseRoutes from "./routes/caseRoutes";
import aiRoutes from "./routes/aiRoutes";
import analRoutes from "./routes/analyticsRoutes";
import activityRoutes from "./routes/activityRoutes";
import userRoutes from "./routes/user.routes";
import analyticsReport from "./routes/analytics.routes";
import sync from "./routes/sync.routes";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/farm", farmRoutes);
app.use("/api/v1/crop-cycles", cropCycleRoutes);
app.use("/api/v1/case", caseRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/analytics", analRoutes);
app.use("/api/v1/", activityRoutes);
app.use("/api/v1/register", userRoutes);
app.use("/api/v1/analytics-report", analyticsReport);
app.use("/api/v1/sync", sync);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
