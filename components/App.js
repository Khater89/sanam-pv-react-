'use client';
import { useMemo, useSyncExternalStore, useEffect } from 'react';
import { initI18n } from '@/lib/i18n';
import Controller from '@/lib/controller';
import { useRipple } from './ui';
import { PSite, POrient, PLoads, PSystem, PLosses, PReport, FullDesign } from './Pages';
import DBPage from './DBPage';
import { TopBar, SideNav, Dashboard, ProjectsList, NewProject, ProjectHeader } from './Shell';

export default function App() {
  const ctl = useMemo(() => new Controller(), []);
  useSyncExternalStore(ctl.subscribe, ctl.snapshot, ctl.snapshot);
  useEffect(() => { ctl.start(); initI18n(); if (typeof window !== 'undefined') window.__sanam = ctl; }, [ctl]);
  useRipple();
  const p = ctl.page, v = ctl.view;
  return (
    <div className="min-h-screen">
      <TopBar ctl={ctl} />
      <div className="flex">
        <SideNav ctl={ctl} />
        <main className="fn-main min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            {v === 'home' && <Dashboard ctl={ctl} />}
            {v === 'saved' && <ProjectsList ctl={ctl} />}
            {v === 'new' && <NewProject ctl={ctl} />}
            {v === 'db' && <div className="wo dbw"><h1 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900">المعدات والموردين</h1><DBPage ctl={ctl} /></div>}
            {v === 'work' && <div className="wo">
              <ProjectHeader ctl={ctl} />
              <div className="page on" id={'p' + p} key={p}>
                {p === '1' && <PSite ctl={ctl} />}
                {p === '2' && <POrient ctl={ctl} />}
                {p === '5' && <PLoads ctl={ctl} />}
                {p === '3' && <PSystem ctl={ctl} />}
                {p === '4' && <PLosses ctl={ctl} />}
                {p === '6' && <PReport ctl={ctl} />}
                {p === '8' && <FullDesign ctl={ctl} />}
                {p === '7' && <DBPage ctl={ctl} />}
              </div>
            </div>}
          </div>
        </main>
      </div>
      <div id="toasts">{ctl.toasts.map(t => <div key={t.id} className={'toast ' + t.k}>{t.t}</div>)}</div>
    </div>
  );
}
