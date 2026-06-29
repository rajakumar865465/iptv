'use client';

import { motion } from 'framer-motion';
import { Search, Play, Key, Check, Radio, Heart, Settings, Wifi, Battery, Signal } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-1">
      <span className="text-[9px] text-white/60 font-medium">9:41</span>
      <div className="flex items-center gap-1">
        <Signal className="w-3 h-3 text-white/60" />
        <Wifi className="w-3 h-3 text-white/60" />
        <Battery className="w-3 h-3 text-white/60" />
      </div>
    </div>
  );
}

function BrowseScreen() {
  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <StatusBar />
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Search className="w-3 h-3 text-white/40" />
          <span className="text-[10px] text-white/30">Search channels...</span>
        </div>
      </div>
      <div className="flex gap-2 px-3 py-2 overflow-hidden">
        {['All', 'News', 'Movies', 'Sports'].map((cat, i) => (
          <div
            key={cat}
            className={`text-[9px] px-2.5 py-1 rounded-full font-medium shrink-0 ${
              i === 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40'
            }`}
          >
            {cat}
          </div>
        ))}
      </div>
      <div className="flex-1 px-3 pb-3 space-y-1.5 overflow-hidden">
        {[
          { name: 'Aaj Tak', cat: 'News', live: true },
          { name: 'Star Plus', cat: 'Entertainment', live: true },
          { name: 'Colors HD', cat: 'Entertainment', live: false },
          { name: 'Sony', cat: 'Movies', live: false },
          { name: 'Star Sports', cat: 'Sports', live: true },
        ].map((ch) => (
          <div
            key={ch.name}
            className="flex items-center gap-2.5 bg-white/[0.03] rounded-lg px-2.5 py-2"
          >
            <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
              <Radio className="w-3.5 h-3.5 text-white/30" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-white/80">{ch.name}</div>
              <div className="text-[8px] text-white/30">{ch.cat}</div>
            </div>
            {ch.live && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] text-red-400 font-medium">LIVE</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerScreen() {
  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Video area mock */}
        <div className="w-full aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="relative z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
          {/* Fake channel watermark */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
              <Radio className="w-3 h-3 text-red-400" />
            </div>
            <span className="text-[8px] text-white/50 font-medium">Star Plus</span>
          </div>
          {/* Quality badge */}
          <div className="absolute top-2 right-2 text-[8px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
            HD
          </div>
        </div>
        {/* Controls */}
        <div className="w-full mt-3 space-y-2">
          {/* Progress bar */}
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-red-500 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/30">14:32</span>
            <span className="text-[9px] text-white/30">21:05</span>
          </div>
          {/* Control buttons */}
          <div className="flex items-center justify-center gap-6">
            <Settings className="w-4 h-4 text-white/40" />
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Play className="w-4 h-4 text-red-400 ml-0.5" />
            </div>
            <Heart className="w-4 h-4 text-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LicenseScreen() {
  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/20 flex items-center justify-center mb-5">
          <Key className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-sm font-bold text-white mb-1">Activate License</p>
        <p className="text-[10px] text-white/40 text-center mb-6 leading-relaxed">
          Enter your license key to unlock all premium channels
        </p>
        {/* Key input mock */}
        <div className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 mb-3">
          <div className="flex items-center justify-center gap-2">
            {['IPTV', '••••', '••••', '••••'].map((part, i) => (
              <span
                key={i}
                className="text-[11px] font-mono text-white/30 tracking-wider"
              >
                {part}
              </span>
            ))}
          </div>
        </div>
        {/* Activate button */}
        <div className="w-full bg-red-600 rounded-xl py-2.5 text-center mb-4">
          <span className="text-xs font-semibold text-white">Activate Now</span>
        </div>
        {/* Success state */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 w-full">
          <div className="flex items-center gap-2 justify-center">
            <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-green-400" />
            </div>
            <span className="text-[10px] text-green-400 font-semibold">License Active!</span>
          </div>
          <p className="text-[9px] text-green-400/60 text-center mt-1">Expires: Dec 31, 2025</p>
        </div>
      </div>
    </div>
  );
}

interface PhoneFrameProps {
  screen: 'home' | 'player' | 'license';
  title: string;
  subtitle: string;
}

function PhoneFrame({ screen, title, subtitle }: PhoneFrameProps) {
  const screens = {
    home: <BrowseScreen />,
    player: <PlayerScreen />,
    license: <LicenseScreen />,
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="flex flex-col items-center group cursor-default"
    >
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-2 bg-red-600/0 rounded-[40px] blur-xl transition-all duration-500 group-hover:bg-red-600/10" />
        {/* Phone frame */}
        <div className="relative w-[180px] sm:w-[200px] rounded-[32px] sm:rounded-[36px] bg-gradient-to-b from-[#2a2a2c] via-[#1e1e20] to-[#141416] border border-white/10 group-hover:border-red-500/30 transition-colors duration-500 shadow-2xl shadow-black/50 p-[6px] sm:p-[7px] pb-2.5 sm:pb-3">
          {/* Notch */}
          <div className="flex justify-center pt-1 mb-1">
            <div className="w-[45px] sm:w-[50px] h-[11px] sm:h-[13px] bg-black rounded-full" />
          </div>
          {/* Screen */}
          <div className="bg-[#080808] rounded-[22px] sm:rounded-[24px] overflow-hidden h-[300px] sm:h-[360px]">
            {screens[screen]}
          </div>
          {/* Home bar */}
          <div className="flex justify-center mt-2 sm:mt-2.5">
            <div className="w-10 sm:w-12 h-[3px] bg-white/15 rounded-full" />
          </div>
        </div>
      </div>
      {/* Label */}
      <div className="mt-5 text-center">
        <p className="text-sm sm:text-base font-semibold text-white group-hover:text-red-400 transition-colors duration-300">
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-1 group-hover:text-slate-400 transition-colors duration-300">
          {subtitle}
        </p>
      </div>
    </motion.div>
  );
}

export default function AppShowcase() {
  const features = [
    { screen: 'home' as const, title: 'Browse channels easily', subtitle: 'Search, filter and explore 500+' },
    { screen: 'player' as const, title: 'Watch with a smooth player', subtitle: 'HD quality with multiple options' },
    { screen: 'license' as const, title: 'Activate instantly with your license key', subtitle: 'Paste key and start watching' },
  ];

  return (
    <section className="py-10 sm:py-16 md:py-24 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 sm:mb-4">
            Your TV, Your Way
          </h2>
          <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
            Browse channels, watch live sports, and manage your license all in one app
          </p>
        </motion.div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-8 md:gap-12"
        >
          {features.map((f) => (
            <PhoneFrame key={f.screen} screen={f.screen} title={f.title} subtitle={f.subtitle} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
