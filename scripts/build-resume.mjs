import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import MarkdownIt from "markdown-it";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(projectRoot, "resume.config.json");

/**
 * 执行简历构建或检查命令。
 *
 * @return {Promise<void>}
 */
async function main() {
  // 读取命令参数
  const command = process.argv[2] || "build";
  const version = readOption("version");
  const config = readJson(configPath);
  const targetVersion = version || config.defaultVersion;
  const context = createContext(config, targetVersion);

  if (command === "build") {
    await buildResume(context);
    return;
  }

  if (command === "check") {
    await checkResume(context);
    return;
  }

  throw new Error(`未知命令：${command}`);
}

/**
 * 读取命令行中的指定选项。
 *
 * @param {string} name 选项名称
 * @return {string | undefined}
 */
function readOption(name) {
  // 查找 --name value 或 --name=value 格式参数
  const flag = `--${name}`;
  const pair = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (pair) {
    return pair.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
}

/**
 * 读取 JSON 配置文件。
 *
 * @param {string} filePath 配置文件路径
 * @return {Record<string, any>}
 */
function readJson(filePath) {
  // 读取并解析配置内容
  return JSON.parse(readUtf8Text(filePath));
}

/**
 * 读取 UTF-8 文本并兼容 BOM。
 *
 * @param {string} filePath 文件路径
 * @return {string}
 */
function readUtf8Text(filePath) {
  // 读取 UTF-8 文本，去掉开头 BOM
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

/**
 * 创建当前版本的构建上下文。
 *
 * @param {Record<string, any>} config 全局配置
 * @param {string} version 版本名称
 * @return {Record<string, any>}
 */
function createContext(config, version) {
  // 校验版本配置
  const versionConfig = config.versions?.[version];
  if (!versionConfig) {
    throw new Error(`未找到版本配置：${version}`);
  }

  const versionDir = path.join(projectRoot, "versions", version);

  // 返回构建所需路径
  return {
    config,
    version,
    versionConfig,
    versionDir,
    sourcePath: path.join(versionDir, "resume.md"),
    htmlPath: path.join(versionDir, "index.html"),
    cssPath: path.join(versionDir, "resume.css"),
    pdfPath: path.join(versionDir, "resume.pdf"),
    cssTemplatePath: path.join(projectRoot, config.cssTemplate),
    exportHtmlPath: versionConfig.exportHtml
      ? path.join(projectRoot, versionConfig.exportHtml)
      : undefined
  };
}

/**
 * 构建指定版本的 HTML、CSS 和 PDF。
 *
 * @param {Record<string, any>} context 构建上下文
 * @return {Promise<void>}
 */
async function buildResume(context) {
  // 校验输入文件和运行环境
  ensureBuildInputs(context);
  const browserPath = findBrowserPath(context.config);

  // 复制当前版本样式，并修正版本目录中的公共资源路径
  writeVersionCss(context);

  // 生成初版 HTML
  const markdown = readUtf8Text(context.sourcePath);
  let html = renderResumeHtml(markdown, {
    title: context.versionConfig.title,
    cssHref: "resume.css",
    watermark: context.config.watermark,
    watermarkTopPx: 0,
    pageBreakBlocks: new Set()
  });
  fs.writeFileSync(context.htmlPath, html, "utf8");

  // 根据打印布局优化分页，再重新写入 HTML
  const pageBreakBlocks = await planPageBreaks(context.htmlPath, browserPath);
  html = renderResumeHtml(markdown, {
    title: context.versionConfig.title,
    cssHref: "resume.css",
    watermark: context.config.watermark,
    watermarkTopPx: 0,
    pageBreakBlocks
  });
  fs.writeFileSync(context.htmlPath, html, "utf8");

  // 测量最后一页坐标，将水印定位到页脚位置
  const watermarkTopPx = await planWatermarkPosition(context.htmlPath, browserPath);
  html = renderResumeHtml(markdown, {
    title: context.versionConfig.title,
    cssHref: "resume.css",
    watermark: context.config.watermark,
    watermarkTopPx,
    pageBreakBlocks
  });
  fs.writeFileSync(context.htmlPath, html, "utf8");

  // 生成兼容预览入口
  if (context.exportHtmlPath) {
    const exportHtml = renderResumeHtml(markdown, {
      title: context.versionConfig.title,
      cssHref: "../styles/resume-single-column.css",
      watermark: context.config.watermark,
      watermarkTopPx,
      pageBreakBlocks
    });
    fs.writeFileSync(context.exportHtmlPath, exportHtml, "utf8");
  }

  // 导出 PDF 并执行产物检查
  await writePdf(context.htmlPath, context.pdfPath, browserPath, context.config.pdf);
  await checkResume(context);

  console.log(`已生成 ${path.relative(projectRoot, context.htmlPath)}`);
  console.log(`已生成 ${path.relative(projectRoot, context.pdfPath)}`);
  if (context.exportHtmlPath) {
    console.log(`已生成 ${path.relative(projectRoot, context.exportHtmlPath)}`);
  }
}

/**
 * 检查当前版本的输入、环境和生成产物。
 *
 * @param {Record<string, any>} context 构建上下文
 * @return {Promise<void>}
 */
async function checkResume(context) {
  // 校验基础文件
  ensureFile(context.sourcePath, "Markdown 内容源不存在");
  ensureFile(context.cssTemplatePath, "样式模板不存在");
  ensureFile(path.join(projectRoot, "assets", "fonts", "NotoSansSC-Regular.otf"), "常规中文字体不存在");
  ensureFile(path.join(projectRoot, "assets", "fonts", "NotoSansSC-Medium.otf"), "中等字重中文字体不存在");
  ensureFile(path.join(projectRoot, "assets", "fonts", "NotoSansSC-Bold.otf"), "粗体中文字体不存在");
  findBrowserPath(context.config);

  // 校验 HTML 产物
  ensureFile(context.htmlPath, "HTML 产物不存在");
  const html = fs.readFileSync(context.htmlPath, "utf8");
  assertIncludes(html, "<article class=\"resume\"", "HTML 缺少简历根容器");
  assertIncludes(html, "class=\"resume-header\"", "HTML 缺少头部结构");
  assertIncludes(html, "class=\"section-block\"", "HTML 缺少模块结构");
  assertIncludes(html, "class=\"entry-block", "HTML 缺少条目分页结构");
  assertIncludes(html, "rel=\"stylesheet\" href=\"resume.css", "HTML 未引用同目录 resume.css");
  assertIncludes(html, "class=\"resume-watermark\"", "HTML 缺少页脚水印");

  // 校验 CSS 打印分页规则
  ensureFile(context.cssPath, "版本样式文件不存在");
  const css = fs.readFileSync(context.cssPath, "utf8");
  assertIncludes(css, "@page", "CSS 缺少 A4 页面规则");
  assertIncludes(css, "@media print", "CSS 缺少打印规则");
  assertIncludes(css, "break-inside: avoid", "CSS 缺少分页防割裂规则");
  assertIncludes(css, ".entry-block", "CSS 缺少条目分页样式");

  // 校验 PDF 产物
  ensureFile(context.pdfPath, "PDF 产物不存在");
  const pdf = fs.readFileSync(context.pdfPath);
  if (!pdf.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw new Error("PDF 文件头无效");
  }
  if (pdf.length < 100 * 1024) {
    throw new Error(`PDF 文件过小，可能导出失败：${pdf.length} bytes`);
  }
  const pageCount = await readPdfPageCount(pdf);
  const minPdfPages = context.versionConfig.minPdfPages ?? 1;
  if (pageCount < minPdfPages) {
    throw new Error(`PDF 页数异常：当前 ${pageCount} 页，期望至少 ${minPdfPages} 页`);
  }

  console.log(`检查通过，PDF 共 ${pageCount} 页`);
}

/**
 * 读取 PDF 页数。
 *
 * @param {Buffer} pdf PDF 文件内容
 * @return {Promise<number>}
 */
async function readPdfPageCount(pdf) {
  // 解析 PDF 结构并返回页面数量
  const document = await PDFDocument.load(pdf, { ignoreEncryption: true });
  return document.getPageCount();
}

/**
 * 校验构建所需输入。
 *
 * @param {Record<string, any>} context 构建上下文
 * @return {void}
 */
function ensureBuildInputs(context) {
  // 确认源文件和目标目录可用
  ensureFile(context.sourcePath, "Markdown 内容源不存在");
  ensureFile(context.cssTemplatePath, "样式模板不存在");
  fs.mkdirSync(context.versionDir, { recursive: true });
  if (context.exportHtmlPath) {
    fs.mkdirSync(path.dirname(context.exportHtmlPath), { recursive: true });
  }
}

/**
 * 写入当前版本样式文件。
 *
 * @param {Record<string, any>} context 构建上下文
 * @return {void}
 */
function writeVersionCss(context) {
  // 将公共样式模板中的资源路径改为版本目录相对路径
  const css = readUtf8Text(context.cssTemplatePath)
    .replaceAll("../assets/", "../../assets/");
  fs.writeFileSync(context.cssPath, css, "utf8");
}

/**
 * 将 Markdown 简历渲染为项目约定的 HTML。
 *
 * @param {string} markdown Markdown 文本
 * @param {{title: string, cssHref: string, watermark?: Record<string, string>, watermarkTopPx?: number, pageBreakBlocks: Set<string>}} options 渲染选项
 * @return {string}
 */
function renderResumeHtml(markdown, options) {
  // 解析 Markdown token
  const normalizedMarkdown = normalizeProjectMetaMarkdown(markdown);
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    breaks: true
  });
  const tokens = md.parse(normalizedMarkdown, {});
  const firstH1 = findHeading(tokens, "h1", 0);
  if (firstH1 === undefined) {
    throw new Error("Markdown 必须以一级标题作为姓名");
  }

  // 生成头部信息
  const titleText = escapeHtml(tokens[firstH1 + 1].content);
  const firstSectionIndex = findHeading(tokens, "h2", firstH1 + 3) ?? tokens.length;
  const headerHtml = renderHeader(md, tokens.slice(firstH1 + 3, firstSectionIndex), titleText);

  // 生成主体模块
  const bodyHtml = renderSections(md, tokens, firstSectionIndex, options.pageBreakBlocks);
  const watermarkTopPx = Math.max(0, Math.round(options.watermarkTopPx || 0));
  const resumeStyle = options.watermark
    ? ` style="--resume-watermark-top: ${watermarkTopPx}px;"`
    : "";
  const watermarkHtml = renderWatermark(options.watermark);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <link rel="stylesheet" href="${escapeAttribute(options.cssHref)}" />
</head>
<body>
  <article class="resume"${resumeStyle}>
${headerHtml}
${bodyHtml}
${watermarkHtml}
  </article>
</body>
</html>
`;
}

/**
 * 渲染简历最后一页的生成来源水印。
 *
 * @param {Record<string, string> | undefined} watermark 水印配置
 * @return {string}
 */
function renderWatermark(watermark) {
  // 校验水印配置完整性
  if (!watermark?.text || !watermark?.repository || !watermark?.url) {
    return "";
  }

  // 返回可点击的仓库来源链接
  return `<footer class="resume-watermark" aria-label="简历生成来源"><span>${escapeHtml(watermark.text)}</span><a class="resume-watermark-repository" href="${escapeAttribute(watermark.url)}" target="_blank" rel="noopener noreferrer">${renderGithubIcon()}<span>${escapeHtml(watermark.repository)}</span></a><span>${escapeHtml(watermark.suffix || "")}</span></footer>`;
}

/**
 * 渲染 GitHub 图标。
 *
 * @return {string}
 */
function renderGithubIcon() {
  // 使用行内 SVG，避免打印导出时 CSS mask 兼容问题
  return `<svg class="resume-watermark-icon" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false"><path d="M498.894518 100.608396c-211.824383 0-409.482115 189.041494-409.482115 422.192601 0 186.567139 127.312594 344.783581 295.065226 400.602887 21.13025 3.916193 32.039717-9.17701 32.039717-20.307512 0-10.101055 1.176802-43.343157 1.019213-78.596056-117.448946 25.564235-141.394311-49.835012-141.394311-49.835012-19.225877-48.805566-46.503127-61.793368-46.503127-61.793368-38.293141-26.233478 3.13848-25.611308 3.13848-25.611308 42.361807 2.933819 64.779376 43.443441 64.779376 43.443441 37.669948 64.574714 98.842169 45.865607 122.912377 35.094286 3.815909-27.262924 14.764262-45.918819 26.823925-56.431244-93.796246-10.665921-192.323237-46.90017-192.323237-208.673623 0-46.071292 16.498766-83.747379 43.449581-113.332185-4.379751-10.665921-18.805298-53.544497 4.076852-111.732757 0 0 35.46063-11.336186 116.16265 43.296085 33.653471-9.330506 69.783343-14.022365 105.654318-14.174837 35.869952 0.153496 72.046896 4.844332 105.753579 14.174837 80.606853-54.631248 116.00813-43.296085 116.00813-43.296085 22.935362 58.18826 8.559956 101.120049 4.180206 111.732757 27.052123 29.584806 43.443441 67.260893 43.443441 113.332185 0 162.137751-98.798167 197.850114-192.799074 208.262254 15.151072 13.088086 28.65155 38.804794 28.65155 78.17957 0 56.484456-0.459464 101.94381-0.459464 115.854635 0 11.235902 7.573489 24.381293 29.014824 20.2543C825.753867 867.330798 933.822165 709.10924 933.822165 522.700713c0-233.155201-224.12657-422.192601-434.927647-422.192601z" /></svg>`;
}

/**
 * 规范化个人项目元信息的换行。
 *
 * @param {string} markdown Markdown 文本
 * @return {string}
 */
function normalizeProjectMetaMarkdown(markdown) {
  // 将同一行连写的项目地址和技术栈拆成两行
  return markdown.replace(
    /^((?:\*\*)?项目地址(?:\*\*)?：.+?)(?=(?:\*\*)?技术栈(?:\*\*)?：)/gm,
    "$1\n"
  );
}

/**
 * 渲染简历头部。
 *
 * @param {MarkdownIt} md Markdown 渲染器
 * @param {Array<any>} tokens 头部 token
 * @param {string} titleText 姓名标题
 * @return {string}
 */
function renderHeader(md, tokens, titleText) {
  // 查找头部段落并设置样式类
  const prepared = cloneTokens(tokens);
  let paragraphIndex = 0;
  for (let index = 0; index < prepared.length; index += 1) {
    if (prepared[index].type === "paragraph_open") {
      prepared[index].attrSet("class", paragraphIndex === 0 ? "headline" : "contact-lines");
      paragraphIndex += 1;
    }
  }

  return `<header class="resume-header">
<h1>${titleText}</h1>
${renderTokenSlice(md, prepared)}
</header>`;
}

/**
 * 渲染所有二级模块。
 *
 * @param {MarkdownIt} md Markdown 渲染器
 * @param {Array<any>} tokens Markdown token
 * @param {number} startIndex 起始位置
 * @param {Set<string>} pageBreakBlocks 需要强制换页的块标识
 * @return {string}
 */
function renderSections(md, tokens, startIndex, pageBreakBlocks) {
  // 按二级标题切分模块
  const sections = [];
  let index = startIndex;
  while (index < tokens.length) {
    if (!isHeadingOpen(tokens[index], "h2")) {
      index += 1;
      continue;
    }

    const nextSection = findHeading(tokens, "h2", index + 3) ?? tokens.length;
    const sectionTokens = tokens.slice(index, nextSection);
    sections.push(renderSection(md, sectionTokens, pageBreakBlocks));
    index = nextSection;
  }

  return sections.join("\n");
}

/**
 * 渲染单个二级模块。
 *
 * @param {MarkdownIt} md Markdown 渲染器
 * @param {Array<any>} sectionTokens 模块 token
 * @param {Set<string>} pageBreakBlocks 需要强制换页的块标识
 * @return {string}
 */
function renderSection(md, sectionTokens, pageBreakBlocks) {
  // 渲染模块标题
  const titleHtml = renderTokenSlice(md, cloneTokens(sectionTokens.slice(0, 3)));
  const parts = [titleHtml.trimEnd()];
  const sectionClasses = ["section-block"];
  let index = 3;

  while (index < sectionTokens.length) {
    if (isHeadingOpen(sectionTokens[index], "h3")) {
      const nextEntry = findNextEntryBoundary(sectionTokens, index + 3) ?? sectionTokens.length;
      const blockId = `entry-${countExistingEntries(parts) + 1}-${slugText(sectionTokens[index + 1].content)}`;
      const classes = ["entry-block"];
      if (pageBreakBlocks.has(blockId) && parts.length === 1) {
        sectionClasses.push("pdf-page-before");
      } else if (pageBreakBlocks.has(blockId)) {
        classes.push("pdf-page-before");
      }
      const entryHtml = renderContentTokens(md, sectionTokens.slice(index, nextEntry)).trimEnd();
      parts.push(`<div class="${classes.join(" ")}" data-pdf-block="${escapeAttribute(blockId)}">
${entryHtml}
</div>`);
      index = nextEntry;
      continue;
    }

    const end = findBlockEnd(sectionTokens, index);
    parts.push(renderContentTokens(md, sectionTokens.slice(index, end)).trimEnd());
    index = end;
  }

  return `<section class="${sectionClasses.join(" ")}">
${parts.filter(Boolean).join("\n")}
</section>`;
}

/**
 * 渲染内容 token，并补充元信息样式。
 *
 * @param {MarkdownIt} md Markdown 渲染器
 * @param {Array<any>} tokens 内容 token
 * @return {string}
 */
function renderContentTokens(md, tokens) {
  // 复制 token，避免污染后续渲染
  const prepared = cloneTokens(tokens);
  for (let index = 0; index < prepared.length; index += 1) {
    if (prepared[index].type !== "paragraph_open") {
      continue;
    }

    const inline = prepared[index + 1];
    if (!inline || inline.type !== "inline") {
      continue;
    }

    const content = inline.content;
    if (isProjectMeta(content)) {
      prepared[index].attrSet("class", "meta-line project-meta");
    } else if (isDateMeta(content)) {
      prepared[index].attrSet("class", "meta-line");
    }
  }

  return renderTokenSlice(md, prepared);
}

/**
 * 规划打印分页，尽量避免短项目块跨页。
 *
 * @param {string} htmlPath HTML 文件路径
 * @param {string} browserPath 浏览器路径
 * @return {Promise<Set<string>>}
 */
async function planPageBreaks(htmlPath, browserPath) {
  // 使用浏览器打印媒体估算分页边界
  const pageBreakBlocks = new Set();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    const candidates = await page.evaluate(() => {
      const mmToPx = 96 / 25.4;
      const pageContentHeight = (297 - 12 - 4) * mmToPx;
      const resumeTop = document.querySelector(".resume")?.getBoundingClientRect().top ?? 0;
      return Array.from(document.querySelectorAll(".entry-block"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const top = rect.top - resumeTop;
          const bottom = rect.bottom - resumeTop;
          const startPage = Math.floor(top / pageContentHeight);
          const endPage = Math.floor((bottom - 1) / pageContentHeight);
          return {
            id: element.getAttribute("data-pdf-block"),
            height: rect.height,
            crossesPage: startPage !== endPage,
            canFitOnePage: rect.height < pageContentHeight * 0.82
          };
        })
        .filter((item) => item.id && item.crossesPage && item.canFitOnePage)
        .map((item) => item.id);
    });

    for (const id of candidates) {
      pageBreakBlocks.add(id);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return pageBreakBlocks;
}

/**
 * 计算水印前置空白高度，让水印尽量位于最后一页页脚。
 *
 * @param {string} htmlPath HTML 文件路径
 * @param {string} browserPath 浏览器路径
 * @return {Promise<number>}
 */
async function planWatermarkPosition(htmlPath, browserPath) {
  // 使用打印媒体测量正文高度和页面底部坐标
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    return await page.evaluate(() => {
      const watermark = document.querySelector(".resume-watermark");
      const resume = document.querySelector(".resume");
      if (!watermark || !resume) {
        return 0;
      }

      const mmToPx = 96 / 25.4;
      const pageContentHeight = (297 - 12 - 4) * mmToPx;
      const watermarkRect = watermark.getBoundingClientRect();
      const contentBottom = Array.from(resume.children)
        .filter((element) => element !== watermark)
        .reduce((bottom, element) => {
          const rect = element.getBoundingClientRect();
          return Math.max(bottom, rect.bottom - resume.getBoundingClientRect().top);
        }, 0);
      const watermarkHeight = watermarkRect.height;
      const pageIndex = Math.max(0, Math.ceil(contentBottom / pageContentHeight) - 1);
      const targetTop = (pageIndex + 1) * pageContentHeight - 2 * mmToPx - watermarkHeight;
      return Math.max(0, Math.floor(targetTop));
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 导出 PDF 文件。
 *
 * @param {string} htmlPath HTML 文件路径
 * @param {string} pdfPath PDF 输出路径
 * @param {string} browserPath 浏览器路径
 * @param {Record<string, any>} pdfOptions PDF 参数
 * @return {Promise<void>}
 */
async function writePdf(htmlPath, pdfPath, browserPath, pdfOptions) {
  // 使用浏览器打印能力导出 PDF
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: pdfPath,
      ...pdfOptions
    });
  } finally {
    await browser.close();
  }
}

/**
 * 查找可用于 PDF 导出的 Chromium 浏览器。
 *
 * @param {Record<string, any>} config 全局配置
 * @return {string}
 */
function findBrowserPath(config) {
  // 优先使用环境变量指定的浏览器
  const candidates = [
    process.env.RESUME_CHROME_PATH,
    ...(config.browserPaths || []),
    ...findBrowserFromPath()
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = path.resolve(projectRoot, candidate);
    if (fs.existsSync(normalized)) {
      return normalized;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("未找到可用 Chromium 浏览器，请设置 RESUME_CHROME_PATH");
}

/**
 * 从系统 PATH 查找浏览器命令。
 *
 * @return {string[]}
 */
function findBrowserFromPath() {
  // 查询常见命令位置
  const commands = process.platform === "win32"
    ? ["where", "chrome"]
    : ["which", "google-chrome"];
  const result = spawnSync(commands[0], commands.slice(1), {
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 确认文件存在。
 *
 * @param {string} filePath 文件路径
 * @param {string} message 错误信息
 * @return {void}
 */
function ensureFile(filePath, message) {
  // 校验文件路径
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${message}：${path.relative(projectRoot, filePath)}`);
  }
}

/**
 * 确认文本包含指定片段。
 *
 * @param {string} text 待检查文本
 * @param {string} expected 期望片段
 * @param {string} message 错误信息
 * @return {void}
 */
function assertIncludes(text, expected, message) {
  // 校验文本片段
  if (!text.includes(expected)) {
    throw new Error(message);
  }
}

/**
 * 查找指定等级标题。
 *
 * @param {Array<any>} tokens token 列表
 * @param {string} tag 标题标签
 * @param {number} start 起始位置
 * @return {number | undefined}
 */
function findHeading(tokens, tag, start) {
  // 遍历查找标题 token
  for (let index = start; index < tokens.length; index += 1) {
    if (isHeadingOpen(tokens[index], tag)) {
      return index;
    }
  }
  return undefined;
}

/**
 * 判断 token 是否为指定标题起始。
 *
 * @param {any} token 当前 token
 * @param {string} tag 标题标签
 * @return {boolean}
 */
function isHeadingOpen(token, tag) {
  // 判断标题标签
  return token?.type === "heading_open" && token.tag === tag;
}

/**
 * 查找下一个条目边界。
 *
 * @param {Array<any>} tokens token 列表
 * @param {number} start 起始位置
 * @return {number | undefined}
 */
function findNextEntryBoundary(tokens, start) {
  // 查找下一个二级或三级标题
  for (let index = start; index < tokens.length; index += 1) {
    if (isHeadingOpen(tokens[index], "h2") || isHeadingOpen(tokens[index], "h3")) {
      return index;
    }
  }
  return undefined;
}

/**
 * 查找当前块的结束位置。
 *
 * @param {Array<any>} tokens token 列表
 * @param {number} start 起始位置
 * @return {number}
 */
function findBlockEnd(tokens, start) {
  // 普通块按嵌套层级查找结束位置
  if (tokens[start].nesting !== 1) {
    return start + 1;
  }

  let level = 0;
  for (let index = start; index < tokens.length; index += 1) {
    level += tokens[index].nesting;
    if (level === 0) {
      return index + 1;
    }
  }

  return tokens.length;
}

/**
 * 判断段落是否为项目元信息。
 *
 * @param {string} content 段落文本
 * @return {boolean}
 */
function isProjectMeta(content) {
  // 识别技术栈或项目地址段落
  return content.includes("技术栈") || content.includes("项目地址");
}

/**
 * 判断段落是否为日期元信息。
 *
 * @param {string} content 段落文本
 * @return {boolean}
 */
function isDateMeta(content) {
  // 识别年月范围段落
  return /^\*\*\d{4}\.\d{2}\s*-/.test(content) || /^\d{4}\.\d{2}\s*-/.test(content);
}

/**
 * 渲染 token 片段。
 *
 * @param {MarkdownIt} md Markdown 渲染器
 * @param {Array<any>} tokens token 片段
 * @return {string}
 */
function renderTokenSlice(md, tokens) {
  // 调用 markdown-it 原生渲染器
  return md.renderer.render(tokens, md.options, {});
}

/**
 * 克隆 token 列表。
 *
 * @param {Array<any>} tokens token 列表
 * @return {Array<any>}
 */
function cloneTokens(tokens) {
  // 浅克隆 token，保留 markdown-it 方法原型
  return tokens.map((token) => {
    const clone = Object.create(Object.getPrototypeOf(token));
    Object.assign(clone, token);
    clone.attrs = token.attrs ? token.attrs.map((attr) => [...attr]) : null;
    clone.children = token.children ? cloneTokens(token.children) : null;
    return clone;
  });
}

/**
 * 统计已生成的条目块数量。
 *
 * @param {string[]} parts 已生成片段
 * @return {number}
 */
function countExistingEntries(parts) {
  // 统计条目块片段
  return parts.filter((part) => part.includes("data-pdf-block=")).length;
}

/**
 * 将标题文本转换成稳定标识片段。
 *
 * @param {string} text 标题文本
 * @return {string}
 */
function slugText(text) {
  // 生成短标识，中文保留以便排查
  return text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "block";
}

/**
 * 转义 HTML 文本。
 *
 * @param {string} value 原始文本
 * @return {string}
 */
function escapeHtml(value) {
  // 转义文本节点
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 转义 HTML 属性。
 *
 * @param {string} value 原始属性值
 * @return {string}
 */
function escapeAttribute(value) {
  // 转义属性值
  return escapeHtml(value).replace(/"/g, "&quot;");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
