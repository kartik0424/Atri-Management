export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
