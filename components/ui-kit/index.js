'use client';
/* shadcn/ui-style primitives (Tailwind + cva + Radix), kept local so no registry download is needed */
import * as TabsP from '@radix-ui/react-tabs';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[.98] cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0',
  { variants: {
      variant: {
        default: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        accent: 'bg-gradient-to-l from-amber-500 to-orange-500 text-white shadow-sm shadow-orange-500/30 hover:brightness-105',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        danger: 'text-red-600 hover:bg-red-50',
        dark: 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-[13px]', lg: 'h-11 px-6 text-[15px]', icon: 'size-9' }
    },
    defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ className, variant, size, ...p }) { return <button className={cn(buttonVariants({ variant, size }), className)} {...p} />; }

export function Card({ className, ...p }) { return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]', className)} {...p} />; }
export function CardHeader({ className, ...p }) { return <div className={cn('flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5', className)} {...p} />; }
export function CardTitle({ className, ...p }) { return <h3 className={cn('text-[15px] font-bold text-slate-900', className)} {...p} />; }
export function CardContent({ className, ...p }) { return <div className={cn('p-5', className)} {...p} />; }

const badgeV = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', {
  variants: { tone: {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200', blue: 'bg-blue-50 text-blue-700 ring-blue-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', orange: 'bg-orange-50 text-orange-700 ring-orange-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200', teal: 'bg-teal-50 text-teal-700 ring-teal-200' } }, defaultVariants: { tone: 'slate' } });
export function Badge({ className, tone, dot, children, ...p }) {
  return <span className={cn(badgeV({ tone }), className)} {...p}>{dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}{children}</span>; }

export function Input({ className, ...p }) { return <input className={cn('h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20', className)} {...p} />; }
export function NativeSelect({ className, children, ...p }) { return <select className={cn('h-9 w-full appearance-auto bg-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20', className)} {...p}>{children}</select>; }

export const Tabs = TabsP.Root;
export function TabsList({ className, ...p }) { return <TabsP.List className={cn('flex gap-1 overflow-x-auto border-b border-slate-200 px-2', className)} {...p} />; }
export function TabsTrigger({ className, ...p }) {
  return <TabsP.Trigger className={cn('relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3.5 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-800 data-[state=active]:border-brand-600 data-[state=active]:text-brand-700 cursor-pointer', className)} {...p} />; }

export function Table({ className, ...p }) { return <div className="w-full overflow-x-auto"><table className={cn('fn-table w-full text-sm', className)} {...p} /></div>; }

export function Stat({ label, value, sub, icon: Icon, tone = 'blue' }) {
  const t = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' }[tone];
  return <Card className="flex items-center gap-4 p-4">
    {Icon && <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', t)}><Icon className="size-5" /></div>}
    <div className="min-w-0"><div className="text-[12.5px] font-medium text-slate-500">{label}</div><div className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-900" dir="ltr" style={{ textAlign: 'right' }}>{value}</div>{sub && <div className="text-xs text-slate-400">{sub}</div>}</div>
  </Card>; }
