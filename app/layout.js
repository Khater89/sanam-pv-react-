import './globals.css';

export const metadata = {
  title: 'Sanam PV Design Tool',
  description: 'تصميم أنظمة الطاقة الشمسية (مربوط، هجين، منفصل) للأردن بثوابت PVsyst',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
