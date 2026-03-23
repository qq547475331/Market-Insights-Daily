# Tasks: 金融日报服务重构

## 阶段一：数据源层重构

- [x] Task 1: 创建金融新闻数据源适配器 `src/dataSources/financialNews.js`
  - [x] 子任务 1.1: 实现华尔街见闻 RSS 解析
  - [x] 子任务 1.2: 实现财新网 RSS 解析
  - [x] 子任务 1.3: 实现彭博中文 RSS 解析
  - [x] 子任务 1.4: 实现路透社中文 RSS 解析

- [x] Task 2: 创建地缘政治数据源 `src/dataSources/geopolitics.js`
  - [x] 子任务 2.1: 实现乌克兰/俄罗斯相关新闻源
  - [x] 子任务 2.2: 实现中东地区新闻源（以色列、伊朗）
  - [x] 子任务 2.3: 实现台海相关新闻源
  - [x] 子任务 2.4: 实现霍尔木兹海峡/能源通道新闻源

- [x] Task 3: 创建股票市场数据源 `src/dataSources/stockMarket.js`
  - [x] 子任务 3.1: 实现美股主要指数（道琼斯、纳斯达克、标普500）
  - [x] 子任务 3.2: 实现热门个股行情（NVDA, TSLA, AAPL, MSFT, GOOGL等）
  - [x] 子任务 3.3: 实现港股主要指数（恒生指数、国企指数）
  - [x] 子任务 3.4: 实现A股主要指数（上证、深证）

- [x] Task 4: 创建大宗商品数据源 `src/dataSources/commodities.js`
  - [x] 子任务 4.1: 实现黄金/白银价格数据
  - [x] 子任务 4.2: 实现原油/天然气价格数据
  - [x] 子任务 4.3: 实现美元指数数据

- [x] Task 5: 创建社交媒体情绪数据源 `src/dataSources/socialSentiment.js`
  - [x] 子任务 5.1: 实现 X/Twitter 金融博主抓取
  - [x] 子任务 5.2: 实现 Reddit 投资社区抓取 (r/wallstreetbets, r/investing)
  - [x] 子任务 5.3: 实现金融博主观点聚合

- [x] Task 6: 移除旧的AI/科技数据源
  - [x] 子任务 6.1: 移除 aibase.js, jiqizhixin.js, xiaohu.js 等AI数据源
  - [x] 子任务 6.2: 移除 github-trending.js, papers.js 等开发者数据源

## 阶段二：处理逻辑重构

- [x] Task 7: 更新 `src/dataFetchers.js`
  - [x] 子任务 7.1: 移除旧的 dataSources 引用
  - [x] 子任务 7.2: 引入新的金融数据源

- [x] Task 8: 创建金融分析提示词 `src/prompt/financialAnalysisPrompt.js`
  - [x] 子任务 8.1: 创建市场概述分析提示词
  - [x] 子任务 8.2: 创建板块轮动分析提示词
  - [x] 子任务 8.3: 创建地缘政治影响评估提示词
  - [x] 子任务 8.4: 创建社交媒体情绪聚合提示词

- [x] Task 9: 更新 `src/handlers/genAIContent.js` 为金融日报生成
  - [x] 子任务 9.1: 适配新的金融数据处理流程
  - [x] 子任务 9.2: 移除 podcast 相关代码
  - [x] 子任务 9.3: 实现金融日报结构化输出

## 阶段三：UI/报告层重构

- [x] Task 10: 更新 `src/htmlGenerators.js` 适配金融日报
  - [x] 子任务 10.1: 更新日报模板结构
  - [x] 子任务 10.2: 添加金融数据可视化组件

- [x] Task 11: 更新 `src/handlers/getContent.js` 适配新分类
  - [x] 子任务 11.1: 更新分类展示逻辑
  - [x] 子任务 11.2: 更新内容筛选功能

## 阶段四：清理与测试

- [x] Task 12: 清理冗余文件
  - [x] 子任务 12.1: 移除未使用的 prompt 文件
  - [x] 子任务 12.2: 清理注释掉的代码

- [x] Task 13: 更新环境变量配置文档
  - [x] 子任务 13.1: 添加金融数据源相关配置说明
  - [x] 子任务 13.2: 移除 AI 相关配置说明

## Task Dependencies
- Task 7 依赖 Task 1-6 ✓
- Task 8 独立，可并行执行 ✓
- Task 9 依赖 Task 7, Task 8 ✓
- Task 10 依赖 Task 9 ✓
- Task 11 依赖 Task 7 ✓
- Task 12 依赖 Task 9, 10, 11 ✓
- Task 13 可在任意阶段执行 ✓
