export function blockedWheelPan(input: {
  blockedByNoWheel: boolean
  scrollableCanConsume: boolean
  deltaX: number
  deltaY: number
}): { x: number; y: number } | null {
  if (!input.blockedByNoWheel || input.scrollableCanConsume) return null
  return { x: -input.deltaX, y: -input.deltaY }
}
