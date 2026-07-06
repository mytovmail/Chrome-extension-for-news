process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Raw } = require('telegram/events');

const app = express();
app.use(cors());

// הגדרת כותרות דפדפן עשירות והגדלת ה-Timeout למעקף חסימות RSS ו-403
const parser = new Parser({
    timeout: 10000, // 10 שניות
    headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
});

// הצהרת משתנים גלובליים בראש הקובץ למניעת בעיות Scope
let newsList = [];
let clients = [];
const MAX_NEWS = 1000;

const channelRegistry = new Map();
const entityCache = new Map();

// משתני בטיחות לניהול ה-Polling והחיבור מחדש
let pollIndex = 0;
let isPolling = false;
let isReconnecting = false;
let pollingInterval = null; // פתרון לניהול גלובלי של ה-Interval

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionString = process.env.TELEGRAM_SESSION || process.env.SESSION_STRING || "";

const rssChannels = [
    { name: "JDN (אתר)", url: "https://www.jdn.co.il/feed/" },
    { name: "ערוץ 7 (אתר)", url: "https://www.inn.co.il/Rss.aspx?Category=1" },
    { name: "סרוגים (אתר)", url: "https://www.srugim.co.il/feed" },
    { name: "המחדש (אתר)", url: "https://hm-news.co.il/feed/" },
    { name: "בחדרי חרדים (אתר)", url: "https://www.bhol.co.il/rss.xml" },
    { name: "ערוץ 14 (אתר)", url: "https://www.now14.co.il/feed/" }
];

// ==========================================
// לוגיקת סינון וצנזורה (צניעות, בטיחות וחסימת שיווק)
// ==========================================

function shouldBlockMessage(text) {
    if (!text) return false;

    const blockList = [
        "אונס", "נאנסה", "פדופיל", "פדופיליה", "תקיפה מינית", "הטרדה מינית", 
        "מעשה מגונה", "מעשים מגונים", "גילוי עריות", "סקס", "יחסי אישות", "פורנו",
        "יחסי מין", "פורנוגרפיה",
        "פרסומת", "ממומן", "פוסט ממומן", "תוכן שיווקי", "דיל היום", "קופון חלומי", "קנו עכשיו"
    ];

    const lowerText = text.toLowerCase();
    return blockList.some(word => lowerText.includes(word));
}

function censorText(text) {
    if (!text) return "";

    const censorList = [
        "חראות", "חרא", "זבלים", "זבל", "נבלות", "נבלה", "מחורבנת", "מחורבן", "חולירע", "לעזאזל",
        "בן זונה", "זונות", "זונה", "שרמוטה", "מניאקים", "מניאק", "שרצים", "שיט"
    ];

    let censored = text;

    censorList.forEach(word => {
        const regex = new RegExp(word, 'gi');
        censored = censored.replace(regex, '***');
    });

    return censored;
}

// ==========================================
// לוגים וסטטיסטיקה
// ==========================================

const LATENCY_LOG = [];

function logLatency(source, stage, telegramTimestamp, extraInfo = '') {
    const delay = (Date.now() - telegramTimestamp * 1000) / 1000;
    const entry = { time: new Date().toISOString(), source, stage, serverDelaySeconds: delay.toFixed(1), extraInfo };
    LATENCY_LOG.unshift(entry);
    if (LATENCY_LOG.length > 200) LATENCY_LOG.pop();
    const icon = delay < 5 ? '🟢' : delay < 20 ? '🟡' : '🔴';
    console.log(`${icon} [${stage}] ${source} | עיכוב: ${delay.toFixed(1)}s${extraInfo ? ' | ' + extraInfo : ''}`);
}

app.get('/latency', (req, res) => res.json({
    summary: {
        total: LATENCY_LOG.length,
        clients: clients.length,
        polledChannels: [...channelRegistry.values()].map(c => ({
            name: c.name,
            lastMsgId: c.lastMsgId
        }))
    },
    log: LATENCY_LOG
}));

// ==========================================
// SSE ו-API
// ==========================================

app.get('/', (req, res) => res.json(newsList));
app.get('/ping', (req, res) => res.send('pong'));

app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const clientId = Date.now();
    clients.push({ id: clientId, res });
    console.log(`📡 לקוח התחבר (סה"כ: ${clients.length})`);
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
        console.log(`📡 לקוח התנתק (נותרו: ${clients.length})`);
    });
});

setInterval(() => clients.forEach(c => c.res.write(':\n\n')), 25000);

function generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

function broadcast(newsItem, telegramDate) {
    if (telegramDate && clients.length > 0) {
        console.log(`📤 שידור ל-${clients.length} לקוחות | עיכוב: ${((Date.now() - telegramDate * 1000) / 1000).toFixed(1)}s`);
    }
    clients.forEach(c => c.res.write(`data: ${JSON.stringify({ type: 'news', data: newsItem })}\n\n`));
}

// ==========================================
// לוגיקת סריקה סדרתית מאובטחת וחסינת FloodWait
// ==========================================

async function pollOneChannel(client) {
    if (isPolling) return;
    const pollable = [...channelRegistry.entries()];
    if (!pollable.length) return;

    pollIndex = pollIndex % pollable.length;
    const [channelId, state] = pollable[pollIndex++];
    isPolling = true;

    try {
        const msgs = await client.getMessages(state.entity, {
            limit: 3,
            min_id: state.lastMsgId || 0
        });
        const sorted = [...(msgs || [])].sort((a, b) => a.id - b.id);
        for (const msg of sorted) {
            if (!msg?.message || msg.id <= (state.lastMsgId || 0)) continue;
            if (Date.now() - msg.date * 1000 > 5 * 60 * 1000) continue;
            state.lastMsgId = msg.id;
            logLatency(state.name, 'serial_poll', msg.date);
            addNewsItem(buildNewsItem(msg, state.name, channelId), msg.date);
        }
        isPolling = false; // שחרור במקרה של הצלחה
    } catch (e) {
        if (e.message?.includes('FLOOD_WAIT')) {
            const w = parseInt(e.message.match(/\d+/)?.[0] || '10');
            console.warn(`⏳ FloodWait ${w}s detected — עצירת ה-polling לצורכי המתנה מבוקרת`);
            // isPolling נשאר נעול (true) כדי לחסום בקשות פולינג נוספות עד תום העונש
            setTimeout(() => { isPolling = false; }, w * 1000);
        } else {
            console.warn(`[poll] ${state?.name}: ${e.message}`);
            isPolling = false; // שחרור במקרה של שגיאה רגילה (מניעת Deadlock)
        }
    }
}

// ==========================================
// בניית פריט החדשות
// ==========================================

function buildNewsItem(message, channelName, channelIdStr, isEdited = false) {
    if (!message) return null;
    if (message.sponsored || message.isSponsored) {
        return null;
    }

    let rawText = message.message || message.text || "";
    let mediaIndicator = ""; 

    try {
        if (message.media) {
            const mediaClass = message.media.className;
            if (mediaClass === 'MessageMediaPhoto' || message.photo) {
                mediaIndicator = "\n[תמונה במקור]";
            } else if (mediaClass === 'MessageMediaDocument' || message.video || message.gif) {
                const mime = message.media.document?.mimeType || "";
                if (mime.startsWith('video') || message.video) {
                    mediaIndicator = "\n[סרטון במקור]";
                }
            } else if (mediaClass === 'MessageMediaPoll' || message.poll) {
                const pollObj = message.media.poll;
                if (pollObj) {
                    const q = pollObj.question;
                    const questionText = (q && typeof q === 'object') ? (q.text || "") : (q || "");
                    rawText = `סקר: ${questionText}`;
                    mediaIndicator = "\n[סקר במקור]";
                }
            }
        }
    } catch (e) {
        console.error("⚠️ שגיאה לא קריטית בפענוח סוג המדיה - ממשיך לעבד טקסט:", e.message);
    }

    if (!rawText.trim()) rawText = "[מדיה]";

    if (shouldBlockMessage(rawText)) {
        console.log(`🚫 פוסט נחסם אוטומטית (תוכן בעייתי/שיווקי): ${channelName} | ${rawText.substring(0, 40)}...`);
        return null; 
    }

    const stopWords = ["להמשך קריאה", "להצטרפות", "לכל העדכונים", "כנסו",
        "לפרטים נוספים", "t.me", "chat.whatsapp.com", "לקבוצת הוואטסאפ", "לערוץ הטלגרם"];

    let filteredLines = [];
    for (let line of rawText.split('\n')) {
        if (stopWords.some(w => line.includes(w))) break;
        if (line.trim()) filteredLines.push(line);
    }

    if (filteredLines.length === 0) return null;

    let fullContent = filteredLines.join('\n') + mediaIndicator;
    const cleanContent = censorText(fullContent);

    const idClean = channelIdStr ? channelIdStr.toString().replace('-100', '') : '';
    return {
        hash: generateHash(rawText + channelName + (message.id || '')),
        title: "", 
        content: cleanContent, 
        link: idClean ? `https://t.me/c/${idClean}/${message.id}` : '#',
        source: channelName + (isEdited ? ' [ערוך]' : ''),
        imageUrl: null,
        time: new Date((message.date || Math.floor(Date.now() / 1000)) * 1000).toISOString()
    };
}

function addNewsItem(item, telegramDate) {
    if (!item) return false;
    if (newsList.find(n => n.hash === item.hash)) return false;
    newsList.unshift(item);
    if (newsList.length > MAX_NEWS) newsList.pop();
    broadcast(item, telegramDate);
    return true;
}

// ==========================================
// טלגרם (אמינות והזרמה מיידית בזמן אמת)
// ==========================================

async function startTelegramClient() {
    if (!sessionString || sessionString.includes("הכנס_כאן")) {
        console.log("דילוג - לא הוזנה Session"); return;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
            connectionRetries: 15,
            retryDelay: 3000,
            autoReconnect: true,
            floodSleepThreshold: 90,
            receiveUpdates: true,
            useWSS: true
        });

        await client.connect();
        await client.getMe();
        console.log("✅ מחובר לטלגרם!");

        // מניעת לולאת התחברות כפולה ברקע באמצעות דגל חסימה
        client.on('disconnect', () => {
            if (isReconnecting) return;
            isReconnecting = true;
            console.warn("❌ החיבור לשרתי טלגרם אבד לחלוטין. מנסה להתחבר מחדש בעוד 5 שניות...");
            setTimeout(() => { 
                isReconnecting = false; 
                startTelegramClient(); 
            }, 5000);
        });

        console.log("⏳ טוען דיאלוגים ואחזור הודעות אחרונות...");
        const dialogs = await client.getDialogs({ limit: 200 }); // הגבלה בטוחה ל-200 דיאלוגים למניעת FloodWait

        for (const dialog of dialogs) {
            if (!dialog.entity) continue;
            const id = dialog.entity.id?.toString();
            if (!id) continue;
            const name = dialog.entity.title || dialog.entity.firstName || `ערוץ ${id}`;

            entityCache.set(id, name);
            const lastMsgId = dialog.dialog?.topMessage || 0;

            channelRegistry.set(id, {
                name,
                entity: dialog.entity,
                lastMsgId,
                lastPollTime: Date.now() 
            });

            if (dialog.message) {
                const item = buildNewsItem(dialog.message, name, id);
                if (item && !newsList.find(n => n.hash === item.hash)) {
                    newsList.push(item);
                }
            }
        }

        newsList.sort((a, b) => new Date(b.time) - new Date(a.time));
        console.log(`✅ נטענו ${channelRegistry.size} ערוצים וההיסטוריה אותחלה`);

        // פתרון מניעת דליפת intervals: ניקוי ה-Interval הקודם לפני הפעלת החדש
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        pollingInterval = setInterval(() => pollOneChannel(client), 2000);

        setInterval(async () => {
            try { await client.invoke(new Api.account.UpdateStatus({ offline: false })); } catch {}
        }, 30000);

        // המאזין בזמן אמת של טלגרם
        client.addEventHandler(async (update) => {

            if (update.className === 'UpdateChannelTooLong') {
                const chId = update.channelId?.toString();
                const state = chId ? channelRegistry.get(chId) : null;
                if (state && state.entity) {
                    console.log(`⚡ Updates TooLong detected on ${state.name}. Syncing...`);
                    // שימוש מבוסס min_id למניעת מרוץ או שאיבת כפילויות מיותרות
                    client.getMessages(state.entity, { limit: 5, min_id: state.lastMsgId || 0 }).then(msgs => {
                        const sorted = [...(msgs || [])].sort((a, b) => a.id - b.id);
                        sorted.forEach(msg => {
                            if (msg.id > (state.lastMsgId || 0)) {
                                state.lastMsgId = msg.id;
                                const item = buildNewsItem(msg, state.name, chId);
                                addNewsItem(item, msg.date);
                            }
                        });
                    }).catch(e => console.error("Error during TooLong sync:", e.message));
                }
                return;
            }

            const validUpdateTypes = [
                'UpdateNewChannelMessage', 'UpdateEditChannelMessage',
                'UpdateNewMessage', 'UpdateEditMessage'
            ];
            if (!validUpdateTypes.includes(update.className)) return;

            const message = update.message;
            if (!message) return;

            const peerId = message.peerId;
            const channelId = (peerId?.channelId || peerId?.chatId || peerId?.userId)?.toString();
            if (!channelId) return;

            const state = channelRegistry.get(channelId);
            const channelName = entityCache.get(channelId) || `מקור (${channelId})`;

            if (state) {
                if (message.id > (state.lastMsgId || 0)) state.lastMsgId = message.id;
            }

            const isEdited = update.className.includes('Edit');
            logLatency(channelName, 'push_listener', message.date, update.className);

            const item = buildNewsItem(message, channelName, channelId, isEdited);
            addNewsItem(item, message.date);

        }, new Raw({}));

        console.log("✅ מאזין דחיפה (Push Listener) פעיל בזמן אמת");

    } catch (error) {
        console.error("❌ שגיאה בהתחברות לשרתי טלגרם:", error.message);
        setTimeout(startTelegramClient, 30000);
    }
}

// ==========================================
// RSS
// ==========================================

async function fetchRSSData(channel) {
    try {
        const feed = await parser.parseURL(channel.url);
        feed.items.reverse().forEach(item => {
            const rawContent = item.content || item.contentSnippet || '';
            const cleanText = cheerio.load(rawContent).text().replace(/<[^>]+>/g, '').trim();
            
            // מניעת כפילויות וסינון תכנים פוסלים (Block) באתרי חדשות ו-RSS
            if (shouldBlockMessage(item.title) || shouldBlockMessage(cleanText)) {
                return; 
            }

            let imageUrl = item.enclosure?.url || null;
            if (!imageUrl) { const m = rawContent.match(/<img[^>]+src="([^">]+)"/i); if (m) imageUrl = m[1]; }
            
            // החלת צנזור כוכביות על כותרות וגוף הכתבות של אתרי החדשות
            const cleanTitle = censorText(item.title);
            const cleanBody = censorText(cleanText);

            const hash = generateHash(cleanTitle + cleanBody);
            if (newsList.find(n => n.hash === hash)) return;
            if (new Date(item.isoDate || 0).getTime() < Date.now() - 48 * 3600 * 1000) return;
            
            const newsItem = { hash, title: cleanTitle, content: cleanBody, link: item.link, source: channel.name, imageUrl, time: item.isoDate || new Date().toISOString() };
            newsList.unshift(newsItem);
            if (newsList.length > MAX_NEWS) newsList.pop();
            broadcast(newsItem, null);
        });
        newsList.sort((a, b) => new Date(b.time) - new Date(a.time));
    } catch (e) { console.error(`[RSS] שגיאה מ-${channel.name}: ${e.message}`); }
}

setInterval(() => Promise.allSettled(rssChannels.map(fetchRSSData)), 60 * 1000);
Promise.allSettled(rssChannels.map(fetchRSSData));
startTelegramClient();

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) setInterval(async () => { try { await fetch(`${RENDER_URL}/ping`); } catch {} }, 10 * 60 * 1000);

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`✅ שרת פועל על פורט ${PORT}`));
