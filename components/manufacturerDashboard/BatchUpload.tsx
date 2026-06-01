import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, Download, FileText, Upload, X } from 'lucide-react';
import {
  parseCSV,
  validateProductRow,
  validateVariantRow,
  assembleProductFromRow,
  generateProductsTemplate,
  generateVariantsTemplate,
  downloadCsv,
  PRODUCT_COLUMNS,
  VARIANT_COLUMNS,
  type RowValidationResult,
} from '../../utils/batchImport';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParsedState {
  productRows: Record<string, string>[];
  variantRows: Record<string, string>[];
  productValidation: RowValidationResult[];
  variantErrors: { rowIndex: number; errors: string[] }[];
  isValid: boolean;
}

interface BatchUploadProps {
  onSubmitBatch: (materials: Record<string, unknown>[]) => Promise<void>;
  onCancel: () => void;
}

// ─── Column reference panel ────────────────────────────────────────────────

function ColumnReference() {
  const groups = [
    { key: 'core', label: 'Required' },
    { key: 'identity', label: 'Product identity' },
    { key: 'application', label: 'Application context' },
    { key: 'spec', label: 'Technical spec' },
    { key: 'sustainability', label: 'Sustainability (core)' },
    { key: 'sustainability-category', label: 'Sustainability (category-specific)' },
  ] as const;

  return (
    <details className="border border-gray-200">
      <summary className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-500 cursor-pointer hover:bg-gray-50 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5" /> Column reference
      </summary>
      <div className="divide-y divide-gray-100">
        {groups.map(({ key, label }) => {
          const cols = PRODUCT_COLUMNS.filter(c => c.group === key);
          if (!cols.length) return null;
          return (
            <div key={key} className="px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-2">{label}</p>
              <div className="space-y-1">
                {cols.map(col => (
                  <div key={col.key} className="flex gap-3 text-xs font-sans">
                    <code className={`w-48 flex-shrink-0 font-mono text-[10px] ${col.required ? 'text-black font-semibold' : 'text-gray-500'}`}>
                      {col.key}
                    </code>
                    <span className="text-gray-500 leading-snug">
                      {col.description}
                      {col.allowedValues && <span className="text-gray-400"> ({col.allowedValues.join(' | ')})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-2">Variants sheet columns</p>
          <div className="space-y-1">
            {VARIANT_COLUMNS.map(col => (
              <div key={col.key} className="flex gap-3 text-xs font-sans">
                <code className={`w-48 flex-shrink-0 font-mono text-[10px] ${col.required ? 'text-black font-semibold' : 'text-gray-500'}`}>
                  {col.key}
                </code>
                <span className="text-gray-500 leading-snug">{col.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

// ─── Validation result display ─────────────────────────────────────────────

function ValidationPanel({ parsed }: { parsed: ParsedState }) {
  const hasErrors = parsed.productValidation.some(r => r.errors.length > 0) || parsed.variantErrors.some(r => r.errors.length > 0);
  const hasWarnings = parsed.productValidation.some(r => r.warnings.length > 0);

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 px-3 py-2 border text-sm font-mono ${
        parsed.isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
      }`}>
        {parsed.isValid ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
        <span className="text-[10px] uppercase tracking-widest">
          {parsed.isValid
            ? `${parsed.productRows.length} product${parsed.productRows.length !== 1 ? 's' : ''} ready to submit`
            : `${parsed.productValidation.filter(r => r.errors.length).length} row${parsed.productValidation.filter(r => r.errors.length).length !== 1 ? 's' : ''} with errors — fix before submitting`
          }
        </span>
      </div>

      {(hasErrors || hasWarnings) && (
        <div className="border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {parsed.productValidation.map(result => (
            (result.errors.length > 0 || result.warnings.length > 0) && (
              <div key={result.rowIndex} className="px-3 py-2 space-y-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500">
                  Row {result.rowIndex + 2}: {result.name}
                </p>
                {result.errors.map((err, i) => (
                  <p key={i} className="font-sans text-xs text-red-600 flex items-start gap-1.5">
                    <X className="w-3 h-3 mt-0.5 flex-shrink-0" /> {err}
                  </p>
                ))}
                {result.warnings.map((w, i) => (
                  <p key={i} className="font-sans text-xs text-amber-600 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )
          ))}
          {parsed.variantErrors.map(result => (
            result.errors.length > 0 && (
              <div key={`v-${result.rowIndex}`} className="px-3 py-2 space-y-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500">Variants row {result.rowIndex + 2}</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="font-sans text-xs text-red-600 flex items-start gap-1.5">
                    <X className="w-3 h-3 mt-0.5 flex-shrink-0" /> {err}
                  </p>
                ))}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview table ─────────────────────────────────────────────────────────

function PreviewTable({ productRows, variantRows }: { productRows: Record<string, string>[]; variantRows: Record<string, string>[] }) {
  const previewCols = ['name', 'treePath', 'variantMode', 'finish'] as const;

  return (
    <div className="border border-gray-200 overflow-x-auto">
      <table className="w-full text-xs font-sans">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {previewCols.map(col => (
              <th key={col} className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">{col}</th>
            ))}
            <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-gray-400">variants</th>
          </tr>
        </thead>
        <tbody>
          {productRows.map((row, i) => {
            const variantCount = variantRows.filter(v => v['parentName']?.trim() === row['name']?.trim()).length;
            return (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                {previewCols.map(col => (
                  <td key={col} className="px-3 py-2 text-gray-700 max-w-xs truncate">{row[col] || '—'}</td>
                ))}
                <td className="px-3 py-2 text-gray-400 font-mono text-[9px]">{variantCount > 0 ? `${variantCount}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export const BatchUpload: React.FC<BatchUploadProps> = ({ onSubmitBatch, onCancel }) => {
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variantCsvText, setVariantCsvText] = useState('');

  const productFileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);

  const parseAndValidate = (productCsv: string, variantCsv: string) => {
    const productRows = parseCSV(productCsv);
    const variantRows = variantCsv.trim() ? parseCSV(variantCsv) : [];
    const productNames = productRows.map(r => r['name']?.trim()).filter(Boolean);

    const productValidation = productRows.map((row, i) => validateProductRow(row, i));
    const variantErrors = variantRows.map((row, i) => validateVariantRow(row, i, productNames));

    const isValid =
      productRows.length > 0 &&
      productValidation.every(r => r.errors.length === 0) &&
      variantErrors.every(r => r.errors.length === 0);

    setParsed({ productRows, variantRows, productValidation, variantErrors, isValid });
  };

  const handleProductFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      parseAndValidate(text, variantCsvText);
    };
    reader.readAsText(file);
  };

  const handleVariantFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setVariantCsvText(text);
      if (parsed) {
        const productCsv = productFileRef.current?.files?.[0];
        // re-parse with updated variant CSV
        parseAndValidate(
          productCsv ? '' : '', // already cached in state — re-trigger with variant text
          text,
        );
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!parsed?.isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const materials = parsed.productRows.map(row =>
        assembleProductFromRow(row, parsed.variantRows)
      );
      await onSubmitBatch(materials);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-600" />
        </div>
        <p className="font-display text-lg uppercase tracking-wide">Batch submitted</p>
        <p className="font-sans text-sm text-gray-500 text-center max-w-xs">
          {parsed?.productRows.length} product{(parsed?.productRows.length ?? 0) !== 1 ? 's' : ''} submitted for review.
          You'll be contacted once they've been approved.
        </p>
        <button onClick={onCancel} className="font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors pt-2">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wide mb-1">Batch upload</h2>
        <p className="font-sans text-sm text-gray-500">
          Upload products from a CSV file. Download the template, fill it in, then upload here.
          Variants go in a separate CSV linked by product name.
        </p>
      </div>

      {/* Download templates */}
      <div className="border border-gray-200 p-5 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Step 1 — download templates</p>
        <div className="flex gap-3">
          <button
            onClick={() => downloadCsv(generateProductsTemplate(), 'moodboardlab-products-template.csv')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Products template
          </button>
          <button
            onClick={() => downloadCsv(generateVariantsTemplate(), 'moodboardlab-variants-template.csv')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Variants template
          </button>
        </div>
        <p className="font-sans text-xs text-gray-400 leading-relaxed">
          The first row is the column header. The second row is a description guide — delete it before uploading.
          The variants template is only needed if your products use <code className="font-mono text-[10px]">photo-variants</code> or <code className="font-mono text-[10px]">surface-finish</code> mode.
        </p>
      </div>

      <ColumnReference />

      {/* Upload zone */}
      <div className="border border-gray-200 p-5 space-y-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Step 2 — upload your completed CSVs</p>

        <div className="space-y-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-2">Products CSV <span className="text-red-500">*</span></p>
            <button
              type="button"
              onClick={() => productFileRef.current?.click()}
              className="flex items-center gap-2 w-full border border-dashed border-gray-300 px-4 py-4 text-xs font-mono uppercase tracking-widest text-gray-400 hover:border-black hover:text-black transition-colors"
            >
              <Upload className="w-4 h-4" />
              {productFileRef.current?.files?.[0]?.name ?? 'Choose products CSV…'}
            </button>
            <input ref={productFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleProductFile} />
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-2">Variants CSV (optional)</p>
            <button
              type="button"
              onClick={() => variantFileRef.current?.click()}
              className="flex items-center gap-2 w-full border border-dashed border-gray-300 px-4 py-4 text-xs font-mono uppercase tracking-widest text-gray-400 hover:border-black hover:text-black transition-colors"
            >
              <Upload className="w-4 h-4" />
              {variantFileRef.current?.files?.[0]?.name ?? 'Choose variants CSV (optional)…'}
            </button>
            <input ref={variantFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleVariantFile} />
          </div>
        </div>
      </div>

      {/* Validation + preview */}
      {parsed && (
        <div className="space-y-4">
          <ValidationPanel parsed={parsed} />
          {parsed.productRows.length > 0 && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Preview</p>
              <PreviewTable productRows={parsed.productRows} variantRows={parsed.variantRows} />
            </>
          )}
        </div>
      )}

      {error && (
        <p className="font-sans text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <button
          onClick={onCancel}
          className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!parsed?.isValid || isSubmitting}
          className="px-5 py-2.5 bg-black text-white text-[10px] font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-40"
        >
          {isSubmitting ? 'Submitting…' : `Submit ${parsed?.isValid ? `${parsed.productRows.length} product${parsed.productRows.length !== 1 ? 's' : ''}` : ''}`}
        </button>
      </div>
    </div>
  );
};
