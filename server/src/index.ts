import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import aiRouter from './routes/ai';
import stripeRouter from './routes/stripe';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook needs raw body — must come before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

app.use('/api/ai', aiRouter);
app.use('/api/stripe', stripeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
