import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntakeHelpGuide } from "./IntakeHelpGuide";

const english = renderToStaticMarkup(<IntakeHelpGuide tt={(en) => en}/>);
assert.match(english, /Help me understand this screen/);
assert.match(english, /What am I approving/);
assert.match(english, /one real-world fact, one owning record/);
assert.match(english, /aria-label="Jump to job setup sections"/);
const spanish = renderToStaticMarkup(<IntakeHelpGuide tt={(_en, es) => es}/>);
assert.match(spanish, /Ayúdeme a entender esta pantalla/);
assert.match(spanish, /¿Qué estoy aprobando/);
assert.match(spanish, /Nómina, pagos, impuestos/);
console.log("Job Intake contextual help behavior: PASS");
