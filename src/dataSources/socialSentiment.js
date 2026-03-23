import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const SocialSentimentDataSource = {
    type: 'sentiment',
    fetch: async (env) => {
        const allItems = [];
        
        const subreddits = ['wallstreetbets', 'investing', 'stocks'];
        
        for (const subreddit of subreddits) {
            try {
                console.log(`Fetching Reddit r/${subreddit}...`);
                const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'application/json',
                    }
                });

                if (!response.ok) continue;

                const data = await response.json();
                const posts = data.data?.children || [];

                for (const post of posts) {
                    const p = post.data;
                    if (!p || !p.title) continue;

                    const text = p.title + ' ' + (p.selftext || '');
                    
                    allItems.push({
                        id: `reddit-${p.id}`,
                        url: `https://www.reddit.com${p.permalink}`,
                        title: p.title.substring(0, 200),
                        content_html: (p.selftext || p.title).substring(0, 500),
                        date_published: new Date(p.created_utc * 1000).toISOString(),
                        authors: [{ name: `u/${p.author}` }],
                        source: `Reddit r/${subreddit}`,
                        sentiment: this.analyzeSentiment(text),
                        mentions: this.extractMentions(text),
                    });
                }
                console.log(`r/${subreddit}: ${posts.length} posts`);
            } catch (error) {
                console.error(`Reddit r/${subreddit} error:`, error.message);
            }
            await sleep(500);
        }

        console.log(`Total sentiment items: ${allItems.length}`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Social Sentiment", items: allItems };
    },

    analyzeSentiment: (text) => {
        const lower = text.toLowerCase();
        const bullish = ['bullish', 'long', 'buy', 'calls', 'moon', 'rocket', 'buy the dip'];
        const bearish = ['bearish', 'short', 'sell', 'puts', 'crash', 'bubble'];
        
        let bullCount = bullish.filter(k => lower.includes(k)).length;
        let bearCount = bearish.filter(k => lower.includes(k)).length;
        
        if (bullCount > bearCount + 1) return 'bullish';
        if (bearCount > bullCount + 1) return 'bearish';
        return 'neutral';
    },

    extractMentions: (text) => {
        const tickers = text.match(/\$[A-Z]{1,5}\b/g) || [];
        return [...new Set(tickers.map(t => t.replace('$', '')))].slice(0, 5);
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
            source: item.source || 'Reddit',
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
