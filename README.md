# 卡面图鉴

基于 Cloudflare Workers 的银行卡片与发行方资料网站。项目使用 Node.js 构建静态页面，由 Cloudflare Worker 提供 KV、R2 和卡片编辑接口。

## 页面

- `index.html`：卡面图鉴主页，支持搜索、发行方/地区/卡组织/卡类型筛选、分页、图片大图查看和卡片编辑。
- `collection.html`：个人卡片收藏。
- `credit.html`：现持信用卡。
- `bin.html`：卡 BIN 一览。
- `withdrawal.html`：取款手续费工具。
- `luhn.html`：卡号校验工具。

## 技术栈

- Node.js：本地构建和开发服务器。
- Cloudflare Worker：请求路由、KV/R2 读取和卡片编辑接口。
- Cloudflare KV：保存 `issuer-info.json` 和 `changeLog.json`。
- Cloudflare R2：保存卡面与发行方 logo 图片。
- 静态 HTML、CSS、原生 JavaScript：无 Python 或旧前端框架依赖。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run types
```

- `npm run dev` 启动本地 Node.js 网站，并自动在默认浏览器中打开本地页面；同时读取线上 Worker 的 KV/R2 数据。
- 在无头环境或自动化测试中，可设置 `OPEN_BROWSER=false` 禁止自动打开浏览器。
- `npm run build` 将页面和资源生成到 `dist/`。
- `npm run types` 根据 `wrangler.jsonc` 生成 Worker 类型声明。
- `npm run deploy` 仅用于手动部署；正常发布使用 Cloudflare Dashboard 的 Git 集成。

本地开发默认读取：

```text
https://cards.gtbro.vip
```

如需切换数据 Worker 地址，可设置 `CARDS_VIEWER_DATA_ORIGIN`：

```powershell
$env:CARDS_VIEWER_DATA_ORIGIN = "https://example.workers.dev"
npm run dev
```

本地页面代码仍由本机提供，但 issuer 数据和 R2 图片来自云端。这样可以在不复制生产数据到仓库的情况下测试页面。

## Cloudflare 绑定

`wrangler.jsonc` 中使用以下绑定名称：

| 绑定 | 用途 |
| --- | --- |
| `KV` | 读取和更新 `issuer-info.json`、写入 `changeLog.json` |
| `R2` | 读取卡面和发行方 logo 图片 |
| `ASSETS` | 提供构建后的 `dist/` 静态资源 |

## 数据格式

生产环境的 `issuer-info.json` 存放在 KV 中。卡面和发行方 logo 字段使用相对于地区/发行方目录的文件名：

```json
{
  "HSBC": {
    "bank": {
      "region": "HK",
      "logo": "HSBC.svg"
    },
    "cards": [
      {
        "name": "HSBC Mastercard Debit",
        "image": "HSBC Mastercard Debit.png",
        "alt_image": "HSBC Mastercard Debit Back.png"
      }
    ]
  }
}
```

以上字段会解析为以下 R2 路径：

```text
/issuers/HK/HSBC/HSBC.svg
/issuers/HK/HSBC/HSBC Mastercard Debit.png
/issuers/HK/HSBC/HSBC Mastercard Debit Back.png
```

`assets/mycards/{地区}/{发行方}.json` 保存本地个人卡片数据，并按卡名与 KV 数据合并。信用卡共享额度等账户信息放在该文件的 `issuer` 对象中，例如：

```json
{
  "issuer": {
    "billing_day": "18",
    "due_day": "06",
    "limit": { "CNY": "25000" }
  },
  "cards": []
}
```

## 卡片编辑

主页编辑卡片会调用：

```text
PUT /api/issuer-info
```

保存前由 Cloudflare Turnstile 验证。Worker 需要配置 secret：

```text
TURNSTILE_SECRET
```

也兼容旧名称 `TURNSTILE_SECRET_KEY`。secret 只能通过 Cloudflare Dashboard 或 Wrangler secret 管理，不能提交到 Git。未配置时编辑接口会返回 `Turnstile is not configured`。

修改卡片名称时，Worker 会同步重命名 R2 中的卡面文件，并在 KV 的 `changeLog.json` 记录时间、IP、卡片、修改前后信息。

## 自动部署

项目使用 Cloudflare Dashboard 的 Workers Builds Git 集成：

1. 在 Worker 的 `Settings > Builds` 连接 GitHub 仓库。
2. 将生产分支设置为 `main`。
3. Build command：

   ```text
   npm install --no-audit --no-fund && npm run build
   ```

4. Deploy command：

   ```text
   npx wrangler deploy
   ```

以后推送到 `main` 即由 Cloudflare 自动构建和部署。不使用 GitHub Actions，也不需要 `CLOUDFLARE_API_TOKEN`。

## 忽略文件

构建产物、Node.js 依赖、Wrangler 本地状态、本地 secret、生成的类型文件和日志已写入 `.gitignore`。`wrangler.jsonc`、`config/`、`assets/`、`html/`、`css/`、`js/` 和 `worker/` 属于项目源文件，应提交到仓库。
