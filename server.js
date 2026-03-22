// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages = [];

const channels = [
  // אתרי אינטרנט (RSS)
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml", type: "rss" },
  
  // ערוצי טלגרם (HTML)
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

function decodeHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' | ') 
    .replace(/<[^>]*>?/gm, '')      
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים (כולל תמונות)...`);
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
          // חילוץ תמונות וטקסט מטלגרם
          const bubbleRegex = /<div class="tgme_widget_message_bubble">([\s\S]*?)<div class="tgme_widget_message_info"/gi;
          let bubbleMatch;
          let tempMessages = [];
          
          while ((bubbleMatch = bubbleRegex.exec(text)) !== null) {
            let bubbleHtml = bubbleMatch[1];
            
            let textMatch = /<div class="tgme_widget_message_text[^>]*>(.*?)<\/div>/i.exec(bubbleHtml);
            let imgMatch = /background-image:url\('([^']+)'\)/i.exec(bubbleHtml); // חילוץ התמונה מהסטייל

            let cleanText = textMatch ? decodeHtml(textMatch[1]) : "";
            let imageUrl = imgMatch ? imgMatch[1] : null;

            if (cleanText.length > 5) { 
              tempMessages.push({ text: cleanText, image: imageUrl });
            }
          }
          
          const latestMessages = tempMessages.slice(-2).reverse();
          latestMessages.forEach(msg => {
            allMessages.push({ text: msg.text, source: channel.name, image: msg.image });
          });

        } else if (channel.type === "rss") {
          // חילוץ תמונות וטקסט מה-RSS
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let itemMatch;
          let count = 0;
          
          while ((itemMatch = itemRegex.exec(text)) !== null && count < 2) {
            let itemHtml = itemMatch[1];
            
            let titleMatch = /<title>(.*?)<\/title>/i.exec(itemHtml);
            let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : "";
            
            // חיפוש תמונה בתגיות נפוצות ב-RSS
            let imgMatch = /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(itemHtml) ||
                           /<media:content[^>]*url="([^"]+)"/i.exec(itemHtml) ||
                           /<img[^>]*src="([^"]+)"/i.exec(itemHtml);
            let imageUrl = imgMatch ? imgMatch[1] : null;

            if (title) {
              allMessages.push({ text: decodeHtml(title), source: channel.name, image: imageUrl });
              count++;
            }
          }
        }
      }
    } catch (e) {
      console.log(`שגיאה בערוץ ${channel.name}: דילוג.`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`סבב הסתיים. הזיכרון עודכן עם ${cachedMessages.length} הודעות ותמונות.`);
  }
  
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
