import express, { NextFunction, Request, Response, Router } from 'express';
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
import goalsRoutes from './routes/goals.routes.js';
import clubRoutes from './routes/club.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import ogImageRoutes from './routes/ogImage.routes.js';
import patreonRoutes from './routes/patreon.routes.js';
import tagRoutes from './routes/tag.routes.js';
import changelogRoutes from './routes/changelog.routes.js';
import { metaTagsMiddleware } from './middlewares/metaTags.js';

const app = express();

app.use(
  '/api/patreon/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    if (req.body) {
      // Guardar raw body para verificación de firma
      (req as any).rawBody = req.body.toString('utf8');
      // Parsear JSON manualmente
      try {
        req.body = JSON.parse((req as any).rawBody);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    return next();
  }
);

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
app.use('/api/goals', goalsRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/patreon', patreonRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/changelogs', changelogRoutes);
app.use('/og-image', ogImageRoutes);

app.use(
  '/api',
  Router().get('/', (_req, res) => {
    res.json({ message: 'API Working' });
  })
);

// Serve index.html for all non-API routes (SPA fallback)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
  express.static(path.join(__dirname, '../dist'), {
    index: false,
    setHeaders: (res, filePath) => {
      if (
        filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/i)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
    },
  })
);

app.use(metaTagsMiddleware);

app.get('*', (req: Request, res: Response, next: NextFunction) => {
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
