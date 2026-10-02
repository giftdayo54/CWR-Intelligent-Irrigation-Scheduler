"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiClientError } from "@/lib/api";

interface Dashboard {
  crop: string;
  plantingDate: string;
  daysAfterPlanting: number;
  currentStage: string;
  currentKc: number;
  rootDepthM: number;
  allowableDepletionP: number;
  soilMoisture: { percentDepletion: number; soilMoistureStatus: string; tamMm: number; ramMm: number; depletionMm: number } | null;
  netIrrigationRequirementMm: number | null;
  grossIrrigationRequirementMm: number | null;
  nextIrrigationDate: string | null;
}

interface SeasonPoint {
  date: string;
  dap: number;
  stage: string;
  kc: number;
  rootDepthM: number;
}

interface BalancePoint {
  date: string;
  etc: number;
  depletionMm: number;
  ramMm: number;
  tamMm: number;
}

interface ScheduleEvent {
  date: string;
  netDepthMm: number;
  grossDepthMm: number;
  durationHours: number;
  volumeM3: number;
}

export default function PlantingDetailPage() {
  const params = useParams<{ id: string }>();
  const plantingId = params.id;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [season, setSeason] = useState<SeasonPoint[]>([]);
  const [balance, setBalance] = useState<BalancePoint[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[] | null>(null);
  const [yieldResult, setYieldResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    setError(null);
    try {
      const [d, s] = await Promise.all([
        api.get<Dashboard>(`/api/plantings/${plantingId}/dashboard`),
        api.get<{ series: SeasonPoint[] }>(`/api/plantings/${plantingId}/season-series`),
      ]);
      setDashboard(d);
      setSeason(s.series);
      try {
        const b = await api.get<{ series: BalancePoint[] }>(`/api/plantings/${plantingId}/balance`);
        setBalance(b.series);
      } catch {
        // no weather linked yet — balance chart stays empty
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load planting");
    }
  }

  useEffect(() => {
    if (plantingId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantingId]);

  async function onUploadWeather(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !dashboard) return;
    setBusy("Importing weather file...");
    try {
      // The station id isn't on the dashboard payload; fetch the planting to get it.
      const planting = await api.get<{ field: { stationId: string | null } }>(`/api/plantings/${plantingId}`);
      if (!planting.field.stationId) throw new Error("This field has no weather station linked yet.");
      await api.uploadFile(`/api/weather/${planting.field.stationId}/import`, file);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function onGenerateSchedule() {
    setBusy("Generating schedule...");
    setError(null);
    try {
      const res = await api.post<{ events: ScheduleEvent[] }>(`/api/irrigation/${plantingId}/schedule`, {});
      setSchedule(res.events);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to generate schedule");
    } finally {
      setBusy(null);
    }
  }

  async function onCalculateYield() {
    setBusy("Calculating yield response...");
    setError(null);
    try {
      const res = await api.get(`/api/yield/${plantingId}`);
      setYieldResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to calculate yield response");
    } finally {
      setBusy(null);
    }
  }

  if (error && !dashboard) return <p className="text-red-600">{error}</p>;
  if (!dashboard) return <p className="text-stone-500">Loading...</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {busy && <p className="text-sm text-stone-500">{busy}</p>}

      {/* Module 13: Farm Dashboard widget */}
      <div className="card">
        <h1 className="mb-3 text-xl font-semibold">{dashboard.crop}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Planting date" value={dashboard.plantingDate.slice(0, 10)} />
          <Stat label="DAP" value={`${dashboard.daysAfterPlanting} days`} />
          <Stat label="Current stage" value={dashboard.currentStage} />
          <Stat label="Kc" value={dashboard.currentKc.toFixed(2)} />
          <Stat label="Root depth" value={`${dashboard.rootDepthM.toFixed(2)} m`} />
          <Stat
            label="Soil moisture"
            value={dashboard.soilMoisture ? `${dashboard.soilMoisture.percentDepletion.toFixed(0)}% depleted` : "no weather data"}
          />
          <Stat label="Net irrigation req." value={dashboard.netIrrigationRequirementMm != null ? `${dashboard.netIrrigationRequirementMm.toFixed(1)} mm` : "-"} />
          <Stat label="Next irrigation" value={dashboard.nextIrrigationDate ?? "-"} />
        </div>
        <div className="mt-3">
          <label className="label">Import weather (MET_DATA.xlsx-style workbook)</label>
          <input type="file" accept=".xlsx" onChange={onUploadWeather} className="text-sm" />
        </div>
      </div>

      {/* Module 4/5/12: Kc curve, root depth curve, growth timeline */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Kc curve &amp; root depth (auto-derived from planting date)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={season}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dap" label={{ value: "Days after planting", position: "insideBottom", offset: -5 }} />
            <YAxis yAxisId="kc" domain={[0, "dataMax + 0.2"]} />
            <YAxis yAxisId="root" orientation="right" domain={[0, "dataMax + 0.5"]} />
            <Tooltip />
            <Legend />
            <Line yAxisId="kc" type="monotone" dataKey="kc" name="Kc" stroke="#2f7a4f" dot={false} />
            <Line yAxisId="root" type="monotone" dataKey="rootDepthM" name="Root depth (m)" stroke="#8a5a3b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Module 7: Soil water balance */}
      {balance.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Soil water balance</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={balance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="depletionMm" name="Depletion (mm)" stroke="#b45309" dot={false} />
              <Line type="monotone" dataKey="ramMm" name="RAM (mm)" stroke="#3b7a9e" strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="tamMm" name="TAM (mm)" stroke="#78716c" strokeDasharray="2 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Module 11: Irrigation scheduler */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Irrigation schedule</h2>
          <button className="btn-primary" onClick={onGenerateSchedule}>
            Generate schedule
          </button>
        </div>
        {schedule && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-stone-500">
                <th className="py-1">Date</th>
                <th>Net (mm)</th>
                <th>Gross (mm)</th>
                <th>Duration (hr)</th>
                <th>Volume (m3)</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((ev) => (
                <tr key={ev.date} className="border-b border-stone-100">
                  <td className="py-1">{ev.date}</td>
                  <td>{ev.netDepthMm.toFixed(1)}</td>
                  <td>{ev.grossDepthMm.toFixed(1)}</td>
                  <td>{ev.durationHours.toFixed(1)}</td>
                  <td>{ev.volumeM3.toFixed(1)}</td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-stone-500">
                    No irrigation events triggered in the available weather range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Module 14: Yield response */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Yield response to water (FAO Ky method)</h2>
          <button className="btn-primary" onClick={onCalculateYield}>
            Calculate
          </button>
        </div>
        {yieldResult && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ky" value={String(yieldResult.ky)} />
            <Stat label="ETc (potential)" value={`${yieldResult.etcMm} mm`} />
            <Stat label="ETc adj (actual)" value={`${yieldResult.etcAdjMm} mm`} />
            <Stat label="Est. yield" value={`${yieldResult.actualYieldPctOfMax}% of max`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
