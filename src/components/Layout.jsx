import React, { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, CandlestickChart, Target, CalendarDays,
  Newspaper, Bell, BookOpen, BarChart3, Bot, Settings, Menu, X,
  Coins, DollarSign, TrendingUp, Cpu, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertMonitor } from '@/hooks/useAlertMonitor';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: LineChart },
  { to: '/market/XAUUSD', label: 'XAUUSD', icon: Coins, gold: true },
  { to: '/market/EURUSD', label: 'EURUSD', icon: DollarSign },
  { to: '/setups', label: 'Setups', icon: Target },
  { to: '/chart', label: 'Chart', icon: CandlestickChart },
  { to: '/calendar', label: 'Economic Calendar', icon: CalendarDays },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
  { to: '/auto-trade', label: 'Auto-Trade', icon: Cpu },
  { to: '/brokers', label: 'Brokers', icon: Plug },
  { to: '/ai', label: 'AI Analyst', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: LineChart },
  { to: '/setups', label: 'Setups', icon: Target },
  { to: '/ai', label: 'AI', icon: Bot },
  { to: '/journal', label: 'Journal', icon: BookOpen },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  useAlertMonitor();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-sidebar border-r border-sidebar-border z-40">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-gold-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold tracking-tight text-[15px]">Apex Terminal</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Market Analysis</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2.5 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                )
              }
            >
              <item.icon className={cn('w-4 h-4', item.gold && 'text-gold')} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-[10px] text-muted-foreground leading-relaxed">
          Paper trading mode. Not financial advice. Capital preservation first.
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-sidebar/95 backdrop-blur border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-gold-foreground" />
          </div>
          <span className="font-display font-semibold text-sm">Apex Terminal</span>
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 -mr-2 text-foreground">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
              <span className="font-display font-semibold text-sm">Menu</span>
              <button onClick={() => setOpen(false)} className="p-2 -mr-2"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2.5 space-y-0.5" onClick={() => setOpen(false)}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]',
                    isActive ? 'bg-sidebar-accent text-sidebar-primary font-medium' : 'text-sidebar-foreground/70')}>
                  <item.icon className={cn('w-4 h-4', item.gold && 'text-gold')} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-60">
        <main className="min-h-screen px-4 sm:px-6 py-5 pb-24 lg:pb-8 max-w-[1500px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-t border-sidebar-border flex">
        {MOBILE_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => cn('flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px]',
              isActive ? 'text-gold' : 'text-muted-foreground')}>
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}