import { Router } from "express";

import { authRouter } from "./auth.js";
import { healthRouter } from "./health.js";
import { importRouter } from "./import.js";
import { masterRouter } from "./master.js";
import { meRouter } from "./me.js";
import { usersRouter } from "./users.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/import", importRouter);
apiRouter.use(masterRouter);
