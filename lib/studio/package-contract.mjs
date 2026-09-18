const CORE_DEPENDENCIES = {
  next: '16.3.3',
  react: '19.2.6',
  'react-dom': '19.2.6',
};

const CORE_DEV_DEPENDENCIES = {
  '@types/node': '22.19.19',
  '@types/react': '19.2.14',
  '@types/react-dom': '19.2.3',
  typescript: '5.9.3',
};

const REQUIRED_SCRIPTS = {
  dev: 'next dev',
  build: 'next build',
  start: 'next start',
  typecheck: 'next typegen && tsc --noEmit',
};

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function assertDependencies(value, required, label) {
  const dependencies = object(value);
  if (!dependencies) throw new Error(`${label} inválidas no projeto.`);
  for (const [name, version] of Object.entries(required))
    if (dependencies[name] !== version)
      throw new Error(`${name} deve permanecer na versão ${version}.`);
  const extra = Object.keys(dependencies).filter((name) => !(name in required));
  if (extra.length)
    throw new Error(
      `${label} contém dependências não autorizadas: ${extra.join(', ')}.`,
    );
  return dependencies;
}

export function assertStudioPackageContract(value) {
  const manifest = object(value);
  if (!manifest) throw new Error('package.json inválido.');
  const scripts = object(manifest.scripts);
  if (!scripts)
    throw new Error('Scripts obrigatórios ausentes no package.json.');
  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS))
    if (scripts[name] !== command)
      throw new Error(`O script ${name} é controlado pela plataforma.`);
  for (const name of Object.keys(scripts))
    if (
      name === 'prepare' ||
      /^(?:pre|post)(?:install|build|typecheck|test|lint|dev|start)$/.test(name)
    )
      throw new Error(`O lifecycle script ${name} não é permitido.`);

  const dependencies = assertDependencies(
    manifest.dependencies,
    CORE_DEPENDENCIES,
    'dependencies',
  );
  const devDependencies = assertDependencies(
    manifest.devDependencies,
    CORE_DEV_DEPENDENCIES,
    'devDependencies',
  );
  if (
    Object.keys(dependencies).length !==
      Object.keys(CORE_DEPENDENCIES).length ||
    Object.keys(devDependencies).length !==
      Object.keys(CORE_DEV_DEPENDENCIES).length
  )
    throw new Error('O manifesto contém dependências não autorizadas.');
  for (const key of [
    'optionalDependencies',
    'peerDependencies',
    'bundledDependencies',
    'bundleDependencies',
    'workspaces',
    'overrides',
    'resolutions',
  ])
    if (key in manifest) throw new Error(`${key} não é permitido no projeto.`);
  return manifest;
}
