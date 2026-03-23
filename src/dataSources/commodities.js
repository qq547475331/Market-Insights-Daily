import { getRandomUserAgent, sleep, isDateWithinLastDays, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const CommoditiesDataSource = {
    type: 'commodities',
    fetch: async (env) => {
        const allItems = [];

        const commodities = [
            { symbol: 'GLD', name: '黄金ETF', category: 'precious', unit: 'USD' },
            { symbol: 'IAU', name: 'iShare黄金ETF', category: 'precious', unit: 'USD' },
            { symbol: 'SLV', name: '白银ETF', category: 'precious', unit: 'USD' },
            { symbol: 'USO', name: '原油ETF', category: 'energy', unit: 'USD' },
            { symbol: 'UNG', name: '天然气ETF', category: 'energy', unit: 'USD' },
            { symbol: 'DBB', name: '基础金属ETF', category: 'industrial', unit: 'USD' },
            { symbol: 'PDBC', name: '大宗商品ETF', category: 'broad', unit: 'USD' },
            { symbol: 'DBC', name: '大宗商品指数ETF', category: 'broad', unit: 'USD' },
            { symbol: 'TLT', name: '20年国债ETF', category: 'bond', unit: 'USD' },
            { symbol: 'SGOV', name: '超短国债ETF', category: 'bond', unit: 'USD' },
            { symbol: 'IEF', name: '7-10年国债ETF', category: 'bond', unit: 'USD' },
        ];

        for (const item of commodities) {
            try {
                const quote = await this.fetchYahooQuote(item.symbol);
                if (quote) {
                    allItems.push({
                        id: `commodity-${item.symbol}-${Date.now()}`,
                        url: `https://finance.yahoo.com/quote/${item.symbol}`,
                        title: `${item.name} (${item.symbol}): ${quote.currency || 'USD'} ${quote.price?.toFixed(2) || 'N/A'} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent?.toFixed(2) || '0.00'}%)`,
                        content_html: this.formatCommodityContent(quote, item),
                        date_published: new Date().toISOString(),
                        authors: [{ name: 'Yahoo Finance' }],
                        source: 'Yahoo Finance',
                        category: item.category,
                        details: {
                            symbol: item.symbol,
                            name: item.name,
                            price: quote.price || 0,
                            change: quote.change || 0,
                            changePercent: quote.changePercent || 0,
                            currency: quote.currency || 'USD',
                            previousClose: quote.previousClose || 0,
                            open: quote.open || 0,
                            dayHigh: quote.dayHigh || 0,
                            dayLow: quote.dayLow || 0,
                            volume: quote.volume || 0,
                        }
                    });
                }
            } catch (error) {
                console.error(`Error fetching ${item.symbol}:`, error.message);
            }
            await sleep(200);
        }

        return { version: "https://jsonfeed.org/version/1.1", title: "Commodities", items: allItems };
    },

    fetchYahooQuote: async (symbol) => {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            const result = data.chart?.result?.[0];
            if (!result) return null;

            const meta = result.meta || {};
            const quote = result.indicators?.quote?.[0] || {};
            const latestClose = quote.close?.[quote.close.length - 1] || meta.regularMarketPrice;
            const previousClose = meta.chartPreviousClose || meta.previousClose || latestClose;
            const change = latestClose - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

            return {
                price: latestClose,
                change: change,
                changePercent: changePercent,
                currency: meta.currency || 'USD',
                previousClose: previousClose,
                open: quote.open?.[quote.open.length - 1] || 0,
                dayHigh: quote.high?.[quote.high.length - 1] || 0,
                dayLow: quote.low?.[quote.low.length - 1] || 0,
                volume: quote.volume?.[quote.volume.length - 1] || 0,
            };
        } catch (error) {
            console.error(`Yahoo API error for ${symbol}:`, error.message);
            return null;
        }
    },

    formatCommodityContent: (quote, item) => {
        const changeEmoji = quote.change >= 0 ? '📈' : '📉';
        const changeSign = quote.change >= 0 ? '+' : '';
        const categoryLabel = { precious: '贵金属', energy: '能源', industrial: '工业金属', broad: '综合大宗', bond: '国债' }[item.category] || '其他';
        return `
            <p>${changeEmoji} <strong>${item.name}</strong> (${item.symbol}) - ${categoryLabel}</p>
            <p>当前价格: ${quote.price?.toFixed(2) || 'N/A'} ${quote.currency || 'USD'}</p>
            <p>涨跌额: ${changeSign}${quote.change?.toFixed(2) || '0.00'} (${changeSign}${quote.changePercent?.toFixed(2) || '0.00'}%)</p>
            <p>昨收: ${quote.previousClose?.toFixed(2) || 'N/A'} | 今开: ${quote.open?.toFixed(2) || 'N/A'}</p>
            <p>日内高点: ${quote.dayHigh?.toFixed(2) || 'N/A'} | 日内低点: ${quote.dayLow?.toFixed(2) || 'N/A'}</p>
            <p>成交量: ${quote.volume ? (quote.volume / 1000000).toFixed(2) + 'M' : 'N/A'}</p>
        `;
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
            source: item.source || 'Commodities',
            details: item.details || {},
            category: item.category || 'other'
        }));
    },

    generateHtml: (item) => {
        const categoryLabel = { precious: '贵金属', energy: '能源', industrial: '工业金属', broad: '综合大宗', bond: '国债' }[item.category] || '其他';
        return `<strong>${escapeHtml(item.title)}</strong><br><small>分类: ${categoryLabel} | 更新时间: ${formatDateToChineseWithTime(item.published_date)}</small><div class="content-html">${item.content_html || '无内容。'}</div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">查看详情</a>`;
    }
};

export default CommoditiesDataSource;
