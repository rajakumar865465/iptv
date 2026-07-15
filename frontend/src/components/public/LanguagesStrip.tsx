import Link from 'next/link';

/**
 * Supported Indian languages shown as styled glass badges.
 * Static list — same languages already referenced across the site copy.
 * Add/remove entries here when language coverage changes.
 */
const LANGUAGES = [
  { name: 'Hindi',     initial: 'ह', note: 'हिन्दी' },
  { name: 'English',   initial: 'E', note: 'English' },
  { name: 'Tamil',     initial: 'த', note: 'தமிழ்' },
  { name: 'Telugu',    initial: 'త', note: 'తెలుగు' },
  { name: 'Bengali',   initial: 'ব', note: 'বাংলা' },
  { name: 'Malayalam', initial: 'മ', note: 'മലയാളം' },
  { name: 'Kannada',   initial: 'ಕ', note: 'ಕನ್ನಡ' },
  { name: 'Marathi',   initial: 'म', note: 'मराठी' },
  { name: 'Punjabi',   initial: 'ਪ', note: 'ਪੰਜਾਬੀ' },
  { name: 'Gujarati',  initial: 'ગ', note: 'ગુજરાતી' },
  { name: 'Odia',      initial: 'ଓ', note: 'ଓଡ଼ିଆ' },
  { name: 'Urdu',      initial: 'ا', note: 'اردو' },
];

export default function LanguagesStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {LANGUAGES.map(lang => (
        <Link
          key={lang.name}
          href={`/browse?language=${encodeURIComponent(lang.name)}`}
          className="group flex items-center gap-3 p-3 sm:p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:border-indigo-500/30 hover:bg-indigo-500/[0.05] hover:shadow-[0_0_36px_-14px] hover:shadow-indigo-500/40 transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-indigo-300 font-display">{lang.initial}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
              {lang.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{lang.note}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
