import { getRandomUserAgent, sleep, stripHtml, formatDateToChineseWithTime, escapeHtml } from '../helpers.js';

const DEFAULT_WATCH_LIST = 'VOO,QQQ,SPY,GLD,TLT,SGOV,NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META';

const StockMarketDataSource = {
    type: 'stock',
    fetch: async (env) => {
        const allItems = [];
        const watchList = (env.STOCK_WATCH_LIST || DEFAULT_WATCH_LIST).split(',').map(s => s.trim());
        
        console.log(`StockMarketDataSource: Starting to fetch ${watchList.length} symbols`);

        for (const symbol of watchList) {
            try {
                const quote = await this.fetchYahooQuote(symbol);
                if (quote && quote.price) {
                    allItems.push({
                        id: `stock-${symbol}-${Date.now()}`,
                        url: `https://finance.yahoo.com/quote/${symbol}`,
                        title: `${symbol}: $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
                        content_html: `<p><strong>${symbol}</strong></p><p>价格: $${quote.price.toFixed(2)} | 涨跌: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%</p>`,
                        date_published: new Date().toISOString(),
                        authors: [{ name: 'Yahoo Finance' }],
                        source: 'Yahoo Finance',
                        type: 'stock',
                        details: {
                            symbol: symbol,
                            price: quote.price,
                            changePercent: quote.changePercent,
                            currency: quote.currency || 'USD'
                        }
                    });
                    console.log(`✓ Stock ${symbol}: $${quote.price.toFixed(2)}`);
                } else {
                    console.log(`✗ Stock ${symbol}: No price data`);
                }
            } catch (error) {
                console.error(`Stock ${symbol} error:`, error.message);
            }
            await sleep(100);
        }

        console.log(`StockMarketDataSource: Fetched ${allItems.length} items`);
        return { version: "https://jsonfeed.org/version/1.1", title: "Stock Market", items: allItems };
    },

    fetchYahooQuote: async (symbol) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            console.log(`Yahoo API returned ${response.status} for ${symbol}`);
            return null;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];
        
        if (!result) {
            console.log(`No result for ${symbol}`);
            return null;
        }

        const meta = result.meta || {};
        const quotes = result.indicators?.quote?.[0];
        const closes = quotes?.close || [];
        
        const latestPrice = closes[closes.length - 1] || meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || closes[closes.length - 2] || latestPrice;
        
        if (!latestPrice || latestPrice === 0) {
            console.log(`No valid price for ${symbol}`);
            return null;
        }

        const change = latestPrice - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

        return {
            price: latestPrice,
            change: change,
            changePercent: changePercent,
            currency: meta.currency || 'USD'
        };
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
