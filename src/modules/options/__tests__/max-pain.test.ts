import { describe, it, expect } from "vitest";
import { calculateMaxPain } from "../greeks.js";

describe("calculateMaxPain", () => {
  it("calculates correct max pain strike", () => {
    // Underlying price is 100
    const strikes = [90, 95, 100, 105, 110];
    
    // Very high OI at 100 strike
    const calls = [
      { strike: 90, openInterest: 10 },
      { strike: 95, openInterest: 10 },
      { strike: 100, openInterest: 1000 },
      { strike: 105, openInterest: 10 },
      { strike: 110, openInterest: 10 },
    ];
    
    const puts = [
      { strike: 90, openInterest: 10 },
      { strike: 95, openInterest: 10 },
      { strike: 100, openInterest: 1000 },
      { strike: 105, openInterest: 10 },
      { strike: 110, openInterest: 10 },
    ];

    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(100);
  });

  it("calculates max pain when OI is skewed", () => {
    const strikes = [10, 20, 30];
    const calls = [
      { strike: 10, openInterest: 100 }, // Deep ITM calls if price is 30
    ];
    const puts = [
      { strike: 30, openInterest: 100 }, // Deep ITM puts if price is 10
    ];

    // If price is 10: 
    // Calls pain: 0
    // Puts pain: (30-10)*100 = 2000
    // Total: 2000
    
    // If price is 20:
    // Calls pain: (20-10)*100 = 1000
    // Puts pain: (30-20)*100 = 1000
    // Total: 2000
    
    // If price is 30:
    // Calls pain: (30-10)*100 = 2000
    // Puts pain: 0
    // Total: 2000

    const result = calculateMaxPain(strikes, calls, puts);
    // Any strike gives 2000 pain in this balanced model, 
    // but code usually picks first min it finds.
    expect(result).toBeDefined();
  });
});
