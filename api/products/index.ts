// Deployed as a function together with [...path].ts: a catch-all needs at least
// one segment after the folder, so it would never match /api/products itself.
// The other files start with _ and are bundled into the functions.
export { default } from './_app.js';
