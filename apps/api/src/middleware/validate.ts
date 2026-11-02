import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";

export interface ValidatedRequest<
  T extends ZodTypeAny,
> extends Request {
  validated?: T["_output"];
}

export function validate<T extends ZodTypeAny>(
  schema: T,
) {
  return (req: ValidatedRequest<T>, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req);
    if (!result.success) {
      res.status(400).json({
        error: "validation_failed",
        message: "Invalid request",
        issues: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.validated = result.data as T["_output"];
    next();
  };
}
