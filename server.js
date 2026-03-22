// קובץ: server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); 

let cachedMessages = [];

// הרשימה הענקית - כולל כל ערוצי המבזקים מסביב לשעון שביקשת
const channels = [
  // חדשות ואתרים מרכזיים
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1" },
  { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/" },
  { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed" },
  { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/" },
  { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml" },
  
  // ערוצי מבזקים אקטיביים מסביב לשעון
  { name: "301 העולם הערבי", url: "https://rsshub.app/telegram/channel/arabworld301" },
  { name: "המוקד", url: "https://rsshub.app/telegram/channel/hamoked_il" },
  { name: "מבזקי בטחון 24/7", url: "https://rsshub.app/telegram/channel/mivzakeybitachon" },
  { name: "חדשות קודקוד", url: "https://rsshub.app/telegram/channel/kodkodgroup" },
  { name: "זירת החדשות", url: "https://rsshub.app/telegram/channel/ZiratNews" },
  { name: "זירה פוליטית", url: "https://rsshub.app/telegram/channel/Zira_politit" },
  { name: "החדשות החמות", url: "https://rsshub.app/telegram/channel/hachadashot_hachamot" },
  { name: "חדשות הבזק", url: "https://rsshub.app/telegram/channel/mivzakimnet" },
  { name: "חדשות ישראל", url: "https://rsshub.app/telegram/channel/israel_news_telegram" },
  { name: "עדכונים ומבזקים", url: "https://rsshub.app/telegram/channel/idkunim_mivzakim" },
  { name: "הקו החרדי", url: "https://rsshub.app/telegram/channel/kavhacharedi" },
  { name: "צ'אט הכתבים (N12)", url: "https://rsshub.app/telegram/channel/N12chat" },
  { name: "חדשות 25", url: "https://rsshub.app/telegram/channel/news25" },
  
  // עיתונאים, חסד ורבנים (מהרשימה הקודמת)
  { name: "עמית סגל", url: "https://rsshub.app/telegram/channel/amitsegal" },
  { name: "ינון מגל", url: "https://rsshub.app/telegram/channel/yinonmagal" },
  { name: "יאיר שרקי", url: "https://rsshub.app/telegram/channel/yaircherki" },
  { name: "ישי כהן", url: "https://rsshub.app/telegram/channel/ishaycoen" },
  { name: "אבי רבינא", url: "https://rsshub.app/telegram/channel/AviRabina" },
  { name: "מיכאל שמש", url: "https://rsshub.app/telegram/channel/michaelshemesh" },
  { name: "דורון קדוש (צבא)", url: "https://rsshub.app/telegram/channel/doron_kadosh" },
  { name: "כיכר השבת", url: "https://rsshub.app/telegram/channel/kikarhashabat" },
  { name: "כל רגע", url: "https://rsshub.app/telegram/channel/kollrega" },
  { name: "קול חי", url: "https://rsshub.app/telegram/channel/kolhai" },
  { name: "מבזק לייב", url: "https://rsshub.app/telegram/channel/MivzakLive" },
  { name: "פיקוד העורף", url: "https://rsshub.app/telegram/channel/PikudHaoref_official" },
  { name: "זק״א", url: "https://rsshub.app/telegram/channel/zakahq" },
  { name: "איחוד הצלה", url: "https://rsshub.app/telegram/channel/UnitedHatzalahIL" },
  { name: "מגן דוד אדום", url: "https://rsshub.app/telegram/channel/mda_israel" },
  { name: "הלכה יומית", url: "https://rsshub.app/telegram/channel/halachayomit" },
  { name: "הדף היומי", url: "https://rsshub.app/telegram/channel/hadafyomi_il" }
];

async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מושך נתונים מזמן אמת...`);
  let allMessages = [];

  for (const channel of channels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); 
      
      // הוספנו בסוף הכתובת ?t=... כדי לשבור את המטמון של RSSHub ולהכריח אותם להביא מידע של השנייה האחרונה
      const bypassCacheUrl = channel.url.includes('?') ? 
        `${channel.url}&t=${Date.now()}` : 
        `${channel.url}?t=${Date.now()}`;

      const response = await fetch(bypassCacheUrl, { signal: controller.signal });
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
      // דילוג על שגיאות בערוץ ספציפי כדי לשמור על יציבות השרת
    }
    
    // משהים ל-500 אלפיות השנייה כדי לא להיחסם בעצמנו על הצפה
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (allMessages.length > 0) {
    cachedMessages = allMessages;
    console.log(`משיכה הסתיימה בהצלחה. הזיכרון עודכן עם ${cachedMessages.length} הודעות.`);
  } else {
    console.log(`לא התקבלו הודעות (עומס זמני). שומר על הזיכרון הקיים.`);
  }
}

fetchNews();
setInterval(fetchNews, 60 * 1000); // רץ פעם בדקה בדיוק!

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
