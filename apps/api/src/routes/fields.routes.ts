import { Router } from "express";
import { createField, getField, listFields, updateField } from "../controllers/fields.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const fieldsRouter = Router();
fieldsRouter.use(requireAuth);

fieldsRouter.get("/", asyncHandler(listFields));
fieldsRouter.post("/", asyncHandler(createField));
fieldsRouter.get("/:id", asyncHandler(getField));
fieldsRouter.patch("/:id", asyncHandler(updateField));
