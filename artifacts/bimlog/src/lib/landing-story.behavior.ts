import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../pages/Landing.tsx", import.meta.url), "utf8");
assert.equal((page.match(/user \? "\/dashboard" : "\/register"/g) ?? []).length, 3);
assert.match(page, /!user && <Link href="\/login">/);
assert.match(page, /user \? tt\("Open Dashboard", "Abrir panel"\) : tt\("Create Account", "Crear Cuenta"\)/);
assert.match(page, /user \? tt\("Continue to your projects", "Continuar a sus proyectos"\) : tt\("Start for free", "Empieza gratis"\)/);
assert.match(page, /Actual product screen/);
assert.match(page, /!user && <Link href="\/login">/);
assert.match(page, /user \? tt\("Open Dashboard", "Abrir panel"\) : tt\("Create Account", "Crear Cuenta"\)/);
assert.match(page, /max-w-7xl mx-auto px-6 lg:px-8/);
assert.match(page, /flex flex-wrap gap-3/);
for (const file of ["project-dashboard.png", "project-controls.png"]) {
  assert.equal(existsSync(new URL(`../../public/images/product-proof/${file}`, import.meta.url)), true);
}
console.log("landing story behavior: PASS");
