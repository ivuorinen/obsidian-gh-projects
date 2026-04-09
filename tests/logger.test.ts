import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "../src/logger";
import type { Logger, LoggerDeps } from "../src/logger";

function makeDeps(overrides: Partial<LoggerDeps> = {}): LoggerDeps {
  return {
    getDebugMode: () => false,
    getToken: () => null,
    ...overrides,
  };
}

describe("createLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("prefix", () => {
    it("prefixes error messages with [GH Projects]", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps());
      logger.error("something broke");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "something broke");
    });

    it("prefixes warn messages with [GH Projects]", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = createLogger(makeDeps());
      logger.warn("watch out");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "watch out");
    });

    it("prefixes debug messages with [GH Projects]", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => true }));
      logger.debug("verbose info");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "verbose info");
    });

    it("prefixes info messages with [GH Projects]", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => true }));
      logger.info("status update");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "status update");
    });
  });

  describe("debug mode gating", () => {
    it("suppresses debug when debugMode is false", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => false }));
      logger.debug("should not appear");
      expect(spy).not.toHaveBeenCalled();
    });

    it("suppresses info when debugMode is false", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => false }));
      logger.info("should not appear");
      expect(spy).not.toHaveBeenCalled();
    });

    it("always emits warn regardless of debugMode", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => false }));
      logger.warn("warning");
      expect(spy).toHaveBeenCalled();
    });

    it("always emits error regardless of debugMode", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getDebugMode: () => false }));
      logger.error("error");
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("token redaction", () => {
    it("redacts token from string arguments", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => "ghp_secret123" }));
      logger.error("Authorization: bearer ghp_secret123");
      expect(spy).toHaveBeenCalledWith(
        "[GH Projects]",
        "Authorization: bearer [REDACTED]"
      );
    });

    it("redacts token from Error messages and stack traces", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => "ghp_secret123" }));
      logger.error("failed:", new Error("token ghp_secret123 invalid"));
      const redacted = spy.mock.calls[0][2] as string;
      expect(redacted).toContain("Error: token [REDACTED] invalid");
      expect(redacted).not.toContain("ghp_secret123");
    });

    it("redacts token from plain objects", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => "ghp_secret123" }));
      logger.error("ctx:", { headers: { Authorization: "bearer ghp_secret123" } });
      expect(spy).toHaveBeenCalledWith(
        "[GH Projects]",
        "ctx:",
        expect.stringContaining("[REDACTED]")
      );
    });

    it("passes through when token is null", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => null }));
      logger.error("no token here");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "no token here");
    });

    it("passes through when token is empty string", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => "" }));
      logger.error("no token here");
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "no token here");
    });

    it("passes through non-string, non-Error, non-object primitives unchanged (line 27)", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps({ getToken: () => "ghp_secret123" }));
      // number is not string, not Error, not object — falls through to `return arg`
      logger.error(42, true, null);
      expect(spy).toHaveBeenCalledWith("[GH Projects]", 42, true, null);
    });
  });

  describe("multiple arguments", () => {
    it("handles multiple arguments", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger(makeDeps());
      logger.error("a", "b", 42);
      expect(spy).toHaveBeenCalledWith("[GH Projects]", "a", "b", 42);
    });
  });
});
