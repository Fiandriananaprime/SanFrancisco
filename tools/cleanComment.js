import fs from "fs";
import path from "path";

const ROOT_DIR = process.cwd();

function shouldSkipDir(dirName) {
  return ["node_modules", ".git", "dist", "build"].includes(dirName);
}

function cleanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  const cleaned = content
    .split("\n")
    .filter(line => !line.trim().startsWith("//"))
    .filter(line => !line.trim().startsWith("/*"))
    .join("\n");

  fs.writeFileSync(filePath, cleaned, "utf8");

  console.log("cleaned:", filePath);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        walk(fullPath);
      }
    } else {
      if (fullPath.endsWith(".js")) {
        cleanFile(fullPath);
      }
    }
  }
}

walk(ROOT_DIR);

console.log("Done.");