# DeepSeek Harness — kdqSoldier 个人 fork

本仓库 fork 自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（官方仓库），保留官方全部历史，仅叠加少量个人修改。安装与使用方式与官方一致，改动说明如下。

## 修改内容

### 聊天统计行显示估计费用（≈ ¥）

在 Web GUI 的聊天统计行（composer 上方）新增价格显示。原本显示：

```
5 轮 · 12 步 | LLM 2m30s | 缓存命中 90% | 输入 10.2K tok · 输出 3.4K tok
```

现在追加一组估计费用：

```
5 轮 · 12 步 | LLM 2m30s | 缓存命中 90% | 输入 10.2K tok · 输出 3.4K tok | ≈ ¥0.0041
```

**计价方式：**

- 按 token-meter 的四桶累加：未缓存输入 × 输入价 + 缓存命中 × 缓存价 + 缓存写入 × 缓存价 + 输出 × 输出价
- 价格表内置 DeepSeek V4 官方价目（deepseek-v4-flash / deepseek-v4-pro / deepseek-v4-flash-vision-exp），单位为「元 / 每百万 tokens」
- 支持峰谷计费：北京时间周一至周五 9:00–12:00、14:00–18:00 为高峰时段，价格按空闲时段的 2 倍计算；其余时间（含周末）为空闲时段
- 模型按会话中最新出现的模型名匹配（兼容 `DeepSeek-V4-Flash-0731`、`deepseek-v4-pro-0813` 等带日期后缀的命名）；未匹配到的模型按 deepseek-v4-flash 空闲价兜底
- 费用为估算展示，非账单；官方价格变动后请修改价格表

**涉及文件：**

| 文件 | 改动 |
|---|---|
| `packages/client/ui-conversation/src/client/chat/pricing.ts` | **新增**：价格表、峰谷时段判断、费用计算与金额格式化 |
| `packages/client/ui-conversation/src/client/chat/StatsLine.tsx` | 统计行追加价格组；新增 `newestModel()` 提取最新模型名 |
| `packages/client/ui-conversation/src/client/locales.ts` | 新增 `stats.cost` 文案（中/英） |
| `packages/client/ui-conversation/tests/chat-stats.client.spec.tsx` | 同步更新统计行断言 |
| `packages/client/ui-conversation/tests/chat-branch-tails.client.spec.tsx` | 同步更新统计行断言 |

## 修改价格

编辑 `packages/client/ui-conversation/src/client/chat/pricing.ts` 中的 `OFF_PEAK_PRICE_TABLE`：

```ts
'deepseek-v4-flash': {
  inputPrice: 1.5,          // 未缓存输入（元/百万 tokens，空闲时段）
  cacheReadPrice: 0.05,     // 缓存命中输入
  cacheWritePrice: 1.5,     // 缓存写入（DeepSeek 未单列，按未命中输入价估算）
  outputPrice: 4.5,         // 输出
},
```

高峰价自动等于空闲价 × 2，无需单独维护。

## 安装与使用

与官方一致：

```bash
git clone https://github.com/kdqSoldier/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm dsh web
```

改完 UI/价格相关源码后需重新构建：

```bash
pnpm run build:lib:client   # 客户端库（含价格表）
pnpm run build:web          # Web 产物
```

## 同步官方更新

origin 仍指向官方仓库，可随时合并官方新版本：

```bash
git fetch origin
git merge origin/master
```

## 主要提交

- `466679ed34` feat(ui-conversation): show estimated cost in chat stats line
