import { Response } from "express";

// ✅ Generic Response Function
const sendResponse = (
  res: Response,
  success: boolean,
  message: string,
  code: number,
  data: any = {}
) => {
  return res.status(code).json({
    success,
    code,
    message,
    data,
  });
};

// ✅ Success Responses
export const createSuccess = (
  res: Response,
  message: string,
  data: any = {},
  code: number = 200
) => sendResponse(res, true, message, code, data);

export const getSuccess = (
  res: Response,
  message: string,
  data: any = {},
  code: number = 201
) => sendResponse(res, true, message, code, data);

// ✅ Error Responses
export const badRequest = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 400, data);

export const unauthorized = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 401, data);

export const forbidden = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 403, data);

export const notFound = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 404, data);

export const conflict = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 409, data);

export const validationError = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 422, data);

export const internalServerError = (
  res: Response,
  message: string,
  data: any = {}
) => sendResponse(res, false, message, 500, data);
