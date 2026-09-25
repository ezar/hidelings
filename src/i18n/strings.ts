// UI text in Spanish and English (spec 0). Spanish is the reference; English must have every key.

export const es = {
  appName: 'Hidelings',
  tagline: 'Criaturas que se esconden detrás de las cosas de tu casa. Escóndelas, pasa el móvil y a buscar.',
  permCamera: 'para ver tu habitación.',
  permCameraStrong: 'Cámara',
  permMotion: 'para saber hacia dónde miras.',
  permMotionStrong: 'Movimiento',
  permPrivacy: 'Todo pasa dentro del móvil.',
  permPrivacyStrong: 'Ninguna imagen sale de él.',
  start: 'Empezar',
  startNote: 'Al pulsar te pediremos los dos permisos. Mantén el móvil en vertical.',
  downloadNote: 'La primera vez se descargan unos {size}. Mejor con wifi.',
  cachedNote: 'Los modelos ya están en este móvil. Funciona sin internet.',
  stepMotion: 'Pidiendo permiso de movimiento…',
  stepCamera: 'Abriendo la cámara…',
  stepProbe: 'Mirando qué sabe hacer este móvil…',
  stepBenchmark: 'Midiendo la velocidad (solo la primera vez)…',
  downloadTitle: 'Despertando a las criaturas…',
  downloadSubtitle: 'Solo la primera vez. Luego funciona sin internet.',
  downloadProgress: '{loaded} de {total}',
  downloadTip: 'Busca una habitación con un sofá, una mesa o una puerta. A las criaturas les encantan los bordes.',
  errorTitle: 'No hemos podido empezar',
  errorCamera: 'Sin cámara no podemos jugar. Revisa el permiso de la cámara en los ajustes del navegador.',
  errorModel: 'No se ha podido cargar el modelo de profundidad.',
  retry: 'Reintentar',
  noMotion: 'Sin giroscopio: el juego no sabrá hacia dónde miras.',
  rotateTitle: 'Gira el móvil',
  rotateBody: 'Hidelings se juega en vertical.',
  previewTitle: 'Vista de profundidad',
  depthFps: 'Profundidad',
  breakdown: 'captura {grab} · prep {prep} · modelo {model} · post {post} · ciclo {cycle} ms',
  gyro: 'Giroscopio',
  gyroValue: '{events} eventos/s · hueco máx {gap} ms',
  gyroNone: 'sin datos',
  runtime: 'Motor',
  host: { worker: 'worker', main: 'hilo principal' },
  size: 'Resolución',
  overlay: 'Profundidad',
  drift: 'Deriva',
  driftMark: 'Marcar',
  driftMeasure: 'Medir',
  driftHelpMark: 'Toca un objeto fácil de reconocer para marcarlo.',
  driftHelpMeasure: 'Toca otra vez el mismo objeto.',
  driftResult: '{deg}° en {min} min',
  report: 'Copiar informe',
  reportCopied: 'Informe copiado',
  deleteModels: 'Borrar modelos',
  modelsDeleted: 'Modelos borrados. Se descargarán al volver a empezar.',
  settings: 'Ajustes',
  close: 'Cerrar',
  language: 'Idioma',
};

export type Strings = typeof es;

export const en: Strings = {
  appName: 'Hidelings',
  tagline: 'Little creatures that hide behind the things in your home. Hide them, pass the phone and go find them.',
  permCamera: 'to see your room.',
  permCameraStrong: 'Camera',
  permMotion: 'to know where you are looking.',
  permMotionStrong: 'Motion',
  permPrivacy: 'Everything happens on this phone.',
  permPrivacyStrong: 'No image ever leaves it.',
  start: 'Start',
  startNote: 'When you tap, we will ask for both permissions. Keep the phone upright.',
  downloadNote: 'The first time downloads about {size}. Wi-Fi is best.',
  cachedNote: 'The models are already on this phone. Works offline.',
  stepMotion: 'Asking for motion access…',
  stepCamera: 'Opening the camera…',
  stepProbe: 'Checking what this phone can do…',
  stepBenchmark: 'Measuring speed (first time only)…',
  downloadTitle: 'Waking up the creatures…',
  downloadSubtitle: 'Only the first time. Then it works offline.',
  downloadProgress: '{loaded} of {total}',
  downloadTip: 'Find a room with a sofa, a table or a door. Creatures love edges.',
  errorTitle: 'We could not start',
  errorCamera: 'We cannot play without the camera. Check the camera permission in your browser settings.',
  errorModel: 'The depth model could not be loaded.',
  retry: 'Try again',
  noMotion: 'No gyroscope: the game will not know where you are looking.',
  rotateTitle: 'Turn your phone',
  rotateBody: 'Hidelings is played upright.',
  previewTitle: 'Depth preview',
  depthFps: 'Depth',
  breakdown: 'capture {grab} · prep {prep} · model {model} · post {post} · loop {cycle} ms',
  gyro: 'Gyroscope',
  gyroValue: '{events} events/s · max gap {gap} ms',
  gyroNone: 'no data',
  runtime: 'Engine',
  host: { worker: 'worker', main: 'main thread' },
  size: 'Resolution',
  overlay: 'Depth',
  drift: 'Drift',
  driftMark: 'Mark',
  driftMeasure: 'Measure',
  driftHelpMark: 'Tap an object that is easy to recognise to mark it.',
  driftHelpMeasure: 'Tap the same object again.',
  driftResult: '{deg}° in {min} min',
  report: 'Copy report',
  reportCopied: 'Report copied',
  deleteModels: 'Delete models',
  modelsDeleted: 'Models deleted. They will download again next time you start.',
  settings: 'Settings',
  close: 'Close',
  language: 'Language',
};

export const STRINGS = { es, en };
export type Lang = keyof typeof STRINGS;

/** Replaces `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export function detectLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return 'es';
}
