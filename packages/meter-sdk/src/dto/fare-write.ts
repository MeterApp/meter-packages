import { fareReadSchema } from "./fare-read.ts";
import { writeResultSchema } from "./settings.ts";

export const fareWriteSchema = writeResultSchema(
  "fare",
  fareReadSchema.nullable(),
  "Preview or confirmed custom fare. Deleted fares return null; stored pricing is never inferred from an audit log.",
);
