import { Router } from "express";
import { authRouter } from "./auth.routes";
import { farmsRouter } from "./farms.routes";
import { fieldsRouter } from "./fields.routes";
import { stationsRouter } from "./stations.routes";
import { weatherRouter } from "./weather.routes";
import { cropsRouter } from "./crops.routes";
import { plantingsRouter } from "./plantings.routes";
import { et0Router } from "./et0.routes";
import { irrigationRouter } from "./irrigation.routes";
import { yieldRouter } from "./yield.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/farms", farmsRouter);
apiRouter.use("/fields", fieldsRouter);
apiRouter.use("/stations", stationsRouter);
apiRouter.use("/weather", weatherRouter);
apiRouter.use("/crops", cropsRouter);
apiRouter.use("/plantings", plantingsRouter);
apiRouter.use("/et0", et0Router);
apiRouter.use("/irrigation", irrigationRouter);
apiRouter.use("/yield", yieldRouter);
