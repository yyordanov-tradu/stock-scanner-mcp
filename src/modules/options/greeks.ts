/**
 * Black-Scholes Greeks Implementation
 */

// Normal CDF — Abramowitz & Stegun approximation (26.2.17), max error 7.5e-8
function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let w = 1.0 - (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-L * L / 2.0) *
    (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) w = 1.0 - w;
  return w;
}

function pdf(x: number): number {
  return Math.exp(-x * x / 2.0) / Math.sqrt(2.0 * Math.PI);
}

export interface Greeks {
  delta: number;
  gamma: number;
  /** Daily theta — dollar change per calendar day */
  theta: number;
  /** Vega per 1 percentage-point IV move (market convention, raw B-S / 100) */
  vega: number;
}

/**
 * Calculates Greeks using Black-Scholes.
 * Returns { delta: 0, gamma: 0, theta: 0, vega: 0 } for invalid inputs.
 */
export function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  v: number,
  isCall: boolean,
): Greeks {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const d1 = (Math.log(S / K) + (r + (v * v) / 2.0) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  let delta: number;
  let theta: number;

  if (isCall) {
    delta = cnd(d1);
    theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2)) / 365;
  } else {
    delta = cnd(d1) - 1;
    theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2)) / 365;
  }

  const gamma = pdf(d1) / (S * v * Math.sqrt(T));
  const vega = (S * Math.sqrt(T) * pdf(d1)) / 100;

  return {
    delta: parseFloat(delta.toFixed(6)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(6)),
    vega: parseFloat(vega.toFixed(6)),
  };
}

export interface OptionForPain {
  strike: number;
  openInterest: number;
}

/**
 * Calculates max pain — the strike where total option holder payout is minimized.
 */
export function calculateMaxPain(
  strikes: number[],
  calls: OptionForPain[],
  puts: OptionForPain[],
): number {
  if (strikes.length === 0) return 0;

  let minPain = Infinity;
  let maxPainStrike = strikes[0];

  for (const candidate of strikes) {
    let pain = 0;
    for (const call of calls) {
      if (candidate > call.strike) {
        pain += (candidate - call.strike) * (call.openInterest ?? 0);
      }
    }
    for (const put of puts) {
      if (candidate < put.strike) {
        pain += (put.strike - candidate) * (put.openInterest ?? 0);
      }
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = candidate;
    }
  }

  return maxPainStrike;
}
