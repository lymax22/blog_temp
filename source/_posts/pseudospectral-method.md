---
title: 伪谱法与重心插值
date: 2026-07-09 02:15:42
mathjax: true
categories:
  - trajectory optimization
tags:
  - math bkg
  - pseudospectral-method
---

## 伪谱法简述

伪谱法（Pseudospectral Method）是一类用于数值求解最优控制问题的直接配点方法。它在一组非均匀节点上，用全局多项式近似状态量和控制量，并通过微分矩阵将连续动力学约束转化为有限维代数约束，最终形成非线性规划问题。

常见节点包括 Legendre-Gauss（LG）、Legendre-Gauss-Lobatto（LGL）、Legendre-Gauss-Radau（LGR）和 Chebyshev-Gauss-Lobatto（CGL）节点。不同节点是否包含区间端点，以及相应积分权重和微分矩阵的构造方式并不相同。

本文仅记录基础概念，不讨论具体算法实现、算例或毕业论文相关研究内容。伪谱法部分的学习参考见文末链接。

## 重心拉格朗日插值

设有互异节点 $x_0,x_1,\ldots,x_n$ 及对应函数值 $f_0,f_1,\ldots,f_n$。定义重心权重

$$
\lambda_j=\left[\prod_{k\ne j}(x_j-x_k)\right]^{-1},
\qquad j=0,1,\ldots,n.
$$

当 $x\ne x_j$ 时，插值多项式可写为

$$
p(x)=
\frac{\displaystyle\sum_{j=0}^{n}\frac{\lambda_j}{x-x_j}f_j}
{\displaystyle\sum_{j=0}^{n}\frac{\lambda_j}{x-x_j}}.
$$

当 $x=x_j$ 时，直接取 $p(x_j)=f_j$。这种写法避免了逐项展开拉格朗日基函数，便于数值计算。

在配点法中，节点处的一阶导数可以用微分矩阵 $D$ 近似。其元素为

$$
D_{ij}=\frac{\lambda_j}{\lambda_i(x_i-x_j)},
\qquad i\ne j,
$$

而对角元素由每行元素之和为零得到：

$$
D_{ii}=-\sum_{j\ne i}D_{ij}.
$$

因此，若 $\mathbf f=[f_0,f_1,\ldots,f_n]^\mathsf{T}$，则节点处的导数可近似写为 $\mathbf f'\approx D\mathbf f$。这也是插值与伪谱离散之间的一个基本联系。

## 参考与延伸阅读

- Berrut, J.-P., & Trefethen, L. N. (2004). Barycentric Lagrange Interpolation. *SIAM Review*, 46(3), 501–517.
- 雷烈：[数值法求解最优控制问题（四）——伪谱法](https://leilie.top/2022-07-07/Study-Pseudospectral-Method-for-OCP)，2022-07-07。本文仅参考其概念说明，未转载其中的图片与代码。
