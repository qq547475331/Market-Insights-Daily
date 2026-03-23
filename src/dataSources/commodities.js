import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const CommoditiesDataSource = {
    type: 'commodities',
    fetch: async (env) => {
        const allItems = [];
        
        const commodities = [
            { symbol: 'GLD', name: '黄金ETF' },
            { symbol: 'SLV', name: '白银ETF' },
            { symbol: 'USO', name: '原油ETF' },
            { symbol: 'UNG', name: '天然气ETF' },
            { symbol: 'TLT', name: '20年国债ETF' },
            { symbol: 'SGOV', name: '超短国债ETF' },
        ];

        console.log(`CommoditiesDataSource: Starting to fetch ${commodities.length} symbols`);

        for (const item of commodities) {
            try {
                const quote = await this.fetchYahooQuote(item.symbol);
                if (quote && quote.price) {
                    allItems.push({
                        id: `commodity-${item.symbol}-${Date.now()}`,
                        url: `https://finance.yahoo.com/quote/${item.symbol}`,
                        title: `${item.name} (${item.symbol}): $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
                        content_html: `<p><strong>${item.name}</strong> (${item.symbol})</p><p>价格: $${quote.price.toFixed(2)} | 涨跌: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%</p>`,
                        date_published: new Date().toISOString(),
                        authors: [{ name: 'Yahoo Finance' }],
                        source: 'Yahoo Finance',
                        category: 'commodity',
                        details: { symbol: item.symbol, name: item.name, price: quote.price, changePercent: quote.changePercent }
                    });
                    console.log(`✓ Commodity ${item.symbol}: $${quote.price.toFixed(2)}`);
                } else {
                    console.log(`✗ Commodity ${item.symbol}: No price data`);
                }
            } catch (error) {
                console.error(`Commodity ${item.symbol} error:`, error.message);
            }
            await sleep(100);
        }

        console.log(`CommoditiesDataSource: Fetched ${allItems.length} items`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Commodities", items: allItems };
    },

    fetchYahooQuote: async (symbol) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta || {};
        const quotes = result.indicators?.quote?.[0];
        const closes = quotes?.close || [];
        
        const latestPrice = closes[closes.length - 1] || meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || closes[closes.length - 2] || latestPrice;
        
        if (!latestPrice || latestPrice === 0) return null;

        const change = latestPrice - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

        return { price: latestPrice, change, changePercent };
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
        return `<strong>${escapeHtml(item.title)}</strong><br><small>来源: Yahoo Finance</small><div class="content-html">${item.content_html || ''}</div><a href="${escapeHtml(item.url)}" target="_blank">查看详情</a>`;
    }
};

export default CommoditiesDataSource;
