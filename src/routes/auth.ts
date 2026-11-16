import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, type LoginInput } from "../schemas/auth.js";
import * as authService from "../services/authService.js";

export const authRouter = Router();

/** POST /api/auth/login — 5 percobaan/menit/IP. */
authRouter.post("/login", loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  const body = req.validated?.body as LoginInput;
  const result = await authService.login(body.email, body.password);
  res.json({ success: true, data: result });
});

/** POST /api/auth/logout — tokenVersion naik, semua token lama mati. */
authRouter.post("/logout", requireAuth, async (req, res) => {
  await authService.logout(currentUser(req).id);
  res.json({ success: true });
});
