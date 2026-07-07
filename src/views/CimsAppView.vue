<template>
  <div class="cims-app">
    <aside class="cims-sidebar">
      <div class="cims-brand">
        <span>CIMS</span>
        <strong>Cronos Inventory Management System</strong>
      </div>
      <nav class="cims-nav" aria-label="CIMS sections">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <component :is="section.icon" :size="18" aria-hidden="true" />
          {{ section.label }}
        </button>
      </nav>
      <div class="cims-user-panel">
        <label>
          <span>Warehouse</span>
          <select v-model="selectedWarehouseId">
            <option v-for="warehouse in warehouseRows" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
        </label>
        <label>
          <span>Role</span>
          <select v-model="selectedRole">
            <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
      </div>
    </aside>

    <main class="cims-main">
      <header class="cims-topbar">
        <div>
          <p>Standalone warehouse platform</p>
          <h1>{{ currentSection?.label ?? 'Dashboard' }}</h1>
        </div>
        <div class="cims-topbar-actions">
          <span class="sync-pill" :class="syncClass(overallSyncStatus)">
            <RefreshCw :size="15" aria-hidden="true" />
            {{ overallSyncStatus }}
          </span>
          <button type="button" class="secondary-button" @click="manualResync">
            <RefreshCw :size="16" aria-hidden="true" />
            Manual re-sync
          </button>
          <button type="button" class="primary-button" @click="activeSection = 'receiving'">
            <PackageCheck :size="16" aria-hidden="true" />
            Receive
          </button>
        </div>
      </header>

      <section v-if="activeSection === 'dashboard'" class="cims-section">
        <div class="metric-grid">
          <article v-for="metric in dashboardMetrics" :key="metric.label" class="metric-card">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.detail }}</small>
          </article>
        </div>

        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Inventory by warehouse</h2>
              <span>{{ totalAvailable }} available units</span>
            </div>
            <div class="warehouse-stack">
              <article v-for="warehouse in warehouseRows" :key="warehouse.id" class="warehouse-row">
                <div>
                  <strong>{{ warehouse.name }}</strong>
                  <small>{{ warehouse.manager }} / {{ warehouse.users }} users</small>
                </div>
                <div class="warehouse-bar">
                  <i :style="{ width: `${warehouse.availablePercent}%` }"></i>
                </div>
                <b>{{ warehouse.available }}</b>
              </article>
            </div>
          </section>

          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Inventory by project</h2>
              <span>Atlas allocations</span>
            </div>
            <div class="project-stack">
              <article v-for="project in projectRows" :key="project.externalId" class="project-row">
                <div>
                  <strong>{{ project.projectNumber }} / {{ project.projectName }}</strong>
                  <small>{{ project.customer }} / {{ project.openBalance }} open</small>
                </div>
                <span class="status-badge neutral">{{ project.received }} received</span>
              </article>
            </div>
          </section>
        </div>

        <section class="cims-panel">
          <div class="panel-heading">
            <h2>Warehouse audit trail</h2>
            <span>Every inventory action is logged</span>
          </div>
          <div class="table-scroll">
            <table class="cims-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Old value</th>
                  <th>New value</th>
                  <th>PO</th>
                  <th>Project</th>
                  <th>Warehouse</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in auditLogRows" :key="log.id">
                  <td>{{ log.user }}<small>{{ formatDateTime(log.timestamp) }}</small></td>
                  <td>{{ log.action }}</td>
                  <td>{{ log.oldValue }}</td>
                  <td>{{ log.newValue }}</td>
                  <td>{{ log.poNumber }}</td>
                  <td>{{ log.projectNumber }}</td>
                  <td>{{ warehouseName(log.warehouseId) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="activeSection === 'receiving'" class="cims-section">
        <section class="cims-panel scanner-panel">
          <div class="panel-heading">
            <h2>Inbound item scanning</h2>
            <span>USB, Bluetooth, or camera</span>
          </div>
          <div class="scanner-grid">
            <form class="scanner-input" @submit.prevent="processScan">
              <label>
                <Barcode :size="18" aria-hidden="true" />
                <input v-model="scannerValue" type="search" autocomplete="off" placeholder="Scan UPC, manufacturer barcode, serial, asset tag, PO line, vendor barcode..." />
              </label>
              <button type="submit" class="primary-button">
                <ScanLine :size="16" aria-hidden="true" />
                Match scan
              </button>
              <button type="button" class="secondary-button" @click="toggleCameraScanner">
                <Camera :size="16" aria-hidden="true" />
                {{ cameraActive ? 'Stop camera' : 'Camera scan' }}
              </button>
            </form>
            <div v-if="cameraActive || cameraError" class="camera-scan-box">
              <video ref="cameraVideo" autoplay muted playsinline></video>
              <button type="button" class="table-button" @click="mockCameraScan">Use detected sample</button>
              <small>{{ cameraError || 'Camera stream is active. Browser BarcodeDetector support is used when available.' }}</small>
            </div>
            <p v-if="scannerMessage" class="form-message">{{ scannerMessage }}</p>
            <div v-if="scanMatches.length > 1" class="match-selection">
              <article v-for="match in scanMatches" :key="`${match.type}-${match.label}`" class="match-card">
                <div>
                  <strong>{{ match.label }}</strong>
                  <small>{{ match.detail }}</small>
                </div>
                <button type="button" class="table-button" @click="selectScanMatch(match)">Open match</button>
              </article>
            </div>
          </div>
        </section>

        <div class="filter-bar">
          <label>
            <Search :size="16" aria-hidden="true" />
            <input v-model="queueSearch" type="search" placeholder="Filter by PO, project, vendor, part..." />
          </label>
          <select v-model="selectedWarehouseId">
            <option v-for="warehouse in warehouseRows" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
          <input v-model="expectedBefore" type="date" />
        </div>

        <div class="cims-grid receiving-layout">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Receiving queue</h2>
              <span>{{ receivingRows.length }} open PO lines</span>
            </div>
            <div class="table-scroll">
              <table class="cims-table">
                <thead>
                  <tr>
                    <th>PO / Vendor</th>
                    <th>Project</th>
                    <th>Line item</th>
                    <th>Open qty</th>
                    <th>Due</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in receivingRows" :key="row.line.externalId">
                    <td>
                      <strong>{{ row.po.poNumber }}</strong>
                      <small>{{ row.vendor.name }}</small>
                    </td>
                    <td>
                      {{ row.project.projectNumber }}
                      <small>{{ row.project.projectName }}</small>
                    </td>
                    <td>
                      {{ row.line.manufacturer }} {{ row.line.partNumber }}
                      <small>{{ row.line.description }}</small>
                    </td>
                    <td>{{ openQuantity(row.line) }}</td>
                    <td>{{ row.line.requiredDeliveryDate }}</td>
                    <td>
                      <button type="button" class="table-button" @click="selectReceivingLine(row.po.externalId, row.line.externalId)">
                        Receive
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="cims-panel receive-panel">
            <div class="panel-heading">
              <h2>Receive items</h2>
              <span v-if="selectedReceiving">{{ selectedReceiving.po.poNumber }}</span>
            </div>
            <div v-if="selectedReceiving" class="receive-form">
              <div class="po-summary">
                <strong>{{ selectedReceiving.project.projectNumber }} / {{ selectedReceiving.project.projectName }}</strong>
                <small>{{ selectedReceiving.vendor.name }} / {{ selectedReceiving.line.partNumber }}</small>
              </div>
              <div class="receive-actions">
                <button type="button" class="primary-button large" @click="receiveQuantity = openQuantity(selectedReceiving.line)">
                  <PackageCheck :size="18" aria-hidden="true" />
                  Full open qty
                </button>
                <label>
                  <span>Partial quantity</span>
                  <input v-model.number="receiveQuantity" type="number" min="1" :max="openQuantity(selectedReceiving.line)" />
                </label>
              </div>
              <label>
                <span>Rack/bin location</span>
                <select v-model="receiveLocationId">
                  <option v-for="location in selectedWarehouseLocations" :key="location.id" :value="location.id">
                    {{ location.id }}
                  </option>
                </select>
              </label>
              <label>
                <span>Pallet ID</span>
                <input v-model="receivePalletId" placeholder="PAL-LEX-20260707-0001" />
              </label>
              <div class="receiving-pallet-tools">
                <label class="check-row">
                  <input v-model="createPalletDuringReceiving" type="checkbox" />
                  <span>Create/select pallet during receipt</span>
                </label>
                <label class="check-row">
                  <input v-model="mixedProjectApproved" type="checkbox" />
                  <span>Manager approved mixed-project pallet</span>
                </label>
                <button type="button" class="secondary-button" @click="generateReceivingPallet">
                  <QrCode :size="16" aria-hidden="true" />
                  Generate pallet barcode
                </button>
                <button type="button" class="secondary-button" @click="printReceivingPalletLabel">
                  <Printer :size="16" aria-hidden="true" />
                  Print pallet label
                </button>
              </div>
              <label>
                <span>Scanned barcode value</span>
                <input v-model="scannerValue" placeholder="Stored on inventory record for traceability" />
              </label>
              <label>
                <span>Serial numbers</span>
                <textarea v-model="receiveSerials" placeholder="One serial number per line"></textarea>
              </label>
              <label>
                <span>Asset tags</span>
                <textarea v-model="receiveAssetTags" placeholder="One asset tag per line"></textarea>
              </label>
              <label>
                <span>Condition</span>
                <select v-model="receiveCondition">
                  <option>New</option>
                  <option>Open Box</option>
                  <option>Damaged</option>
                </select>
              </label>
              <label>
                <span>Notes</span>
                <textarea v-model="receiveNotes" placeholder="Packing slip, photos, variance notes"></textarea>
              </label>
              <p v-if="receiveMessage" class="form-message">{{ receiveMessage }}</p>
              <button type="button" class="primary-button" @click="receiveSelectedLine">
                <Send :size="16" aria-hidden="true" />
                Post receipt and sync Atlas
              </button>
            </div>
            <div v-else class="empty-state">
              <PackageOpen :size="34" aria-hidden="true" />
              <p>Select an open PO line to receive material.</p>
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="activeSection === 'inventory'" class="cims-section">
        <div class="filter-bar">
          <label>
            <ScanLine :size="16" aria-hidden="true" />
            <input v-model="inventorySearch" type="search" placeholder="Search PO, project, part, serial, asset tag, pallet, bin..." />
          </label>
          <select v-model="selectedWarehouseId">
            <option v-for="warehouse in warehouseRows" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
        </div>
        <section class="cims-panel">
          <div class="panel-heading">
            <h2>Inventory search</h2>
            <span>Barcode and QR lookup ready</span>
          </div>
          <div class="inventory-card-grid">
            <article v-for="item in filteredInventory" :key="item.id" class="inventory-card">
              <div>
                <strong>{{ item.partNumber }}</strong>
                <span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span>
              </div>
              <p>{{ item.description }}</p>
              <dl>
                <div><dt>PO</dt><dd>{{ item.poNumber }}</dd></div>
                <div><dt>Project</dt><dd>{{ projectById(item.projectExternalId)?.projectNumber }}</dd></div>
                <div><dt>Warehouse</dt><dd>{{ warehouseName(item.warehouseId) }}</dd></div>
                <div><dt>Bin</dt><dd>{{ item.locationId }}</dd></div>
                <div><dt>Pallet</dt><dd>{{ item.palletId ?? 'Not palletized' }}</dd></div>
                <div><dt>Available</dt><dd>{{ item.availableQuantity }} / {{ item.quantity }}</dd></div>
              </dl>
              <div class="barcode-row">
                <QrCode :size="18" aria-hidden="true" />
                <code>{{ item.scannedBarcodes[0] ?? item.assetTags[0] ?? item.serialNumbers[0] ?? item.palletId }}</code>
              </div>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="activeSection === 'barcodes'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel scanner-panel">
            <div class="panel-heading">
              <h2>Scan lookup</h2>
              <span>PO, UPC, serial, asset, pallet, kit, bin</span>
            </div>
            <div class="scanner-grid">
              <form class="scanner-input" @submit.prevent="processScan">
                <label>
                  <ScanLine :size="18" aria-hidden="true" />
                  <input v-model="scannerValue" type="search" autocomplete="off" placeholder="Scan or type barcode value" />
                </label>
                <button type="submit" class="primary-button">Lookup</button>
              </form>
              <p v-if="scannerMessage" class="form-message">{{ scannerMessage }}</p>
              <div v-if="scanMatches.length" class="match-selection">
                <article v-for="match in scanMatches" :key="`${match.type}-${match.label}`" class="match-card">
                  <div>
                    <strong>{{ match.label }}</strong>
                    <small>{{ match.detail }}</small>
                  </div>
                  <button type="button" class="table-button" @click="selectScanMatch(match)">Open</button>
                </article>
              </div>
            </div>
          </section>

          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Create pallet barcode</h2>
              <span>{{ selectedWarehouseId }} sequence</span>
            </div>
            <div class="receive-form">
              <label>
                <span>Pallet ID</span>
                <input v-model="receivePalletId" />
              </label>
              <label>
                <span>Rack/bin location</span>
                <select v-model="receiveLocationId">
                  <option v-for="location in selectedWarehouseLocations" :key="location.id" :value="location.id">{{ location.id }}</option>
                </select>
              </label>
              <button type="button" class="primary-button" @click="generateReceivingPallet">
                <QrCode :size="16" aria-hidden="true" />
                Generate unique pallet ID
              </button>
            </div>
          </section>
        </div>

        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Pallet contents</h2>
              <span>{{ selectedPallet?.palletId ?? 'No pallet selected' }}</span>
            </div>
            <div v-if="selectedPallet" class="pallet-detail">
              <div class="label-preview" :class="labelClass(selectedPallet.labelSize)">
                <div class="label-barcode">
                  <QrCode :size="64" aria-hidden="true" />
                  <code>{{ selectedPallet.barcodeValue }}</code>
                </div>
                <strong>{{ selectedPallet.palletId }}</strong>
                <span>{{ warehouseName(selectedPallet.warehouseId) }} / {{ selectedPallet.locationId }}</span>
                <span>{{ projectById(selectedPallet.projectExternalId).projectNumber }} / {{ projectById(selectedPallet.projectExternalId).projectName }}</span>
                <span>{{ selectedPallet.poNumbers.join(', ') }} / {{ selectedPallet.dateCreated }} / {{ selectedPallet.createdBy }}</span>
              </div>
              <div class="inventory-card-grid compact">
                <article v-for="item in selectedPalletItems" :key="item.id" class="inventory-card">
                  <div>
                    <strong>{{ item.partNumber }}</strong>
                    <span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span>
                  </div>
                  <p>{{ item.description }}</p>
                  <div class="barcode-row">
                    <Barcode :size="18" aria-hidden="true" />
                    <code>{{ item.scannedBarcodes[0] ?? item.assetTags[0] ?? item.serialNumbers[0] }}</code>
                  </div>
                </article>
              </div>
            </div>
            <div v-else class="empty-state">
              <QrCode :size="34" aria-hidden="true" />
              <p>Scan or select a pallet barcode to view contents.</p>
            </div>
          </section>

          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Label printing</h2>
              <span>Thermal label formats</span>
            </div>
            <div class="receive-form">
              <label>
                <span>Label type</span>
                <select v-model="labelKind">
                  <option>Pallet label</option>
                  <option>Kit label</option>
                  <option>Asset tag label</option>
                  <option>Rack/bin location label</option>
                </select>
              </label>
              <label>
                <span>Label size</span>
                <select v-model="labelSize">
                  <option>4x6 shipping label</option>
                  <option>2x1 asset label</option>
                  <option>3x2 pallet/bin label</option>
                </select>
              </label>
              <label>
                <span>Label target</span>
                <select v-model="labelTarget">
                  <option v-for="pallet in palletRows" :key="pallet.palletId" :value="pallet.palletId">{{ pallet.palletId }}</option>
                  <option v-for="kit in kitRows" :key="kit.kitNumber" :value="kit.kitNumber">{{ kit.kitNumber }}</option>
                  <option v-for="location in locationRows" :key="location.barcode" :value="location.barcode">{{ location.barcode }}</option>
                  <option v-for="item in inventoryRows" :key="item.id" :value="item.assetTags[0] ?? item.id">{{ item.assetTags[0] ?? item.id }}</option>
                </select>
              </label>
              <button type="button" class="primary-button" @click="printLabel(labelKind, labelTarget, labelSize, true)">
                <Printer :size="16" aria-hidden="true" />
                Print / reprint label
              </button>
            </div>
            <div class="label-size-grid">
              <article><strong>4x6</strong><small>Shipping and full pallet label</small></article>
              <article><strong>2x1</strong><small>Asset tag and serial label</small></article>
              <article><strong>3x2</strong><small>Pallet, kit, and bin label</small></article>
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="activeSection === 'projects'" class="cims-section">
        <div class="project-tabs">
          <button
            v-for="project in projectRows"
            :key="project.externalId"
            type="button"
            :class="{ active: selectedProjectId === project.externalId }"
            @click="selectedProjectId = project.externalId"
          >
            {{ project.projectNumber }}
          </button>
        </div>
        <section class="cims-panel">
          <div class="panel-heading">
            <h2>{{ selectedProject?.projectName }}</h2>
            <span>{{ selectedProject?.customer }}</span>
          </div>
          <div class="table-scroll">
            <table class="cims-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Open</th>
                  <th>Warehouse</th>
                  <th>Kitting</th>
                  <th>Shipping</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selectedProjectMaterial" :key="row.line.externalId">
                  <td>{{ row.line.manufacturer }} {{ row.line.partNumber }}<small>{{ row.po.poNumber }}</small></td>
                  <td>{{ row.line.quantityOrdered }}</td>
                  <td>{{ row.line.quantityReceived }}</td>
                  <td>{{ openQuantity(row.line) }}</td>
                  <td>{{ warehouseName(row.po.warehouseId) }}</td>
                  <td><span class="status-badge" :class="statusClass(row.kitStatus)">{{ row.kitStatus }}</span></td>
                  <td>{{ row.shipment?.trackingNumber ?? 'Not shipped' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="activeSection === 'kitting'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Create kit by project</h2>
              <span>Attach photos and packing list</span>
            </div>
            <div class="receive-form">
              <label>
                <span>Project</span>
                <select v-model="kitProjectId">
                  <option v-for="project in projectRows" :key="project.externalId" :value="project.externalId">
                    {{ project.projectNumber }} / {{ project.projectName }}
                  </option>
                </select>
              </label>
              <label>
                <span>Kit number</span>
                <input v-model="kitNumber" />
              </label>
              <label>
                <span>Pallet/container</span>
                <input v-model="kitPalletId" />
              </label>
              <button type="button" class="primary-button" @click="createKit">
                <PackagePlus :size="16" aria-hidden="true" />
                Mark kit complete
              </button>
            </div>
          </section>
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Kits</h2>
              <span>{{ kitRows.length }} active</span>
            </div>
            <div class="record-stack">
              <article v-for="kit in kitRows" :key="kit.id" class="record-card">
                <strong>{{ kit.kitNumber }}</strong>
                <small>{{ projectById(kit.projectExternalId)?.projectNumber }} / {{ kit.palletId }}</small>
                <span class="status-badge" :class="statusClass(kit.status)">{{ kit.status }}</span>
              </article>
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="activeSection === 'shipping'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Create shipment</h2>
              <span>Syncs status back to Atlas</span>
            </div>
            <div class="receive-form">
              <label><span>Project</span><select v-model="shipProjectId"><option v-for="project in projectRows" :key="project.externalId" :value="project.externalId">{{ project.projectNumber }}</option></select></label>
              <label><span>Carrier</span><input v-model="shipCarrier" /></label>
              <label><span>Tracking number</span><input v-model="shipTracking" /></label>
              <label><span>Destination</span><input v-model="shipDestination" /></label>
              <button type="button" class="primary-button" @click="createShipment"><Truck :size="16" aria-hidden="true" /> Mark shipped</button>
            </div>
          </section>
          <RecordPanel title="Shipments" :records="shipmentRecords" />
        </div>
      </section>

      <section v-else-if="activeSection === 'transfers'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Transfer inventory</h2>
              <span>Company inventory total is preserved</span>
            </div>
            <div class="receive-form">
              <label><span>Item</span><select v-model="transferItemId"><option v-for="item in inventoryRows" :key="item.id" :value="item.id">{{ item.partNumber }} / {{ item.poNumber }}</option></select></label>
              <label><span>To warehouse</span><select v-model="transferToWarehouseId"><option v-for="warehouse in warehouseRows" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option></select></label>
              <label><span>Quantity</span><input v-model.number="transferQuantity" type="number" min="1" /></label>
              <button type="button" class="primary-button" @click="createTransfer"><ArrowRightLeft :size="16" aria-hidden="true" /> Request transfer</button>
            </div>
          </section>
          <RecordPanel title="Transfer queue" :records="transferRecords" />
        </div>
      </section>

      <section v-else-if="activeSection === 'rmas'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Create RMA</h2>
              <span>Damaged inventory excluded from availability</span>
            </div>
            <div class="receive-form">
              <label><span>Damaged item</span><select v-model="rmaItemId"><option v-for="item in damagedInventory" :key="item.id" :value="item.id">{{ item.partNumber }} / {{ item.poNumber }}</option></select></label>
              <label><span>Reason</span><textarea v-model="rmaReason"></textarea></label>
              <label><span>Vendor RMA number</span><input v-model="rmaVendorNumber" /></label>
              <button type="button" class="primary-button" @click="createRma"><Undo2 :size="16" aria-hidden="true" /> Create RMA</button>
            </div>
          </section>
          <RecordPanel title="RMAs" :records="rmaRecords" />
        </div>
      </section>

      <section v-else-if="activeSection === 'admin'" class="cims-section">
        <div class="cims-grid two-columns">
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Warehouse locations</h2>
              <span>Rack/bin management</span>
            </div>
            <div class="location-grid">
              <article v-for="location in locationRows" :key="location.id" class="location-card">
                <strong>{{ location.id }}</strong>
                <small>{{ warehouseName(location.warehouseId) }} / {{ location.barcode }}</small>
                <meter min="0" max="100" :value="location.capacityUsed"></meter>
              </article>
            </div>
          </section>
          <section class="cims-panel">
            <div class="panel-heading">
              <h2>Roles and permissions</h2>
              <span>{{ selectedRole }}</span>
            </div>
            <div class="permission-grid">
              <article v-for="permission in permissionRows" :key="permission.name" class="permission-card">
                <component :is="permission.enabled ? CheckCircle2 : Circle" :size="18" aria-hidden="true" />
                <span>{{ permission.name }}</span>
              </article>
            </div>
          </section>
        </div>
        <section class="cims-panel">
          <div class="panel-heading">
            <h2>Integration sync logs</h2>
            <span>Retry and manual re-sync queue</span>
          </div>
          <div class="table-scroll">
            <table class="cims-table">
              <thead><tr><th>Direction</th><th>Entity</th><th>External ID</th><th>Status</th><th>Attempts</th><th>Message</th></tr></thead>
              <tbody>
                <tr v-for="log in syncLogRows" :key="log.id">
                  <td>{{ log.direction }}<small>{{ formatDateTime(log.lastAttemptAt) }}</small></td>
                  <td>{{ log.entity }}</td>
                  <td>{{ log.externalId }}</td>
                  <td><span class="sync-pill" :class="syncClass(log.status)">{{ log.status }}</span></td>
                  <td>{{ log.attempts }}</td>
                  <td>{{ log.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="activeSection === 'reports'" class="cims-section">
        <div class="report-grid">
          <article v-for="report in reports" :key="report.name" class="report-card">
            <component :is="report.icon" :size="20" aria-hidden="true" />
            <strong>{{ report.name }}</strong>
            <small>{{ report.description }}</small>
            <button type="button" class="table-button">Open report</button>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref } from 'vue'
import {
  ArrowRightLeft,
  BarChart3,
  Barcode,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileBarChart,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ScanLine,
  Settings,
  Truck,
  Undo2,
  Warehouse,
  X,
} from '@lucide/vue'
import {
  auditLogs,
  inventoryItems,
  kits,
  pallets,
  projects,
  purchaseOrders,
  rackLocations,
  rmas,
  shipments,
  syncLogs,
  transfers,
  vendors,
  warehouses,
} from '../cims/data/seed'
import type {
  AuditLog,
  CimsRole,
  InventoryItem,
  InventoryStatus,
  LabelSize,
  Pallet,
  PurchaseOrderLine,
  Shipment,
  SyncLog,
  Transfer,
  WarehouseCode,
} from '../cims/types'

type SectionId = 'dashboard' | 'receiving' | 'inventory' | 'barcodes' | 'projects' | 'kitting' | 'shipping' | 'transfers' | 'rmas' | 'admin' | 'reports'
type BarcodeMatch =
  | { type: 'po-line'; label: string; detail: string; poExternalId: string; lineExternalId: string; warehouseId: WarehouseCode }
  | { type: 'inventory'; label: string; detail: string; itemId: string; warehouseId: WarehouseCode }
  | { type: 'pallet'; label: string; detail: string; palletId: string; warehouseId: WarehouseCode }
  | { type: 'location'; label: string; detail: string; locationId: string; warehouseId: WarehouseCode }

const RecordPanel = defineComponent({
  props: {
    title: { type: String, required: true },
    records: { type: Array as () => Array<{ title: string; detail: string; status: string }>, required: true },
  },
  setup(props) {
    return () =>
      h('section', { class: 'cims-panel' }, [
        h('div', { class: 'panel-heading' }, [h('h2', props.title), h('span', `${props.records.length} records`)]),
        h(
          'div',
          { class: 'record-stack' },
          props.records.map(record =>
            h('article', { class: 'record-card', key: record.title }, [
              h('strong', record.title),
              h('small', record.detail),
              h('span', { class: `status-badge ${statusClass(record.status)}` }, record.status),
            ]),
          ),
        ),
      ])
  },
})

const sections: Array<{ id: SectionId; label: string; icon: unknown }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'receiving', label: 'Receiving Queue', icon: PackageCheck },
  { id: 'inventory', label: 'Inventory Search', icon: ScanLine },
  { id: 'barcodes', label: 'Barcodes & Labels', icon: Barcode },
  { id: 'projects', label: 'Project Inventory', icon: ClipboardList },
  { id: 'kitting', label: 'Kitting', icon: PackagePlus },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
  { id: 'rmas', label: 'RMA', icon: Undo2 },
  { id: 'admin', label: 'Admin', icon: Settings },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
]

const roles: CimsRole[] = ['Admin', 'Warehouse Manager', 'Warehouse Receiver', 'Procurement User', 'Project Manager', 'Executive Viewer', 'Read Only']
const activeSection = ref<SectionId>('dashboard')
const selectedWarehouseId = ref<WarehouseCode>('LEX')
const selectedRole = ref<CimsRole>('Warehouse Manager')
const queueSearch = ref('')
const expectedBefore = ref('')
const inventorySearch = ref('')
const scannerValue = ref('')
const scannerMessage = ref('')
const scanMatches = ref<BarcodeMatch[]>([])
const cameraActive = ref(false)
const cameraError = ref('')
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const selectedPoExternalId = ref(purchaseOrders[0].externalId)
const selectedLineExternalId = ref(purchaseOrders[0].lines[0].externalId)
const receiveQuantity = ref(1)
const receiveLocationId = ref('LEX-A1-B04')
const receivePalletId = ref('PAL-LEX-20260707-0001')
const createPalletDuringReceiving = ref(true)
const mixedProjectApproved = ref(false)
const receiveSerials = ref('')
const receiveAssetTags = ref('')
const receiveCondition = ref<'New' | 'Damaged' | 'Open Box'>('New')
const receiveNotes = ref('')
const receiveMessage = ref('')
const selectedProjectId = ref(projects[0].externalId)
const kitProjectId = ref(projects[0].externalId)
const kitNumber = ref('KIT-25-4107-002')
const kitPalletId = ref('PAL-LEX-00042')
const shipProjectId = ref(projects[0].externalId)
const shipCarrier = ref('FedEx Freight')
const shipTracking = ref('FXF')
const shipDestination = ref('Customer site')
const transferItemId = ref(inventoryItems[0].id)
const transferToWarehouseId = ref<WarehouseCode>('VB')
const transferQuantity = ref(1)
const rmaItemId = ref(inventoryItems.find(item => item.status === 'Damaged')?.id ?? inventoryItems[0].id)
const rmaReason = ref('Material failed receiving inspection')
const rmaVendorNumber = ref('RMA-PENDING')
const selectedPalletId = ref(pallets[0].palletId)
const labelKind = ref<'Pallet label' | 'Kit label' | 'Asset tag label' | 'Rack/bin location label'>('Pallet label')
const labelSize = ref<LabelSize>('3x2 pallet/bin label')
const labelTarget = ref(pallets[0].palletId)

const poRows = ref(clone(purchaseOrders))
const inventoryRows = ref(clone(inventoryItems))
const palletRows = ref(clone(pallets))
const kitRows = ref(clone(kits))
const shipmentRows = ref(clone(shipments))
const transferRows = ref(clone(transfers))
const rmaRows = ref(clone(rmas))
const auditLogRows = ref(clone(auditLogs))
const syncLogRows = ref(clone(syncLogs))
const locationRows = ref(clone(rackLocations))

const currentSection = computed(() => sections.find(section => section.id === activeSection.value))
const warehouseRows = computed(() =>
  warehouses.map(warehouse => {
    const available = inventoryRows.value.filter(item => item.warehouseId === warehouse.id).reduce((sum, item) => sum + item.availableQuantity, 0)
    const availablePercent = totalAvailable.value ? Math.round((available / totalAvailable.value) * 100) : 0
    return { ...warehouse, available, availablePercent }
  }),
)
const totalAvailable = computed(() => inventoryRows.value.reduce((sum, item) => sum + item.availableQuantity, 0))
const selectedWarehouseLocations = computed(() => locationRows.value.filter(location => location.warehouseId === selectedWarehouseId.value))
const selectedProject = computed(() => projectById(selectedProjectId.value))
const selectedPallet = computed(() => palletRows.value.find(pallet => pallet.palletId === selectedPalletId.value || pallet.barcodeValue === selectedPalletId.value))
const selectedPalletItems = computed(() => {
  if (!selectedPallet.value) return []
  return inventoryRows.value.filter(item => item.palletId === selectedPallet.value?.palletId)
})
const overallSyncStatus = computed(() => (syncLogRows.value.some(log => log.status === 'Failed') ? 'Failed' : syncLogRows.value.some(log => log.status !== 'Synced') ? 'Pending' : 'Synced'))

const dashboardMetrics = computed(() => [
  { label: 'Total open POs', value: poRows.value.filter(po => po.status !== 'Closed' && po.status !== 'Received').length, detail: 'Synced from Atlas' },
  { label: 'Items expected', value: poRows.value.flatMap(po => po.lines).reduce((sum, line) => sum + openQuantity(line), 0), detail: 'Open PO balance' },
  { label: 'Received today', value: inventoryRows.value.filter(item => item.receivedAt === '2026-07-06').reduce((sum, item) => sum + item.quantity, 0), detail: 'Warehouse receipts' },
  { label: 'Partial receipts', value: poRows.value.filter(po => po.status === 'Partially Received').length, detail: 'Needs follow-up' },
  { label: 'Ready for kitting', value: inventoryRows.value.filter(item => item.status === 'Allocated to Project').length, detail: 'Allocated material' },
  { label: 'Ready to ship', value: inventoryRows.value.filter(item => item.status === 'Ready to Ship').length, detail: 'Shipment queue' },
  { label: 'On RMA', value: rmaRows.value.length, detail: 'Vendor returns' },
  { label: 'Sync exceptions', value: syncLogRows.value.filter(log => log.status !== 'Synced').length, detail: 'Pending review' },
])

const projectRows = computed(() =>
  projects.map(project => {
    const lines = poRows.value.filter(po => po.projectExternalId === project.externalId).flatMap(po => po.lines)
    return {
      ...project,
      ordered: lines.reduce((sum, line) => sum + line.quantityOrdered, 0),
      received: lines.reduce((sum, line) => sum + line.quantityReceived, 0),
      openBalance: lines.reduce((sum, line) => sum + openQuantity(line), 0),
    }
  }),
)

const receivingRows = computed(() => {
  const query = queueSearch.value.trim().toLowerCase()
  return poRows.value
    .filter(po => po.warehouseId === selectedWarehouseId.value)
    .flatMap(po => {
      const project = projectById(po.projectExternalId)
      const vendor = vendorById(po.vendorExternalId)
      return po.lines.map(line => ({ po, project, vendor, line }))
    })
    .filter(row => openQuantity(row.line) > 0)
    .filter(row => !expectedBefore.value || row.line.requiredDeliveryDate <= expectedBefore.value)
    .filter(row => {
      if (!query) return true
      return [row.po.poNumber, row.project?.projectNumber, row.project?.projectName, row.vendor?.name, row.line.partNumber, row.line.manufacturer]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    })
})

const selectedReceiving = computed(() => {
  const po = poRows.value.find(item => item.externalId === selectedPoExternalId.value)
  const line = po?.lines.find(item => item.externalId === selectedLineExternalId.value)
  if (!po || !line) return undefined
  return { po, line, project: projectById(po.projectExternalId), vendor: vendorById(po.vendorExternalId) }
})

const filteredInventory = computed(() => {
  const query = inventorySearch.value.trim().toLowerCase()
  return inventoryRows.value
    .filter(item => item.warehouseId === selectedWarehouseId.value)
    .filter(item => {
      if (!query) return true
      const project = projectById(item.projectExternalId)
      return [
        item.poNumber,
        project?.projectNumber,
        project?.projectName,
        item.partNumber,
        item.manufacturer,
        ...item.scannedBarcodes,
        item.palletId,
        item.locationId,
        ...item.serialNumbers,
        ...item.assetTags,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    })
})

const selectedProjectMaterial = computed(() =>
  poRows.value
    .filter(po => po.projectExternalId === selectedProjectId.value)
    .flatMap(po =>
      po.lines.map(line => ({
        po,
        line,
        kitStatus: kitRows.value.some(kit => kit.projectExternalId === po.projectExternalId) ? 'Kitted' : 'Pending Kitting',
        shipment: shipmentRows.value.find(shipment => shipment.projectExternalId === po.projectExternalId),
      })),
    ),
)

const damagedInventory = computed(() => inventoryRows.value.filter(item => item.status === 'Damaged'))
const shipmentRecords = computed(() => shipmentRows.value.map(item => ({ title: item.trackingNumber, detail: `${projectById(item.projectExternalId)?.projectNumber} / ${item.carrier}`, status: item.status })))
const transferRecords = computed(() => transferRows.value.map(item => ({ title: `${warehouseName(item.fromWarehouseId)} to ${warehouseName(item.toWarehouseId)}`, detail: `${item.quantity} units / ${item.custodian}`, status: item.status })))
const rmaRecords = computed(() => rmaRows.value.map(item => ({ title: item.vendorRmaNumber, detail: item.reason, status: item.status })))
const permissionRows = computed(() => {
  const role = selectedRole.value
  const allowed = {
    Admin: ['Receiving', 'Editing inventory', 'Moving inventory', 'Shipping', 'RMA creation', 'Admin settings', 'Cost visibility', 'Project visibility'],
    'Warehouse Manager': ['Receiving', 'Editing inventory', 'Moving inventory', 'Shipping', 'RMA creation', 'Project visibility'],
    'Warehouse Receiver': ['Receiving', 'Project visibility'],
    'Procurement User': ['Cost visibility', 'Project visibility'],
    'Project Manager': ['Project visibility'],
    'Executive Viewer': ['Cost visibility', 'Project visibility'],
    'Read Only': ['Project visibility'],
  } satisfies Record<CimsRole, string[]>
  return ['Receiving', 'Editing inventory', 'Moving inventory', 'Shipping', 'RMA creation', 'Admin settings', 'Cost visibility', 'Project visibility'].map(name => ({
    name,
    enabled: allowed[role].includes(name),
  }))
})

const reports = [
  { name: 'Inventory on hand by warehouse', description: 'Available and damaged quantities by warehouse.', icon: Warehouse },
  { name: 'Inventory on hand by project', description: 'Allocated material by Atlas project.', icon: ClipboardList },
  { name: 'Open PO receiving report', description: 'Open PO lines and expected delivery dates.', icon: PackageOpen },
  { name: 'Partial receipts report', description: 'PO lines received below ordered quantity.', icon: PackageCheck },
  { name: 'Damaged inventory report', description: 'Inventory excluded from availability.', icon: Undo2 },
  { name: 'RMA report', description: 'Vendor returns and replacements.', icon: FileBarChart },
  { name: 'Kitted material report', description: 'Kit contents and packing list status.', icon: PackagePlus },
  { name: 'Shipment report', description: 'Tracking, ship date, destination, delivery status.', icon: Truck },
  { name: 'Inventory aging report', description: 'Received inventory aging by status and warehouse.', icon: BarChart3 },
  { name: 'Audit log report', description: 'User, action, old value, new value, and timestamp.', icon: ClipboardList },
]

onBeforeUnmount(() => stopCameraScanner())

function processScan() {
  const value = scannerValue.value.trim()
  if (!value) {
    scannerMessage.value = 'Scan or enter a barcode value first.'
    return
  }

  const matches = findBarcodeMatches(value)
  scanMatches.value = matches
  appendAudit('Scanned barcode', 'Scanner idle', value, selectedReceiving.value?.po.poNumber ?? 'N/A', selectedReceiving.value?.po.projectExternalId ?? 'stock', selectedWarehouseId.value)

  if (matches.length === 0) {
    queueSearch.value = value
    inventorySearch.value = value
    activeSection.value = 'receiving'
    scannerMessage.value = 'No direct barcode match found. Manual search has been populated with the scanned value.'
    return
  }

  if (matches.length === 1) {
    selectScanMatch(matches[0])
    return
  }

  scannerMessage.value = `${matches.length} matches found. Select the correct record.`
}

function findBarcodeMatches(rawValue: string): BarcodeMatch[] {
  const value = normalizeBarcode(rawValue)
  const poLineMatches = poRows.value.flatMap(po =>
    po.lines
      .filter(line =>
        [line.partNumber, line.upc, line.manufacturerBarcode, line.vendorBarcode, line.externalId, `${po.poNumber}-${line.lineNumber}`]
          .filter(Boolean)
          .some(candidate => normalizeBarcode(candidate) === value),
      )
      .map(line => ({
        type: 'po-line' as const,
        label: `${po.poNumber} / ${line.partNumber}`,
        detail: `${projectById(po.projectExternalId).projectNumber} / ${vendorById(po.vendorExternalId).name} / open ${openQuantity(line)}`,
        poExternalId: po.externalId,
        lineExternalId: line.externalId,
        warehouseId: po.warehouseId,
      })),
  )

  const inventoryMatches = inventoryRows.value
    .filter(item =>
      [item.partNumber, item.poLineExternalId, item.palletId, ...item.scannedBarcodes, ...item.serialNumbers, ...item.assetTags]
        .filter(Boolean)
        .some(candidate => normalizeBarcode(candidate) === value),
    )
    .map(item => ({
      type: 'inventory' as const,
      label: `${item.partNumber} / ${item.poNumber}`,
      detail: `${projectById(item.projectExternalId).projectNumber} / ${item.locationId} / ${item.status}`,
      itemId: item.id,
      warehouseId: item.warehouseId,
    }))

  const palletMatches = palletRows.value
    .filter(pallet => [pallet.palletId, pallet.barcodeValue].some(candidate => normalizeBarcode(candidate) === value))
    .map(pallet => ({
      type: 'pallet' as const,
      label: pallet.palletId,
      detail: `${projectById(pallet.projectExternalId).projectNumber} / ${pallet.locationId} / ${pallet.status}`,
      palletId: pallet.palletId,
      warehouseId: pallet.warehouseId,
    }))

  const locationMatches = locationRows.value
    .filter(location => [location.id, location.barcode].some(candidate => normalizeBarcode(candidate) === value))
    .map(location => ({
      type: 'location' as const,
      label: location.id,
      detail: `${warehouseName(location.warehouseId)} / ${location.barcode}`,
      locationId: location.id,
      warehouseId: location.warehouseId,
    }))

  return [...poLineMatches, ...inventoryMatches, ...palletMatches, ...locationMatches]
}

function selectScanMatch(match: BarcodeMatch) {
  selectedWarehouseId.value = match.warehouseId
  if (match.type === 'po-line') {
    selectReceivingLine(match.poExternalId, match.lineExternalId)
    activeSection.value = 'receiving'
    scannerMessage.value = `Matched expected PO line: ${match.label}.`
    return
  }

  if (match.type === 'inventory') {
    const item = inventoryRows.value.find(row => row.id === match.itemId)
    if (item) {
      inventorySearch.value = item.assetTags[0] ?? item.serialNumbers[0] ?? item.partNumber
      activeSection.value = 'inventory'
      scannerMessage.value = `Opened inventory record: ${match.label}.`
    }
    return
  }

  if (match.type === 'pallet') {
    selectedPalletId.value = match.palletId
    labelTarget.value = match.palletId
    activeSection.value = 'barcodes'
    scannerMessage.value = `Opened pallet contents: ${match.label}.`
    return
  }

  receiveLocationId.value = match.locationId
  activeSection.value = 'receiving'
  scannerMessage.value = `Rack/bin selected: ${match.label}.`
}

async function toggleCameraScanner() {
  if (cameraActive.value) {
    stopCameraScanner()
    return
  }

  cameraError.value = ''
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraError.value = 'Camera scanning is not available in this browser. USB and Bluetooth scanner input still works.'
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    cameraStream.value = stream
    cameraActive.value = true
    requestAnimationFrame(() => {
      if (cameraVideo.value) cameraVideo.value.srcObject = stream
    })
    appendAudit('Started camera scanner', 'Camera off', 'Camera scan active', 'N/A', 'stock', selectedWarehouseId.value)
  } catch {
    cameraError.value = 'Camera permission was blocked or no camera is available. Use the scan input for USB/Bluetooth scanners.'
  }
}

function stopCameraScanner() {
  cameraStream.value?.getTracks().forEach(track => track.stop())
  cameraStream.value = null
  cameraActive.value = false
}

function mockCameraScan() {
  scannerValue.value = selectedReceiving.value?.line.manufacturerBarcode ?? 'CRE-TSW1070BS'
  processScan()
}

function generateReceivingPallet() {
  const selected = selectedReceiving.value
  const projectExternalId = selected?.po.projectExternalId ?? selectedProjectId.value
  const existingProjectIds = inventoryRows.value
    .filter(item => item.palletId === receivePalletId.value)
    .map(item => item.projectExternalId)
    .filter((projectId, index, all) => all.indexOf(projectId) === index)
  if (existingProjectIds.length > 0 && !existingProjectIds.includes(projectExternalId) && !mixedProjectApproved.value) {
    receiveMessage.value = 'Mixed-project pallets require manager approval.'
    return
  }

  const generated = nextPalletId(selectedWarehouseId.value)
  receivePalletId.value = generated
  const pallet = ensurePallet(generated, projectExternalId, selected?.po.poNumber ? [selected.po.poNumber] : [])
  selectedPalletId.value = pallet.palletId
  labelTarget.value = pallet.palletId
  receiveMessage.value = `Generated pallet barcode ${pallet.palletId}.`
  appendAudit('Created pallet barcode', 'No pallet barcode', pallet.palletId, selected?.po.poNumber ?? 'N/A', projectExternalId, selectedWarehouseId.value)
}

function printReceivingPalletLabel() {
  const selected = selectedReceiving.value
  const pallet = ensurePallet(receivePalletId.value || nextPalletId(selectedWarehouseId.value), selected?.po.projectExternalId ?? selectedProjectId.value, selected?.po.poNumber ? [selected.po.poNumber] : [])
  printLabel('Pallet label', pallet.palletId, pallet.labelSize, true)
}

function ensurePallet(palletId: string, projectExternalId: string, poNumbers: string[]) {
  const existing = palletRows.value.find(pallet => pallet.palletId === palletId)
  if (existing) {
    poNumbers.forEach(poNumber => {
      if (!existing.poNumbers.includes(poNumber)) existing.poNumbers.push(poNumber)
    })
    return existing
  }

  const pallet: Pallet = {
    id: `pallet-${Date.now()}`,
    palletId,
    barcodeValue: palletId,
    warehouseId: selectedWarehouseId.value,
    locationId: receiveLocationId.value,
    projectExternalId,
    poNumbers,
    dateCreated: todayStamp(),
    createdBy: 'Current CIMS User',
    labelSize: labelSize.value,
    status: 'Open',
    managerApprovedMixedProject: mixedProjectApproved.value,
  }
  palletRows.value.unshift(pallet)
  return pallet
}

function nextPalletId(warehouseId: WarehouseCode) {
  const date = todayStamp().replaceAll('-', '')
  const prefix = `PAL-${warehouseId}-${date}`
  const next = palletRows.value.filter(pallet => pallet.palletId.startsWith(prefix)).length + 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

function printLabel(kind: string, target: string, size: LabelSize, reprint: boolean) {
  labelKind.value = kind as typeof labelKind.value
  labelTarget.value = target
  labelSize.value = size
  const pallet = palletRows.value.find(row => row.palletId === target)
  if (pallet) {
    selectedPalletId.value = pallet.palletId
    pallet.labelSize = size
  }
  appendAudit(reprint ? 'Reprinted barcode label' : 'Printed barcode label', 'Label queued', `${kind} / ${target} / ${size}`, pallet?.poNumbers[0] ?? 'N/A', pallet?.projectExternalId ?? selectedProjectId.value, pallet?.warehouseId ?? selectedWarehouseId.value)
  window.print()
}

function selectReceivingLine(poExternalId: string, lineExternalId: string) {
  selectedPoExternalId.value = poExternalId
  selectedLineExternalId.value = lineExternalId
  const line = selectedReceiving.value?.line
  receiveQuantity.value = line ? Math.min(openQuantity(line), 1) : 1
  receiveLocationId.value = selectedWarehouseLocations.value[0]?.id ?? ''
  receiveMessage.value = ''
}

function receiveSelectedLine() {
  const selected = selectedReceiving.value
  if (!selected) return
  const open = openQuantity(selected.line)
  if (receiveQuantity.value < 1) {
    receiveMessage.value = 'Quantity must be at least 1.'
    return
  }
  if (receiveQuantity.value > open) {
    receiveMessage.value = 'Over-receiving is blocked unless an admin approves it.'
    return
  }
  if (!receiveLocationId.value) {
    receiveMessage.value = 'Rack/bin location is required.'
    return
  }
  if (createPalletDuringReceiving.value && !receivePalletId.value) {
    receiveMessage.value = 'Create or select a pallet before saving this receipt.'
    return
  }
  const existingProjectIds = inventoryRows.value
    .filter(item => item.palletId === receivePalletId.value)
    .map(item => item.projectExternalId)
    .filter((projectId, index, all) => all.indexOf(projectId) === index)
  if (existingProjectIds.length > 0 && !existingProjectIds.includes(selected.po.projectExternalId) && !mixedProjectApproved.value) {
    receiveMessage.value = 'Mixed-project pallets require manager approval.'
    return
  }

  selected.line.quantityReceived += receiveQuantity.value
  selected.po.status = selected.po.lines.every(line => openQuantity(line) === 0) ? 'Received' : 'Partially Received'
  const condition = receiveCondition.value
  const pallet = createPalletDuringReceiving.value ? ensurePallet(receivePalletId.value, selected.po.projectExternalId, [selected.po.poNumber]) : undefined
  const item: InventoryItem = {
    id: `inv-${Date.now()}`,
    poNumber: selected.po.poNumber,
    poLineExternalId: selected.line.externalId,
    projectExternalId: selected.po.projectExternalId,
    warehouseId: selected.po.warehouseId,
    locationId: receiveLocationId.value,
    palletId: pallet?.palletId ?? (receivePalletId.value || undefined),
    manufacturer: selected.line.manufacturer,
    partNumber: selected.line.partNumber,
    description: selected.line.description,
    quantity: receiveQuantity.value,
    availableQuantity: condition === 'Damaged' ? 0 : receiveQuantity.value,
    status: condition === 'Damaged' ? 'Damaged' : 'On Hand',
    condition,
    scannedBarcodes: splitLines(scannerValue.value),
    serialNumbers: splitLines(receiveSerials.value),
    assetTags: splitLines(receiveAssetTags.value),
    receivedAt: '2026-07-06',
    receiver: 'Current CIMS User',
    syncStatus: 'Pending',
  }
  inventoryRows.value.unshift(item)
  appendAudit('Received inventory', `${selected.line.quantityReceived - receiveQuantity.value} received`, `${selected.line.quantityReceived} received into ${receiveLocationId.value} on ${item.palletId ?? 'no pallet'}`, selected.po.poNumber, selected.po.projectExternalId, selected.po.warehouseId)
  if (scannerValue.value.trim()) appendAudit('Stored scanned barcode', 'No scanned barcode on receipt', scannerValue.value.trim(), selected.po.poNumber, selected.po.projectExternalId, selected.po.warehouseId)
  appendSync('CIMS to Atlas', 'receiving_update', item.id, 'Pending', `Receipt posted. ${receiveNotes.value || 'Awaiting Atlas acknowledgement.'}`)
  receiveMessage.value = 'Receipt posted, inventory updated, and Atlas sync queued.'
}

function createKit() {
  kitRows.value.unshift({
    id: `kit-${Date.now()}`,
    kitNumber: kitNumber.value,
    projectExternalId: kitProjectId.value,
    warehouseId: selectedWarehouseId.value,
    palletId: kitPalletId.value,
    status: 'Kitted',
    itemIds: inventoryRows.value.filter(item => item.projectExternalId === kitProjectId.value).map(item => item.id),
    photoCount: 0,
  })
  appendSync('CIMS to Atlas', 'kitting_status', kitNumber.value, 'Pending', 'Kit completed and packing list ready.')
}

function createShipment() {
  const shipment: Shipment = {
    id: `ship-${Date.now()}`,
    projectExternalId: shipProjectId.value,
    carrier: shipCarrier.value,
    trackingNumber: shipTracking.value,
    shipDate: '2026-07-06',
    destination: shipDestination.value,
    status: 'Shipped',
    syncStatus: 'Pending',
  }
  shipmentRows.value.unshift(shipment)
  inventoryRows.value.filter(item => item.projectExternalId === shipProjectId.value && item.status !== 'Damaged').forEach(item => {
    item.status = 'Shipped'
    item.availableQuantity = 0
  })
  appendSync('CIMS to Atlas', 'shipping_status', shipment.id, 'Pending', 'Shipment status and tracking queued for Atlas.')
}

function createTransfer() {
  const item = inventoryRows.value.find(row => row.id === transferItemId.value)
  if (!item) return
  const transfer: Transfer = {
    id: `xfer-${Date.now()}`,
    itemId: item.id,
    fromWarehouseId: item.warehouseId,
    toWarehouseId: transferToWarehouseId.value,
    quantity: transferQuantity.value,
    transferDate: '2026-07-06',
    status: 'Requested',
    custodian: 'Cronos Logistics',
  }
  transferRows.value.unshift(transfer)
  appendSync('CIMS to Atlas', 'transfer_status', transfer.id, 'Pending', 'Transfer requested. Company inventory total unchanged.')
}

function createRma() {
  const item = inventoryRows.value.find(row => row.id === rmaItemId.value)
  if (!item) return
  item.status = 'RMA Pending'
  rmaRows.value.unshift({
    id: `rma-${Date.now()}`,
    poLineExternalId: item.poLineExternalId,
    itemId: item.id,
    reason: rmaReason.value,
    vendorRmaNumber: rmaVendorNumber.value,
    replacementTracking: 'Pending replacement',
    status: 'RMA Pending',
    syncStatus: 'Pending',
  })
  appendSync('CIMS to Atlas', 'rma_status', item.id, 'Pending', 'RMA created and queued for Atlas update.')
}

function manualResync() {
  syncLogRows.value = syncLogRows.value.map(log => (log.status === 'Synced' ? log : { ...log, status: 'Pending', attempts: log.attempts + 1, lastAttemptAt: new Date().toISOString(), message: 'Manual re-sync queued from CIMS admin.' }))
}

function appendAudit(action: string, oldValue: string, newValue: string, poNumber: string, projectExternalId: string, warehouseId: WarehouseCode) {
  auditLogRows.value.unshift({
    id: `audit-${Date.now()}`,
    user: 'Current CIMS User',
    timestamp: new Date().toISOString(),
    action,
    oldValue,
    newValue,
    poNumber,
    projectNumber: projectById(projectExternalId)?.projectNumber ?? 'Stock',
    warehouseId,
  } satisfies AuditLog)
}

function appendSync(direction: SyncLog['direction'], entity: string, externalId: string, status: SyncLog['status'], message: string) {
  syncLogRows.value.unshift({
    id: `sync-${Date.now()}`,
    direction,
    entity,
    externalId,
    status,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
    message,
  })
}

function projectById(id: string) {
  return projects.find(project => project.externalId === id) ?? {
    externalId: id,
    projectNumber: 'STOCK',
    projectName: 'Stock inventory',
    customer: 'Cronos',
    projectManager: 'Warehouse',
  }
}

function vendorById(id: string) {
  return vendors.find(vendor => vendor.externalId === id) ?? {
    externalId: id,
    name: 'Unknown vendor',
  }
}

function warehouseName(id: WarehouseCode) {
  return warehouses.find(warehouse => warehouse.id === id)?.name ?? id
}

function openQuantity(line: PurchaseOrderLine) {
  return Math.max(0, line.quantityOrdered - line.quantityReceived)
}

function splitLines(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)
}

function normalizeBarcode(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

function labelClass(size: LabelSize) {
  if (size === '4x6 shipping label') return 'label-4x6'
  if (size === '2x1 asset label') return 'label-2x1'
  return 'label-3x2'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function statusClass(status: string) {
  if (['Received', 'On Hand', 'Kitted', 'Ready to Ship', 'Delivered', 'Replaced'].includes(status)) return 'success'
  if (['Ordered', 'Partially Received', 'Pending Kitting', 'Requested', 'In Transit'].includes(status)) return 'warning'
  if (['Damaged', 'RMA Pending', 'RMA Shipped', 'Failed'].includes(status)) return 'danger'
  if (['Shipped'].includes(status)) return 'info'
  return 'neutral'
}

function syncClass(status: string) {
  if (status === 'Synced') return 'synced'
  if (status === 'Failed') return 'failed'
  if (status === 'Needs Review') return 'review'
  return 'pending'
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
</script>
