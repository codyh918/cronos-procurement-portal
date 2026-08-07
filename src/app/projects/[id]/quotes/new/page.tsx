"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, FileSpreadsheet, FileUp, Plus, Save, Send, Upload } from "lucide-react";
import { QuoteLinesEditor } from "@/components/quote-lines-editor";
import { calculateLineTotals, calculateQuoteSummaryWithContractFee, type PricingMode } from "@/lib/calculations";
import { createQuoteForProjectShared, loadProjectShared } from "@/lib/project-api-client";
import { findLatestPartPrice, findPartPriceSuggestions } from "@/lib/part-catalog";
import { applySequentialClins, getNextClin, inferQuoteLineVendor } from "@/lib/quote-line-utils";
import type { Project, QuoteLine } from "@/lib/types";
import { getOemSuggestions, recommendVendorForPart } from "@/lib/vendor-intelligence";
import { exportVendorRfqPackage } from "@/lib/vendor-rfq-package";
import { applyVendorRfqResponseWorkbook, getVendorRfqReadiness } from "@/lib/vendor-rfq-responses";
import { getVendorOptions } from "@/lib/vendors";

type DraftLine = QuoteLine;
type ImportedLine = Omit<QuoteLine, "id" | "approved" | "pricingMode" | "markupPercent" | "marginPercent">;

const emptyForm = {
  clin: "",
  partNumber: "",
  manufacturer: "",
  description: "",
  vendor: "",
  quoteNumber: "",
  leadTime: ""
};

export default function NewProjectQuotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>("markup");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [markupPercent, setMarkupPercent] = useState(15);
  const [marginPercent, setMarginPercent] = useState(20);
  const [form, setForm] = useState(emptyForm);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [expirationDays, setExpirationDays] = useState<30 | 60 | 90>(30);
  const [contractFeeEnabled, setContractFeeEnabled] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [rfqStatus, setRfqStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingRfq, setIsImportingRfq] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextProject = await loadProjectShared(params.id);
        if (active) setProject(nextProject);
      } catch (error) {
        if (active) setSaveError(error instanceof Error ? error.message : "Unable to load this project.");
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [params.id]);

  const nextClin = getNextClin(draftLines);
  const partSuggestions = useMemo(() => findPartPriceSuggestions(form.partNumber), [form.partNumber]);
  const oemSuggestions = useMemo(() => getOemSuggestions(form.partNumber), [form.partNumber]);
  const showPricingControls = project?.projectType !== "Design & Install";
  const previewLine = useMemo<QuoteLine>(
    () => buildDraftLine({
      ...form,
      clin: nextClin,
      quantity,
      unitCost,
      pricingMode: showPricingControls ? pricingMode : "markup",
      marginPercent: showPricingControls ? marginPercent : 0,
      markupPercent: showPricingControls ? markupPercent : 0
    }),
    [form, marginPercent, markupPercent, nextClin, pricingMode, quantity, showPricingControls, unitCost]
  );
  const previewTotals = calculateLineTotals(previewLine);
  const summary = useMemo(() => calculateQuoteSummaryWithContractFee(draftLines, contractFeeEnabled, shippingCost), [contractFeeEnabled, draftLines, shippingCost]);
  const rfqReadiness = useMemo(() => getVendorRfqReadiness(draftLines), [draftLines]);

  function handleAddLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextLine = buildDraftLine({
      ...form,
      clin: getNextClin(draftLines),
      quantity,
      unitCost,
      pricingMode: showPricingControls ? pricingMode : "markup",
      marginPercent: showPricingControls ? marginPercent : 0,
      markupPercent: showPricingControls ? markupPercent : 0
    });
    setDraftLines((current) => applySequentialClins([...current, nextLine]));
    setForm(emptyForm);
    setQuantity(1);
    setUnitCost(0);
  }

  function applyCatalogPart(partNumber: string) {
    setForm((current) => ({ ...current, partNumber }));

    const match = findLatestPartPrice(partNumber);
    if (!match) {
      const inferredVendor = recommendVendorForPart(partNumber, form.manufacturer, form.description);
      setForm((current) => ({
        ...current,
        vendor: current.vendor || inferredVendor
      }));
      setCatalogStatus(
        partNumber.trim()
          ? inferredVendor
            ? `Vendor inferred from OEM/product mapping: ${inferredVendor}.`
            : "No catalog match found yet. Keep typing for suggestions."
          : ""
      );
      return;
    }

    setForm((current) => ({
      ...current,
      partNumber,
      manufacturer: match.manufacturer || current.manufacturer,
      description: match.description || current.description,
      vendor: match.vendor || current.vendor
    }));
    setUnitCost(match.unitCost);
    setCatalogStatus(`Catalog match: ${match.partNumber} at ${currency(match.unitCost)} from ${match.poNumber}.`);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;

    setIsImporting(true);
    setImportStatus(`Reading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import-quote", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = (await response.json()) as { lineCount: number; lines: ImportedLine[] };
      const importedDrafts = result.lines.map((line) =>
        inferQuoteLineVendor(buildDraftLine({
          ...line,
          pricingMode: showPricingControls ? pricingMode : "markup",
          markupPercent: showPricingControls ? markupPercent : 0,
          marginPercent: showPricingControls ? marginPercent : 0
        }))
      );

      setDraftLines((current) => applySequentialClins([...current, ...importedDrafts]));
      setImportStatus(
        result.lineCount
          ? `Added ${result.lineCount} imported line item(s) to this quote draft.`
          : "No line items were found. Try an Excel/CSV table with headers like Part Number, Description, Qty, Unit Cost."
      );
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Could not import this file.");
    } finally {
      setIsImporting(false);
    }
  }

  async function saveQuote() {
    if (!draftLines.length || isSaving) return;

    setIsSaving(true);
    setSaveError("");

    try {
      const quote = await createQuoteForProjectShared(
        params.id,
        normalizePricingForProject(applySequentialClins(draftLines), showPricingControls).map(({ id: _id, approved: _approved, ...line }) => line),
        { contractFeeEnabled, expirationDays, shippingCost }
      );
      router.push(`/projects/${params.id}?quote=${encodeURIComponent(quote.quoteNumber)}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this quote.");
    } finally {
      setIsSaving(false);
    }
  }

  function exportRfqPackage() {
    if (!draftLines.length || !project) return;

    void exportVendorRfqPackage(project, applySequentialClins(draftLines).map(inferQuoteLineVendor));
    setDraftLines((current) => applySequentialClins(current).map(inferQuoteLineVendor));
    setRfqStatus("Vendor RFQ workbook(s) exported. Send each vendor their matching Cronos RFQ workbook, then import completed responses here.");
  }

  async function importRfqResponse(file: File | undefined) {
    if (!file) return;

    setIsImportingRfq(true);
    setRfqStatus(`Reading vendor RFQ response ${file.name}...`);

    try {
      const result = await applyVendorRfqResponseWorkbook(file, draftLines);
      setDraftLines(normalizePricingForProject(applySequentialClins(result.updatedLines), showPricingControls));
      setRfqStatus(
        `Updated ${result.updatedCount} line${result.updatedCount === 1 ? "" : "s"} with vendor pricing. ${result.unmatchedCount} response line${result.unmatchedCount === 1 ? "" : "s"} did not match the current draft.`
      );
    } catch (error) {
      setRfqStatus(error instanceof Error ? error.message : "Could not import vendor RFQ response.");
    } finally {
      setIsImportingRfq(false);
    }
  }

  if (loaded && !project) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[#06163d]">Project not found</h2>
        <Link href="/projects" className="font-bold text-[#0067e6]">Back to Projects</Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#06163d]">Create Project Quote</h2>
          <p className="mt-2 text-sm text-[#526179]">{project.projectNumber} - {project.projectName}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/projects/${project.id}`} className="rounded-md border border-[#dfe5ee] bg-white px-4 py-2 text-sm font-bold text-[#071b49]">
            Back to Project
          </Link>
          <button
            type="button"
            onClick={saveQuote}
            disabled={!draftLines.length || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-[#155fdb] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9db8e4]"
          >
            <Save size={17} />{isSaving ? "Saving..." : "Save Quote"}
          </button>
          <button
            type="button"
            onClick={exportRfqPackage}
            disabled={!draftLines.length}
            className="inline-flex items-center gap-2 rounded-md border border-[#dfe5ee] bg-white px-4 py-2 text-sm font-bold text-[#071b49] disabled:cursor-not-allowed disabled:text-[#9aa7ba]"
          >
            <FileSpreadsheet size={17} />Vendor RFQ Workbooks
          </button>
        </div>
      </div>
      {saveError ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {saveError}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-6">
        <Summary label="Lines" value={String(draftLines.length)} />
        <Summary label="Total Cost" value={currency(summary.totalCost)} />
        <Summary label="Line Item Total" value={currency(summary.totalSellPrice)} />
        <Summary label="Contract Fee" value={currency(summary.contractFee)} />
        <Summary label="Shipping" value={currency(summary.shippingCost)} />
        <Summary label="Quote Total" value={currency(summary.customerTotal)} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div>
          <h3 className="text-sm font-extrabold text-[#06163d]">Contract Fee</h3>
          <p className="mt-1 text-sm font-semibold text-[#526179]">
            {contractFeeEnabled
              ? `Contract fee is active. Quote total is line item total divided by .889.`
              : "Add a contract fee calculated as line item total divided by .889."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setContractFeeEnabled((current) => !current)}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${
            contractFeeEnabled
              ? "border border-[#dfe5ee] bg-white text-[#071b49]"
              : "bg-[#155fdb] text-white"
          }`}
        >
          <BadgeDollarSign size={17} />{contractFeeEnabled ? "Remove Contract Fee" : "Add Contract Fee"}
        </button>
      </section>

      {showPricingControls ? (
        <section className="grid gap-4 md:grid-cols-3">
          <Summary label="Gross Profit" value={currency(summary.totalGrossProfit)} />
          <Summary label="Gross Margin" value={`${summary.totalGrossMarginPercent}%`} />
        </section>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div>
          <h3 className="text-sm font-extrabold text-[#06163d]">Shipping Cost</h3>
          <p className="mt-1 text-sm font-semibold text-[#526179]">Add a customer-facing shipping charge to the quote total.</p>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase text-[#526179]">Shipping</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={shippingCost}
            onChange={(event) => setShippingCost(Number(event.target.value))}
            className="mt-1 w-40 rounded-md border border-[#dfe5ee] px-3 py-2 text-sm font-bold text-[#071b49] outline-none focus:border-blue-500"
          />
        </label>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div>
          <h3 className="text-sm font-extrabold text-[#06163d]">Quote Expiration</h3>
          <p className="mt-1 text-sm font-semibold text-[#526179]">Choose how long the customer quote remains valid.</p>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase text-[#526179]">Expires In</span>
          <select
            value={expirationDays}
            onChange={(event) => setExpirationDays(Number(event.target.value) as 30 | 60 | 90)}
            className="mt-1 w-40 rounded-md border border-[#dfe5ee] px-3 py-2 text-sm font-bold text-[#071b49] outline-none focus:border-blue-500"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </section>

      <section className="rounded-[8px] border border-dashed border-[#b9c6d8] bg-[#f8fbff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#06163d]">Import ROM / material list</h3>
            <p className="mt-1 text-xs font-semibold text-[#526179]">Upload an exported ROM Tool quote, Excel, CSV, TXT, or PDF. Material lines are added to the draft and grouped by vendor for RFQs.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-[#071b49] ring-1 ring-[#dfe5ee]">
            <FileUp size={17} />
            {isImporting ? "Importing..." : "Upload ROM / Quote"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </label>
        </div>
        {importStatus ? <p className="mt-3 text-xs font-semibold text-[#526179]">{importStatus}</p> : null}
      </section>

      <section className="space-y-4 rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#06163d]">Engineer MEL to Vendor RFQ Workflow</h3>
            <p className="mt-1 text-sm font-semibold text-[#526179]">
              Use catalog pricing as a starting point, but verify Design & Install pricing through vendor RFQs before issuing POs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportRfqPackage}
              disabled={!draftLines.length}
              className="inline-flex items-center gap-2 rounded-md bg-[#155fdb] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9db8e4]"
            >
              <Send size={17} />Generate Vendor RFQs
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#dfe5ee] bg-white px-4 py-2 text-sm font-bold text-[#071b49]">
              <Upload size={17} />{isImportingRfq ? "Importing..." : "Import Vendor Pricing"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => void importRfqResponse(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <RfqStep complete={draftLines.length > 0} title="1. MEL Imported" detail={`${draftLines.length} line${draftLines.length === 1 ? "" : "s"}`} />
          <RfqStep complete={rfqReadiness.missingVendorCount === 0 && draftLines.length > 0} title="2. Vendors Assigned" detail={`${rfqReadiness.assignedVendorCount}/${rfqReadiness.totalLines} assigned`} />
          <RfqStep complete={Boolean(rfqStatus.includes("exported") || rfqStatus.includes("Updated"))} title="3. RFQs Sent" detail="Vendor workbooks" />
          <RfqStep complete={rfqReadiness.missingVerifiedPricingCount === 0 && draftLines.length > 0} title="4. Pricing Verified" detail={`${rfqReadiness.verifiedPricingCount}/${rfqReadiness.totalLines} verified`} />
          <RfqStep complete={rfqReadiness.readyForCustomerQuote} title="5. Ready for Quote" detail={rfqReadiness.readyForCustomerQuote ? "Save quote" : "Need responses"} />
        </div>

        {rfqReadiness.missingVerifiedPricingCount ? (
          <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {rfqReadiness.missingVerifiedPricingCount} line{rfqReadiness.missingVerifiedPricingCount === 1 ? "" : "s"} still need vendor quote number and verified unit cost before PO generation.
          </div>
        ) : null}
        {rfqStatus ? <p className="text-sm font-semibold text-[#526179]">{rfqStatus}</p> : null}
      </section>

      <form onSubmit={handleAddLine} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="grid gap-5 rounded-[8px] border border-[#dfe5ee] bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.05)] md:grid-cols-2">
          <label>
            <span className="text-sm font-bold text-[#071b49]">CLIN</span>
            <input value={nextClin} readOnly className="mt-2 w-full rounded-md border border-[#dfe5ee] bg-[#f3f6fb] px-3 py-2 text-sm font-extrabold text-[#071b49] outline-none" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#071b49]">Part Number</span>
            <input required list="part-number-suggestions" value={form.partNumber} onChange={(event) => applyCatalogPart(event.target.value)} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Type part number for catalog pricing" />
            <datalist id="part-number-suggestions">
              {partSuggestions.map((record) => (
                <option key={record.id} value={record.partNumber}>{record.description} - {record.vendor} - {currency(record.unitCost)}</option>
              ))}
              {oemSuggestions.map((suggestion) => (
                <option key={`${suggestion.vendor}-${suggestion.oem}`} value={suggestion.oem}>{suggestion.vendor} - {suggestion.products}</option>
              ))}
            </datalist>
            {catalogStatus ? <span className="mt-2 block text-xs font-semibold text-[#526179]">{catalogStatus}</span> : null}
          </label>
          <Field name="manufacturer" label="Manufacturer" placeholder="Enter manufacturer" value={form.manufacturer} onChange={(value) => setForm((current) => ({ ...current, manufacturer: value }))} />
          <VendorField value={form.vendor} onChange={(value) => setForm((current) => ({ ...current, vendor: value }))} />
          <label>
            <span className="text-sm font-bold text-[#071b49]">Quantity</span>
            <input required type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <label>
            <span className="text-sm font-bold text-[#071b49]">Unit Cost</span>
            <input required type="number" min={0} step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          {showPricingControls ? (
            <>
              <label>
                <span className="text-sm font-bold text-[#071b49]">Pricing Mode</span>
                <select value={pricingMode} onChange={(event) => setPricingMode(event.target.value as PricingMode)} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="markup">Apply Markup</option>
                  <option value="margin">Apply Margin</option>
                </select>
              </label>
              {pricingMode === "markup" ? (
                <label>
                  <span className="text-sm font-bold text-[#071b49]">Markup %</span>
                  <input type="number" min={0} step="0.01" value={markupPercent} onChange={(event) => setMarkupPercent(Number(event.target.value))} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </label>
              ) : (
                <label>
                  <span className="text-sm font-bold text-[#071b49]">Margin %</span>
                  <input type="number" min={0} max={99} step="0.01" value={marginPercent} onChange={(event) => setMarginPercent(Number(event.target.value))} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </label>
              )}
            </>
          ) : (
            <div className="rounded-[8px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#071b49] md:col-span-2">
              Design & Install project: line pricing uses verified vendor cost only. Markup and margin controls are hidden.
            </div>
          )}
          <Field name="quoteNumber" label="Vendor Quote Number" placeholder="Optional" value={form.quoteNumber} onChange={(value) => setForm((current) => ({ ...current, quoteNumber: value }))} />
          <Field name="leadTime" label="Lead Time" placeholder="Example: 14 days" value={form.leadTime} onChange={(value) => setForm((current) => ({ ...current, leadTime: value }))} />
          <label className="md:col-span-2">
            <span className="text-sm font-bold text-[#071b49]">Description</span>
            <textarea required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 h-24 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Enter customer-facing line item description" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-[#155fdb] px-4 py-2 text-sm font-bold text-white">
              <Plus size={17} />Add Line to Quote
            </button>
          </div>
        </section>

        <aside className="rounded-[8px] border border-[#dfe5ee] bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
          <h3 className="text-lg font-bold text-[#06163d]">Line Preview</h3>
          <div className="mt-5 space-y-4 text-sm">
            <PreviewRow label="Sell Price" value={currency(previewTotals.sellPrice)} />
            <PreviewRow label="Extended Cost" value={currency(previewTotals.extendedCost)} />
            <PreviewRow label="Extended Sell" value={currency(previewTotals.extendedSellPrice)} />
            {showPricingControls ? (
              <>
                <PreviewRow label="Gross Profit" value={currency(previewTotals.grossProfit)} />
                <PreviewRow label="Gross Margin" value={`${previewTotals.grossMarginPercent}%`} />
              </>
            ) : null}
          </div>
        </aside>
      </form>

      <section className="rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#06163d]">Quote Draft Lines</h3>
            <p className="mt-1 text-sm text-[#526179]">Modify any line item field before saving the quote.</p>
          </div>
          <button
            type="button"
            onClick={saveQuote}
            disabled={!draftLines.length || isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-[#155fdb] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9db8e4]"
          >
            <Save size={17} />{isSaving ? "Saving..." : "Save Quote"}
          </button>
          <button
            type="button"
            onClick={exportRfqPackage}
            disabled={!draftLines.length}
            className="inline-flex items-center gap-2 rounded-md border border-[#dfe5ee] bg-white px-4 py-2 text-sm font-bold text-[#071b49] disabled:cursor-not-allowed disabled:text-[#9aa7ba]"
          >
            <FileSpreadsheet size={17} />Vendor RFQ Workbooks
          </button>
        </div>
        <QuoteLinesEditor lines={draftLines} onChange={setDraftLines} emptyMessage="No lines in this quote yet." showPricingControls={showPricingControls} />
      </section>
    </div>
  );
}

function buildDraftLine(input: {
  clin: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitCost: number;
  pricingMode: PricingMode;
  markupPercent: number;
  marginPercent: number;
  vendor: string;
  quoteNumber: string;
  leadTime: string;
}): DraftLine {
  return {
    ...input,
    id: crypto.randomUUID(),
    quantity: Number.isFinite(input.quantity) ? input.quantity : 0,
    unitCost: Number.isFinite(input.unitCost) ? input.unitCost : 0,
    approved: false
  };
}

function normalizePricingForProject(lines: QuoteLine[], showPricingControls: boolean) {
  if (showPricingControls) return lines;

  return lines.map((line) => ({
    ...line,
    pricingMode: "markup" as const,
    markupPercent: 0,
    marginPercent: 0
  }));
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  required = false
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      <span className="text-sm font-bold text-[#071b49]">{label}</span>
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder={placeholder} />
    </label>
  );
}

function VendorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-sm font-bold text-[#071b49]">Vendor / Source</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-[#dfe5ee] px-3 py-2 text-sm outline-none focus:border-blue-500">
        <option value="">Select vendor</option>
        {getVendorOptions(value).map((vendor) => (
          <option key={vendor} value={vendor}>{vendor}</option>
        ))}
      </select>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#dfe5ee] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-bold uppercase text-[#526179]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[#06163d]">{value}</p>
    </div>
  );
}

function RfqStep({ complete, title, detail }: { complete: boolean; title: string; detail: string }) {
  return (
    <div className={`rounded-[8px] border p-4 ${complete ? "border-emerald-200 bg-emerald-50" : "border-[#dfe5ee] bg-[#fbfcfe]"}`}>
      <div className="flex items-center gap-2">
        <CheckCircle2 size={17} className={complete ? "text-emerald-600" : "text-[#94a3b8]"} />
        <p className={`text-xs font-extrabold uppercase ${complete ? "text-emerald-800" : "text-[#526179]"}`}>{title}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-[#071b49]">{detail}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#eef2f7] pb-2">
      <span className="font-semibold text-[#526179]">{label}</span>
      <span className="font-bold text-[#071b49]">{value}</span>
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
