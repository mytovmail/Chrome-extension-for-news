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
  
  // ערוצי טלגרם אקטיביים - גישה ישירה
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

async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים...`);
  let allMessages = [];

  for (const channel of channels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      
      const response = await fetch(channel.url, { 
        signal: controller.signal,
        headers: {
          // הטריק הגדול: מתחזים ל-Googlebot כדי שטלגרם ייתנו לנו להיכנס ללא חסימות!
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        
        if (channel.type === "telegram") {
          // חיתוך גס ואמין יותר של הודעות טלגרם
          const messageBlocks = text.split('tgme_widget_message_wrap').slice(1);
          let tempMessages = [];
          
          for (const block of messageBlocks) {
            const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
            const imgMatch = block.match(/background-image:url\('([^']+)'\)/i);

            let cleanText = textMatch ? decodeHtml(textMatch[1]) : "";
            let imageUrl = imgMatch ? imgMatch[1] : null;

            if (cleanText.length > 5) { // סינון הודעות ריקות
              tempMessages.push({ text: cleanText, image: imageUrl });
            }
          }
          
          // לוקחים את 2 ההודעות האחרונות (הן מופיעות בסוף הדף בטלגרם)
          const latestMessages = tempMessages.slice(-2);
          latestMessages.forEach(msg => {
            allMessages.push({ text: msg.text, source: channel.name, image: msg.image });
          });

        } else if (channel.type === "rss") {
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let itemMatch;
          let count = 0;
          
          while ((itemMatch = itemRegex.exec(text)) !== null && count < 2) {
            let itemHtml = itemMatch[1];
            
            let titleMatch = /<title>(.*?)<\/title>/i.exec(itemHtml);
            let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : "";
            let cleanTitle = decodeHtml(title);
            
            let imgMatch = /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(itemHtml) ||
                           /<media:content[^>]*url="([^"]+)"/i.exec(itemHtml) ||
                           /<img[^>]*src="([^"]+)"/i.exec(itemHtml);
            let imageUrl = imgMatch ? imgMatch[1] : null;

            if (cleanTitle.length > 5) { // סינון הודעות ריקות מה-RSS
              allMessages.push({ text: cleanTitle, source: channel.name, image: imageUrl });
              count++;
            }
          }
        }
      }
    } catch (e) {
      console.log(`שגיאה בערוץ ${channel.name}: דילוג.`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`סבב הסתיים בהצלחה. הזיכרון עודכן עם ${cachedMessages.length} הודעות מדויקות.`);
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
