import FinancialNewsDataSource from './dataSources/financialNews.js';
import GeopoliticsDataSource from './dataSources/geopolitics.js';
import StockMarketDataSource from './dataSources/stockMarket.js';
import CommoditiesDataSource from './dataSources/commodities.js';
import SocialSentimentDataSource from './dataSources/socialSentiment.js';

export const dataSources = {
    financialNews: { name: '财经新闻', sources: [FinancialNewsDataSource] },
    geopolitics: { name: '地缘政治', sources: [GeopoliticsDataSource] },
    stock: { name: '股票市场', sources: [StockMarketDataSource] },
    commodities: { name: '大宗商品', sources: [CommoditiesDataSource] },
    sentiment: { name: '市场情绪', sources: [SocialSentimentDataSource] },
};

export async function fetchAndTransformDataForType(sourceType, env, foloCookie) {
    const sources = dataSources[sourceType]?.sources;
    if (!sources || !Array.isArray(sources)) {
        console.error(`No data sources registered for type: ${sourceType}`);
        return [];
    }

    let allUnifiedDataForType = [];
    for (const dataSource of sources) {
        try {
            const rawData = await dataSource.fetch(env, foloCookie);
            const unifiedData = dataSource.transform(rawData, sourceType);
            allUnifiedDataForType = allUnifiedDataForType.concat(unifiedData);
        } catch (error) {
            console.error(`Error fetching or transforming data from source ${dataSource.type} for type ${sourceType}:`, error.message);
        }
    }

    allUnifiedDataForType.sort((a, b) => {
        const dateA = new Date(a.published_date);
        const dateB = new Date(b.published_date);
        return dateB.getTime() - dateA.getTime();
    });

    return allUnifiedDataForType;
}

export async function fetchAllData(env, foloCookie) {
    const allUnifiedData = {};
    const fetchPromises = [];

    for (const sourceType in dataSources) {
        if (Object.hasOwnProperty.call(dataSources, sourceType)) {
            fetchPromises.push(
                fetchAndTransformDataForType(sourceType, env, foloCookie).then(data => {
                    allUnifiedData[sourceType] = data;
                })
            );
        }
    }
    await Promise.allSettled(fetchPromises);
    return allUnifiedData;
}

export async function fetchDataByCategory(env, category, foloCookie) {
    if (!dataSources[category]) {
        console.warn(`Attempted to fetch data for unknown category: ${category}`);
        return [];
    }
    return await fetchAndTransformDataForType(category, env, foloCookie);
}
