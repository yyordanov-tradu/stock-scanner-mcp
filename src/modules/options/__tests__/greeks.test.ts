import { describe, it, expect } from "vitest";
import { calculateGreeks } from "../greeks.js";

describe("calculateGreeks", () => {
  // Standard params: S=100, K=100 (ATM), T=0.25 (3 months), r=4.5%, v=30%
  const S = 100;
  const K = 100;
  const T = 0.25;
  const r = 0.045;
  const v = 0.30;

  describe("ATM call", () => {
    const g = calculateGreeks(S, K, T, r, v, true);

    it("delta is approximately 0.5", () => {
      expect(g.delta).toBeGreaterThan(0.45);
      expect(g.delta).toBeLessThan(0.65);
    });

    it("gamma is positive", () => {
      expect(g.gamma).toBeGreaterThan(0);
    });

    it("theta is negative (time decay)", () => {
      expect(g.theta).toBeLessThan(0);
    });

    it("vega is positive", () => {
      expect(g.vega).toBeGreaterThan(0);
    });
  });

  describe("ATM put", () => {
    const g = calculateGreeks(S, K, T, r, v, false);

    it("delta is approximately -0.5", () => {
      expect(g.delta).toBeGreaterThan(-0.65);
      expect(g.delta).toBeLessThan(-0.35);
    });

    it("theta is negative (time decay)", () => {
      expect(g.theta).toBeLessThan(0);
    });
  });

  describe("put-call parity", () => {
    const callG = calculateGreeks(S, K, T, r, v, true);
    const putG = calculateGreeks(S, K, T, r, v, false);

    it("call delta - put delta ≈ 1", () => {
      expect(callG.delta - putG.delta).toBeCloseTo(1, 2);
    });

    it("call and put have same gamma", () => {
      expect(callG.gamma).toBeCloseTo(putG.gamma, 6);
    });

    it("call and put have same vega", () => {
      expect(callG.vega).toBeCloseTo(putG.vega, 6);
    });
  });

  describe("deep ITM call (S=150, K=100)", () => {
    const g = calculateGreeks(150, 100, T, r, v, true);

    it("delta is near 1", () => {
      expect(g.delta).toBeGreaterThan(0.95);
      expect(g.delta).toBeLessThanOrEqual(1);
    });
  });

  describe("deep OTM call (S=50, K=100)", () => {
    const g = calculateGreeks(50, 100, T, r, v, true);

    it("delta is near 0", () => {
      expect(g.delta).toBeGreaterThanOrEqual(0);
      expect(g.delta).toBeLessThan(0.05);
    });
  });

  describe("edge cases return all zeros", () => {
    const zero = { delta: 0, gamma: 0, theta: 0, vega: 0 };

    it("T = 0 (expired)", () => {
      expect(calculateGreeks(S, K, 0, r, v, true)).toEqual(zero);
    });

    it("T < 0", () => {
      expect(calculateGreeks(S, K, -0.1, r, v, true)).toEqual(zero);
    });

    it("v = 0 (zero volatility)", () => {
      expect(calculateGreeks(S, K, T, r, 0, true)).toEqual(zero);
    });

    it("S = 0", () => {
      expect(calculateGreeks(0, K, T, r, v, true)).toEqual(zero);
    });

    it("K = 0", () => {
      expect(calculateGreeks(S, 0, T, r, v, true)).toEqual(zero);
    });
  });

  describe("output precision", () => {
    const g = calculateGreeks(S, K, T, r, v, true);

    it("values are rounded to 6 decimal places", () => {
      // Each value should have at most 6 decimal places
      for (const key of ["delta", "gamma", "theta", "vega"] as const) {
        const parts = g[key].toString().split(".");
        if (parts.length === 2) {
          expect(parts[1].length).toBeLessThanOrEqual(6);
        }
      }
    });
  });
});
