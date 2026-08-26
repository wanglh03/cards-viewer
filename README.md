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
- CDN：提供 `issuer-info.json`、卡面和发行方 logo 图片。

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

## 自动部署

项目部署到 Cloudflare。
