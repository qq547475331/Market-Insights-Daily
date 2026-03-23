import { getISODate, escapeHtml, stripHtml, removeMarkdownCodeBlock, formatDateToChinese, convertEnglishQuotesToChinese} from '../helpers.js';
import { getFromKV } from '../kv.js';
import { callChatAPIStream } from '../chatapi.js';
import { generateGenAiPageHtml } from '../htmlGenerators.js';
import { dataSources } from '../dataFetchers.js';
import { getSystemPromptFinancialAnalysis, getSystemPromptMarketSummary } from '../prompt/financialAnalysisPrompt.js';
import { insertFoot } from '../foot.js';
import { getDailyReportContent } from '../github.js';

export async function handleGenFinancialDailyReport(request, env) {
    let dateStr;
    let selectedItemsParams = [];
    let formData;
    let outputOfCall1 = null;

    let fullPromptForCall1_System = null;
    let fullPromptForCall1_User = null;
    let finalAiResponse = null;

    try {
        formData = await request.formData();
        const dateParam = formData.get('date');
        dateStr = dateParam ? dateParam : getISODate();
        selectedItemsParams = formData.getAll('selectedItems');

        if (selectedItemsParams.length === 0) {
            const errorHtml = generateGenAiPageHtml(env, '生成金融日报出错', '<p><strong>未选择任何内容。</strong> 请返回并选择至少一项内容。</p>', dateStr, true, null);
            return new Response(errorHtml, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        console.log(`Generating Financial Daily Report for ${selectedItemsParams.length} selected items from date ${dateStr}`);

        const allFetchedData = {};
        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(
                    getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then(data => {
                        allFetchedData[sourceType] = data || [];
                    })
                );
            }
        }
        await Promise.allSettled(fetchPromises);

        const selectedContentItems = [];
        let validItemsProcessedCount = 0;

        for (const selection of selectedItemsParams) {
            const [type, idStr] = selection.split(':');
            const itemsOfType = allFetchedData[type];
            const item = itemsOfType ? itemsOfType.find(dataItem => String(dataItem.id) === idStr) : null;

            if (item) {
                let itemText = "";
                switch (item.type) {
                    case 'financialNews':
                        itemText = `【财经新闻】来源: ${item.source}\n标题: ${item.title}\n发布时间: ${item.published_date}\n内容摘要: ${stripHtml(item.details?.content_html || item.content_html || '')}`;
                        break;
                    case 'geopolitics':
                        itemText = `【地缘政治】来源: ${item.source}\n地区: ${item.details?.region || '未知'}\n标题: ${item.title}\n发布时间: ${item.published_date}\n内容: ${stripHtml(item.details?.content_html || item.content_html || '')}`;
                        break;
                    case 'stock':
                        itemText = `【股票市场】${item.title}\n更新时间: ${item.published_date}\n详情: ${stripHtml(item.content_html || '')}`;
                        break;
                    case 'commodities':
                        itemText = `【大宗商品】${item.title}\n更新时间: ${item.published_date}\n详情: ${stripHtml(item.content_html || '')}`;
                        break;
                    case 'sentiment':
                        itemText = `【市场情绪】来源: ${item.source}\n情绪: ${item.details?.sentiment || 'neutral'}\n标题: ${item.title}\n发布时间: ${item.published_date}\n内容: ${stripHtml(item.details?.content_html || item.content_html || '')}`;
                        break;
                    default:
                        itemText = `【${item.type || '未知'}】标题: ${item.title || 'N/A'}\n来源: ${item.source || 'N/A'}\n发布时间: ${item.published_date || 'N/A'}\n内容: ${stripHtml(item.content_html || item.details?.content_html || '')}`;
                        break;
                }

                if (itemText) {
                    selectedContentItems.push(itemText);
                    validItemsProcessedCount++;
                }
            } else {
                console.warn(`Could not find item for selection: ${selection} on date ${dateStr}.`);
            }
        }

        if (validItemsProcessedCount === 0) {
            const errorHtml = generateGenAiPageHtml(env, '生成金融日报出错', '<p><strong>所选内容无法获取或没有内容。</strong> 请检查数据或尝试不同的选择。</p>', dateStr, true, selectedItemsParams);
            return new Response(errorHtml, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        fullPromptForCall1_System = getSystemPromptFinancialAnalysis(env);
        fullPromptForCall1_User = selectedContentItems.join('\n\n---\n\n');

        console.log("Generating Financial Daily Report... User prompt length:", fullPromptForCall1_User.length);
        try {
            let processedChunks = [];
            for await (const chunk of callChatAPIStream(env, fullPromptForCall1_User, fullPromptForCall1_System)) {
                processedChunks.push(chunk);
            }
            outputOfCall1 = processedChunks.join('');
            if (!outputOfCall1 || outputOfCall1.trim() === "") throw new Error("AI analysis returned empty content.");
            outputOfCall1 = removeMarkdownCodeBlock(outputOfCall1);
            console.log("Financial Report generation successful. Output length:", outputOfCall1.length);
        } catch (error) {
            console.error("Error generating Financial Report:", error);
            const errorHtml = generateGenAiPageHtml(env, '生成金融日报出错', `<p><strong>生成失败:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, fullPromptForCall1_System, fullPromptForCall1_User);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        let promptsMarkdownContent = `# 金融日报生成 Prompt - ${dateStr}\n\n`;
        promptsMarkdownContent += `## System Instruction\n\n\`\`\`\n${fullPromptForCall1_System}\n\`\`\`\n\n`;
        promptsMarkdownContent += `## User Input\n\n\`\`\`\n${fullPromptForCall1_User}\n\`\`\`\n\n`;

        let dailyReportMarkdownContent = `# 📈 金融日报\n\n`;
        dailyReportMarkdownContent += `**日期**: ${formatDateToChinese(dateStr)}\n\n`;
        dailyReportMarkdownContent += `> 本报告由AI自动生成，仅供参考，不构成投资建议。\n\n---\n\n`;
        dailyReportMarkdownContent += outputOfCall1;

        if (env.INSERT_FOOT === 'true') dailyReportMarkdownContent += '\n\n' + insertFoot();

        const successHtml = generateGenAiPageHtml(
            env,
            '金融日报',
            escapeHtml(outputOfCall1),
            dateStr, false, selectedItemsParams,
            fullPromptForCall1_System, fullPromptForCall1_User,
            null, null,
            convertEnglishQuotesToChinese(removeMarkdownCodeBlock(promptsMarkdownContent)),
            convertEnglishQuotesToChinese(dailyReportMarkdownContent),
            null
        );
        return new Response(successHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /genFinancialDailyReport (outer try-catch):", error);
        const pageDateForError = dateStr || getISODate();
        const itemsForActionOnError = Array.isArray(selectedItemsParams) ? selectedItemsParams : [];
        const errorHtml = generateGenAiPageHtml(env, '生成金融日报出错', `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, pageDateForError, true, itemsForActionOnError, fullPromptForCall1_System, fullPromptForCall1_User);
        return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}

export async function handleGenAIContent(request, env) {
    return handleGenFinancialDailyReport(request, env);
}

export async function handleGenAIPodcastScript(request, env) {
    return new Response('播客功能已移除，金融日报以文本形式提供。', { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function handleGenAIDailyAnalysis(request, env) {
    let dateStr;
    let userPromptData = '';
    let fullPromptForAnalysis_System = null;
    let finalAiResponse = null;

    try {
        const requestBody = await request.json();
        dateStr = requestBody.date || getISODate();
        const summarizedContent = requestBody.summarizedContent;

        if (!summarizedContent || !summarizedContent.trim()) {
            return new Response('未提供内容进行分析。', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        userPromptData = summarizedContent;
        fullPromptForAnalysis_System = getSystemPromptMarketSummary(env);

        console.log(`Generating AI market summary for date: ${dateStr}`);
        try {
            let analysisChunks = [];
            for await (const chunk of callChatAPIStream(env, userPromptData, fullPromptForAnalysis_System)) {
                analysisChunks.push(chunk);
            }
            finalAiResponse = analysisChunks.join('');
            if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("AI analysis returned empty content.");
            finalAiResponse = removeMarkdownCodeBlock(finalAiResponse);
            console.log("Market Summary successful. Final output length:", finalAiResponse.length);
        } catch (error) {
            console.error("Error in AI Market Summary:", error);
            return new Response(`市场分析失败: ${escapeHtml(error.message)}`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        return new Response(finalAiResponse, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /genAIDailyAnalysis:", error);
        return new Response(`服务器错误: ${escapeHtml(error.message)}`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}

export { handleGenAIDailyPage } from './genAIDailyPage.js';
