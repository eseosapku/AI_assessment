// lib/studylab/engines/index.ts
/**
 * Every scene engine, registered as this module loads. An engine is added here
 * once it meets the eval bar (the spec, section 5).
 */
export { registerEngine, getEngine, sceneCatalogue, scenesFor } from './registry'
export type { SceneEngine, SceneViewProps, SceneMarked } from './types'

// The engines, each registering itself as it loads.
import './orbit/config'
import './particles/config'
import './atom/config'
import './bonding/config'
import './coordinate-plane/config'
import './lab-bench/config'
import './body-flow/config'
import './cause-chain/config'
