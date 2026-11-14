import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Save } from 'lucide-react';
import type { AgencySettings, TargetCountry } from '../types/domain';
import { evaluateNegotiationBounds } from '../lib/pricing';

interface NegotiatorViewProps {
  settings: AgencySettings;
  onSaveSettings: (updated: AgencySettings) => void;
}

export const NegotiatorView: React.FC<NegotiatorViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [draft, setDraft] = useState<AgencySettings>(settings);
  const [testCountry, setTestCountry] = useState<TargetCountry>('United States');
  const [testOffer, setTestOffer] = useState<number>(1200);
  const [savedNotice, setSavedNotice] = useState(false);

  const simulation = evaluateNegotiationBounds({
    country: testCountry,
    proposedPrice: testOffer,
    maxDiscountPercent: draft.maxDiscountPercent,
    pricingList: draft.regionalPricing,
  });

  const handlePricingChange = (
    country: TargetCountry,
    field: 'indicativeMin' | 'indicativeMax' | 'minAcceptablePrice',
    value: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      regionalPricing: prev.regionalPricing.map((item) => {
        if (item.country !== country) return item;
        const next = { ...item, [field]: Math.max(0, value) };
        next.formattedRange = `${next.symbol}${next.indicativeMin.toLocaleString('en-US')}–${next.symbol}${next.indicativeMax.toLocaleString('en-US')}`;
        return next;
      }),
    }));
  };

  const handleSave = () => {
    onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            AI Negotiation Engine
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure indicative regional starting ranges, minimum floors, discount guardrails, and payment milestones.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save Negotiation Rules</span>
        </button>
      </div>

      {savedNotice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-200">
          Negotiation bounds and pricing matrix saved.
        </div>
      )}

      {/* Regional Indicative Pricing Matrix */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-white">
            Regional Indicative Pricing Ranges
          </h2>
          <span className="text-xs text-zinc-400">
            Indicative starting ranges only, not fixed quotations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] text-zinc-400">
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Indicative Min</th>
                <th className="py-2.5 px-3">Indicative Max</th>
                <th className="py-2.5 px-3">Min Acceptable Floor</th>
                <th className="py-2.5 px-3">Display Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {draft.regionalPricing.map((row) => (
                <tr key={row.country}>
                  <td className="py-3 px-3 font-medium text-white">{row.country}</td>
                  <td className="py-3 px-3 font-mono text-zinc-300">{row.currency}</td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      aria-label={`${row.country} indicative minimum`}
                      value={row.indicativeMin}
                      onChange={(e) =>
                        handlePricingChange(row.country, 'indicativeMin', Number(e.target.value))
                      }
                      className="w-28 rounded bg-black/60 border border-white/10 px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      aria-label={`${row.country} indicative maximum`}
                      value={row.indicativeMax}
                      onChange={(e) =>
                        handlePricingChange(row.country, 'indicativeMax', Number(e.target.value))
                      }
                      className="w-28 rounded bg-black/60 border border-white/10 px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      aria-label={`${row.country} minimum acceptable price`}
                      value={row.minAcceptablePrice}
                      onChange={(e) =>
                        handlePricingChange(row.country, 'minAcceptablePrice', Number(e.target.value))
                      }
                      className="w-28 rounded bg-black/60 border border-white/10 px-2.5 py-1.5 font-mono text-red-300 focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-200 whitespace-nowrap">
                    {row.formattedRange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discount Guardrails & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Authority & Milestone Controls
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="neg-max-discount" className="block text-xs text-zinc-400 mb-1">
                Maximum AI-Authorized Discount (%)
              </label>
              <input
                id="neg-max-discount"
                type="number"
                min={0}
                max={50}
                value={draft.maxDiscountPercent}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    maxDiscountPercent: Math.min(50, Math.max(0, Number(e.target.value))),
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="neg-milestones" className="block text-xs text-zinc-400 mb-1">
                Payment Milestones
              </label>
              <input
                id="neg-milestones"
                type="text"
                value={draft.paymentMilestones}
                onChange={(e) => setDraft((p) => ({ ...p, paymentMilestones: e.target.value }))}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="neg-timeline" className="block text-xs text-zinc-400 mb-1">
                Default Delivery Timeline
              </label>
              <input
                id="neg-timeline"
                type="text"
                value={draft.defaultDeliveryTimeline}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, defaultDeliveryTimeline: e.target.value }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400 pt-1">
            Policy: The AI cannot accept binding contracts, discounts outside authorization, or payment commitments without {draft.ownerName}&apos;s explicit approval.
          </p>
        </div>

        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Guardrail Authorization Tester
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sim-country" className="block text-xs text-zinc-400 mb-1">
                Client Country
              </label>
              <select
                id="sim-country"
                value={testCountry}
                onChange={(e) => setTestCountry(e.target.value as TargetCountry)}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                {draft.regionalPricing.map((r) => (
                  <option key={r.country} value={r.country}>
                    {r.country} ({r.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sim-offer" className="block text-xs text-zinc-400 mb-1">
                Client Proposed Price
              </label>
              <input
                id="sim-offer"
                type="number"
                value={testOffer}
                onChange={(e) => setTestOffer(Number(e.target.value))}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div
            className={`rounded-xl p-4 border ${
              simulation.withinAuthority
                ? 'border-emerald-500/30 bg-emerald-950/15'
                : 'border-red-500/40 bg-red-950/20'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              {simulation.withinAuthority ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span>
                {simulation.withinAuthority
                  ? 'Within AI Estimate Authority'
                  : 'Blocked — Requires Owner Approval'}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{simulation.reason}</p>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {draft.packages.map((pkg) => (
          <div key={pkg.id} className="glass-panel rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-white">{pkg.name}</h3>
              <span className="font-mono text-[11px] text-zinc-400">{pkg.deliveryTimeline}</span>
            </div>
            <p className="text-xs text-zinc-400">{pkg.description}</p>
            <ul className="space-y-1 text-xs text-zinc-300 pt-1">
              {pkg.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
