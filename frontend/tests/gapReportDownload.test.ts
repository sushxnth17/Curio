import { test, expect } from "vitest";
import { formatConfidenceScore } from "../services/historyService";

test("formatConfidenceScore converts 0.0-1.0 float to 0-100 integer", () => {
  expect(formatConfidenceScore(0.85)).toBe(85);
  expect(formatConfidenceScore(0.0)).toBe(0);
  expect(formatConfidenceScore(1.0)).toBe(100);
});

test("formatConfidenceScore leaves 0-100 integers as-is", () => {
  expect(formatConfidenceScore(92)).toBe(92);
  expect(formatConfidenceScore(0)).toBe(0);
});

test("formatConfidenceScore handles null/undefined with default fallback", () => {
  expect(formatConfidenceScore(null, 0.6)).toBe(60);
  expect(formatConfidenceScore(undefined, 0.75)).toBe(75);
});

