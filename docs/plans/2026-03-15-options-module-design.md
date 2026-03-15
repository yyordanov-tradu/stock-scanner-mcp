# Options Data Module Design (Yahoo Finance)

**Goal:** Provide full options chains and calculated Greeks without requiring an API key.

## Data Source
- **Endpoint:** `https://query1.finance.yahoo.com/v7/finance/options/{SYMBOL}`
- **Authentication:** None (requires browser-like `User-Agent`).
- **Data Provided:** Strikes, Bid/Ask, Last Price, Volume, Open Interest, Implied Volatility.

## Greeks Calculation (Black-Scholes)
We will implement a `src/modules/options/greeks.ts` utility to calculate:
- **Delta:** Sensitivity to underlying price.
- **Gamma:** Sensitivity of Delta.
- **Theta:** Time decay.
- **Vega:** Sensitivity to volatility.
- **Max Pain:** The strike price where the most option contracts (in dollar value) expire worthless.

## Tools
1. `options_expirations`: Get all available expiration dates for a ticker.
2. `options_chain`: Get the full call/put chain for a specific ticker and expiration.
3. `options_max_pain`: Get the calculated Max Pain strike for an expiration.

## Implementation Details
- **Rate Limiting:** Use `TtlCache` to prevent excessive scraping.
- **Parallelism:** Fetch multiple expirations in parallel if requested.
- **Dependencies:** None. Pure TypeScript math for Greeks.

## Proposed `src/modules/options/greeks.ts`
```typescript
/**
 * Black-Scholes implementation for Greeks.
 * S: Underlying price
 * K: Strike price
 * T: Time to expiration (years)
 * r: Risk-free rate
 * v: Volatility (IV)
 */
export function calculateGreeks(S: number, K: number, T: number, r: number, v: number, isCall: boolean) {
  // ... implementation ...
}
```
