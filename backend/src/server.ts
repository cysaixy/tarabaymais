import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  verifyFirebaseToken,
  AuthenticatedRequest,
} from "./middleware/verifyAuth";
import prisma from "./config/prisma";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get(
  "/api/me",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    const uid = req.user!.uid;

    const user = await prisma.user.findUnique({
      where: { uid },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    res.json(user);
  },
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
