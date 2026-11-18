'use client';
import dynamic from 'next/dynamic';
// The designer keeps its session and PVGIS cache in localStorage, so it renders in the browser only.
const App = dynamic(() => import('@/components/App'), { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#6b7686' }}>☀ Sanam PV…</div> });
export default function Page() { return <App />; }
