// src/handlers/getContentHtml.js
import { getISODate, formatDateToChinese, escapeHtml } from '../helpers.js';
import { getFromKV } from '../kv.js';
import { dataSources } from '../dataFetchers.js';
import { generateContentSelectionPageHtml } from './getContent.js';

export async function handleGetContentHtml(request, env, dataCategories) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const dateStr = dateParam ? dateParam : getISODate();
    console.log(`Getting content HTML for date: ${dateStr}`);

    try {
        const allData = {};
        const fetchPromises = [];
        
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(
                    getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then(data => {
                        allData[sourceType] = data || [];
                    })
                );
            }
        }
        await Promise.allSettled(fetchPromises);

        const totalItems = Object.values(allData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        
        const html = generateContentSelectionPageHtml(env, dateStr, allData, dataCategories);
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    } catch (error) {
        console.error("Error in handleGetContentHtml:", error);
        return new Response(`<h1>Error</h1><p>${escapeHtml(error.message)}</p>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
}
