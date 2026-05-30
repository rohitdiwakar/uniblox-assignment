import express from 'express';
import path from 'path';
import cartRoutes from './routes/cart.routes';
import checkoutRoutes from './routes/checkout.routes';
import adminRoutes from './routes/admin.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(cartRoutes);
app.use(checkoutRoutes);
app.use(adminRoutes);

// Error handler must be registered last
app.use(errorMiddleware);

export default app;
