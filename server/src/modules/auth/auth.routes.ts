import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema } from './auth.validation.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
