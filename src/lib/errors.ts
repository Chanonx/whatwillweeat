/** Error ที่มี HTTP status → route handler แปลงเป็น response ให้อัตโนมัติ */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
