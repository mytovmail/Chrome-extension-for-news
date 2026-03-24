// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages =[];

// ==========================================
// רשימת הערוצים הענקית (RSS + טלגרם)
// שימו לב: קישורי טלגרם חייבים להיות עם /s/ כדי למשוך את תצוגת הרשת!
// ==========================================
const channels =[
  // --- אתרי חדשות מומלצים (RSS) ---
  { name: "JDN חדשות", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש", url: "https://hm-news.co.il/feed/", type: "rss" },
  { name: "בחדרי חרדים", url: "https://www.bhol.co.il/rss.xml", type: "rss" },
  { name: "Ynet חדשות", url: "https://www.ynet.co.il/Integration/StoryRss2.xml", type: "rss" },
  { name: "מעריב", url: "https://www.maariv.co.il/Rss/RssFeedsMivzakim", type: "rss" },
  { name: "וואלה", url: "https://rss.walla.co.il/feed/22", type: "rss" },
  { name: "ישראל היום", url: "https://www.israelhayom.co.il/rss.xml", type: "rss" },
  { name: "גלובס", url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", type: "rss" },
  { name: "כיפה", url: "https://www.kipa.co.il/rss/news.xml", type: "rss" },

  // --- כתבים ואנשי תקשורת (Telegram) ---
  { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
  { name: "ינון מגל", url: "https://t.me/s/yinonmagal", type: "telegram" },
  { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
  { name: "מיכאל שמש", url: "https://t.me/s/michael_shemesh", type: "telegram" },
  { name: "אבי רבינא", url: "https://t.me/s/abirabina", type: "telegram" },
  { name: "ישי כהן", url: "https://t.me/s/ishaycohen", type: "telegram" },
  { name: "דורון קדוש (צבא)", url: "https://t.me/s/doron_kadosh", type: "telegram" },
  { name: "עמליה דואק", url: "https://t.me/s/AmalyaDuek", type: "telegram" },
  { name: "דפנה ליאל", url: "https://t.me/s/dafna_liel", type: "telegram" },
  { name: "הלל ביטון רוזן", url: "https://t.me/s/BittonRosen", type: "telegram" },
  { name: "מוטי קסטל", url: "https://t.me/s/Moti_Kastel", type: "telegram" },

  // --- ערוצי חדשות ומבזקים (Telegram) ---
  { name: "צ'אט הכתבים (N12)", url: "https://t.me/s/N12chat", type: "telegram" },
  { name: "כאן חדשות", url: "https://t.me/s/kann_news", type: "telegram" },
  { name: "חדשות 14", url: "https://t.me/s/Now14Israel", type: "telegram" },
  { name: "כיכר השבת", url: "https://t.me/s/kikarhashabat", type: "telegram" },
  { name: "כל רגע", url: "https://t.me/s/korecoil", type: "telegram" },
  { name: "חדשות ישראל בטלגרם", url: "https://t.me/s/newsil_tme", type: "telegram" },
  { name: "חדשות קודקוד", url: "https://t.me/s/kodkodnews", type: "telegram" },
  { name: "301 העולם הערבי", url: "https://t.me/s/arabworld301", type: "telegram" },
  { name: "אבו עלי אקספרס", url: "https://t.me/s/abualiexpress", type: "telegram" },
  { name: "זירת החדשות", url: "https://t.me/s/ziratnews", type: "telegram" },
  { name: "מבזקי בטחון 24/7", url: "https://t.me/s/mivzakey_bitahon", type: "telegram" },
  { name: "המוקד", url: "https://t.me/s/hamoked_il", type: "telegram" },
  { name: "קול חי", url: "https://t.me/s/kolhai", type: "telegram" },
  { name: "חדשות הבזק", url: "https://t.me/s/MivzakLive", type: "telegram" },
  
  // --- הצלה וחירום (Telegram) ---
  { name: "פיקוד העורף (התרעות)", url: "https://t.me/s/HFC_IL", type: "telegram" },
  { name: "זק״א", url: "https://t.me/s/ZAKA_il", type: "telegram" },
  { name: "מגן דוד אדום", url: "https://t.me/s/mdaisrael", type: "telegram" },
  { name: "איחוד הצלה", url: "https://t.me/s/UnitedHatzalahIL", type: "telegram" }

  // ניתן להוסיף כאן עוד עשרות ערוצים באותו פורמט!
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
    
    const response = await fetch(channel.url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return [];

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
    // במקרה של שגיאה (למשל Timeout), מחזירים מערך ריק כדי שהשרת לא יקרוס
    return[];
  }
}

// לולאה ראשית - שואבת נתונים במנות (Chunks)
async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים...`);
  
  let allMessages =[];
  const chunkSize = 10; // מושכים 10 ערוצים במקביל (מונע חסימות מטלגרם ומאיץ את התהליך!)

  for (let i = 0; i < channels.length; i += chunkSize) {
    const chunk = channels.slice(i, i + chunkSize);
    
    // מעבד את כל ה-10 ערוצים בו זמנית
    const results = await Promise.all(chunk.map(channel => fetchSingleChannel(channel)));
    
    // מאחד את התוצאות
    results.forEach(channelMessages => {
      allMessages.push(...channelMessages);
    });

    // השהייה קטנטנה של חצי שנייה בין מנה למנה למניעת חסימות IP (Rate Limit)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages; // מעדכן את המטמון של השרת בשבריר שנייה
    console.log(`סבב הסתיים בהצלחה. סה"כ הודעות במערכת: ${cachedMessages.length}`);
  }
  
  // מתחיל סבב חדש דקה אחרי שהסבב הקודם *הסתיים*
  setTimeout(fetchNews, 60 * 1000);
}

// הפעלה ראשונית
fetchNews();

// נתיבי ה-API
app.get('/', (req, res) => {
  res.json(cachedMessages);
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`השרת מוכן על פורט ${PORT}`);
});
