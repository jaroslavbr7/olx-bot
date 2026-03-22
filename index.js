const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// 🔐 ВСТАВЬ СЮДА
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// 🎯 Настройки
const targetPrice = 10000;
const maxPercentDiff = 0.5;

const keywords = ["сдам", "квартиру", "2к", "2-к", "кв", "двухкомнатную", "двухкомнатная", "3к", "3-к", "трёхкомнатную", "трёхкомнатная", "евроремонт", "харьков", "Харків", "здам", "грн"];
const excludeKeywords = ["сутки", "1к", "гараж", "гостинка"];

let seenAds = new Set();

function loadSeenAds() {
    try {
        const data = fs.readFileSync('seen.json', 'utf-8');
        const arr = JSON.parse(data);
        seenAds = new Set(arr);
    } catch (e) {
        seenAds = new Set();
    }
}

function saveSeenAds() {
    fs.writeFileSync('seen.json', JSON.stringify([...seenAds]));
}

// 🔧 Парсинг цены
function parsePrice(text) {
    if (!text) return 0;

    const match = text
        .replace(/\s/g, '')
        .match(/\d+/g);

    if (!match) return 0;

    return parseInt(match[0], 10);
}

// 🔍 Фильтр
function isValidAd(title, price) {
    const lower = title.toLowerCase();

    const hasKeyword = keywords.some(k => lower.includes(k));
    const hasExclude = excludeKeywords.some(k => lower.includes(k));

    const diff = Math.abs(price - targetPrice);
    const threshold = targetPrice * maxPercentDiff;

    return hasKeyword && !hasExclude && diff <= threshold;
}

// 📤 Telegram
async function sendToTelegram(ad) {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `🔥 Новое объявление!

📦 ${ad.title}
💰 ${ad.price} грн

🔗 ${ad.link}`
        });

        console.log('✅ Отправлено:', ad.title);
    } catch (err) {
        console.error('❌ Ошибка Telegram:', err.message);
    }
}

// 🔍 Парсинг OLX
async function checkOLX() {
    try {
        const url = 'https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/kharkov/';

        const { data } = await axios.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'ru-RU,ru;q=0.9'
    }
});

        const $ = cheerio.load(data);
        console.log('Найдено объявлений:', $('[data-cy="l-card"]').length);

        $('[data-cy="l-card"]').each((i, el) => {
            let title = $(el)
    .find('h6')
    .clone()
    .children()
    .remove()
    .end()
    .text()
    .trim();
            title = title.replace(/\s+/g, ' ').trim();
            if (title.includes('{') || title.includes('.css')) {
    console.log('❌ Мусорный title, пропуск');
    return;
            }

if (!title) {
    title = $(el).find('h6').text().trim();
}

if (!title) {
    title = $(el).find('a').text().trim();
}
            const priceText = $(el).find('[data-testid="ad-price"]').text().trim();
            let link = $(el).find('a').attr('href');

            if (link && !link.startsWith('http')) {
            link = 'https://www.olx.ua' + link;
}

            const price = parsePrice(priceText);
            console.log('🔎 Проверка:', title, price);

            if (!link || seenAds.has(link)) return;

seenAds.add(link);
saveSeenAds();

            if (isValidAd(title, price)) { console.log('✅ ПОДХОДИТ:', title, price);
                sendToTelegram({ title, price, link });
            }
        });

    } catch (err) {
        console.error('❌ Ошибка парсинга:', err.message);
    }
}

// 🔁 Рандомный интервал
function getRandomDelay() {
    return Math.floor(Math.random() * (90000 - 60000 + 1)) + 60000;
}

// 🚀 Запуск цикла
async function start() {
    while (true) {
        console.log('🔍 Проверка OLX...');

        await checkOLX();

        const delay = getRandomDelay();
        console.log(`⏳ Ждём ${Math.round(delay / 1000)} сек`);

        await new Promise(r => setTimeout(r, delay));
    }
}

loadSeenAds();
start();
