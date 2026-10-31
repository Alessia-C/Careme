// The only file of the products domain that Vercel deploys as a function: the
// others start with _ and are bundled into it. Every /api/products URL reaches
// the Express app. The double brackets make the catch-all optional: with
// [...path] alone, POST /api/products (no segment after it) would not match.
export { default } from './_app.js';
