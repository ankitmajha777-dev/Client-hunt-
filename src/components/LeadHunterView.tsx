import React, { useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Search, Plus, ExternalLink, Globe, Star, MapPin, Loader2 } from 'lucide-react';
import {
  BUSINESS_CATEGORIES,
  TARGET_COUNTRIES,
  type LeadRecord,
  type TargetCountry,
} from '../types/domain';
import { calculateLeadScore, generateDeterministicAuditMetrics } from '../lib/scoring';

interface LeadHunterViewProps {
  existingLeads: LeadRecord[];
  isDemoMode: boolean;
  onSaveLeads: (newLeads: LeadRecord[]) => void;
  onInspectLead: (leadId: string) => void;
  onQuotaExceeded: () => void;
}

const COUNTRY_CENTERS: Record<TargetCountry, { lat: number; lng: number }> = {
  'United States': { lat: 37.0902, lng: -95.7129 },
  'United Kingdom': { lat: 53.4808, lng: -2.2426 },
  Canada: { lat: 45.4215, lng: -75.6972 },
  Australia: { lat: -33.8688, lng: 151.2093 },
  'United Arab Emirates': { lat: 25.2048, lng: 55.2708 },
  India: { lat: 20.5937, lng: 78.9629 },
};

export const LeadHunterView: React.FC<LeadHunterViewProps> = ({
  existingLeads,
  isDemoMode,
  onSaveLeads,
  onInspectLead,
  onQuotaExceeded,
}) => {
  const [selectedCountries, setSelectedCountries] = useState<TargetCountry[]>(['United States', 'India']);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<string>('Luxury Restaurants');
  const [customCategory, setCustomCategory] = useState('');
  const [minRating, setMinRating] = useState<number>(4.0);
  const [minReviews, setMinReviews] = useState<number>(10);
  const [websiteStatus, setWebsiteStatus] = useState<'all' | 'no_website' | 'has_website'>('all');
  const [activityStatus, setActivityStatus] = useState<'all' | 'OPERATIONAL'>('OPERATIONAL');

  const [results, setResults] = useState<LeadRecord[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const hasValidMapsKey = Boolean(mapsApiKey && mapsApiKey !== 'MY_GOOGLE_MAPS_API_KEY');

  const toggleCountry = (c: TargetCountry) => {
    setSelectedCountries((prev) =>
      prev.includes(c) ? (prev.length > 1 ? prev.filter((x) => x !== c) : prev) : [...prev, c]
    );
  };

  const activeCategory = customCategory.trim() || category;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSearching(true);

    try {
      if (isDemoMode) {
        // Filter deterministic Demo Mode leads cleanly without fabricating live API calls
        const matched = existingLeads.filter((lead) => {
          if (!selectedCountries.includes(lead.country)) return false;
          if (city.trim() && !lead.city.toLowerCase().includes(city.trim().toLowerCase())) return false;
          if (activeCategory !== 'All' && customCategory.trim()) {
            const q = customCategory.trim().toLowerCase();
            if (
              !lead.category.toLowerCase().includes(q) &&
              !lead.name.toLowerCase().includes(q)
            ) {
              return false;
            }
          } else if (category && lead.category !== category) {
            return false;
          }
          if (minRating > 0 && (lead.rating ?? 0) < minRating) return false;
          if (minReviews > 0 && (lead.reviewCount ?? 0) < minReviews) return false;
          if (websiteStatus === 'no_website' && lead.website) return false;
          if (websiteStatus === 'has_website' && !lead.website) return false;
          if (activityStatus === 'OPERATIONAL' && lead.businessStatus !== 'OPERATIONAL') return false;
          return true;
        });

        setResults(matched);
        setStatusMessage(
          `Demo Mode Search: Found ${matched.length} fictional sample business${matched.length === 1 ? '' : 'es'} matching your filters.`
        );
        setIsSearching(false);
        return;
      }

      // Live Google Places API (New) Search via server-side proxy
      const allFound: LeadRecord[] = [];
      for (const country of selectedCountries) {
        const res = await fetch('/api/places/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country,
            city,
            category: activeCategory,
            minRating,
            minReviews,
            websiteStatus,
            activityStatus,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429 || data.quotaExceeded || data.error === 'RESOURCE_EXHAUSTED') {
            onQuotaExceeded();
          }
          throw new Error(data.message || 'Places search failed');
        }

        const places = Array.isArray(data.places) ? data.places : [];
        for (const p of places) {
          const auditEval = generateDeterministicAuditMetrics(p.website, p.placeId || p.name);
          const score = calculateLeadScore({
            businessStatus: p.businessStatus,
            website: p.website,
            websiteTier: auditEval.tier,
            auditMetrics: auditEval.metrics,
            rating: p.rating,
            reviewCount: p.reviewCount,
            phone: p.phone,
            email: null,
            address: p.address,
            category: p.category,
          });
          allFound.push({
            id: `place_${(p.placeId || p.name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`,
            placeId: p.placeId,
            name: p.name,
            address: p.address,
            city: p.city || city || country,
            country: p.country,
            category: p.category,
            phone: p.phone,
            email: null,
            contactPerson: null,
            website: p.website,
            googleMapsUri: p.googleMapsUri,
            rating: p.rating,
            reviewCount: p.reviewCount,
            businessStatus: p.businessStatus,
            location: p.location,
            websiteTier: auditEval.tier,
            score,
            stage: 'New Lead',
            verified: Boolean(p.phone || p.address),
            optedOut: false,
            isDemo: false,
            discoveredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setResults(allFound);
      setStatusMessage(
        `Live Google Places Search returned ${allFound.length} real business listing${allFound.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete discovery search.');
    } finally {
      setIsSearching(false);
    }
  };

  const existingIds = new Set(existingLeads.map((l) => l.placeId));
  const mapLeads = results.length > 0 ? results : existingLeads.filter((l) => selectedCountries.includes(l.country));
  const defaultCenter =
    mapLeads[0]?.location && mapLeads[0].location.lat !== 0
      ? mapLeads[0].location
      : COUNTRY_CENTERS[selectedCountries[0]] || COUNTRY_CENTERS['United States'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Google Maps Lead Hunter
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Discover local businesses across target markets and prioritize prospects missing a high-converting website.
          </p>
        </div>
        {results.length > 0 && !isDemoMode && (
          <button
            type="button"
            onClick={() => onSaveLeads(results)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Save All {results.length} to Lead Database</span>
          </button>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="glass-panel rounded-xl p-5 space-y-5">
        <div>
          <span className="block text-xs font-medium text-zinc-300 mb-2">
            Target Countries (multi-select)
          </span>
          <div className="flex flex-wrap gap-2">
            {TARGET_COUNTRIES.map((c) => {
              const selected = selectedCountries.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCountry(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'bg-red-600 text-white'
                      : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] border border-white/[0.08]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="hunter-city" className="block text-xs font-medium text-zinc-300 mb-1.5">
              City (optional)
            </label>
            <input
              id="hunter-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Austin, London, Jaipur"
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label htmlFor="hunter-category" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Business Category
            </label>
            <select
              id="hunter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            >
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hunter-custom-cat" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Custom Category Override
            </label>
            <input
              id="hunter-custom-cat"
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Architecture Studios"
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label htmlFor="hunter-website-status" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Website Status
            </label>
            <select
              id="hunter-website-status"
              value={websiteStatus}
              onChange={(e) => setWebsiteStatus(e.target.value as any)}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Businesses</option>
              <option value="no_website">No Website Only (Tier A)</option>
              <option value="has_website">Has Website (Audit B/C/D)</option>
            </select>
          </div>

          <div>
            <label htmlFor="hunter-min-rating" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Minimum Rating
            </label>
            <select
              id="hunter-min-rating"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value={0}>Any Rating</option>
              <option value={3.5}>3.5+ Stars</option>
              <option value={4.0}>4.0+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
            </select>
          </div>

          <div>
            <label htmlFor="hunter-min-reviews" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Minimum Reviews
            </label>
            <input
              id="hunter-min-reviews"
              type="number"
              min={0}
              value={minReviews}
              onChange={(e) => setMinReviews(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label htmlFor="hunter-activity" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Business Activity
            </label>
            <select
              id="hunter-activity"
              value={activityStatus}
              onChange={(e) => setActivityStatus(e.target.value as any)}
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="OPERATIONAL">Operational Only</option>
              <option value="all">Include Unconfirmed</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSearching}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>{isSearching ? 'Searching...' : 'Discover Businesses'}</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="text-xs text-zinc-300 pt-1">{statusMessage}</div>
        )}
        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Map + Results Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Territory Pin Map ({mapLeads.length} locations)
            </span>
            <span className="text-[11px] text-zinc-400">
              {isDemoMode ? 'Demo Mode Coordinates' : 'Google Maps Platform'}
            </span>
          </div>
          <div className="h-[400px] w-full relative bg-[#0c0c10]">
            {hasValidMapsKey ? (
              <APIProvider apiKey={mapsApiKey!}>
                <GoogleMap
                  defaultCenter={defaultCenter}
                  defaultZoom={4}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling="greedy"
                  disableDefaultUI
                  style={{ width: '100%', height: '100%' }}
                >
                  {mapLeads
                    .filter((l) => l.location.lat !== 0 && l.location.lng !== 0)
                    .map((lead) => (
                      <AdvancedMarker
                        key={lead.id}
                        position={lead.location}
                        onClick={() => setSelectedPinId(lead.id)}
                      >
                        <Pin
                          background={lead.websiteTier === 'A' ? '#dc2626' : '#f59e0b'}
                          borderColor="#ffffff"
                          glyphColor="#ffffff"
                        />
                      </AdvancedMarker>
                    ))}
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="h-full w-full flex flex-col justify-between p-5 bg-gradient-to-br from-zinc-950 via-[#0d0d12] to-red-950/20">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Map Viewport Preview
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isDemoMode
                      ? 'Showing coordinate pins for the active Demo Mode search. Live interactive Google Maps tiles activate when VITE_GOOGLE_MAPS_API_KEY is configured.'
                      : 'Interactive Google Maps tiles require VITE_GOOGLE_MAPS_API_KEY in browser runtime env. Server-side Places API search remains active.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {mapLeads.slice(0, 8).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedPinId(l.id)}
                      className={`text-left p-2.5 rounded-lg border transition-colors ${
                        selectedPinId === l.id
                          ? 'border-red-500 bg-red-950/30'
                          : 'border-white/[0.08] bg-black/40 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-white truncate">
                        <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                        <span className="truncate">{l.name}</span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-zinc-400 tabular-nums">
                        {l.location.lat.toFixed(3)}, {l.location.lng.toFixed(3)} · Tier {l.websiteTier}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Discovered Results List */}
        <div className="lg:col-span-6 glass-panel rounded-xl flex flex-col h-[445px]">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Discovered Prospects ({mapLeads.length})
            </span>
            <span className="text-[11px] text-zinc-400">
              Tier A/B/C prioritized
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {mapLeads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm text-zinc-300">No businesses match those filters.</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Try widening your city, rating, or website status filters.
                </p>
              </div>
            ) : (
              mapLeads.map((lead) => {
                const alreadySaved = existingIds.has(lead.placeId);
                return (
                  <div
                    key={lead.id}
                    className={`p-4 transition-colors ${
                      selectedPinId === lead.id ? 'bg-red-950/20' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {lead.name}
                          </h3>
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {lead.category} · {lead.city || lead.country} · Tier {lead.websiteTier}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 truncate">{lead.address}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm font-semibold text-red-400 tabular-nums">
                          {lead.score.total}/100
                        </div>
                        <div className="text-[11px] text-zinc-400">{lead.score.classification}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-zinc-400 font-mono tabular-nums">
                        {lead.rating !== null && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-400" />
                            {lead.rating.toFixed(1)} ({lead.reviewCount ?? 0})
                          </span>
                        )}
                        <span>{lead.phone || 'Phone unavailable'}</span>
                        <span>{lead.website ? 'Has Website' : 'No Website'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={lead.googleMapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Maps</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (!alreadySaved) onSaveLeads([lead]);
                            onInspectLead(lead.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 font-medium transition-colors whitespace-nowrap"
                        >
                          <Globe className="h-3 w-3" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
