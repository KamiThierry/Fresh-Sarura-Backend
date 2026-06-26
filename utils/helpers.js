export const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const sanitizeObject = (obj, fieldsToRemove = ['password', '__v']) => {
  const sanitized = obj.toObject ? obj.toObject() : { ...obj };
  
  fieldsToRemove.forEach((field) => {
    delete sanitized[field];
  });
  
  return sanitized;
};

export default {
  asyncHandler,
  sanitizeObject,
};
