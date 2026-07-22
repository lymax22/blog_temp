# Project README Design

## Goal

Create a Chinese-first `README.md` for the personal Hexo website repository. It
should explain the site's purpose, help contributors run it locally, introduce
the planned Codex research workflow, and give a safe example of reading another
local project without implying that an unfinished workflow has already shipped.

## Audience

- Visitors interested in the author's research and learning notes.
- Developers who want to run or contribute to the Hexo site.
- Researchers interested in the planned open-source Codex research workflow.

## Content Structure

1. Project title and a short Chinese introduction.
2. Link to `https://blog.louisym.com`.
3. Content areas: research notes, technical learning records, and open-source
   projects.
4. Current technology stack: Hexo 7, NexT, Pandoc, and MathJax.
5. Local development commands derived from `package.json`.
6. A compact repository structure overview.
7. An open-source roadmap that labels the Codex research workflow as planned,
   not released.
8. A practical cross-project reading example.
9. Contribution and license notes.

## Cross-Project Reading Guidance

The README will distinguish permissions clearly:

- In Codex on native Windows, `/sandbox-add-read-dir
  D:\absolute\path\to\other-project` grants the current session read access to
  an existing directory outside the current readable roots.
- The example prompt will tell Codex to inspect the source project's README,
  `AGENTS.md`, documentation, representative source files, and Git history; it
  will write the resulting summary or template only into the current project.
- The Codex CLI `--add-dir` option grants an additional directory write access,
  so it will be shown only as an alternative when cross-project edits are
  intentionally required, not as the default for read-only research.
- Repository-specific conventions belong in `AGENTS.md`; a repeatable workflow
  can later become a Skill and be packaged as a plugin for distribution.

## Accuracy and Scope

- Use only commands present in `package.json`: `npm run server`, `npm run build`,
  `npm run clean`, and `npm run deploy`.
- Do not invent contact information, research achievements, badges, or a
  released workflow package.
- Do not claim a software license because the repository currently has no
  license file; state that reuse terms will be clarified when a license is
  added.
- Do not change the website source, Hexo configuration, or existing posts.

## Verification

1. Confirm `README.md` exists at the repository root.
2. Confirm every documented npm command exists in `package.json`.
3. Confirm the site URL matches `_config.yml`.
4. Confirm the workflow is consistently described as planned.
5. Confirm no placeholder personal information or unsupported license claim is
   present.
