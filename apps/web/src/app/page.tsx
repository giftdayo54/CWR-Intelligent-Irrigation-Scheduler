"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Planting {
  id: string;
  plantingDate: string;
  status: string;
  crop: { name: string };
}
interface Field {
  id: string;
  name: string;
  areaHa: number;
  soilTexture: string;
  plantings: Planting[];
}
interface Farm {
  id: string;
  name: string;
  location: string | null;
  fields: Field[];
}

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    setAuthed(!!token);
    if (token) {
      api
        .get<Farm[]>("/api/farms")
        .then(setFarms)
        .catch((e) => setError(e.message));
    }
  }, []);

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <h1 className="mb-2 text-2xl font-semibold text-cwr-green">CWR &amp; Intelligent Irrigation Scheduler</h1>
        <p className="mb-4 text-stone-600">
          Reference evapotranspiration, crop water requirement, irrigation scheduling and yield-response
          calculations, built to the FAO Irrigation Manual Module 4 methodology.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/login" className="btn-primary">
            Log in
          </Link>
          <Link href="/register" className="btn-secondary">
            Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your farms</h1>
        <Link href="/setup" className="btn-primary">
          + Add farm / field / planting
        </Link>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {farms.length === 0 && !error && (
        <p className="text-stone-600">
          No farms yet.{" "}
          <Link href="/setup" className="text-cwr-green underline">
            Set one up
          </Link>{" "}
          to get started.
        </p>
      )}
      <div className="space-y-4">
        {farms.map((farm) => (
          <div key={farm.id} className="card">
            <h2 className="font-semibold">
              {farm.name} {farm.location && <span className="font-normal text-stone-500">— {farm.location}</span>}
            </h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {farm.fields.map((field) => (
                <div key={field.id} className="rounded-md border border-stone-100 bg-stone-50 p-3">
                  <p className="font-medium">
                    {field.name} <span className="text-stone-500">({field.areaHa} ha, {field.soilTexture.replace(/_/g, " ").toLowerCase()})</span>
                  </p>
                  {field.plantings.length === 0 ? (
                    <p className="mt-1 text-sm text-stone-500">No active planting</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {field.plantings.map((p) => (
                        <li key={p.id}>
                          <Link href={`/plantings/${p.id}`} className="text-sm text-cwr-green underline">
                            {p.crop.name} — planted {p.plantingDate.slice(0, 10)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {farm.fields.length === 0 && <p className="text-sm text-stone-500">No fields yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
