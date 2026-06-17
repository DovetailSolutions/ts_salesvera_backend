"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const swaggerAutogen = require('swagger-autogen')();
const doc = {
    info: {
        title: 'SalesVera API',
        description: 'API documentation for SalesVera backend',
        version: '1.0.0',
    },
    host: '168.144.93.228:4000',
    schemes: ['http'],
    securityDefinitions: {
        Bearer: {
            type: 'apiKey',
            in: 'header',
            name: 'authorization',
            description: 'Enter: Bearer <your_token>'
        }
    },
    security: [{ Bearer: [] }],
    tags: [
        { name: 'Admin - Auth', description: 'Admin authentication' },
        { name: 'Admin - Users', description: 'User management by admin' },
        { name: 'Admin - Category', description: 'Category management' },
        { name: 'Admin - SubCategory', description: 'Sub-category management' },
        { name: 'Admin - Meeting', description: 'Meeting & fuel expense' },
        { name: 'Admin - Attendance', description: 'Attendance management' },
        { name: 'Admin - Leave', description: 'Leave management' },
        { name: 'Admin - Expense', description: 'Expense management' },
        { name: 'Admin - Quotation', description: 'Quotation management' },
        { name: 'Admin - Invoice', description: 'Invoice management' },
        { name: 'Admin - Company', description: 'Company management' },
        { name: 'Admin - Branch', description: 'Branch management' },
        { name: 'Admin - Shift', description: 'Shift management' },
        { name: 'Admin - Department', description: 'Department management' },
        { name: 'Admin - Holiday', description: 'Holiday management' },
        { name: 'Admin - Bank', description: 'Company bank management' },
        { name: 'Admin - Client', description: 'Client management' },
        { name: 'Admin - RecordSale', description: 'Record sales' },
        { name: 'Admin - Report', description: 'Report management' },
        { name: 'User - Auth', description: 'User authentication' },
        { name: 'User - Meeting', description: 'Meeting operations' },
        { name: 'User - Attendance', description: 'Attendance operations' },
        { name: 'User - Leave', description: 'Leave operations' },
        { name: 'User - Expense', description: 'Expense operations' },
        { name: 'User - Quotation', description: 'Quotation operations' },
        { name: 'User - Invoice', description: 'Invoice operations' },
        { name: 'User - Company', description: 'Company info' },
        { name: 'User - RecordSale', description: 'Record sales' },
        { name: 'User - Notifications', description: 'Notifications' },
        { name: 'User - Client', description: 'Client operations' },
        { name: 'User - Report', description: 'Report operations' },
        { name: 'User - Dashboard', description: 'Dashboard data' },
        { name: 'Permissions', description: 'Permission management' },
        { name: 'Tasks', description: 'Task management' },
    ],
};
const outputFile = path_1.default.join(__dirname, '../../swagger-output.json');
const endpointsFiles = [
    './src/app/router/admin.ts',
    './src/app/router/user.ts',
    './src/app/router/permission.ts',
    './src/app/router/task.ts',
];
swaggerAutogen(outputFile, endpointsFiles, doc);
