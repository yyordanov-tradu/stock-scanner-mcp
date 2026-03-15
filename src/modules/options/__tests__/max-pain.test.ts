import { describe, it, expect } from "vitest";
import {
  calculateMaxPain,
  type OptionContractInput,
} from "../max-pain.js";

function makeContract(
  strike: number,
  optionType: string,
  openInterest: number
): OptionContractInput {
  return { strike, optionType, openInterest };
}

describe("calculateMaxPain", () => {
  it("finds max pain at the strike with minimum total payout", () => {
    // Heavy call OI at 95 → calls hurt when price is above 95
    // Heavy put OI at 105 → puts hurt when price is below 105
    // Max pain should land at 100 where total pain is minimized
    const contracts: OptionContractInput[] = [
      makeContract(95, "call", 1000),
      makeContract(100, "call", 200),
      makeContract(105, "call", 100),
      makeContract(95, "put", 100),
      makeContract(100, "put", 200),
      makeContract(105, "put", 1000),
    ];

    const result = calculateMaxPain(contracts);
    expect(result.maxPainStrike).toBe(100);
    expect(result.painCurve.length).toBe(3);

    // Verify the pain at strike 100 is indeed the minimum
    const painAt100 = result.painCurve.find((p) => p.strike === 100)!;
    for (const point of result.painCurve) {
      expect(point.totalPain).toBeGreaterThanOrEqual(painAt100.totalPain);
    }
  });

  it("handles all calls, no puts", () => {
    // With only calls, max pain is at the highest strike where all calls
    // expire worthless (i.e., candidate >= all call strikes → callPain is
    // maximized at low strikes, minimized at highest strike)
    const contracts: OptionContractInput[] = [
      makeContract(90, "call", 500),
      makeContract(95, "call", 300),
      makeContract(100, "call", 200),
    ];

    const result = calculateMaxPain(contracts);
    // At strike 100: callPain = (100-90)*500 + (100-95)*300 = 6500
    // At strike 95:  callPain = (95-90)*500 = 2500
    // At strike 90:  callPain = 0
    // With no puts, min total pain is at the lowest strike (90)
    // Wait — at the highest strike all calls are ITM, pain is maximum.
    // At the lowest strike (90), no calls are ITM, pain = 0.
    expect(result.maxPainStrike).toBe(90);
    expect(result.painCurve.find((p) => p.strike === 90)!.totalPain).toBe(0);
  });

  it("handles empty contracts array", () => {
    const result = calculateMaxPain([]);
    expect(result.maxPainStrike).toBe(0);
    expect(result.painCurve).toEqual([]);
  });

  it("handles contracts with zero open interest", () => {
    const contracts: OptionContractInput[] = [
      makeContract(100, "call", 0),
      makeContract(105, "call", 0),
      makeContract(100, "put", 0),
      makeContract(105, "put", 0),
    ];

    const result = calculateMaxPain(contracts);
    // All pain values should be 0
    for (const point of result.painCurve) {
      expect(point.totalPain).toBe(0);
    }
    // maxPainStrike should be the first strike (all tied at 0)
    expect(result.painCurve.length).toBe(2);
  });

  it("returns pain curve sorted by strike ascending", () => {
    // Provide contracts in non-sorted order
    const contracts: OptionContractInput[] = [
      makeContract(110, "call", 100),
      makeContract(90, "put", 100),
      makeContract(100, "call", 200),
      makeContract(95, "put", 300),
      makeContract(105, "call", 50),
    ];

    const result = calculateMaxPain(contracts);
    const strikes = result.painCurve.map((p) => p.strike);
    const sorted = [...strikes].sort((a, b) => a - b);
    expect(strikes).toEqual(sorted);
  });
});
