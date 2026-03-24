const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());

let cachedMessages = [];

// ==========================================
// חלק ב':  n כאן מדביקים את רשימת הערוצים (למטה בהודעה הבאה)
// ===========================================
const channels = [
    { name: "JDN (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml", type: "rss" },
  { name: "Ynet מבזקים", url: "https://t.me/s/ynetalert", type: "telegram" },
  { name: "Ynet חדר חדשות", url: "https://t.me/s/ynetnewsroom", type: "telegram" },
  { name: "N12 מתפרצות", url: "https://t.me/s/N12breaking", type: "telegram" },
  { name: "N12 הצ'אט", url: "https://t.me/s/N12updates", type: "telegram" },
  { name: "חדשות 13", url: "https://t.me/s/news13channel", type: "telegram" },
  { name: "וואלה! חדשות", url: "https://t.me/s/walla_news", type: "telegram" },
  { name: "כאן חדשות", url: "https://t.me/s/kan_news", type: "telegram" },
  { name: "ישראל היום", url: "https://t.me/s/israelhayom", type: "telegram" },
  { name: "מעריב", url: "https://t.me/s/maarivonline", type: "telegram" },
  { name: "גלובס", url: "https://t.me/s/globesnews", type: "telegram" },
  { name: "עכשיו 14", url: "https://t.me/s/now14updates", type: "telegram" },
  { name: "כיכר השבת", url: "https://t.me/s/kikar_news", type: "telegram" },
  { name: "דובר צה"ל", url: "https://t.me/s/idfonline", type: "telegram" },
  { name: "פיקוד העורף", url: "https://t.me/s/pikudhaoref", type: "telegram" },
  { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
  { name: "ינון מגל", url: "https://t.me/s/yinonmagal", type: "telegram" },
  { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
  { name: "ברק רביד", url: "https://t.me/s/barak_ravid", type: "telegram" },
  { name: "ניר דבורי", url: "https://t.me/s/nir_dvori", type: "telegram" },
  { name: "אלמוג בוקר", url: "https://t.me/s/almog_boker", type: "telegram" },
  { name: "סיון רהב מאיר", url: "https://t.me/s/sivanrahav", type: "telegram" },
  { name: "301 העולם הערבי", url: "https://t.me/s/arabworld301", type: "telegram" },
  { name: "אבו עלי אקספרס", url: "https://t.me/s/abualiexpress", type: "telegram" },
  { name: "זירת החדשות", url: "https://t.me/s/ziratnews", type: "telegram" },
  { name: "מבזקי בטחון 24/7", url: "https://t.me/s/mivzakey_bitahon", type: "telegram" },
  { name: "זק״א", url: "https://t.me/s/ZAKA_il", type: "telegram" },
  { name: "איחוד הצלה", url: "https://t.me/s/UnitedHatzalahIL", type: "telegram" },
  { name: "מגן דוד אדום", url: "https://t.me/s/mdaisrael", type: "telegram" },
  { name: "הלכה יומית", url: "https://t.me/s/halacha_yomit", type: "telegram" }
];
// ==========================================

function decodeHtml(html) {
    if (!html) return "";
    return html.replace(/<br\s*\/?>/gi, ' | ').replace(/<[^>]*>?/gm, '')
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/&#8211;/g, '-').trim();
}

async function fetchSingleChannel(channel) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(channel.url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        clearTimeout(timeoutId);
        if (!response.ok) return [];
        const text = await response.text();
        let results = [];
        if (channel.type === "telegram") {
            const blocks = text.split('tgme_widget_message_wrap').slice(1);
            blocks.forEach(block => {
                const txt = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
                const img = block.match(/background-image:url\('([^']+)'\)/i);
                if (txt && txt[1].length > 10) results.push({ text: decodeHtml(txt[1]), image: img ? img[1] : null, source: channel.name });
            });
            return results.slice(-3);
        } else {
            const items = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];
            items.slice(0, 3).forEach(item => {
                const t = item.match(/<title>(.*?)<\/title>/i);
                const img = item.match(/<enclosure[^>]*url="([^"]+)"/i) || item.match(/<media:content[^>]*url="([^"]+)"/i) || item.match(/<img[^>]*src="([^"]+)"/i);
                if (t) results.push({ text: decodeHtml(t[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')), source: channel.name, image: img ? img[1] : null });
            });
            return results;
        }
    } catch (e) { return []; }
}

async function fetchNews() {
    console.log("Starting update cycle...");
    let all = [];
    const chunkSize = 10;
    for (let i = 0; i < channels.length; i += chunkSize) {
        const chunk = channels.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(c => fetchSingleChannel(c)));
        results.forEach(r => all.push(...r));
        await new Promise(res => setTimeout(res, 500));
    }
    if (all.length > 0) cachedMessages = all;
    console.log("Update finished. Messages count:", cachedMessages.length);
    setTimeout(fetchNews, 60000);
}

fetchNews();
app.get('/', (req, res) => res.json(cachedMessages));
app.get('/ping', (req, res) => res.send('pong'));
app.listen(process.env.PORT || 3000, () => console.log("Server running"));
