/**
 * Max Pain Calculator
 *
 * Computes the "max pain" strike price from open interest data.
 * Max pain is the strike price at which the total dollar value of
 * outstanding options (calls + puts) expiring in-the-money is minimized.
 */

export interface OptionContractInput {
  strike: number;
  optionType: string;
  openInterest: number;
}

export interface PainPoint {
  strike: number;
  callPain: number;
  putPain: number;
  totalPain: number;
}

export interface MaxPainResult {
  maxPainStrike: number;
  painCurve: PainPoint[];
}

export function calculateMaxPain(
  contracts: OptionContractInput[]
): MaxPainResult {
  if (contracts.length === 0) {
    return { maxPainStrike: 0, painCurve: [] };
  }

  const calls = contracts.filter(
    (c) => c.optionType.toLowerCase() === "call"
  );
  const puts = contracts.filter(
    (c) => c.optionType.toLowerCase() === "put"
  );

  const uniqueStrikes = [
    ...new Set(contracts.map((c) => c.strike)),
  ].sort((a, b) => a - b);

  const painCurve: PainPoint[] = uniqueStrikes.map((candidate) => {
    const callPain = calls.reduce((sum, call) => {
      if (candidate > call.strike) {
        return sum + (candidate - call.strike) * call.openInterest;
      }
      return sum;
    }, 0);

    const putPain = puts.reduce((sum, put) => {
      if (candidate < put.strike) {
        return sum + (put.strike - candidate) * put.openInterest;
      }
      return sum;
    }, 0);

    const totalPain = callPain + putPain;

    return {
      strike: candidate,
      callPain: Math.round(callPain * 100) / 100,
      putPain: Math.round(putPain * 100) / 100,
      totalPain: Math.round(totalPain * 100) / 100,
    };
  });

  const minPain = painCurve.reduce((min, point) =>
    point.totalPain < min.totalPain ? point : min
  );

  return {
    maxPainStrike: minPain.strike,
    painCurve,
  };
}
