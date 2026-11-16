import { Router } from "express";
import multer from "multer";

import { config } from "../lib/config.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import {
  importBatchIdSchema,
  importBatchListQuerySchema,
  importBatchParamSchema,
  importPreviewQuerySchema,
  importRowParamSchema,
  importRowPatchSchema,
  type ImportBatchListQuery,
  type ImportBatchParam,
  type ImportPreviewQuery,
  type ImportRowParam,
  type ImportRowPatchInput,
} from "../schemas/import.js";
import * as importService from "../services/importService.js";
import { ApiError } from "../utils/apiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.IMPORT_MAX_SIZE_MB * 1024 * 1024, files: 1 },
});

export const importRouter = Router();

importRouter.use(requireAuth, requireRole("ADMIN", "SUPERADMIN"));

/** Riwayat batch. */
importRouter.get("/siman/batches", validate({ query: importBatchListQuerySchema }), async (req, res) => {
  const query = req.validated?.query as ImportBatchListQuery;
  const data = await importService.listBatches(currentUser(req), query.page, query.limit);
  res.json({ success: true, data });
});

/** Upload XLSX/CSV → parse → Redis + MinIO (snapshot). */
importRouter.post("/siman/preview", upload.single("file"), async (req, res) => {
  if (!req.file) throw ApiError.badRequest("File belum diunggah (field 'file')");

  const result = await importService.createPreview(currentUser(req), {
    originalname: req.file.originalname,
    size: req.file.size,
    buffer: req.file.buffer,
  });

  res.status(201).json({ success: true, data: result });
});

/** Preview paginated (baca Redis, auto-restore dari MinIO bila perlu). */
importRouter.get(
  "/siman/preview/:batchId",
  validate({ params: importBatchParamSchema, query: importPreviewQuerySchema }),
  async (req, res) => {
    const { batchId } = req.validated?.params as ImportBatchParam;
    const { page, limit } = req.validated?.query as ImportPreviewQuery;
    const data = await importService.getPreview(currentUser(req), batchId, page, limit);
    res.json({ success: true, data });
  },
);

/** Edit satu baris — hanya di Redis, MinIO tetap snapshot awal. */
importRouter.patch(
  "/siman/preview/:batchId/row/:rowNum",
  validate({ params: importRowParamSchema, body: importRowPatchSchema }),
  async (req, res) => {
    const { batchId, rowNum } = req.validated?.params as ImportRowParam;
    const body = req.validated?.body as ImportRowPatchInput;
    const data = await importService.updatePreviewRow(currentUser(req), batchId, rowNum, body);
    res.json({ success: true, data });
  },
);

/** Commit transaksional. */
importRouter.post("/siman/commit", validate({ body: importBatchIdSchema }), async (req, res) => {
  const { batchId } = req.validated?.body as ImportBatchParam;
  const data = await importService.commitPreview(currentUser(req), batchId);
  res.json({ success: true, data });
});

/** Cancel → Redis DEL + MinIO removeObject. */
importRouter.post("/siman/cancel", validate({ body: importBatchIdSchema }), async (req, res) => {
  const { batchId } = req.validated?.body as ImportBatchParam;
  const data = await importService.cancelPreview(currentUser(req), batchId);
  res.json({ success: true, data });
});
