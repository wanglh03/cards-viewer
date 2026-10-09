# 卡面图鉴

基于 Cloudflare Workers 的银行卡片与发行方资料网站。前端使用 Vite 构建，由 Cloudflare Worker 提供静态资源、数据代理和短链接路由。

## 页面

- `/`：卡面图鉴主页，支持搜索、卡组织/卡类型筛选、分页和图片大图查看。
- `/my`：我的卡片。
- `/credit`：现持信用卡。
- `/bin`：卡 BIN 一览。
- `/withdrawal`：取款手续费工具。
- `/luhn`：卡号校验工具。

## 技术栈

- Vite + React + TypeScript：统一的前端入口和类型安全的组件架构。
- Tailwind CSS：实用类样式与共享设计令牌。
- MDX：文档内容可组合为 React 页面。
- Motion + lucide-react：开源动画和图标组件。
- Cloudflare Worker：短链接路由和静态资源请求转发。
- CDN：提供各页面专属 JSON、卡面和发行方 logo 图片。

## 目录结构

```text
src/
  app/           应用入口、页面路由、全局样式
  components/    可复用 UI 组件
  features/      可独立拆分的业务功能模块
  lib/           数据加载、类型和通用工具
  content/docs/  MDX 文档内容
public/assets/   原样复制到构建产物的静态资源
src/config/      站点导航、地区、页脚和短链接配置
worker/          Cloudflare Worker
```

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run types
```

也可以使用 pnpm：

```bash
pnpm install
pnpm dev
```

- `npm run dev` 或 `pnpm dev` 启动 Vite 开发服务器，地址为 `http://127.0.0.1:5173`；页面从 CDN 读取 issuer 数据和图片。
- `npm run build` 将 Vite 应用生成到 `dist/`。
- `npm run preview` 预览生产构建。
- `npm run types` 根据 `wrangler.jsonc` 生成 Worker 类型声明。
- `npm run deploy` 构建并部署 Cloudflare Worker 及其 Static Assets。Cloudflare Dashboard 中应使用 Workers 项目，不要将此项目按 Pages 目录部署。

页面通过同站 `/json/*.json` 请求专属数据，生产环境由 Worker 转发到 CDN，开发环境由 Vite 代理。

## Cloudflare 绑定

`wrangler.jsonc` 中使用以下绑定名称：

| 绑定     | 用途                          |
| -------- | ----------------------------- |
| `ASSETS` | 提供构建后的 `dist/` 静态资源 |

## 数据格式

| 页面          | 文件              |
| ------------- | ----------------- |
| `/`           | `gallery.json`    |
| `/bin`        | `bin.json`        |
| `/withdrawal` | `withdrawal.json` |
| `/my`         | `my.json`         |
| `/wallet`     | `wallet.json`     |
| `/collection` | `collection.json` |
| `/credit`     | `credit.json`     |
| `/myissuers`  | `myissuers.json`  |

卡片页共享发行方索引，卡片仅包含该页使用的非空字段。个人信息合并、信用卡筛选和 BIN 标签匹配在生成阶段完成。`collection.json` 直接保存发行方收集状态，`myissuers.json` 保存按卡类型分组的激活卡统计。

卡片页格式示例：

```json
{
  "issuers": [
    {
      "key": "HSBC",
      "name": "香港上海滙豐銀行",
      "region": "HK",
      "logo": "HSBC.svg",
      "imageFolder": "issuers/HK/HSBC/"
    }
  ],
  "cards": [
    {
      "issuer": 0,
      "name": "HSBC Mastercard Debit",
      "image": "HSBC Mastercard Debit.png"
    }
  ]
}
```

以上字段会解析为以下 CDN 路径：

```text
/issuers/logo/HSBC.svg
/issuers/HK/HSBC/HSBC Mastercard Debit.png
```
