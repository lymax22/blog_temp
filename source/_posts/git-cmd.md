---
title: 常用 Git 命令
date: 2026-07-08 04:50:00
tags:
  - git
---

吐槽一下，但凡涉及到分享的链接，总会带上个人信息，发布前必须审查才行。

## 参考

### 下载

- 通过[git-scm](https://git-scm.com/downloads/win)下载64位版本并安装
- 安装选项参考[基于 VScode 的 git 详细使用指南](https://jaegerzhao.blog.csdn.net/article/details/136037857)

### git推送本地仓库
[git修改当前项目仓库地址的三种方法](https://blog.csdn.net/halo1416/article/details/123566471)

### 远程分支合并
[git合并远程分支](https://blog.csdn.net/demonliuhui/article/details/78510678)
| [带你了解实际工作中git的使用流程](https://blog.csdn.net/weixin_42822484/article/details/107093262)
| [Git——将 Git 分支合并到 Master 的最佳方法](https://zhuanlan.zhihu.com/p/465080806)

[解决 Git “fatal: refusing to merge unrelated histories”](https://zhuanlan.zhihu.com/p/1923156664309253061) | [Git 远程分支未列出](https://geek-docs.com/git/git-questions/679_git_git_remote_branches_not_listed.html)


## 基本配置

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global --list
```

设置提交信息中的用户名和邮箱；最后一条查看当前全局配置。

## 本地代理设置

```bash
  # [port] 需要自行替换
  git config --global --edit
  git config --global http.proxy 'http://127.0.0.1:[port]'
  git config --global --list
  # unset proxy
  git config --global --unset http.proxy
  # git config --global --unset https.proxy
```

需要确保本地代理软件开启端口。

## 本地仓库

```bash
git init
git status
git add <file>
git add .
git diff --cached
git commit -m "message"
git log --oneline
```

- `git init`：在当前目录创建仓库。
- `git status`：查看工作区和暂存区状态。
- `git add <file>`：暂存指定文件；`git add .` 暂存当前目录下的所有改动。
- `git diff --cached`：查看下一次提交包含的内容。
- `git commit -m`：创建一次提交。
- `git log --oneline`：简要查看提交历史。

## 分支

```bash
git branch
git switch -c <branch-name>
git switch <branch-name>
git merge <branch-name>
git branch -d <branch-name>
```

- `git branch`：查看本地分支。
- `git switch -c`：创建并切换到新分支。
- `git switch`：切换分支。
- `git merge`：将指定分支合并到当前分支。
- `git branch -d`：删除已合并的本地分支。

## 远程仓库

```bash
git remote -v
git remote add origin <remote-url>
git remote set-url origin <remote-url>
git branch -M main
git push -u origin main
git pull --rebase origin main
git fetch --all
```

- `git remote -v`：查看远程仓库地址。
- `git remote add origin`：添加远程仓库。
- `git remote set-url origin`：修改远程仓库地址。
- `git branch -M main`：将当前分支重命名为 `main`。
- `git push -u origin main`：首次推送并设置上游分支。
- `git pull --rebase origin main`：拉取远程更新，并将本地提交变基到其后。
- `git fetch --all`：获取所有远程更新，但不自动合并。

## 标签

```bash
git tag
git tag -a v0.1 -m "message"
git push origin v0.1
```

- `git tag`：查看标签。
- `git tag -a`：创建带说明的标签。
- `git push origin <tag>`：推送指定标签。

## 忽略文件

在项目根目录创建 `.gitignore`，写入不需要跟踪的文件规则。已经被跟踪的文件不会自动被忽略。

```bash
git check-ignore -v <file>
```

查看某个文件被哪一条忽略规则匹配。

- 常见的`.gitignore`配置
```
# 减少latex文件同步项
*.aux
*.log
*.out
*.gz
*.toc
*.bbl
*.blg
```
