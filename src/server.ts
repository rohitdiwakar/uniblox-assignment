import app from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Discount config: every ${process.env.NTH_ORDER ?? 5}th order earns ${process.env.DISCOUNT_PERCENTAGE ?? 10}% off`);
});
