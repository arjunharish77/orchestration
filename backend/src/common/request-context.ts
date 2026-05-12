import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export type RequestContext = {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
};

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};
type ResponseLike = {
  setHeader: (name: string, value: string) => void;
};
type NextLike = () => void;

const storage = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware() {
  return (request: RequestLike, response: ResponseLike, next: NextLike) => {
    const requestId = firstHeaderValue(request.headers['x-request-id']) || randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    storage.run(
      {
        requestId,
        ipAddress: request.ip,
        userAgent: firstHeaderValue(request.headers['user-agent'])
      },
      next
    );
  };
}

export function getRequestContext() {
  return storage.getStore();
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

