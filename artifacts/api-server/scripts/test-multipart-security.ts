import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { boundedMultipart, MULTIPART_LIMITS, singleFileUpload } from "../src/middlewares/multipart";

const boundary = "bimlog-bounded-multipart-test";
type Part = { name: string; value?: string; file?: Buffer; filename?: string; headers?: string[] };

function multipart(parts: Part[], close = true): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = part.file === undefined
      ? `Content-Disposition: form-data; name="${part.name}"\r\n`
      : `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename ?? "test.bin"}"\r\nContent-Type: application/octet-stream\r\n`;
    chunks.push(Buffer.from(disposition));
    for (const header of part.headers ?? []) chunks.push(Buffer.from(`${header}\r\n`));
    chunks.push(Buffer.from("\r\n"));
    chunks.push(part.file ?? Buffer.from(part.value ?? ""));
    chunks.push(Buffer.from("\r\n"));
  }
  if (close) chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function main() {
  const app = express();
  let durableMutations = 0;
  const upload = singleFileUpload({
    fileSize: 8,
    files: 1,
    fields: 1,
    parts: 2,
    fieldSize: 8,
  });
  const fieldNameUpload = singleFileUpload({ fileSize: 8, files: 1, fields: 1, parts: 1 });
  const partsUpload = singleFileUpload({ fileSize: 8, files: 1, fields: 2, parts: 2 });

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.post("/secure", upload, (req, res) => {
    durableMutations += 1;
    res.json({ fileSize: req.file?.size, field: req.body.meta });
  });
  app.post("/malformed", boundedMultipart((_req, _res, next) => next(new Error("bounded fixture"))));
  app.post("/field-name", fieldNameUpload, (_req, res) => res.json({ ok: true }));
  app.post("/parts", partsUpload, (_req, res) => res.json({ ok: true }));
  app.post("/gated/:gate", (req, res, next) => {
    if (req.params.gate === "allowed") next();
    else res.status(req.params.gate === "unauthenticated" ? 401 : 403).json({ error: "denied" });
  }, upload, (_req, res) => {
    durableMutations += 1;
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: Buffer) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
  });

  try {
    assert.deepEqual(MULTIPART_LIMITS, {
      fieldNestingDepth: 0,
      fieldNameSize: 64,
      headerPairs: 32,
      defaultFieldSize: 64 * 1024,
    });
    const atLimit = multipart([
      { name: "meta", value: "12345678" },
      { name: "file", file: Buffer.alloc(8, 1) },
    ]);
    let response = await post("/secure", atLimit);
    assert.equal(response.status, 200, "documented field/file limits must remain inclusive");
    await response.arrayBuffer();

    const rejected: Array<[string, Buffer, number, string]> = [
      ["nested", multipart([{ name: "meta[nested]", value: "x" }, { name: "file", file: Buffer.from("x") }]), 400, "MULTIPART_FIELD_NESTING_REJECTED"],
      ["malformed-bracket", multipart([{ name: "meta[", value: "x" }, { name: "file", file: Buffer.from("x") }]), 400, "MULTIPART_FIELD_NESTING_REJECTED"],
      ["fields", multipart([{ name: "meta", value: "x" }, { name: "extra", value: "x" }, { name: "file", file: Buffer.from("x") }]), 400, "MULTIPART_TOO_MANY_FIELDS"],
      ["files", multipart([{ name: "file", file: Buffer.from("x") }, { name: "file", file: Buffer.from("y") }]), 400, "MULTIPART_TOO_MANY_FILES"],
      ["file-size", multipart([{ name: "file", file: Buffer.alloc(9) }]), 413, "MULTIPART_FILE_TOO_LARGE"],
      ["field-size", multipart([{ name: "meta", value: "123456789" }, { name: "file", file: Buffer.from("x") }]), 413, "MULTIPART_FIELD_TOO_LARGE"],
      ["zero-byte", multipart([{ name: "file", file: Buffer.alloc(0) }]), 400, "MULTIPART_EMPTY_FILE"],
      ["duplicate-field", multipart([{ name: "meta", value: "a" }, { name: "meta", value: "b" }]), 400, "MULTIPART_TOO_MANY_FIELDS"],
      ["unexpected-file", multipart([{ name: "other", file: Buffer.from("x") }]), 400, "MULTIPART_UNEXPECTED_FILE"],
    ];
    for (const [name, body, status, code] of rejected) {
      response = await post("/secure", body);
      assert.equal(response.status, status, `${name} status`);
      assert.equal((await response.json() as { code?: string }).code, code, `${name} code`);
    }
    response = await post("/malformed", atLimit);
    assert.equal(response.status, 400, "malformed parser failure status");
    assert.equal((await response.json() as { code?: string }).code, "MULTIPART_MALFORMED", "malformed parser failure code");

    response = await post("/field-name", multipart([{ name: "n".repeat(64), value: "x" }]));
    assert.equal(response.status, 200, "field-name limit must remain inclusive");
    await response.arrayBuffer();
    response = await post("/field-name", multipart([{ name: "n".repeat(65), value: "x" }]));
    assert.equal(response.status, 400, "field name just above limit");
    assert.equal((await response.json() as { code?: string }).code, "MULTIPART_FIELD_NAME_TOO_LARGE");

    response = await post("/parts", multipart([{ name: "meta", value: "x" }, { name: "file", file: Buffer.from("x") }]));
    assert.equal(response.status, 200, "parts limit must remain inclusive");
    await response.arrayBuffer();
    response = await post("/parts", multipart([{ name: "meta", value: "x" }, { name: "extra", value: "x" }, { name: "file", file: Buffer.from("x") }]));
    assert.equal(response.status, 400, "parts just above limit");
    assert.equal((await response.json() as { code?: string }).code, "MULTIPART_TOO_MANY_PARTS");

    for (const gate of ["unauthenticated", "nonmember", "readonly", "cross-company", "cross-project"]) {
      response = await post(`/gated/${gate}`, atLimit);
      assert.equal(response.status, gate === "unauthenticated" ? 401 : 403, `${gate} must fail before parsing/mutation`);
      await response.arrayBuffer();
    }

    const beforeHostile = durableMutations;
    const harmlessNested = multipart([{ name: "meta[x]", value: "x" }, { name: "file", file: Buffer.from("x") }]);
    const concurrent = await Promise.all([
      post("/secure", atLimit),
      post("/secure", harmlessNested),
      post("/secure", atLimit),
      fetch(`${base}/health`),
    ]);
    assert.deepEqual(concurrent.map(item => item.status), [200, 400, 200, 200]);
    await Promise.all(concurrent.map(item => item.arrayBuffer()));
    assert.equal(durableMutations, beforeHostile + 2, "rejected request must not mutate state");

    response = await fetch(`${base}/health`);
    assert.equal(response.status, 200, "health endpoint must remain responsive after bounded malformed-input rejection");
    await response.arrayBuffer();

    console.log(JSON.stringify({
      passed: true,
      validAtLimit: true,
      boundedRejections: rejected.length + 2,
      authorizationGates: 5,
      concurrentIsolation: true,
      malformedParserRecovery: true,
      durableMutations,
    }));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

await main();
