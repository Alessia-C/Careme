// The only file of the auth domain that Vercel deploys as a function: the
// others start with _ and are bundled into it. Every /api/auth/* URL reaches
// the Express app.
export { default } from './_app.js';
