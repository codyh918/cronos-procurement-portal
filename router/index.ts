import { createRouter, createWebHistory } from 'vue-router'
import CatalogView from '../views/CatalogView.vue'
import CustomerOrderDetailView from '../views/CustomerOrderDetailView.vue'
import CustomerOrdersView from '../views/CustomerOrdersView.vue'
import CustomersView from '../views/CustomersView.vue'
import AdminView from '../views/AdminView.vue'
import DashboardView from '../views/DashboardView.vue'
import EditProjectView from '../views/EditProjectView.vue'
import KittingView from '../views/KittingView.vue'
import NewQuoteView from '../views/NewQuoteView.vue'
import NewProjectView from '../views/NewProjectView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import PublicOrderLookupView from '../views/PublicOrderLookupView.vue'
import PublicOrderTokenView from '../views/PublicOrderTokenView.vue'
import PurchaseOrderDetailView from '../views/PurchaseOrderDetailView.vue'
import PurchaseOrdersView from '../views/PurchaseOrdersView.vue'
import QuotesView from '../views/QuotesView.vue'
import ReceivingView from '../views/ReceivingView.vue'
import ShippingView from '../views/ShippingView.vue'
import VendorsView from '../views/VendorsView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/orders/track', name: 'public-order-lookup', component: PublicOrderLookupView },
  { path: '/orders/track/:token', name: 'public-order-token', component: PublicOrderTokenView },
  { path: '/projects', name: 'projects', component: ProjectsView },
  { path: '/projects/new', name: 'new-project', component: NewProjectView },
  { path: '/projects/:id/edit', name: 'edit-project', component: EditProjectView },
  { path: '/projects/:id/quotes/new', name: 'new-project-quote', component: NewQuoteView },
  { path: '/projects/:id/quotes/:quoteId/edit', name: 'edit-project-quote', component: NewQuoteView },
  { path: '/projects/:id', name: 'project-detail', component: ProjectDetailView },
  { path: '/quotes', name: 'quotes', component: QuotesView },
  {
    path: '/purchase-orders',
    name: 'purchase-orders',
    component: PurchaseOrdersView,
  },
  {
    path: '/purchase-orders/:poId',
    name: 'purchase-order-detail',
    component: PurchaseOrderDetailView,
  },
  {
    path: '/admin/orders',
    name: 'customer-orders',
    component: CustomerOrdersView,
  },
  {
    path: '/admin/orders/:id',
    name: 'customer-order-detail',
    component: CustomerOrderDetailView,
  },
  {
    path: '/admin/orders/:id/items',
    name: 'customer-order-items',
    component: CustomerOrderDetailView,
  },
  {
    path: '/admin/orders/:id/tracking-link',
    name: 'customer-order-tracking-link',
    component: CustomerOrderDetailView,
  },
  { path: '/catalog', name: 'catalog', component: CatalogView },
  { path: '/vendors', name: 'vendors', component: VendorsView },
  { path: '/customers', name: 'customers', component: CustomersView },
  { path: '/receiving', name: 'receiving', component: ReceivingView },
  { path: '/kitting', name: 'kitting', component: KittingView },
  { path: '/shipping', name: 'shipping', component: ShippingView },
  { path: '/admin', name: 'admin', component: AdminView },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
