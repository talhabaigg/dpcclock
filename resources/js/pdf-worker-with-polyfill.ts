// Worker entry that installs our Map.getOrInsertComputed polyfill before
// loading PDF.js's worker code. Workers have their own global scope, so the
// main-thread polyfill in app.tsx doesn't reach here — we have to install it
// inside the worker too. Vite bundles this file (?worker&url) into a single
// module-worker artifact pointed to by GlobalWorkerOptions.workerSrc.
import './polyfills';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
