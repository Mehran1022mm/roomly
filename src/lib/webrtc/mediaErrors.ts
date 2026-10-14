import type { TranslationKey } from "../i18n/translate.ts"

export type MediaFailureKind = "denied" | "missing" | "busy" | "insecure" | "unknown"

export type MediaFailure = {
  kind: MediaFailureKind
  name: string
}

export function classifyMediaError(error: unknown): MediaFailure {
  const name = error instanceof Error ? error.name : "UnknownError"
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return { kind: "denied", name }
    case "SecurityError":
      return { kind: "insecure", name }
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return { kind: "missing", name }
    case "NotReadableError":
    case "TrackStartError":
      return { kind: "busy", name }
    case "AbortError":
      return { kind: "busy", name }
    default:
      return { kind: "unknown", name }
  }
}

export function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function permissionMessageKey(
  device: "camera" | "microphone",
  failure: MediaFailure,
): TranslationKey {
  if (failure.kind === "busy") {
    return device === "camera" ? "permissions.cameraBusy" : "permissions.microphoneBusy"
  }
  if (failure.kind === "unknown") {
    return device === "camera" ? "permissions.cameraUnavailable" : "permissions.microphoneUnavailable"
  }
  const unavailable =
    device === "camera" ? "permissions.cameraUnavailable" : "permissions.microphoneUnavailable"
  if (failure.kind === "missing" || failure.kind === "insecure") return unavailable
  return device === "camera" ? "permissions.cameraDenied" : "permissions.microphoneDenied"
}
