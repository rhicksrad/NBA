import { describe, expect, it, beforeEach, vi, type MockInstance } from "vitest";
import { z } from "zod";

import { paginate } from "./bdl.js";

vi.mock("./http.js", () => {
  return {
    request: vi.fn(),
  };
});

const { request } = await import("./http.js");

const mockRequest = request as unknown as MockInstance<[string, RequestInit?], Promise<unknown>>;

describe("paginate", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("advances using cursor pagination", async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [1, 2],
        meta: { next_cursor: 25, per_page: 2 },
      })
      .mockResolvedValueOnce({
        data: [3, 4],
        meta: { next_cursor: null, per_page: 2 },
      });

    const result = await paginate<number>("/v1/demo", {}, 2, undefined, z.number());

    expect(result).toEqual([1, 2, 3, 4]);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0][0]).toContain("per_page=2");
    expect(mockRequest.mock.calls[1][0]).toContain("cursor=25");
  });

  it("falls back to page-based pagination when cursor metadata is absent", async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: ["a", "b"],
        meta: { next_page: 2, per_page: 2, current_page: 1 },
      })
      .mockResolvedValueOnce({
        data: ["c"],
        meta: { per_page: 2, current_page: 2, total_pages: 2 },
      });

    const parser = z.string();
    const result = await paginate<string>("/v1/demo", {}, 2, undefined, parser);

    expect(result).toEqual(["a", "b", "c"]);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain("page=2");
  });
});
