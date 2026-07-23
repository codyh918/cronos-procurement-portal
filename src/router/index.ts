import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import AuthGate from '../components/AuthGate.vue'
import { adminOnlyPaths } from '../roles'
import { fetchSession, normalizeRole } from '../services/auth'
import AdminView from '../views/AdminView.vue'
import CatalogView from '../views/CatalogView.vue'
import CimsAppView from '../views/CimsAppView.vue'
import CustomerOrderDetailView from '../views/CustomerOrderDetailView.vue'
import CustomerOrdersView from '../views/CustomerOrdersView.vue'
import CustomersView from '../views/CustomersView.vue'
import DashboardView from '../views/DashboardView.vue'
import EditProjectView from '../views/EditProjectView.vue'
import EquityScoutView from '../views/EquityScoutView.vue'
import NewProjectView from '../views/NewProjectView.vue'
import NewQuoteView from '../views/NewQuoteView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import PublicOrderLookupView from '../views/PublicOrderLookupView.vue'
import PublicOrderTokenView from '../views/PublicOrderTokenView.vue'
import PurchaseOrderDetailView from '../views/PurchaseOrderDetailView.vue'
import PurchaseOrdersView from '../views/PurchaseOrdersView.vue'
import QuotesView from '../views/QuotesView.vue'
import VendorsView from '../views/VendorsView.vue'
import SewpDashboardView from '../views/SewpDashboardView.vue'
import SewpWorkQueueView from '../views/SewpWorkQueueView.vue'
import NewSewpRfqView from '../views/NewSewpRfqView.vue'
import SewpRfqDetailView from '../views/SewpRfqDetailView.vue'
import SewpRfqImportView from '../views/SewpRfqImportView.vue'
import SewpDeletedView from '../views/SewpDeletedView.vue'

const routes = [
  {
    path: '/',
    component: AuthGate,
    children: [
      {
        path: '',
        component: AppShell,
        children: [
          { path: '', name: 'dashboard', component: DashboardView },
          { path: 'projects', name: 'projects', component: ProjectsView },
          { path: 'projects/new', name: 'new-project', component: NewProjectView },
          { path: 'projects/:id', name: 'project-detail', component: ProjectDetailView },
          { path: 'projects/:id/edit', name: 'edit-project', component: EditProjectView },
          { path: 'projects/:id/quotes/new', name: 'new-project-quote', component: NewQuoteView },
          { path: 'projects/:id/quotes/:quoteId/edit', name: 'edit-project-quote', component: NewQuoteView },
          { path: 'quotes', name: 'quotes', component: QuotesView },
          { path: 'purchase-orders', name: 'purchase-orders', component: PurchaseOrdersView },
          { path: 'purchase-orders/:poId', name: 'purchase-order-detail', component: PurchaseOrderDetailView },
          { path: 'sewp-rfqs', redirect: '/sewp-rfqs/dashboard' },
          { path: 'sewp-rfqs/dashboard', name: 'sewp-dashboard', component: SewpDashboardView },
          { path: 'sewp-rfqs/work-queue', name: 'sewp-work-queue', component: SewpWorkQueueView },
          { path: 'sewp-rfqs/new', name: 'new-sewp-rfq', component: NewSewpRfqView },
          { path: 'sewp-rfqs/import', name: 'import-sewp-rfq', component: SewpRfqImportView },
          { path: 'sewp-rfqs/deleted', name: 'deleted-sewp-rfqs', component: SewpDeletedView },
          { path: 'sewp-rfqs/:rfqId', name: 'sewp-rfq-detail', component: SewpRfqDetailView },
          { path: 'vendors', name: 'vendors', component: VendorsView },
          { path: 'catalog', name: 'catalog', component: CatalogView },
          { path: 'customers', name: 'customers', component: CustomersView },
          { path: 'customer-orders', name: 'customer-orders', component: CustomerOrdersView },
          { path: 'customer-orders/:orderNumber', name: 'customer-order-detail', component: CustomerOrderDetailView },
          { path: 'users', name: 'users', component: AdminView, meta: { adminOnly: true } },
          { path: 'roles', name: 'roles', component: AdminView, meta: { adminOnly: true } },
          { path: 'settings', name: 'settings', component: AdminView, meta: { adminOnly: true } },
          { path: 'audit-log', name: 'audit-log', component: PlaceholderView, meta: { title: 'Audit Log', adminOnly: true } },
        ],
      },
    ],
  },
  { path: '/orders/:token', name: 'public-order-token', component: PublicOrderTokenView },
  { path: '/order-status', name: 'public-order-lookup', component: PublicOrderLookupView },
  { path: '/cims', name: 'cims-explicit', component: CimsAppView },
  { path: '/equity-scout', name: 'equity-scout', component: EquityScoutView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(to => {
  const session = fetchSession()
  const path = to.path.replace(/\/$/, '') || '/'
  const isAdminRoute = to.matched.some(record => record.meta.adminOnly) || adminOnlyPaths.some(adminPath => path === adminPath || path.startsWith(`${adminPath}/`))

  if (isAdminRoute && normalizeRole(session?.role) !== 'admin') {
    return '/'
  }

  return true
})

export default router
