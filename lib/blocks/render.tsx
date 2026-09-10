import type { BlockInstance, Tenant } from '@/lib/types';
import { blockSchemas, isBlockType } from '@/lib/blocks/registry';
import * as B from '@/lib/blocks/components';

export type RenderContext = {
  tenant: Tenant;
  /** Posts publicados, usados por editorial.postList. */
  posts?: { slug: string; title: string; excerpt?: string; date?: string }[];
  pagePath: string;
  /** Só em preview: propaga o tenant porque não há subdomínio. */
  previewTenant?: string;
};

/**
 * Renderiza a árvore de blocos. Props inválidas nunca derrubam a página:
 * o bloco é omitido e o lint acusa o problema no painel.
 */
/**
 * Envolve o miolo em `<main>`. Nav e rodapé ficam fora, como manda a
 * semântica de marcos de página que leitores de tela usam para navegar.
 */
export function RenderBlocks({ blocks, ctx }: { blocks: BlockInstance[]; ctx: RenderContext }) {
  const isChrome = (block: BlockInstance) =>
    block.type.startsWith('nav.') || block.type.startsWith('footer.');
  const leading: BlockInstance[] = [];
  const content: BlockInstance[] = [];
  const trailing: BlockInstance[] = [];
  for (const block of blocks) {
    if (isChrome(block)) (content.length ? trailing : leading).push(block);
    else content.push(block);
  }
  return (
    <>
      {renderList(leading, ctx)}
      <main>{renderList(content, ctx)}</main>
      {renderList(trailing, ctx)}
      <B.FloatingWhatsapp ctx={ctx} />
    </>
  );
}

function renderList(blocks: BlockInstance[], ctx: RenderContext) {
  return (
    <>
      {blocks.map((block) => {
        if (!isBlockType(block.type)) return null;
        const parsed = blockSchemas[block.type].safeParse(block.props);
        if (!parsed.success) return null;
        const props = parsed.data as never;
        const key = block.id;

        switch (block.type) {
          case 'nav.bar':
            return <B.NavBar key={key} {...(props as B.NavBarProps)} ctx={ctx} />;
          case 'hero.split':
            return <B.HeroSplit key={key} {...(props as B.HeroSplitProps)} ctx={ctx} />;
          case 'hero.statement':
            return <B.HeroStatement key={key} {...(props as B.HeroStatementProps)} ctx={ctx} />;
          case 'proof.logos':
            return <B.ProofLogos key={key} {...(props as B.ProofLogosProps)} />;
          case 'proof.stats':
            return <B.ProofStats key={key} {...(props as B.ProofStatsProps)} />;
          case 'proof.testimonial':
            return <B.ProofTestimonial key={key} {...(props as B.ProofTestimonialProps)} />;
          case 'feature.numbered':
            return <B.FeatureNumbered key={key} {...(props as B.FeatureNumberedProps)} />;
          case 'narrative.split':
            return <B.NarrativeSplit key={key} {...(props as B.NarrativeSplitProps)} />;
          case 'editorial.facts':
            return <B.EditorialFacts key={key} {...(props as B.EditorialFactsProps)} />;
          case 'media.image':
            return <B.MediaImage key={key} {...(props as B.MediaImageProps)} />;
          case 'feature.bento':
            return <B.FeatureBento key={key} {...(props as B.FeatureBentoProps)} />;
          case 'narrative.steps':
            return <B.NarrativeSteps key={key} {...(props as B.NarrativeStepsProps)} />;
          case 'faq.accordion':
            return <B.FaqAccordion key={key} {...(props as B.FaqAccordionProps)} />;
          case 'cta.band':
            return <B.CtaBand key={key} {...(props as B.CtaBandProps)} ctx={ctx} />;
          case 'form.lead':
            return <B.FormLead key={key} {...(props as B.FormLeadProps)} ctx={ctx} />;
          case 'editorial.text':
            return <B.EditorialText key={key} {...(props as B.EditorialTextProps)} />;
          case 'editorial.postList':
            return <B.EditorialPostList key={key} {...(props as B.EditorialPostListProps)} ctx={ctx} />;
          case 'editorial.postBody':
            return <B.EditorialPostBody key={key} {...(props as B.EditorialPostBodyProps)} />;
          case 'media.gallery':
            return <B.MediaGallery key={key} {...(props as B.MediaGalleryProps)} />;
          case 'media.map':
            return <B.MediaMap key={key} {...(props as B.MediaMapProps)} />;
          case 'pricing.table':
            return <B.PricingTable key={key} {...(props as B.PricingTableProps)} />;
          case 'footer.compact':
            return <B.FooterCompact key={key} {...(props as B.FooterCompactProps)} ctx={ctx} />;
          default:
            return null;
        }
      })}
    </>
  );
}
