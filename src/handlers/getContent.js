import { getISODate, formatDateToChinese, escapeHtml } from '../helpers.js';
import { getFromKV } from '../kv.js';
import { dataSources } from '../dataFetchers.js';
import { marked } from '../marked.esm.js';

export async function handleGetContent(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const dateStr = dateParam ? dateParam : getISODate();
    console.log(`Getting content for date: ${dateStr}`);
    try {
        const responseData = {
            date: dateStr,
            message: `Successfully retrieved data for ${dateStr}.`
        };

        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(
                    getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then(data => {
                        responseData[sourceType] = data || [];
                    })
                );
            }
        }
        await Promise.allSettled(fetchPromises);
        
        return new Response(JSON.stringify(responseData), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error("Error in /getContent:", error);
        return new Response(JSON.stringify({ success: false, message: "Failed to get content.", error: error.message, date: dateStr }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleGetDailyReport(request, env) {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date') || getISODate();
    
    try {
        const reportKey = `${dateStr}-report`;
        const report = await getFromKV(env.DATA_KV, reportKey);
        
        if (report && report.content_html) {
            return new Response(JSON.stringify({ success: true, content: report.content_html }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response(JSON.stringify({ success: false, content: null }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error in /getDailyReport:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

export function generateContentSelectionPageHtml(env, dateStr, allData, dataCategories) {
    const data = allData || {};
    const categories = Array.isArray(dataCategories) ? dataCategories : [];

    const tabButtonsHtml = categories.map((category, index) => `
        <div class="tab-buttons-wrapper">
            <button type="button" class="tab-button ${index === 0 ? 'active' : ''}" onclick="openTab(event, '${category.id}-tab')">${escapeHtml(category.name)}</button>
        </div>
    `).join('');

    const tabContentsHtml = categories.map((category, index) => `
        <div id="${category.id}-tab" class="tab-content ${index === 0 ? 'active' : ''}">
            ${generateHtmlListForContentPage(data[category.id], dateStr)}
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html lang="zh-Hans">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${formatDateToChinese(escapeHtml(dateStr))} 金融日报</title>
            <style>
                :root { --primary-color: #007bff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #343a40; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--light-gray); padding: 1rem; }
                .container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                h1 { font-size: 1.8rem; color: var(--dark-gray); }
                .submit-button { background: var(--primary-color); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 5px; cursor: pointer; }
                .submit-button:hover { background: #0056b3; }
                .tab-navigation { display: flex; flex-wrap: wrap; margin-bottom: 1rem; border-bottom: 1px solid var(--medium-gray); }
                .tab-buttons-wrapper { margin-right: 1rem; margin-bottom: 0.5rem; }
                .tab-button { background: transparent; border: none; border-bottom: 3px solid transparent; padding: 0.8rem 1rem; cursor: pointer; color: #555; }
                .tab-button.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                .item-list { list-style: none; padding: 0; }
                .item-card { margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--medium-gray); border-radius: 6px; background: #fff; }
                .item-content strong { font-size: 1.1rem; }
                .item-content small { color: #6c757d; display: block; margin: 0.2rem 0; }
                .item-content a { color: var(--primary-color); text-decoration: none; }
                .item-content a:hover { text-decoration: underline; }
                .content-html { margin-top: 0.5rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px; font-size: 0.9rem; }
                .error { color: #dc3545; background: #f8d7da; padding: 0.5rem; border-radius: 4px; }
                .status-bar { background: #e8f4fd; padding: 0.8rem; border-radius: 6px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
                .status-text { color: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header-bar">
                    <h1>📈 ${formatDateToChinese(escapeHtml(dateStr))} 金融日报</h1>
                    <button type="button" class="submit-button" onclick="location.reload()">刷新</button>
                </div>
                <div class="status-bar">
                    <span class="status-text">数据自动更新 | 每日北京时间 7:00 自动生成</span>
                </div>
                <div class="tab-navigation">
                    ${tabButtonsHtml}
                </div>
                ${tabContentsHtml}
            </div>
            <script>
                function openTab(evt, tabName) {
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
                    document.getElementById(tabName).classList.add('active');
                    evt.currentTarget.classList.add('active');
                }
            </script>
        </body>
        </html>
    `;
}

function generateHtmlListForContentPage(items, dateStr) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<p style="color: #666; padding: 1rem;">暂无数据。数据将在每日自动更新时获取。</p>';
    }

    let listHtml = '<ul class="item-list">';
    items.forEach((item) => {
        const dataSourceConfig = dataSources[item.type];
        const displayContent = dataSourceConfig?.sources?.[0]?.generateHtml?.(item) 
            || `<strong>${escapeHtml(item.title || '未知')}</strong>`;

        listHtml += `<li class="item-card"><div class="item-content">${displayContent}</div></li>`;
    });
    listHtml += '</ul>';
    return listHtml;
}
