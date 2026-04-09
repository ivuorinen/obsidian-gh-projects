import { describe, it, expect } from "vitest";
import { shouldUpdateRepo, buildCoverPath } from "../src/sync";

describe("shouldUpdateRepo", () => {
	it("returns true when no existing synced_at", () => {
		expect(shouldUpdateRepo("2026-04-08T09:00:00Z", null)).toBe(true);
	});

	it("returns true when repo updatedAt is newer than synced_at", () => {
		expect(
			shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-07T00:00:00Z")
		).toBe(true);
	});

	it("returns false when synced_at is newer than updatedAt", () => {
		expect(
			shouldUpdateRepo("2026-04-07T00:00:00Z", "2026-04-08T09:00:00Z")
		).toBe(false);
	});

	it("returns false when timestamps are equal", () => {
		expect(
			shouldUpdateRepo("2026-04-08T09:00:00Z", "2026-04-08T09:00:00Z")
		).toBe(false);
	});
});

describe("buildCoverPath", () => {
	it("builds vault-relative path from assets folder and repo name", () => {
		expect(buildCoverPath("GitHub/assets", "my-project")).toBe(
			"GitHub/assets/my-project.png"
		);
	});

	it("normalizes trailing slashes", () => {
		expect(buildCoverPath("GitHub/assets/", "my-project")).toBe(
			"GitHub/assets/my-project.png"
		);
	});
});
