import { Router } from 'express';
import { validateDTO, authenticate } from '@middlewares';

import { signUpSchema, signInSchema } from '@dtos';

import { signup, signin, logout } from '@controllers';

const router = Router();

// Authentication and authorization endpoints
router.get('/sign-in', validateDTO(signInSchema), signin);
router.post('/sign-up', validateDTO(signUpSchema), signup);
router.post('/logout', authenticate, logout);

export default router;
