import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { getRequestContext } from './request-context';

type HttpRequestLike = {
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type HttpResponseLike = {
  status: (code: number) => { json: (body: unknown) => void };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponseLike>();
    const request = context.getRequest<HttpRequestLike>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (statusCode >= 500 && !(exception instanceof HttpException)) Sentry.captureException(exception);
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message = extractMessage(payload) ?? (exception instanceof Error ? exception.message : 'Unexpected server error');
    const requestId = getRequestContext()?.requestId ?? request.headers?.['x-request-id'];

    response.status(statusCode).json({
      success: false,
      statusCode,
      error: errorName(statusCode, payload),
      message,
      path: request.originalUrl ?? request.url,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

function extractMessage(payload: unknown) {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : null;
  }
  return null;
}

function errorName(statusCode: number, payload: unknown) {
  if (typeof payload === 'object' && payload && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error;
  }
  if (statusCode >= 500) return 'Internal Server Error';
  if (statusCode === 404) return 'Not Found';
  if (statusCode === 403) return 'Forbidden';
  if (statusCode === 401) return 'Unauthorized';
  if (statusCode === 400) return 'Bad Request';
  return 'Request Error';
}
