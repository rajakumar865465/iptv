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

  function fetchCategoryChannels(category: string) {
    setCatLoading(true);
    const apiCategory = category === 'All' ? 'all' : category;
    getChannelPreview(apiCategory)
      .then(ch => setChannels(ch))
      .catch(() => setError('Failed to load channels'))
      .finally(() => setCatLoading(false));
  }
  useEffect(() => { trackPageVisit('browse'); }, []);

  // Initial load: categories + preview
  useEffect(() => {
    void Promise.resolve().then(() => {
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
    });
  }, []);


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
          <h1 className="text-4xl font-extrabold text-[var(--color-ink)] mb-3">500+ Indian Live TV Channels</h1>
          <p className="text-[var(--color-ink-muted)]">Browse Hindi, Tamil, Telugu, Bengali, Malayalam &amp; more. Stream URLs are never exposed publicly.</p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-subtle)]" />
          <input
            type="text"
            placeholder="Search channels..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl pl-10 pr-4 py-3 text-[var(--color-ink)] placeholder-[var(--color-ink-subtle)] focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 text-sm shadow-sm"
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
                  ? 'bg-brand-500 text-[var(--color-ink)] shadow-lg shadow-brand-500/20 border border-brand-500'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] border border-[var(--color-line)]'
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
              <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-ink-muted)]">
            <Tv className="w-10 h-10 mx-auto mb-3 opacity-40 text-[var(--color-ink-subtle)]" />
            <p className="text-lg font-semibold mb-2 text-[var(--color-ink)]">No channels found.</p>
            <p className="text-sm">Try a different search or category.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <p className="text-[var(--color-ink-subtle)] text-sm">{filtered.length} channels</p>
              {activeCategory !== 'All' && (
                <span className="text-xs text-[var(--color-ink-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full border border-[var(--color-line)]">
                  {activeCategory}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map(ch => (
                <div key={ch.id} className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-card rounded-xl p-3 flex flex-col items-center gap-2 hover:border-brand-500/30 hover:bg-brand-500/5 hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
                  <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                    <ChannelLogoImage
                      src={ch.logo_url || ''}
                      alt={ch.name}
                      className="w-full h-full object-contain p-1"
                      fallbackClassName="text-xs"
                      containerClassName="w-full h-full"
                    />
                  </div>
                  <span className="text-[var(--color-ink)] text-xs font-medium text-center leading-tight">{ch.name}</span>
                  {ch.is_premium && (
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase">Premium</span>
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
