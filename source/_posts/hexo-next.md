---
title: hexo-next
date: 2026-07-08 04:52:38
categories:
  - hexo
tags:
  - usage
---
# 个人博客制作
本次博客采用Hexo-NexT+Cloudflare制作。后续可以尝试typecho
## 官方网站

[Hexo:快速、简洁且高效的博客框架](https://hexo.io/zh-cn/)
[NexT:Theme for Hexo](https://theme-next.js.org/)
[About Git](https://docs.github.com/en/get-started/using-git/about-git)

[Cloudflare Docs:Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

## 部署流程
### 步骤
参考：
[10 大静态网站生成工具 | Linux 中国](https://zhuanlan.zhihu.com/p/260957368),
[Hexo添加分类及标签（在Next主题下）](https://juejin.cn/post/6921750181297782798),
[使用 Hexo 和 Cloudflare 搭建你的博客](https://zhuanlan.zhihu.com/p/348892754),
[Cloudflare Pages + Hexo 搭建个人博客](https://hexo.leelurker.com/posts/18142#%E5%8F%82%E8%80%83),

- 购买域名
- 下载安装并配置好git与node.js.验证方法：
```bash
node -v
npm -v
git --version
```
确认无误后即可进行下面的步骤。
- 创建好安装Hexo
- 安装NexT
- 创建本地仓库推送至github
- 在Cloudflare中的Workers & Pages页面关联github仓库，并添加自定义域。
```
# cloudflare中需要填
npm install -g hexo; hexo clean; hexo generate
# 并将输出目录写为public
```
### 优化


### 指令
```bash

npm install -g hexo-cli

hexo init <folder>
cd <folder>
npm install
hexo new [layout] <title>

hexo new page --path <path> "name"

hexo clean

#hexo g
hexo generate

#arg=
# -p
# -s 
# -l
hexo server [arg]

#all in one
hexo clean && hexo g && hexo s -s
```

## issue
### Categories & Tags
这两者的部署方法相同。首先输入
```bash
hexo new page categories
```
接着在创建好的index.md下，在开头添加上
```bash
type: "categories"
```
如果发现创建的位置不对，并且```_config.next.yml```也修改了的话，需要重新clean并generate。