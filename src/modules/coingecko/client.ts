import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 60 * 1000; // 1 minute

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChangePercent: number;
  description: string;
}

export async function getCoinDetail(coinId: string): Promise<CoinDetail> {
  const cacheKey = `coin:${coinId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CoinDetail;

  const data = await httpGet<{
    id: string;
    symbol: string;
    name: string;
    market_data: {
      current_price: { usd: number };
      market_cap: { usd: number };
      price_change_24h: number;
      price_change_percentage_24h: number;
      total_volume: { usd: number };
      high_24h: { usd: number };
      low_24h: { usd: number };
      ath: { usd: number };
      ath_change_percentage: { usd: number };
    };
    description: { en: string };
  }>(`${BASE_URL}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`);

  const coin: CoinDetail = {
    id: data.id,
    symbol: data.symbol,
    name: data.name,
    currentPrice: data.market_data.current_price.usd,
    marketCap: data.market_data.market_cap.usd,
    priceChange24h: data.market_data.price_change_24h,
    priceChangePercent24h: data.market_data.price_change_percentage_24h,
    totalVolume: data.market_data.total_volume.usd,
    high24h: data.market_data.high_24h.usd,
    low24h: data.market_data.low_24h.usd,
    ath: data.market_data.ath.usd,
    athChangePercent: data.market_data.ath_change_percentage.usd,
    description: (data.description.en || "").slice(0, 500),
  };

  cache.set(cacheKey, coin);
  return coin;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number;
  priceBtc: number;
  score: number;
}

export async function getTrending(): Promise<TrendingCoin[]> {
  const cacheKey = "trending";
  const cached = cache.get(cacheKey);
  if (cached) return cached as TrendingCoin[];

  const data = await httpGet<{
    coins: Array<{
      item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
        price_btc: number;
        score: number;
      };
    }>;
  }>(`${BASE_URL}/search/trending`);

  const trending: TrendingCoin[] = data.coins.map((c) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    marketCapRank: c.item.market_cap_rank,
    priceBtc: c.item.price_btc,
    score: c.item.score,
  }));

  cache.set(cacheKey, trending);
  return trending;
}

export interface GlobalData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  marketCapChangePercent24h: number;
}

export async function getGlobal(): Promise<GlobalData> {
  const cacheKey = "global";
  const cached = cache.get(cacheKey);
  if (cached) return cached as GlobalData;

  const data = await httpGet<{
    data: {
      total_market_cap: { usd: number };
      total_volume: { usd: number };
      market_cap_percentage: { btc: number; eth: number };
      active_cryptocurrencies: number;
      market_cap_change_percentage_24h_usd: number;
    };
  }>(`${BASE_URL}/global`);

  const global: GlobalData = {
    totalMarketCap: data.data.total_market_cap.usd,
    totalVolume24h: data.data.total_volume.usd,
    btcDominance: data.data.market_cap_percentage.btc,
    ethDominance: data.data.market_cap_percentage.eth,
    activeCryptocurrencies: data.data.active_cryptocurrencies,
    marketCapChangePercent24h: data.data.market_cap_change_percentage_24h_usd,
  };

  cache.set(cacheKey, global);
  return global;
}
