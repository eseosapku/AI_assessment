// lib/studylab/chatFade.ts
import type { ChatMessage } from './types'

/**
 * Which messages fade and which reply is lit, Brilliant-style: everything
 * before the learner's latest message fades (`before`, an index), and the
 * tutor's newest teaching line after it is lit (`lit`, -1 for none). With
 * nothing from the learner yet, only the tutor's latest line stays bright.
 */
export function chatEmphasis(messages: ChatMessage[]): { before: number; lit: number } {
  const teaching = (m: ChatMessage) => m.role === 'assistant' && (m.kind === undefined || m.kind === 'say') && !!m.content?.trim()
  let lastUser = -1
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') { lastUser = i; break }
  let lit = -1
  for (let i = messages.length - 1; i > lastUser; i--) if (teaching(messages[i])) { lit = i; break }
  const before = lastUser >= 0 ? lastUser : lit >= 0 ? lit : 0
  return { before, lit }
}
