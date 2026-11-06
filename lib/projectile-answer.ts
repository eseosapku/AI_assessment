/** Exact checks for standard, fully specified numerical projectile exam parts. */
export function repairProjectileAnswer(q: Record<string, any>): boolean {
  if (!q.exam_question_id || q.type !== 'longform') return false
  const s = String(q.scenario || ''), demand = String(q.question || '')
  if (/^\s*(?:show|prove|explain|describe)\b/i.test(demand) || /\b[hy]\s*\(\s*t\s*\)\s*=/i.test(s)) return false
  if (!/project(?:ile|ed)|thrown|launched|shot/i.test(s) || /\b(?:drag|wind|air resistance)\b/i.test(s) && !/\b(?:ignore|neglect|negligible)\b/i.test(s)) return false
  const speed = s.match(/initial (?:speed|velocity)(?: of| is|,)?\s*(\d+(?:\.\d+)?)\s*m\s*(?:\/\s*s\b|s\s*(?:\^?\s*[-−]1|⁻¹))/i)
  const angle = s.match(/angle(?: of)?\s*(\d+(?:\.\d+)?)\s*(?:degrees?|°)/i)
  const vertical = /vertically upwards?/i.test(s)
  if (!speed || !angle && !vertical) return false
  const u = Number(speed[1]), theta = vertical ? 90 : Number(angle![1])
  if (u <= 0 || theta <= 0 || theta > 90) return false
  const height = s.match(/(?:height(?: of)?|top of (?:a|an|the)|platform)\s*(\d+(?:\.\d+)?)\s*(?:metres?|m)\b/i)
    || s.match(/(\d+(?:\.\d+)?)\s*(?:metres?|m)\s+(?:high|above (?:the )?ground)/i)
  const h = height ? Number(height[1]) : /\b(?:height|platform|cliff|tower|building)\b/i.test(s) ? undefined : /\bground\b|on a horizontal plane/i.test(s) ? 0 : undefined
  const g = Number(s.match(/\bg\s*(?:=|is|, is|,)\s*(\d+(?:\.\d+)?)/i)?.[1] || 9.8)
  if (g <= 0 || /\bin terms of\b/i.test(demand)) return false
  const ux = vertical ? 0 : u * Math.cos(theta * Math.PI / 180), uy = u * Math.sin(theta * Math.PI / 180)
  const flight = h === undefined ? undefined : (uy + Math.sqrt(uy * uy + 2 * g * h)) / g
  const fmt = (n: number) => String(Number(n.toPrecision(5)))
  let working = '', result = ''
  if (/\b(?:time|how long)\b/i.test(demand) && /\b(?:maximum height|highest point)\b/i.test(demand)) {
    working = `At maximum height the vertical velocity is zero, so t = u_y/g = ${fmt(uy)}/${g}`
    result = `${fmt(uy / g)} s`
  } else if (/\bmaximum height\b/i.test(demand) && (/above (?:the )?launch|above (?:the )?point of projection/i.test(demand) || h === 0 || /above (?:the )?ground/i.test(demand))) {
    const base = /above (?:the )?ground/i.test(demand) ? h : 0
    if (base === undefined) return false
    working = `The rise above launch is u_y²/(2g) = ${fmt(uy)}²/(2 × ${g}); add ${base} m for the requested reference level`
    result = `${fmt(base + uy * uy / (2 * g))} m`
  } else if (/\btime\b/i.test(demand) && /\breturn\b/i.test(demand) && /\bsame height\b|\blaunch (?:height|point)\b|\bpoint of projection\b/i.test(demand)) {
    working = `For return to launch height, the vertical displacement is zero: 0 = u_y t − gt²/2. The nonzero root is t = 2u_y/g = 2 × ${fmt(uy)}/${g}`
    result = `${fmt(2 * uy / g)} s`
  } else if (/\btime\b/i.test(demand) && /\b(?:ground|in the air|flight)\b/i.test(demand) && flight !== undefined) {
    working = `At ground level, 0 = ${h} + ${fmt(uy)}t − ${g / 2}t². Take the positive root t = (u_y + √(u_y² + 2gh))/g`
    result = `${fmt(flight)} s`
  } else if (/\b(?:speed|velocity)\b/i.test(demand) && /\b(?:hits?|reaches?) the ground\b/i.test(demand) && flight !== undefined && vertical) {
    working = `With upward positive, v_y = u_y − gt = ${fmt(uy)} − ${g} × ${fmt(flight)}`
    result = `${fmt(Math.abs(uy - g * flight))} m/s downwards`
  } else if (/\bhorizontal component\b/i.test(demand) && /\b(?:initial|velocity)\b/i.test(demand)) {
    working = `u_x = u cos θ = ${u} cos(${theta}°)`
    result = `${fmt(ux)} m/s`
  } else if (/\bhorizontal (?:distance|range)\b|\brange of (?:the )?projectile\b/i.test(demand) && /\bground\b|horizontal plane/i.test(demand) && flight !== undefined) {
    working = `The horizontal velocity is ${fmt(ux)} m/s and the positive root of 0 = ${h} + ${fmt(uy)}t − ${g / 2}t² gives t = ${fmt(flight)} s. Range = u_x t`
    result = `${fmt(ux * flight)} m`
  } else if (/\b(?:cartesian equation|equation of (?:the )?trajectory)\b/i.test(demand) && ux > 0 && h !== undefined) {
    working = `Use x = ${fmt(ux)}t and y = ${h} + ${fmt(uy)}t − ${g / 2}t², then substitute t = x/${fmt(ux)}`
    result = `y = ${h} + ${fmt(uy / ux)}x − ${fmt(g / (2 * ux * ux))}x², with x and y in metres`
  } else return false
  q.model_answer = `${working}. Therefore ${result}.`
  q.explanation = q.model_answer
  const marks = Math.min(3, Math.max(1, Number(q.marks) || 1))
  const points = [working + '.', 'Substitute the stated data consistently, using SI units.', `Obtain ${result}.`]
  q.marks = marks
  q.marking_criteria = marks === 1 ? [points[2]] : marks === 2 ? [points[0], points[2]] : points
  return true
}
