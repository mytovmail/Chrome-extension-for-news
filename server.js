// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages =[];

// ==========================================
// רשימת הערוצים הענקית (RSS + טלגרם)
// שימו לב: השמות תואמים כעת ב-100% להגדרות התוסף
// ==========================================
const channels =[
  // --- אתרי חדשות מומלצים (RSS) ---
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/", type: "rss" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1", type: "rss" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/", type: "rss" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed", type: "rss" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/", type: "rss" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml", type: "rss" },

  // --- כתבים ואנשי תקשורת (Telegram) ---
  // זכור: הוסף /s/ לקישורים (לדוגמה: https://t.me/s/amitsegal)
  { name: "עמית סגל", url: "", type: "telegram" },
  { name: "ינון מגל", url: "", type: "telegram" },
  { name: "יאיר שרקי", url: "", type: "telegram" },
  { name: "מיכאל שמש", url: "", type: "telegram" },
  { name: "אבי רבינא", url: "", type: "telegram" },
  { name: "ישי כהן", url: "", type: "telegram" },
  { name: "דורון קדוש (צבא)", url: "", type: "telegram" },

  // --- ערוצי חדשות ומבזקים (Telegram) ---
  { name: "צ'אט הכתבים (N12)", url: "", type: "telegram" },
  { name: "כיכר השבת", url: "", type: "telegram" },
  { name: "כל רגע", url: "", type: "telegram" },
  { name: "חדשות ישראל", url: "", type: "telegram" },
  { name: "חדשות קודקוד", url: "", type: "telegram" },
  { name: "301 העולם הערבי", url: "", type: "telegram" },
  { name: "זירת החדשות", url: "", type: "telegram" },
  { name: "מבזקי בטחון 24/7", url: "", type: "telegram" },
  { name: "המוקד", url: "", type: "telegram" },
  { name: "קול חי", url: "", type: "telegram" },
  { name: "חדשות הבזק", url: "", type: "telegram" },
  { name: "זירה פוליטית", url: "", type: "telegram" },
  { name: "החדשות החמות", url: "", type: "telegram" },
  { name: "עדכונים ומבזקים", url: "", type: "telegram" },
  { name: "הקו החרדי", url: "", type: "telegram" },
  { name: "חדשות 25", url: "", type: "telegram" },
  { name: "מבזק לייב", url: "", type: "telegram" },
  
  // --- הצלה וחירום (Telegram) ---
  { name: "פיקוד העורף", url: "", type: "telegram" },
  { name: "זק״א", url: "", type: "telegram" },
  { name: "מגן דוד אדום", url: "", type: "telegram" },
  { name: "איחוד הצלה", url: "", type: "telegram" },

  // --- יהדות ודת ---
  { name: "הלכה יומית", url: "", type: "telegram" },
  { name: "הדף היומי", url: "", type: "telegram" }
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
    
    // אם אין קישור (כי עדיין לא מילאת), דלג על הערוץ
    if (!channel.url || channel.url.trim() === "") {
      clearTimeout(timeoutId);
      return [];
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
    return [];
  }
}

// לולאה ראשית - שואבת נתונים במנות (Chunks)
async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מתחיל סבב משיכת נתונים...`);
  
  let allMessages =[];
  const chunkSize = 10; // מושכים 10 ערוצים במקביל

  for (let i = 0; i < channels.length; i += chunkSize) {
    const chunk = channels.slice(i, i + chunkSize);
    
    const results = await Promise.all(chunk.map(channel => fetchSingleChannel(channel)));
    
    results.forEach(channelMessages => {
      allMessages.push(...channelMessages);
    });

    // השהייה קטנטנה של חצי שנייה בין מנה למנה
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`סבב הסתיים בהצלחה. סה"כ הודעות במערכת: ${cachedMessages.length}`);
  }
  
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
