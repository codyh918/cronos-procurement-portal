import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import AuthGate from '../components/AuthGate.vue'
import { adminOnlyPaths } from '../roles'
import { fetchSession, normalizeRole } from '../services/auth'
import AdminView from '../views/AdminView.vue'
import CatalogView from '../views/CatalogView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
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
import ManagedFundsView from '../views/ManagedFundsView.vue'
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
import CustomerPortalShell from '../components/CustomerPortalShell.vue'
import CustomerLoginView from '../views/customer/CustomerLoginView.vue'
import CustomerDashboardView from '../views/customer/CustomerDashboardView.vue'
import CustomerProjectsView from '../views/customer/CustomerProjectsView.vue'
import CustomerProjectView from '../views/customer/CustomerProjectView.vue'
import CustomerAttentionView from '../views/customer/CustomerAttentionView.vue'
import { getCustomerToken } from '../services/customerPortalApi'
import DemoPortalShell from '../demo/customer/components/DemoPortalShell.vue'
import DemoDashboardView from '../demo/customer/views/DemoDashboardView.vue'
import DemoProjectsView from '../demo/customer/views/DemoProjectsView.vue'
import DemoProjectView from '../demo/customer/views/DemoProjectView.vue'
import DemoMaterialsView from '../demo/customer/views/DemoMaterialsView.vue'
import DemoAttentionView from '../demo/customer/views/DemoAttentionView.vue'
import DemoReportsView from '../demo/customer/views/DemoReportsView.vue'
import DemoSupportView from '../demo/customer/views/DemoSupportView.vue'

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
          { path: 'projects/:id/actions/:actionId', name: 'managed-funds-action', component: ManagedFundsView },
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
          { path: 'catalog/:productId', name: 'catalog-product', component: ProductDetailView },
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
  { path: '/customer/login', name: 'customer-login', component: CustomerLoginView, meta: { customerPublic: true } },
  { path: '/customer', component: CustomerPortalShell, meta: { customerProtected: true }, children: [
    { path: '', name: 'customer-dashboard', component: CustomerDashboardView },
    { path: 'projects', name: 'customer-projects', component: CustomerProjectsView },
    { path: 'projects/:projectId', name: 'customer-project', component: CustomerProjectView },
    { path: 'projects/:projectId/materials', redirect: (to: any) => `/customer/projects/${to.params.projectId}` },
    { path: 'projects/:projectId/activity', redirect: (to: any) => `/customer/projects/${to.params.projectId}` },
    { path: 'attention', name: 'customer-attention', component: CustomerAttentionView },
  ]},
  { path: '/demo/customer', component: DemoPortalShell, children: [
    { path: '', name: 'demo-customer-dashboard', component: DemoDashboardView },
    { path: 'projects', name: 'demo-customer-projects', component: DemoProjectsView },
    { path: 'projects/:projectId', name: 'demo-customer-project', component: DemoProjectView },
    { path: 'materials', name: 'demo-customer-materials', component: DemoMaterialsView },
    { path: 'attention', name: 'demo-customer-attention', component: DemoAttentionView },
    { path: 'reports', name: 'demo-customer-reports', component: DemoReportsView },
    { path: 'support', name: 'demo-customer-support', component: DemoSupportView },
  ]},
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(to => {
  if (to.matched.some(record => record.meta.customerProtected) && !getCustomerToken()) return '/customer/login'
  if (to.meta.customerPublic && getCustomerToken()) return '/customer'
  const session = fetchSession()
  const path = to.path.replace(/\/$/, '') || '/'
  const isAdminRoute = to.matched.some(record => record.meta.adminOnly) || adminOnlyPaths.some(adminPath => path === adminPath || path.startsWith(`${adminPath}/`))

  if (isAdminRoute && normalizeRole(session?.role) !== 'admin') {
    return '/'
  }

  return true
})

export default router
