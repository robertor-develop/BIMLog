import assert from "node:assert/strict";
import { decryptLaunchSecret, encryptLaunchSecret, LaunchSecretError, maskLaunchSecret } from "./launch-configuration-secret";

const key = Buffer.alloc(32, 7).toString("base64"), value = "synthetic-smtp-password";
const envelope = encryptLaunchSecret({ environment: "staging", field: "smtpPassword", value, encodedKey: key });
assert.notEqual(envelope.ciphertext, value);
assert.ok(!JSON.stringify(envelope).includes(value));
const restored = decryptLaunchSecret({ environment: "staging", field: "smtpPassword", envelope, encodedKey: key });
assert.equal(restored.toString("utf8"), value); restored.fill(0);
assert.equal(maskLaunchSecret(envelope), "configured (v1)");
assert.throws(() => decryptLaunchSecret({ environment: "production", field: "smtpPassword", envelope, encodedKey: key }), LaunchSecretError);
assert.throws(() => encryptLaunchSecret({ environment: "staging", field: "smtpPassword", value, encodedKey: "invalid" }), LaunchSecretError);
console.log("LAUNCH_CONFIGURATION_BUILD_07=PASS encryption=aes-256-gcm contextBound=true plaintextExcluded=true");
