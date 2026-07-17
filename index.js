const { addonBuilder } = require("stremio-addon-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");

// 1. قراءة كل ملفات JSON وجمعها في قاعدة بيانات واحدة
const db = {};
// أضفنا استثناء لملف vercel.json عشان ما يقراه بالخطأ
const files = fs.readdirSync(__dirname).filter(file => file.endsWith(".json") && file !== "package.json" && file !== "vercel.json");

files.forEach(file => {
    const seriesName = file.replace(".json", "");
    try {
        const content = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
        db[seriesName] = content;
    } catch (e) {
        console.error("خطأ في قراءة الملف:", file);
    }
});

// 2. واجهة الإضافة
const manifest = {
    id: "com.arabic.toons.private",
    version: "1.0.0",
    name: "Arabic Toons 📺",
    description: "مكتبة الأنمي الخاصة بي",
    types: ["series"],
    catalogs: [
        {
            type: "series",
            id: "my_anime_catalog",
            name: "مكتبتي الخاصة"
        }
    ],
    resources: ["catalog", "stream", "meta"]
};

const builder = new addonBuilder(manifest);

// 3. عرض المسلسلات في الكتالوج
builder.defineCatalogHandler(({ type, id }) => {
    if (type === "series" && id === "my_anime_catalog") {
        const metas = Object.keys(db).map(seriesName => ({
            id: seriesName,
            type: "series",
            name: seriesName.replace(/_/g, " "),
            poster: "https://via.placeholder.com/250x350/1a1a1a/ffffff?text=Anime", 
            description: "مسلسل من مكتبتي الخاصة"
        }));
        return Promise.resolve({ metas });
    }
    return Promise.resolve({ metas: [] });
});

// 4. تفاصيل المسلسل (عدد الحلقات)
builder.defineMetaHandler(({ type, id }) => {
    if (type === "series" && db[id]) {
        const seriesData = db[id];
        const videos = Object.keys(seriesData).map(epNum => ({
            id: `${id}:1:${epNum}`,
            title: `الحلقة ${epNum}`,
            season: 1,
            episode: parseInt(epNum)
        }));
        
        return Promise.resolve({
            meta: {
                id: id,
                type: "series",
                name: id.replace(/_/g, " "),
                videos: videos
            }
        });
    }
    return Promise.resolve({ meta: {} });
});

// 5. جلب رابط الفيديو للتشغيل
builder.defineStreamHandler(({ type, id }) => {
    if (type === "series") {
        const [seriesId, season, episode] = id.split(":");
        if (db[seriesId] && db[seriesId][episode]) {
            return Promise.resolve({
                streams: [
                    {
                        title: "تشغيل (مباشر)",
                        url: db[seriesId][episode]
                    }
                ]
            });
        }
    }
    return Promise.resolve({ streams: [] });
});

// 6. التصدير لسيرفر Vercel بطريقة رسمية
const app = express();
const addonInterface = builder.getInterface();
app.use("/", require("stremio-addon-sdk").getRouter(addonInterface));

module.exports = app;