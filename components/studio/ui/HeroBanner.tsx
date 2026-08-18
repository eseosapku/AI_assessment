import { ArrowRight } from 'lucide-react'

type HeroTone = 'accent' | 'recall' | 'studylab' | 'exam'

const TONE_BG: Record<HeroTone, string> = {
  accent: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)',
  recall: 'linear-gradient(115deg,#0C74B4,#1AA0DC 52%,#3ED3F5)',
  studylab: 'linear-gradient(115deg,#0E7A5A,#16B67A 60%,#3FD08F)',
  exam: 'linear-gradient(115deg,#C77B16,#F0A93E 60%,#FFC777)',
}

export function HeroBanner({
  kicker,
  title,
  ctaLabel,
  onCta,
  tone = 'accent',
  art = '/art/hero-motif.png',
}: {
  kicker: string
  title: string
  ctaLabel: string
  onCta?: () => void
  tone?: HeroTone
  art?: string
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] px-9 py-[34px] text-white" style={{ background: TONE_BG[tone] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={art}
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-[55%] object-cover opacity-90 mix-blend-screen"
      />
      <div className="relative">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-85">{kicker}</div>
        <h1 className="mt-2.5 max-w-[430px] text-[29px] font-extrabold leading-[1.16]">{title}</h1>
        <button
          type="button"
          onClick={onCta}
          data-tour="hero-cta"
          className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-[#13202A] py-3 pl-5 pr-3 text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
        >
          {ctaLabel}
          <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white text-[#13202A]">
            <ArrowRight className="h-[18px] w-[18px]" />
          </span>
        </button>
      </div>
    </section>
  )
}
