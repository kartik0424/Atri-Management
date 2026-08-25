import { Router } from 'express';
import * as clientController from './clients.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  clientQuerySchema,
  clientSearchQuerySchema,
  clientIdParamSchema,
  contactInputSchema,
  contactIdParamSchema,
} from './clients.validation.js';

export const clientsRouter = Router();

// All client routes require authenticated user
clientsRouter.use(requireAuth);

clientsRouter.get('/', validateQuery(clientQuerySchema), clientController.listClients);
clientsRouter.get('/search', validateQuery(clientSearchQuerySchema), clientController.searchClients);
clientsRouter.post('/', validateBody(createClientSchema), clientController.createClient);
clientsRouter.get('/:id', validateParams(clientIdParamSchema), clientController.getClientById);
clientsRouter.put(
  '/:id',
  validateParams(clientIdParamSchema),
  validateBody(updateClientSchema),
  clientController.updateClient
);
clientsRouter.delete('/:id', validateParams(clientIdParamSchema), clientController.deleteClient);
clientsRouter.get(
  '/:id/profile',
  validateParams(clientIdParamSchema),
  clientController.getClientProfile
);

// Client contacts
clientsRouter.post(
  '/:id/contacts',
  validateParams(clientIdParamSchema),
  validateBody(contactInputSchema),
  clientController.addContact
);
clientsRouter.put(
  '/:id/contacts/:contactId',
  validateParams(contactIdParamSchema),
  validateBody(contactInputSchema.partial()),
  clientController.updateContact
);
clientsRouter.delete(
  '/:id/contacts/:contactId',
  validateParams(contactIdParamSchema),
  clientController.deleteContact
);
