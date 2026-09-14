export function valueToControls(controlId: string, value: number): Record<string, number> {
  return { [controlId]: value }
}

export function controlsToValue(
  controls: Record<string, number> | undefined,
  controlId: string,
  fallback: number,
): number {
  const value = controls?.[controlId]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
