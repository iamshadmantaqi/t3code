import * as Option from "effect/Option";
import { HttpServerRequest } from "effect/http";
import { describe, expect, it } from "vite-plus/test";

import { requestUrl } from "./requestUrl.ts";

const urlBehindProxy = (headers: Record<string, string>) =>
  Option.getOrThrow(
    requestUrl(
      HttpServerRequest.fromWeb(
        new Request("http://t3.example.com/ws", {
          headers: { host: "t3.example.com", ...headers },
        }),
      ),
    ),
  ).href;

describe("requestUrl", () => {
  it("treats a TLS-terminating proxy's forwarded proto as https", () => {
    expect(urlBehindProxy({ "x-forwarded-proto": "https" })).toBe("https://t3.example.com/ws");
    // Traefik forwards a WebSocket upgrade as `wss`.
    expect(urlBehindProxy({ "x-forwarded-proto": "wss" })).toBe("https://t3.example.com/ws");
  });

  it("keeps http without a forwarded proto", () => {
    expect(urlBehindProxy({})).toBe("http://t3.example.com/ws");
  });
});
