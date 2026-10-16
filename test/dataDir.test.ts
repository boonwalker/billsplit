import { describe, expect, it } from "vitest";
import { dataDir, ephemeralDataProblem } from "../server/dataDir";

describe("data directory on Railway", () => {
  const root = "/app";
  it("uses the volume unless DATA_DIR says otherwise", () => {
    expect(dataDir({ RAILWAY_VOLUME_MOUNT_PATH: "/data" }, root)).toBe("/data");
    expect(dataDir({ DATA_DIR: "data", RAILWAY_VOLUME_MOUNT_PATH: "/data" }, root)).toBe("/app/data");
    expect(dataDir({}, root)).toBe("/app/data");
  });

  it("refuses data outside the volume (lost with every deploy)", () => {
    const railway = { RAILWAY_ENVIRONMENT: "production", RAILWAY_VOLUME_MOUNT_PATH: "/data" };
    expect(ephemeralDataProblem(railway, "/data")).toBeNull();
    expect(ephemeralDataProblem(railway, "/data/klicksplit")).toBeNull();
    // 16.10.2026: DATA_DIR=data wrote into the container.
    expect(ephemeralDataProblem({ ...railway, DATA_DIR: "data" }, dataDir({ ...railway, DATA_DIR: "data" }, root))).toMatch(/nicht auf dem Volume/);
    expect(ephemeralDataProblem({ RAILWAY_ENVIRONMENT: "production" }, "/app/data")).toMatch(/kein Volume/);
    // Locally and in the click tests: anything goes.
    expect(ephemeralDataProblem({}, "/app/data")).toBeNull();
  });
});
