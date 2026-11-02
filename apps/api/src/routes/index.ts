import { Router } from "express";
import authRoutes from "./auth.js";
import projectRoutes from "./projects.js";
import resourceRoutes from "./resources.js";
import templateRoutes from "./templates.js";
import generationRoutes from "./generations.js";
import documentRoutes from "./documents.js";
import billingRoutes from "./billing.js";
import adminRoutes from "./admin.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/", projectRoutes);
router.use("/", resourceRoutes);
router.use("/", templateRoutes);
router.use("/", generationRoutes);
router.use("/", documentRoutes);
router.use("/", billingRoutes);
router.use("/", adminRoutes);

export default router;
