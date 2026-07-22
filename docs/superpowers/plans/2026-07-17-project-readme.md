# Project README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chinese-first root README that introduces the personal research website, documents local Hexo usage, and explains the planned Codex research workflow with a safe cross-project reading example.

**Architecture:** Keep all public-facing project information in one root `README.md`. Derive commands and metadata from the existing repository, clearly separate current capabilities from roadmap items, and document read-only versus writable Codex directory permissions.

**Tech Stack:** Markdown, Hexo 7.3.0, NexT 8.28.0, Pandoc renderer, MathJax, Codex

## Global Constraints

- Write primarily in Chinese.
- Use `https://blog.louisym.com` as the website URL.
- Document only npm scripts that exist in `package.json`.
- Describe the Codex research workflow as planned, not released.
- Do not invent contact information, achievements, badges, or a license.
- Do not modify Hexo configuration, site content, or existing posts.

---

### Task 1: Create and verify the root README

**Files:**
- Create: `README.md`
- Create: `docs/superpowers/plans/2026-07-17-project-readme.md`
- Reference: `package.json`
- Reference: `_config.yml`

**Interfaces:**
- Consumes: the site URL from `_config.yml`, npm scripts from `package.json`, and current Codex permission behavior from the official Codex manual.
- Produces: a repository landing page for visitors, contributors, and future users of the research workflow.

- [ ] **Step 1: Run the failing existence check**

```bash
test -f README.md
```

Expected: FAIL with exit code `1` because the repository currently has no root README.

- [ ] **Step 2: Create `README.md` with the approved content**

```markdown
# Louis's Blog

这是我的个人科研与学习网站，主要用于记录科研过程、整理技术笔记，并展示正在维护或计划开源的项目。

- 网站：[blog.louisym.com](https://blog.louisym.com)
- 仓库：[lymax22/blog_temp](https://github.com/lymax22/blog_temp)

## 内容方向

- **科研学习记录**：轨迹优化、伪谱法、最优控制等方向的学习笔记。
- **技术实践**：Git、Hexo、科研写作与开发环境配置。
- **开源项目**：整理可复用的科研工具、模板与 Codex 工作流。

## 技术栈

| 组件 | 用途 |
| --- | --- |
| [Hexo](https://hexo.io/) 7 | 静态网站生成 |
| [NexT](https://theme-next.js.org/) 8 | 网站主题 |
| Pandoc renderer | Markdown 与数学内容渲染 |
| MathJax | LaTeX 公式展示 |

## 本地运行

环境要求：Node.js、npm，以及可被命令行访问的 Pandoc。

```bash
git clone https://github.com/lymax22/blog_temp.git
cd blog_temp
npm install
```

启动本地预览：

```bash
npm run server
```

生成静态网站：

```bash
npm run build
```

清理 Hexo 缓存及生成目录：

```bash
npm run clean
```

执行配置好的部署流程：

```bash
npm run deploy
```

> 当前 `_config.yml` 尚未配置具体部署器，使用 `npm run deploy` 前需要先完成 Hexo 部署配置。

## 项目结构

```text
.
├── source/
│   ├── _posts/              # 博客文章
│   └── _posts/<文章名>/      # 文章本地图片等资源
├── scaffolds/                # Hexo 内容模板
├── _config.yml               # Hexo 站点配置
├── _config.next.yml          # NexT 主题配置
├── AGENTS.md                 # 仓库级 Codex 工作约定
└── package.json              # 依赖与常用命令
```

## Codex 科研工作流（规划中）

我计划开源一套可复用的 Codex 科研工作流，用于：

1. 读取并梳理已有科研或工程项目；
2. 从文档、代码和 Git 历史中提取可验证的项目事实；
3. 生成结构化项目总结、复现实验说明和开源模板；
4. 将稳定流程沉淀为 Codex Skill，并在需要分发时打包为插件。

该工作流目前仍在设计和实践阶段，尚未作为独立工具发布。

### 跨项目只读总结示例

假设当前 Codex 任务打开的是本仓库，需要总结另一个本地项目：

```text
D:\working\AnotherProject
```

在 Windows 原生 Codex 会话中，为当前会话增加该目录的只读权限：

```text
/sandbox-add-read-dir D:\working\AnotherProject
```

然后可以使用类似提示：

```text
请只读分析 D:\working\AnotherProject：

1. 阅读 README.md、AGENTS.md、docs/、主要配置和代表性源码；
2. 检查 Git 历史，区分当前实现、历史设计和规划内容；
3. 总结项目目标、架构、运行方式、验证方法和可复用部分；
4. 在当前仓库的 docs/research/ 下生成项目总结和开源模板；
5. 不要修改 D:\working\AnotherProject 中的任何文件。
```

`/sandbox-add-read-dir` 只为当前 Windows 会话增加读取权限。若使用 Codex CLI，`--add-dir` 会为附加目录授予写权限，只应在确实需要跨项目修改时使用：

```bash
codex -C D:\working\Pages --add-dir D:\working\AnotherProject
```

为了让流程能够长期复用：

- 项目自身的构建、测试和约束写入 [`AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md)；
- 可重复的科研总结流程制作成 [Skill](https://learn.chatgpt.com/docs/build-skills)；
- 需要公开分发多个 Skill 或连接外部工具时，再制作成 [Plugin](https://learn.chatgpt.com/docs/build-plugins)。

## 参与贡献

欢迎通过 Issue 或 Pull Request 交流科研记录整理、Hexo 使用以及 Codex 科研工作流的改进建议。提交修改前，请确认站点能够正常生成：

```bash
npm run clean
npm run build
```

## 许可说明

本仓库目前尚未添加开源许可证。在许可证明确之前，仓库公开可见不代表自动授予复制、修改或再分发权；后续发布可复用模板与 Codex 工作流时会补充明确的许可条款。
```

- [ ] **Step 3: Re-run the existence check**

```bash
test -f README.md
```

Expected: PASS with exit code `0`.

- [ ] **Step 4: Verify documented facts and required sections**

```bash
rg -n 'https://blog\.louisym\.com|npm run (server|build|clean|deploy)|/sandbox-add-read-dir|--add-dir|规划中|尚未添加开源许可证' README.md
```

Expected: output includes the configured site URL, all four npm commands, both cross-project permission mechanisms, roadmap wording, and the license note.

- [ ] **Step 5: Verify the site still builds**

```bash
npm run clean
```

```bash
npm run build
```

Expected: both commands exit with code `0`; Hexo reports successful generation.

- [ ] **Step 6: Review and commit only the README deliverables**

```bash
git diff -- README.md docs/superpowers/plans/2026-07-17-project-readme.md
```

```bash
git add README.md docs/superpowers/plans/2026-07-17-project-readme.md
git commit -m "docs: add project readme"
```

Expected: the commit contains only `README.md` and this implementation plan; existing working-tree and generated-site changes remain unstaged.
