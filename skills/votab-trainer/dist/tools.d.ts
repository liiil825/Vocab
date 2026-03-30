import { z } from "zod";
interface Tool {
    name: string;
    description: string;
    inputSchema: z.ZodRawShape;
    execute: (args?: any) => Promise<any>;
}
declare function createTools(): Tool[];
export { createTools, Tool };
