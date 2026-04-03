const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const doc = {
  info: {
    title: 'SalesVera API',
    description: 'API documentation for SalesVera backend',
    version: '1.0.0'
  },
  host: 'ghostly-subcompensational-gil.ngrok-free.dev',
  basePath: '/',
  schemes: ['https'],
  securityDefinitions: {
    Bearer: {
      type: 'apiKey',
      in: 'header',
      name: 'authorization',
      description: 'Enter: Bearer <your_token>'
    }
  },
  security: [{ Bearer: [] }]
};

const outputFile     = path.join(__dirname, 'swagger-output.json');
const endpointsFiles = [
  './src/app/router/admin.ts',
  './src/app/router/user.ts'
];

swaggerAutogen(outputFile, endpointsFiles, doc);
