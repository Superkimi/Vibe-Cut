export class EditPlanError extends Error {
  constructor(
    message: string,
    public readonly operationIndex?: number,
  ) {
    super(message);
    this.name = "EditPlanError";
  }
}
