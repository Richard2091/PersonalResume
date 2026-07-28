# PersonalResume

PersonalResume 是一个基于 Markdown 的工程化简历模板项目，适合把个人简历当作代码长期维护。项目支持多版本简历、HTML 预览和 PDF 导出，拉取后只需要替换示例内容，就可以生成自己的简历。

## 功能

- 使用 Markdown 维护简历内容，降低排版和版本维护成本。
- 每个简历版本独立维护 `resume.md`、`index.html`、`resume.css`、`resume.pdf`。
- 使用统一 CSS 模板渲染 A4 简历，兼顾浏览器预览和打印导出。
- 构建时自动检查基础文件、HTML 结构、CSS 打印规则和 PDF 页数。
- 在简历最后一页页脚生成来源水印，链接到本开源模板仓库。

## 目录结构

```text
PersonalResume/
├── assets/
│   ├── fonts/              # 本地中文字体
│   └── icons/              # 渲染用图标资源
├── docs/
│   └── guide/              # Markdown 简历编写和发布说明
├── export/                 # 快捷 HTML 预览入口
├── scripts/                # 构建与检查脚本
├── styles/                 # 公共样式模板
├── versions/               # 多版本简历目录
├── resume.config.json      # 简历版本和构建配置
└── package.json
```

## 快速开始

安装依赖：

```bash
npm install
```

生成默认示例版本：

```bash
npm run build
```

检查当前产物：

```bash
npm run check
```

生成指定版本：

```bash
npm run build -- --version sample-java-backend
```

构建链路：

```text
resume.md
↓
index.html
↓
resume.pdf
```

生成 PDF 需要本机存在 Chromium 内核浏览器。脚本会优先读取 `RESUME_CHROME_PATH`，也会尝试从常见安装路径中查找 Chrome 或 Edge。

```bash
RESUME_CHROME_PATH=/path/to/chrome npm run build
```

## 修改成自己的简历

1. 复制 `versions/sample-java-backend/` 为新的版本目录，例如 `versions/my-resume/`。
2. 修改新目录中的 `resume.md`，替换姓名、联系方式、经历、项目和教育信息。
3. 在 `resume.config.json` 的 `versions` 下登记新版本，并按需修改 `defaultVersion`。
4. 运行 `npm run build -- --version my-resume` 生成 HTML 和 PDF。

建议版本目录使用稳定英文名，避免跨平台工具处理中文路径时出现兼容问题。

## 水印

构建脚本会在简历最后一页页脚居中生成浅色水印：

```text
本简历由 Richard2091/PersonalResume 生成
```

其中 `Richard2091/PersonalResume` 会带 GitHub 图标，并链接到公开仓库。相关配置位于 `resume.config.json` 的 `watermark` 字段。

## 路线图

- 支持在线网页管理多版本简历。
- 支持在线编辑 Markdown 并实时预览。
- 支持样式主题切换、字体配置和版式自定义。
- 支持 GitHub Pages 或其他静态站点自动发布。
- 支持导入导出不同投递场景的简历版本。

## 维护原则

- 根目录不放个人简历源文件，所有版本统一放在 `versions/` 下。
- 每个版本目录只维护本版本的内容和产物，不覆盖其他版本。
- `styles/` 存放公共样式模板，版本目录中的 `resume.css` 由构建脚本生成。
- `export/` 只作为快捷预览入口，不作为多版本主线输出目录。
- 公开仓库中不要提交真实个人隐私、投递材料、面试题库或内部项目证据。
