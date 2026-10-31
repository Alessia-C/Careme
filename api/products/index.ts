// The only file of the products domain that Vercel deploys as a function: the
// others start with _ and are bundled into it. It is index.ts, not [...path].ts,
// because a catch-all needs at least one segment after the folder, so it would
// never match POST /api/products. Add a [...path].ts that re-exports this app
// when endpoints with a segment (/api/products/:id) arrive.
export { default } from './_app.js';
