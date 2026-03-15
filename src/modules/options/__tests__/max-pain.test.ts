import { describe, it, expect } from "vitest";
import { calculateMaxPain } from "../greeks.js";

describe("calculateMaxPain", () => {
  it("symmetric OI returns max pain at middle strike", () => {
    const strikes = [90, 95, 100, 105, 110];
    const calls = [
      { strike: 90, openInterest: 100 },
      { strike: 95, openInterest: 100 },
      { strike: 100, openInterest: 100 },
      { strike: 105, openInterest: 100 },
      { strike: 110, openInterest: 100 },
    ];
    const puts = [
      { strike: 90, openInterest: 100 },
      { strike: 95, openInterest: 100 },
      { strike: 100, openInterest: 100 },
      { strike: 105, openInterest: 100 },
      { strike: 110, openInterest: 100 },
    ];

    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(100);
  });

  it("all calls, no puts → max pain at lowest strike", () => {
    const strikes = [90, 95, 100, 105, 110];
    const calls = [
      { strike: 90, openInterest: 500 },
      { strike: 95, openInterest: 500 },
      { strike: 100, openInterest: 500 },
      { strike: 105, openInterest: 500 },
      { strike: 110, openInterest: 500 },
    ];
    const puts: { strike: number; openInterest: number }[] = [];

    // When only calls exist, pain = sum of max(0, candidate - strike) * OI for each call.
    // At candidate=90 (lowest), all calls have strike >= 90, so pain from calls at 90 is 0.
    // This is the minimum pain point.
    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(90);
  });

  it("all puts, no calls → max pain at highest strike", () => {
    const strikes = [90, 95, 100, 105, 110];
    const calls: { strike: number; openInterest: number }[] = [];
    const puts = [
      { strike: 90, openInterest: 500 },
      { strike: 95, openInterest: 500 },
      { strike: 100, openInterest: 500 },
      { strike: 105, openInterest: 500 },
      { strike: 110, openInterest: 500 },
    ];

    // When only puts exist, pain = sum of max(0, strike - candidate) * OI for each put.
    // At candidate=110 (highest), all puts have strike <= 110, so pain from puts at 110 is 0.
    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(110);
  });

  it("empty strikes returns 0", () => {
    const result = calculateMaxPain([], [], []);
    expect(result).toBe(0);
  });

  it("zero OI everywhere returns first strike", () => {
    const strikes = [90, 95, 100, 105, 110];
    const calls = strikes.map(s => ({ strike: s, openInterest: 0 }));
    const puts = strikes.map(s => ({ strike: s, openInterest: 0 }));

    // All candidates have pain = 0, so the first one that achieves min (< Infinity) wins.
    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(90);
  });

  it("heavy OI at one strike pulls max pain toward it", () => {
    const strikes = [90, 95, 100, 105, 110];
    const calls = [
      { strike: 105, openInterest: 10000 },
    ];
    const puts = [
      { strike: 95, openInterest: 10000 },
    ];

    // At candidate 95: call pain 0 (95 < 105), put pain 0 (95 not < 95) → total 0
    // At candidate 100: call pain 0 (100 < 105), put pain 0 (100 not < 95) → total 0
    // Both 95-105 give pain=0; algorithm picks first encountered (95)
    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(95);
  });

  it("single strike returns that strike", () => {
    const strikes = [100];
    const calls = [{ strike: 100, openInterest: 500 }];
    const puts = [{ strike: 100, openInterest: 500 }];

    expect(calculateMaxPain(strikes, calls, puts)).toBe(100);
  });
});
