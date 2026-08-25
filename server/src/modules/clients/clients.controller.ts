import { Request, Response, NextFunction } from 'express';
import * as clientService from './clients.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await clientService.listClients(req.query as any);
    return sendSuccess(res, result.clients, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function searchClients(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || '';
    const results = await clientService.searchClients(q);
    return sendSuccess(res, results);
  } catch (error) {
    next(error);
  }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await clientService.createClient(req.body);

    if (!result.created) {
      // Potential duplicate warning
      return sendSuccess(res, null, {
        statusCode: 200,
        warning: result.warning,
        duplicates: result.duplicates,
        message: 'Potential duplicate client found. Provide allow_duplicate: true to proceed.',
      });
    }

    return sendSuccess(res, result.client, {
      statusCode: 201,
      message: 'Client created successfully',
      warning: result.warning,
      duplicates: result.duplicates,
    });
  } catch (error) {
    next(error);
  }
}

export async function getClientById(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.getClientById(Number(req.params.id));
    return sendSuccess(res, client);
  } catch (error) {
    next(error);
  }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await clientService.updateClient(Number(req.params.id), req.body);
    return sendSuccess(res, client, { message: 'Client updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await clientService.deleteClient(Number(req.params.id));
    return sendSuccess(res, result, { message: 'Client deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getClientProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await clientService.getClientProfile(Number(req.params.id));
    return sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}

export async function addContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await clientService.addContact(Number(req.params.id), req.body);
    return sendSuccess(res, contact, { statusCode: 201, message: 'Contact added successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await clientService.updateContact(
      Number(req.params.id),
      Number(req.params.contactId),
      req.body
    );
    return sendSuccess(res, contact, { message: 'Contact updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await clientService.deleteContact(
      Number(req.params.id),
      Number(req.params.contactId)
    );
    return sendSuccess(res, result, { message: 'Contact removed successfully' });
  } catch (error) {
    next(error);
  }
}
