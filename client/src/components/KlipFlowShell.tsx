import { HelpCircle, Home, Library, Link2, LogOut, Menu, Moon, PlusCircle, Settings, Sun, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import NotificationBell from "./NotificationBell";
import { useTheme } from "../contexts/ThemeContext";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/clips", label: "My Clips", icon: Library },
  { href: "/earnings", label: "Earnings", icon: Wallet },
];

function ThemeButton({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const Icon = theme === "dark" ? Sun : Moon;
  return <button onClick={toggleTheme} className={`rounded-full p-2 text-black/45 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white ${className}`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><Icon size={18} /></button>;
}

export default function KlipFlowShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const active = (href: string) => href === "/" ? location === "/" : location.startsWith(href);

  return <div className="min-h-screen bg-[#F7F7F5] text-[#151515] dark:bg-[#111111] dark:text-[#F5F5F5]">
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#171717]/95 md:static">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2"><img src="/klipflow-orange-kf.webp" alt="KlipFlow" className="h-9 w-9 rounded-xl" /><span className="text-lg font-black tracking-tight">KlipFlow</span></Link>
        <div className="flex items-center gap-1"><ThemeButton /><NotificationBell /><button aria-label="Open menu" className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10 md:hidden" onClick={() => setMenuOpen(true)}><Menu size={22} /></button></div>
        <div className="hidden items-center gap-3 md:flex"><span className="max-w-[180px] truncate text-sm text-black/50 dark:text-white/60">{user?.name ?? "Clipper"}</span><ThemeButton /><button onClick={logout} className="rounded-full p-2 text-black/45 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Log out"><LogOut size={17} /></button></div>
      </div>
    </header>
    {menuOpen && <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMenuOpen(false)}><div className="ml-auto h-full w-72 bg-white p-5 dark:bg-[#171717]" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><span className="font-bold">Menu</span><button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={22} /></button></div><div className="mt-8 space-y-2">
      <Link href="/new-project" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><PlusCircle size={18} /> Add a video to clip</Link>
      <Link href="/how-to-use" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><HelpCircle size={18} /> How to use KlipFlow</Link>
      <Link href="/accounts" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><Link2 size={18} /> Connected Accounts</Link>
      <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><Settings size={18} /> My Settings</Link>
      <button onClick={() => { toggleTheme?.(); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><span className="-ml-2 rounded-full p-2 text-black/45 dark:text-white/60">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</span> {theme === "dark" ? "Light theme" : "Dark theme"}</button>
      <button onClick={logout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"><LogOut size={18} /> Log out</button>
    </div></div></div>}
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:pb-10 md:pt-8">{children}</main>
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-[#171717]/95 md:static md:mx-auto md:max-w-3xl md:border-0 md:bg-transparent"><div className="mx-auto grid max-w-3xl grid-cols-3 px-3 py-2 md:rounded-3xl md:bg-white md:shadow-sm md:dark:bg-[#171717]">{tabs.map((tab) => { const Icon = tab.icon; return <Link key={tab.href} href={tab.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold ${active(tab.href) ? "text-[#FF4D00]" : "text-black/40 dark:text-white/50"}`}><Icon size={22} strokeWidth={active(tab.href) ? 2.5 : 2} /><span>{tab.label}</span></Link>; })}</div></nav>
  </div>;
}
