// lib/studylab/engines/index.ts
/**
 * Every scene engine, registered as this module loads. An engine is added here
 * once it meets the eval bar (the spec, section 5).
 */
export { registerEngine, getEngine, sceneCatalogue } from './registry'
export type { SceneEngine, SceneViewProps, SceneMarked } from './types'

// The engines, each registering itself as it loads.
import './orbit/config'
