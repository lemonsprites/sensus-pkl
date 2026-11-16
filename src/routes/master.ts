import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  roomAssetsQuerySchema,
  ruangParamSchema,
  sensusParamSchema,
  sensusUpsertSchema,
  type RoomAssetsQuery,
  type RuangParam,
  type SensusParam,
  type SensusUpsertInput,
} from "../schemas/sensus.js";
import * as sensusService from "../services/sensusService.js";

export const masterRouter = Router();

masterRouter.use(requireAuth);

/** Pohon bangunan → ruang → jumlah aset/sensus. */
masterRouter.get("/hierarki", async (_req, res) => {
  const data = await sensusService.getHierarchy();
  res.json({ success: true, data });
});

/** Aset dalam satu ruang + aset gedungnya, dengan filter/pagination. */
masterRouter.get(
  "/ruang/:id/aset",
  validate({ params: ruangParamSchema, query: roomAssetsQuerySchema }),
  async (req, res) => {
    const { id } = req.validated?.params as RuangParam;
    const query = req.validated?.query as RoomAssetsQuery;
    const data = await sensusService.getRuangWithAssets(id, query);
    res.json({ success: true, data });
  },
);

/** Simpan draft / tandai diperiksa / tidak ditemukan. */
masterRouter.put(
  "/sensus/:barangLamaId",
  validate({ params: sensusParamSchema, body: sensusUpsertSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as SensusParam;
    const body = req.validated?.body as SensusUpsertInput;
    const data = await sensusService.upsertSensus(currentUser(req).id, barangLamaId, body);
    res.json({ success: true, data });
  },
);
