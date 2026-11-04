// Point d'accès unique à l'instrumentation de développement (profileur, interrupteurs de diagnostic).
// Le code du jeu (scene, fx, xe, store, ui) n'importe jamais src/debug/ directement : seulement ce fichier.
// Pour retirer le diagnostic d'une version, il suffit de remplacer ces ré-exports par des no-op.
export { PerfProfiler, initLivePerf, timed, useFrame, perfAttach, perfFrame } from './debug/livePerf'
export { registerRenderer } from './debug/perf'
export { Gate, getSwitch, isOn, useIsOn, useSwitch } from './debug/switches'
