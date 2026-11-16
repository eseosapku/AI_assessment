// lib/studylab/activities/patterns/scene.ts
import type { PatternModule, ScenePayload, ValidateResult } from '../types'
import { getEngine } from '../../engines/registry'
// The engines register themselves as they load.
import '../../engines'

type SceneWork = Record<string, unknown>

/**
 * A scene: whatever engine it names starts it, marks it and says whether its
 * config can be read. The pattern only hands over; it knows no physics.
 */
export const sceneModule: PatternModule<ScenePayload, SceneWork> = {
  pattern: 'scene',

  initialWork(payload): SceneWork {
    const engine = getEngine(payload.engine)
    const config = engine?.parse(payload.config)
    return engine && config ? (engine.initial(config) as SceneWork) : {}
  },

  validate(payload, work): ValidateResult {
    const engine = getEngine(payload.engine)
    const config = engine?.parse(payload.config)
    return engine && config ? engine.check(config, work) : { ok: false, wrongIds: [] }
  },

  isPayload(p: unknown): p is ScenePayload {
    const x = p as ScenePayload
    if (!x || typeof x !== 'object') return false
    const engine = getEngine(x.engine)
    return !!engine && engine.parse(x.config) !== null
  },
}
