"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

type PMResult = Record<string, unknown>;

export default function Et0Page() {
  const [method, setMethod] = useState<"pm" | "pan">("pm");

  const [pm, setPm] = useState({
    date: new Date().toISOString().slice(0, 10),
    latitudeDeg: "-16.27",
    elevationM: "60",
    anemometerHeightM: "2",
    maxTemperatureC: "32",
    minTemperatureC: "22",
    rhMaxPct: "90",
    rhMinPct: "55",
    windRunKmDay: "150",
    sunHours: "",
    radiationMJm2: "",
  });
  const [pan, setPan] = useState({
    date: new Date().toISOString().slice(0, 10),
    epanMm: "6",
    siting: "case-a-green-crop",
    fetchM: "100",
    windSpeedMs: "2",
    rhPct: "60",
  });

  const [result, setResult] = useState<PMResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPM(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<PMResult>("/api/et0/penman-monteith", {
        date: pm.date,
        latitudeDeg: parseFloat(pm.latitudeDeg),
        elevationM: parseFloat(pm.elevationM),
        anemometerHeightM: parseFloat(pm.anemometerHeightM || "2"),
        maxTemperatureC: parseFloat(pm.maxTemperatureC),
        minTemperatureC: parseFloat(pm.minTemperatureC),
        rhMaxPct: pm.rhMaxPct ? parseFloat(pm.rhMaxPct) : undefined,
        rhMinPct: pm.rhMinPct ? parseFloat(pm.rhMinPct) : undefined,
        windRunKmDay: pm.windRunKmDay ? parseFloat(pm.windRunKmDay) : undefined,
        sunHours: pm.sunHours ? parseFloat(pm.sunHours) : undefined,
        radiationMJm2: pm.radiationMJm2 ? parseFloat(pm.radiationMJm2) : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitPan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<PMResult>("/api/et0/class-a-pan", {
        date: pan.date,
        epanMm: parseFloat(pan.epanMm),
        siting: pan.siting,
        fetchM: parseFloat(pan.fetchM),
        windSpeedMs: parseFloat(pan.windSpeedMs),
        rhPct: parseFloat(pan.rhPct),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Reference evapotranspiration (ET0) calculator</h1>
      <div className="mb-4 flex gap-2">
        <button className={method === "pm" ? "btn-primary" : "btn-secondary"} onClick={() => setMethod("pm")}>
          FAO Penman-Monteith
        </button>
        <button className={method === "pan" ? "btn-primary" : "btn-secondary"} onClick={() => setMethod("pan")}>
          Class A pan
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {method === "pm" ? (
          <form onSubmit={submitPM} className="card space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={pm.date} onChange={(e) => setPm({ ...pm, date: e.target.value })} />
              </div>
              <div>
                <label className="label">Latitude (deg)</label>
                <input className="input" type="number" step="any" value={pm.latitudeDeg} onChange={(e) => setPm({ ...pm, latitudeDeg: e.target.value })} />
              </div>
              <div>
                <label className="label">Elevation (m)</label>
                <input className="input" type="number" step="any" value={pm.elevationM} onChange={(e) => setPm({ ...pm, elevationM: e.target.value })} />
              </div>
              <div>
                <label className="label">Anemometer height (m)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pm.anemometerHeightM}
                  onChange={(e) => setPm({ ...pm, anemometerHeightM: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tmax (degC)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pm.maxTemperatureC}
                  onChange={(e) => setPm({ ...pm, maxTemperatureC: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tmin (degC)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pm.minTemperatureC}
                  onChange={(e) => setPm({ ...pm, minTemperatureC: e.target.value })}
                />
              </div>
              <div>
                <label className="label">RH max (%)</label>
                <input className="input" type="number" step="any" value={pm.rhMaxPct} onChange={(e) => setPm({ ...pm, rhMaxPct: e.target.value })} />
              </div>
              <div>
                <label className="label">RH min (%)</label>
                <input className="input" type="number" step="any" value={pm.rhMinPct} onChange={(e) => setPm({ ...pm, rhMinPct: e.target.value })} />
              </div>
              <div>
                <label className="label">Wind run (km/day)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pm.windRunKmDay}
                  onChange={(e) => setPm({ ...pm, windRunKmDay: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Sunshine hours (optional)</label>
                <input className="input" type="number" step="any" value={pm.sunHours} onChange={(e) => setPm({ ...pm, sunHours: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Solar radiation, MJ/m2/day (optional — preferred over sunshine hours if known)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pm.radiationMJm2}
                  onChange={(e) => setPm({ ...pm, radiationMJm2: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Calculating..." : "Calculate ET0"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitPan} className="card space-y-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={pan.date} onChange={(e) => setPan({ ...pan, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Pan evaporation, Epan (mm)</label>
              <input className="input" type="number" step="any" value={pan.epanMm} onChange={(e) => setPan({ ...pan, epanMm: e.target.value })} />
            </div>
            <div>
              <label className="label">Pan siting</label>
              <select className="input" value={pan.siting} onChange={(e) => setPan({ ...pan, siting: e.target.value })}>
                <option value="case-a-green-crop">Case A — green cropped area</option>
                <option value="case-b-dry-fallow">Case B — dry fallow area</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Fetch (m)</label>
                <input className="input" type="number" step="any" value={pan.fetchM} onChange={(e) => setPan({ ...pan, fetchM: e.target.value })} />
              </div>
              <div>
                <label className="label">Wind speed (m/s)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={pan.windSpeedMs}
                  onChange={(e) => setPan({ ...pan, windSpeedMs: e.target.value })}
                />
              </div>
              <div>
                <label className="label">RH (%)</label>
                <input className="input" type="number" step="any" value={pan.rhPct} onChange={(e) => setPan({ ...pan, rhPct: e.target.value })} />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Calculating..." : "Calculate ET0"}
            </button>
          </form>
        )}

        <div className="card">
          <h2 className="mb-2 font-semibold">Equation breakdown</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!result && !error && <p className="text-sm text-stone-500">Submit the form to see intermediate results.</p>}
          {result && (
            <div className="space-y-1 text-sm">
              {Object.entries(result).map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-stone-100 py-1">
                  <span className="text-stone-500">{key}</span>
                  <span className="font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
