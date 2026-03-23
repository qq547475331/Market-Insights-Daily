import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const CommoditiesDataSource = {
    type: 'commodities',
    fetch: async (env) => {
        const allItems = [];
        
        const commodities = [
            { symbol: 'GLD', name: '黄金ETF', category: 'precious' },
            { symbol: 'SLV', name: '白银ETF', category: 'precious' },
            { symbol: 'USO', name: '原油ETF', category: 'energy' },
            { symbol: 'UNG', name: '天然气ETF', category: 'energy' },
            { symbol: 'TLT', name: '20年国债ETF', category: 'bond' },
            { symbol: 'SGOV', name: '超短国债ETF', category: 'bond' },
        ];

        for (const item of commodities) {
            try {
                const quote = await this.fetchYahooQuote(item.symbol);
                if (quote && quote.price) {
                    allItems.push({
                        id: `commodity-${item.symbol}`,
                        url: `https://finance.yahoo.com/quote/${item.symbol}`,
                        title: `${item.name} (${item.symbol}): $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
                        content_html: `<p><strong>${item.name}</strong></p><p>价格: $${quote.price.toFixed(2)} | 涨跌: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%</p>`,
                        date_published: new Date().toISOString(),
                        authors: [{ name: 'Yahoo Finance' }],
                        source: 'Yahoo Finance',
                        category: item.category,
                        details: { symbol: item.symbol, name: item.name, price: quote.price, changePercent: quote.changePercent }
                    });
                    console.log(`✓ ${item.symbol}: $${quote.price.toFixed(2)}`);
                }
            } catch (error) {
                console.error(`Error ${item.symbol}:`, error.message);
            }
            await sleep(200);
        }

        console.log(`Total commodities items: ${allItems.length}`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Commodities", items: allItems };
    },

    fetchYahooQuote: async (symbol) => {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            const result = data.chart?.result?.[0];
            if (!result || !result.meta) return null;

            const meta = result.meta;
            const quotes = result.indicators?.quote?.[0];
            const closes = quotes?.close || [];
            
            const latestPrice = closes[closes.length - 1] || meta.regularMarketPrice;
            const previousClose = meta.chartPreviousClose || closes[closes.length - 2] || latestPrice;
            
            if (!latestPrice) return null;

            const change = latestPrice - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

            return { price: latestPrice, change, changePercent };
        } catch (error) {
            return null;
        }
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
            authors: 'Yahoo Finance',
            source: 'Yahoo Finance',
            details: item.details || {},
            category: item.category
        }));
    },

    generateHtml: (item) => {
        const cat = { precious: '贵金属', energy: '能源', bond: '国债' }[item.category] || '其他';
        return `<strong>${escapeHtml(item.title)}</strong><br><small>分类: ${cat}</small><div class="content-html">${item.content_html || ''}</div><a href="${escapeHtml(item.url)}" target="_blank">查看详情</a>`;
    }
};

export default CommoditiesDataSource;
