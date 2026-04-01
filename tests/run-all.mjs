#!/usr/bin/env bun
/**
 * 测试运行器 - 运行所有测试套件
 *
 * 用法:
 *   bun run tests/run-all.mjs          # 运行所有测试
 *   bun run tests/run-all.mjs unit      # 只运行单元测试
 *   bun run tests/run-all.mjs integration # 只运行集成测试
 */
import { spawn } from "child_process";

const TEST_SUITES = {
  unit: {
    name: "单元测试",
    tests: [
      { name: "算法", path: "tests/unit/algorithm.test.mjs" },
      { name: "存储层", path: "tests/unit/storage.test.mjs" },
      { name: "扩展信息", path: "tests/unit/enrichment.test.mjs" },
    ]
  },
  integration: {
    name: "集成测试",
    tests: [
      { name: "MCP 工具", path: "tests/integration/mcp.test.mjs" },
      { name: "批量部分复习", path: "tests/integration/batch-review.test.mjs" },
    ]
  }
};

async function runTest(testPath, testName) {
  return new Promise((resolve) => {
    const child = spawn("bun", [testPath], {
      stdio: "inherit",
      cwd: process.cwd()
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", (err) => {
      console.error(`  ❌ 测试执行失败: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const filter = args[0]; // "unit", "integration", 或 undefined(全部)

  console.log("=".repeat(60));
  console.log(" Vocab-Trainer 测试套件");
  console.log("=".repeat(60));
  console.log("");

  const suites = TEST_SUITES;
  const totalResults = {};

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [suiteKey, suite] of Object.entries(suites)) {
    // 根据 filter 跳过某些 suite
    if (filter && filter !== suiteKey) {
      continue;
    }

    console.log(`\n📦 ${suite.name}`);
    console.log("-".repeat(40));

    let suitePassed = 0;
    let suiteFailed = 0;

    for (const test of suite.tests) {
      process.stdout.write(`  ▶ ${test.name}... `);

      const success = await runTest(test.path, test.name);

      if (success) {
        console.log(`✅`);
        suitePassed++;
      } else {
        console.log(`❌`);
        suiteFailed++;
      }
    }

    totalResults[suiteKey] = { passed: suitePassed, failed: suiteFailed };
    totalPassed += suitePassed;
    totalFailed += suiteFailed;

    console.log(`  ${suite.name}: ✅ ${suitePassed} 通过, ❌ ${suiteFailed} 失败`);
  }

  // 总结
  console.log("\n" + "=".repeat(60));
  console.log(" 总计");
  console.log("=".repeat(60));

  if (filter) {
    console.log(` ${filter}: ✅ ${totalPassed} 通过, ❌ ${totalFailed} 失败`);
  } else {
    for (const [suiteKey, result] of Object.entries(totalResults)) {
      const suite = suites[suiteKey];
      console.log(` ${suite.name}: ✅ ${result.passed} 通过, ❌ ${result.failed} 失败`);
    }
    console.log(`总计: ✅ ${totalPassed} 通过, ❌ ${totalFailed} 失败`);
  }

  console.log("=".repeat(60));

  if (totalFailed > 0) {
    console.log("\n❌ 有测试失败");
    process.exit(1);
  } else {
    console.log("\n✅ 所有测试通过！");
    process.exit(0);
  }
}

main();
