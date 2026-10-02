import { prisma } from "../lib/prisma";
import { dbWeatherToMetRecord } from "../utils/mappers";
import { DailyMetRecord } from "@cwr/fao-engine";

export async function getStationSeries(stationId: string, start: Date, end: Date): Promise<DailyMetRecord[]> {
  const rows = await prisma.dailyWeather.findMany({
    where: { stationId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  return rows.map(dbWeatherToMetRecord);
}
