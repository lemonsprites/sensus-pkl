import {
  Activity,
  Building2,
  CheckCheck,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Map,
  Printer,
  ScanLine,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItemConfig {
  to: string;
  label: string;
  /** Label pendek untuk bottom tab bar. */
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Tampil sebagai tab utama di bottom navigation. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { to: "/hierarki", label: "Hierarki", icon: Building2, primary: true },
  { to: "/denah", label: "Denah", shortLabel: "Denah", icon: Map },
  { to: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { to: "/monitoring", label: "Monitoring", icon: Activity, primary: true },
  { to: "/laporan", label: "Laporan", shortLabel: "Laporan", icon: FileText, primary: true },
  { to: "/log", label: "Log Aktivitas", shortLabel: "Log", icon: History },
  { to: "/profil", label: "Profil", icon: UserRound },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  {
    to: "/import",
    label: "Import SIMAN",
    shortLabel: "Import",
    icon: FileSpreadsheet,
    adminOnly: true,
  },
  { to: "/label", label: "Label", icon: Printer, adminOnly: true },
  { to: "/admin/validasi", label: "Validasi", icon: CheckCheck, adminOnly: true },
  {
    to: "/users",
    label: "Manajemen User",
    shortLabel: "User",
    icon: Users,
    adminOnly: true,
  },
];
