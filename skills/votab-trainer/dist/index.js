import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTools } from "./tools.js";
async function main() {
    const server = new McpServer({
        name: "vocab-trainer",
        version: "1.0.0"
    });
    // 注册所有工具
    const tools = createTools();
    for (const tool of tools) {
        server.registerTool(tool.name, {
            description: tool.description,
            inputSchema: z.object(tool.inputSchema)
        }, async (args) => {
            return await tool.execute(args);
        });
    }
    // 使用 STDIO 传输
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Vocab-Trainer MCP Server started");
}
main().catch(console.error);
