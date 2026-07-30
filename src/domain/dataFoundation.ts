export type Uuid = string
export type IsoDateTime = string
export type EntityStatus = 'active' | 'inactive' | 'deleted'
export type PurchaseMethod = 'purchase_order' | 'credit_card' | 'check' | 'ach' | 'wire' | 'other'
export type AuditMetadata = {
  createdAt: IsoDateTime; createdBy: Uuid; updatedAt: IsoDateTime; updatedBy: Uuid
  version: number; deletedAt?: IsoDateTime | null; deletedBy?: Uuid | null
  sourceSystem?: string; sourceId?: string
}
export type Page<T> = { records: T[]; total: number }
export type ListQuery = { search?: string; includeDeleted?: boolean; limit?: number; offset?: number }
export type WriteContext = { actorId: Uuid; expectedVersion?: number; requestId?: Uuid }
export interface CrudService<T extends { id: Uuid }, TInput> {
  list(query?: ListQuery): Promise<Page<T>>
  get(id: Uuid): Promise<T | null>
  create(input: TInput, context: WriteContext): Promise<T>
  update(id: Uuid, input: Partial<TInput>, context: WriteContext): Promise<T>
  softDelete(id: Uuid, context: WriteContext): Promise<void>
}
export interface CustomerService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface CustomerAddressService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface CustomerContactService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface VendorService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface VendorContactService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface EmployeeService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface UserService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface ProjectService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface QuoteService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface QuoteLineService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface CustomerOrderService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface CustomerOrderLineService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface PurchaseOrderService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface PurchaseOrderLineService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface NonPoPurchaseService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface InventoryService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface ReceiptService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface KitService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface ShipmentService<T, I> extends CrudService<T & { id: Uuid }, I> {}
export interface DocumentService<T, I> extends CrudService<T & { id: Uuid }, I> {
  getDownloadUrl(id: Uuid): Promise<string>
}
export interface AuditEventService<T> {
  listForEntity(entityType: string, entityId: Uuid, query?: ListQuery): Promise<Page<T>>
  append(event: Omit<T, 'id'>, context: WriteContext): Promise<T>
}
