import { Router } from "express";
import { getNodes } from "../controllers/nodeController.js";
import { getEdges } from "../controllers/edgeController.js";
import { getGraph } from "../controllers/graphController.js";
import { getBuildings } from "../controllers/buildingController.js";

const router = Router();

router.get("/buildings", getBuildings);
router.get("/nodes", getNodes);
router.get("/edges", getEdges);
router.get("/graph/:building", getGraph);

export default router;