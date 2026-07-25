import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@config/environment';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'express-ts backend',
      version: '1.0.0',
      description: '',
      contact: {
        name: 'API Support',
        email: 'support@api.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api`,
        description: 'Development server',
      },
    ],
    components: {},
    security: [],
  },
  apis: ['./src/routes/**/*.ts', './src/docs/schemas/**/*.ts'],
};

export default swaggerJsdoc(options);
