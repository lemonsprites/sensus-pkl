import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { resetPasswordLimiter } from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
  type UserIdParam,
} from "../schemas/user.js";
import * as userService from "../services/userService.js";

export const usersRouter = Router();

// Matrix §11: hanya ADMIN & SUPERADMIN; aturan per-target ada di service.
usersRouter.use(requireAuth, requireRole("ADMIN", "SUPERADMIN"));

usersRouter.get("/", validate({ query: listUsersQuerySchema }), async (req, res) => {
  const query = req.validated?.query as ListUsersQuery;
  const data = await userService.listUsers(currentUser(req), query);
  res.json({ success: true, data });
});

usersRouter.post("/", validate({ body: createUserSchema }), async (req, res) => {
  const body = req.validated?.body as CreateUserInput;
  const user = await userService.createUser(currentUser(req), body);
  res.status(201).json({ success: true, data: user });
});

usersRouter.patch(
  "/:id",
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as UserIdParam;
    const body = req.validated?.body as UpdateUserInput;
    const user = await userService.updateUser(currentUser(req), id, body);
    res.json({ success: true, data: user });
  },
);

/** 3 reset / jam / user target. */
usersRouter.post(
  "/:id/reset-password",
  validate({ params: userIdParamSchema }),
  resetPasswordLimiter,
  async (req, res) => {
    const { id } = req.validated?.params as UserIdParam;
    const result = await userService.resetPassword(currentUser(req), id);
    res.json({ success: true, data: result });
  },
);

usersRouter.post(
  "/:id/deactivate",
  validate({ params: userIdParamSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as UserIdParam;
    const user = await userService.setUserActive(currentUser(req), id, false);
    res.json({ success: true, data: user });
  },
);

usersRouter.post(
  "/:id/activate",
  validate({ params: userIdParamSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as UserIdParam;
    const user = await userService.setUserActive(currentUser(req), id, true);
    res.json({ success: true, data: user });
  },
);
