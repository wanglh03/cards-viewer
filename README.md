# cards-viewer

一个以静态站点形式部署的银行卡展示项目。仓库中的源数据放在 `assets/` 下维护，在构建阶段预生成一个聚合数据文件，再输出完整的 `dist/` 站点。

## 结构

- `assets/`: 卡面图片、机构数据、推荐数据
- `css/`: 页面样式
- `js/`: 页面逻辑与公共工具
- `build.py`: 静态站点构建脚本
- `dist/`: 构建产物目录，仅用于部署

## 构建方式

仓库当前使用 Python 生成部署产物：

```bash
python build.py
```

构建完成后，部署 `dist/` 目录即可。

## 本地预览

构建后可以在 `dist/` 下启动一个静态服务器，例如：

```bash
python -m http.server 8000 --directory dist
```

然后访问：

- `http://localhost:8000`

## 数据维护

1. 在 `assets/manifest.json` 中维护机构列表
2. 在对应机构目录下维护 `data.json` 和卡面图片
3. 在 `assets/referral.json` 中维护开户邀请信息
4. 修改完后重新运行 `python build.py`

## 部署建议

适合直接部署到任意静态托管平台，例如：

- GitHub Pages
- Cloudflare Pages
- Vercel
- Nginx 静态目录
