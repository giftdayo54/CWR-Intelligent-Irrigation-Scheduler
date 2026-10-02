import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { dbCropToDefinition, dbFieldToSoilProfile, dbStationToConfig } from "../utils/mappers";
import { CropDefinition, SoilProfile, StationConfig } from "@cwr/fao-engine";

export interface PlantingContext {
  planting: {
    id: string;
    plantingDate: string;
    expectedHarvestDate: string | null;
    irrigationSystem: "SURFACE" | "SPRINKLER" | "DRIP";
    systemEfficiencyOverride: number | null;
    applicationRateMmPerHour: number | null;
    areaHa: number;
  };
  crop: CropDefinition;
  soil: SoilProfile;
  station: StationConfig | null;
  stationId: string | null;
}

export async function loadPlantingContext(plantingId: string, userId: string): Promise<PlantingContext> {
  const planting = await prisma.planting.findFirst({
    where: { id: plantingId, field: { farm: { userId } } },
    include: { crop: true, field: { include: { station: true } } },
  });
  if (!planting) throw ApiError.notFound("Planting not found");

  return {
    planting: {
      id: planting.id,
      plantingDate: planting.plantingDate.toISOString().slice(0, 10),
      expectedHarvestDate: planting.expectedHarvestDate?.toISOString().slice(0, 10) ?? null,
      irrigationSystem: planting.irrigationSystem,
      systemEfficiencyOverride: planting.systemEfficiencyOverride,
      applicationRateMmPerHour: planting.applicationRateMmPerHour,
      areaHa: planting.field.areaHa,
    },
    crop: dbCropToDefinition(planting.crop),
    soil: dbFieldToSoilProfile(planting.field),
    station: planting.field.station ? dbStationToConfig(planting.field.station) : null,
    stationId: planting.field.stationId,
  };
}
