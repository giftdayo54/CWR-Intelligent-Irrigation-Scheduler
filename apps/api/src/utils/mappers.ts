import { CropDefinition, DailyMetRecord, SoilProfile, SoilTexture, StationConfig } from "@cwr/fao-engine";
import type { Crop, DailyWeather, Field, WeatherStation } from "@prisma/client";

export function dbWeatherToMetRecord(row: DailyWeather): DailyMetRecord {
  return {
    date: row.date.toISOString().slice(0, 10),
    maxTemperatureC: row.maxTemperatureC,
    minTemperatureC: row.minTemperatureC,
    rhMaxPct: row.rhMaxPct ?? undefined,
    rhMinPct: row.rhMinPct ?? undefined,
    dryBulb08C: row.dryBulb08C ?? undefined,
    dryBulb14C: row.dryBulb14C ?? undefined,
    wetBulb08C: row.wetBulb08C ?? undefined,
    wetBulb14C: row.wetBulb14C ?? undefined,
    maxResetC: row.maxResetC ?? undefined,
    minResetC: row.minResetC ?? undefined,
    grassMinC: row.grassMinC ?? undefined,
    temp08C: row.temp08C ?? undefined,
    rh08Pct: row.rh08Pct ?? undefined,
    temp14C: row.temp14C ?? undefined,
    rh14Pct: row.rh14Pct ?? undefined,
    etStationMm: row.etStationMm ?? undefined,
    rainMm: row.rainMm,
    radiationMJm2: row.radiationMJm2 ?? undefined,
    sunHours: row.sunHours ?? undefined,
    noDips: row.noDips ?? undefined,
    classAPanMm: row.classAPanMm ?? undefined,
    windRunKmDay: row.windRunKmDay ?? undefined,
    anemometerReading: row.anemometerReading ?? undefined,
    soilTemp5cm08C: row.soilTemp5cm08C ?? undefined,
    soilTemp10cm08C: row.soilTemp10cm08C ?? undefined,
    soilTemp20cm08C: row.soilTemp20cm08C ?? undefined,
    soilTemp100cm08C: row.soilTemp100cm08C ?? undefined,
    soilTemp5cm14C: row.soilTemp5cm14C ?? undefined,
    soilTemp10cm14C: row.soilTemp10cm14C ?? undefined,
    soilTemp20cm14C: row.soilTemp20cm14C ?? undefined,
    soilTemp100cm14C: row.soilTemp100cm14C ?? undefined,
    flags: row.flags,
  };
}

export function dbStationToConfig(station: WeatherStation): StationConfig {
  return {
    name: station.name,
    latitudeDeg: station.latitudeDeg,
    longitudeDeg: station.longitudeDeg,
    elevationM: station.elevationM,
    anemometerHeightM: station.anemometerHeightM,
  };
}

const TEXTURE_DB_TO_ENGINE: Record<string, SoilTexture> = {
  SAND: "sand",
  LOAMY_SAND: "loamy-sand",
  SANDY_LOAM: "sandy-loam",
  LOAM: "loam",
  CLAY_LOAM: "clay-loam",
  CLAY: "clay",
};

export function dbFieldToSoilProfile(field: Field): SoilProfile {
  return {
    texture: TEXTURE_DB_TO_ENGINE[field.soilTexture] ?? "loam",
    fieldCapacity: 0,
    permanentWiltingPoint: 0,
    totalAvailableMoistureMmPerM: field.totalAvailableMoistureMmPerM ?? undefined,
  };
}

export function dbCropToDefinition(crop: Crop): CropDefinition {
  return {
    id: crop.id,
    name: crop.name,
    scientificName: crop.scientificName ?? undefined,
    category: crop.category,
    kcIni: crop.kcIni,
    kcMid: crop.kcMid,
    kcEnd: crop.kcEnd,
    stageLengthsDays: {
      initial: crop.stageInitialDays,
      development: crop.stageDevelopmentDays,
      mid: crop.stageMidDays,
      late: crop.stageLateDays,
    },
    rootDepthMinM: crop.rootDepthMinM,
    rootDepthMaxM: crop.rootDepthMaxM,
    allowableDepletionP: crop.allowableDepletionP,
    maxCropHeightM: crop.maxCropHeightM ?? undefined,
    ky:
      crop.kyTotal != null
        ? {
            vegetative: crop.kyVegetative ?? undefined,
            flowering: crop.kyFlowering ?? undefined,
            yieldFormation: crop.kyYieldFormation ?? undefined,
            ripening: crop.kyRipening ?? undefined,
            total: crop.kyTotal,
          }
        : undefined,
    isCustom: crop.isCustom,
  };
}
