/**
 * Auth error types (isomorphic).
 */

export type AuthErrorCode = "unauthenticated" | "forbidden" | "mfa_required";

/** Thrown by requireUser({ throwOnFail: true }); route handlers map it to 401/403. */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }

  /** Suggested HTTP status for route handlers. */
  get status(): 401 | 403 {
    return this.code === "forbidden" ? 403 : 401;
  }
}

/** A user-facing validation problem in an auth/user-management operation. */
export class AuthInputError extends Error {
  constructor(
    message: string,
    public readonly field: "email" | "password" | "newPassword" | "name" | "role" | "code" | null = null,
  ) {
    super(message);
    this.name = "AuthInputError";
  }
}
