import app from './app';
import { env } from './config/env';
import { checkDatabaseConnection } from './db/connection';

const PORT = env.PORT || 3001;

async function bootstrap() {
  try {
    await checkDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`[LateSoft API] Servidor escuchando en http://localhost:${PORT}`);
      console.log(`[LateSoft API] Modo de entorno: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[LateSoft API] Error fatal al iniciar el servidor:', err);
    process.exit(1);
  }
}

bootstrap();
