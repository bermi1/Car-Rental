import { Router } from 'express';

/**
 * Makes async route handlers safe.
 *
 * Express 4 doesn't understand promises: if an `async` handler rejects, the
 * rejection escapes the request entirely and — on Node 18+ — takes the whole
 * process down with it. One client posting an unknown enum value should
 * return 400, not stop the server for everybody.
 *
 * This patches the router's verb methods once, at import time, so every
 * handler registered afterwards routes its rejections to `next(err)` and lands
 * in the normal error middleware.
 *
 * Importing this module applies the patch. It must therefore be imported
 * before any route module — module bodies run in import order, and a route
 * file registers its handlers the moment it is evaluated.
 */
const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

function wrap(handler: unknown): unknown {
  if (typeof handler !== 'function') return handler;

  // Error-handling middleware is identified by its arity, so the wrapper has
  // to keep four parameters.
  if (handler.length === 4) {
    return function (err: any, req: any, res: any, next: any) {
      try {
        return Promise.resolve((handler as any)(err, req, res, next)).catch(next);
      } catch (thrown) {
        return next(thrown);
      }
    };
  }

  return function (req: any, res: any, next: any) {
    try {
      return Promise.resolve((handler as any)(req, res, next)).catch(next);
    } catch (thrown) {
      return next(thrown);
    }
  };
}

export function patchRouterForAsyncErrors() {
  // In Express 4 the verb methods live directly on `express.Router` itself —
  // it doubles as the prototype every router instance is created from. They
  // are NOT on `Router.prototype`, which is the empty object every function
  // gets for free; patching that one silently does nothing.
  const target = Router as unknown as { [key: string]: any };
  if (target.__asyncPatched) return;

  for (const verb of VERBS) {
    const original = target[verb];
    if (typeof original !== 'function') continue;
    target[verb] = function (this: any, path: any, ...handlers: any[]) {
      return original.call(this, path, ...handlers.map(wrap));
    };
  }
  target.__asyncPatched = true;
}

// Applied on import, before any route module has a chance to register.
patchRouterForAsyncErrors();
