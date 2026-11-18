import { ZodError } from "zod";
import {
  AuthenticationError,
  AuthorizationError,
  FourEyesViolationError,
} from "@/lib/permissions/guard";

export interface ActionResult {
  ok: boolean;
  error?: string;
  requiresApproval?: boolean;
  /** Diisi oleh aksi yang membuat entitas baru (mis. `createUserAction`). */
  id?: string;
  username?: string;
}

/**
 * Validation error dari domain layer (bukan Zod). Ditampilkan apa adanya ke user,
 * karena pesannya memang ditulis untuk operator admin.
 */
export class DomainValidationError extends Error {
  readonly name = "DomainValidationError";
}

/** Maps thrown errors to safe, user-facing action results. */
export function actionError(err: unknown): string {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
    return `Validation failed${path}: ${issue?.message ?? "invalid input"}`;
  }
  if (
    err instanceof AuthenticationError ||
    err instanceof AuthorizationError ||
    err instanceof FourEyesViolationError
  ) {
    return err.message;
  }
  if (err instanceof Error) {
    // Hide unexpected internals; show known domain errors only
    const domainErrors = ["RbacError", "SettingsError", "DomainValidationError"];
    if (domainErrors.includes(err.name)) return err.message;
  }
  return "Something went wrong. Please try again.";
}
