# 简历版本目录

每个子目录代表一个可独立维护的简历版本。

## 版本目录规范

```text
版本目录/
├── resume.md
├── index.html
├── resume.css
└── resume.pdf
```

- `resume.md`：该版本的 Markdown 内容源。
- `index.html`：该版本的 HTML 渲染结果，可直接用浏览器打开预览。
- `resume.css`：该版本的独立样式文件，由构建脚本从公共样式模板复制生成。
- `resume.pdf`：该版本的 PDF 导出结果。

## 当前示例版本

- `sample-java-backend/`：Java 后端开发工程师示例简历。

## 新增版本建议

新增版本时使用稳定英文目录名，例如：

- `my-resume/`：个人默认版本。
- `java-backend-compact/`：精简投递版。
- `java-backend-depth/`：技术深度版。
- `backend-lead/`：后端负责人倾向版。

每个版本的 HTML 只引用同目录 `resume.css`，不要引用其他版本的 CSS。版本 CSS 引用公共字体时使用 `../../assets/fonts/`，不要在每个版本目录重复复制字体。

新增版本接入一键构建时，需要在根目录 `resume.config.json` 的 `versions` 下登记版本名和页面标题。构建命令会读取该版本目录下的 `resume.md`，复制公共样式模板为当前版本 `resume.css`，再生成 `index.html` 和 `resume.pdf`。
