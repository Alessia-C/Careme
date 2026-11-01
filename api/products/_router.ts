import { Router } from 'express';
import { withMethods } from '../_lib/http.js';
import create from './_routes/create.js';
import detail from './_routes/detail.js';
import list from './_routes/list.js';

// router.all and not router.get/post: Express would answer a wrong method with
// the 404 page (or a 200 for OPTIONS), while the handlers return 405 through
// withMethod and withMethods.
// withAuth is applied per route and never with router.use, as in the auth app.
// Case sensitive: a Router does not inherit the app's setting, hence it is set
// here.
export const productsRouter = Router({ caseSensitive: true });

// GET /api/products and POST /api/products
productsRouter.all('/', withMethods({ GET: list, POST: create }));
// GET /api/products/:id
productsRouter.all('/:id', detail);
