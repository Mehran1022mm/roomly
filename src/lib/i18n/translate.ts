import type { Dictionary } from "./dictionaries/en.ts"
import { baseTagOf, type Locale } from "./locales.ts"

type AddressableKeys<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${AddressableKeys<T[K]>}`
    }[keyof T & string]

type PluralBase<T extends string> = T extends `${infer Base}_one` ? Base : never

export type DictionaryKey = AddressableKeys<Dictionary>

export type TranslationKey = DictionaryKey | PluralBase<DictionaryKey>

export type TranslationParams = Record<string, string | number> & { count?: number }

const interpolationPattern = /\{(\w+)\}/g
const pluralCategories = new Map<Locale, Intl.PluralRules>()

function pluralCategoryFor(locale: Locale, count: number): string {
  let rules = pluralCategories.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(baseTagOf(locale))
    pluralCategories.set(locale, rules)
  }
  return rules.select(count)
}

function resolveString(dictionary: Dictionary, key: string): string | undefined {
  let current: unknown = dictionary
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === "string" ? current : undefined
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(interpolationPattern, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function translate(
  dictionary: Dictionary,
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  if (typeof params?.count === "number") {
    const category = pluralCategoryFor(locale, params.count)
    const pluralKey = `${key}_${category}`
    const pluralTemplate = resolveString(dictionary, pluralKey)
    if (pluralTemplate !== undefined) return interpolate(pluralTemplate, params)
    const fallbackOther = resolveString(dictionary, `${key}_other`)
    if (fallbackOther !== undefined) return interpolate(fallbackOther, params)
  }
  const template = resolveString(dictionary, key)
  if (template === undefined) return key
  return interpolate(template, params)
}
