import { getRandomUserAgent, sleep, isDateWithinLastDays, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const FinancialNewsDataSource = {
    type: 'financialNews',
    fetch: async (env, foloCookie) => {
        const listId = env.FINANCIAL_NEWS_LIST_ID;
        const fetchPages = parseInt(env.FINANCIAL_FETCH_PAGES || '2', 10);
        const allNewsItems = [];
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
                    console.log(`Fetching Financial News from Folo, page ${i + 1}...`);
                    const response = await fetch(env.FOLO_DATA_API, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) break;
                    const data = await response.json();
                    if (data && data.data && data.data.length > 0) {
                        const filteredItems = data.data.filter(entry => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
                        allNewsItems.push(...filteredItems.map(entry => ({
                            id: entry.entries.id,
                            url: entry.entries.url,
                            title: entry.entries.title,
                            content_html: entry.entries.content,
                            date_published: entry.entries.publishedAt,
                            authors: [{ name: entry.entries.author }],
                            source: entry.entries.author ? `${entry.feeds.title} - ${entry.entries.author}` : entry.feeds.title,
                        })));
                        publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
                    } else {
                        break;
                    }
                } catch (error) {
                    console.error(`Error fetching Financial News, page ${i + 1}:`, error);
                    break;
                }
                await sleep(Math.random() * 3000);
            }
        }

        if (allNewsItems.length === 0) {
            return await this.fetchFromRss(env, filterDays);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Financial News", items: allNewsItems };
    },

    fetchFromRss: async (env, filterDays) => {
        const rssFeeds = [
            { url: 'https://wallstreetcn.com/news/global', name: '华尔街见闻', type: 'scrape' },
            { url: 'https://www.jiemian.com/rss/news.xml', name: '界面新闻', type: 'rss' },
            { url: 'https://www.yicai.com/rss/', name: '第一财经', type: 'rss' },
            { url: 'https://www.ftchinese.com/rss/news', name: 'FT中文网', type: 'rss' },
            { url: 'https://cn.reutersagency.com/feed/', name: '路透中文', type: 'rss' },
            { url: 'https://www.caixin.com/rss/rss_finance.xml', name: '财新网', type: 'rss' },
        ];

        const allItems = [];

        for (const feed of rssFeeds) {
            try {
                console.log(`Fetching: ${feed.name}`);
                const response = await fetch(feed.url, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': feed.type === 'rss' ? 'application/rss+xml, application/xml, text/xml, */*' : 'text/html',
                    }
                });

                if (!response.ok) {
                    console.error(`Failed to fetch ${feed.name}: ${response.statusText}`);
                    continue;
                }

                if (feed.type === 'rss') {
                    const text = await response.text();
                    const items = this.parseRssXml(text, feed.name);
                    const filteredItems = items.filter(item => isDateWithinLastDays(item.date_published, filterDays));
                    allItems.push(...filteredItems);
                }
            } catch (error) {
                console.error(`Error fetching ${feed.name}:`, error);
            }
            await sleep(Math.random() * 2000);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Financial News", items: allItems };
    },

    parseRssXml: (xmlText, sourceName) => {
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;

        while ((match = itemRegex.exec(xmlText)) !== null) {
            const itemXml = match[1];

            const getTagContent = (tag) => {
                const regex = new RegExp(`<${tag}[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/${tag}>|<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i');
                const tagMatch = itemXml.match(regex);
                return tagMatch ? (tagMatch[1] || tagMatch[2] || '').trim() : '';
            };

            const title = getTagContent('title');
            const link = getTagContent('link');
            const description = getTagContent('description');
            const pubDate = getTagContent('pubDate') || getTagContent('dc:date') || getTagContent('published');
            const author = getTagContent('author') || getTagContent('dc:creator') || sourceName;

            if (title && link) {
                items.push({
                    id: link || `${title}-${Date.now()}`,
                    url: link,
                    title: title.replace(/<!\[CDATA\[|\]\]>/gi, ''),
                    content_html: description.replace(/<!\[CDATA\[|\]\]>/gi, ''),
                    date_published: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    authors: [{ name: author.replace(/<!\[CDATA\[|\]\]>/gi, '') }],
                    source: sourceName,
                });
            }
        }

        return items;
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
            source: item.source || 'Financial News',
            details: { content_html: item.content_html || "" }
        }));
    },

    generateHtml: (item) => {
        return `<strong>${escapeHtml(item.title)}</strong><br><small>来源: ${escapeHtml(item.source || '未知')} | 发布日期: ${formatDateToChineseWithTime(item.published_date)}</small><div class="content-html">${item.details.content_html || '无内容。'}</div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">阅读更多</a>`;
    }
};

export default FinancialNewsDataSource;
