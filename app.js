const {
  useEffect,
  useMemo,
  useRef,
  useState
} = React;
const REVIEW_CONFIDENCE_THRESHOLD = 92;
const REVIEW_CER_THRESHOLD = 7.5;
const FIELD_DEFINITIONS = {
  invoiceNo: {
    label: "Invoice No",
    outputHeader: "Invoice No",
    aliases: ["Invoice No", "Invoice Number", "invoice_no", "invoice no."]
  },
  supplierNameOcr: {
    label: "Supplier Name (OCR)",
    outputHeader: "Supplier Name (OCR)",
    aliases: ["Supplier Name (OCR)", "Supplier OCR", "supplier_name_ocr", "Supplier Name"]
  },
  ocrItemCode: {
    label: "Supplier Item Code (OCR)",
    outputHeader: "Supplier Item Code (OCR)",
    aliases: ["Supplier Item Code (OCR)", "Item Code (OCR)", "OCR Item Code", "supplier_item_code_ocr"]
  },
  ocrDesc: {
    label: "Item Description (OCR)",
    outputHeader: "Item Description (OCR)",
    aliases: ["Item Description (OCR)", "OCR Item Description", "OCR Description", "item_description_ocr"]
  },
  matchedItemName: {
    label: "Matched Item Name",
    outputHeader: "Matched Item Name",
    aliases: ["Matched Item Name", "Matched Item Description", "Item Name (Matched)", "match_result"]
  },
  matchType: {
    label: "Match Type",
    outputHeader: "Match Type",
    aliases: ["Match Type", "Matching Type", "match_type"]
  },
  confidence: {
    label: "Confidence (%)",
    outputHeader: "Confidence (%)",
    aliases: ["Confidence (%)", "Confidence", "Match Confidence", "confidence"]
  },
  characterErrorRate: {
    label: "Character Error Rate",
    outputHeader: "Character Error Rate",
    aliases: ["Character Error Rate", "CER", "Character Error Rate (%)", "character_error_rate"]
  },
  documentId: {
    label: "document_id",
    outputHeader: "document_id",
    aliases: ["document_id", "Document ID", "document id"]
  }
};
const REQUIRED_FIELDS = ["ocrDesc", "matchedItemName"];
const REVIEW_STATUS_HEADER = "Review Status";
const REVIEW_NOTE_HEADER = "Review Note";
const REVIEWED_AT_HEADER = "Reviewed At";
const CHANGED_FIELDS_HEADER = "Changed Fields";
function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}
function findActualHeader(headers, aliases) {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]));
  for (const alias of aliases) {
    const found = normalized.get(normalizeHeader(alias));
    if (found) return found;
  }
  return null;
}
function toText(value) {
  return value === null || value === undefined ? "" : String(value);
}
function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function localTimestamp() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function parseReviewStatus(value) {
  const normalized = normalizeHeader(value);
  return ["confirmed", "reviewed", "complete", "completed", "ยืนยันแล้ว", "ตรวจแล้ว"].includes(normalized);
}
function isFlagged(row) {
  const matchType = normalizeHeader(row.matchType);
  const confidence = toNumber(row.confidence);
  const cer = toNumber(row.characterErrorRate);
  if (matchType && matchType !== "exact") return true;
  if (confidence !== null && confidence < REVIEW_CONFIDENCE_THRESHOLD) return true;
  if (cer !== null && cer > REVIEW_CER_THRESHOLD) return true;
  return !row.ocrDesc.trim() || !row.matchedItemName.trim();
}
function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.onload = event => {
      try {
        const workbook = XLSX.read(event.target.result, {
          type: "array",
          cellDates: false
        });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("ไม่พบ Worksheet ในไฟล์");
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
          blankrows: false
        });
        if (!rawRows.length) throw new Error("ไฟล์ไม่มีรายการข้อมูล");
        const headers = Object.keys(rawRows[0]);
        const headerMap = {};
        Object.entries(FIELD_DEFINITIONS).forEach(([field, definition]) => {
          headerMap[field] = findActualHeader(headers, definition.aliases);
        });
        const missing = REQUIRED_FIELDS.filter(field => !headerMap[field]);
        if (missing.length) {
          const labels = missing.map(field => FIELD_DEFINITIONS[field].outputHeader).join(", ");
          throw new Error(`ไม่พบคอลัมน์ที่จำเป็น: ${labels}`);
        }
        const reviewStatusHeader = findActualHeader(headers, [REVIEW_STATUS_HEADER]);
        const reviewNoteHeader = findActualHeader(headers, [REVIEW_NOTE_HEADER]);
        const reviewedAtHeader = findActualHeader(headers, [REVIEWED_AT_HEADER]);
        const rows = rawRows.map((raw, index) => {
          const readField = field => {
            const header = headerMap[field];
            return header ? toText(raw[header]) : "";
          };
          return {
            id: index + 1,
            original: {
              ...raw
            },
            invoiceNo: readField("invoiceNo"),
            supplierNameOcr: readField("supplierNameOcr"),
            ocrItemCode: readField("ocrItemCode"),
            ocrDesc: readField("ocrDesc"),
            matchedItemName: readField("matchedItemName"),
            matchType: readField("matchType"),
            confidence: readField("confidence"),
            characterErrorRate: readField("characterErrorRate"),
            documentId: readField("documentId"),
            confirmed: reviewStatusHeader ? parseReviewStatus(raw[reviewStatusHeader]) : false,
            reviewNote: reviewNoteHeader ? toText(raw[reviewNoteHeader]) : "",
            reviewedAt: reviewedAtHeader ? toText(raw[reviewedAtHeader]) : "",
            changedFields: {}
          };
        });
        resolve({
          rows,
          headerMap,
          sheetName,
          originalHeaders: headers
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("รูปแบบไฟล์ไม่ถูกต้อง"));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
function diffStrings(source, target) {
  const a = String(source || "").slice(0, 500);
  const b = String(target || "").slice(0, 500);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({
    length: n + 1
  }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  const sourceParts = [];
  const targetParts = [];
  const push = (parts, text, same) => {
    const last = parts[parts.length - 1];
    if (last && last.same === same) last.text += text;else parts.push({
      text,
      same
    });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(sourceParts, a[i], true);
      push(targetParts, b[j], true);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(sourceParts, a[i], false);
      i += 1;
    } else {
      push(targetParts, b[j], false);
      j += 1;
    }
  }
  while (i < n) push(sourceParts, a[i++], false);
  while (j < m) push(targetParts, b[j++], false);
  return {
    sourceParts,
    targetParts
  };
}
function DifferencePreview({
  ocrText,
  matchedText
}) {
  const diff = useMemo(() => diffStrings(ocrText, matchedText), [ocrText, matchedText]);
  const renderParts = (parts, type) => parts.map((part, index) => /*#__PURE__*/React.createElement("span", {
    key: index,
    className: part.same ? "" : type === "ocr" ? "diff-removed" : "diff-added"
  }, part.text));
  return /*#__PURE__*/React.createElement("div", {
    className: "diff-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "diff-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "diff-label"
  }, "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E08\u0E32\u0E01 OCR"), /*#__PURE__*/React.createElement("div", {
    className: "diff-text"
  }, renderParts(diff.sourceParts, "ocr") || "—")), /*#__PURE__*/React.createElement("div", {
    className: "diff-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "diff-label"
  }, "Item Name \u0E17\u0E35\u0E48\u0E08\u0E31\u0E1A\u0E04\u0E39\u0E48"), /*#__PURE__*/React.createElement("div", {
    className: "diff-text"
  }, renderParts(diff.targetParts, "matched") || "—")));
}
function StatusBadge({
  row
}) {
  if (row.confirmed) return /*#__PURE__*/React.createElement("span", {
    className: "badge badge-success"
  }, "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27");
  if (isFlagged(row)) return /*#__PURE__*/React.createElement("span", {
    className: "badge badge-warning"
  }, "\u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08");
  return /*#__PURE__*/React.createElement("span", {
    className: "badge badge-neutral"
  }, "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08");
}
function App() {
  const [rows, setRows] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState({});
  const [hasUnexportedWork, setHasUnexportedWork] = useState(false);
  const fileInputRef = useRef(null);
  useEffect(() => {
    const handleBeforeUnload = event => {
      if (!hasUnexportedWork || rows.length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnexportedWork, rows.length]);
  async function importFile(file) {
    if (!file) return;
    if (rows.length && !window.confirm("การนำเข้าไฟล์ใหม่จะล้างข้อมูลที่กำลังตรวจอยู่ ต้องการดำเนินการต่อหรือไม่?")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setIsReading(true);
    setError("");
    try {
      const parsed = await parseWorkbook(file);
      setRows(parsed.rows);
      setHeaderMap(parsed.headerMap);
      setFileName(file.name);
      setSheetName(parsed.sheetName);
      setExpandedRows({});
      setSearch("");
      setViewFilter("all");
      setHasUnexportedWork(false);
    } catch (readError) {
      setRows([]);
      setHeaderMap({});
      setFileName("");
      setSheetName("");
      setError(readError.message || "ไม่สามารถนำเข้าไฟล์ได้");
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  function updateRow(rowId, field, value) {
    setRows(current => current.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [field]: value,
        confirmed: false,
        reviewedAt: "",
        changedFields: {
          ...row.changedFields,
          [field]: true
        }
      };
    }));
    setHasUnexportedWork(true);
  }
  function setConfirmed(rowId, confirmed) {
    setRows(current => current.map(row => row.id === rowId ? {
      ...row,
      confirmed,
      reviewedAt: confirmed ? localTimestamp() : ""
    } : row));
    setHasUnexportedWork(true);
  }
  function confirmVisible(visibleIds) {
    if (!visibleIds.length) return;
    const ids = new Set(visibleIds);
    const timestamp = localTimestamp();
    setRows(current => current.map(row => ids.has(row.id) ? {
      ...row,
      confirmed: true,
      reviewedAt: timestamp
    } : row));
    setHasUnexportedWork(true);
  }
  function clearData() {
    if (rows.length && !window.confirm("ล้างข้อมูลทั้งหมดออกจากหน่วยความจำของ Browser ใช่หรือไม่?")) return;
    setRows([]);
    setHeaderMap({});
    setFileName("");
    setSheetName("");
    setError("");
    setSearch("");
    setViewFilter("all");
    setExpandedRows({});
    setHasUnexportedWork(false);
  }
  function toggleExpanded(rowId) {
    setExpandedRows(current => ({
      ...current,
      [rowId]: !current[rowId]
    }));
  }
  function writeField(output, row, field) {
    const definition = FIELD_DEFINITIONS[field];
    const targetHeader = headerMap[field] || definition.outputHeader;
    output[targetHeader] = row[field];
  }
  function exportWorkbook() {
    if (!rows.length) return;
    const outputRows = rows.map(row => {
      const output = {
        ...row.original
      };
      Object.keys(FIELD_DEFINITIONS).forEach(field => writeField(output, row, field));
      output[REVIEW_STATUS_HEADER] = row.confirmed ? "Confirmed" : "Pending";
      output[REVIEW_NOTE_HEADER] = row.reviewNote;
      output[REVIEWED_AT_HEADER] = row.reviewedAt;
      output[CHANGED_FIELDS_HEADER] = Object.keys(row.changedFields).map(field => FIELD_DEFINITIONS[field]?.outputHeader || field).join(", ");
      return output;
    });
    const worksheet = XLSX.utils.json_to_sheet(outputRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Validated");
    const baseName = (fileName || "OCR_Item_Recheck").replace(/\.(xlsx|xls|csv)$/i, "").replace(/[^a-zA-Z0-9ก-๙._-]+/g, "_");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${baseName}_Validated_${date}.xlsx`);
    setHasUnexportedWork(false);
  }
  function downloadTemplate() {
    const headers = [FIELD_DEFINITIONS.invoiceNo.outputHeader, FIELD_DEFINITIONS.supplierNameOcr.outputHeader, FIELD_DEFINITIONS.ocrItemCode.outputHeader, FIELD_DEFINITIONS.ocrDesc.outputHeader, FIELD_DEFINITIONS.matchedItemName.outputHeader, FIELD_DEFINITIONS.matchType.outputHeader, FIELD_DEFINITIONS.confidence.outputHeader, FIELD_DEFINITIONS.characterErrorRate.outputHeader, FIELD_DEFINITIONS.documentId.outputHeader];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Recheck");
    XLSX.writeFile(workbook, "OCR_Item_Recheck_Template.xlsx");
  }
  const stats = useMemo(() => {
    const flagged = rows.filter(isFlagged).length;
    const confirmed = rows.filter(row => row.confirmed).length;
    const edited = rows.filter(row => Object.keys(row.changedFields).length > 0).length;
    return {
      total: rows.length,
      flagged,
      confirmed,
      edited,
      pending: rows.length - confirmed
    };
  }, [rows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      if (viewFilter === "pending" && row.confirmed) return false;
      if (viewFilter === "flagged" && !isFlagged(row)) return false;
      if (!query) return true;
      return [row.invoiceNo, row.supplierNameOcr, row.ocrItemCode, row.ocrDesc, row.matchedItemName, row.documentId].some(value => String(value || "").toLowerCase().includes(query));
    });
  }, [rows, search, viewFilter]);
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "PO\u2013Invoice\u2013DO Mapping"), /*#__PURE__*/React.createElement("h1", null, "OCR Item Recheck"), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Item Name \u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 OCR \u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E25\u0E31\u0E1A")), /*#__PURE__*/React.createElement("div", {
    className: "topbar-actions"
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    hidden: true,
    onChange: event => importFile(event.target.files?.[0])
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: downloadTemplate
  }, "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 Template"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => fileInputRef.current?.click(),
    disabled: isReading
  }, isReading ? "กำลังอ่านไฟล์..." : "นำเข้า Excel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-success",
    onClick: exportWorkbook,
    disabled: !rows.length
  }, "\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E1C\u0E25\u0E15\u0E23\u0E27\u0E08"))), /*#__PURE__*/React.createElement("main", {
    className: "main-content"
  }, /*#__PURE__*/React.createElement("section", {
    className: "privacy-banner",
    "aria-label": "Data privacy notice"
  }, /*#__PURE__*/React.createElement("div", {
    className: "privacy-icon",
    "aria-hidden": "true"
  }, "\u2713"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E40\u0E01\u0E47\u0E1A\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07"), /*#__PURE__*/React.createElement("div", null, "\u0E44\u0E1F\u0E25\u0E4C\u0E16\u0E39\u0E01\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E43\u0E19 Browser \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49 Database, Cookie, localStorage \u0E2B\u0E23\u0E37\u0E2D API \u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E30\u0E2B\u0E32\u0E22\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E21\u0E37\u0E48\u0E2D Refresh \u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A"))), error && /*#__PURE__*/React.createElement("section", {
    className: "alert alert-error"
  }, /*#__PURE__*/React.createElement("span", null, error), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setError("")
  }, "\u0E1B\u0E34\u0E14")), !rows.length && !isReading ? /*#__PURE__*/React.createElement("section", {
    className: "empty-state"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty-icon",
    "aria-hidden": "true"
  }, "\u21A5"), /*#__PURE__*/React.createElement("h2", null, "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E32\u0E01\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1F\u0E25\u0E4C\u0E1C\u0E25 OCR"), /*#__PURE__*/React.createElement("p", null, "\u0E44\u0E1F\u0E25\u0E4C\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C ", /*#__PURE__*/React.createElement("code", null, "Item Description (OCR)"), " \u0E41\u0E25\u0E30 ", /*#__PURE__*/React.createElement("code", null, "Matched Item Name")), /*#__PURE__*/React.createElement("div", {
    className: "empty-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-large",
    onClick: () => fileInputRef.current?.click()
  }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E1F\u0E25\u0E4C Excel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary btn-large",
    onClick: downloadTemplate
  }, "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 Template \u0E40\u0E1B\u0E25\u0E48\u0E32")), /*#__PURE__*/React.createElement("div", {
    className: "empty-note"
  }, "\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E21\u0E35\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 \u0E44\u0E21\u0E48\u0E21\u0E35 Supplier Master \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E21\u0E35 Item Master \u0E1D\u0E31\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19 Source Code")) : rows.length ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "file-strip"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "file-name"
  }, fileName), /*#__PURE__*/React.createElement("div", {
    className: "file-meta"
  }, "Worksheet: ", sheetName, " \xB7 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E08\u0E33\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E02\u0E2D\u0E07 Browser")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger-outline",
    onClick: clearData
  }, "\u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25")), /*#__PURE__*/React.createElement("section", {
    className: "stats-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("span", null, "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"), /*#__PURE__*/React.createElement("strong", null, stats.total)), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("span", null, "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27"), /*#__PURE__*/React.createElement("strong", null, stats.confirmed)), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("span", null, "\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08"), /*#__PURE__*/React.createElement("strong", null, stats.pending)), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("span", null, "\u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08"), /*#__PURE__*/React.createElement("strong", null, stats.flagged)), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("span", null, "\u0E21\u0E35\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02"), /*#__PURE__*/React.createElement("strong", null, stats.edited))), /*#__PURE__*/React.createElement("section", {
    className: "toolbar"
  }, /*#__PURE__*/React.createElement("input", {
    className: "search-input",
    value: search,
    onChange: event => setSearch(event.target.value),
    placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 Invoice, Supplier, Item Code \u0E2B\u0E23\u0E37\u0E2D Item Name..."
  }), /*#__PURE__*/React.createElement("div", {
    className: "filter-group",
    role: "group",
    "aria-label": "\u0E15\u0E31\u0E27\u0E01\u0E23\u0E2D\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"
  }, [["all", "ทั้งหมด"], ["pending", "รอตรวจ"], ["flagged", "ควรตรวจ"]].map(([value, label]) => /*#__PURE__*/React.createElement("button", {
    key: value,
    className: `filter-button ${viewFilter === value ? "active" : ""}`,
    onClick: () => setViewFilter(value)
  }, label))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => confirmVisible(visibleRows.map(row => row.id)),
    disabled: !visibleRows.length
  }, "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07")), /*#__PURE__*/React.createElement("section", {
    className: "review-table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "review-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "col-row"
  }, "#"), /*#__PURE__*/React.createElement("th", {
    className: "col-reference"
  }, "\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 / Supplier"), /*#__PURE__*/React.createElement("th", null, "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E08\u0E32\u0E01 OCR"), /*#__PURE__*/React.createElement("th", null, "Matched Item Name"), /*#__PURE__*/React.createElement("th", {
    className: "col-quality"
  }, "\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E01\u0E32\u0E23\u0E08\u0E31\u0E1A\u0E04\u0E39\u0E48"), /*#__PURE__*/React.createElement("th", {
    className: "col-review"
  }, "\u0E1C\u0E25\u0E15\u0E23\u0E27\u0E08"))), /*#__PURE__*/React.createElement("tbody", null, visibleRows.map(row => {
    const changed = Object.keys(row.changedFields).length > 0;
    const expanded = !!expandedRows[row.id];
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: row.id
    }, /*#__PURE__*/React.createElement("tr", {
      className: row.confirmed ? "row-confirmed" : isFlagged(row) ? "row-flagged" : ""
    }, /*#__PURE__*/React.createElement("td", {
      className: "row-number"
    }, row.id), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "reference-primary"
    }, row.invoiceNo || "ไม่ระบุ Invoice No"), /*#__PURE__*/React.createElement("div", {
      className: "reference-secondary"
    }, row.supplierNameOcr || "ไม่ระบุ Supplier"), row.documentId && /*#__PURE__*/React.createElement("div", {
      className: "reference-tertiary"
    }, "ID: ", row.documentId)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("label", {
      className: "field-label"
    }, "Item Code (OCR)"), /*#__PURE__*/React.createElement("input", {
      className: `cell-input ${row.changedFields.ocrItemCode ? "changed" : ""}`,
      value: row.ocrItemCode,
      onChange: event => updateRow(row.id, "ocrItemCode", event.target.value),
      placeholder: "\u0E44\u0E21\u0E48\u0E1E\u0E1A Item Code"
    }), /*#__PURE__*/React.createElement("label", {
      className: "field-label"
    }, "Item Description (OCR)"), /*#__PURE__*/React.createElement("textarea", {
      className: `cell-textarea ${row.changedFields.ocrDesc ? "changed" : ""}`,
      value: row.ocrDesc,
      onChange: event => updateRow(row.id, "ocrDesc", event.target.value),
      rows: "3"
    })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("label", {
      className: "field-label"
    }, "Item Name \u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E1A\u0E04\u0E39\u0E48"), /*#__PURE__*/React.createElement("textarea", {
      className: `cell-textarea ${row.changedFields.matchedItemName ? "changed" : ""}`,
      value: row.matchedItemName,
      onChange: event => updateRow(row.id, "matchedItemName", event.target.value),
      rows: "4"
    }), /*#__PURE__*/React.createElement("button", {
      className: "link-button",
      onClick: () => toggleExpanded(row.id)
    }, expanded ? "ซ่อนความต่าง" : "ดูความต่างของข้อความ")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "quality-stack"
    }, /*#__PURE__*/React.createElement("span", {
      className: "quality-line"
    }, /*#__PURE__*/React.createElement("span", null, "Type"), /*#__PURE__*/React.createElement("strong", null, row.matchType || "—")), /*#__PURE__*/React.createElement("span", {
      className: "quality-line"
    }, /*#__PURE__*/React.createElement("span", null, "Confidence"), /*#__PURE__*/React.createElement("strong", null, row.confidence === "" ? "—" : `${row.confidence}%`)), /*#__PURE__*/React.createElement("span", {
      className: "quality-line"
    }, /*#__PURE__*/React.createElement("span", null, "CER"), /*#__PURE__*/React.createElement("strong", null, row.characterErrorRate === "" ? "—" : row.characterErrorRate)), /*#__PURE__*/React.createElement(StatusBadge, {
      row: row
    }), changed && /*#__PURE__*/React.createElement("span", {
      className: "badge badge-edited"
    }, "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E41\u0E25\u0E49\u0E27"))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("label", {
      className: "confirm-control"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: row.confirmed,
      onChange: event => setConfirmed(row.id, event.target.checked)
    }), /*#__PURE__*/React.createElement("span", null, row.confirmed ? "ยืนยันแล้ว" : "ยืนยันรายการ")), /*#__PURE__*/React.createElement("label", {
      className: "field-label note-label"
    }, "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38"), /*#__PURE__*/React.createElement("textarea", {
      className: "cell-textarea note-input",
      value: row.reviewNote,
      onChange: event => updateRow(row.id, "reviewNote", event.target.value),
      rows: "2",
      placeholder: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E21\u0E35\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02"
    }))), expanded && /*#__PURE__*/React.createElement("tr", {
      className: "diff-row"
    }, /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", {
      colSpan: "5"
    }, /*#__PURE__*/React.createElement(DifferencePreview, {
      ocrText: row.ocrDesc,
      matchedText: row.matchedItemName
    }))));
  }))), !visibleRows.length && /*#__PURE__*/React.createElement("div", {
    className: "no-results"
  }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E15\u0E32\u0E21\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01")), /*#__PURE__*/React.createElement("section", {
    className: "footer-actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-note"
  }, "\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E19\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 \u0E41\u0E25\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C Review Status, Review Note, Reviewed At \u0E41\u0E25\u0E30 Changed Fields"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-success btn-large",
    onClick: exportWorkbook
  }, "\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E1C\u0E25\u0E15\u0E23\u0E27\u0E08\u0E40\u0E1B\u0E47\u0E19 Excel"))) : /*#__PURE__*/React.createElement("section", {
    className: "loading-state"
  }, "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E48\u0E32\u0E19\u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C...")));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
