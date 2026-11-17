/**
 * Error yang aman dipetakan ke HTTP response.
 * `expose` menentukan apakah `message` boleh dikirim ke klien (detail internal → 500 generik).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Permintaan tidak valid", details?: unknown) {
    super(400, "BAD_REQUEST", message, { details });
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Tidak terautentikasi") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Tidak berhak mengakses resource ini") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource tidak ditemukan") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

/** Input tidak lolos validasi (dipakai juga saat memetakan ZodError). */
export class ValidationError extends AppError {
  constructor(message = "Data yang dikirim tidak valid", details?: unknown) {
    super(422, "VALIDATION_ERROR", message, { details });
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Konflik dengan state saat ini", details?: unknown) {
    super(409, "CONFLICT", message, { details });
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Dependency tidak tersedia", details?: unknown) {
    super(503, "SERVICE_UNAVAILABLE", message, { details });
    this.name = "ServiceUnavailableError";
  }
}
