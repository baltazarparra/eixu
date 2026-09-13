import { createRoot } from 'react-dom/client';
import { LogOut } from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { TenantFrame } from '@/components/admin/navigation';
import { Clients } from '@/app/(admin)/admin/clients';
import { SettingsForm } from '@/app/(admin)/admin/[tenant]/dados/settings-form';
import { ImagesLibrary } from '@/app/(admin)/admin/[tenant]/imagens/images-library';
import { TrafficReport } from '@/components/admin/traffic-report';
import { Workspace } from '@/app/(admin)/admin/[tenant]/workspace';
import LoginPage from '@/app/(admin)/admin/login/page';

const data = JSON.parse(document.getElementById('fixture-state')!.textContent!);
const pathname = window.location.pathname;
const tenant = data.tenant;
const area = pathname.split('/')[3];
const isClients = pathname === '/admin';
const content = isClients ? (
  <main className="admin-page admin-clients-page">
    <Clients
      tenants={data.empty ? [] : data.clients}
      summary={data.empty ? { leads30d: 0, running: 0 } : data.summary}
    />
  </main>
) : area === 'dados' ? (
  <main className="admin-page admin-settings-page">
    <div className="admin-page-heading">
      <div>
        <h1>Dados do cliente</h1>
        <p>Contatos, história e marca em um só lugar.</p>
      </div>
    </div>
    <SettingsForm
      tenant={tenant}
      intake={data.intake}
      contacts={data.contacts}
      social={null}
    />
  </main>
) : area === 'imagens' ? (
  <ImagesLibrary
    tenant={tenant}
    initial={{
      guide: data.guide,
      images: data.empty ? [] : data.images,
      usage: {},
    }}
  />
) : area === 'trafego' ? (
  <main className="admin-page">
    <div className="admin-page-heading">
      <div>
        <h1>Tráfego</h1>
        <p>Acompanhe o interesse e os pedidos que chegam pelo site.</p>
      </div>
    </div>
    <TrafficReport
      data={
        data.empty
          ? {
              ...data.traffic,
              visitors: 0,
              forms: 0,
              whats: 0,
              cents: 0,
              partialSpends: 0,
              campaignCount: 0,
              campaigns: [],
              pages: [],
              series: [],
            }
          : data.traffic
      }
      tenant={tenant.slug}
    />
  </main>
) : (
  <Workspace initial={data.site} history={data.history} lastMessageId={0} />
);
createRoot(document.getElementById('root')!).render(
  pathname === '/admin/login' ? (
    <LoginPage />
  ) : (
    <AdminShell
      operator="Operação"
      logout={
        <button
          type="button"
          className="admin-icon-button"
          aria-label="Sair do painel"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      }
    >
      {isClients ? (
        content
      ) : (
        <TenantFrame tenant={tenant}>{content}</TenantFrame>
      )}
    </AdminShell>
  ),
);
