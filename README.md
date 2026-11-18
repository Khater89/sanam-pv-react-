# Sanam PV Design Tool — Next.js

أداة تصميم أنظمة طاقة شمسية للأردن: مربوطة وهجينة ومنفصلة، بثوابت PVsyst ومعايرة على مشروع مدامة يجوز 2.

## المكونات
| المجلد | شو فيه |
|---|---|
| `lib/engine/` | محرك الحسابات، نفس كود النسخة الأولى بدون أي تغيير: PVsyst chain و PVGIS وقواعد الهيئة وفحص الـ strings |
| `lib/controller.js` | منطق التصميم: التصميم التلقائي، والمحاكاة، والفاتورة، والمشاريع، وقاعدة البيانات |
| `lib/help.js` | الشرح اللي بيطلع جنب كل رقم (؟) |
| `components/` | واجهة React: القائمة الجانبية والمشاريع، والصفحات الست، وصفحة قاعدة البيانات |
| `app/api/pvgis/route.js` | سيرفر PVGIS. المتصفح ما بيقدر يطلب PVGIS مباشرة (CORS)، فالسيرفر بيجيب البيانات وبيخزنها 30 يوم |

قاعدة البيانات Supabase (المشروع `ilmjdunufukrfbjwoyiz`): المعدات والموردين والأسعار والمشاريع، ومحمية بـ RLS.

## التشغيل محلياً
```bash
npm install
npm run dev        # http://localhost:3000
```

## النشر على Railway
1. railway.com ← **New Project** ← **Deploy from GitHub repo** ← اختار `sanam-pv-react-`.
2. **Variables** (اختياري، القيم الافتراضية موجودة بالكود):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ilmjdunufukrfbjwoyiz.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_KEY` = المفتاح العام (publishable)
3. **Settings ← Networking ← Generate Domain** عشان ياخد رابط.
4. أي push على `main` بيعمل deploy لحاله.

`railway.json` بيحدد أوامر البناء والتشغيل (`npm run build` و`npm start`، والـ PORT من Railway).

## Supabase Auth
بعد ما تاخد رابط Railway، ضيفه بـ Supabase ← Authentication ← URL Configuration ← Site URL / Redirect URLs.
