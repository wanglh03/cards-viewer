# cards-viewer

一个以静态站点形式部署的银行卡展示项目。

## 结构

- `assets/`: 卡面图片、机构数据
- `css/`: 页面样式
- `js/`: 页面逻辑与公共工具
- `build.py`: 静态站点构建脚本
- `dist/`: 构建产物目录，仅用于部署

## 构建方式

仓库当前使用 Python 生成部署产物：

```bash
python build.py deploy
```

构建完成后，部署 `dist/` 目录即可。

## 开发模式

```bash
python build.py dev
```

然后访问：

- `http://localhost:8000`

## 部署建议

适合直接部署到任意静态托管平台，例如：

- GitHub Pages
- Cloudflare Pages
- Vercel
- Nginx 静态目录

## Cloudflare Workers KV

Cloudflare Pages 部署时，卡片记录通过 Pages Function 从 Workers KV 读取。生产构建不会把 `assets/info/<region>/<issuer>.json` 或本地发行方图片复制到 `dist/`。

数据边界如下：

- Workers KV 的 `info.json` 只保存公开卡片数据库。
- `status`、`acquired`、`branch`、`virtual` 和 `limit`、`billing_day`、`due_day` 会从本地 JSON 提取到单独的 `local-data.js`，不写入 KV。
- `footerLinks`、`regions` 和 `binOverlays` 都是静态文件，不进入 KV。
- 每张卡片必须使用 `image` 作为卡面相对路径；`alt_image` 可选，卡面图鉴会优先显示它，不再使用 `ext`。
- 前端加载后自动合并公共数据和本地覆盖数据。

1. 在 Cloudflare Pages 项目的 **Settings → Functions → KV namespace bindings** 中添加绑定，变量名必须是 `CARDS_KV`。
2. 创建 KV namespace，并生成要上传的数据：

   ```bash
   python build.py kv
   ```

3. 将导出的数据写入 KV：

   ```bash
   powershell -ExecutionPolicy Bypass -File scripts/upload-kv.ps1 -NamespaceId <KV_NAMESPACE_ID> -Remote
   ```

4. 部署后访问 `/index.html` 查看卡面图鉴；个人收藏页为 `/collection.html`。

仓库中的 `functions/api/info.js` 提供 `/api/info`。如果使用 Pages 的 Git 集成，提交后会自动部署该 Function；如果只上传 `dist/` 静态目录，需要改用能同时部署 Pages Functions 的 Wrangler 部署流程。

## Cloudflare R2 卡面图片

卡面图片可以放入 R2。创建 bucket 并在 Pages 绑定变量名 `CARDS_IMAGES`：

```bash
npx wrangler r2 bucket create cards-viewer-images
```

然后上传本地卡面图片到 `issuers/<region>/<issuer>/`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/upload-r2.ps1 -Bucket cards-viewer-images
```

`functions/media/[[path]].js` 会从 R2 同源返回图片，并提供 `Content-Length`，图鉴页面据此显示图片大小；图片分辨率由浏览器读取图片实际尺寸。R2 未绑定时生产图片不会正常显示，因此需要先完成绑定再部署。

KV 更新后无需重新构建网站，刷新页面即可读取最新卡片数据。前端不再从本地 `assets/info` 读取公共卡片数据；本地测试需要使用能连接 Pages Function 和远程 KV 的 Pages/Wrangler 开发服务。个人持有信息由 `assets/mycards/<region>/<issuer>.json` 构建到本地覆盖数据中。

## build.py

- `build.py`：构建编排和命令行入口。
- `pages.py`：HTML、Markdown、文档页、短链接页面生成。
- `config.py`：路径和构建配置。
- `data.py`：银行数据、配置和短链接读取。
- `utils.py`：文件和目录操作。
- `server.py`：开发服务器和文件监听。
