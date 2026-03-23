import { getRandomUserAgent, sleep, isDateWithinLastDays, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const SocialSentimentDataSource = {
    type: 'sentiment',
    fetch: async (env, foloCookie) => {
        const listId = env.SOCIAL_SENTIMENT_LIST_ID;
        const fetchPages = parseInt(env.SOCIAL_FETCH_PAGES || '2', 10);
        const allItems = [];
        const filterDays = parseInt(env.FOLO_FILTER_DAYS || '3', 10);

        if (listId && foloCookie) {
            let publishedAfter = null;
            for (let i = 0; i < fetchPages; i++) {
                const headers = {
                    'User-Agent': getRandomUserAgent(),
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'accept-language': 'zh-CN,zh;q=0.9',
                    'origin': 'https://app.follow.is',
                    'x-app-name': 'Folo Web',
                    'x-app-version': '0.4.9',
                    'Cookie': foloCookie
                };

                const body = { listId, view: 1, withContent: true };
                if (publishedAfter) body.publishedAfter = publishedAfter;

                try {
                    console.log(`Fetching Social Sentiment from Folo, page ${i + 1}...`);
                    const response = await fetch(env.FOLO_DATA_API, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) break;
                    const data = await response.json();
                    if (data && data.data && data.data.length > 0) {
                        const filteredItems = data.data.filter(entry => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
                        allItems.push(...filteredItems.map(entry => ({
                            id: entry.entries.id,
                            url: entry.entries.url,
                            title: entry.entries.title,
                            content_html: entry.entries.content,
                            date_published: entry.entries.publishedAt,
                            authors: [{ name: entry.entries.author }],
                            source: entry.entries.author || entry.feeds.title,
                            sentiment: this.analyzeSentiment(entry.entries.title + ' ' + entry.entries.content),
                            mentions: this.extractMentions(entry.entries.title + ' ' + entry.entries.content),
                        })));
                        publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
                    } else {
                        break;
                    }
                } catch (error) {
                    console.error(`Error fetching Social Sentiment, page ${i + 1}:`, error);
                    break;
                }
                await sleep(Math.random() * 3000);
            }
        }

        if (allItems.length === 0) {
            return await this.fetchFromPublicSources(env, filterDays);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Social Sentiment", items: allItems };
    },

    fetchFromPublicSources: async (env, filterDays) => {
        const allItems = [];

        const redditSubreddits = ['wallstreetbets', 'investing', 'stocks', 'options'];
        
        for (const subreddit of redditSubreddits) {
            try {
                console.log(`Fetching Reddit r/${subreddit}...`);
                const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'application/json',
                    }
                });

                if (!response.ok) continue;

                const data = await response.json();
                const posts = data.data?.children || [];

                for (const post of posts) {
                    const postData = post.data;
                    if (!postData || !postData.title) continue;

                    const text = postData.title + ' ' + (postData.selftext || '');
                    
                    allItems.push({
                        id: `reddit-${postData.id}`,
                        url: `https://www.reddit.com${postData.permalink}`,
                        title: postData.title,
                        content_html: postData.selftext || postData.title,
                        date_published: new Date(postData.created_utc * 1000).toISOString(),
                        authors: [{ name: `u/${postData.author}` }],
                        source: `Reddit r/${subreddit}`,
                        sentiment: this.analyzeSentiment(text),
                        mentions: this.extractMentions(text),
                    });
                }
            } catch (error) {
                console.error(`Error fetching Reddit r/${subreddit}:`, error);
            }
            await sleep(Math.random() * 2000);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Social Sentiment", items: allItems };
    },

    analyzeSentiment: (text) => {
        const bullishKeywords = ['bullish', 'long', 'buy', 'calls', 'moon', 'to the moon', 'upgrade', 'outperform', 'buy the dip', 'bull', 'rocket', 'calls only', 'yolo', 'diamond hands', '牛市', '看涨', '买入', '做多', '增持', '抄底'];
        const bearishKeywords = ['bearish', 'short', 'sell', 'puts', 'crash', 'downgrade', 'underperform', 'bubble', 'bear', 'bagholder', '熊市', '看跌', '卖出', '做空', '减持', '泡沫'];

        const lowerText = text.toLowerCase();
        let bullishCount = 0;
        let bearishCount = 0;

        for (const kw of bullishKeywords) {
            if (lowerText.includes(kw)) bullishCount++;
        }
        for (const kw of bearishKeywords) {
            if (lowerText.includes(kw)) bearishCount++;
        }

        if (bullishCount > bearishCount + 1) return 'bullish';
        if (bearishCount > bullishCount + 1) return 'bearish';
        return 'neutral';
    },

    extractMentions: (text) => {
        const stockPattern = /\$([A-Z]{1,5})\b/g;
        const matches = text.match(stockPattern) || [];
        const tickerPattern = /\b([A-Z]{2,4})\b/g;
        const tickerMatches = text.match(tickerPattern) || [];
        
        const allMatches = [...matches.map(m => m.replace('$', '')), ...tickerMatches];
        const commonWords = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'CEO', 'CFO', 'IPO', 'ETF', 'GDP', 'CPI', 'FOMC', 'SEC', 'FDA', 'USA', 'UK', 'EU', 'UN', 'NATO', 'OPEC', 'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'WAS', 'HAS', 'HAD', 'BUT', 'CAN', 'DID', 'GET', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'ONE', 'OUR', 'OUT', 'SEE', 'WAY', 'WHO', 'WHY', 'YES', 'YOU'];
        
        return [...new Set(allMatches.filter(m => !commonWords.includes(m) && m.length >= 2 && m.length <= 5))].slice(0, 10);
    },

    transform: (rawData, sourceType) => {
        if (!rawData || !rawData.items) return [];
        return rawData.items.map(item => ({
            id: item.id,
            type: sourceType,
            url: item.url,
            title: item.title,
            description: stripHtml(item.content_html || ""),
            published_date: item.date_published,
            authors: item.authors ? item.authors.map(author => author.name).join(', ') : 'Unknown',
            source: item.source || 'Social Media',
            details: {
                content_html: item.content_html || "",
                sentiment: item.sentiment || 'neutral',
                mentions: item.mentions || []
            }
        }));
    },

    generateHtml: (item) => {
        const sentimentEmoji = { bullish: '🟢', bearish: '🔴', neutral: '🟡' }[item.details.sentiment] || '🟡';
        const sentimentLabel = { bullish: '看涨', bearish: '看跌', neutral: '中性' }[item.details.sentiment] || '中性';
        const mentionsHtml = item.details.mentions?.length ? `<p>提及标的: ${item.details.mentions.map(m => `<strong>${escapeHtml(m)}</strong>`).join(', ')}</p>` : '';
        return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>来源: ${escapeHtml(item.source || '未知')} | 发布日期: ${formatDateToChineseWithTime(item.published_date)}</small><br>
            <span>情绪: ${sentimentEmoji} ${sentimentLabel}</span>
            ${mentionsHtml}
            <div class="content-html">${item.details.content_html || '无内容。'}</div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">阅读更多</a>
        `;
    }
};

export default SocialSentimentDataSource;
