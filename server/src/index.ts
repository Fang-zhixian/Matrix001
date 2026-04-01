import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import apiRouter from './routes/api.js';
import { ensureDatabaseReady } from './storage/database.js';
import { HttpError } from './utils/httpError.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const clientDistPath = path.resolve(process.cwd(), 'dist');

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api', apiRouter);

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next();
      return;
    }

    response.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  if (response.headersSent) {
    return;
  }

  response.status(error instanceof HttpError ? error.status : 500).json({ error: message });
});

ensureDatabaseReady()
  .then(() => {
    app.listen(port, () => {
      console.log(`Matrix001 server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database connection.', error);
    process.exit(1);
  });
