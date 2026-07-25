import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

router.use('/V1', v1Routes);
export default router;
