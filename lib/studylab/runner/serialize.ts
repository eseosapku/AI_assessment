// Turn one console argument into a human-readable string for the terminal pane.
export function serializeArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return '[Function]'
  if (typeof value !== 'object' || value === null) return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[Circular]'
  }
}
