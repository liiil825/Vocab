/**
 * MCP 客户端助手 - 封装与 MCP 服务器的通信
 */
import { spawn } from "child_process";

export class McpClient {
  constructor({ program = "bun", args = ["run", "packages/vocab-mcp/src/index.ts"], env = {} } = {}) {
    this.program = program;
    this.args = args;
    this.env = env;
    this.server = null;
    this.requestId = 0;
  }

  /**
   * 启动 MCP 服务器
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = spawn(this.program, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.env }
      });

      this.server.stderr.on("data", (data) => {
        const msg = data.toString().trim();
        if (msg && !msg.includes("Vocab-Trainer")) {
          console.error("[Server stderr]", msg);
        }
      });

      this.server.on("error", reject);

      // 等待服务器启动
      setTimeout(resolve, 1000);
    });
  }

  /**
   * 停止 MCP 服务器
   */
  stop() {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }

  /**
   * 调用 MCP 工具
   */
  callTool(name, args = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      const onData = (data) => {
        try {
          const lines = data.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            const msg = JSON.parse(line);
            if (msg.id === id) {
              this.server.stdout.removeListener("data", onData);
              resolve(msg.result);
            }
          }
        } catch (e) {
          // 忽略解析错误，继续等待
        }
      };

      this.server.stdout.on("data", onData);

      const request = {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args }
      };

      this.server.stdin.write(JSON.stringify(request) + "\n");

      // 超时保护
      setTimeout(() => {
        this.server?.stdout?.removeListener("data", onData);
        reject(new Error(`Tool call ${name} timed out`));
      }, 5000);
    });
  }
}
