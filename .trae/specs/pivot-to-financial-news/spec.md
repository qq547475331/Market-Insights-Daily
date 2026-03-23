# 金融日报服务 Spec

## Why

当前的AI新闻聚合系统需要转型为**金融新闻日报服务**，聚焦全球金融市场动态，为美股投资者提供每日市场总结和智能分析。

## What Changes

### 数据源重构
- **移除**现有的AI/科技类数据源 (HuggingFace Papers, GitHub Trending, AIBase, 机器之心等)
- **新增**金融数据源适配器:
  - 主流财经媒体 RSS (华尔街见闻、财新、彭博、路透社)
  - X/Twitter 金融博主和分析师
  - 股票行情数据 API
  - 黄金/期货/大宗商品数据
  - 地缘政治新闻源
  - Reddit 投资社区 (r/wallstreetbets, r/investing)

### 分类体系重构
- **美股市场** (NYSE, NASDAQ 主要个股)
- **港股/A股市场**
- **黄金/白银** 贵金属
- **原油/天然气** 能源期货
- **外汇市场** (美元指数, 欧元, 日元)
- **半导体行业** (NVDA, AMD, INTC 等)
- **地缘政治** (俄乌, 中东, 台海, 霍尔木兹)
- **加密货币** (BTC, ETH)
- **宏观经济** (CPI, GDP, 利率决策)

### AI 处理流程重构
- **市场情绪分析**: 分析财经社交媒体情绪
- **板块轮动分析**: 识别当日热点板块
- **地缘政治影响评估**: 分析重大事件对市场影响
- **个股/板块摘要**: 智能生成每日关注标的摘要
- **投资观点聚合**: 汇总主流金融博主观点

### 报告形式重构
- **每日市场概述**: 三大指数涨跌、成交额、热点板块
- **个股/板块详情**: 重点关注标的当日动态
- **地缘政治影响**: 重大事件及受益板块
- **社交媒体声音**: 金融博主观点精选
- **明日展望**: AI 智能预测

## Impact

### 受影响的功能模块
- `src/dataSources/*` - 全部替换为金融数据源
- `src/handlers/genAIContent.js` - 改造为金融内容生成
- `src/prompt/*` - 全部替换为金融分析提示词
- `src/handlers/getContent.js` - 适配新的分类体系
- `src/htmlGenerators.js` - 适配金融日报UI

### 新增模块
- `src/dataSources/financialNews.js` - 财经媒体聚合
- `src/dataSources/stockMarket.js` - 股票行情数据
- `src/dataSources/geopolitics.js` - 地缘政治新闻
- `src/dataSources/socialSentiment.js` - 社交媒体情绪
- `src/dataSources/commodities.js` - 大宗商品数据
- `src/prompt/financialAnalysisPrompt.js` - 金融分析提示词

## ADDED Requirements

### Requirement: 金融数据源管理
系统 SHALL 提供多种金融数据源的配置和管理能力

#### Scenario: 配置股票数据源
- **WHEN** 管理员配置股票行情 API 数据源
- **THEN** 系统能够获取道琼斯、纳斯达克、标普500指数数据及涨跌幅

### Requirement: 地缘政治事件影响分析
系统 SHALL 能够识别重大地缘政治事件并评估其对市场的影响

#### Scenario: 地缘政治事件分析
- **WHEN** 霍尔木兹海峡封锁新闻出现
- **THEN** 系统识别为原油/能源板块重大利好，并推荐相关受益标的

### Requirement: 金融社交媒体情绪聚合
系统 SHALL 能够抓取并分析 X/Twitter 金融博主的观点和情绪

#### Scenario: 社交媒体情绪分析
- **WHEN** 系统抓取多个金融博主对特斯拉的讨论
- **THEN** 生成该标的当日情绪评分（看涨/看跌/中性）

### Requirement: 每日金融日报生成
系统 SHALL 能够根据当日金融数据生成结构化日报

#### Scenario: 日报生成
- **WHEN** 用户请求生成某日金融日报
- **THEN** 系统输出包含：市场概述、热点板块、个股动态、地缘政治影响、社交媒体声音的完整日报

## MODIFIED Requirements

### Requirement: 内容选择界面
用户能够浏览当日各类金融新闻并选择感兴趣的内容进行深度分析

### Requirement: 报告历史管理
系统 SHALL 保存每日生成的金融日报供历史查询

## REMOVED Requirements

### Requirement: AI/科技新闻分类
**Reason**: 项目定位从AI新闻转向金融新闻
**Migration**: 原有数据源配置需替换为金融类数据源

### Requirement: AI播客脚本生成
**Reason**: 金融日报不需要播客形式，保留简洁的文本报告即可
**Migration**: 移除 podcast 相关功能
