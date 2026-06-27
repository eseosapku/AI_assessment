import type { Tone, LucideIcon } from './tokens'
import { TONE_CHIP } from './tokens'

export function IconChip({
  icon: Icon,
  tone = 'neutral',
  className = '',
}: {
  icon: LucideIcon
  tone?: Tone
  className?: string
}) {
  return (
    <span className={`grid place-items-center rounded-xl ${TONE_CHIP[tone]} ${className || 'h-10 w-10'}`}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </span>
  )
}
