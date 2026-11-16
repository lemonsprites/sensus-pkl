import type { RequestHandler } from "express";

import type { Role } from "../generated/prisma/enums.js";
import { ApiError } from "../utils/apiError.js";

/** Guard berbasis role — jangan taruh if (role === ...) di handler. */
export const requireRole = (...roles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
};
