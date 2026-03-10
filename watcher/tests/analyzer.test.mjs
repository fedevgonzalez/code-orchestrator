import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "claude-orch-analyzer-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("analyzer module", () => {
  test("exports analyze function", async () => {
    const mod = await import("../src/analyzer.mjs");
    expect(typeof mod.analyze).toBe("function");
  });

  test("exports ecosystem detection functions", async () => {
    const mod = await import("../src/analyzer.mjs");
    expect(typeof mod.detectEcosystem).toBe("function");
    expect(typeof mod.detectNonNodeProject).toBe("function");
    expect(typeof mod.detectFromPackageJson).toBe("function");
  });
});

describe("ecosystem detection", () => {
  test("detects Node.js from package.json", async () => {
    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify({
      name: "test-project",
      dependencies: { "next": "^14.0.0" },
      devDependencies: { "typescript": "^5.0.0" },
    }), "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("node");
  });

  test("detects Python from pyproject.toml", async () => {
    writeFileSync(join(TEST_DIR, "pyproject.toml"), '[tool.poetry]\nname = "my-app"', "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("python");
  });

  test("detects Go from go.mod", async () => {
    writeFileSync(join(TEST_DIR, "go.mod"), "module github.com/user/app\n\ngo 1.21", "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("go");
  });

  test("detects Rust from Cargo.toml", async () => {
    writeFileSync(join(TEST_DIR, "Cargo.toml"), '[package]\nname = "my-app"\nversion = "0.1.0"', "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("rust");
  });

  test("detects Java from pom.xml", async () => {
    writeFileSync(join(TEST_DIR, "pom.xml"), "<project></project>", "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("java");
  });

  test("detects Ruby from Gemfile", async () => {
    writeFileSync(join(TEST_DIR, "Gemfile"), 'source "https://rubygems.org"\ngem "rails"', "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("ruby");
  });

  test("detects PHP from composer.json", async () => {
    writeFileSync(join(TEST_DIR, "composer.json"), JSON.stringify({
      require: { "laravel/framework": "^10.0" },
    }), "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("php");
  });

  test("detects multiple ecosystems", async () => {
    writeFileSync(join(TEST_DIR, "package.json"), '{"name":"test"}', "utf-8");
    writeFileSync(join(TEST_DIR, "pyproject.toml"), '[project]\nname = "test"', "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toContain("node");
    expect(ecosystems).toContain("python");
  });

  test("returns empty for no recognized project files", async () => {
    writeFileSync(join(TEST_DIR, "README.md"), "# Hello", "utf-8");

    const { detectEcosystem } = await import("../src/analyzer.mjs");
    const ecosystems = detectEcosystem(TEST_DIR);
    expect(ecosystems).toHaveLength(0);
  });
});

describe("non-Node project detection", () => {
  test("detects Go project with gin framework", async () => {
    writeFileSync(join(TEST_DIR, "go.mod"), "module github.com/user/myapp\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0", "utf-8");

    const { detectNonNodeProject } = await import("../src/analyzer.mjs");
    const info = detectNonNodeProject(TEST_DIR, "go");
    expect(info.ecosystem).toBe("go");
    expect(info.framework).toBe("gin");
    expect(info.buildCommand).toBe("go build ./...");
    expect(info.testCommand).toBe("go test ./...");
    expect(info.name).toBe("myapp");
  });

  test("detects Rust project with axum", async () => {
    writeFileSync(join(TEST_DIR, "Cargo.toml"), '[package]\nname = "my-api"\nversion = "0.1.0"\n\n[dependencies]\naxum = "0.7"', "utf-8");

    const { detectNonNodeProject } = await import("../src/analyzer.mjs");
    const info = detectNonNodeProject(TEST_DIR, "rust");
    expect(info.ecosystem).toBe("rust");
    expect(info.framework).toBe("axum");
    expect(info.name).toBe("my-api");
    expect(info.buildCommand).toBe("cargo build");
  });

  test("detects Python project with FastAPI", async () => {
    writeFileSync(join(TEST_DIR, "pyproject.toml"), '[tool.poetry]\nname = "my-api"\n\n[tool.poetry.dependencies]\nfastapi = "^0.100"', "utf-8");

    const { detectNonNodeProject } = await import("../src/analyzer.mjs");
    const info = detectNonNodeProject(TEST_DIR, "python");
    expect(info.ecosystem).toBe("python");
    expect(info.framework).toBe("fastapi");
    expect(info.packageManager).toBe("poetry");
  });

  test("detects Java Spring Boot from pom.xml", async () => {
    writeFileSync(join(TEST_DIR, "pom.xml"), '<project><dependencies><dependency><artifactId>spring-boot-starter</artifactId></dependency></dependencies></project>', "utf-8");

    const { detectNonNodeProject } = await import("../src/analyzer.mjs");
    const info = detectNonNodeProject(TEST_DIR, "java");
    expect(info.ecosystem).toBe("java");
    expect(info.framework).toBe("spring-boot");
    expect(info.packageManager).toBe("maven");
  });
});

describe("Node.js package.json detection", () => {
  test("detects Next.js + TypeScript + Tailwind", async () => {
    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify({
      name: "test-project",
      dependencies: { "next": "^14.0.0", "react": "^18.0.0" },
      devDependencies: { "typescript": "^5.0.0", "tailwindcss": "^3.0.0" },
    }), "utf-8");

    const { detectFromPackageJson } = await import("../src/analyzer.mjs");
    const pkg = detectFromPackageJson(TEST_DIR);
    expect(pkg.framework).toBe("next.js");
    expect(pkg.language).toBe("typescript");
    expect(pkg.styling).toBe("tailwind");
    expect(pkg.ecosystem).toBe("node");
  });

  test("returns null for missing package.json", async () => {
    const { detectFromPackageJson } = await import("../src/analyzer.mjs");
    const pkg = detectFromPackageJson(TEST_DIR);
    expect(pkg).toBeNull();
  });
});
