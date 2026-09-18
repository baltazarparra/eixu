'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { createTenantAction } from '@/app/(admin)/admin/actions';
import { BrandFields } from '@/components/admin/brand-fields';
import { TenantFields } from '@/components/admin/tenant-fields';
import type { StudioDirection } from '@/lib/studio/directions';

export function StudioCreateForm() {
  const [error, action, pending] = useActionState(createTenantAction, null);
  const [direction, setDirection] = useState<StudioDirection>('comercial');
  return (
    <main className="studio-create">
      <header className="studio-create-header">
        <Link href="/studio" aria-label="Voltar para os projetos">
          <ArrowLeft size={16} aria-hidden="true" /> Projetos
        </Link>
        <span>EIXU Studio</span>
      </header>
      <div className="studio-create-layout">
        <aside>
          <p>Novo projeto</p>
          <h1>Conte o que torna este cliente específico.</h1>
          <span>
            O Studio usa estes dados para entender o negócio, definir a direção
            de arte, gerar as imagens, construir e validar o site.
          </span>
          <ol>
            <li>
              <b>01</b> Contexto e fontes
            </li>
            <li>
              <b>02</b> Estrutura e direção
            </li>
            <li>
              <b>03</b> Imagens e construção
            </li>
            <li>
              <b>04</b> Validação e primeira publicação
            </li>
          </ol>
        </aside>
        <form
          className="studio-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(() => action(form));
          }}
        >
          <fieldset disabled={pending}>
            <input type="hidden" name="surface" value="studio" />
            <TenantFields
              withSlug
              referenceRequired={direction === 'referencia'}
            />
            <BrandFields onDirectionChange={setDirection} />
          </fieldset>
          {error ? (
            <p className="studio-create-error" role="alert">
              {error}
            </p>
          ) : null}
          <footer>
            <p>
              Ao criar, o agente começa a trabalhar e publica a primeira versão
              automaticamente depois dos testes. As próximas versões só entram
              no ar quando você clicar em Publicar.
            </p>
            <button type="submit" disabled={pending}>
              {pending ? 'Criando projeto…' : 'Criar e começar'}
              {!pending ? <ArrowRight size={16} aria-hidden="true" /> : null}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
