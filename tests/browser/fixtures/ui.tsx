import { useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { TerminalHeadline } from '@/components/terminal-headline';
import { useIsMobile } from '@/hooks/use-mobile';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Item, ItemGroup, ItemSeparator } from '@/components/ui/item';
import { PaginationLink } from '@/components/ui/pagination';
import { BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Spinner } from '@/components/ui/spinner';
import { InputOTPSeparator } from '@/components/ui/input-otp';
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from '@/components/ui/chart';

function Controls() {
  const mobile = useIsMobile();
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <output id="mobile">{String(mobile)}</output>
      <TerminalHeadline />
      <Field aria-label="Contato">
        <Label htmlFor="email">E-mail</Label>
        <InputGroup aria-label="Campo e ação">
          <InputGroupInput id="email" type="email" />
          <InputGroupAddon>
            <InputGroupButton
              id="addon-action"
              onClick={() => setClicks((value) => value + 1)}
            >
              Confirmar
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <output id="clicks">{clicks}</output>
      <ButtonGroup aria-label="Ações">
        <button type="button">Salvar</button>
        <button type="button">Cancelar</button>
      </ButtonGroup>
      <ItemGroup aria-label="Itens">
        <Item>Primeiro</Item>
        <ItemSeparator />
        <Item>Segundo</Item>
      </ItemGroup>
      <PaginationLink href="#pagina-2" isActive>
        2
      </PaginationLink>
      <BreadcrumbPage>Atual</BreadcrumbPage>
      <Spinner aria-label="Aguarde" />
      <InputOTPSeparator />
      <Carousel
        style={{ width: 240, margin: '60px auto' }}
        aria-label="Exemplos"
      >
        <CarouselContent>
          {['Um', 'Dois', 'Três'].map((label) => (
            <CarouselItem key={label}>
              <p style={{ height: 80 }}>{label}</p>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div id="charts">
        <ChartContainer
          config={{ value: { label: 'Volume' } }}
          style={{ width: 320, height: 200 }}
        >
          <ChartTooltipContent
            active
            payload={[
              {
                graphicalItemId: 'fixture',
                dataKey: () => 10,
                value: 10,
                payload: {},
              },
            ]}
          />
        </ChartContainer>
        <ChartContainer
          config={{ value: { label: 'Volume' } }}
          style={{ width: 320, height: 200 }}
        >
          <ChartLegendContent
            payload={[
              {
                dataKey: () => 10,
                value: 'Volume',
                type: 'square',
                color: '#123456',
              },
            ]}
          />
        </ChartContainer>
      </div>
    </>
  );
}

export function UiFixture() {
  const [visible, setVisible] = useState(true);
  return (
    <main style={{ padding: 24 }}>
      <button
        id="toggle-fixture"
        type="button"
        onClick={() => setVisible((value) => !value)}
      >
        Alternar fixture
      </button>
      {visible && <Controls />}
    </main>
  );
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('root');
  if (container) hydrateRoot(container, <UiFixture />);
}
