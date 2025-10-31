"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// swagger.ts (or use .js if you're running via node directly)
const path_1 = __importDefault(require("path"));
const swaggerAutogen = require('swagger-autogen')();
const doc = {
    info: {
        title: 'My API',
        description: 'API documentation with auto-generation',
    },
    host: 'api.salesvera',
    schemes: ['https'],
};
const outputFile = path_1.default.join(__dirname, '../../swagger-output.json');
const endpointsFiles = ['./src/server.ts']; // your main app file or route entrypoint
swaggerAutogen(outputFile, endpointsFiles, doc);
