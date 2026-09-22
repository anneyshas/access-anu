import { Router } from "express";
import { getNodes } from "../controllers/nodeController.js";
import { getEdges } from "../controllers/edgeController.js";
import { getGraph } from "../controllers/graphController.js";

const router = Router();

router.get("/nodes", getNodes);
router.get("/edges", getEdges);
router.get("/graph/:building", getGraph);

export default router;