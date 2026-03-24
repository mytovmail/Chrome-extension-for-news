// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages =[];

// ==========================================
// רשימת הערוצים הענקית (RSS + טלגרם)
// ==========================================
const channels =[
  // --- אתרי חדשות מומלצים (RSS) ---
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml", type: "rss" },

  // --- ערוצי טלגרם - רשימה מלאה (תוקן לפורמט התצוגה https://t.me/s/) ---
  { name: "Ynet מבזקים", url: "https://t.me/s/ynetalert", type: "telegram" },
  { name: "Ynet חדר החדשות", url: "https://t.me/s/ynetnewsroom", type: "telegram" },
  { name: "N12 מתפרצות", url: "https://t.me/s/N12breaking", type: "telegram" },
  { name: "N12 הצ'אט", url: "https://t.me/s/N12updates", type: "telegram" },
  { name: "N12 פוליטי", url: "https://t.me/s/n12politics", type: "telegram" },
  { name: "חדשות 13", url: "https://t.me/s/news13channel", type: "telegram" },
  { name: "רשת 13", url: "https://t.me/s/reshet13", type: "telegram" },
  { name: "וואלה! חדשות", url: "https://t.me/s/walla_news", type: "telegram" },
  { name: "כאן חדשות", url: "https://t.me/s/kan_news", type: "telegram" },
  { name: "כאן רשת ב'", url: "https://t.me/s/ReshetBet", type: "telegram" },
  { name: "גל\"צ", url: "https://t.me/s/glzradio", type: "telegram" },
  { name: "ישראל היום", url: "https://t.me/s/israelhayom", type: "telegram" },
  { name: "מעריב", url: "https://t.me/s/maarivonline", type: "telegram" },
  { name: "הארץ", url: "https://t.me/s/haaretz", type: "telegram" },
  { name: "סרוגים", url: "https://t.me/s/srugim_news", type: "telegram" },
  { name: "ערוץ 7", url: "https://t.me/s/inn_news", type: "telegram" },
  { name: "גלובס", url: "https://t.me/s/globesnews", type: "telegram" },
  { name: "כלכליסט", url: "https://t.me/s/calcalist", type: "telegram" },
  { name: "דה מרקר", url: "https://t.me/s/the_marker", type: "telegram" },
  { name: "עכשיו 14", url: "https://t.me/s/now14updates", type: "telegram" },
  { name: "זמן ישראל", url: "https://t.me/s/zmaneyisrael", type: "telegram" },
  { name: "כיכר השבת", url: "https://t.me/s/kikar_news", type: "telegram" },
  { name: "JDN חדשות", url: "https://t.me/s/jdn_il", type: "telegram" },
  { name: "בחדרי חרדים", url: "https://t.me/s/bholnews", type: "telegram" },
  { name: "משטרת ישראל", url: "https://t.me/s/israelpolice", type: "telegram" },
  { name: "דובר צה\"ל", url: "https://t.me/s/idfonline", type: "telegram" },
  { name: "פיקוד העורף (רשמי)", url: "https://t.me/s/pikudhaoref", type: "telegram" },
  { name: "משרד החוץ", url: "https://t.me/s/IsraelMFA", type: "telegram" },
  { name: "פיקוד העורף (התרעות)", url: "https://t.me/s/homefrontcommand", type: "telegram" },
  { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
  { name: "ברק רביד", url: "https://t.me/s/barak_ravid", type: "telegram" },
  { name: "ינון מגל", url: "https://t.me/s/yinonmagal", type: "telegram" },
  { name: "בן כספית", url: "https://t.me/s/bencaspit", type: "telegram" },
  { name: "אבי יששכרוף", url: "https://t.me/s/avi_issacharoff", type: "telegram" },
  { name: "אור הלר", url: "https://t.me/s/or_heller", type: "telegram" },
  { name: "ניר דבורי", url: "https://t.me/s/nir_dvori", type: "telegram" },
  { name: "אלמוג בוקר", url: "https://t.me/s/almog_boker", type: "telegram" },
  { name: "אלירן טל", url: "https://t.me/s/elirantal", type: "telegram" },
  { name: "יואב אבן", url: "https://t.me/s/yoaveven", type: "telegram" },
  { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
  { name: "סיון רהב מאיר", url: "https://t.me/s/sivanrahav", type: "telegram" },
  { name: "משה נוסבאום", url: "https://t.me/s/moshenuss", type: "telegram" },
  { name: "מיקי רוזנפלד", url: "https://t.me/s/mickyrosenfeld", type: "telegram" },
  { name: "ליאור דיין", url: "https://t.me/s/liordayan", type: "telegram" },
  { name: "אבי בניהו", url: "https://t.me/s/avibenayahu", type: "telegram" },
  { name: "יוסי יהושוע", url: "https://t.me/s/yossi_yehoshua", type: "telegram" },
  { name: "איתי בלומנטל", url: "https://t.me/s/itayblumental", type: "telegram" },
  { name: "מתן חודורוב", url: "https://t.me/s/matanhodorov", type: "telegram" },
  { name: "עמרי מניב", url: "https://t.me/s/omrimaniv", type: "telegram" },
  { name: "יהודה שלזינגר", url: "https://t.me/s/yehudatimes", type: "telegram" },
  { name: "אריק בנדר", url: "https://t.me/s/arikbender", type: "telegram" },
  { name: "שמעון ריקלין", url: "https://t.me/s/shimon_riklin", type: "telegram" },
  { name: "יאיר קראוס", url: "https://t.me/s/yairkraus", type: "telegram" },
  { name: "הדס גרינברג", url: "https://t.me/s/hadas_greenberg", type: "telegram" },
  { name: "תומר גנון", url: "https://t.me/s/tomer_ganon", type: "telegram" },
  { name: "דה לייב ניוז", url: "https://t.me/s/thelivenews", type: "telegram" },
  { name: "ישראל עכשיו", url: "https://t.me/s/israelnow", type: "telegram" },
  { name: "ריל-טיים", url: "https://t.me/s/realtimeisrael", type: "telegram" },
  { name: "רו ניוז (Raw)", url: "https://t.me/s/rawnewsisrael", type: "telegram" },
  { name: "אינסטנט ניוז", url: "https://t.me/s/instant_news_il", type: "telegram" },
  { name: "חדשות ישראל 24", url: "https://t.me/s/newsisrael24", type: "telegram" },
  { name: "ישראל ריפורט", url: "https://t.me/s/israel_report", type: "telegram" },
  { name: "ישראל ברייקינג", url: "https://t.me/s/israelbreaking", type: "telegram" },
  { name: "ירושלים עדכונים", url: "https://t.me/s/jerusalem_updates", type: "telegram" },
  { name: "תל אביב עדכונים", url: "https://t.me/s/tlvupdates", type: "telegram" },
  { name: "חיפה חדשות", url: "https://t.me/s/haifa_news", type: "telegram" },
  { name: "באר שבע חדשות", url: "https://t.me/s/beer_sheva_news", type: "telegram" },
  { name: "אשדוד חדשות", url: "https://t.me/s/ashdodnews", type: "telegram" },
  { name: "אשקלון עדכונים", url: "https://t.me/s/ashkelonupdates", type: "telegram" },
  { name: "מודיעין חדשות", url: "https://t.me/s/modiinnews", type: "telegram" },
  { name: "פתח תקווה חדשות", url: "https://t.me/s/ptk_news", type: "telegram" },
  { name: "ראשון לציון חדשות", url: "https://t.me/s/rishonnews", type: "telegram" },
  { name: "גוש דן התרעות", url: "https://t.me/s/gushdanalerts", type: "telegram" },
  { name: "חדשות הצפון", url: "https://t.me/s/northnewsisrael", type: "telegram" },
  { name: "חדשות הדרום", url: "https://t.me/s/south_news_il", type: "telegram" },
  { name: "חדשות המרכז", url: "https://t.me/s/center_news_il", type: "telegram" },
  { name: "חרדים חדשות", url: "https://t.me/s/haredinews", type: "telegram" },
  { name: "חותם", url: "https://t.me/s/chotamnews", type: "telegram" },
  { name: "קול ברמה", url: "https://t.me/s/kolbarama", type: "telegram" },
  { name: "קול חי", url: "https://t.me/s/kolhai", type: "telegram" },
  { name: "עיריית ירושלים", url: "https://t.me/s/jerusalemmuni", type: "telegram" },
  { name: "עיריית תל אביב", url: "https://t.me/s/telavivcity", type: "telegram" },
  { name: "עיריית חיפה", url: "https://t.me/s/haifa_city", type: "telegram" },
  { name: "עדכוני כנסת", url: "https://t.me/s/knesset_updates", type: "telegram" },
  { name: "משרד ראש הממשלה", url: "https://t.me/s/IsraeliPM", type: "telegram" },
  { name: "המל\"ל", url: "https://t.me/s/nsc_israel", type: "telegram" },
  { name: "RTV ישראל", url: "https://t.me/s/rtvisrael", type: "telegram" },
  { name: "ILTV (אנגלית)", url: "https://t.me/s/iltvnews", type: "telegram" },
  { name: "ישראל גלובל", url: "https://t.me/s/israelglobalnews", type: "telegram" },
  { name: "מדיה ווטש", url: "https://t.me/s/mediawatch_il", type: "telegram" },
  { name: "עדכונים 24/7", url: "https://t.me/s/updates_il", type: "telegram" },
  { name: "ברייקינג איי-אל", url: "https://t.me/s/breaking_il", type: "telegram" },
  { name: "דיילי ישראל", url: "https://t.me/s/dailyisraelupdates", type: "telegram" },
  { name: "24 ניוז", url: "https://t.me/s/israel24news", type: "telegram" },
  { name: "דיווח ראשוני", url: "https://t.me/s/firstreport_il", type: "telegram" },
  { name: "ישראל פלאש", url: "https://t.me/s/israelflash", type: "telegram" },
  { name: "פאסט ניוז", url: "https://t.me/s/fastnews_il", type: "telegram" }
];

function decodeHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, ' | ') 
    .replace(/<[^>]*>?/gm, '')      
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .trim();
}

// פונקציה לעיבוד ערוץ בודד
async function fetchSingleChannel(channel) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 שניות טיימאאוט למניעת תקיעות
    
    // אם אין קישור (לא אמור לקרות עכשיו, אבל שיהיה להגנה), דלג על הערוץ
    if (!channel.url || channel.url.trim() === "") {
      clearTimeout(timeoutId);
      return[];
    }

    const response = await fetch(channel.url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return[];

    const text = await response.text();
    let parsedMessages =[];
    
    if (channel.type === "telegram") {
      const messageBlocks = text.split('tgme_widget_message_wrap').slice(1);
      let tempMessages =[];
      
      for (const block of messageBlocks) {
        const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
        const imgMatch = block.match(/background-image:url\('([^']+)'\)/i);

        let cleanText = textMatch ? decodeHtml(textMatch[1]) : "";
        let imageUrl = imgMatch ? imgMatch[1] : null;

        if (cleanText.length > 5) {
          tempMessages.push({ text: cleanText, image: imageUrl, source: channel.name });
        }
      }
      // 3 ההודעות האחרונות מכל ערוץ
      parsedMessages = tempMessages.slice(-3);

    } else if (channel.type === "rss") {
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let itemMatch;
      let count = 0;
      
      while ((itemMatch = itemRegex.exec(text)) !== null && count < 3) {
        let itemHtml = itemMatch[1];
        
        let titleMatch = /<title>(.*?)<\/title>/i.exec(itemHtml);
        let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : "";
        let cleanTitle = decodeHtml(title);
        
        let imgMatch = /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(itemHtml) ||
                       /<media:content[^>]*url="([^"]+)"/i.exec(itemHtml) ||
                       /<img[^>]*src="([^"]+)"/i.exec(itemHtml);
        let imageUrl = imgMatch ? imgMatch[1] : null;

        if (cleanTitle.length > 5) {
          parsedMessages.push({ text: cleanTitle, source: channel.name, image: imageUrl });
          count++;
        }
      }
    }
    return parsedMessages;

  } catch (e) {
    // במקרה של שגיאה (למשל Timeout או חסימה זמנית), מחזירים מערך ריק כדי שהשרת לא יקרוס
    return[];
  }
}

// לולאה ראשית - שואבת נתונים במנות (Chunks) להגנה על משאבי השרת
async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים (${channels.length} מקורות)...`);
  
  let allMessages =
