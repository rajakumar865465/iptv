'use client';
import { useState, useEffect } from 'react';
import { Search, Tv } from 'lucide-react';
import { getChannelPreview, getCategories } from '@/lib/publicApi';
import type { Channel, Category } from '@/lib/publicApi';
import ChannelLogoImage from '@/components/ChannelLogoImage';
import { trackPageVisit } from '@/lib/behaviorTracker';

function getCategoryParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('category');
}

export default function BrowsePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [catLoading, setCatLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { trackPageVisit('browse'); }, []);

  // Initial load: categories + preview
  useEffect(() => {
    setLoading(true);
    Promise.all([getChannelPreview(), getCategories()])
      .then(([ch, cat]) => {
        setChannels(ch);
        setCategories(cat);
        // Check URL param after categories load
        const catParam = getCategoryParam();
        if (catParam) {
          const found = cat.find(
            c =>
              c.name === catParam ||
              c.slug === catParam ||
              normalizeSlug(c.name) === normalizeSlug(catParam)
          );
          if (found) {
            setActiveCategory(found.name);
            // Also fetch channels for this specific category
            fetchCategoryChannels(found.name);
          }
        }
      })
      .catch(() => setError('Failed to load channels'))
      .finally(() => setLoading(false));
  }, []);

  const fetchCategoryChannels = (category: string) => {
    setCatLoading(true);
    const apiCategory = category === 'All' ? 'all' : category;
    getChannelPreview(apiCategory)
      .then(ch => setChannels(ch))
      .catch(() => setError('Failed to load channels'))
      .finally(() => setCatLoading(false));
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    fetchCategoryChannels(cat);
    // Update URL without navigating
    const url = new URL(window.location.href);
    if (cat === 'All') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', cat);
    }
    window.history.replaceState({}, '', url.toString());
  };

  const visibleCategories = categories.filter(c => c.channel_count > 0);

  // Client-side search + category filtering (fallback when backend doesn't filter)
  const filtered = channels.filter(ch => {
    const matchesQuery = ch.name.toLowerCase().includes(query.toLowerCase());
    const matchesCat = activeCategory === 'All' || ch.category === activeCategory;
    return matchesQuery && matchesCat;
  });

  const isLoading = loading || catLoading;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-3">Channel Preview</h1>
          <p className="text-slate-400">Browse our available channel library. Stream URLs are never exposed publicly.</p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 text-sm"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap justify-center mb-8">
          {['All', ...visibleCategories.map(c => c.name)].map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              disabled={isLoading}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 ${
                activeCategory === cat
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat}
              {cat !== 'All' && visibleCategories.find(c => c.name === cat) && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({visibleCategories.find(c => c.name === cat)?.channel_count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Channel grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Tv className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold mb-2">No channels found.</p>
            <p className="text-sm">Try a different search or category.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <p className="text-slate-500 text-sm">{filtered.length} channels</p>
              {activeCategory !== 'All' && (
                <span className="text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                  {activeCategory}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map(ch => (
                <div key={ch.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-red-500/30 hover:bg-white/[0.07] transition-all">
                  <div className="w-12 h-12 rounded-lg bg-white/10">
                    <ChannelLogoImage
                      src={ch.logo_url || ''}
                      alt={ch.name}
                      className="w-full h-full object-contain p-1"
                      fallbackClassName="text-xs"
                      containerClassName="w-full h-full"
                    />
                  </div>
                  <span className="text-white text-xs font-medium text-center leading-tight">{ch.name}</span>
                  {ch.is_premium && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Premium</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function normalizeSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
