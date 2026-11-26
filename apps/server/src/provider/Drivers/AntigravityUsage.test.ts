import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { DEFAULT_SERVER_SETTINGS, ProviderInstanceId } from "@t3tools/contracts";
import * as ProviderHost from "@t3tools/provider-core/server/ProviderHost";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";

import { resolveAntigravityInstanceDirectories } from "../antigravityAuthSupport.ts";
import * as AntigravityUsage from "./AntigravityUsage.ts";

describe("AntigravityUsage", () => {
  it.effect("keeps scanning the profiles of instances that were removed", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const stateDir = yield* fileSystem.makeTempDirectoryScoped({ prefix: "antigravity-usage-" });
      const removed = yield* resolveAntigravityInstanceDirectories(
        stateDir,
        ProviderInstanceId.make("antigravity_removed"),
      );
      const orphaned = path.join(removed.profile, "antigravity-acp", "conversations");
      yield* fileSystem.makeDirectory(orphaned, { recursive: true });
      // A profile folder without ACP data is not history and must not be scanned.
      yield* fileSystem.makeDirectory(path.join(stateDir, "providers", "antigravity", "helper"), {
        recursive: true,
      });

      const scanned = yield* AntigravityUsage.AntigravityUsage.pipe(
        Effect.flatMap((usage) =>
          usage.scan({
            instances: [
              {
                instanceId: ProviderInstanceId.make("antigravity"),
                config: undefined,
                environment: { ANTIGRAVITY_DATA_DIR: path.join(stateDir, "none") },
                configured: true,
              },
            ],
            windowStartMs: 0,
          }),
        ),
        Effect.provide(
          AntigravityUsage.layer.pipe(
            Layer.provide(
              Layer.mock(ProviderHost.ProviderHost)({
                paths: {
                  cwd: stateDir,
                  baseDir: stateDir,
                  stateDir,
                  providerStatusCacheDir: stateDir,
                  attachmentsDir: stateDir,
                },
                settings: {
                  get: Effect.succeed(DEFAULT_SERVER_SETTINGS),
                  withSnapshot: (use) => use(DEFAULT_SERVER_SETTINGS),
                  changes: Stream.empty,
                  subscribe: Effect.succeed(Stream.empty),
                },
                resolveAttachmentPath: () => null,
              }),
            ),
          ),
        ),
      );

      const dirs = scanned.map((scan) => scan.dir);
      const orphanedReal = yield* fileSystem.realPath(orphaned);
      assert.isTrue(
        dirs.includes(orphanedReal),
        "conversations of a removed instance were not scanned",
      );
      assert.isFalse(dirs.some((dir) => dir.includes(`${path.sep}helper`)));
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          NodeCrypto.layer,
          Layer.succeed(HostProcess.HomeDirectory, "/nonexistent-home"),
        ),
      ),
    ),
  );
});
