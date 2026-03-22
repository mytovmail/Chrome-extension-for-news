const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages = [];

// הרשימה הענקית המלאה של כל הערוצים
const channels = [
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml" },
  { name: "עמית סגל", url: "https://rsshub.app/telegram/channel/amitsegal" },
  { name: "ינון מגל", url: "https://rsshub.app/telegram/channel/yinonmagal" },
  { name: "יאיר שרקי", url: "https://rsshub.app/telegram/channel/yaircherki" },
  { name: "ישי כהן", url: "https://rsshub.app/telegram/channel/ishaycoen" },
  { name: "אבי רבינא", url: "https://rsshub.app/telegram/channel/AviRabina" },
  { name: "מיכאל שמש", url: "https://rsshub.app/telegram/channel/michaelshemesh" },
  { name: "עקיבא נוביק", url: "https://rsshub.app/telegram/channel/akivanovick" },
  { name: "ירון אברהם", url: "https://rsshub.app/telegram/channel/yaronavraham" },
  { name: "דורון קדוש (צבא)", url: "https://rsshub.app/telegram/channel/doron_kadosh" },
  { name: "JDN (טלגרם)", url: "https://rsshub.app/telegram/channel/JDN_News" },
  { name: "כיכר השבת", url: "https://rsshub.app/telegram/channel/kikarhashabat" },
  { name: "כל רגע", url: "https://rsshub.app/telegram/channel/kollrega" },
  { name: "חדשות הסקופים", url: "https://rsshub.app/telegram/channel/hascoopim" },
  { name: "קול חי", url: "https://rsshub.app/telegram/channel/kolhai" },
  { name: "קול ברמה", url: "https://rsshub.app/telegram/channel/kolbarama" },
  { name: "מבזק לייב", url: "https://rsshub.app/telegram/channel/MivzakLive" },
  { name: "הקול היהודי", url: "https://rsshub.app/telegram/channel/hakolhayehudi" },
  { name: "חדשות 0404", url: "https://rsshub.app/telegram/channel/news0404" },
  { name: "פיקוד העורף", url: "https://rsshub.app/telegram/channel/PikudHaoref_official" },
  { name: "זק״א", url: "https://rsshub.app/telegram/channel/zakahq" },
  { name: "איחוד הצלה", url: "https://rsshub.app/telegram/channel/UnitedHatzalahIL" },
  { name: "מגן דוד אדום", url: "https://rsshub.app/telegram/channel/mda_israel" },
  { name: "משטרת ישראל", url: "https://rsshub.app/telegram/channel/police_israel" },
  { name: "כבאות והצלה", url: "https://rsshub.app/telegram/channel/fire_israel" },
  { name: "הלכה יומית", url: "https://rsshub.app/telegram/channel/halachayomit" },
  { name: "הרב יצחק יוסף", url: "https://rsshub.app/telegram/channel/haravyitzchak" },
  { name: "הרב מאיר אליהו", url: "https://rsshub.app/telegram/channel/haravmeireliyahu" },
  { name: "הרב זמיר כהן", url: "https://rsshub.app/telegram/channel/zamircohen_official" },
  { name: "הדף היומי", url: "https://rsshub.app/telegram/channel/hadafyomi_il" }
];

async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מושך נתונים מהערוצים...`);
  let allMessages = [];

  // שינוי קריטי: עוברים לעבודה טורית (אחד אחד) במקום כולם בבת אחת
  for (const channel of channels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); 
      
      const response = await fetch(channel.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        
        const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<\/item>/gi;
        let match;
        let count = 0;
        
        while ((match = itemRegex.exec(text)) !== null && count < 2) {
          let title = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          allMessages.push({ text: title, source: channel.name });
          count++;
        }
      }
    } catch (e) {
      // דילוג על שגיאות בערוץ ספציפי
    }
    
    // הפסקה של חצי שנייה בין ערוץ לערוץ כדי לא להיראות כמו התקפת רשת ולמנוע חסימה!
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // עדכון הזיכרון רק אם באמת קיבלנו נתונים
  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`משיכה הסתיימה בהצלחה. הזיכרון עודכן עם ${cachedMessages.length} הודעות.`);
  } else {
    console.log(`לא התקבלו הודעות חדשות בסבב הזה (ייתכן עומס זמני). שומר על הזיכרון הקיים.`);
  }
}

fetchNews();

// החזרנו את הריצה לפעם בדקה בדיוק!
setInterval(fetchNews, 60 * 1000); 

app.get('/', (req, res) => {
  res.json(cachedMessages);
});

// נתיב "דופק" קטן שנועד לשמור על השרת ער
app.get('/ping', (req, res) => {
  res.send('pong');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`השרת מוכן על פורט ${PORT}`);
});
