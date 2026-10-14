export const APP_VERSION = "1.0"
export const APP_NAME = "Roomly"
export const COPYRIGHT_HOLDER = "Roomly"
export function copyrightNotice(year: number): string {
  return `${APP_NAME} v${APP_VERSION} — © ${year} ${COPYRIGHT_HOLDER}`
}
