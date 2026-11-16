import { Router } from "express";

import { currentUser, requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import { dashboardQuerySchema, type DashboardQuery } from "../schemas/dashboard.js";
import { logQuerySchema, type LogQuery } from "../schemas/log.js";
import {
  adminGroupQuerySchema,
  bulkVerifySchema,
  monitoringQuerySchema,
  type AdminGroupQuery,
  type BulkVerifyInput,
  type MonitoringQuery,
} from "../schemas/monitoring.js";
import {
  reportExportQuerySchema,
  reportQuerySchema,
  type ReportExportQuery,
  type ReportQuery,
} from "../schemas/report.js";
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
import { exportQuerySchema, type ExportQuery } from "../schemas/export.js";
import {
  labelIdsSchema,
  labelQuerySchema,
  scanParamSchema,
  type LabelIdsInput,
  type LabelQuery,
  type ScanParam,
} from "../schemas/label.js";
import {
  createSensusGrupSchema,
  grupParamSchema,
  kandidatQuerySchema,
  rejectSensusGrupSchema,
  ruangParamSchema,
  updateSensusGrupSchema,
  type CreateSensusGrupInput,
  type GrupParam,
  type KandidatQuery,
  type RejectSensusGrupInput,
  type RuangParam,
  type UpdateSensusGrupInput,
} from "../schemas/sensus.js";
import * as activityService from "../services/activityService.js";
import * as dashboardService from "../services/dashboardService.js";
import * as dokumenService from "../services/dokumenService.js";
import * as exportService from "../services/exportService.js";
import * as labelService from "../services/labelService.js";
import * as monitoringService from "../services/monitoringService.js";
import * as reportService from "../services/reportService.js";
import { buildReportDocx } from "../services/reportDocxService.js";
import * as sensusService from "../services/sensusService.js";

export const masterRouter = Router();
masterRouter.use(requireAuth);

masterRouter.get("/hierarki", async (_req, res) => {
  res.json({ success: true, data: await sensusService.getHierarchy() });
});

masterRouter.get("/ruang/:id", validate({ params: ruangParamSchema }), async (req, res) => {
  const { id } = req.validated?.params as RuangParam;
  res.json({ success: true, data: await sensusService.getRuangData(id) });
});

masterRouter.get(
  "/ruang/:id/kandidat",
  validate({ params: ruangParamSchema, query: kandidatQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as KandidatQuery;
    res.json({ success: true, data: await sensusService.getKandidat(query) });
  },
);

masterRouter.post(
  "/ruang/:id/sensus-grup",
  validate({ params: ruangParamSchema, body: createSensusGrupSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as RuangParam;
    const body = req.validated?.body as CreateSensusGrupInput;
    const data = await sensusService.createSensusGrup(currentUser(req).id, id, body);
    res.status(201).json({ success: true, data });
  },
);

masterRouter.patch(
  "/sensus-grup/:id",
  validate({ params: grupParamSchema, body: updateSensusGrupSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as GrupParam;
    const body = req.validated?.body as UpdateSensusGrupInput;
    res.json({ success: true, data: await sensusService.updateSensusGrup(currentUser(req).id, id, body) });
  },
);

masterRouter.delete(
  "/sensus-grup/:id",
  validate({ params: grupParamSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as GrupParam;
    res.json({ success: true, data: await sensusService.deleteSensusGrup(currentUser(req), id) });
  },
);

masterRouter.post(
  "/sensus-grup/:id/verify",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ params: grupParamSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as GrupParam;
    res.json({
      success: true,
      data: await sensusService.verifySensusGrup(currentUser(req).id, id),
    });
  },
);

masterRouter.post(
  "/sensus-grup/:id/reject",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ params: grupParamSchema, body: rejectSensusGrupSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as GrupParam;
    const body = req.validated?.body as RejectSensusGrupInput;
    res.json({
      success: true,
      data: await sensusService.rejectSensusGrup(currentUser(req).id, id, body.catatan),
    });
  },
);

masterRouter.get(
  "/sensus-grup/:id/dokumen",
  validate({ params: dokumenListParamSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as DokumenListParam;
    res.json({ success: true, data: await dokumenService.listDokumen(id) });
  },
);

masterRouter.post(
  "/sensus-grup/:id/dokumen/presign",
  validate({ params: dokumenListParamSchema, body: dokumenPresignSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as DokumenListParam;
    const body = req.validated?.body as DokumenPresignInput;
    res.json({ success: true, data: await dokumenService.presignUpload(id, body) });
  },
);

masterRouter.post(
  "/sensus-grup/:id/dokumen/confirm",
  validate({ params: dokumenListParamSchema, body: dokumenConfirmSchema }),
  async (req, res) => {
    const { id } = req.validated?.params as DokumenListParam;
    const body = req.validated?.body as DokumenConfirmInput;
    const data = await dokumenService.confirmUpload(currentUser(req).id, id, body);
    res.status(201).json({ success: true, data });
  },
);

masterRouter.delete(
  "/sensus-grup/:id/dokumen/:dokumenId",
  validate({ params: dokumenIdParamSchema }),
  async (req, res) => {
    const { id, dokumenId } = req.validated?.params as DokumenIdParam;
    res.json({ success: true, data: await dokumenService.deleteDokumen(currentUser(req), id, dokumenId) });
  },
);

masterRouter.get("/logs", validate({ query: logQuerySchema }), async (req, res) => {
  const query = req.validated?.query as LogQuery;
  res.json({ success: true, data: await activityService.listLogs(query) });
});

masterRouter.get(
  "/monitoring/progress",
  validate({ query: monitoringQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as MonitoringQuery;
    res.json({ success: true, data: await monitoringService.getProgress(query) });
  },
);

masterRouter.get(
  "/admin/grup",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: adminGroupQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as AdminGroupQuery;
    res.json({ success: true, data: await monitoringService.listAdminGroups(query) });
  },
);

masterRouter.post(
  "/admin/grup/bulk-verify",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ body: bulkVerifySchema }),
  async (req, res) => {
    const body = req.validated?.body as BulkVerifyInput;
    res.json({
      success: true,
      data: await monitoringService.bulkVerify(currentUser(req).id, body.ids),
    });
  },
);

masterRouter.get(
  "/report/summary",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: reportQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as ReportQuery;
    res.json({ success: true, data: await reportService.getReportData(currentUser(req), query) });
  },
);

masterRouter.get(
  "/report/export",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: reportExportQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as ReportExportQuery;
    const data = await reportService.getReportData(currentUser(req), query);
    const buffer = await buildReportDocx(data);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-sensus-${stamp}.docx"`,
    );
    res.send(buffer);
  },
);

masterRouter.get(
  "/dashboard",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: dashboardQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as DashboardQuery;
    res.json({ success: true, data: await dashboardService.getDashboard(query) });
  },
);

masterRouter.get(
  "/label/eligible",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: labelQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as LabelQuery;
    res.json({ success: true, data: await labelService.getEligible(query) });
  },
);

masterRouter.post(
  "/label/print",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ body: labelIdsSchema }),
  async (req, res) => {
    const body = req.validated?.body as LabelIdsInput;
    res.json({ success: true, data: await labelService.printLabels(currentUser(req).id, body.ids) });
  },
);

masterRouter.post(
  "/label/apply",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ body: labelIdsSchema }),
  async (req, res) => {
    const body = req.validated?.body as LabelIdsInput;
    res.json({ success: true, data: await labelService.applyLabels(currentUser(req).id, body.ids) });
  },
);

masterRouter.get(
  "/scan/:kodeRegister",
  validate({ params: scanParamSchema }),
  async (req, res) => {
    const { kodeRegister } = req.validated?.params as ScanParam;
    res.json({ success: true, data: await labelService.scanLabel(kodeRegister) });
  },
);

masterRouter.get(
  "/export/sensus",
  requireRole("ADMIN", "SUPERADMIN"),
  validate({ query: exportQuerySchema }),
  async (req, res) => {
    const query = req.validated?.query as ExportQuery;
    const file = await exportService.exportSensus(query.format);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  },
);
