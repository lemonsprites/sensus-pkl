import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  updateMeSchema,
  type ChangePasswordInput,
  type UpdateMeInput,
} from "../schemas/auth.js";
import * as authService from "../services/authService.js";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get("/", async (req, res) => {
  const user = await authService.getMe(currentUser(req).id);
  res.json({ success: true, data: user });
});

meRouter.patch("/", validate({ body: updateMeSchema }), async (req, res) => {
  const body = req.validated?.body as UpdateMeInput;
  const user = await authService.updateMe(currentUser(req).id, body);
  res.json({ success: true, data: user });
});

meRouter.post(
  "/change-password",
  validate({ body: changePasswordSchema }),
  async (req, res) => {
    const body = req.validated?.body as ChangePasswordInput;
    const result = await authService.changePassword(
      currentUser(req).id,
      body.currentPassword,
      body.newPassword,
    );
    res.json({ success: true, data: result });
  },
);
