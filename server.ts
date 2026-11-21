import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './server/routes.ts';
import { openApiSpec } from './server/swagger.ts';
import { backendStore } from './server/store.ts';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT =
  isProduction || process.env.API_ONLY === 'true'
    ? Number(process.env.PORT || 3000)
    : 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.use('/api', apiRouter);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
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

startServer();

export default app;
