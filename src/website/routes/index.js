import { Router } from "express";
import homeRoutes from "./home.js";
import authRoutes from "./auth.js";
import eventsRoutes from "./events.js";
import certsRoutes from "./certs.js";
import personnelRoutes from "./personnel.js";
import loaRoutes from "./loa.js";
import applicationRoutes from "./application.js";
import userRoutes from "./user.js";
import modpacksRouter from "./modpack.js";
import profileRoutes from "./profile.js";
import myCertRoutes from "./my-certs.js";
import equipmentRoutes from "./equipment.js";
import expiredRoutes from "./expired.js";
import botStatusRoutes from "./botstatus.js";
import formsRoutes from "./forms.js"
import appealRouter from "./appeals.js";

const router = Router();

router.use("/", homeRoutes);
router.use("/", authRoutes);
router.use("/events", eventsRoutes);
router.use("/certs", certsRoutes);
router.use("/personnel", personnelRoutes);
router.use("/loa", loaRoutes);
router.use("/apply", applicationRoutes);
router.use("/user-info", userRoutes);
router.use("/modpacks", modpacksRouter);
router.use("/profile", profileRoutes);
router.use("/my-certs", myCertRoutes);
router.use("/equipment", equipmentRoutes);
router.use("/expired", expiredRoutes);
router.use("/botstatus", botStatusRoutes);
router.use("/forms", formsRoutes)
router.use("/appeal", appealRouter);

export default router;
