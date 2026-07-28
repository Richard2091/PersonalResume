# Markdown 简历工程化手册（Agent 指导版）

> 目标：创建一套 **一次编写，多端发布** 的 Markdown 简历系统。

支持：

* ✅ GitHub README 展示
* ✅ Notion 导入
* ✅ VuePress / VitePress 文档站
* ✅ Typora / Obsidian 编辑
* ✅ Markdown Preview Enhanced
* ✅ PDF 导出
* ✅ HTML 导出
* ✅ 企业招聘系统复制

---

# 1. 核心设计理念

将简历拆分成：

```
Resume System

├── Content Layer
│
│   Markdown
│   负责内容结构
│
│
├── Style Layer
│
│   CSS
│   负责视觉表现
│
│
├── Build Layer
│
│   VuePress
│   Pandoc
│   Typora
│
│
└── Publish Layer
    |
    ├── Github
    ├── Notion
    ├── Website
    └── PDF

```

类似前端：

```
HTML
 |
 | 
Markdown


CSS
 |
 |
Theme


Webpack/Vite
 |
 |
Build


Browser
 |
 |
PDF/Web
```

---

# 2. 项目目录规范

推荐结构：

```
my-resume/


├── README.md

├── resume.md          # 主简历


├── assets/

│   ├── avatar.png

│   ├── icons/

│   └── qrcode.png


├── styles/

│   ├── resume.css

│   └── github.css


├── export/

│   ├── resume.pdf

│   └── resume.html


├── docs/

│   └── vuepress/


└── package.json

```

---

# 3. Markdown 编写规范

## 3.1 标题层级

固定：

```md
# 姓名


## 一级模块


### 二级模块


#### 三级内容

```

对应：

| Markdown | HTML |
| -------- | ---- |
| #        | h1   |
| ##       | h2   |
| ###      | h3   |

---

# 4. 简历结构模板

标准：

```md
# 👨‍💻 张三


> Java 后端开发工程师


---

## 联系方式


📱 电话

📧 邮箱

🔗 Github


---


## 个人优势


- **3年Java经验**

- **微服务架构经验**

- **高并发系统设计能力**


---


## 技术栈


|领域|技术|
|-|-|
|语言|Java|
|框架|Spring Boot|
|数据库|MySQL Redis|


---


## 工作经历



### 公司名称


**Java开发工程师**

`2023.01 - 至今`


- 负责xxx
- 优化xxx



---


## 项目经历


### 项目名称


技术：

```

Spring Boot
Redis
MySQL

```


职责：

- xxx

- xxx



---


## 教育经历


### 学校


专业


---


## 自我评价


- xxx

```

---

# 5. Markdown CSS Theme规范

## CSS文件

```
styles/resume.css
```

基础：

```css
body{


font-family:

"Inter",

"Microsoft YaHei",

sans-serif;


background:#ffffff;


color:#1f2937;


}



.resume{


max-width:900px;


margin:auto;


padding:40px;


}

```

---

# 6. Github 发布规范

## 目录

Github:

```
username.github.io

或者

resume


├── README.md

├── resume.md

└── assets

```

---

## README.md

Github 默认展示：

```md
# 张三


Java Backend Engineer


## Skills


Java

Spring Boot

Redis


## Projects


...


```

---

## Github 优化

添加：

```
.github/

└── workflows

    └── deploy.yml

```

自动生成：

```
Markdown

↓

HTML

↓

Github Pages

```

---

# 7. Github Pages 发布

## 安装

```bash
npm install -g vitepress
```

初始化：

```bash
vitepress init
```

结构：

```
docs


├── index.md

├── resume.md

└── public

    └── avatar.png

```

启动：

```bash
npm run docs:dev
```

发布：

```bash
npm run docs:build
```

生成：

```
docs/.vitepress/dist

```

上传 Github Pages。

---

# 8. VuePress 发布方案

## 安装

```bash
npm install vuepress
```

目录：

```
docs


├── README.md


├── resume.md


└── .vuepress


    ├── config.js


    └── styles


        └── index.css

```

---

config：

```js
module.exports={


title:"我的简历",


themeConfig:{


nav:[

{

text:"Resume",

link:"/resume"

}

]


}


}

```

运行：

```bash
npm run docs:dev
```

---

# 9. Notion 导入规范

Notion 支持：

```
Markdown

↓

Import

↓

Notion Page

```

操作：

```
Notion

New Page

↓

Import

↓

Markdown

↓

选择 resume.md

```

注意：

Notion 不支持：

* 自定义 CSS
* HTML div
* 部分表格样式

因此提供：

```
resume.md

纯Markdown版本

```

---

# 10. 双版本策略

推荐维护两个文件：

```
resume/


resume.md

↓

完整版

支持CSS


resume-lite.md

↓

纯Markdown

适配:

Github

Notion

招聘系统

```

---

# 11. PDF导出方案

## 方案A：Typora

打开：

```
resume.md

```

选择：

```
文件

↓

导出

↓

PDF

```

优点：

* 中文支持好
* CSS支持

---

# 方案B：Pandoc

安装：

```bash
brew install pandoc
```

转换：

```bash
pandoc resume.md \
-o resume.pdf
```

---

# 方案C：浏览器打印

Markdown：

↓

HTML

执行：

```
Chrome

↓

打印

↓

保存PDF

```

---

# 12. HTML转换方案

安装：

```bash
npm install markdown-it
```

转换：

```js
const md=require("markdown-it")();


html=md.render(markdown);


```

生成：

```
resume.html

```

然后：

```
html

↓

Chrome

↓

PDF

```

---

# 13. Agent 自动生成规则

给 AI Agent 的 Prompt：

```
你是一名高级前端工程师。


目标：

生成一份工程化Markdown简历。


要求：

1.
输出标准Markdown


2.
禁止直接输出HTML布局


3.
使用:
# ## ###

作为结构


4.
所有重点使用:

**加粗**


5.
技术使用:

代码标签


例如:

`Spring Boot`


6.
项目必须包含:

- 项目名称
- 时间
- 技术栈
- 业务描述
- 我的贡献


7.
同时生成:

resume.md

resume-lite.md

resume.css


8.
保证:

Github
Notion
VuePress
PDF

均可使用。


```

---

# 14. CI/CD 自动生成简历站

最终流水线：

```
用户修改resume.md


        |

        ↓


Github Commit


        |

        ↓


Github Action


        |

        ↓


VitePress Build


        |

        ↓


Github Pages


        |

        ↓


在线简历


```

---

# 15. 推荐最终方案

个人开发者：

```
resume.md

+

resume.css

+

VitePress

+

Github Pages

```

效果：

```
https://username.github.io/resume

```

同时：

```
resume.md

↓

Notion

↓

PDF

↓

招聘网站

```

---

# 16. 最佳实践总结

| 目标       | 方案            |
| -------- | ------------- |
| 写简历      | Markdown      |
| 漂亮展示     | CSS           |
| 在线访问     | VitePress     |
| Github展示 | README        |
| 笔记管理     | Notion        |
| 打印投递     | PDF           |
| 自动更新     | Github Action |

最终形成：

```
       resume.md

            |
   -----------------

   |       |        |

Github  Notion   Website

            |

          PDF


```

这套方案本质就是 **“简历即代码（Resume as Code）”**，非常适合程序员长期维护。
