import { AppError } from '../utils/AppError.js';

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function assertCanRead(actor, ownerId) {
  if (actor.role === 'admin' || actor.role === 'analyst') return;
  if (actor.id === ownerId.toString()) return;
  throw new AppError('You do not have permission to view this resource', 403, 'FORBIDDEN');
}

export function assertCanMutate(actor, ownerId) {
  if (actor.role === 'admin') return;
  if (actor.id === ownerId.toString()) return;
  throw new AppError('You do not have permission to modify this resource', 403, 'FORBIDDEN');
}
