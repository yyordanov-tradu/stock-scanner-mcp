/**
 * Black-Scholes Greeks Implementation
 */

// Normal cumulative distribution function
function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let w = 1.0 - 1.0 / Math.sqrt(2.0 * Math.PI) * Math.exp(-L * L / 2.0) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));

  if (x < 0) {
    w = 1.0 - w;
  }
  return w;
}

// Probability density function
function pdf(x: number): number {
  return Math.exp(-x * x / 2.0) / Math.sqrt(2.0 * Math.PI);
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

/**
 * Calculates Greeks using Black-Scholes.
 * S: Underlying Price
 * K: Strike Price
 * T: Time to Expiration (in years, e.g. 30/365)
 * r: Risk-free interest rate (e.g. 0.05 for 5%)
 * v: Volatility (Implied Volatility, e.g. 0.25 for 20%)
 * isCall: True for Call, False for Put
 */
export function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  v: number,
  isCall: boolean
): Greeks {
  if (T <= 0 || v <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const d1 = (Math.log(S / K) + (r + v * v / 2.0) * T) / (v * Math.sqrt(T));
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
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(4)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(vega.toFixed(4)),
  };
}

/**
 * Calculates Max Pain strike for a given set of options.
 * Max Pain is the strike price where shareholders as a whole will lose the most money.
 */
export function calculateMaxPain(strikes: number[], calls: any[], puts: any[]): number {
  let minPain = Infinity;
  let maxPainStrike = strikes[0];

  for (const strike of strikes) {
    let currentPain = 0;
    
    // Sum pain for calls
    for (const call of calls) {
      if (call.strike < strike) {
        currentPain += (strike - call.strike) * (call.openInterest || 0);
      }
    }
    
    // Sum pain for puts
    for (const put of puts) {
      if (put.strike > strike) {
        currentPain += (put.strike - strike) * (put.openInterest || 0);
      }
    }

    if (currentPain < minPain) {
      minPain = currentPain;
      maxPainStrike = strike;
    }
  }

  return maxPainStrike;
}
