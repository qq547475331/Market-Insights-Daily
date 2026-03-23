import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

// Reddit API 在 Cloudflare Workers 中被封锁，使用替代数据源
const SocialSentimentDataSource = {
    type: 'sentiment',
    fetch: async (env) => {
        const allItems = [];
        
        // 使用替代的金融新闻源作为"市场情绪"数据
        const sources = [
            { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', name: 'BBC Tech' },
            { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', name: 'NYT Tech' },
        ];

        const keywords = ['stock', 'market', 'invest', 'trade', 'bull', 'bear', 'crypto', 'bitcoin', 'nvidia', 'apple', 'tesla', 'microsoft', 'google', 'amazon', 'meta'];

        for (const source of sources) {
            try {
                console.log(`Fetching sentiment source: ${source.name}`);
                const response = await fetch(source.url, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'application/rss+xml, application/xml, */*',
                    }
                });

                if (!response.ok) continue;

                const text = await response.text();
                const items = this.parseRss(text, source.name);
                
                // 过滤包含金融关键词的文章
                const filtered = items.filter(item => {
                    const txt = (item.title + ' ' + item.description).toLowerCase();
                    return keywords.some(k => txt.includes(k));
                });

                for (const item of filtered.slice(0, 5)) {
                    allItems.push({
                        id: item.id,
                        url: item.url,
                        title: item.title,
                        content_html: item.content_html,
                        date_published: item.date_published,
                        authors: [{ name: source.name }],
                        source: source.name,
                        sentiment: this.analyzeSentiment(item.title + ' ' + item.description),
                        mentions: this.extractMentions(item.title + ' ' + item.description),
                    });
                }
                console.log(`${source.name}: ${filtered.length} relevant items`);
            } catch (error) {
                console.error(`Error ${source.name}:`, error.message);
            }
            await sleep(300);
        }

        console.log(`SocialSentimentDataSource: Fetched ${allItems.length} items`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Social Sentiment", items: allItems };
    },

    parseRss: (xml, source) => {
        const items = [];
        const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
        
        for (const itemXml of matches) {
            const get = (tag) => {
                const patterns = [
                    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
                    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
                ];
                for (const p of patterns) {
                    const m = itemXml.match(p);
                    if (m && m[1]) return m[1].trim();
                }
                return '';
            };

            const title = get('title');
            const link = get('link');
            const desc = get('description');
            const date = get('pubDate');

            if (title && link) {
                items.push({
                    id: link,
                    url: link,
                    title,
                    content_html: desc || title,
                    date_published: date ? new Date(date).toISOString() : new Date().toISOString(),
                    description: desc
                });
            }
        }
        return items;
    },

    analyzeSentiment: (text) => {
        const lower = text.toLowerCase();
        const bullish = ['bullish', 'long', 'buy', 'calls', 'moon', 'rocket', 'surge', 'rally', 'gain', 'up', 'rise'];
        const bearish = ['bearish', 'short', 'sell', 'puts', 'crash', 'bubble', 'drop', 'fall', 'down', 'loss'];
        
        let bullCount = bullish.filter(k => lower.includes(k)).length;
        let bearCount = bearish.filter(k => lower.includes(k)).length;
        
        if (bullCount > bearCount) return 'bullish';
        if (bearCount > bullCount) return 'bearish';
        return 'neutral';
    },

    extractMentions: (text) => {
        const tickers = [];
        const symbols = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'BTC', 'ETH', 'VOO', 'QQQ', 'SPY'];
        const upper = text.toUpperCase();
        for (const s of symbols) {
            if (upper.includes(s)) tickers.push(s);
        }
        return [...new Set(tickers)].slice(0, 5);
    },

    transform: (rawData, sourceType) => {
        if (!rawData || !rawData.items) return [];
        return rawData.items.map(item => ({
            id: item.id,
            type: sourceType,
            url: item.url,
            title: item.title,
            description: stripHtml(item.content_html || "").substring(0, 300),
            published_date: item.date_published,
            authors: item.authors?.map(a => a.name).join(', ') || 'Unknown',
            source: item.source || 'News',
            details: {
                content_html: item.content_html || "",
                sentiment: item.sentiment || 'neutral',
                mentions: item.mentions || []
            }
        }));
    },

    generateHtml: (item) => {
        const emoji = { bullish: '🟢', bearish: '🔴', neutral: '🟡' }[item.details.sentiment] || '🟡';
        const label = { bullish: '看涨', bearish: '看跌', neutral: '中性' }[item.details.sentiment] || '中性';
        const mentions = item.details.mentions?.length ? `<br>提及: ${item.details.mentions.join(', ')}` : '';
        return `<strong>${escapeHtml(item.title)}</strong><br><small>${item.source} | 情绪: ${emoji}${label}${mentions}</small><div class="content-html">${item.details.content_html?.substring(0, 200) || ''}...</div><a href="${escapeHtml(item.url)}" target="_blank">阅读更多</a>`;
    }
};

export default SocialSentimentDataSource;
