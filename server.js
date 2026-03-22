// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages = [];

// רשימת הערוצים החדשה - שימוש בגישה ישירה לטלגרם (t.me/s/) ללא מתווכים!
const channels = [
  // אתרי אינטרנט (RSS)
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
  
  // ערוצי טלגרם אקטיביים - גישה ישירה (HTML Scraping)
  { name: "301 העולם הערבי", url: "https://t.me/s/arabworld301", type: "telegram" },
  { name: "המוקד", url: "https://t.me/s/hamoked_il", type: "telegram" },
  { name: "מבזקי בטחון 24/7", url: "https://t.me/s/mivzakeybitachon", type: "telegram" },
  { name: "חדשות קודקוד", url: "https://t.me/s/kodkodgroup", type: "telegram" },
  { name: "זירת החדשות", url: "https://t.me/s/ZiratNews", type: "telegram" },
  { name: "זירה פוליטית", url: "https://t.me/s/Zira_politit", type: "telegram" },
  { name: "החדשות החמות", url: "https://t.me/s/hachadashot_hachamot", type: "telegram" },
  { name: "חדשות הבזק", url: "https://t.me/s/mivzakimnet", type: "telegram" },
  { name: "חדשות ישראל", url: "https://t.me/s/israel_news_telegram", type: "telegram" },
  { name: "עדכונים ומבזקים", url: "https://t.me/s/idkunim_mivzakim", type: "telegram" },
  { name: "הקו החרדי", url: "https://t.me/s/kavhacharedi", type: "telegram" },
  { name: "צ'אט הכתבים (N12)", url: "https://t.me/s/N12chat", type: "telegram" },
  { name: "חדשות 25", url: "https://t.me/s/news25", type: "telegram" },
  
  { name: "עמית סגל", url: "https://t.me/s/amitsegal", type: "telegram" },
  { name: "ינון מגל", url: "https://t.me/s/yinonmagal", type: "telegram" },
  { name: "יאיר שרקי", url: "https://t.me/s/yaircherki", type: "telegram" },
  { name: "ישי כהן", url: "https://t.me/s/ishaycoen", type: "telegram" },
  { name: "אבי רבינא", url: "https://t.me/s/AviRabina", type: "telegram" },
  { name: "מיכאל שמש", url: "https://t.me/s/michaelshemesh", type: "telegram" },
  { name: "דורון קדוש (צבא)", url: "https://t.me/s/doron_kadosh", type: "telegram" },
  { name: "כיכר השבת", url: "https://t.me/s/kikarhashabat", type: "telegram" },
  { name: "כל רגע", url: "https://t.me/s/kollrega", type: "telegram" },
  { name: "קול חי", url: "https://t.me/s/kolhai", type: "telegram" },
  { name: "מבזק לייב", url: "https://t.me/s/MivzakLive", type: "telegram" },
  { name: "פיקוד העורף", url: "https://t.me/s/PikudHaoref_official", type: "telegram" },
  { name: "זק״א", url: "https://t.me/s/zakahq", type: "telegram" },
  { name: "איחוד הצלה", url: "https://t.me/s/UnitedHatzalahIL", type: "telegram" },
  { name: "מגן דוד אדום", url: "https://t.me/s/mda_israel", type: "telegram" },
  { name: "הלכה יומית", url: "https://t.me/s/halachayomit", type: "telegram" },
  { name: "הדף היומי", url: "https://t.me/s/hadafyomi_il", type: "telegram" }
];

// פונקציה לניקוי טקסט מ-HTML והפיכתו לקריא
function decodeHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' | ') // הופך ירידות שורה למפריד יפה
    .replace(/<[^>]*>?/gm, '')      // מסיר את כל שאר תגיות ה-HTML
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים ישיר...`);
  let allMessages = [];

  for (const channel of channels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      
      const response = await fetch(channel.url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        
        if (channel.type === "telegram") {
          // חילוץ ישיר מדף האינטרנט של טלגרם!
          const tgRegex = /<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/gi;
          let match;
          let tempMessages = [];
          
          while ((match = tgRegex.exec(text)) !== null) {
            let cleanText = decodeHtml(match[1]);
            if (cleanText.length > 5) { // סינון הודעות ריקות מדי
              tempMessages.push(cleanText);
            }
          }
          
          // בטלגרם ההודעות הכי חדשות נמצאות בתחתית הדף
          // ניקח את ה-2 האחרונות ונהפוך אותן
          const latestMessages = tempMessages.slice(-2).reverse();
          latestMessages.forEach(msg => {
            allMessages.push({ text: msg, source: channel.name });
          });

        } else if (channel.type === "rss") {
          // משיכת RSS רגילה לאתרי אינטרנט
          const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<\/item>/gi;
          let match;
          let count = 0;
          
          while ((match = itemRegex.exec(text)) !== null && count < 2) {
            let title = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
            allMessages.push({ text: decodeHtml(title), source: channel.name });
            count++;
          }
        }
      }
    } catch (e) {
      console.log(`שגיאה בערוץ ${channel.name}: דילוג.`);
    }
    
    // המתנה של 400 אלפיות השנייה בין בקשה לבקשה
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`סבב הסתיים. הזיכרון עודכן עם ${cachedMessages.length} הודעות מדויקות.`);
  } else {
    console.log(`לא התקבלו הודעות (עומס רשת). שומר על הזיכרון הקיים.`);
  }

  // ממתינים 60 שניות *מסיום הסבב* ומתחילים מחדש
  setTimeout(fetchNews, 60 * 1000);
}

fetchNews();

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
