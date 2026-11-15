import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../../src/dtos/storage.dto.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', code)(require, module, module.exports);
const { UploadSchema } = module.exports;
test('TXT and CSV files offered by both clients can be uploaded', () => {
  const result = UploadSchema.safeParse({
    files: [
      { fileName: 'notes.txt', contentType: 'text/plain', size: 10 },
      { fileName: 'table.csv', contentType: 'text/csv', size: 20 },
    ],
  });
  assert.equal(result.success, true);
});
test('unsupported binary upload types remain rejected', () => {
  assert.equal(
    UploadSchema.safeParse({
      files: [{ fileName: 'program.exe', contentType: 'application/x-msdownload', size: 10 }],
    }).success,
    false
  );
});
