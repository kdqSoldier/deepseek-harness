/**
 * 按模型匹配的价格表（人民币 ¥ / 每百万 tokens）。
 *
 * 价格依据 DeepSeek 官方公告（2026-08 调价后 V4 系列），并区分空闲/高峰时段：
 *  - 高峰时段为北京时间周一至周五 9:00-12:00、14:00-18:00；
 *  - 空闲时段价格为高峰时段价格的一半。
 * 价格会随官方公告变动，仅用于估算展示，不是账单。请按官方最新公告核对：
 * https://api-docs.deepseek.com/quick_start/pricing/
 *
 * 计价口径与 DSH token-meter 的四桶一致：
 *  - uncachedInputTokens × inputPrice（缓存未命中输入）
 *  - cacheReadTokens    × cacheReadPrice（缓存命中输入）
 *  - cacheWriteTokens   × cacheWritePrice（缓存写入；DeepSeek 未单列，按未命中输入价估算）
 *  - outputTokens       × outputPrice（输出）
 */

export interface ModelPrice {
  /** 缓存未命中输入单价（¥ / 每百万 tokens） */
  inputPrice: number
  /** 缓存命中输入单价（¥ / 每百万 tokens） */
  cacheReadPrice: number
  /** 缓存写入单价（¥ / 每百万 tokens） */
  cacheWritePrice: number
  /** 输出单价（¥ / 每百万 tokens） */
  outputPrice: number
}

/** 空闲时段价目表（高峰价 = 空闲价 × 2）。 */
const OFF_PEAK_PRICE_TABLE: Readonly<Record<string, ModelPrice>> = {
  'deepseek-v4-flash': {
    inputPrice: 1.5,
    cacheReadPrice: 0.05,
    cacheWritePrice: 1.5,
    outputPrice: 4.5,
  },
  'deepseek-v4-pro': {
    inputPrice: 4.5,
    cacheReadPrice: 0.15,
    cacheWritePrice: 4.5,
    outputPrice: 13.5,
  },
  'deepseek-v4-flash-vision-exp': {
    inputPrice: 1.5,
    cacheReadPrice: 0.05,
    cacheWritePrice: 1.5,
    outputPrice: 4.5,
  },
}

/** 未匹配到价目表时使用的兜底价格（按 deepseek-v4-flash 空闲价）。 */
const FALLBACK_PRICE: ModelPrice = {
  inputPrice: 1.5,
  cacheReadPrice: 0.05,
  cacheWritePrice: 1.5,
  outputPrice: 4.5,
}

/**
 * 从模型 id 归一化为价格表查找键：取首段小写字母数字部分并去掉日期后缀，
 * 兼容 "deepseek-v4-flash"、"DeepSeek-V4-Flash-0731"、"deepseek-v4-pro-0813" 等命名。
 */
function priceKey(model: string | undefined): string {
  if (model === undefined) return ''
  const match = /^([a-z0-9_-]+?)(?:-\d{4,}|\.\d+)?$/i.exec(model.trim())
  if (match === null) return model.toLowerCase()
  return match[1]?.toLowerCase() ?? model.toLowerCase()
}

/**
 * 北京时间下当前是否处于高峰时段（周一至周五 9:00-12:00、14:00-18:00）。
 * @param now - 当前时间，默认系统时间。
 * @returns 高峰时段返回 true，空闲时段返回 false。
 */
export function isPeakHour(now: Date = new Date()): boolean {
  // 北京时间 = UTC+8
  const beijing = new Date(now.getTime() + 8 * 3600_000)
  const day = beijing.getUTCDay() // 0 = 周日
  if (day === 0 || day === 6) return false
  const minutes = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()
  return (minutes >= 9 * 60 && minutes < 12 * 60)
    || (minutes >= 14 * 60 && minutes < 18 * 60)
}

/**
 * 取某模型在当前时段的实际价格；未知模型用兜底价。
 * @param model - 模型 id，如 "deepseek-v4-flash"。
 * @param now - 当前时间，用于判断高峰/空闲，默认系统时间。
 */
export function modelPrice(model: string | undefined, now: Date = new Date()): ModelPrice {
  const base = OFF_PEAK_PRICE_TABLE[priceKey(model)] ?? FALLBACK_PRICE
  if (!isPeakHour(now)) return base
  // 高峰时段价格为空闲时段价格的两倍
  return {
    inputPrice: base.inputPrice * 2,
    cacheReadPrice: base.cacheReadPrice * 2,
    cacheWritePrice: base.cacheWritePrice * 2,
    outputPrice: base.outputPrice * 2,
  }
}

/**
 * 按 token-meter 四桶计算估计费用（元）。
 * @param uncachedInput - 未缓存输入 tokens。
 * @param cacheRead - 缓存命中读取 tokens。
 * @param cacheWrite - 缓存写入 tokens。
 * @param output - 输出 tokens。
 * @param price - 模型价格。
 * @returns 估计费用（元）。
 */
export function estimateCost(
  uncachedInput: number,
  cacheRead: number,
  cacheWrite: number,
  output: number,
  price: ModelPrice,
): number {
  return (
    uncachedInput * price.inputPrice
    + cacheRead * price.cacheReadPrice
    + cacheWrite * price.cacheWritePrice
    + output * price.outputPrice
  ) / 1_000_000
}

/**
 * 金额格式：按量级选择小数位（小金额更多位，避免显示成 0），去掉多余的尾零。
 *  - 小于 0.001 元：6 位小数
 *  - 小于 1 元：4 位小数
 *  - 否则：3 位小数
 * @param yuan - 金额（元）。
 * @returns 展示字符串，如 "0.000042"、"0.0123"、"1.25"。
 */
export function formatYuan(yuan: number): string {
  if (yuan === 0) return '0'
  const digits = yuan < 0.001 ? 6 : yuan < 1 ? 4 : 3
  return yuan.toFixed(digits).replace(/\.?0+$/, '')
}
