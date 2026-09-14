import { createRoot } from 'react-dom/client';
import { PreviewPointer } from '@/lib/blocks/preview-pointer';

/** Prévia sintética com o mesmo contrato de marcação do site: blocos com
 * `data-block-id` e itens em `article`. O componente apontado é o real. */
createRoot(document.getElementById('root')!).render(
  <>
    <PreviewPointer page="" />
    <div className="site-block" data-block="feature.bento" data-block-id="cards">
      <h2>Variedade para o seu lar</h2>
      <article id="card-hortifruti">
        <h3>Seleção diária de hortifrúti fresco</h3>
        <p>Frutas, verduras e legumes repostos todos os dias.</p>
      </article>
      <article id="card-padaria">
        <h3>Padaria e confeitaria</h3>
        <p>Pães e bolos preparados ao longo do dia.</p>
      </article>
    </div>
  </>,
);
