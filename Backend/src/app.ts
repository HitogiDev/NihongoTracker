import express, { Router } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/errorMiddleware.js';
import authRoutes from './routes/auth.routes.js';
import logsRoutes from './routes/logs.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import mediaRoutes from './routes/media.routes.js';
import dailyGoalsRoutes from './routes/dailyGoals.routes.js';
import comparisonRoutes from './routes/comparison.routes.js';
import clubRoutes from './routes/club.routes.js';
import uploadRoutes from './routes/upload.routes.js';

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

app.use(express.static('dist'));
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/goals', dailyGoalsRoutes);
app.use('/api/compare', comparisonRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/upload', uploadRoutes);

app.use(
  '/api',
  Router().get('/', (_req, res) => {
    res.json({ message: 'API Working' });
  })
);

// Serve index.html for all non-API routes (SPA fallback)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const globalErrorHandler = function (err: Error): void {
  console.error('Uncaught Exception', err);
};

process.on('unhandledRejection', globalErrorHandler);
process.on('uncaughtException', globalErrorHandler);

export default app;
