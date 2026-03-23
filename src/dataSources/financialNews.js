import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const FinancialNewsDataSource = {
    type: 'financialNews',
    fetch: async (env) => {
        const allItems = [];
        
        // 使用更可靠的 RSS 源
        const rssFeeds = [
            { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business' },
            { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', name: 'NYT Business' },
            { url: 'https://www.investing.com/rss/news.rss', name: 'Investing.com' },
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
            await sleep(300);
        }

        console.log(`FinancialNewsDataSource: Fetched ${allItems.length} items`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Financial News", items: allItems };
    },

    parseRssXml: (xmlText, sourceName) => {
        const items = [];
        try {
            // 更健壮的 XML 解析
            const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
            
            for (const itemXml of itemMatches) {
                const getText = (tag) => {
                    // 支持 CDATA 和普通文本
                    const patterns = [
                        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
                        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
                    ];
                    
                    for (const pattern of patterns) {
                        const match = itemXml.match(pattern);
                        if (match && match[1]) {
                            return match[1].trim();
                        }
                    }
                    return '';
                };

                const title = getText('title');
                let link = getText('link');
                const description = getText('description');
                const pubDate = getText('pubDate');

                // 有些 RSS link 在 <guid> 或其他地方
                if (!link) {
                    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i);
                    if (guidMatch && guidMatch[1].startsWith('http')) {
                        link = guidMatch[1].trim();
                    }
                }

                if (title && link) {
                    items.push({
                        id: link || `news-${Date.now()}-${Math.random()}`,
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
