export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Error yang aman dikirim ke klien (pesan sudah untuk pengguna). */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static badRequest = (message: string, details?: unknown) =>
    new ApiError("VALIDATION_ERROR", message, details);
  static unauthorized = (message = "Silakan login terlebih dahulu") =>
    new ApiError("UNAUTHORIZED", message);
  static forbidden = (message = "Anda tidak berhak mengakses sumber daya ini") =>
    new ApiError("FORBIDDEN", message);
  static notFound = (message = "Data tidak ditemukan") => new ApiError("NOT_FOUND", message);
  static conflict = (message: string, details?: unknown) =>
    new ApiError("CONFLICT", message, details);
  static rateLimited = (message = "Terlalu banyak permintaan. Coba lagi nanti.") =>
    new ApiError("RATE_LIMITED", message);
  static internal = (message = "Terjadi kesalahan pada server") =>
    new ApiError("INTERNAL_ERROR", message);
}
