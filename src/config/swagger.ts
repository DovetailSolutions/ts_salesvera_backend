// swagger.ts (or use .js if you're running via node directly)
import path from 'path';
const swaggerAutogen = require('swagger-autogen')();
const doc = {
  info: {
    title: 'SalesVera API',
    description: 'API documentation for SalesVera backend',
  },
  host: '98.81.102.194',
  schemes: ['http'],
  securityDefinitions: {
    Bearer: {
      type: 'apiKey',
      in: 'header',
      name: 'authorization',
      description: 'Enter your Bearer token: Bearer <token>'
    }
  },
  security: [{ Bearer: [] }]
};

const outputFile  = path.join(__dirname, '../../swagger-output.json');
const endpointsFiles = [
  './src/app/router/admin.ts',
  './src/app/router/user.ts'
];

swaggerAutogen(outputFile, endpointsFiles, doc);