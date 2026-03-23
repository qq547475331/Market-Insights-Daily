import { replaceImageProxy, formatMarkdownText, formatDateToGMT8WithTime, removeMarkdownCodeBlock } from '../helpers.js';
import { getDailyReportContent, getGitHubFileSha, createOrUpdateGitHubFile } from '../github.js';
import { storeInKV } from '../kv.js';
import { marked } from '../marked.esm.js';
import { callChatAPI } from '../chatapi.js';
import { getSystemPromptMarketSummary } from "../prompt/financialAnalysisPrompt.js";
import { getAppUrl } from '../appUrl.js';

export async function handleGenerateRssContent(request, env) {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');
    console.log(`[generateRssContent] Received request for date: ${dateStr}`);

    if (!dateStr) {
        console.error('[generateRssContent] Missing date parameter');
        return new Response('Missing date parameter', { status: 400 });
    }

    try {
        const dailyPath = `daily/${dateStr}.md`;
        console.log(`[generateRssContent] Attempting to get content from GitHub path: ${dailyPath}`);
        let content = await getDailyReportContent(env, dailyPath);

        if (!content) {
            console.warn(`[generateRssContent] No content found for ${dailyPath}. Returning 404.`);
            return new Response(`No content found for ${dailyPath}`, { status: 404 });
        }
        console.log(`[generateRssContent] Successfully retrieved content for ${dailyPath}. Content length: ${content.length}`);

        content = extractContentFromSecondHash(content);

        const aiContent = await generateAIContent(env, content);

        const rssPath = `rss/${dateStr}.md`;
        const existingSha = await getGitHubFileSha(env, rssPath);
        const commitMessage = `${existingSha ? 'Update' : 'Create'} RSS content for ${dateStr}`;
        await createOrUpdateGitHubFile(env, rssPath, aiContent, commitMessage, existingSha);
        console.log(`[generateRssContent] Successfully wrote AI content to GitHub: ${rssPath}`);

        const yearMonth = dateStr.substring(0, 7);
        const result = {
            report_date: dateStr,
            title: dateStr + ' 金融日报',
            link: '/' + yearMonth + '/' + dateStr + '/',
            content_markdown: aiContent,
            github_path: rssPath,
            published_date: formatDateToGMT8WithTime(new Date())
        };

        console.log(`[generateRssContent] Successfully generated and saved content for ${dateStr}. Content length: ${aiContent.length}`);

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        console.error('[generateRssContent] Error generating content:', error.message, error.stack);
        return new Response(`Error generating content: ${error.message}`, { status: 500 });
    }
}

export async function handleWriteRssData(request, env) {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');
    console.log(`[writeRssData] Received request for date: ${dateStr}`);

    if (!dateStr) {
        console.error('[writeRssData] Missing date parameter');
        return new Response('Missing date parameter', { status: 400 });
    }

    try {
        const rssPath = `rss/${dateStr}.md`;
        console.log(`[writeRssData] Attempting to get content from GitHub path: ${rssPath}`);
        let content = await getDailyReportContent(env, rssPath);

        if (!content) {
            console.warn(`[writeRssData] No content found for ${rssPath}. Returning 404.`);
            return new Response(`No content found for ${rssPath}. Please run /generateRssContent first.`, { status: 404 });
        }
        console.log(`[writeRssData] Successfully retrieved content for ${rssPath}. Content length: ${content.length}`);

        const yearMonth = dateStr.substring(0, 7);
        const report = {
            report_date: dateStr,
            title: dateStr + ' 金融日报',
            link: '/' + yearMonth + '/' + dateStr + '/',
            content_html: marked.parse(formatMarkdownText(content)),
            published_date: formatDateToGMT8WithTime(new Date())
        };

        const kvKey = `${dateStr}-report`;
        console.log(`[writeRssData] Preparing to store report in KV. Key: ${kvKey}`);
        await storeInKV(env.DATA_KV, kvKey, report);
        console.log(`[writeRssData] Successfully stored report in KV with key: ${kvKey}`);

        return new Response(JSON.stringify(report), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        console.error('[writeRssData] Error handling daily report:', error.message, error.stack);
        return new Response(`Error handling daily report: ${error.message}`, { status: 500 });
    }
}

export function extractContentFromSecondHash(content) {
    const parts = content.split('###');
    if (parts.length > 2) {
        let newcontent = '###' + parts.slice(2).join('###');
        const lastHashIndex = newcontent.lastIndexOf('金融日报');
        if (lastHashIndex !== -1) {
            newcontent = newcontent.substring(0, lastHashIndex-10);
        }
        return newcontent;
    }
    return content;
}

export function truncateContent(content, maxLength = 150) {
    if (!content || content.length <= maxLength) {
        return content;
    }

    let truncated = content.substring(0, maxLength);
    const lastNewlineEnd = truncated.lastIndexOf('\n');

    if (lastNewlineEnd > maxLength / 2) {
        truncated = content.substring(0, lastNewlineEnd);
    }

    truncated += '\n\n......\n\n*[剩余内容已省略]*';

    return truncated;
}

export async function generateAIContent(env, promptText) {
    console.log(`[generateAIContent] Calling AI model with prompt: ${promptText.substring(0, 100)}...`);
    try {
        let result = await callChatAPI(env, promptText, getSystemPromptMarketSummary(env));
        console.log(`[generateAIContent] AI model returned content. Length: ${result.length}`);
        result = removeMarkdownCodeBlock(result);
        result = truncateContent(result, 360);
        result += "\n\n</br>" + getAppUrl();
        return result;
    } catch (error) {
        console.error('[generateAIContent] Error calling AI model:', error.message, error.stack);
        throw new Error(`Failed to generate AI content: ${error.message}`);
    }
}
