import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const FinancialNewsDataSource = {
    type: 'financialNews',
    fetch: async (env, foloCookie) => {
        const filterDays = parseInt(env.FOLO_FILTER_DAYS || '3', 10);
        return await this.fetchFromRss(env, filterDays);
    },

    fetchFromRss: async (env, filterDays) => {
        const allItems = [];
        
        const rssFeeds = [
            { url: 'https://www.jiemian.com/rss/news.xml', name: '界面新闻' },
            { url: 'https://www.yicai.com/rss/', name: '第一财经' },
            { url: 'https://www.ftchinese.com/rss/news', name: 'FT中文网' },
            { url: 'https://www.caixin.com/rss/rss_finance.xml', name: '财新网' },
        ];

        for (const feed of rssFeeds) {
            try {
                console.log(`Fetching RSS: ${feed.name}`);
                const response = await fetch(feed.url, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                    }
                });

                if (!response.ok) {
                    console.error(`Failed to fetch ${feed.name}: ${response.status}`);
                    continue;
                }

                const text = await response.text();
                const items = this.parseRssXml(text, feed.name);
                console.log(`${feed.name}: found ${items.length} items`);
                allItems.push(...items.slice(0, 10));
            } catch (error) {
                console.error(`Error fetching ${feed.name}:`, error.message);
            }
            await sleep(500);
        }

        console.log(`Total financial news items: ${allItems.length}`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Financial News", items: allItems };
    },

    parseRssXml: (xmlText, sourceName) => {
        const items = [];
        try {
            const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
            
            for (const itemXml of itemMatches) {
                const getText = (tag) => {
                    const match = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i'));
                    return match ? match[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : '';
                };

                const title = getText('title');
                const link = getText('link');
                const description = getText('description');
                const pubDate = getText('pubDate');

                if (title && link) {
                    items.push({
                        id: link,
                        url: link,
                        title: title,
                        content_html: description || title,
                        date_published: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                        authors: [{ name: sourceName }],
                        source: sourceName,
                    });
                }
            }
        } catch (error) {
            console.error(`Error parsing RSS for ${sourceName}:`, error.message);
        }
        return items;
    },

    transform: (rawData, sourceType) => {
        if (!rawData || !rawData.items) return [];
        return rawData.items.map(item => ({
            id: item.id || item.url,
            type: sourceType,
            url: item.url,
            title: item.title,
            description: stripHtml(item.content_html || "").substring(0, 500),
            published_date: item.date_published,
            authors: item.authors ? item.authors.map(a => a.name).join(', ') : 'Unknown',
            source: item.source || 'Financial News',
            details: { content_html: item.content_html || "" }
        }));
    },

    generateHtml: (item) => {
        return `<strong>${escapeHtml(item.title)}</strong><br><small>来源: ${escapeHtml(item.source)} | ${formatDateToChineseWithTime(item.published_date)}</small><div class="content-html">${item.details.content_html?.substring(0, 300) || ''}...</div><a href="${escapeHtml(item.url)}" target="_blank">阅读更多</a>`;
    }
};

export default FinancialNewsDataSource;
