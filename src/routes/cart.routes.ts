import { Router, Request, Response, NextFunction } from 'express';
import { addItemToCart, getCart, createCartId } from '../services/cart.service';
import store from '../store';

const router = Router();

// GET /products — list available products (needed for the frontend and demos)
router.get('/products', (_req: Request, res: Response) => {
  const products = Array.from(store.products.values());
  res.json({ products });
});

// POST /cart — create a new cart and return its id
router.post('/cart', (_req: Request, res: Response) => {
  const cartId = createCartId();
  const cart = { id: cartId, items: [], createdAt: new Date() };
  store.carts.set(cartId, cart);
  res.status(201).json({ cartId });
});

// POST /cart/:cartId/items — add a product to a cart
router.post('/cart/:cartId/items', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartId } = req.params;
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      res.status(400).json({ error: 'productId and quantity are required' });
      return;
    }

    const cart = addItemToCart(cartId, productId, Number(quantity));
    res.status(200).json({ cart });
  } catch (err) {
    next(err);
  }
});

// GET /cart/:cartId — view a cart
router.get('/cart/:cartId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = getCart(req.params.cartId);
    res.json({ cart });
  } catch (err) {
    next(err);
  }
});

export default router;
