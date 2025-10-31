// swagger.ts (or use .js if you're running via node directly)
import path from 'path';
const swaggerAutogen = require('swagger-autogen')();
const doc = {
  info: {
    title: 'My API',
    description: 'API documentation with auto-generation',
  },
  host: 'api.salesvera',
  schemes: ['https'],
};

const outputFile = path.join(__dirname, '../../swagger-output.json');
const endpointsFiles = ['./src/server.ts']; // your main app file or route entrypoint

swaggerAutogen(outputFile, endpointsFiles, doc);