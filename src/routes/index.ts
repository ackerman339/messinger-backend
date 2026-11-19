import { Router } from 'express';
import v1Routes from './v1';
import groupCallRoutes from './v1/group-calls';

const router = Router();

router.use('/V1', groupCallRoutes, v1Routes);
export default router;
