import dotenv from 'dotenv';
dotenv.config(); // Must be first — loads env vars before anything reads them

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';

import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes from './routes/payment.js';
import vendorRefundRoutes from './routes/vendorRefunds.js';

// dotenv already loaded at top of file

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Middlewares
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const serverOrigin = `http://localhost:${process.env.PORT || 5000}`;
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow cross-origin image loads
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", serverOrigin, clientOrigin, 'https:', 'data:'],
      },
    },
  })
);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

// Serve locally uploaded files and evidence
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 2. Request Parsing Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// 3. API Routes version 1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/vendor', vendorRefundRoutes);


// Root path diagnostic route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'System is healthy and online',
    data: {
      timestamp: new Date().toISOString()
    }
  });
});

// 4. Not Found (404) Route Handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
});

// 5. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  
  logger.error(`${err.message} [Code: ${errorCode}]`, err);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: {
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

export default app;
