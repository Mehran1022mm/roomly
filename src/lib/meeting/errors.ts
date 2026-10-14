import type { ErrorCode } from "../../../shared/protocol.ts"
import type { TranslationKey } from "../i18n/translate.ts"

export const ERROR_KEYS: Record<ErrorCode, TranslationKey> = {
  wrongPassword: "errors.wrongPassword",
  roomFull: "errors.roomFull",
  invalidName: "errors.invalidName",
  messageTooLong: "errors.messageTooLong",
  messageEmpty: "errors.messageEmpty",
  rateLimited: "errors.rateLimited",
  unauthorized: "errors.sessionExpired",
  serverError: "errors.serverError",
  replaced: "errors.sessionExpired",
}
