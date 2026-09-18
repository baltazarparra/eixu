import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';
import { db, transaction } from '@/lib/db';
import { privateBlobOptions } from '@/lib/blob/stores.mjs';
import {
  parseStudioEditorContract,
  validateStudioEditorValues,
} from './editor';
import { nextStudioEvent } from './runs';
import { withStudioToolLease } from './tool-lease';
import {
  STUDIO_PROTECTED_FILES,
  isStudioProtectedFileContent,
} from './scaffold';

type Gate = { command: 'typecheck' | 'build'; exitCode: number };

export async function checkpointStudioProject(input: {
  runId: string;
  projectId: string;
  sandboxName: string;
  userId: string;
  workflowRunId: string;
}) {
  'use step';
  const {
    archiveStudioProject,
    ensureStudioDependencies,
    listStudioFiles,
    readStudioFile,
    runStudioCommand,
    studioProjectDigest,
  } = await import('./sandbox');
  return withStudioToolLease({
    projectId: input.projectId,
    runId: input.runId,
    operation: 'checkpoint',
    ttlSeconds: 1200,
    run: async () => {
      const state = (await db()`
        select project.draft_code_revision, run.kind,
               revision.revision as content_revision,
               revision.contract_hash,
               checkpoint.content_hash as checkpoint_code_revision,
               checkpoint.version as checkpoint_version,
               checkpoint.payload as checkpoint_payload,
               exists(
                 select 1 from studio_events event
                 where event.run_id = ${input.runId}
                   and event.type in (
                     'file.written', 'file.deleted', 'content.written'
                   )
               ) as mutated,
               exists(
                 select 1 from studio_artifacts artifact
                 where artifact.run_id = ${input.runId}
                   and artifact.kind = 'context'
               ) as has_context,
               exists(
                 select 1 from studio_artifacts artifact
                 where artifact.run_id = ${input.runId}
                   and artifact.kind = 'art_direction'
               ) as has_art_direction
        from studio_projects project
        join studio_runs run on run.id = ${input.runId}
          and run.project_id = project.id
        left join studio_content_revisions revision
          on revision.id = project.active_content_revision_id
        left join studio_artifacts checkpoint
          on checkpoint.run_id = run.id and checkpoint.kind = 'code'
        where project.id = ${input.projectId}
          and run.status = 'running'
          and run.workflow_run_id = ${input.workflowRunId}
        limit 1
      `) as {
        draft_code_revision: string | null;
        content_revision: number | null;
        contract_hash: string | null;
        mutated: boolean;
        kind: string;
        has_context: boolean;
        has_art_direction: boolean;
        checkpoint_code_revision: string | null;
        checkpoint_version: number | null;
        checkpoint_payload: Record<string, unknown> | null;
      }[];
      if (!state[0]) throw new Error('Projeto não encontrado.');
      if (state[0].checkpoint_code_revision) {
        if (state[0].draft_code_revision !== state[0].checkpoint_code_revision)
          throw new Error(
            'O checkpoint deste turno não corresponde mais ao rascunho ativo.',
          );
        return {
          ok: true as const,
          codeRevision: state[0].checkpoint_code_revision,
          contractHash:
            typeof state[0].checkpoint_payload?.contractHash === 'string'
              ? state[0].checkpoint_payload.contractHash
              : state[0].contract_hash,
          contentRevision: Number(
            state[0].checkpoint_payload?.contentRevision ??
              state[0].content_revision,
          ),
          artifactVersion: state[0].checkpoint_version,
          reused: true,
        };
      }
      if (
        state[0].kind === 'build' &&
        (!state[0].has_context || !state[0].has_art_direction)
      )
        throw new Error(
          'O primeiro build precisa registrar contexto e direção de arte antes do código.',
        );
      if (!state[0].mutated) {
        if (!state[0].draft_code_revision)
          throw new Error(
            'O primeiro turno terminou sem construir o projeto. Escreva os arquivos e o contrato editorial antes de concluir.',
          );
        return {
          ok: true as const,
          codeRevision: state[0].draft_code_revision,
          contractHash: state[0].contract_hash,
          contentRevision: state[0].content_revision,
          artifactVersion: null,
          reused: true,
        };
      }
      const installed = await ensureStudioDependencies(input.sandboxName);
      if (installed) {
        await nextStudioEvent(input.runId, 'command.finished', {
          command: 'install',
          exitCode: installed.exitCode,
          durationMs: installed.durationMs,
        });
        if (installed.exitCode !== 0)
          throw new Error(
            `A instalação falhou. ${installed.stderr}`.slice(0, 4_000),
          );
      }
      const files = await listStudioFiles(input.sandboxName);
      const sourceDigest = await studioProjectDigest(input.sandboxName);
      const gates: Gate[] = [];
      for (const command of ['typecheck', 'build'] as const) {
        const result = await runStudioCommand(input.sandboxName, command);
        gates.push({ command, exitCode: result.exitCode });
        await nextStudioEvent(input.runId, 'command.finished', {
          command,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
        });
        if (result.exitCode !== 0)
          // Repetir o step executaria o mesmo código inválido. Devolva a
          // evidência ao Workflow para uma correção limitada antes do checkpoint.
          return {
            ok: false as const,
            command,
            error:
              `${command} falhou no gate final. ${result.stderr || result.stdout}`.slice(
                0,
                4_000,
              ),
          };
      }

      const verifiedDigest = await studioProjectDigest(input.sandboxName);
      if (verifiedDigest !== sourceDigest)
        throw new Error(
          'Os comandos de validação alteraram os arquivos do projeto. Revise os scripts antes de criar o checkpoint.',
        );

      const [schemaText, valuesText, projectText, archive] = await Promise.all([
        readStudioFile(input.sandboxName, 'content/schema.json'),
        readStudioFile(input.sandboxName, 'content/values.json'),
        readStudioFile(input.sandboxName, 'project.json'),
        archiveStudioProject(input.sandboxName),
      ]);
      const projectConfig = JSON.parse(projectText) as {
        platform?: unknown;
        tenant?: unknown;
        canonicalHost?: unknown;
      };
      const bindings = (await db()`
        select slug, canonical_host from studio_projects
        where id = ${input.projectId} limit 1
      `) as { slug: string; canonical_host: string }[];
      const binding = bindings[0];
      if (
        projectConfig.platform !== 'eixu-studio' ||
        projectConfig.tenant !== binding?.slug ||
        projectConfig.canonicalHost !== binding?.canonical_host
      )
        throw new Error(
          'project.json não corresponde ao tenant e ao domínio autorizados.',
        );
      for (const path of STUDIO_PROTECTED_FILES) {
        const actual = await readStudioFile(input.sandboxName, path).catch(
          () => null,
        );
        if (
          !binding ||
          !isStudioProtectedFileContent(path, actual, binding.slug)
        )
          throw new Error(`O arquivo reservado ${path} foi alterado.`);
      }
      const contract = parseStudioEditorContract(JSON.parse(schemaText));
      if (!contract) throw new Error('O contrato editorial final é inválido.');
      const values = validateStudioEditorValues(
        contract,
        JSON.parse(valuesText),
      );
      const codeRevision = createHash('sha256').update(archive).digest('hex');
      const contractHash = createHash('sha256')
        .update(JSON.stringify(contract))
        .digest('hex');
      const pathname = `studio/${input.projectId}/code/${codeRevision}.tar.gz`;
      await put(pathname, archive, {
        ...(await privateBlobOptions()),
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/gzip',
      });

      const saved = await transaction(async (connection) => {
        const activeRun = await connection.query(
          `select id from studio_runs
           where id = $1 and project_id = $2 and workflow_run_id = $3
             and status = 'running'
           for update`,
          [input.runId, input.projectId, input.workflowRunId],
        );
        if (!activeRun.rows[0])
          throw new Error('A execução foi cancelada antes do checkpoint.');
        const locked = await connection.query(
          `select id from studio_projects where id = $1 for update`,
          [input.projectId],
        );
        if (!locked.rows[0]) throw new Error('Projeto não encontrado.');
        const revisions = await connection.query(
          `select coalesce(max(revision), 0) + 1 as revision
           from studio_content_revisions where project_id = $1`,
          [input.projectId],
        );
        const revision = Number(revisions.rows[0].revision);
        const content = await connection.query(
          `insert into studio_content_revisions (
             project_id, revision, schema_version, contract_hash,
             contract, content, source, summary, created_by
           ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'chat', $7, $8)
           returning id`,
          [
            input.projectId,
            revision,
            contract.version,
            contractHash,
            JSON.stringify(contract),
            JSON.stringify(values),
            `Checkpoint do run ${input.runId}`,
            input.userId,
          ],
        );
        const versions = await connection.query(
          `select coalesce(max(version), 0) + 1 as version
           from studio_artifacts where project_id = $1 and kind = 'code'`,
          [input.projectId],
        );
        const version = Number(versions.rows[0].version);
        await connection.query(
          `insert into studio_artifacts (
             project_id, run_id, kind, version, input_hash,
             content_hash, payload, storage_key
           ) values ($1, $2, 'code', $3, $4, $4, $5::jsonb, $6)`,
          [
            input.projectId,
            input.runId,
            version,
            codeRevision,
            JSON.stringify({
              files: files.length,
              contractHash,
              contentRevision: revision,
              gates,
            }),
            pathname,
          ],
        );
        await connection.query(
          `update studio_projects set
             draft_code_revision = $2,
             active_content_revision_id = $3,
             status = 'ready', updated_at = now()
           where id = $1`,
          [input.projectId, codeRevision, content.rows[0].id],
        );
        return { revision, version };
      });
      await nextStudioEvent(input.runId, 'checkpoint.saved', {
        codeRevision,
        contractHash,
        contentRevision: saved.revision,
        artifactVersion: saved.version,
      });
      return {
        ok: true as const,
        codeRevision,
        contractHash,
        contentRevision: saved.revision,
        artifactVersion: saved.version,
      };
    },
  });
}
