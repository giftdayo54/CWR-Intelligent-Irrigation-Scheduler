"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";

interface Crop {
  id: string;
  name: string;
  category: string;
}

const SOIL_TEXTURES = ["SAND", "LOAMY_SAND", "SANDY_LOAM", "LOAM", "CLAY_LOAM", "CLAY"];
const IRRIGATION_SYSTEMS = ["SURFACE", "SPRINKLER", "DRIP"];

export default function SetupPage() {
  const router = useRouter();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [farmId, setFarmId] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);

  const [farm, setFarm] = useState({ name: "", location: "" });
  const [station, setStation] = useState({ name: "", latitudeDeg: "", longitudeDeg: "", elevationM: "", anemometerHeightM: "2" });
  const [field, setField] = useState({ name: "", areaHa: "", soilTexture: "LOAM" });
  const [planting, setPlanting] = useState({
    cropId: "",
    plantingDate: "",
    irrigationSystem: "SPRINKLER",
    applicationRateMmPerHour: "",
  });

  useEffect(() => {
    api.get<Crop[]>("/api/crops").then(setCrops).catch(() => {});
  }, []);

  async function createFarm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/farms", farm);
      setFarmId(res.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create farm");
    }
  }

  async function createStation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/stations", {
        farmId,
        name: station.name,
        latitudeDeg: parseFloat(station.latitudeDeg),
        longitudeDeg: parseFloat(station.longitudeDeg),
        elevationM: parseFloat(station.elevationM),
        anemometerHeightM: parseFloat(station.anemometerHeightM || "2"),
      });
      setStationId(res.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create weather station");
    }
  }

  async function createField(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/fields", {
        farmId,
        stationId,
        name: field.name,
        areaHa: parseFloat(field.areaHa),
        soilTexture: field.soilTexture,
      });
      setFieldId(res.id);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create field");
    }
  }

  async function createPlanting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/plantings", {
        fieldId,
        cropId: planting.cropId,
        plantingDate: planting.plantingDate,
        irrigationSystem: planting.irrigationSystem,
        applicationRateMmPerHour: planting.applicationRateMmPerHour ? parseFloat(planting.applicationRateMmPerHour) : undefined,
      });
      router.push(`/plantings/${res.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create planting");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Set up a farm</h1>
      <ol className="mb-4 flex gap-2 text-sm text-stone-500">
        {["Farm", "Weather station", "Field", "Planting"].map((label, i) => (
          <li key={label} className={i + 1 === step ? "font-semibold text-cwr-green" : ""}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {step === 1 && (
        <form onSubmit={createFarm} className="card space-y-3">
          <div>
            <label className="label">Farm name</label>
            <input className="input" value={farm.name} onChange={(e) => setFarm({ ...farm, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={farm.location} onChange={(e) => setFarm({ ...farm, location: e.target.value })} />
          </div>
          <button className="btn-primary w-full">Next: Weather station</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={createStation} className="card space-y-3">
          <p className="text-sm text-stone-500">
            Import your MET_DATA.xlsx-style weather export to this station later from the planting page.
          </p>
          <div>
            <label className="label">Station name</label>
            <input className="input" value={station.name} onChange={(e) => setStation({ ...station, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude (deg, negative = South)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={station.latitudeDeg}
                onChange={(e) => setStation({ ...station, latitudeDeg: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Longitude (deg)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={station.longitudeDeg}
                onChange={(e) => setStation({ ...station, longitudeDeg: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Elevation (m)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={station.elevationM}
                onChange={(e) => setStation({ ...station, elevationM: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Anemometer height (m)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={station.anemometerHeightM}
                onChange={(e) => setStation({ ...station, anemometerHeightM: e.target.value })}
              />
            </div>
          </div>
          <button className="btn-primary w-full">Next: Field</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={createField} className="card space-y-3">
          <div>
            <label className="label">Field name</label>
            <input className="input" value={field.name} onChange={(e) => setField({ ...field, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Area (ha)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={field.areaHa}
                onChange={(e) => setField({ ...field, areaHa: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Soil texture</label>
              <select className="input" value={field.soilTexture} onChange={(e) => setField({ ...field, soilTexture: e.target.value })}>
                {SOIL_TEXTURES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn-primary w-full">Next: Planting</button>
        </form>
      )}

      {step === 4 && (
        <form onSubmit={createPlanting} className="card space-y-3">
          <div>
            <label className="label">Crop</label>
            <select
              className="input"
              value={planting.cropId}
              onChange={(e) => setPlanting({ ...planting, cropId: e.target.value })}
              required
            >
              <option value="">Select a crop...</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Planting date</label>
            <input
              className="input"
              type="date"
              value={planting.plantingDate}
              onChange={(e) => setPlanting({ ...planting, plantingDate: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Irrigation system</label>
              <select
                className="input"
                value={planting.irrigationSystem}
                onChange={(e) => setPlanting({ ...planting, irrigationSystem: e.target.value })}
              >
                {IRRIGATION_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Application rate (mm/hr)</label>
              <input
                className="input"
                type="number"
                step="any"
                value={planting.applicationRateMmPerHour}
                onChange={(e) => setPlanting({ ...planting, applicationRateMmPerHour: e.target.value })}
                placeholder="optional, needed for scheduling"
              />
            </div>
          </div>
          <button className="btn-primary w-full">Create planting</button>
        </form>
      )}
    </div>
  );
}
