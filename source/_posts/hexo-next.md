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
- 创建好文件夹并安装Hexo
- 安装NexT
```bash
# download
cd hexo-site
npm install hexo-theme-next

# upgrade
cd hexo-site
npm install hexo-theme-next@latests
```
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

### yml config
[Configuration Files](https://theme-next.js.org/docs/getting-started/#Configuration-Files)
防止覆盖
```bash
# Installed through npm
cp node_modules/hexo-theme-next/_config.yml _config.next.yml
# Installed through Git
cp themes/next/_config.yml _config.next.yml
```


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

### Custom Home Page & Archives
参考：[hexo自定义主页](https://zermzhang.github.io/2022/05/16/blog/hexo%E8%87%AA%E5%AE%9A%E4%B9%89%E4%B8%BB%E9%A1%B5/)
```bash
# 在/source/目录下
touch index.md
```

接着添加
```
---
title: home
date: 2026-07-08 22:32:43
type: "home"
---
```
并在```root-site```中添加
```bash
hexo  new page archives
```
并修改```index_generato```中的```path```字段为一空白文件夹，确保原始主页能够渲染。

### Social
在```_config.next.yml```中的```social:```修改内容。

### [asset-folder](https://hexo.io/zh-cn/docs/asset-folders)
新建文章时会自动创建同名文件夹。
```
# _config.yml
post_asset_folder: true
```

### latex
[How to enable LaTeX support in hexo-next theme](https://aka.cy/2024/10/01/How-to-enable-LaTeX-support-in-hexo-next-theme/)
```
# _config.next.yml
 mathjax:
    enable: true

# bash
npm uninstall hexo-renderer-marked --save
npm install hexo-renderer-pandoc --save 

# front-matter
mathjax: true
```