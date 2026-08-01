# 卡面图鉴

基于 Cloudflare Workers 的银行卡片与发行方资料网站。项目使用 Node.js 构建静态页面，由 Cloudflare Worker 提供静态资源和短链接路由。

## 页面

- `index.html`：卡面图鉴主页，支持搜索、发行方/地区/卡组织/卡类型筛选、分页和图片大图查看。
- `my.html`：我的卡片。
- `credit.html`：现持信用卡。
- `bin.html`：卡 BIN 一览。
- `withdrawal.html`：取款手续费工具。
- `luhn.html`：卡号校验工具。

## 技术栈

- Node.js：本地构建和开发服务器。
- Cloudflare Worker：短链接路由和静态资源请求转发。
- CDN：提供 `issuer-info.json`、卡面和发行方 logo 图片。
- 静态 HTML、CSS、原生 JavaScript：无 Python 或旧前端框架依赖。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run types
```

- `npm run dev` 启动本地 Node.js 网站，并自动在默认浏览器中打开本地页面；静态页面从 CDN 读取 issuer 数据和图片。
- 在无头环境或自动化测试中，可设置 `OPEN_BROWSER=false` 禁止自动打开浏览器。
- `npm run build` 将页面和资源生成到 `dist/`。
- `npm run types` 根据 `wrangler.jsonc` 生成 Worker 类型声明。
- `npm run deploy` 仅用于手动部署；正常发布使用 Cloudflare Dashboard 的 Git 集成。

生产站点：

```text
https://cards.gtbro.vip
```

静态数据和卡面资源：

```text
https://cards-cdn.gtbro.vip/json/issuer-info.json
https://cards-cdn.gtbro.vip/issuers/
```

本地页面代码仍由本机提供，但 issuer 数据和卡面资源来自 CDN。

页面直接读取 CDN 中的 issuer 数据。

## Cloudflare 绑定

`wrangler.jsonc` 中使用以下绑定名称：

| 绑定     | 用途                          |
| -------- | ----------------------------- |
| `ASSETS` | 提供构建后的 `dist/` 静态资源 |

## 数据格式

生产环境的 `issuer-info.json` 存放在 CDN。卡面和发行方 logo 字段使用相对于地区/发行方目录的文件名：

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
        "altImage": "HSBC Mastercard Debit Back.png"
      }
    ]
  }
}
```

以上字段会解析为以下 CDN 路径：

```text
/issuers/HK/HSBC/HSBC.svg
/issuers/HK/HSBC/HSBC Mastercard Debit.png
/issuers/HK/HSBC/HSBC Mastercard Debit Back.png
```

`https://cards-cdn.gtbro.vip/json/mydata.json` 保存个人卡片数据，并按卡名与 CDN 的 issuer 数据合并。信用卡共享额度等账户信息放在对应发行方的 `issuer` 对象中，例如：

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

## 自动部署

项目部署到 Cloudflare。
