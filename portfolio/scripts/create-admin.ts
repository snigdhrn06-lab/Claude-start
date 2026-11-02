/**
 * Create an admin account or reset its password from the command line.
 *   npm run admin:create -- --email you@example.com          (prompts for the password)
 *   npm run admin:create -- --email you@example.com --reset  (resets an existing password)
 * Non-interactive: ADMIN_PASSWORD=... npm run admin:create -- --email you@example.com
 */
import { createInterface } from "node:readline";
import { getPool } from "@/lib/db/client";
import { upsertAdmin } from "@/lib/ops/admin";
import { runMigrations } from "@/lib/ops/migrate";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
      else out.output.write("*");
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg("email") ?? process.env.ADMIN_EMAIL;
  if (!email) throw new Error("Pass --email you@example.com");
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden("New admin password (12+ characters): ");
    const again = await askHidden("Repeat password: ");
    if (password !== again) throw new Error("Passwords do not match");
  }
  await runMigrations();
  const result = await upsertAdmin(email, password, { reset: process.argv.includes("--reset") });
  if (result.action === "exists") console.log(`An admin with ${email} already exists. Use --reset to change its password.`);
  else console.log(`Admin ${result.action} for ${email}.`);
}

main()
  .catch((err) => {
    console.error("[admin] failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
