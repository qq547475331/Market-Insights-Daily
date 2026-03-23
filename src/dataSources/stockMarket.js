import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const StockMarketDataSource = {
    type: 'stock',
    fetch: async (env) => {
        const allItems = [];
        
        const symbols = [
            { symbol: 'VOO', name: '标普500 ETF' },
            { symbol: 'QQQ', name: '纳斯达克100 ETF' },
            { symbol: 'SPY', name: 'SPDR标普500' },
            { symbol: 'GLD', name: '黄金ETF' },
            { symbol: 'TLT', name: '20年国债ETF' },
            { symbol: 'SGOV', name: '超短国债ETF' },
            { symbol: 'NVDA', name: '英伟达' },
            { symbol: 'TSLA', name: '特斯拉' },
            { symbol: 'AAPL', name: '苹果' },
            { symbol: 'MSFT', name: '微软' },
            { symbol: 'GOOGL', name: '谷歌' },
            { symbol: 'AMZN', name: '亚马逊' },
            { symbol: 'META', name: 'Meta' },
        ];

        for (const item of symbols) {
            try {
                const quote = await this.fetchYahooQuote(item.symbol);
                if (quote && quote.price) {
                    allItems.push({
                        id: `stock-${item.symbol}`,
                        url: `https://finance.yahoo.com/quote/${item.symbol}`,
                        title: `${item.name} (${item.symbol}): $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
                        content_html: `<p><strong>${item.name}</strong> (${item.symbol})</p><p>价格: $${quote.price.toFixed(2)} | 涨跌: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%</p>`,
                        date_published: new Date().toISOString(),
                        authors: [{ name: 'Yahoo Finance' }],
                        source: 'Yahoo Finance',
                        type: 'etf',
                        details: { symbol: item.symbol, name: item.name, price: quote.price, changePercent: quote.changePercent }
                    });
                    console.log(`✓ ${item.symbol}: $${quote.price.toFixed(2)}`);
                }
            } catch (error) {
                console.error(`Error ${item.symbol}:`, error.message);
            }
            await sleep(200);
        }

        console.log(`Total stock items: ${allItems.length}`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Stock Market", items: allItems };
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

            return { price: latestPrice, change, changePercent, currency: meta.currency || 'USD' };
        } catch (error) {
            console.error(`Yahoo API error ${symbol}:`, error.message);
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
            details: item.details || {}
        }));
    },

    generateHtml: (item) => {
        return `<strong>${escapeHtml(item.title)}</strong><br><small>来源: Yahoo Finance</small><div class="content-html">${item.content_html || ''}</div><a href="${escapeHtml(item.url)}" target="_blank">查看详情</a>`;
    }
};

export default StockMarketDataSource;
