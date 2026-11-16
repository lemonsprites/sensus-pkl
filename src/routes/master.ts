import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import {
  dokumenConfirmSchema,
  dokumenIdParamSchema,
  dokumenListParamSchema,
  dokumenPresignSchema,
  type DokumenConfirmInput,
  type DokumenIdParam,
  type DokumenListParam,
  type DokumenPresignInput,
} from "../schemas/dokumen.js";
import {
  rejectSensusSchema,
  roomAssetsQuerySchema,
  ruangParamSchema,
  sensusParamSchema,
  sensusUpsertSchema,
  type RejectSensusInput,
  type RoomAssetsQuery,
  type RuangParam,
  type SensusParam,
  type SensusUpsertInput,
} from "../schemas/sensus.js";
import * as dokumenService from "../services/dokumenService.js";
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

/** M5 — dokumen pendukung: presigned PUT + confirm + list + delete. */
masterRouter.get(
  "/sensus/:barangLamaId/dokumen",
  validate({ params: dokumenListParamSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as DokumenListParam;
    res.json({ success: true, data: await dokumenService.listDokumen(barangLamaId) });
  },
);

masterRouter.post(
  "/sensus/:barangLamaId/dokumen/presign",
  validate({ params: dokumenListParamSchema, body: dokumenPresignSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as DokumenListParam;
    const body = req.validated?.body as DokumenPresignInput;
    const data = await dokumenService.presignUpload(currentUser(req).id, barangLamaId, body);
    res.json({ success: true, data });
  },
);

masterRouter.post(
  "/sensus/:barangLamaId/dokumen/confirm",
  validate({ params: dokumenListParamSchema, body: dokumenConfirmSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as DokumenListParam;
    const body = req.validated?.body as DokumenConfirmInput;
    const data = await dokumenService.confirmUpload(currentUser(req).id, barangLamaId, body);
    res.status(201).json({ success: true, data });
  },
);

masterRouter.delete(
  "/sensus/:barangLamaId/dokumen/:dokumenId",
  validate({ params: dokumenIdParamSchema }),
  async (req, res) => {
    const { barangLamaId, dokumenId } = req.validated?.params as DokumenIdParam;
    res.json({ success: true, data: await dokumenService.deleteDokumen(barangLamaId, dokumenId) });
  },
);

/** M6 — verifikasi/reject oleh ADMIN/SUPERADMIN. */
masterRouter.post(
  "/sensus/:barangLamaId/verify",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ params: sensusParamSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as SensusParam;
    res.json({
      success: true,
      data: await sensusService.verifySensus(currentUser(req).id, barangLamaId),
    });
  },
);

masterRouter.post(
  "/sensus/:barangLamaId/reject",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ params: sensusParamSchema, body: rejectSensusSchema }),
  async (req, res) => {
    const { barangLamaId } = req.validated?.params as SensusParam;
    const body = req.validated?.body as RejectSensusInput;
    res.json({
      success: true,
      data: await sensusService.rejectSensus(currentUser(req).id, barangLamaId, body.catatan),
    });
  },
);
