// Test bootstrap loaded by Mocha before any spec file.
//
// `chai` (v5) and `fast-check` (v3) ship as pure ES modules. Under ts-node's
// ESM loader the spec files are evaluated as native ES modules, so importing
// these ESM-only dependencies once here, before the specs load, warms Node's
// module cache and keeps every later import resolving instantly.
import 'chai';
import 'fast-check';
