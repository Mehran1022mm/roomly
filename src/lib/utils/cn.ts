export function cn(...values: Array<string | false | null | undefined>): string {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    if (!value) continue
    for (const part of value.split(" ").filter(Boolean)) {
      if (seen.has(part)) continue
      seen.add(part)
      output.push(part)
    }
  }
  return output.join(" ")
}
