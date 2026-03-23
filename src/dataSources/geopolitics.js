import { getRandomUserAgent, sleep, isDateWithinLastDays, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const GeopoliticsDataSource = {
    type: 'geopolitics',
    fetch: async (env, foloCookie) => {
        const listId = env.GEOPOLITICS_LIST_ID;
        const fetchPages = parseInt(env.GEOPOLITICS_FETCH_PAGES || '2', 10);
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
                    console.log(`Fetching Geopolitics from Folo, page ${i + 1}...`);
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
                            region: this.categorizeRegion(entry.entries.title + ' ' + entry.entries.content),
                        })));
                        publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
                    } else {
                        break;
                    }
                } catch (error) {
                    console.error(`Error fetching Geopolitics, page ${i + 1}:`, error);
                    break;
                }
                await sleep(Math.random() * 3000);
            }
        }

        if (allNewsItems.length === 0) {
            return await this.fetchFromRss(env, filterDays);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Geopolitical News", items: allNewsItems };
    },

    fetchFromRss: async (env, filterDays) => {
        const rssFeeds = [
            { url: 'https://www.reutersagency.com/feed/?best-topics=world-news', name: '路透社国际' },
            { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
            { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World' },
            { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: '半岛电视台' },
        ];

        const allItems = [];
        for (const feed of rssFeeds) {
            try {
                console.log(`Fetching RSS: ${feed.name}`);
                const response = await fetch(feed.url, {
                    headers: { 'User-Agent': getRandomUserAgent(), 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
                });
                if (!response.ok) continue;
                const text = await response.text();
                const items = this.parseRssXml(text, feed.name);
                const filteredItems = items.filter(item => isDateWithinLastDays(item.date_published, filterDays));
                const relevantItems = filteredItems.filter(item => this.isRelevantGeopolitics(item.title + ' ' + item.description));
                allItems.push(...relevantItems.map(item => ({ ...item, region: this.categorizeRegion(item.title + ' ' + item.description) })));
            } catch (error) {
                console.error(`Error fetching RSS ${feed.name}:`, error);
            }
            await sleep(Math.random() * 2000);
        }
        return { version: "https://jsonfeed.org/version/1.1", title: "Geopolitical News", items: allItems };
    },

    isRelevantGeopolitics: (text) => {
        const keywords = ['russia', 'ukraine', 'putin', 'kremlin', 'israel', 'iran', 'hamas', 'hezbollah', 'gaza', 'taiwan', 'china', 'taiwan strait', 'hormuz', 'opec', 'sanction', 'war', 'military', 'nato', 'missile', 'nuclear', 'energy', 'oil', 'pipeline', 'red sea', 'houthi', 'middle east', 'conflict', '俄乌', '乌克兰', '俄罗斯', '以色列', '伊朗', '中东', '台海', '台湾', '霍尔木兹', '红海', '胡塞'];
        const lowerText = text.toLowerCase();
        return keywords.some(kw => lowerText.includes(kw));
    },

    categorizeRegion: (text) => {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('russia') || lowerText.includes('ukraine') || lowerText.includes('moscow') || lowerText.includes('kiev') || lowerText.includes('俄乌') || lowerText.includes('乌克兰') || lowerText.includes('俄罗斯')) return 'ukraine_russia';
        if (lowerText.includes('israel') || lowerText.includes('iran') || lowerText.includes('hamas') || lowerText.includes('hezbollah') || lowerText.includes('gaza') || lowerText.includes('以色列') || lowerText.includes('伊朗') || lowerText.includes('中东')) return 'middle_east';
        if (lowerText.includes('taiwan') || lowerText.includes('china') || lowerText.includes('taiwan strait') || lowerText.includes('台海') || lowerText.includes('台湾')) return 'taiwan_china';
        if (lowerText.includes('hormuz') || lowerText.includes('opec') || lowerText.includes('persian gulf') || lowerText.includes('red sea') || lowerText.includes('houthi') || lowerText.includes('霍尔木兹') || lowerText.includes('红海')) return 'energy';
        return 'other';
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
            const pubDate = getTagContent('pubDate') || getTagContent('dc:date');
            if (title) {
                items.push({
                    id: link || `${title}-${Date.now()}`,
                    url: link,
                    title: title.replace(/<!\[CDATA\[|\]\]>/gi, ''),
                    content_html: description.replace(/<!\[CDATA\[|\]\]>/gi, ''),
                    date_published: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    authors: [{ name: sourceName }],
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
            source: item.source || 'Geopolitics',
            details: { content_html: item.content_html || "", region: item.region || 'other' }
        }));
    },

    generateHtml: (item) => {
        const regionLabel = { ukraine_russia: '俄乌冲突', middle_east: '中东局势', taiwan_china: '台海局势', energy: '能源通道', other: '其他' }[item.details.region] || '其他';
        return `<strong>${escapeHtml(item.title)}</strong><br><small>来源: ${escapeHtml(item.source || '未知')} | 地区: ${regionLabel} | 发布日期: ${formatDateToChineseWithTime(item.published_date)}</small><div class="content-html">${item.details.content_html || '无内容。'}</div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">阅读更多</a>`;
    }
};

export default GeopoliticsDataSource;
