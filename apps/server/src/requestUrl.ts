import * as Option from "effect/Option";
import { HttpServerRequest } from "effect/http";

/**
 * `HttpServerRequest.toURL` that honors `X-Forwarded-Proto`. Effect 4.1 stopped
 * reading it, but TLS-terminating proxies in front of the server (Tailscale
 * Serve, tunnels, Traefik, which sends `wss` on a WebSocket upgrade) rely on it
 * for OAuth, DPoP and pairing URLs.
 */
export const requestUrl = (request: HttpServerRequest.HttpServerRequest): Option.Option<URL> =>
  HttpServerRequest.toURL(
    /^\s*(https|wss)\s*$/i.test(request.headers["x-forwarded-proto"] ?? "") &&
      request.protocol !== "https"
      ? request.modify({ protocol: "https" })
      : request,
  );
