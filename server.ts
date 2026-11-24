import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './server/routes.ts';
import { openApiSpec } from './server/swagger.ts';
import { backendStore, isServerSupabaseConfigured } from './server/store.ts';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT =
  isProduction || process.env.API_ONLY === 'true'
    ? Number(process.env.PORT || 3000)
    : 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

let backendInitialization: Promise<void> | null = null;

export async function initializeBackend() {
  if (!backendInitialization) {
    backendInitialization = (async () => {
      if (!isServerSupabaseConfigured) {
        throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.');
      }
      await backendStore.ensureInitialAdmin();
    })();
  }
  return backendInitialization;
}

app.get('/api/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'Al-Amin Schools API Docs (Swagger)',
    swaggerOptions: {
      persistAuthorization: true
    }
  })
);

app.use('/api', async (_req: Request, res: Response, next) => {
  try {
    await initializeBackend();
    next();
  } catch (error) {
    console.error('[Al-Amin API] Backend initialization failed:', error);
    res.status(503).json({
      error: 'The backend is not configured or the database is unavailable.'
    });
  }
});

app.use('/api', apiRouter);

// Handle direct non-prefixed API calls gracefully (e.g. /auth/*, /profile/*)
app.use('/auth', (req: Request, res: Response, next) => {
  req.url = `/auth${req.url}`;
  apiRouter(req, res, next);
});

app.use('/profile', (req: Request, res: Response, next) => {
  req.url = `/profile${req.url}`;
  apiRouter(req, res, next);
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
  await initializeBackend();

  if (!isProduction && process.env.API_ONLY !== 'true') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (process.env.API_ONLY !== 'true') {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Al-Amin Backend API] Listening on http://0.0.0.0:${PORT} | Swagger UI: /api/docs | Storage: ${backendStore.getStorageMode()}`
    );
  });
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startServer().catch((error) => {
    console.error('[Al-Amin Backend API] Failed to start:', error);
    process.exitCode = 1;
  });
}

export default app;
