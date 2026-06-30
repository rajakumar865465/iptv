'use client';
import { useState, useEffect } from 'react';
import { Tv, Search, Play, Key, Check, Heart, Clock, Shield, Smartphone } from 'lucide-react';

const SLIDE_INTERVAL = 3500;
const FADE_MS = 500;

function StatusBar() {
  return (
    <div className="flex justify-between items-center px-3 py-[4px] text-[8px] text-white/40 bg-black shrink-0">
      <span className="font-medium">9:41</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[7px]">5G</span>
        <div className="w-4 h-[7px] border border-white/30 rounded-sm flex items-center justify-end pr-[1px]">
          <div className="w-[70%] h-full bg-green-400 rounded-[1px]" />
        </div>
      </div>
    </div>
  );
}

function AppBar({ title }: { title?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-[#111111] border-b border-white/[0.05] shrink-0">
      {title ? (
        <span className="text-[10px] font-bold text-white">{title}</span>
      ) : (
        <span className="text-[10px] font-bold text-white">
          Niva<span className="text-blue-400">TV</span>
        </span>
      )}
      <Search className="w-[12px] h-[12px] text-white/30" />
    </div>
  );
}

// Screen 1: App Home
function HomeScreen() {
  const channels = [
    { n: 'Aaj Tak', l: 'Hindi News', c: 'bg-indigo-500/10 text-indigo-400' },
    { n: 'ABP News', l: 'Hindi News', c: 'bg-indigo-500/10 text-indigo-400' },
    { n: 'Star Gold', l: 'Movies', c: 'bg-amber-500/10 text-amber-400' },
    { n: 'Zee TV', l: 'Entertainment', c: 'bg-blue-500/10 text-blue-400' },
    { n: 'Sun TV', l: 'Tamil', c: 'bg-cyan-500/10 text-cyan-400' },
    { n: 'Asianet', l: 'Malayalam', c: 'bg-emerald-500/10 text-emerald-400' },
  ];
  return (
    <div className="h-full bg-[#080808] flex flex-col text-white">
      <StatusBar />
      <AppBar />
      <div className="px-3 pt-3 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[7px] text-indigo-400 font-bold uppercase tracking-[0.12em]">Live Now</span>
        </div>
        <div className="bg-gradient-to-r from-red-600/20 to-transparent rounded-2xl p-3 border border-indigo-500/15 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
              <Tv className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold">Aaj Tak</div>
              <div className="text-[7px] text-slate-400">Hindi News &bull; Live</div>
            </div>
            <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
              <Play className="w-3.5 h-3.5 fill-white text-white" />
            </div>
          </div>
        </div>
        <div className="text-[7px] text-slate-500 mb-2 font-semibold uppercase tracking-wider">Popular Channels</div>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((ch, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2 hover:bg-white/[0.07] transition-colors">
              <div className={`w-full h-9 rounded-lg mb-1.5 flex items-center justify-center ${ch.c}`}>
                <Tv className="w-3.5 h-3.5" />
              </div>
              <div className="text-[7px] font-semibold text-white truncate">{ch.n}</div>
              <div className="text-[6px] text-slate-500">{ch.l}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-3 overflow-hidden">
          {['News', 'Movies', 'Sports', 'Music'].map((cat) => (
            <div key={cat} className="shrink-0 text-[6px] px-2.5 py-1 rounded-full bg-white/[0.06] text-slate-400 font-medium">{cat}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Screen 2: Channel List
function ChannelListScreen() {
  const channels = [
    { name: 'Aaj Tak', cat: 'Hindi News' },
    { name: 'ABP News', cat: 'Hindi News' },
    { name: 'Star Gold', cat: 'Movies' },
    { name: 'Zee TV', cat: 'Entertainment' },
    { name: 'Sun TV', cat: 'Tamil' },
    { name: 'Asianet', cat: 'Malayalam' },
    { name: 'DD News', cat: 'News' },
    { name: '9XM', cat: 'Music' },
  ];
  return (
    <div className="h-full bg-[#080808] flex flex-col text-white">
      <StatusBar />
      <div className="px-3 py-2.5 bg-[#111111] border-b border-white/[0.05] shrink-0">
        <div className="bg-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="w-[11px] h-[11px] text-white/25" />
          <span className="text-[8px] text-white/25">Search channels...</span>
        </div>
      </div>
      <div className="flex gap-1.5 px-3 py-2 shrink-0 overflow-hidden">
        {['All', 'Hindi', 'Tamil', 'News', 'Movies'].map((cat, i) => (
          <div key={cat} className={`shrink-0 text-[7px] px-2.5 py-0.5 rounded-full font-semibold ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-white/[0.06] text-slate-500'}`}>
            {cat}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden px-3 pb-2">
        <div className="space-y-1.5">
          {channels.map((ch, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.04] rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <Tv className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-semibold">{ch.name}</div>
                <div className="text-[7px] text-slate-500">{ch.cat}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[6px] text-indigo-400 font-bold">LIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Screen 3: Player
function PlayerScreen() {
  return (
    <div className="h-full bg-black flex flex-col text-white">
      <StatusBar />
      <div className="mx-2 mt-2 mb-3 rounded-2xl overflow-hidden relative shrink-0" style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30">
            <Play className="w-6 h-6 fill-white text-white ml-1" />
          </div>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-[7px] text-indigo-400 font-bold bg-black/50 px-1.5 py-0.5 rounded">LIVE</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="text-[9px] text-white/90 mb-1.5 font-semibold">Star Sports 1</div>
          <div className="h-[3px] bg-white/15 rounded-full overflow-hidden">
            <div className="h-full w-[40%] bg-indigo-500 rounded-full" />
          </div>
        </div>
      </div>
      <div className="px-3 flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[13px] font-bold">Star Sports 1</div>
            <div className="text-[8px] text-slate-400">India vs Australia &bull; Cricket</div>
          </div>
          <Heart className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex gap-1.5 mb-3">
          {['Auto', 'HD', '480p', 'Data Saver'].map((q, i) => (
            <div key={q} className={`text-[7px] px-2 py-1 rounded-full font-semibold ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-white/[0.06] text-slate-500'}`}>
              {q}
            </div>
          ))}
        </div>
        <div className="text-[7px] text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Related Channels</div>
        <div className="flex gap-2">
          {['Star Sports 2', 'Sony Six', 'DD Sports'].map((ch, i) => (
            <div key={i} className="bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2 flex-1">
              <div className="text-[7px] font-semibold text-white truncate">{ch}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Screen 4: License Activation
function LicenseScreen() {
  return (
    <div className="h-full bg-[#080808] flex flex-col text-white">
      <StatusBar />
      <AppBar title="Activate License" />
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
          <Key className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="text-[11px] font-bold mb-1.5">Enter License Key</div>
        <div className="text-[8px] text-slate-500 text-center mb-5 leading-relaxed">
          Paste the key you received<br />after payment
        </div>
        <div className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3.5 py-3 mb-3">
          <div className="text-[8px] text-blue-400 font-mono tracking-[0.2em]">NVT-XXXX-XXXX-XXXX</div>
        </div>
        <button className="w-full bg-indigo-600 rounded-xl py-3 text-center mb-4 text-sm font-bold transition-colors">
          Activate Now
        </button>
        <div className="w-full bg-green-500/10 border border-green-500/20 rounded-xl px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div>
              <div className="text-[8px] font-semibold text-green-400">License Active!</div>
              <div className="text-[7px] text-slate-400">3 months remaining</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCREENS = [
  { id: 'home', component: HomeScreen, label: 'Browse channels easily' },
  { id: 'channels', component: ChannelListScreen, label: 'Filter & search channels' },
  { id: 'player', component: PlayerScreen, label: 'Watch with a smooth player' },
  { id: 'license', component: LicenseScreen, label: 'Activate instantly with your license key' },
] as const;

export default function AnimatedHeroPhone() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setDisplay(d => (d + 1) % SCREENS.length);
        setCurrent(c => (c + 1) % SCREENS.length);
        setFading(false);
      }, FADE_MS);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const handleDot = (i: number) => {
    if (i === current) return;
    setFading(true);
    setTimeout(() => { setDisplay(i); setCurrent(i); setFading(false); }, FADE_MS);
  };

  const ScreenComponent = SCREENS[display].component;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-600/15 blur-[60px] rounded-full scale-75 translate-y-8 pointer-events-none" />
        <div className="relative w-[260px]">
          <div className="rounded-[44px] bg-gradient-to-b from-[#333333] via-[#222222] to-[#151515] border border-white/15 shadow-2xl shadow-black/60 p-[8px] pb-4">
            <div className="flex justify-center pt-1.5 mb-1.5">
              <div className="w-[63px] h-[15px] bg-black rounded-full" />
            </div>
            <div
              className="rounded-[32px] overflow-hidden"
              style={{ height: '472px', opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-in-out` }}
            >
              <ScreenComponent />
            </div>
            <div className="flex justify-center mt-3">
              <div className="w-14 h-[4px] bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-6">
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => handleDot(i)}
            aria-label={s.label}
            className={`rounded-full transition-all duration-300 cursor-pointer ${i === current ? 'w-7 h-[6px] bg-indigo-500' : 'w-[6px] h-[6px] bg-white/20 hover:bg-white/40'}`}
          />
        ))}
      </div>
      <p className="mt-2.5 text-xs text-slate-500 font-medium transition-opacity" style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}>
        {SCREENS[current].label}
      </p>
    </div>
  );
}
