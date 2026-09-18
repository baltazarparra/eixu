import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createJiti } from 'jiti';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const jiti = createJiti(path.join(root, 'package.json'), {
  alias: { '@': root },
});

/** Executa o módulo real, substituindo somente as dependências indicadas pelo teste. */
export async function loadModule(relative, mocks = {}, globals = {}) {
  const filename = path.join(root, relative);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const dependencies = new Map();
  const specifiers = new Set(
    [...outputText.matchAll(/require\("(@\/[^" ]+)"\)/g)].map(
      (match) => match[1],
    ),
  );
  await Promise.all(
    [...specifiers]
      .filter((specifier) => !Object.hasOwn(mocks, specifier))
      .map(async (specifier) => {
        dependencies.set(
          specifier,
          await jiti.import(path.join(root, specifier.slice(2))),
        );
      }),
  );
  const loaded = { exports: {} };
  vm.runInNewContext(
    outputText,
    {
      module: loaded,
      exports: loaded.exports,
      require: (specifier) => {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        return dependencies.has(specifier)
          ? dependencies.get(specifier)
          : require(specifier);
      },
      Buffer,
      Uint8Array,
      URL,
      Request,
      Response,
      Headers,
      FormData,
      File,
      AbortSignal,
      AbortController,
      ReadableStream,
      TransformStream,
      Date,
      process,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      ...globals,
    },
    { filename },
  );
  return loaded.exports;
}

/** Carrega também imports locais reais; mocks de serviços valem para todo o grafo. */
export function loadModuleGraph(relative, mocks = {}, globals = {}) {
  const cache = new Map();
  function load(candidate) {
    const filename = ['', '.ts', '.tsx', '.mjs', '.js']
      .map((extension) => `${candidate}${extension}`)
      .find((file) => existsSync(file));
    if (!filename) throw new Error(`Módulo de teste ausente: ${candidate}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('@/'))
        return load(path.join(root, specifier.slice(2)));
      if (specifier.startsWith('.'))
        return load(path.resolve(path.dirname(filename), specifier));
      return require(specifier);
    };
    vm.compileFunction(
      outputText,
      ['module', 'exports', 'require', ...Object.keys(globals)],
      { filename },
    )(loaded, loaded.exports, localRequire, ...Object.values(globals));
    return loaded.exports;
  }
  return load(path.join(root, relative));
}
