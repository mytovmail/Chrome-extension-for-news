const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // מאפשר לתוסף שלנו לגשת לנתונים

// זהו "זיכרון השרת" - כאן נשמור את ההודעות כדי להגיש אותן במהירות שיא
let cachedMessages = [];

// רשימת הערוצים (הדבק כאן את הרשימה המלאה שלך)
const channels = [
  { name: "JDN חדשות (אתר)", url: "https://www.jdn.co.il/feed/" },
  { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1" },
  { name: "עמית סגל", url: "https://rsshub.app/telegram/channel/amitsegal" },
  { name: "כיכר השבת", url: "https://rsshub.app/telegram/channel/kikarhashabat" },
  { name: "כל רגע", url: "https://rsshub.app/telegram/channel/kollrega" },
  { name: "קול חי", url: "https://rsshub.app/telegram/channel/kolhai" }
];

// הפונקציה ששואבת את החדשות
async function fetchNews() {
  console.log(`[${new Date().toLocaleTimeString('he-IL')}] מושך נתונים מהערוצים...`);
  let allMessages = [];

  const fetchPromises = channels.map(async (channel) => {
    try {
      // שימוש ב-AbortController כדי למנוע היתקעות השרת בגלל ערוץ שקרס
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); 
      
      const response = await fetch(channel.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) return;
      const text = await response.text();
      
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<\/item>/gi;
      let match;
      let count = 0;
      
      while ((match = itemRegex.exec(text)) !== null && count < 2) {
        let title = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        allMessages.push({ text: title, source: channel.name });
        count++;
      }
    } catch (e) {
      // מתעלמים באלגנטיות משגיאה בערוץ ספציפי כדי לא לעצור את שאר העדכונים
    }
  });

  await Promise.allSettled(fetchPromises);
  
  // עדכון הזיכרון של השרת עם הנתונים הטריים
  cachedMessages = allMessages;
  console.log(`משיכה הסתיימה. הזיכרון עודכן עם ${cachedMessages.length} הודעות.`);
}

// 1. הפעלה ראשונית מיד כשהשרת עולה
fetchNews();

// 2. הגדרת טיימר פנימי: ירוץ כל 60 שניות בדיוק! (זמן אמת)
setInterval(fetchNews, 60 * 1000);

// הכתובת שהתוסף פונה אליה
app.get('/', (req, res) => {
  // ברגע שמשתמש פונה, אנחנו ישר מחזירים לו את המשתנה מהזיכרון. 
  // ללא המתנה וללא קריאות רשת נוספות!
  res.json(cachedMessages);
});

// הפעלת השרת על הפורט הפנוי
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`השרת רץ ומוכן על פורט ${PORT}`);
});
