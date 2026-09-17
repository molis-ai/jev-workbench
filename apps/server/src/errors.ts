export class AppError extends Error {
  requestId?: string;
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: unknown,
  ) {
    super(message);
  }
}
export function fail(
  status: number,
  code: string,
  message: string,
  fields?: unknown,
): never {
  throw new AppError(status, code, message, fields);
}
