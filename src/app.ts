import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from '@routes/index';
import { errorHandler, contextMiddleware, loggingMiddleware } from '@logging';
import { env } from '@config/environment';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '@docs/swagger.config';

const app = express();

// Global middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: env.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//Swagger docs
if (env.ENABLE_SWAGGER) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Logging
app.use(contextMiddleware);
app.use(loggingMiddleware);

// Routes
app.use(env.API_PREFIX, routes);

// Error handler
app.use(errorHandler);

export default app;
