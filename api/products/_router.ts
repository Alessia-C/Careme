import { Router } from 'express';
import create from './_routes/create.js';

// router.all and not router.post: Express would answer a wrong method with
// the 404 page (or a 200 for OPTIONS), while the handlers return 405 through
// withMethod.
// withAuth is applied per route and never with router.use, as in the auth app.
// Case sensitive: a Router does not inherit the app's setting, hence it is set
// here.
export const productsRouter = Router({ caseSensitive: true });

// POST /api/products
productsRouter.all('/', create);
