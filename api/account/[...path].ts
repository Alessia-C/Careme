// Deployed as a function next to index.ts: a catch-all needs at least one
// segment after the folder, so it serves /api/account/password while index.ts
// serves /api/account itself. Both reach the same Express app.
export { default } from './_app.js';
