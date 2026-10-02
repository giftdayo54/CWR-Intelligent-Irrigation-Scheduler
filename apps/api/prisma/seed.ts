/**
 * Seeds the Crop table from @cwr/fao-engine's CROP_DATABASE (FAO
 * Module 4 Tables 20, 21, 54, 57), plus one demo scenario (sample
 * database records: a user, farm, weather station, field and
 * planting) so a fresh database has something to look at immediately.
 * Run with: npm run prisma:seed (workspace apps/api).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CROP_DATABASE } from "@cwr/fao-engine";

const prisma = new PrismaClient();

async function seedCrops() {
  for (const crop of CROP_DATABASE) {
    await prisma.crop.upsert({
      where: { id: crop.id },
      create: {
        id: crop.id,
        name: crop.name,
        scientificName: crop.scientificName,
        category: crop.category,
        kcIni: crop.kcIni,
        kcMid: crop.kcMid,
        kcEnd: crop.kcEnd,
        stageInitialDays: crop.stageLengthsDays.initial,
        stageDevelopmentDays: crop.stageLengthsDays.development,
        stageMidDays: crop.stageLengthsDays.mid,
        stageLateDays: crop.stageLengthsDays.late,
        rootDepthMinM: crop.rootDepthMinM,
        rootDepthMaxM: crop.rootDepthMaxM,
        allowableDepletionP: crop.allowableDepletionP,
        maxCropHeightM: crop.maxCropHeightM,
        kyVegetative: crop.ky?.vegetative,
        kyFlowering: crop.ky?.flowering,
        kyYieldFormation: crop.ky?.yieldFormation,
        kyRipening: crop.ky?.ripening,
        kyTotal: crop.ky?.total,
        isCustom: false,
      },
      update: {
        name: crop.name,
        kcIni: crop.kcIni,
        kcMid: crop.kcMid,
        kcEnd: crop.kcEnd,
      },
    });
  }
  console.log(`Seeded ${CROP_DATABASE.length} crops.`);
}

/** Sample database records: one demo user/farm/station/field/planting,
 * modelled on the Nchalo Factory sugarcane estate context this project
 * was built for. Safe to run repeatedly (upserts on unique keys). */
async function seedDemoScenario() {
  const passwordHash = await bcrypt.hash("Demo1234!", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@cwr.local" },
    create: {
      email: "demo@cwr.local",
      passwordHash,
      name: "Demo Irrigation Engineer",
      role: "IRRIGATION_ENGINEER",
    },
    update: {},
  });

  const farm = await prisma.farm.findFirst({ where: { userId: user.id, name: "Nchalo Estate (demo)" } });
  const farmRecord =
    farm ??
    (await prisma.farm.create({
      data: { userId: user.id, name: "Nchalo Estate (demo)", location: "Chikwawa, Malawi" },
    }));

  let station = await prisma.weatherStation.findFirst({ where: { farmId: farmRecord.id, name: "Nchalo Factory" } });
  if (!station) {
    station = await prisma.weatherStation.create({
      data: {
        farmId: farmRecord.id,
        name: "Nchalo Factory",
        latitudeDeg: -16.27,
        longitudeDeg: 34.9,
        elevationM: 60,
        anemometerHeightM: 2,
      },
    });
  }

  let field = await prisma.field.findFirst({ where: { farmId: farmRecord.id, name: "Block 12 (demo)" } });
  if (!field) {
    field = await prisma.field.create({
      data: {
        farmId: farmRecord.id,
        stationId: station.id,
        name: "Block 12 (demo)",
        areaHa: 45,
        soilTexture: "CLAY_LOAM",
      },
    });
  }

  const sugarcane = await prisma.crop.findUnique({ where: { id: "sugarcane" } });
  if (sugarcane) {
    const existingPlanting = await prisma.planting.findFirst({ where: { fieldId: field.id, cropId: sugarcane.id } });
    if (!existingPlanting) {
      await prisma.planting.create({
        data: {
          fieldId: field.id,
          cropId: sugarcane.id,
          plantingDate: new Date("2025-09-01T00:00:00.000Z"),
          irrigationSystem: "SPRINKLER",
          applicationRateMmPerHour: 8,
        },
      });
    }
  }

  console.log("Seeded demo scenario: demo@cwr.local / Demo1234!");
  console.log("Import test/fixtures-style MET_DATA.xlsx to the 'Nchalo Factory' station via POST /api/weather/:stationId/import to populate weather.");
}

async function main() {
  await seedCrops();
  await seedDemoScenario();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

