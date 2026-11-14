<div align="center">

# یارا (Yara AI)

**دستیار هوش مصنوعی فارسی، رایگان، تمام‌عیار و قابل نصب روی موبایل (PWA)**

*لودینگ سه‌بعدی تعاملی (Three.js) · احراز هویت و دیتابیس واقعی SQLite · جستجوی زنده وب · درک تصویر و فایل · ورودی و خروجی صوتی*

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Preview-0F766E?style=for-the-badge&logo=github)](https://amiraliSite.github.io/yara-ai/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-0F766E?style=for-the-badge&logo=pwa)](https://amiraliSite.github.io/yara-ai/)
[![React 19](https://img.shields.io/badge/React-19-1E293B?style=for-the-badge&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20Splash-1E293B?style=for-the-badge&logo=threedotjs)](https://threejs.org/)
[![Express + SQLite](https://img.shields.io/badge/Backend-Express%20%2B%20SQLite-1E293B?style=for-the-badge&logo=sqlite)](https://nodejs.org/)

[پیش‌نمایش آنلاین در GitHub Pages](https://amiraliSite.github.io/yara-ai/) · [اجرای کامل فول‌استک](https://ais-dev-nqiiyjtrnolpdgw5347qe6-510879213946.europe-west2.run.app) · [گزارش باگ یا پیشنهاد](https://github.com/amiraliSite/yara-ai/issues)

</div>

---

## معرفی پروژه

**یارا (Yara AI)** یک دستیار هوشمند فارسی (راست‌به‌چپ) و موبایل‌محور است که با تمرکز بر **استفاده کاملاً رایگان**، **پایداری در برابر محدودیت‌های ریت‌لیمیت (Rate Limit)** و **تجربه کاربری سریع** طراحی شده است.

این اپلیکیشن ترکیبی از یک فرانت‌اند مدرن (`React 19` + `Tailwind CSS v4` + `Three.js` + `Vite PWA`) و یک بک‌اند واقعی (`Express` + `node:sqlite`) است که تمام گفتگوها، یادداشت‌ها و نشست‌های هر کاربر را به‌صورت امن در دیتابیس رابطه‌ای ذخیره می‌کند.

> **نکته مهم درباره پیش‌نمایش GitHub Pages:**
> نسخه منتشرشده روی [GitHub Pages](https://amiraliSite.github.io/yara-ai/) یک خروجی استاتیک از فرانت‌اند (شامل صفحه لودینگ سه‌بعدی، رابط ورود/ثبت‌نام و ساختار PWA) است. برای ثبت‌نام واقعی، ذخیره‌سازی در دیتابیس SQLite و دریافت پاسخ‌های زنده هوش مصنوعی باید پروژه را با سرور Node.js (بخش **راه‌اندازی لوکال** یا نسخه فول‌استک) اجرا کنید.

---

## ویژگی‌های کلیدی

### ۱. لودینگ سه‌بعدی اختصاصی قبل از ورود (`Splash3DLoader`)
- طراحی‌شده با **Three.js** و نورپردازی استودیویی (`RoomEnvironment` PMREM + 3-Point Lighting)
- شامل هسته کریستالی چندوجهی، قفس سیمی تیتانیومی، حلقه‌های ژیروسکوپ دوار و ۸۴ ذره مداری (`InstancedMesh`)
- واکنش نرم به حرکت ماوس و لمس، همراه با نوار پیشرفت، دکمه عبور سریع («ورود») و fallback خودکار در صورت نبود WebGL

### ۲. هوش مصنوعی چندلایه با اولویت Free-Tier و جستجوی زنده وب
- **جریان لحظه‌ای پاسخ‌ها (SSE Streaming)** با رندر کامل Markdown، جداول و بلاک‌های کد
- **۴ حالت تخصصی گفتگو:**
  - **وب زنده (`live`):** جستجوی هم‌زمان وب با ذکر لینک منابع معتبر زیر پاسخ
  - **تحلیل و کد (`deep`):** تفکر عمیق برای برنامه‌نویسی، دیباگ و مسائل پیچیده
  - **مترجم (`translate`):** ترجمه دقیق و ویرایش روان فارسی ↔ انگلیسی
  - **سریع (`general`):** پاسخ‌های مستقیم و کوتاه
- **سیستم Fallback خودکار رایگان:** در صورت پر شدن سهمیه لحظه‌ای (`429 RESOURCE_EXHAUSTED`)، سرور به‌طور خودکار از جستجوی زنده داخلی (DuckDuckGo HTML + Wikipedia + استخراج متن لینک‌ها) و مدل پشتیبان رایگان استفاده می‌کند تا پاسخ متوقف نشود.

### ۳. چندرسانه‌ای و صوتی (Multimodal + Voice)
- **ضبط صدا و تبدیل گفتار به متن (STT):** پشتیبانی از میکروفون موبایل و دسکتاپ برای تایپ صوتی فارسی و انگلیسی
- **پخش صوتی پاسخ‌ها (TTS):** خواندن پاسخ دستیار با صدای طبیعی (همراه با fallback مرورگر)
- **تحلیل عکس، دوربین و فایل:** ارسال تصویر مستقیم از گالری یا دوربین موبایل و فایل‌های متنی/کد برای بررسی و تحلیل

### ۴. احراز هویت و دیتابیس واقعی (`SQLite` + `scrypt`)
- فرم کامل **ورود و ثبت‌نام** با اعتبارسنجی کلاینت و سرور
- هش ایمن رمز عبور با `crypto.scrypt` و Salt تصادفی یکتا
- نشست‌های کاربری با توکن تصادفی (`HttpOnly Cookie` + `Authorization: Bearer`)
- ذخیره‌سازی خودکار تاریخچه چت‌ها، پیام‌ها، منابع وب و **یادداشت‌های ذخیره شده** در دیتابیس رابطه‌ای

### ۵. اپلیکیشن پیشرونده موبایل (PWA) + تم تاریک/روشن
- قابل نصب روی صفحه اصلی اندروید و iOS (`manifest.webmanifest` + Service Worker با `vite-plugin-pwa`)
- پشتیبانی از کش آفلاین آخرین گفتگوها و یادداشت‌ها در `localStorage` و نمایش وضعیت آنلاین/آفلاین
- طراحی RTL با فونت‌های **Vazirmatn** و **JetBrains Mono** و سوییچ سریع تم روشن/تاریک

---

## معماری و ساختار پروژه

```text
yara-ai/
├── server.ts                       # سرور Express، روت‌های Auth/CRUD، استریم Gemini و جستجوی وب رایگان
├── vite.config.ts                  # تنظیمات Vite، Tailwind v4 و VitePWA (با پشتیبانی از زیرمسیر Pages)
├── index.html                      # سند HTML راست‌به‌چپ + متا تگ‌های PWA/iOS و فونت‌ها
├── public/                         # آیکون‌های PWA در اندازه‌های استاندارد (SVG, 192, 512, maskable, Apple)
└── src/
    ├── App.tsx                     # هسته رابط کاربری چت، ضبط صدا، پخش TTS، یادداشت‌ها و مدیریت آفلاین
    ├── types.ts                    # تایپ‌های TypeScript مشترک
    ├── db/
    │   ├── schema.ts               # اسکیمای SQL رابطه‌ای (WAL + Foreign Keys + Indexes)
    │   └── database.ts             # لایه دیتابیس با node:sqlite، هش scrypt و عملیات CRUD
    ├── lib/
    │   └── api.ts                  # کلاینت fetch با پشتیبانی توکن Bearer و VITE_API_BASE_URL
    ├── hooks/
    │   ├── useOnlineStatus.ts      # تشخیص وضعیت شبکه
    │   └── usePWAInstall.ts        # مدیریت رویداد نصب PWA روی مرورگرهای مختلف
    └── components/
        ├── Splash3DLoader.tsx      # صحنه لودینگ سه‌بعدی Three.js قبل از ورود
        ├── AuthScreen.tsx          # فرم ورود / ثبت‌نام با تب سوئیچ و نمایش خطاها
        ├── SidebarContent.tsx      # سایدبار و منوی موبایل (چت‌ها، یادداشت‌ها، پروفایل، تم)
        ├── MarkdownRenderer.tsx    # رندر ایمن Markdown و جداول + دکمه کپی کد
        ├── OfflineIndicator.tsx    # بنر اطلاع‌رسانی حالت آفلاین
        └── PWAInstallButton.tsx    # دکمه نصب اپلیکیشن روی موبایل و دسکتاپ
```

---

## ساختار دیتابیس (`src/db/schema.ts`)

دیتابیس با `node:sqlite` (ساخته‌شده درون Node.js v22+) در مسیر `data/yara.db` با حالت `WAL` و `PRAGMA foreign_keys = ON` ایجاد می‌شود:

| جدول | کاربرد | کلیدها و روابط |
| :--- | :--- | :--- |
| `users` | اطلاعات کاربران و تنظیمات | `id (PK)`, `email (UNIQUE)`, `password_hash` |
| `auth_sessions` | نشست‌های فعال ورود (۳۰ روزه) | `token (PK)`, `user_id -> users.id (CASCADE)` |
| `chat_sessions` | لیست گفتگوها و حالت هر چت | `id (PK)`, `user_id -> users.id (CASCADE)` |
| `chat_messages` | پیام‌ها، فایل‌های پیوست و منابع وب | `id (PK)`, `session_id -> chat_sessions.id`, `user_id` |
| `saved_notes` | یادداشت‌های پین‌شده از پاسخ‌ها | `id (PK)`, `user_id -> users.id (CASCADE)` |

---

## API Endpoints

| متد | مسیر | احراز هویت | توضیح |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | خیر | ساخت حساب جدید و صدور توکن نشست |
| `POST` | `/api/auth/login` | خیر | ورود کاربر با ایمیل و رمز عبور |
| `GET` | `/api/auth/me` | بله | دریافت پروفایل کاربر فعلی |
| `POST` | `/api/auth/logout` | بله | خروج و ابطال نشست در دیتابیس |
| `GET` | `/api/chats` | بله | دریافت تمام جلسات گفتگو و پیام‌های کاربر |
| `POST` | `/api/chats` | بله | ایجاد گفتگوی جدید |
| `PATCH` | `/api/chats/:id` | بله | ویرایش عنوان یا حالت گفتگو |
| `DELETE` | `/api/chats/:id` | بله | حذف کامل یک گفتگو |
| `GET` / `POST` / `DELETE` | `/api/notes` | بله | مدیریت یادداشت‌های ذخیره شده |
| `POST` | `/api/chat` | بله | ارسال پیام و دریافت پاسخ جریانی (SSE) + ذخیره خودکار در DB |
| `POST` | `/api/transcribe` | بله | تبدیل فایل صوتی ضبط‌شده به متن |
| `POST` | `/api/tts` | بله | تبدیل متن پاسخ به فایل صوتی |

---

## راه‌اندازی و اجرا روی سیستم شخصی

### پیش‌نیازها
- **Node.js نسخه 22 یا بالاتر** (برای پشتیبانی بومی از `node:sqlite`)
- یک کلید رایگان **Gemini API Key** از [Google AI Studio](https://aistudio.google.com/)

### مراحل نصب و اجرا

```bash
# ۱. کلون کردن مخزن
git clone https://github.com/amiraliSite/yara-ai.git
cd yara-ai

# ۲. نصب پکیج‌ها
npm install

# ۳. تنظیم متغیرهای محیطی
cp .env.example .env
# سپس مقدار GEMINI_API_KEY را داخل فایل .env قرار دهید

# ۴. اجرای محیط توسعه (فرانت‌اند + بک‌اند هم‌زمان روی پورت 3000)
npm run dev
```

برنامه روی آدرس زیر در دسترس خواهد بود:
`http://localhost:3000`

### بیلد تولید (Production) و دیپلوی استاتیک

```bash
# بیلد نسخه فرانت‌اند برای اجرای فول‌استک
npm run build
npm start

# بررسی تایپ‌های TypeScript
npm run lint

# بیلد استاتیک با مسیر پایه دلخواه (مثلاً برای GitHub Pages)
GITHUB_PAGES_BASE=/yara-ai/ npm run build
```

---

## تکنولوژی‌های استفاده‌شده

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Three.js, Lucide Icons, React Markdown + Remark GFM
- **PWA:** `vite-plugin-pwa`, Workbox Runtime Caching, Web App Manifest
- **Backend:** Node.js 22 (`node:sqlite`, `node:crypto`), Express.js, `@google/genai`
- **Build & Tooling:** Vite 8, `tsx`

---

<div align="center">

ساخته‌شده با عشق برای تجربه هوش مصنوعی سریع، فارسی و رایگان

</div>
