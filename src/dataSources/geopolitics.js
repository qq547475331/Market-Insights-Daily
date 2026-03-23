import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const GeopoliticsDataSource = {
    type: 'geopolitics',
    fetch: async (env) => {
        const allItems = [];
        
        const feeds = [
            { url: 'https://www.reutersagency.com/feed/?best-topics=world-news', name: '路透社国际' },
            { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
        ];

        const keywords = ['russia', 'ukraine', 'israel', 'iran', 'china', 'taiwan', 'war', 'conflict', 'military', 'sanction', 'oil', 'energy', '俄乌', '中东', '台海', '战争', '冲突'];

        for (const feed of feeds) {
            try {
                console.log(`Fetching: ${feed.name}`);
                const response = await fetch(feed.url, {
                    headers: { 'User-Agent': getRandomUserAgent(), 'Accept': 'application/xml' }
                });
                if (!response.ok) continue;

                const text = await response.text();
                const items = this.parseRss(text, feed.name);
                
                const filtered = items.filter(item => {
                    const txt = (item.title + ' ' + item.description).toLowerCase();
                    return keywords.some(k => txt.includes(k));
                });
                
                allItems.push(...filtered.slice(0, 5));
                console.log(`${feed.name}: ${filtered.length} relevant items`);
            } catch (error) {
                console.error(`Error ${feed.name}:`, error.message);
            }
            await sleep(500);
        }

        console.log(`Total geopolitics items: ${allItems.length}`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Geopolitics", items: allItems };
    },

    parseRss: (xml, source) => {
        const items = [];
        const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
        
        for (const itemXml of matches) {
            const get = (tag) => {
                const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i'));
                return m ? m[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : '';
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
                    authors: [{ name: source }],
                    source,
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
            description: stripHtml(item.content_html || "").substring(0, 500),
            published_date: item.date_published,
            authors: item.authors?.map(a => a.name).join(', ') || 'Unknown',
            source: item.source || 'News',
            details: { content_html: item.content_html || "" }
        }));
    },

    generateHtml: (item) => {
        return `<strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.source)} | ${formatDateToChineseWithTime(item.published_date)}</small><div class="content-html">${item.details.content_html?.substring(0, 300) || ''}...</div><a href="${escapeHtml(item.url)}" target="_blank">阅读更多</a>`;
    }
};

export default GeopoliticsDataSource;
