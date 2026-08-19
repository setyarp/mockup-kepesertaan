/* ===========================================================================
   app.js — LOGIKA APLIKASI
   ---------------------------------------------------------------------------
   Bagian ini mengatur perilaku (navigasi, validasi, render tabel).
   Untuk sekadar mengubah isi data, edit data.js — bukan file ini.
   =========================================================================== */
"use strict";

/* --------------------------------------------------------------- utilitas */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rp  = n => "Rp " + Number(n).toLocaleString("id-ID");
const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const resetFields = ids => ids.forEach(id => { const el = $(`#${id}`); if (el) el.value = ""; });

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  $("#toast").appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

/* ------------------------------------------------- salinan data yang hidup
   Data asli di data.js dibiarkan utuh; aplikasi bekerja di salinan ini
   supaya refresh browser selalu mengembalikan kondisi awal.              */
let dirtyRows  = DATA_LIST_KOTOR.map(r => ({ ...r, _err: { ...r._err } }));
let cleanRows  = [];
let saldo      = JSON.parse(JSON.stringify(DATA_SALDO));
let pumRows    = DATA_PUM.map((r, i) => ({ ...r, _id: i }));
let pelPeriods = DATA_PELUNASAN_PERIODE.map(r => ({ ...r }));
let bumRows    = DATA_BUM.map(r => ({ ...r }));
let distRows   = DATA_DISTRIBUSI.map(r => ({ ...r }));
let distOnlyBad = false;
let pmaBatchRows = DATA_PEMUTAKHIRAN_BATCH.map((r, i) => ({ ...r, _id: i }));
let peroranganRows  = DATA_PENDAFTARAN_PERORANGAN.map((r, i) => ({ ...r, _id: i }));
let uploadBatchRows = DATA_UPLOAD_BATCH.map((r, i) => ({ ...r, _id: i }));

/* ------------------------------------------------------------------ router */
function go(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  const el = $("#s-" + id);
  if (el) el.classList.add("active");
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.go === id));
  /* Buka semua grup induk (nav-parent) di sepanjang jalur menuju item yang aktif,
     supaya item tetap terlihat di sidebar meski tersarang beberapa level. */
  let climb = $(`.nav-item[data-go="${id}"]`);
  while (climb) {
    const children = climb.closest(".nav-children");
    if (!children) break;
    const parentBtn = children.previousElementSibling;
    if (parentBtn && parentBtn.classList.contains("nav-parent")) {
      parentBtn.setAttribute("aria-expanded", "true");
      children.hidden = false;
    }
    climb = parentBtn;
  }
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "instant" });
  if (id === "pelunasan") {
    $("#pel-list").style.display = "";
    $("#pel-detail").style.display = "none";
    cekJatuhTempoPelunasan();
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b && !b.disabled) go(b.dataset.go);
});
$("#burger").onclick = () => $("#sidebar").classList.toggle("open");

/* ------------------------------------------------------------------- modal */
function openModal()  { $("#modal-bg").classList.add("open");    document.body.style.overflow = "hidden"; }
function closeModal() { $("#modal-bg").classList.remove("open"); document.body.style.overflow = ""; }
$("#modal-x").onclick = closeModal;
$("#modal-bg").onclick = e => { if (e.target.id === "modal-bg") closeModal(); };
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  closeModal();
  if ($("#ru-detail-overlay").classList.contains("open")) $("#ru-detail-overlay").classList.remove("open");
});

/* ================================================================ DASHBOARD */
function renderDashboard() {
  $("#dash-metrics").innerHTML = DATA_DASHBOARD.map(m => `
    <div class="metric">
      <div class="metric-lbl">${esc(m.label)}</div>
      <div class="metric-val ${m.warna === "bad" ? "bad" : ""}">${esc(m.nilai)}</div>
      <div class="metric-sub ${esc(m.warna)}">${esc(m.sub)}</div>
    </div>`).join("");
}

/* ===================================================== SIDEBAR: expand/collapse nav-parent
   Generik untuk semua grup sub modul bertingkat (mis. Check dan Booking, Pinjaman). */
$$(".nav-parent").forEach(btn => {
  btn.onclick = () => {
    const open     = btn.getAttribute("aria-expanded") === "true";
    const children = btn.nextElementSibling;
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    if (children && children.classList.contains("nav-children")) children.hidden = open;
  };
});

/* ------------------------------------------------------ stepper 3 tahapan */
function gotoStep(n) {
  [1, 2, 3].forEach(i => {
    $("#step-" + i).style.display = i === n ? "" : "none";
    const b = $(`.step[data-step="${i}"]`);
    b.classList.toggle("active", i === n);
    b.classList.toggle("done",   i <  n);
  });
  if (n === 2) dirtyGotoView("rekap");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-step-go]").forEach(b => b.onclick = () => gotoStep(+b.dataset.stepGo));
$$(".step[data-step]").forEach(b => {
  b.onclick = () => { if (!b.disabled) gotoStep(+b.dataset.step); };
  if (b.dataset.step !== "1") b.disabled = true;
});

$("#btn-template").onclick = () => toast("Template batch peserta diunduh (contoh prototipe).");
$("#btn-upload").onclick = () => {
  $("#up-title").textContent = PENGATURAN.namaFileBatch;
  $("#up-sub").textContent = `${dirtyRows.length} baris terbaca — ${dirtyRows.length} memerlukan revisi, 0 siap disubmit`;
  $("#to-step2").disabled = false;
  $(`.step[data-step="2"]`).disabled = false;
  toast(`File tervalidasi. ${dirtyRows.length} data masuk List Kotor.`, "bad");
};
$("#to-step2").onclick = () => { renderDirtyRekap(); gotoStep(2); };
$("#to-step3").onclick = () => {
  if (dirtyRows.length) { toast(`Masih ada ${dirtyRows.length} data yang perlu direvisi.`, "bad"); return; }
  $(`.step[data-step="3"]`).disabled = false;
  renderClean(); gotoStep(3);
};
$("#btn-export-dirty").onclick = () => toast("Rekap data bermasalah diekspor ke Excel.");
$("#btn-export-rekap").onclick = () => toast("Rekap List Kotor diekspor ke Excel.");
$("#btn-export-clean").onclick = () => toast("Data siap submit diekspor ke Excel.");

/* ============================================= PEREMAJAAN DATA » PEMUTAKHIRAN DATA */

function pmdGotoView(view) {
  $("#pmd-page-head").style.display           = view === "riwayat-detail" ? "none" : "";
  $("#pmd-riwayat-view").style.display        = view === "riwayat"        ? "" : "none";
  $("#pmd-riwayat-detail-view").style.display = view === "riwayat-detail" ? "" : "none";
  $("#pmd-wizard-view").style.display         = view === "wizard"         ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let pmdRiwayatPage = 1;
function renderPmdRiwayat() {
  const fBatch  = ($("#pmd-riwayat-f-batch").value || "").toLowerCase();
  const fJenis  = $("#pmd-riwayat-f-jenis").value;
  const fStatus = $("#pmd-riwayat-f-status").value;

  const rows = pmaBatchRows.filter(r =>
    (fJenis === "all" || r.jenis === fJenis) &&
    (fStatus === "all" || r.status === fStatus) &&
    (!fBatch || r.noBatch.toLowerCase().includes(fBatch)));

  const pageSize   = +$("#pmd-riwayat-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (pmdRiwayatPage > totalPages) pmdRiwayatPage = totalPages;
  const start    = (pmdRiwayatPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#pmd-riwayat-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td class="t-strong">${esc(r.noBatch)}</td>
      <td>${esc(pemutakhiranJenisLabel(r.jenis))}</td>
      <td><span class="pill ${pillPemutakhiran(r.status)}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-pmd-riwayat-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#pmd-riwayat-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;

  $("#pmd-riwayat-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === pmdRiwayatPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-pmd-riwayat-page="${p}">${p}</button>
  `).join("");
}
renderPmdRiwayat();

function pmdShowRiwayatDetail(batch) {
  $("#pmd-riwayat-detail-sub").textContent = `${batch.noBatch} — ${pemutakhiranJenisLabel(batch.jenis)}`;
  const { head, body } = pemutakhiranRowsTableParts(batch);
  $("#pmd-riwayat-detail-head").innerHTML = head;
  $("#pmd-riwayat-detail-body").innerHTML = body;
  pmdGotoView("riwayat-detail");
}

$("#pmd-riwayat-cari").onclick = () => { pmdRiwayatPage = 1; renderPmdRiwayat(); };
$("#pmd-riwayat-page-size").onchange = () => { pmdRiwayatPage = 1; renderPmdRiwayat(); };
$("#pmd-riwayat-detail-kembali").onclick = () => pmdGotoView("riwayat");
$("#btn-export-pmd-riwayat").onclick = () => toast("Riwayat pemutakhiran data diekspor ke Excel.");
$("#btn-pmd-baru").onclick = () => {
  pmdResetUpload();
  $(`.step[data-pmd-step="2"]`).disabled = true;
  pmdGotoStep(1);
  pmdGotoView("wizard");
};
$("#pmd-batal").onclick = () => pmdGotoView("riwayat");

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-pmd-riwayat-detail]");
  if (bDetail) { pmdShowRiwayatDetail(pmaBatchRows.find(x => x._id === +bDetail.dataset.pmdRiwayatDetail)); return; }

  const bPage = e.target.closest("[data-pmd-riwayat-page]");
  if (bPage) { pmdRiwayatPage = +bPage.dataset.pmdRiwayatPage; renderPmdRiwayat(); }
});

function pmdGotoStep(n) {
  [1, 2].forEach(i => {
    $("#pmd-step-" + i).style.display = i === n ? "" : "none";
    const b = $(`.step[data-pmd-step="${i}"]`);
    b.classList.toggle("active", i === n);
    b.classList.toggle("done",   i <  n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".step[data-pmd-step]").forEach(b => {
  b.onclick = () => { if (!b.disabled) pmdGotoStep(+b.dataset.pmdStep); };
});

function pmdRenderLangkah() {
  const data = DATA_PEREMAJAAN[$("#pmd-jenis").value];
  $("#pmd-langkah").innerHTML = data.langkah.map(t => `<li>${esc(t)}</li>`).join("");
}

function pmdResetUpload() {
  $("#pmd-dropzone").classList.remove("has-file");
  $("#pmd-file-title").textContent = "Tarik file ke sini atau klik untuk memilih";
  $("#pmd-file-sub").textContent   = "Format .xlsx, maksimal 5 MB";
  $("#pmd-btn-validasi").disabled  = true;
}

$("#pmd-jenis").onchange = () => {
  $("#pmd-template-title").textContent = DATA_PEREMAJAAN[$("#pmd-jenis").value].templateNama;
  pmdRenderLangkah();
  pmdResetUpload();
};
pmdRenderLangkah();

$("#pmd-btn-template").onclick = () => toast(`${DATA_PEREMAJAAN[$("#pmd-jenis").value].templateNama} diunduh (contoh prototipe).`);

$("#pmd-dropzone").onclick = () => {
  $("#pmd-dropzone").classList.add("has-file");
  $("#pmd-file-title").textContent = `data_${$("#pmd-jenis").value}_peserta.xlsx`;
  $("#pmd-file-sub").textContent   = `${DATA_PEREMAJAAN[$("#pmd-jenis").value].rows.length} baris terbaca — siap divalidasi`;
  $("#pmd-btn-validasi").disabled  = false;
};

$("#pmd-btn-validasi").onclick = () => {
  const data  = DATA_PEREMAJAAN[$("#pmd-jenis").value];
  const total = data.rows.length;
  const valid          = data.rows.filter(r => r.status === "valid").length;
  const tanpaPerubahan = data.rows.filter(r => r.status === "tanpa-perubahan").length;
  const ditolak        = data.rows.filter(r => r.status === "ditolak").length;

  $("#pmd-metrics").innerHTML = `
    <div class="metric">
      <div class="metric-lbl">TOTAL BARIS</div>
      <div class="metric-val navy">${total}</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">VALID</div>
      <div class="metric-val ok">${valid}</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">TANPA PERUBAHAN</div>
      <div class="metric-val">${tanpaPerubahan}</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">DITOLAK</div>
      <div class="metric-val bad">${ditolak}</div>
    </div>`;

  $("#pmd-alert-warn").style.display = valid === 0 ? "" : "none";

  const rowsDitolak = data.rows.filter(r => r.status === "ditolak");
  if (rowsDitolak.length) {
    $("#pmd-error-head").innerHTML =
      `<th>Baris</th>` + data.kolomError.map(k => `<th>${esc(k)}</th>`).join("") + `<th>Alasan Ditolak</th>`;
    $("#pmd-error-body").innerHTML = rowsDitolak.map(r => `
      <tr>
        <td>${data.rows.indexOf(r) + 1}</td>
        ${r.nilai.slice(0, data.kolomError.length).map(v => `<td>${esc(v)}</td>`).join("")}
        <td class="bad-txt">${r.alasan.map(a => `• ${esc(a)}`).join("<br>")}</td>
      </tr>`).join("");
    $("#pmd-error-body").closest(".tbl-wrap").style.display = "";
    $("#pmd-error-empty").style.display = "none";
  } else {
    $("#pmd-error-body").innerHTML = "";
    $("#pmd-error-body").closest(".tbl-wrap").style.display = "none";
    $("#pmd-error-empty").style.display = "";
  }

  $("#pmd-submit").disabled = valid === 0 || ditolak > 0;

  $(`.step[data-pmd-step="2"]`).disabled = false;
  pmdGotoStep(2);
  toast(`File tervalidasi. ${valid} dari ${total} baris siap disubmit.`, valid ? "ok" : "bad");
};

$("#pmd-kembali").onclick = () => { pmdResetUpload(); pmdGotoStep(1); };

$("#pmd-export").onclick = () => toast("Rekap hasil validasi diekspor ke Excel.");

const BULAN_ID_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
function pmdFmtWaktuBatch(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getDate()} ${BULAN_ID_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pmdGenerateBatchNo(jenisKey, d) {
  const pad = n => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hms = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `PMK-${PEREMAJAAN_PREFIX[jenisKey]}-${ymd}-${hms}-${rand}`;
}

$("#pmd-submit").onclick = () => {
  if ($("#pmd-submit").disabled) return;
  const jenisKey = $("#pmd-jenis").value;
  const jenis    = DATA_PEREMAJAAN[jenisKey];
  const now      = new Date();

  pmaBatchRows.unshift({
    _id: pmaBatchRows.length ? Math.max(...pmaBatchRows.map(r => r._id)) + 1 : 0,
    noBatch:     pmdGenerateBatchNo(jenisKey, now),
    jenis:       jenisKey,
    waktu:       pmdFmtWaktuBatch(now),
    jumlahBaris: jenis.rows.length,
    status:      "Pending",
    kolom:       jenis.kolom,
    rows:        jenis.rows.map(r => ({ ...r }))
  });
  renderPeremajaanApproval();
  renderPmdRiwayat();

  toast(`Pemutakhiran "${jenis.templateNama.replace("Template ", "")}" berhasil disubmit dan diteruskan ke persetujuan.`, "ok");
  pmdResetUpload();
  $(`.step[data-pmd-step="2"]`).disabled = true;
  pmdGotoStep(1);
  pmdGotoView("riwayat");
};

/* ==================================================== PEREMAJAAN DATA » APPROVAL PEMUTAKHIRAN DATA */

function pillPemutakhiran(s) {
  return s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn";
}
function pemutakhiranJenisLabel(jenisKey) {
  return DATA_PEREMAJAAN[jenisKey] ? DATA_PEREMAJAAN[jenisKey].templateNama.replace("Template ", "") : jenisKey;
}
function pemutakhiranStatusPill(s) {
  return s === "valid" ? "pill-ok" : s === "ditolak" ? "pill-bad" : "pill-warn";
}
function pemutakhiranStatusLabel(s) {
  return s === "valid" ? "Valid" : s === "ditolak" ? "Ditolak" : "Tanpa Perubahan";
}
/* Tabel baris data yang diunggah — dipakai bersama di Detail riwayat sub
   modul Pemutakhiran Data (baca saja) dan Detail Approval Pemutakhiran Data
   (dilengkapi tombol Setujui/Tolak). */
function pemutakhiranRowsTableParts(batch) {
  const head = `<th>Baris</th>` + (batch.kolom || []).map(k => `<th>${esc(k)}</th>`).join("") + `<th>Status</th><th>Keterangan</th>`;
  const body = (batch.rows || []).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      ${r.nilai.map(v => `<td>${esc(v)}</td>`).join("")}
      <td><span class="pill ${pemutakhiranStatusPill(r.status)}">${esc(pemutakhiranStatusLabel(r.status))}</span></td>
      <td>${r.alasan ? r.alasan.map(a => `• ${esc(a)}`).join("<br>") : "-"}</td>
    </tr>`).join("");
  return { head, body };
}

function pmaGotoView(view) {
  $("#pma-page-head").style.display   = view === "detail" ? "none" : "";
  $("#pma-list-view").style.display   = view === "list"   ? "" : "none";
  $("#pma-detail-view").style.display = view === "detail" ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let pmaPage = 1;
function renderPeremajaanApproval() {
  const fBatch  = ($("#pma-f-batch").value  || "").toLowerCase();
  const fJenis  = $("#pma-f-jenis").value;
  const fStatus = $("#pma-f-status").value;

  const rows = pmaBatchRows.filter(r =>
    (fJenis === "all" || r.jenis === fJenis) &&
    (fStatus === "all" || r.status === fStatus) &&
    (!fBatch || r.noBatch.toLowerCase().includes(fBatch)));

  const pageSize   = +$("#pma-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (pmaPage > totalPages) pmaPage = totalPages;
  const start    = (pmaPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#pma-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td class="t-strong">${esc(r.noBatch)}</td>
      <td>${esc(pemutakhiranJenisLabel(r.jenis))}</td>
      <td>${esc(r.waktu)}</td>
      <td>${r.jumlahBaris}</td>
      <td><span class="pill ${pillPemutakhiran(r.status)}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-pma-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="7"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#pma-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;

  $("#pma-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === pmaPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-pma-page="${p}">${p}</button>
  `).join("");
}
renderPeremajaanApproval();

$("#pma-cari").onclick = () => { pmaPage = 1; renderPeremajaanApproval(); };
$("#pma-page-size").onchange = () => { pmaPage = 1; renderPeremajaanApproval(); };
$("#pma-detail-kembali").onclick = () => pmaGotoView("list");

function pmaShowDetail(r) {
  $("#pma-detail-sub").textContent = `${r.noBatch} — ${pemutakhiranJenisLabel(r.jenis)}`;
  const { head, body } = pemutakhiranRowsTableParts(r);
  $("#pma-detail-head").innerHTML = head;
  $("#pma-detail-body").innerHTML = body;
  $("#pma-detail-actions").innerHTML = r.status === "Pending" ? `
    <button class="btn btn-danger-solid" id="pma-tolak">✕ Tolak</button>
    <button class="btn btn-success" id="pma-setuju">✓ Setujui</button>` : "";
  pmaGotoView("detail");

  $("#pma-setuju") && ($("#pma-setuju").onclick = () => {
    pmaConfirmSetujui(r, catatan => {
      r.status = "Disetujui";
      r.catatanApproval = catatan;
      renderPeremajaanApproval();
      renderPmdRiwayat();
      pmaGotoView("list");
      toast(`Batch ${r.noBatch} disetujui.`, "ok");
    });
  });

  $("#pma-tolak") && ($("#pma-tolak").onclick = () => {
    pmaConfirmTolak(r, alasan => {
      r.status = "Ditolak";
      r.catatanApproval = alasan;
      renderPeremajaanApproval();
      renderPmdRiwayat();
      pmaGotoView("list");
      toast(`Batch ${r.noBatch} ditolak.`, "bad");
    });
  });
}

function pmaConfirmSetujui(batch, onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Persetujuan Batch";
  $("#modal-sub").textContent   = batch.noBatch;
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Catatan Persetujuan (Opsional)</label>
      <textarea class="inp" id="pma-catatan-setuju" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan catatan persetujuan (opsional)"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="pma-setuju-batal">Batal</button>
      <button class="btn btn-success" id="pma-setuju-konfirmasi">✓ Setujui</button>
    </div>`;
  openModal();
  $("#pma-setuju-batal").onclick = closeModal;
  $("#pma-setuju-konfirmasi").onclick = () => {
    const catatan = $("#pma-catatan-setuju").value.trim();
    closeModal();
    onConfirm(catatan);
  };
}
function pmaConfirmTolak(batch, onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Penolakan Batch";
  $("#modal-sub").textContent   = batch.noBatch;
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Alasan Penolakan <span class="req">*</span></label>
      <textarea class="inp" id="pma-alasan-tolak" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan alasan penolakan batch ini..."></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="pma-tolak-batal">Batal</button>
      <button class="btn btn-danger-solid" id="pma-tolak-konfirmasi">✕ Tolak Batch</button>
    </div>`;
  openModal();
  $("#pma-tolak-batal").onclick = closeModal;
  $("#pma-tolak-konfirmasi").onclick = () => {
    const alasan = $("#pma-alasan-tolak").value.trim();
    if (!alasan) { toast("Alasan penolakan wajib diisi.", "bad"); return; }
    closeModal();
    onConfirm(alasan);
  };
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-pma-detail]");
  if (bDetail) { pmaShowDetail(pmaBatchRows.find(x => x._id === +bDetail.dataset.pmaDetail)); return; }

  const bPage = e.target.closest("[data-pma-page]");
  if (bPage) { pmaPage = +bPage.dataset.pmaPage; renderPeremajaanApproval(); }
});

/* -------------------------------------------------------- List Kotor: 3 tampilan
   2a. Rekap List Kotor (per kategori kesalahan) → 2b. Daftar Peserta per
   Kesalahan → 2c. Halaman Revisi Data Peserta (bukan modal). */
let dirtyFilterMsg   = null;  // kesalahan yang sedang difilter di tampilan 2b
let dirtyRevisiIndex = null;  // index dirtyRows yang sedang direvisi di 2c

function dirtyGotoView(view) {
  $("#dirty-rekap-view").style.display  = view === "rekap"  ? "" : "none";
  $("#dirty-list-view").style.display   = view === "list"   ? "" : "none";
  $("#dirty-revisi-view").style.display = view === "revisi" ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* 2a. Rekap List Kotor — mengelompokkan dirtyRows per pesan kesalahan */
function renderDirtyRekap() {
  const jumlahPerKesalahan = {};
  dirtyRows.forEach(r => {
    if (!r._err) return;
    Object.values(r._err).forEach(msg => {
      jumlahPerKesalahan[msg] = (jumlahPerKesalahan[msg] || 0) + 1;
    });
  });
  const kesalahan = Object.entries(jumlahPerKesalahan);

  $("#dirty-rekap-body").innerHTML = kesalahan.length ? kesalahan.map(([msg, jumlah], i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(msg)}</td>
      <td>${jumlah} Data</td>
      <td><button class="btn btn-info btn-sm" data-dirty-detail="${esc(msg)}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="4"><div class="empty"><h4>Tidak ada data bermasalah</h4><p>Semua baris sudah lolos validasi.</p></div></td></tr>`;

  $("#dirty-msg").textContent = dirtyRows.length
    ? `Ditemukan ${dirtyRows.length} data pada file batch yang diupload memerlukan revisi`
    : "Semua data sudah diperbaiki. Lanjutkan ke tahap Preview & Simpan.";
  $("#dirty-alert").className = dirtyRows.length ? "alert alert-bad" : "alert alert-ok";
  $("#to-step3").disabled = dirtyRows.length > 0;
}

/* 2b. Daftar Peserta per Kesalahan — tabel sama seperti List Kotor lama,
   difilter ke baris yang mengandung pesan kesalahan yang dipilih */
function renderDirtyList() {
  $("#dirty-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("") +
    `<th class="stick-r">AKSI</th>`;

  const rows = dirtyRows.filter(r => r._err && Object.values(r._err).includes(dirtyFilterMsg));

  $("#dirty-body").innerHTML = rows.length ? rows.map(r => {
    const idx = dirtyRows.indexOf(r);
    const tds = FIELDS.map((f, i) => {
      const bad = r._err && r._err[f[0]];
      const cls = (i === 0 ? "stick-l " : "") + (i < 2 ? "t-strong" : "");
      return `<td class="${cls}" ${bad ? 'style="color:var(--red);font-weight:600"' : ""}>${esc(r[f[0]])}</td>`;
    }).join("");
    return `<tr>${tds}<td class="stick-r"><button class="btn btn-primary btn-sm btn-pill" data-revisi="${idx}">Revisi</button></td></tr>`;
  }).join("")
  : `<tr><td colspan="${FIELDS.length + 1}"><div class="empty"><h4>Tidak ada data bermasalah</h4><p>Semua baris untuk kategori ini sudah diperbaiki.</p></div></td></tr>`;

  $("#dirty-list-sub").textContent = `Kesalahan: ${dirtyFilterMsg} — ${rows.length} data`;
  $("#dirty-count").textContent = `menampilkan ${rows.length} dari ${rows.length} data bermasalah`;
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-dirty-detail]");
  if (bDetail) {
    dirtyFilterMsg = bDetail.dataset.dirtyDetail;
    renderDirtyList();
    dirtyGotoView("list");
    return;
  }
  const bRevisi = e.target.closest("[data-revisi]");
  if (bRevisi) openRevisi(+bRevisi.dataset.revisi);
});

$("#dirty-list-kembali").onclick = () => { renderDirtyRekap(); dirtyGotoView("rekap"); };

/* 2c. Halaman Revisi Data Peserta — halaman penuh (bukan modal) */
function openRevisi(i) {
  const r = dirtyRows[i];
  const badge = r._err ? Object.values(r._err)[0] : "";
  dirtyRevisiIndex = i;

  $("#dirty-revisi-sub").textContent = `Baris ${i + 1} — ${r.nama} · perbaiki field bermasalah lalu simpan`;
  $("#dirty-revisi-badge").innerHTML = badge
    ? `<div class="alert alert-bad"><span>⚠</span><span>${esc(badge)}</span></div>` : "";
  $("#dirty-revisi-fields").innerHTML = FIELDS.map(f => {
    const bad  = r._err && r._err[f[0]];
    const wide = FIELD_LEBAR.includes(f[0]) ? "span2" : "";
    return `<div class="field ${bad ? "err" : ""} ${wide}">
      <label class="fl">${esc(f[1])}</label>
      <input class="inp" data-fld="${f[0]}" value="${esc(r[f[0]])}">
      ${bad ? `<div class="err-msg">${esc(bad)}</div>` : ""}
    </div>`;
  }).join("");

  dirtyGotoView("revisi");
}

/* Kembali ke daftar peserta per kesalahan — tapi kalau kategori yang sedang
   difilter sudah kosong (semua barisnya sudah diperbaiki), langsung kembali
   ke Rekap List Kotor supaya user bisa lanjut perbaiki kategori lain.
   renderDirtyList() selalu dipanggil lebih dulu supaya #dirty-body tidak
   menyisakan baris/tombol basi (index) dari render sebelumnya. */
function dirtyBackToList() {
  renderDirtyList();
  const masihAda = dirtyRows.some(r => r._err && Object.values(r._err).includes(dirtyFilterMsg));
  if (!masihAda) {
    renderDirtyRekap();
    dirtyGotoView("rekap");
    return;
  }
  dirtyGotoView("list");
}
$("#dirty-revisi-kembali").onclick = dirtyBackToList;
$("#rev-cancel").onclick = dirtyBackToList;

$("#rev-save").onclick = () => {
  const i = dirtyRevisiIndex;
  const row = dirtyRows[i];
  $$("#dirty-revisi-fields [data-fld]").forEach(inp => row[inp.dataset.fld] = inp.value.trim());

  const kosong = FIELD_WAJIB.filter(k => !row[k]);
  if (kosong.length) {
    const label = FIELDS.filter(f => kosong.includes(f[0])).map(f => f[1]).join(", ");
    toast(`Field wajib belum diisi: ${label}.`, "bad");
    return;
  }
  if (dirtyRows.some((o, j) => j !== i && o.nrp === row.nrp)) {
    toast("NRP/NIP masih duplikat dengan baris lain.", "bad");
    return;
  }

  delete row._err;
  cleanRows.push(row);
  dirtyRows.splice(i, 1);
  toast(`Data ${row.nama} berhasil direvisi.`, "ok");
  if (!dirtyRows.length) $(`.step[data-step="3"]`).disabled = false;
  dirtyBackToList();
};

/* ----------------------------------------------------- Preview & Simpan */
function renderClean() {
  $("#clean-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("");

  $("#clean-body").innerHTML = cleanRows.length ? cleanRows.map(r =>
    `<tr>${FIELDS.map((f, i) =>
      `<td class="${i === 0 ? "stick-l " : ""}${i < 2 ? "t-strong" : ""}">${esc(r[f[0]])}</td>`
    ).join("")}</tr>`).join("")
  : `<tr><td colspan="${FIELDS.length}"><div class="empty"><h4>Belum ada data siap submit</h4><p>Revisi data di tahap List Kotor terlebih dahulu.</p></div></td></tr>`;

  $("#clean-count").textContent = `${cleanRows.length} data siap disubmit sebagai satu batch`;
  $("#btn-submit-batch").disabled = !cleanRows.length;
}

$("#btn-submit-batch").onclick = () => {
  const n = cleanRows.length;
  const now = new Date();
  const pad = v => String(v).padStart(2, "0");
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const seq = String(uploadBatchRows.length + 1).padStart(4, "0");
  const noBatch  = `B-UPLOAD/${now.getFullYear()}/${pad(now.getMonth() + 1)}${pad(now.getDate())}${seq}`;
  const noAgenda = `AG-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${seq}`;
  const kesatuanSel = $("#k-kesatuan");
  const kesatuan = kesatuanSel.options[kesatuanSel.selectedIndex] ? kesatuanSel.options[kesatuanSel.selectedIndex].text : "-";

  uploadBatchRows.unshift({
    _id: uploadBatchRows.length ? Math.max(...uploadBatchRows.map(r => r._id)) + 1 : 0,
    tglPengajuan: fmtTgl(iso),
    kesatuanPengaju: kesatuan,
    nomorBatch: noBatch,
    nomorAgenda: noAgenda,
    status: "Belum Terverifikasi",
    catatanApproval: "",
    dataPengajuan: {
      jenis: "Kolektif",
      nomorSurat: $("#k-surat").value.trim(),
      instansi: kesatuan,
      tglSurat: $("#k-tgl-surat").value ? fmtTgl($("#k-tgl-surat").value) : ""
    },
    peserta: cleanRows.map(r => ({
      ...r,
      berkas: PP3_FIXED.map(d => ({ label: d.label, file: null }))
    }))
  });
  renderUploadRiwayat();
  renderVerifikasiList();

  $("#modal-title").textContent = "Batch berhasil disubmit";
  $("#modal-sub").textContent = "Menunggu verifikasi di Verifikasi Upload";
  $("#modal-body").innerHTML = `
    <div class="alert alert-ok"><span>✓</span><span>${n} data peserta tersimpan sebagai satu batch pengajuan.</span></div>
    <div class="metrics m3" style="margin-bottom:4px">
      <div class="metric"><div class="metric-lbl">Nomor batch</div><div class="metric-val" style="font-size:14px">${noBatch}</div></div>
      <div class="metric"><div class="metric-lbl">Jumlah peserta</div><div class="metric-val">${n}</div></div>
      <div class="metric"><div class="metric-lbl">Status</div><div class="metric-val" style="font-size:14px">Belum Terverifikasi</div></div>
    </div>
    <div class="hint">Batch akan diverifikasi lebih dulu di Verifikasi Upload sebelum masuk antrean Approval Pendaftaran Peserta Baru.</div>
    <div class="form-actions">
      <button class="btn btn-primary" id="sb-close">Tutup</button>
    </div>`;
  openModal();
  $("#sb-close").onclick = () => { closeModal(); uploadGotoView("riwayat"); };
};

/* ============================== PENDAFTARAN PESERTA BARU » PERORANGAN (wizard) */
$("#pp-instansi").innerHTML = DATA_INSTANSI_PENGIRIM.map(i => `<option>${esc(i)}</option>`).join("");
$("#pp2-pangkat").innerHTML = $("#pf-pangkat").innerHTML;
$("#pp2-uker").innerHTML   += DATA_UKER.map(u => `<option>${esc(u)}</option>`).join("");
$("#pp2-kancab").innerHTML += DATA_KANTOR_CABANG.map(k => `<option>${esc(k)}</option>`).join("");

/* Validasi NRP/NIP sudah terdaftar di sistem — berlaku generik untuk field
   manapun berclass "pp-nrp-field" (form Perorangan tunggal maupun tiap blok
   Data Peserta Kolektif), pesan error tampil di ".pp-nrp-err" terdekat. */
function ppValidateNrp(input) {
  const nrp = input.value.trim();
  const err = input.closest(".field").querySelector(".pp-nrp-err");
  const sudahAda = nrp && DATA_MASTER_PESERTA.some(p => p.nrp === nrp);
  if (err) {
    err.style.display = sudahAda ? "" : "none";
    err.textContent   = sudahAda ? "NRP/NIP ini sudah terdaftar dalam sistem." : "";
  }
  input.closest(".field").classList.toggle("err", sudahAda);
  return sudahAda;
}

/* Autocomplete Desa/Kelurahan — generik untuk field berclass "pp-kelurahan-field",
   hasil gabungan kelurahan/kecamatan/kabupaten/provinsi langsung ditampilkan
   begitu satu opsi dipilih. Memilih kelurahan juga otomatis menyarankan Kantor
   Cabang terdekat (dicari dalam scope ".pp-scope" yang sama). */
document.addEventListener("input", e => {
  if (e.target.matches(".pp-nrp-field")) { ppValidateNrp(e.target); return; }
  if (e.target.matches(".pp-kelurahan-field")) {
    const input = e.target;
    const list  = input.closest(".field").querySelector(".pp-kelurahan-list");
    const q = input.value.trim().toLowerCase();
    if (!q) { list.classList.remove("open"); list.innerHTML = ""; return; }
    const hits = DATA_WILAYAH.filter(w => w.kelurahan.toLowerCase().includes(q));
    if (!hits.length) { list.classList.remove("open"); list.innerHTML = ""; return; }
    list.innerHTML = hits.map(w => `
      <div class="autocomplete-item" data-kel="${esc(w.kelurahan)}">
        ${esc(w.kelurahan)}<small>${esc(w.kecamatan)}, ${esc(w.kabupaten)}, ${esc(w.provinsi)}</small>
      </div>`).join("");
    list.classList.add("open");
  }
});
document.addEventListener("click", e => {
  const item = e.target.closest(".pp-kelurahan-list .autocomplete-item");
  if (item) {
    const listEl = item.closest(".pp-kelurahan-list");
    const scope  = listEl.closest(".pp-scope");
    const input  = scope.querySelector(".pp-kelurahan-field");
    const w = DATA_WILAYAH.find(x => x.kelurahan === item.dataset.kel);
    if (w) {
      input.value = `${w.kelurahan}, ${w.kecamatan}, ${w.kabupaten}, ${w.provinsi}`;
      const saran     = DATA_KANTOR_CABANG_MAP[w.kabupaten];
      const kancabSel = scope.querySelector(".pp-kancab-select");
      const kancabHint = scope.querySelector(".pp-kancab-saran");
      if (saran) {
        kancabSel.value = saran;
        kancabHint.style.display = "";
        kancabHint.textContent = `💡 Disarankan otomatis berdasarkan alamat (${w.kabupaten}) — bisa diubah jika perlu.`;
      } else {
        kancabHint.style.display = "none";
      }
    }
    listEl.classList.remove("open");
    return;
  }
  if (!e.target.closest(".pp-kelurahan-field")) $$(".pp-kelurahan-list").forEach(l => l.classList.remove("open"));
});

/* ---------------------------------------- Data Peserta (Kolektif): dinamis */
let ppKolektifItems = [];
let ppKolektifSeq   = 0;

function ppKolektifBlock(id, idx) {
  const fid = key => `pp2k-${key}-${id}`;
  return `
    <div class="pp2k-block pp-scope" data-pp2k="${id}" style="padding:18px 0;border-top:1px solid var(--line-soft)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="t-strong pp2k-block-title" style="font-size:12px;color:var(--body)">Data Peserta #${idx + 2}</div>
        <button class="link-danger" data-pp2k-hapus="${id}">✕ Hapus</button>
      </div>
      <div class="form-2col">
        <div>
          <div class="field">
            <label class="fl caps">Nama Lengkap sesuai KTP <span class="req">*</span></label>
            <input class="inp" id="${fid("nama")}" placeholder="ADI WIJAYA">
          </div>
          <div class="field">
            <label class="fl caps">NRP / NIP <span class="req">*</span></label>
            <input class="inp pp-nrp-field" id="${fid("nrp")}" placeholder="199204051234">
            <div class="err-msg pp-nrp-err" style="display:none"></div>
          </div>
          <div class="field">
            <label class="fl caps">NIK <span class="req">*</span></label>
            <input class="inp" id="${fid("nik")}" placeholder="16 digit angka">
          </div>
          <div class="field">
            <label class="fl caps">NPWP</label>
            <input class="inp" id="${fid("npwp")}" placeholder="00.000.000.0-000.000">
          </div>
          <div class="grid2">
            <div class="field">
              <label class="fl caps">Jenis Kelamin <span class="req">*</span></label>
              <select class="inp" id="${fid("jk")}">
                <option value="">— Pilih —</option>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            <div class="field">
              <label class="fl caps">Tanggal Lahir <span class="req">*</span></label>
              <input class="inp" type="date" id="${fid("tgl-lahir")}">
            </div>
          </div>
          <div class="field">
            <label class="fl caps">Tempat Lahir</label>
            <input class="inp" id="${fid("tmp-lahir")}" placeholder="Kota kelahiran">
          </div>
          <div class="field">
            <label class="fl caps">Status Personil <span class="req">*</span></label>
            <select class="inp" id="${fid("status")}">
              <option value="">— Pilih —</option>
              <option>Prajurit</option><option>PNS</option><option>Purnawirawan</option><option>Pensiunan</option>
            </select>
          </div>
          <div class="field">
            <label class="fl caps">Angkatan <span class="req">*</span></label>
            <select class="inp" id="${fid("angkatan")}">
              <option value="">— Pilih —</option>
              <option>TNI AD</option><option>TNI AL</option><option>TNI AU</option><option>Polri</option><option>PNS Kemhan</option>
            </select>
          </div>
          <div class="field">
            <label class="fl caps">Unit Organisasi (UNOR) <span class="req">*</span></label>
            <select class="inp" id="${fid("unor")}">
              <option value="">— Pilih —</option>
              <option>Mabes TNI</option><option>Mabes TNI AD</option><option>Mabes TNI AL</option>
              <option>Mabes TNI AU</option><option>Mabes Polri</option><option>Kementerian Pertahanan</option>
            </select>
          </div>
          <div class="field">
            <label class="fl caps">Unit Kerja (UKER) <span class="req">*</span></label>
            <select class="inp" id="${fid("uker")}">
              <option value="">— Pilih —</option>
              ${DATA_UKER.map(u => `<option>${esc(u)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label class="fl caps">Pangkat Awal <span class="req">*</span></label>
            <select class="inp" id="${fid("pangkat")}">${$("#pf-pangkat").innerHTML}</select>
          </div>
          <div class="field">
            <label class="fl caps">TMT Pengangkatan <span class="req">*</span></label>
            <input class="inp" type="date" id="${fid("tmt")}">
          </div>
          <div class="field">
            <label class="fl caps">Nomor SKEP Pengangkatan <span class="req">*</span></label>
            <input class="inp" id="${fid("nomor-skep")}" placeholder="SKEP/xxx/…/2026">
          </div>
          <div class="field">
            <label class="fl caps">Tanggal SKEP Pengangkatan <span class="req">*</span></label>
            <input class="inp" type="date" id="${fid("tgl-skep")}">
          </div>
        </div>
        <div>
          <div class="field">
            <label class="fl caps">Alamat</label>
            <textarea class="inp" id="${fid("alamat")}" style="height:80px;padding:8px 10px" placeholder="Nama jalan, nomor rumah"></textarea>
          </div>
          <div class="grid2">
            <div class="field"><label class="fl caps">RT</label><input class="inp" id="${fid("rt")}" placeholder="02"></div>
            <div class="field"><label class="fl caps">RW</label><input class="inp" id="${fid("rw")}" placeholder="05"></div>
          </div>
          <div class="field" style="position:relative">
            <label class="fl caps">Desa/Kelurahan</label>
            <input class="inp pp-kelurahan-field" id="${fid("kelurahan")}" placeholder="Cari nama kelurahan..." autocomplete="off">
            <div class="autocomplete-list pp-kelurahan-list"></div>
            <div class="hint">Hasil menampilkan kelurahan, kecamatan, kota/kabupaten, dan provinsi — pilih satu, sisanya terisi otomatis.</div>
          </div>
          <div class="grid2">
            <div class="field"><label class="fl caps">Kode Pos</label><input class="inp" id="${fid("kodepos")}" placeholder="10410"></div>
            <div class="field"><label class="fl caps">Nomor Telepon</label><input class="inp" id="${fid("telp")}" placeholder="081234567890"></div>
          </div>
          <div class="field">
            <label class="fl caps">Email</label>
            <input class="inp" type="email" id="${fid("email")}" placeholder="nama@email.com">
          </div>
          <div class="field">
            <label class="fl caps">Kantor Cabang <span class="req">*</span></label>
            <select class="inp pp-kancab-select" id="${fid("kancab")}">
              <option value="">— Pilih —</option>
              ${DATA_KANTOR_CABANG.map(k => `<option>${esc(k)}</option>`).join("")}
            </select>
            <div class="hint pp-kancab-saran" style="display:none"></div>
          </div>
        </div>
      </div>
    </div>`;
}

/* Bangun ulang SELURUH daftar dari nol — hanya dipakai saat kosong (render
   awal / setelah reset). Menambah & menghapus satu blok TIDAK lewat sini,
   supaya input yang sudah diisi di blok lain tidak ikut hilang. */
function renderPpKolektif() {
  $("#pp2k-list").innerHTML = ppKolektifItems.map((id, idx) => ppKolektifBlock(id, idx)).join("");
  $("#pp2k-empty").style.display = ppKolektifItems.length ? "none" : "";
}
renderPpKolektif();

function ppKolektifRenumber() {
  $$("#pp2k-list .pp2k-block").forEach((el, idx) => {
    el.querySelector(".pp2k-block-title").textContent = `Data Peserta #${idx + 2}`;
  });
}

$("#pp2k-tambah").onclick = () => {
  const id = ++ppKolektifSeq;
  ppKolektifItems.push(id);
  $("#pp2k-list").insertAdjacentHTML("beforeend", ppKolektifBlock(id, ppKolektifItems.length - 1));
  $("#pp2k-empty").style.display = "none";
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-pp2k-hapus]");
  if (!b) return;
  const id = +b.dataset.pp2kHapus;
  ppKolektifItems = ppKolektifItems.filter(x => x !== id);
  b.closest(".pp2k-block").remove();
  ppKolektifRenumber();
  $("#pp2k-empty").style.display = ppKolektifItems.length ? "none" : "";
});


function ppGotoStep(n) {
  [1, 2, 3, 4].forEach(i => {
    $("#pp-step-" + i).style.display = i === n ? "" : "none";
    const b = $(`.step[data-pp-step="${i}"]`);
    b.classList.toggle("active", i === n);
    b.classList.toggle("done",   i <  n);
  });
  if (n === 4) renderPp4Review();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$(".step[data-pp-step]").forEach(b => {
  b.onclick = () => { if (!b.disabled) ppGotoStep(+b.dataset.ppStep); };
});

/* Field wajib di step "Data Peserta" — [id, label untuk pesan validasi] */
const PP2_WAJIB = [
  ["pp2-nama", "Nama Lengkap sesuai KTP"], ["pp2-nrp", "NRP/NIP"], ["pp2-nik", "NIK"],
  ["pp2-jk", "Jenis Kelamin"], ["pp2-tgl-lahir", "Tanggal Lahir"],
  ["pp2-status", "Status Personil"], ["pp2-angkatan", "Angkatan"],
  ["pp2-unor", "Unit Organisasi (UNOR)"], ["pp2-uker", "Unit Kerja (UKER)"],
  ["pp2-pangkat", "Pangkat Awal"], ["pp2-tmt", "TMT Pengangkatan"],
  ["pp2-nomor-skep", "Nomor SKEP Pengangkatan"], ["pp2-tgl-skep", "Tanggal SKEP Pengangkatan"],
  ["pp2-kancab", "Kantor Cabang"]
];
const PP2_ALL_IDS = [...PP2_WAJIB.map(f => f[0]),
  "pp2-npwp", "pp2-tmp-lahir", "pp2-alamat", "pp2-rt", "pp2-rw", "pp2-kelurahan",
  "pp2-kodepos", "pp2-telp", "pp2-email"];

/* Sama seperti PP2_WAJIB tapi berupa suffix key mentah — dipakai untuk
   memvalidasi tiap blok "Data Peserta #N" di mode Kolektif (id field blok =
   pp2k-<key>-<id>). */
const PP2_WAJIB_KEYS = [
  ["nama", "Nama Lengkap sesuai KTP"], ["nrp", "NRP/NIP"], ["nik", "NIK"],
  ["jk", "Jenis Kelamin"], ["tgl-lahir", "Tanggal Lahir"],
  ["status", "Status Personil"], ["angkatan", "Angkatan"],
  ["unor", "Unit Organisasi (UNOR)"], ["uker", "Unit Kerja (UKER)"],
  ["pangkat", "Pangkat Awal"], ["tmt", "TMT Pengangkatan"],
  ["nomor-skep", "Nomor SKEP Pengangkatan"], ["tgl-skep", "Tanggal SKEP Pengangkatan"],
  ["kancab", "Kantor Cabang"]
];

/* ---------------------------------------------- step 3: Berkas Persyaratan */
const PP3_ICON = `<span class="doc-ico" style="width:34px;height:34px;border-radius:8px;background:var(--blue-soft);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">📄</span>`;

const PP3_FIXED = [
  { key:"ktp",          label:"KTP",                          wajib:true,  note:"scan berwarna yang terbaca jelas" },
  { key:"pengangkatan", label:"Surat Pengangkatan Pertama",    wajib:true,  note:"salinan SK pengangkatan pertama" },
  { key:"pengantar",    label:"Surat Pengantar",               wajib:false, note:"diterbitkan instansi/kesatuan pengirim" }
];
let pp3Fixed   = {};
let pp3Dynamic = [];
let pp3NextId  = 1;

function renderPp3Fixed() {
  $("#pp3-fixed-list").innerHTML = PP3_FIXED.map(d => `
    <div class="doc-row">
      <div class="doc-info">
        ${PP3_ICON}
        <div>
          <div class="doc-label">${esc(d.label)}</div>
          <div class="hint" style="margin:1px 0 0">${d.wajib ? "Wajib" : "Opsional"} — ${esc(d.note)}</div>
        </div>
      </div>
      <div class="doc-actions">
        ${pp3Fixed[d.key]
          ? `<span class="pill pill-ok">${esc(pp3Fixed[d.key])}</span>
             <button class="btn btn-ghost btn-sm" data-pp3-fixed-hapus="${d.key}">✕ Hapus</button>`
          : `<label class="btn btn-ghost btn-sm">⬆ Pilih File
               <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" data-pp3-fixed-file="${d.key}">
             </label>`}
      </div>
    </div>`).join("");
}

function renderPp3Dynamic() {
  $("#pp3-dynamic-list").innerHTML = pp3Dynamic.map(row => `
    <div class="doc-row">
      <div class="doc-info" style="flex:1;min-width:240px">
        ${PP3_ICON}
        <select class="inp" style="max-width:340px" data-pp3-select="${row.id}">
          <option value="">— Pilih dokumen —</option>
          ${DATA_BERKAS_SARAN.map(d => `<option ${d === row.nama ? "selected" : ""}>${esc(d)}</option>`).join("")}
        </select>
      </div>
      <div class="doc-actions">
        ${row.file
          ? `<span class="pill pill-ok">${esc(row.file)}</span>
             <button class="btn btn-ghost btn-sm" data-pp3-hapus-file="${row.id}">✕ Hapus</button>`
          : `<label class="btn btn-ghost btn-sm">⬆ Pilih File
               <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" data-pp3-file="${row.id}">
             </label>`}
        <button class="btn btn-ghost btn-sm" data-pp3-hapus-row="${row.id}" title="Hapus baris">🗑</button>
      </div>
    </div>`).join("");
}
renderPp3Fixed();
renderPp3Dynamic();

/* ------------------------------------------------- step 4: Review & Simpan */
function ppReviewRow(label, value) {
  return `<div class="review-row">
    <div class="fl caps">${esc(label)}</div>
    <div class="val">${esc(value || "-")}</div>
  </div>`;
}
function ppReviewRowFile(label, filename) {
  return `<div class="review-row">
    <div class="fl caps">${esc(label)}</div>
    <div class="val" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span>${esc(filename || "Belum diunggah")}</span>
      ${filename ? `<button class="btn btn-ghost btn-sm" type="button" data-preview-name="${esc(filename)}">👁 Preview</button>` : ""}
    </div>
  </div>`;
}
/* Daftar field [key,label] untuk "Data Peserta" perorangan (dataPeserta /
   satu entri pesertaList) — dipakai untuk ringkasan baca DAN mode edit. */
const PP_PESERTA_FIELDS = [
  ["nama", "Nama Lengkap sesuai KTP"], ["nrp", "NRP/NIP"], ["nik", "NIK"],
  ["npwp", "NPWP"], ["jk", "Jenis Kelamin"], ["tglLahir", "Tanggal Lahir"],
  ["tmpLahir", "Tempat Lahir"], ["status", "Status Personil"], ["angkatan", "Angkatan"],
  ["unor", "Unit Organisasi (UNOR)"], ["uker", "Unit Kerja (UKER)"], ["pangkat", "Pangkat Awal"],
  ["tmt", "TMT Pengangkatan"], ["nomorSkep", "Nomor SKEP Pengangkatan"], ["tglSkep", "Tanggal SKEP Pengangkatan"],
  ["alamat", "Alamat"], ["rt", "RT"], ["rw", "RW"], ["kelurahan", "Desa/Kelurahan"],
  ["kodepos", "Kode Pos"], ["telp", "Nomor Telepon"], ["email", "Email"], ["kancab", "Kantor Cabang"]
];
/* Baris ringkasan "Data Peserta" dari objek data tersimpan (dataPeserta /
   satu entri pesertaList) — dipakai di Detail Approval Perorangan dan di
   Detail riwayat sub modul Perorangan. */
function ppPesertaObjRows(p) {
  return PP_PESERTA_FIELDS.map(([k, label]) => ppReviewRow(label, p[k])).join("");
}

/* ---------------------------------------------- mode edit inline di Approval
   Satu "section" (Data Pengajuan / Data Peserta) bisa ditoggle ke mode edit:
   klik Edit -> baris jadi <input>, Simpan Perubahan menulis balik ke obj
   sumber & merender ulang, Batal membatalkan tanpa menyimpan. `fields` =
   [{key,label}]. `preamble` = HTML baris baca-saja tetap (field struktural
   seperti Nomor Agenda/Nomor Batch yang tidak ikut ditoggle ke mode edit). */
function apprEditSection({ headId, bodyId, obj, fields, preamble }) {
  function renderRead() {
    $(`#${bodyId}`).innerHTML = (preamble || "") + fields.map(f => ppReviewRow(f.label, obj[f.key])).join("");
    $(`#${headId}`).innerHTML = `<button class="btn btn-ghost btn-sm" type="button">✎ Edit</button>`;
    $(`#${headId} button`).onclick = renderEdit;
  }
  function renderEdit() {
    $(`#${bodyId}`).innerHTML = (preamble || "") + fields.map(f => `
        <div class="review-row">
          <div class="fl caps">${esc(f.label)}</div>
          <input class="inp" style="margin-top:2px" data-edit-key="${esc(f.key)}" value="${esc(obj[f.key] || "")}">
        </div>`
    ).join("");
    $(`#${headId}`).innerHTML = `
      <button class="btn btn-ghost btn-sm" type="button" id="${headId}-batal">Batal</button>
      <button class="btn btn-success btn-sm" type="button" id="${headId}-simpan">✓ Simpan Perubahan</button>`;
    $(`#${headId}-batal`).onclick  = renderRead;
    $(`#${headId}-simpan`).onclick = () => {
      $$(`#${bodyId} [data-edit-key]`).forEach(inp => { obj[inp.dataset.editKey] = inp.value.trim(); });
      renderRead();
      toast("Perubahan disimpan.", "ok");
    };
  }
  renderRead();
}

/* Sama seperti apprEditSection tapi untuk array berkas [{label,file}] — mode
   edit menawarkan ganti file per baris (tetap simpan nama file lama jika
   tidak diganti). Array berkas aktif per bodyId didaftarkan di
   apprBerkasRegistry supaya listener perubahan file cukup satu, terpasang
   sekali di top-level (bukan dipasang ulang tiap kali section dirender). */
let apprBerkasRegistry = {};
function apprEditBerkas(headId, bodyId, berkasArr) {
  apprBerkasRegistry[bodyId] = berkasArr;
  function renderRead() {
    $(`#${bodyId}`).innerHTML = berkasArr.length
      ? berkasArr.map(b => ppReviewRowFile(b.label, b.file)).join("")
      : `<div class="empty" style="padding:20px"><p>Tidak ada berkas tercatat.</p></div>`;
    $(`#${headId}`).innerHTML = `<button class="btn btn-ghost btn-sm" type="button">✎ Edit</button>`;
    $(`#${headId} button`).onclick = renderEdit;
  }
  function renderEdit() {
    $(`#${bodyId}`).innerHTML = berkasArr.map((b, idx) => `
      <div class="review-row">
        <div class="fl caps">${esc(b.label)}</div>
        <div class="val" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span data-berkas-name="${idx}">${esc(b.file || "Belum diunggah")}</span>
          <label class="btn btn-ghost btn-sm">⬆ Ganti File<input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" data-berkas-file="${idx}"></label>
        </div>
      </div>`).join("");
    $(`#${headId}`).innerHTML = `
      <button class="btn btn-ghost btn-sm" type="button" id="${headId}-batal">Batal</button>
      <button class="btn btn-success btn-sm" type="button" id="${headId}-simpan">✓ Simpan Perubahan</button>`;
    $(`#${headId}-batal`).onclick  = renderRead;
    $(`#${headId}-simpan`).onclick = () => { renderRead(); toast("Perubahan disimpan.", "ok"); };
  }
  renderRead();
}
document.addEventListener("change", e => {
  const inp = e.target.closest("[data-berkas-file]");
  if (!inp || !inp.files[0]) return;
  const body = inp.closest(".review-card-body");
  const arr  = body && apprBerkasRegistry[body.id];
  if (!arr) return;
  arr[+inp.dataset.berkasFile].file = inp.files[0].name;
  const span = body.querySelector(`[data-berkas-name="${inp.dataset.berkasFile}"]`);
  if (span) span.textContent = inp.files[0].name;
});
function ppVal(id) { return $(`#${id}`).value.trim(); }
function ppSelText(id) {
  const el = $(`#${id}`);
  return el.value ? el.options[el.selectedIndex].text : "";
}
function ppDateID(id) {
  const v = $(`#${id}`).value;
  return v ? fmtTgl(v) : "";
}

function ppPesertaFieldRows(idOf) {
  return [
    ppReviewRow("Nama Lengkap sesuai KTP", ppVal(idOf("nama"))),
    ppReviewRow("NRP/NIP", ppVal(idOf("nrp"))),
    ppReviewRow("NIK", ppVal(idOf("nik"))),
    ppReviewRow("NPWP", ppVal(idOf("npwp"))),
    ppReviewRow("Jenis Kelamin", ppSelText(idOf("jk"))),
    ppReviewRow("Tanggal Lahir", ppDateID(idOf("tgl-lahir"))),
    ppReviewRow("Tempat Lahir", ppVal(idOf("tmp-lahir"))),
    ppReviewRow("Status Personil", ppSelText(idOf("status"))),
    ppReviewRow("Angkatan", ppSelText(idOf("angkatan"))),
    ppReviewRow("Unit Organisasi (UNOR)", ppSelText(idOf("unor"))),
    ppReviewRow("Unit Kerja (UKER)", ppSelText(idOf("uker"))),
    ppReviewRow("Pangkat Awal", ppSelText(idOf("pangkat"))),
    ppReviewRow("TMT Pengangkatan", ppDateID(idOf("tmt"))),
    ppReviewRow("Nomor SKEP Pengangkatan", ppVal(idOf("nomor-skep"))),
    ppReviewRow("Tanggal SKEP Pengangkatan", ppDateID(idOf("tgl-skep"))),
    ppReviewRow("Alamat", ppVal(idOf("alamat"))),
    ppReviewRow("RT", ppVal(idOf("rt"))),
    ppReviewRow("RW", ppVal(idOf("rw"))),
    ppReviewRow("Desa/Kelurahan", ppVal(idOf("kelurahan"))),
    ppReviewRow("Kode Pos", ppVal(idOf("kodepos"))),
    ppReviewRow("Nomor Telepon", ppVal(idOf("telp"))),
    ppReviewRow("Email", ppVal(idOf("email"))),
    ppReviewRow("Kantor Cabang", ppSelText(idOf("kancab")))
  ].join("");
}

function renderPp4Review() {
  const kolektif = ppKolektifItems.length > 0;
  $("#pp4-review-pengajuan").innerHTML = [
    ppReviewRow("Jenis Pendaftaran Baru", kolektif ? "Kolektif" : "Perorangan"),
    ppReviewRow("Nomor Agenda", $("#pp-nomor-agenda").value || "Otomatis oleh sistem"),
    ppReviewRow("Nomor Surat Pengantar", ppVal("pp-nomor-surat")),
    ppReviewRow("Kesatuan Pengaju", ppVal("pp-instansi") || ppSelText("pp-instansi")),
    ppReviewRow("Tanggal Surat Pengantar", ppDateID("pp-tgl-surat"))
  ].join("");

  const pesertaCard = (title, fid) => `
    <div class="review-card" style="margin-top:16px">
      <div class="review-card-head">${esc(title)}</div>
      <div class="review-card-body">${ppPesertaFieldRows(fid)}</div>
    </div>`;
  $("#pp4-review-peserta").innerHTML =
    pesertaCard("Data Peserta 1", k => `pp2-${k}`) +
    ppKolektifItems.map((id, idx) => pesertaCard(`Data Peserta ${idx + 2}`, k => `pp2k-${k}-${id}`)).join("");

  const berkasRows = [
    ...PP3_FIXED.map(d => ppReviewRow(d.label, pp3Fixed[d.key] || "Belum diunggah")),
    ...pp3Dynamic.filter(r => r.nama).map(row => ppReviewRow(row.nama || "(dokumen belum dipilih)", row.file || "Belum diunggah"))
  ];
  $("#pp4-review-berkas").innerHTML = berkasRows.join("");
}

$("#pp3-tambah").onclick = () => {
  pp3Dynamic.push({ id: pp3NextId++, nama: "", file: null });
  renderPp3Dynamic();
};

document.addEventListener("change", e => {
  const sel = e.target.closest("[data-pp3-select]");
  if (sel) {
    const row = pp3Dynamic.find(r => r.id === +sel.dataset.pp3Select);
    if (row) row.nama = sel.value;
    return;
  }
  const fileInp = e.target.closest("[data-pp3-file]");
  if (fileInp && fileInp.files[0]) {
    const row = pp3Dynamic.find(r => r.id === +fileInp.dataset.pp3File);
    if (row) { row.file = fileInp.files[0].name; renderPp3Dynamic(); }
    return;
  }
  const fixedInp = e.target.closest("[data-pp3-fixed-file]");
  if (fixedInp && fixedInp.files[0]) {
    pp3Fixed[fixedInp.dataset.pp3FixedFile] = fixedInp.files[0].name;
    renderPp3Fixed();
  }
});

document.addEventListener("click", e => {
  const hapusRow = e.target.closest("[data-pp3-hapus-row]");
  if (hapusRow) { pp3Dynamic = pp3Dynamic.filter(r => r.id !== +hapusRow.dataset.pp3HapusRow); renderPp3Dynamic(); return; }

  const hapusFile = e.target.closest("[data-pp3-hapus-file]");
  if (hapusFile) {
    const row = pp3Dynamic.find(r => r.id === +hapusFile.dataset.pp3HapusFile);
    if (row) { row.file = null; renderPp3Dynamic(); }
    return;
  }

  const hapusFixed = e.target.closest("[data-pp3-fixed-hapus]");
  if (hapusFixed) {
    pp3Fixed[hapusFixed.dataset.pp3FixedHapus] = null;
    renderPp3Fixed();
  }
});

$("#pp-3-reset").onclick = () => {
  pp3Fixed = {};
  pp3Dynamic = [];
  renderPp3Fixed();
  renderPp3Dynamic();
};

function ppResetAll() {
  $("#pp-nomor-surat").value = "";
  $("#pp-tgl-surat").value   = "";
  $("#pp-instansi").value    = DATA_INSTANSI_PENGIRIM[0];
  PP2_ALL_IDS.forEach(id => $(`#${id}`).value = "");
  $("#pp2-nrp-err").style.display = "none";
  $("#pp2-nrp").closest(".field").classList.remove("err");
  $("#pp2-kancab-saran").style.display = "none";
  ppKolektifItems = [];
  renderPpKolektif();
  pp3Fixed = {};
  pp3Dynamic = [];
  renderPp3Fixed();
  renderPp3Dynamic();
  [2, 3, 4].forEach(n => $(`.step[data-pp-step="${n}"]`).disabled = true);
}

$("#pp-1-lanjut").onclick = () => {
  $(`.step[data-pp-step="2"]`).disabled = false;
  ppGotoStep(2);
};
$("#pp-2-kembali").onclick = () => ppGotoStep(1);
$("#pp-2-lanjut").onclick = () => {
  const kolektif = ppKolektifItems.length > 0;
  const label1 = kolektif ? "Data Peserta 1: " : "";

  const kosong = PP2_WAJIB.filter(f => !$(`#${f[0]}`).value.trim());
  if (kosong.length) {
    toast(`${label1}Field wajib belum diisi: ${kosong.map(f => f[1]).join(", ")}.`, "bad");
    return;
  }
  if ($("#pp2-nrp-err").style.display !== "none") {
    toast(`${label1}NRP/NIP sudah terdaftar dalam sistem — periksa kembali.`, "bad");
    return;
  }

  if (kolektif) {
    for (let i = 0; i < ppKolektifItems.length; i++) {
      const id = ppKolektifItems[i];
      const kosong2 = PP2_WAJIB_KEYS.filter(([k]) => !$(`#pp2k-${k}-${id}`).value.trim());
      if (kosong2.length) {
        toast(`Data Peserta #${i + 2}: field wajib belum diisi (${kosong2.map(f => f[1]).join(", ")}).`, "bad");
        return;
      }
      const nrpInput = $(`#pp2k-nrp-${id}`);
      if (ppValidateNrp(nrpInput)) {
        toast(`Data Peserta #${i + 2}: NRP/NIP sudah terdaftar dalam sistem — periksa kembali.`, "bad");
        return;
      }
    }
  }

  $(`.step[data-pp-step="3"]`).disabled = false;
  ppGotoStep(3);
};
$("#pp-3-kembali").onclick = () => ppGotoStep(2);
$("#pp-3-lanjut").onclick = () => {
  const kurang = PP3_FIXED.filter(d => d.wajib && !pp3Fixed[d.key]);
  if (kurang.length) {
    toast(`Berkas wajib belum diunggah: ${kurang.map(d => d.label).join(", ")}.`, "bad");
    return;
  }
  $(`.step[data-pp-step="4"]`).disabled = false;
  ppGotoStep(4);
};
$("#pp-4-kembali").onclick = () => ppGotoStep(3);
$("#pp-4-simpan").onclick = () => {
  const kolektif = ppKolektifItems.length > 0;
  const now  = new Date();
  const pad  = v => String(v).padStart(2, "0");
  const iso  = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const tglOrDash = id => $(`#${id}`).value ? fmtTgl($(`#${id}`).value) : "";
  const berkas = [
    ...PP3_FIXED.map(d => ({ label: d.label, file: pp3Fixed[d.key] || null })),
    ...pp3Dynamic.filter(r => r.nama).map(r => ({ label: r.nama, file: r.file || null }))
  ];
  const dataPengajuan = {
    jenis: kolektif ? "Kolektif" : "Perorangan",
    nomorSurat: $("#pp-nomor-surat").value.trim(),
    instansi: $("#pp-instansi").value,
    tglSurat: tglOrDash("pp-tgl-surat")
  };

  if (kolektif) {
    const seq = String(peroranganRows.filter(r => r.jenis === "Kolektif").length + 1).padStart(4, "0");
    const nomorBatch = `B-PERO/${now.getFullYear()}/${pad(now.getMonth() + 1)}${pad(now.getDate())}${seq}`;
    const buildPeserta = fid => ({
      nama: $(`#${fid("nama")}`).value.trim(), nrp: $(`#${fid("nrp")}`).value.trim(), nik: $(`#${fid("nik")}`).value.trim(),
      npwp: $(`#${fid("npwp")}`).value.trim(), jk: $(`#${fid("jk")}`).value, tglLahir: tglOrDash(fid("tgl-lahir")),
      tmpLahir: $(`#${fid("tmp-lahir")}`).value.trim(), status: $(`#${fid("status")}`).value, angkatan: $(`#${fid("angkatan")}`).value,
      unor: $(`#${fid("unor")}`).value, uker: $(`#${fid("uker")}`).value, pangkat: $(`#${fid("pangkat")}`).value,
      tmt: tglOrDash(fid("tmt")), nomorSkep: $(`#${fid("nomor-skep")}`).value.trim(),
      tglSkep: tglOrDash(fid("tgl-skep")),
      alamat: $(`#${fid("alamat")}`).value.trim(), rt: $(`#${fid("rt")}`).value.trim(), rw: $(`#${fid("rw")}`).value.trim(),
      kelurahan: $(`#${fid("kelurahan")}`).value.trim(), kodepos: $(`#${fid("kodepos")}`).value.trim(),
      telp: $(`#${fid("telp")}`).value.trim(), email: $(`#${fid("email")}`).value.trim(), kancab: $(`#${fid("kancab")}`).value
    });
    const pesertaList = [
      buildPeserta(k => `pp2-${k}`),
      ...ppKolektifItems.map(id => buildPeserta(k => `pp2k-${k}-${id}`))
    ];

    peroranganRows.unshift({
      _id: peroranganRows.length ? Math.max(...peroranganRows.map(r => r._id)) + 1 : 0,
      tglPengajuan: fmtTgl(iso),
      kesatuanPengaju: $("#pp-instansi").value || "-",
      nomorBatch,
      nomorAgenda: `AG-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(peroranganRows.length + 1).padStart(4, "0")}`,
      jenis: "Kolektif",
      approvalStatus: "Tertunda",
      catatanApproval: "",
      dataPengajuan,
      pesertaList,
      berkas
    });
    renderPeroranganRiwayat();
    toast(`Pengajuan ${pesertaList.length} peserta (kolektif) diajukan ke Kabid Pulminpes.`, "ok");
  } else {
    const nama = $("#pp2-nama").value.trim() || "peserta";

    peroranganRows.unshift({
      _id: peroranganRows.length ? Math.max(...peroranganRows.map(r => r._id)) + 1 : 0,
      tglPengajuan: fmtTgl(iso),
      kesatuanPengaju: $("#pp-instansi").value || "-",
      nomorBatch: "-",
      nomorAgenda: `AG-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(peroranganRows.length + 1).padStart(4, "0")}`,
      jenis: "Perorangan",
      approvalStatus: "Tertunda",
      catatanApproval: "",
      dataPengajuan,
      dataPeserta: {
        nama: $("#pp2-nama").value.trim(), nrp: $("#pp2-nrp").value.trim(), nik: $("#pp2-nik").value.trim(),
        npwp: $("#pp2-npwp").value.trim(), jk: $("#pp2-jk").value, tglLahir: tglOrDash("pp2-tgl-lahir"),
        tmpLahir: $("#pp2-tmp-lahir").value.trim(), status: $("#pp2-status").value, angkatan: $("#pp2-angkatan").value,
        unor: $("#pp2-unor").value, uker: $("#pp2-uker").value, pangkat: $("#pp2-pangkat").value,
        tmt: tglOrDash("pp2-tmt"), nomorSkep: $("#pp2-nomor-skep").value.trim(),
        tglSkep: tglOrDash("pp2-tgl-skep"),
        alamat: $("#pp2-alamat").value.trim(), rt: $("#pp2-rt").value.trim(), rw: $("#pp2-rw").value.trim(),
        kelurahan: $("#pp2-kelurahan").value.trim(), kodepos: $("#pp2-kodepos").value.trim(),
        telp: $("#pp2-telp").value.trim(), email: $("#pp2-email").value.trim(), kancab: $("#pp2-kancab").value
      },
      berkas
    });
    renderApprovalList();
    renderPeroranganRiwayat();
    toast(`Pengajuan ${nama} diajukan ke Kabid Pulminpes.`, "ok");
  }
  ppResetAll();
  ppGotoStep(1);
  peroranganGotoView("riwayat");
};

/* ==================== PENDAFTARAN PESERTA BARU » PERORANGAN — riwayat & detail */
let ppRiwayatPage = 1;

function peroranganGotoView(view) {
  $("#pp-page-head").style.display           = view === "riwayat-detail" ? "none" : "";
  $("#pp-riwayat-view").style.display        = view === "riwayat"        ? "" : "none";
  $("#pp-riwayat-detail-view").style.display = view === "riwayat-detail" ? "" : "none";
  $("#pp-wizard-view").style.display         = view === "wizard"         ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPeroranganRiwayat() {
  const fBatch    = ($("#pp-riwayat-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#pp-riwayat-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#pp-riwayat-f-kesatuan").value || "").toLowerCase();
  const fStatus   = $("#pp-riwayat-f-status").value;
  const fTanggal  = $("#pp-riwayat-f-tanggal").value;

  const rows = peroranganRows.filter(r =>
    (fStatus === "all" || r.approvalStatus === fStatus) &&
    (!fBatch    || r.nomorBatch.toLowerCase().includes(fBatch)) &&
    (!fAgenda   || r.nomorAgenda.toLowerCase().includes(fAgenda)) &&
    (!fKesatuan || r.kesatuanPengaju.toLowerCase().includes(fKesatuan)) &&
    (!fTanggal  || fmtTgl(fTanggal) === r.tglPengajuan));

  const pageSize   = +$("#pp-riwayat-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (ppRiwayatPage > totalPages) ppRiwayatPage = totalPages;
  const start    = (ppRiwayatPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#pp-riwayat-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(r.tglPengajuan)}</td>
      <td class="t-strong">${esc(r.nomorBatch)}</td>
      <td>${esc(r.nomorAgenda)}</td>
      <td>${esc(r.kesatuanPengaju)}</td>
      <td>${r.berkas.filter(b => b.file).length}</td>
      <td><span class="pill ${pillPendaftaranStatus(r.approvalStatus)}">${esc(r.approvalStatus.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-pp-riwayat-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Belum ada pengajuan</h4><p>Klik "+ Pendaftaran Peserta Baru" untuk memulai.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#pp-riwayat-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;
  $("#pp-riwayat-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === ppRiwayatPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-pp-riwayat-page="${p}">${p}</button>
  `).join("");
}
$("#pp-riwayat-cari").onclick        = () => { ppRiwayatPage = 1; renderPeroranganRiwayat(); };
$("#pp-riwayat-page-size").onchange  = () => { ppRiwayatPage = 1; renderPeroranganRiwayat(); };
$("#btn-export-pp-riwayat").onclick  = () => toast("Riwayat pendaftaran peserta baru diekspor ke Excel.");
$("#btn-pp-baru").onclick = () => {
  ppResetAll();
  ppGotoStep(1);
  peroranganGotoView("wizard");
};
$("#pp-riwayat-detail-kembali").onclick = () => peroranganGotoView("riwayat");
$("#pp-1-batal").onclick = () => peroranganGotoView("riwayat");

function renderPeroranganRiwayatDetail(r) {
  const kolektif = r.jenis === "Kolektif";
  $("#pp-riwayat-detail-sub").textContent = kolektif
    ? `${r.nomorBatch} — ${r.pesertaList.length} peserta`
    : `${r.dataPeserta.nama} — ${r.nomorAgenda}`;

  renderProgressSteps("pp-riwayat-detail-progress", ppProgressSteps(r.approvalStatus));

  $("#pp-riwayat-detail-pengajuan").innerHTML = [
    ppReviewRow("Jenis Pendaftaran Baru", r.dataPengajuan.jenis),
    ppReviewRow("Nomor Agenda", r.nomorAgenda),
    ppReviewRow("Nomor Batch", r.nomorBatch),
    ppReviewRow("Nomor Surat Pengantar", r.dataPengajuan.nomorSurat),
    ppReviewRow("Kesatuan Pengaju", r.dataPengajuan.instansi),
    ppReviewRow("Tanggal Surat Pengantar", r.dataPengajuan.tglSurat)
  ].join("");

  const pesertaCard = (title, obj) => `
    <div class="review-card" style="margin-top:16px">
      <div class="review-card-head">${esc(title)}</div>
      <div class="review-card-body">${ppPesertaObjRows(obj)}</div>
    </div>`;
  $("#pp-riwayat-detail-peserta-wrap").innerHTML = !kolektif
    ? pesertaCard("Data Peserta", r.dataPeserta)
    : r.pesertaList.map((p, idx) => pesertaCard(`Data Peserta ${idx + 1}`, p)).join("");

  $("#pp-riwayat-detail-berkas").innerHTML = r.berkas.map(b => ppReviewRowFile(b.label, b.file)).join("");
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-pp-riwayat-detail]");
  if (bDetail) {
    renderPeroranganRiwayatDetail(peroranganRows.find(x => x._id === +bDetail.dataset.ppRiwayatDetail));
    peroranganGotoView("riwayat-detail");
    return;
  }
  const bPage = e.target.closest("[data-pp-riwayat-page]");
  if (bPage) { ppRiwayatPage = +bPage.dataset.ppRiwayatPage; renderPeroranganRiwayat(); }
});

/* ============================================================ ALOKASI DANA */
const angkaSaja = v => (v || "").replace(/\D/g, "");
const parseNum  = v => Number(angkaSaja(v)) || 0;

function isiPilihanKesatuan() {
  const opsi = Object.entries(saldo).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  $("#al-kesatuan").innerHTML = `<option value="">— Pilih kesatuan —</option>` + opsi;
  $("#k-kesatuan").innerHTML  = opsi;
  $("#al-tahun").innerHTML    = DATA_TAHUN.map(t => `<option>${esc(t)}</option>`).join("");
}

$("#al-kesatuan").onchange = e => {
  const k = saldo[e.target.value];
  const box = $("#al-saldo");
  if (!k) { box.style.display = "none"; return; }
  box.style.display = "flex";
  $("#al-saldo-lbl").textContent = `· Saldo alokasi dana KPR (PUM) — ${k.label}`;
  $("#al-saldo-val").textContent = rp(k.saldo);
  cekAlokasi();
};
$("#al-nominal").oninput = e => {
  const n = angkaSaja(e.target.value);
  e.target.value = n ? Number(n).toLocaleString("id-ID") : "";
  cekAlokasi();
};

function cekAlokasi() {
  const k = saldo[$("#al-kesatuan").value];
  if (!k) return;
  const n = parseNum($("#al-nominal").value);
  const box = $("#al-saldo"), hint = $("#al-hint");
  const lebih = n > k.saldo;
  box.classList.toggle("low", lebih);
  if (!n)         { hint.textContent = "Sisa saldo setelah alokasi akan terupdate otomatis."; hint.style.color = ""; }
  else if (lebih) { hint.textContent = `Nominal melebihi saldo tersedia (${rp(k.saldo)}).`;   hint.style.color = "var(--red)"; }
  else            { hint.textContent = `Sisa saldo setelah alokasi: ${rp(k.saldo - n)}`;      hint.style.color = "var(--green-ink)"; }
}

$("#al-simpan").onclick = () => {
  const k = saldo[$("#al-kesatuan").value];
  const n = parseNum($("#al-nominal").value);
  if (!k)          { toast("Pilih kesatuan terlebih dahulu.", "bad"); return; }
  if (!n)          { toast("Nominal alokasi dana belum diisi.", "bad"); return; }
  if (n > k.saldo) { toast("Nominal melebihi saldo tersedia.", "bad"); return; }
  k.saldo -= n;
  $("#al-saldo-val").textContent = rp(k.saldo);
  $("#al-nominal").value = "";
  cekAlokasi();
  toast(`Alokasi ${rp(n)} untuk ${k.label} tersimpan.`, "ok");
};
$("#al-batal").onclick = () => {
  $("#al-kesatuan").value = "";
  $("#al-nominal").value  = "";
  $("#al-saldo").style.display = "none";
  go("dashboard");
};

/* ========================================================= PARAMETER PLAFON */
let plafonRows = DATA_PARAMETER_PLAFON.map((r, i) => ({ ...r, _id: i }));
let plafonSeq  = plafonRows.length;

function renderPlafon() {
  $("#plafon-body").innerHTML = plafonRows.length ? plafonRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.angkatan)}</td>
      <td>${esc(r.golongan)}</td>
      <td>${rp(r.nominal)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-plafon-ubah="${r._id}">✎ Ubah</button>
        <button class="btn btn-danger-solid btn-sm" data-plafon-hapus="${r._id}">Hapus</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="5"><div class="empty"><h4>Belum ada data plafon</h4><p>Klik "+ Input Plafon" untuk menambahkan.</p></div></td></tr>`;
}

function plafonForm(existing) {
  $("#modal-title").textContent = existing ? "Ubah Plafon" : "Input Plafon";
  $("#modal-sub").textContent   = "Parameter Plafon PUM KPR";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Angkatan <span class="req">*</span></label>
      <select class="inp" id="plafon-angkatan">
        <option value="">Pilih angkatan</option>
        ${ANGKATAN_PLAFON.map(a => `<option ${existing && existing.angkatan === a ? "selected" : ""}>${esc(a)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Golongan Kepangkatan <span class="req">*</span></label>
      <select class="inp" id="plafon-golongan">
        <option value="">Pilih golongan kepangkatan</option>
        ${GOLONGAN_KEPANGKATAN.map(g => `<option ${existing && existing.golongan === g ? "selected" : ""}>${esc(g)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Nominal Plafon <span class="req">*</span></label>
      <div class="money"><span>Rp</span><input class="inp" id="plafon-nominal" inputmode="numeric" placeholder="0" value="${existing ? Number(existing.nominal).toLocaleString("id-ID") : ""}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="plafon-batal">Batal</button>
      <button class="btn btn-primary" id="plafon-simpan">Simpan</button>
    </div>`;
  openModal();

  $("#plafon-nominal").oninput = e => {
    const n = angkaSaja(e.target.value);
    e.target.value = n ? Number(n).toLocaleString("id-ID") : "";
  };
  $("#plafon-batal").onclick = closeModal;
  $("#plafon-simpan").onclick = () => {
    const angkatan = $("#plafon-angkatan").value;
    const golongan = $("#plafon-golongan").value;
    const nominal  = parseNum($("#plafon-nominal").value);
    if (!angkatan) { toast("Angkatan belum dipilih.", "bad"); return; }
    if (!golongan) { toast("Golongan Kepangkatan belum dipilih.", "bad"); return; }
    if (!nominal)  { toast("Nominal Plafon belum diisi.", "bad"); return; }
    const dup = plafonRows.find(r => r.angkatan === angkatan && r.golongan === golongan && (!existing || r._id !== existing._id));
    if (dup) { toast(`Plafon untuk angkatan ${angkatan} — ${golongan} sudah ada — silakan Ubah data yang sudah ada.`, "bad"); return; }

    if (existing) {
      existing.angkatan = angkatan; existing.golongan = golongan; existing.nominal = nominal;
      toast(`Plafon ${angkatan} — ${golongan} berhasil diubah.`, "ok");
    } else {
      plafonRows.push({ _id: plafonSeq++, angkatan, golongan, nominal });
      toast(`Plafon ${angkatan} — ${golongan} berhasil ditambahkan.`, "ok");
    }
    closeModal();
    renderPlafon();
  };
}
$("#plafon-input").onclick = () => plafonForm(null);

document.addEventListener("click", e => {
  const bUbah = e.target.closest("[data-plafon-ubah]");
  if (bUbah) { plafonForm(plafonRows.find(r => r._id === +bUbah.dataset.plafonUbah)); return; }
  const bHapus = e.target.closest("[data-plafon-hapus]");
  if (bHapus) {
    const r = plafonRows.find(x => x._id === +bHapus.dataset.plafonHapus);
    if (!r) return;
    if (!confirm(`Hapus plafon untuk angkatan ${r.angkatan}?`)) return;
    plafonRows = plafonRows.filter(x => x._id !== r._id);
    renderPlafon();
    toast(`Plafon ${r.angkatan} dihapus.`, "ok");
  }
});
renderPlafon();

/* ================================================================= PUM KPR */
const pillPum = s => s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : s === "Submitted" ? "pill-info" : "pill-warn";

function renderPum() {
  const fKpa  = ($("#pum-f-kpa").value  || "").toLowerCase();
  const fNpwp = ($("#pum-f-npwp").value || "").toLowerCase();
  const fNama = ($("#pum-f-nama").value || "").toLowerCase();
  const fNrp  = ($("#pum-f-nrp").value  || "").toLowerCase();
  const fSt   = $("#pum-filter").value;

  const rows = pumRows.filter(r =>
    (fSt === "all" || r.status === fSt) &&
    (!fKpa  || r.kpa.toLowerCase().includes(fKpa))   &&
    (!fNpwp || r.npwp.toLowerCase().includes(fNpwp)) &&
    (!fNama || r.nama.toLowerCase().includes(fNama)) &&
    (!fNrp  || r.nrp.toLowerCase().includes(fNrp)));

  $("#pum-body").innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td class="t-strong">${esc(r.kpa)}</td><td>${esc(r.nrp)}</td><td>${esc(r.npwp)}</td>
      <td class="t-name">${esc(r.nama)}</td><td>${esc(r.angkatan)}</td><td>${esc(r.tglAmbil)}</td>
      <td>${esc(r.tipePum)}</td><td>${esc(r.tipeRumah)}</td>
      <td><span class="pill ${pillPum(r.status)}">${esc(r.status)}</span></td>
      <td>${rp(r.jumlah)}</td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-info btn-sm"          data-pum-detail="${r._id}">Detail</button>
        <button class="btn btn-primary btn-sm"       data-pum-ubah="${r._id}">Ubah</button>
        <button class="btn btn-danger-solid btn-sm"  data-pum-hapus="${r._id}">Hapus</button>
        <button class="btn btn-success btn-sm"       data-pum-submit="${r._id}">Submit</button>
      </td>
    </tr>`).join("")
  : `<tr><td colspan="11"><div class="empty"><h4>Tidak ada pengajuan</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  $("#pum-count").textContent = `menampilkan ${rows.length} dari ${pumRows.length} pengajuan`;
}
["#pum-f-kpa", "#pum-f-npwp", "#pum-f-nama", "#pum-f-nrp"].forEach(sel => $(sel).oninput = renderPum);
$("#pum-filter").onchange = renderPum;
$("#btn-export-pum").onclick  = () => toast("Daftar pengajuan KPR (PUM) diekspor ke Excel.");

/* ---------------------------------------------------------- pengajuan baru */
$("#btn-ajukan-pum").onclick = () => {
  $("#pum-baru-kpa").value = "";
  $("#pum-baru-hasil").style.display = "none";
  $("#pum-baru-hasil").innerHTML = "";
  go("pum-baru");
};
$("#pum-baru-kembali").onclick = () => go("pum");

function showAlertPopup(title, msg, sub = "") {
  $("#modal-title").textContent = title;
  $("#modal-sub").textContent = sub;
  $("#modal-body").innerHTML = `
    <div class="alert alert-bad"><span>⚠</span><span>${esc(msg)}</span></div>
    <div class="form-actions"><button class="btn btn-primary" id="pum-val-close">Tutup</button></div>`;
  openModal();
  $("#pum-val-close").onclick = closeModal;
}
const pumValidasiPopup = msg => showAlertPopup("Validasi Nomor KPA", msg, "Pengajuan Baru PUM KPR");

$("#pum-baru-cari").onclick = () => {
  const kpa = $("#pum-baru-kpa").value.trim();
  if (!kpa) { toast("Nomor KPA belum diisi.", "bad"); return; }

  $("#pum-baru-hasil").style.display = "none";
  $("#pum-baru-hasil").innerHTML = "";

  /* Nomor KPA yang sudah ada di daftar pengajuan tidak boleh diajukan ulang */
  const existing = pumRows.find(x => x.kpa.toLowerCase() === kpa.toLowerCase());
  if (existing) {
    pumValidasiPopup(existing.status === "Draft"
      ? `Nomor KPA ${existing.kpa} tidak dapat melanjutkan Pengajuan KPR (PUM) karena data masih dalam proses Pengajuan KPR (PUM).`
      : `Nomor KPA ${existing.kpa} tidak dapat melanjutkan Pengajuan KPR (PUM) karena data sudah pernah diinput.`);
    return;
  }

  const found = DATA_MASTER_PESERTA.find(x => x.kpa.toLowerCase() === kpa.toLowerCase());
  if (!found) {
    toast(`Nomor KPA "${kpa}" tidak ditemukan pada sistem ASABRI.`, "bad");
    return;
  }

  $("#pum-baru-hasil").style.display = "";
  $("#pum-baru-hasil").innerHTML = `
    <div class="alert alert-ok"><span>✓</span><span>Data peserta ditemukan dan terisi otomatis dari sistem.</span></div>
    <div class="grid3" style="grid-template-columns:1fr 1fr;margin-top:16px">
      <div class="field"><label class="fl">Nama</label><div class="t-strong">${esc(found.nama)}</div></div>
      <div class="field"><label class="fl">NRP/NIP</label><div>${esc(found.nrp)}</div></div>
      <div class="field"><label class="fl">NPWP</label><div>${esc(found.npwp)}</div></div>
      <div class="field"><label class="fl">Angkatan</label><div>${esc(found.angkatan)}</div></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="pum-baru-lanjut">Lanjutkan →</button>
    </div>`;
  toast(`Data peserta ${found.nama} berhasil diambil dari sistem.`, "ok");

  $("#pum-baru-lanjut").onclick = () => bukaFormPeserta(found);
};

/* ---------------------------------------------------- wizard: langkah/step */
const PF_STEPS = ["Data Peserta", "Kepangkatan", "Tipe KPR (PUM)", "Detail Pengajuan", "Pratinjau dan Simpan"];
let pfStep = 1;

function renderWizard() {
  $("#pf-wizard").innerHTML = PF_STEPS.map((label, i) => {
    const n = i + 1;
    const cls = n < pfStep ? "done" : n === pfStep ? "active" : "";
    const num = n < pfStep ? "✓" : n;
    const line = n < PF_STEPS.length ? `<div class="wizard-line"></div>` : "";
    return `<div class="wizard-step ${cls}"><div class="wizard-num">${num}</div><div class="wizard-lbl">${esc(label)}</div></div>${line}`;
  }).join("");
}

function pfGoStep(n) {
  pfStep = n;
  renderWizard();
  $("#pf-step-1").style.display = n === 1 ? "" : "none";
  $("#pf-step-2").style.display = n === 2 ? "" : "none";
  $("#pf-step-3").style.display = n === 3 ? "" : "none";
  $("#pf-step-4").style.display = n === 4 ? "" : "none";
  $("#pf-step-6").style.display = n === 5 ? "" : "none";
  renderPfSaldo();
  if (n === 2) renderKpRiwayatDb();
  if (n === 4) { renderStep4(); renderStep5(); }
  if (n === 5) renderStep6();
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* Semua field teks/tanggal/dropdown wizard yang bisa direkam & dipulihkan
   ulang untuk mode "Ubah" — sengaja tidak termasuk 4 field "Terisi Otomatis"
   di setiap tipe (KTPA/Pangkat/UKER/Jumlah PUM) karena itu dihitung ulang
   otomatis dari pfFound + Pangkat setiap kali langkah 4 dirender. */
const PF_TEXT_FIELD_IDS = [
  "pf-ktpa", "pf-nrp", "pf-nama", "pf-tempat-lahir", "pf-tgl-lahir",
  "pf-jk", "pf-kawin", "pf-nik", "pf-hp", "pf-pangkat",
  "pf-alamat", "pf-rt", "pf-rw", "pf-kelurahan", "pf-kecamatan", "pf-kabupaten", "pf-provinsi", "pf-kodepos",
  "pf4-nama-perumahan", "pf4-nama-developer", "pf4-alamat-perumahan", "pf4-tipe-rumah",
  "pf4-blok-rumah", "pf4-kelurahan", "pf4-kecamatan", "pf4-kabupaten", "pf4-provinsi",
  "pf4-jenis-kredit", "pf4-bank-kredit", "pf4-nomor-akad", "pf4-tgl-akad",
  "pf4-nama-rekening", "pf4-nomor-rekening", "pf4-mitra-bayar", "pf4-cabang-mitra", "pf4-catatan",
  "pf4pm-jenis-hak", "pf4pm-atas-nama", "pf4pm-nomor-hak", "pf4pm-tgl-hak",
  "pf4pm-nama-perumahan", "pf4pm-nama-developer", "pf4pm-alamat-perumahan", "pf4pm-tipe-rumah",
  "pf4pm-blok-rumah", "pf4pm-kelurahan", "pf4pm-kecamatan", "pf4pm-kabupaten", "pf4pm-provinsi",
  "pf4pm-nama-rekening", "pf4pm-nomor-rekening", "pf4pm-mitra-bayar", "pf4pm-cabang-mitra", "pf4pm-catatan",
  "pf4mr-jenis-hak", "pf4mr-atas-nama", "pf4mr-nomor-hak", "pf4mr-tgl-hak",
  "pf4mr-alamat-baru", "pf4mr-rt", "pf4mr-rw", "pf4mr-kelurahan", "pf4mr-kecamatan", "pf4mr-kabupaten", "pf4mr-provinsi",
  "pf4mr-nama-rekening", "pf4mr-nomor-rekening", "pf4mr-mitra-bayar", "pf4mr-cabang-mitra", "pf4mr-catatan"
];
const PF_FILE_FIELD_IDS = [
  "pf4-file-akad", "pf4-file-buku", "pf4pm-file-hak", "pf4pm-file-buku",
  "pf4mr-file-hak", "pf4mr-file-pbg", "pf4mr-file-buku"
];

function setFileInputEl(input, file) {
  if (!input) return;
  if (!file) { input.value = ""; return; }
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

/* ---------------------------------------------------- wizard: data peserta */
let pfFound       = null;
let pumEditingRow = null;   // baris yang sedang diedit lewat tombol "Ubah" (null = pengajuan baru)

/* Integrasi Parameter Plafon/Alokasi Dana — memetakan Angkatan peserta ke
   kunci kesatuan pada saldo Alokasi Dana KPR (PUM) (lihat DATA_SALDO). */
function pfKesatuanKey(angkatan) {
  if (!angkatan) return null;
  if (/^TNI/i.test(angkatan))    return "mabes-tni";
  if (/polri/i.test(angkatan))   return "mabes-polri";
  if (/kemhan/i.test(angkatan))  return "kemhan";
  return null;
}
function renderPfSaldo() {
  const key = pfFound ? pfKesatuanKey(pfFound.angkatan) : null;
  const k   = key ? saldo[key] : null;
  if (!k) { $("#pf-saldo").style.display = "none"; return; }
  $("#pf-saldo").style.display = "flex";
  $("#pf-saldo-lbl").textContent = `· Saldo Alokasi Dana KPR (PUM) — ${k.label}`;
  $("#pf-saldo-val").textContent = rp(k.saldo);
}

function bukaFormPeserta(found) {
  pumEditingRow = null;
  pfFound = found;
  $("#pf-ktpa").value        = found.kpa;
  $("#pf-nrp").value         = found.nrp;
  $("#pf-nama").value        = found.nama;
  $("#pf-tempat-lahir").value = "";
  $("#pf-tgl-lahir").value   = "";
  $("#pf-jk").value          = "";
  $("#pf-kawin").value       = "";
  $("#pf-nik").value         = "";
  $("#pf-hp").value          = "";
  $("#pf-pangkat").value     = "";
  resetFields(["pf-alamat", "pf-rt", "pf-rw", "pf-kelurahan", "pf-kecamatan", "pf-kabupaten", "pf-provinsi", "pf-kodepos"]);

  riwayatItems = [];
  renderRiwayat();

  pfSelectTipe("Kredit Rumah");
  resetFields([
    "pf4-nama-perumahan", "pf4-nama-developer", "pf4-alamat-perumahan", "pf4-tipe-rumah",
    "pf4-blok-rumah", "pf4-kelurahan", "pf4-kecamatan", "pf4-kabupaten", "pf4-provinsi",
    "pf4-jenis-kredit", "pf4-bank-kredit",
    "pf4-nomor-akad", "pf4-tgl-akad", "pf4-file-akad", "pf4-catatan",
    "pf4-nama-rekening", "pf4-nomor-rekening", "pf4-mitra-bayar", "pf4-cabang-mitra", "pf4-file-buku",

    "pf4pm-jenis-hak", "pf4pm-atas-nama", "pf4pm-nomor-hak", "pf4pm-tgl-hak", "pf4pm-file-hak",
    "pf4pm-nama-perumahan", "pf4pm-nama-developer", "pf4pm-alamat-perumahan", "pf4pm-tipe-rumah",
    "pf4pm-blok-rumah", "pf4pm-kelurahan", "pf4pm-kecamatan", "pf4pm-kabupaten", "pf4pm-provinsi",
    "pf4pm-catatan",
    "pf4pm-nama-rekening", "pf4pm-nomor-rekening", "pf4pm-mitra-bayar", "pf4pm-cabang-mitra", "pf4pm-file-buku",

    "pf4mr-jenis-hak", "pf4mr-atas-nama", "pf4mr-nomor-hak", "pf4mr-tgl-hak",
    "pf4mr-alamat-baru", "pf4mr-rt", "pf4mr-rw", "pf4mr-kelurahan", "pf4mr-kecamatan", "pf4mr-kabupaten", "pf4mr-provinsi",
    "pf4mr-catatan",
    "pf4mr-nama-rekening", "pf4mr-nomor-rekening", "pf4mr-mitra-bayar", "pf4mr-cabang-mitra", "pf4mr-file-buku"
  ]);

  pf5RenderedTipe = null;
  pf5Uploaded = {};

  pfGoStep(1);
  go("pum-form");
}

/* Buka wizard yang sama, tapi terisi ulang dengan data pengajuan yang sudah
   ada — dipakai oleh tombol "Ubah" di Daftar Pengajuan KPR (PUM). */
function extractDetailField(row, label) {
  if (!row.detail) return "";
  for (const g of row.detail.detailGroups) {
    const f = g.fields.find(x => x.label === label);
    if (f) return f.value === "-" ? "" : f.value;
  }
  return "";
}

function openEditWizard(row) {
  pumEditingRow = row;
  pfFound = {
    kpa: row.kpa, nrp: row.nrp, npwp: row.npwp, nama: row.nama, angkatan: row.angkatan,
    uker: extractDetailField(row, "UKER") || "-", plafonPum: row.jumlah
  };

  if (row.raw) {
    PF_TEXT_FIELD_IDS.forEach(id => { const el = $(`#${id}`); if (el) el.value = row.raw.fields[id] || ""; });
    PF_FILE_FIELD_IDS.forEach(id => setFileInputEl($(`#${id}`), row.raw.files[id] || null));

    riwayatItems = [];
    renderRiwayat();
    row.raw.riwayat.forEach(rw => {
      const id = ++riwayatSeq;
      riwayatItems.push(id);
      $("#riwayat-list").insertAdjacentHTML("beforeend", riwayatBlock(id, riwayatItems.length - 1));
      $("#riwayat-empty").style.display = "none";
      const block = $(`.riwayat-block[data-riwayat="${id}"]`);
      const inp   = block.querySelectorAll("input");
      inp[0].value = rw.nomorSkep; inp[1].value = rw.tmt; inp[2].value = rw.tglSkep;
      setFileInputEl(inp[3], rw.file);
      const sel = block.querySelector("select");
      if (sel) sel.value = rw.pangkat || "";
    });

    pfSelectTipe(row.raw.tipePum || row.tipePum || "Kredit Rumah");

    pf5RenderedTipe = null;
    renderStep5();
    pf5Uploaded = {};
    Object.entries(row.raw.docs || {}).forEach(([idx, file]) => {
      if (!file) return;
      pf5Uploaded[idx] = file;
      const pillEl = $(`#pf5-status-${idx}`);
      if (pillEl) { pillEl.className = "pill pill-ok"; pillEl.textContent = "Terunggah"; }
    });
    updatePf5Progress();
  } else {
    /* Pengajuan lama tanpa data lengkap — isi identitas dasar saja. */
    resetFields(PF_TEXT_FIELD_IDS);
    PF_FILE_FIELD_IDS.forEach(id => setFileInputEl($(`#${id}`), null));
    riwayatItems = [];
    renderRiwayat();
    pfSelectTipe(row.tipePum || "Kredit Rumah");
    pf5RenderedTipe = null;
    pf5Uploaded = {};
    renderStep5();
  }

  /* Jaring pengaman: identitas peserta (KTPA/NRP-NIP/Nama) tidak boleh
     kosong sepulang dari "Ubah", walau snapshot-nya tidak lengkap. */
  if (!$("#pf-ktpa").value.trim()) $("#pf-ktpa").value = row.kpa  || "";
  if (!$("#pf-nrp").value.trim())  $("#pf-nrp").value  = row.nrp  || "";
  if (!$("#pf-nama").value.trim()) $("#pf-nama").value = row.nama || "";

  pfGoStep(1);
  go("pum-form");
}

const pfExitTarget = () => pumEditingRow ? "pum" : "pum-baru";
$("#pf-kembali-atas").onclick = () => go(pfExitTarget());
$("#pf-kembali").onclick      = () => go(pfExitTarget());
$("#pf-cek-nik").onclick = () => {
  const nik = $("#pf-nik").value.trim();
  if (!/^\d{16}$/.test(nik)) {
    showAlertPopup("Validasi NIK", "NIK Tidak Valid. NIK harus terdiri dari 16 digit angka.");
    return;
  }
  toast("NIK valid.", "ok");
};

$("#pf-lanjut").onclick = () => {
  if (!$("#pf-ktpa").value.trim() || !$("#pf-nrp").value.trim()) {
    toast("KTPA dan NRP/NIP wajib diisi.", "bad"); return;
  }
  if (!$("#pf-nik").value.trim()) { toast("NIK wajib diisi.", "bad"); return; }
  if (!$("#pf-pangkat").value) { toast("Pangkat belum dipilih.", "bad"); return; }

  pfGoStep(2);
};


/* ---------------------------------------------------- wizard: kepangkatan */
let riwayatItems = [];
let riwayatSeq   = 0;

function riwayatBlock(id, idx) {
  return `
    <div class="riwayat-block" data-riwayat="${id}" style="padding:16px 0;border-top:1px solid var(--line-soft)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="t-strong riwayat-block-title" style="font-size:12px;color:var(--body)">Update Kepangkatan Peserta #${idx + 1}</div>
        <button class="link-danger" data-riwayat-hapus="${id}">✕ Hapus</button>
      </div>
      <div class="grid3" style="grid-template-columns:1fr 1fr">
        <div class="field">
          <label class="fl">Pangkat</label>
          <select class="inp">${$("#pf-pangkat").innerHTML}</select>
        </div>
        <div class="field">
          <label class="fl">Nomor SKEP Pengangkatan</label>
          <input class="inp" placeholder="Contoh: KEP/123/IV/2022">
        </div>
        <div class="field">
          <label class="fl">TMT Pengangkatan</label>
          <input class="inp" type="date">
        </div>
        <div class="field">
          <label class="fl">Tanggal SKEP Pengangkatan</label>
          <input class="inp" type="date">
        </div>
        <div class="field">
          <label class="fl">Unggah Fotocopy SKEP Pengangkatan</label>
          <label class="upload-zone" style="padding:16px">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none">
            <div class="upload-ico" style="font-size:18px;margin-bottom:4px">⬆</div>
            <div style="font-weight:600;font-size:11.5px">Klik atau seret file ke sini</div>
            <div class="hint" style="margin-top:2px">PDF, JPG, PNG - maks.5 MB</div>
          </label>
        </div>
      </div>
    </div>`;
}

/* Bangun ulang SELURUH daftar dari nol — hanya dipakai saat kosong (render
   awal / setelah reset). Menambah & menghapus satu blok TIDAK lewat sini,
   supaya input yang sudah diisi di blok lain tidak ikut hilang. */
function renderRiwayat() {
  $("#riwayat-list").innerHTML = riwayatItems.map((id, idx) => riwayatBlock(id, idx)).join("");
  $("#riwayat-empty").style.display = riwayatItems.length ? "none" : "";
}

function riwayatRenumber() {
  $$("#riwayat-list .riwayat-block").forEach((el, idx) => {
    el.querySelector(".riwayat-block-title").textContent = `Update Kepangkatan Peserta #${idx + 1}`;
  });
}

$("#btn-tambah-riwayat").onclick = () => {
  const id = ++riwayatSeq;
  riwayatItems.push(id);
  $("#riwayat-list").insertAdjacentHTML("beforeend", riwayatBlock(id, riwayatItems.length - 1));
  $("#riwayat-empty").style.display = "none";
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-riwayat-hapus]");
  if (!b) return;
  const id = +b.dataset.riwayatHapus;
  riwayatItems = riwayatItems.filter(x => x !== id);
  b.closest(".riwayat-block").remove();
  riwayatRenumber();
  $("#riwayat-empty").style.display = riwayatItems.length ? "none" : "";
});

/* Tampilkan nama file begitu dipilih, di dalam kotak unggah manapun */
document.addEventListener("change", e => {
  if (!e.target.matches('input[type="file"]')) return;
  const zone = e.target.closest(".upload-zone");
  const file = e.target.files[0];
  if (!zone || !file) return;
  let note = zone.querySelector(".upload-filename");
  if (!note) {
    note = document.createElement("div");
    note.className = "upload-filename";
    note.style.cssText = "margin-top:8px;font-size:11px;color:var(--navy);font-weight:600";
    zone.appendChild(note);
  }
  note.textContent = "✓ " + file.name;
});

$("#pf2-kembali").onclick = () => pfGoStep(1);
$("#pf2-lanjut").onclick  = () => pfGoStep(3);

/* ---------------------------------------------------- wizard: tipe kpr (pum) */
let pfTipePum = "Kredit Rumah";

function pfSelectTipe(tipe) {
  pfTipePum = tipe;
  $$(".tipe-card").forEach(c => c.classList.toggle("selected", c.dataset.tipe === tipe));
}

document.addEventListener("click", e => {
  const c = e.target.closest(".tipe-card");
  if (!c) return;
  pfSelectTipe(c.dataset.tipe);
});

$("#pf3-kembali").onclick = () => pfGoStep(2);
$("#pf3-lanjut").onclick = () => pfGoStep(4);

/* ---------------------------------------------------- wizard: detail pengajuan */
const PF4_LABEL = {
  "Kredit Rumah":                   "Kredit Rumah",
  "Pembelian Rumah Secara Mandiri": "Pembelian Rumah Secara Mandiri",
  "Membangun Rumah":                "Membangun Rumah"
};
/* Tiap tipe punya panel + prefix id field sendiri */
const PF4_PANEL = {
  "Kredit Rumah":                   { panel: "pf4-kredit-rumah",      prefix: "pf4"   },
  "Pembelian Rumah Secara Mandiri": { panel: "pf4-pembelian-mandiri", prefix: "pf4pm" },
  "Membangun Rumah":                { panel: "pf4-membangun-rumah",   prefix: "pf4mr" }
};

/* Integrasi Parameter Plafon: Plafon di "Data Peserta (Terisi Otomatis)"
   mengikuti nominal yang sudah diatur di sub modul Parameter Plafon sesuai
   Angkatan peserta + Golongan Kepangkatan dari Pangkat yang dipilih. Kalau
   kombinasinya belum diatur di Parameter Plafon, jatuh kembali ke plafon
   bawaan peserta (pfFound.plafonPum). */
function pf4NormAngkatan(angkatan) {
  if (!angkatan) return null;
  if (/^tni-ad$/i.test(angkatan)) return "TNI-AD";
  if (/^tni-al$/i.test(angkatan)) return "TNI-AL";
  if (/^tni-au$/i.test(angkatan)) return "TNI-AU";
  if (/^polri$/i.test(angkatan)) return "POLRI";
  if (/^kemhan$/i.test(angkatan)) return "KEMHAN";
  return null;
}
function pf4PlafonNominal() {
  const golongan = PANGKAT_TO_GOLONGAN[$("#pf-pangkat").value];
  const angkatan = pf4NormAngkatan(pfFound && pfFound.angkatan);
  if (golongan && angkatan) {
    const row = plafonRows.find(r => r.angkatan === angkatan && r.golongan === golongan);
    if (row) return row.nominal;
  }
  return (pfFound && pfFound.plafonPum) || 0;
}

function renderStep4() {
  $("#pf4-title").textContent = `Detail Pengajuan - ${PF4_LABEL[pfTipePum]}`;
  $("#pf4-badge").textContent = `TIPE: ${PF4_LABEL[pfTipePum].toUpperCase()}`;

  const cfg = PF4_PANEL[pfTipePum];
  Object.values(PF4_PANEL).forEach(c => $(`#${c.panel}`).style.display = "none");
  $("#pf4-tipe-lain").style.display = cfg ? "none" : "";

  if (!cfg) {
    $("#pf4-tipe-lain-msg").textContent =
      `Form Detail Pengajuan untuk tipe "${PF4_LABEL[pfTipePum]}" menyusul.`;
    return;
  }
  $(`#${cfg.panel}`).style.display = "";
  if (!pfFound) return;

  const prefix = cfg.prefix;
  $(`#${prefix}-ktpa`).value        = pfFound.kpa;
  $(`#${prefix}-pangkat`).value     = $("#pf-pangkat").value || "-";
  $(`#${prefix}-uker`).value        = pfFound.uker || "-";
  $(`#${prefix}-jumlah-pum`).value  = rp(pf4PlafonNominal());
  const masaKerja = hitungMasaKerjaTahun();
  $(`#${prefix}-masa-kerja`).value  = masaKerja !== null ? `${masaKerja} Tahun` : "-";

  /* Alamat Rumah Pemohon — sama persis dengan Alamat/RT/RW/Kelurahan/
     Kecamatan/Kabupaten-Kota/Provinsi/Kode Pos di langkah 1 Data Peserta. */
  $(`#${prefix}-rp-alamat`).value    = fv("pf-alamat")    || "-";
  $(`#${prefix}-rp-rt`).value        = fv("pf-rt")        || "-";
  $(`#${prefix}-rp-rw`).value        = fv("pf-rw")        || "-";
  $(`#${prefix}-rp-kelurahan`).value = fv("pf-kelurahan") || "-";
  $(`#${prefix}-rp-kecamatan`).value = fv("pf-kecamatan") || "-";
  $(`#${prefix}-rp-kabupaten`).value = fv("pf-kabupaten") || "-";
  $(`#${prefix}-rp-provinsi`).value  = fv("pf-provinsi")  || "-";
  $(`#${prefix}-rp-kodepos`).value   = fv("pf-kodepos")   || "-";
}

/* Populer pilihan Mitra Bayar (sekali saat halaman dimuat) */
function isiMitraBayar(selectId) {
  $(`#${selectId}`).innerHTML =
    `<option value="">--Pilih Bank--</option>` +
    DATA_MITRA_BAYAR.map(b => `<option>${esc(b)}</option>`).join("");
}
isiMitraBayar("pf4-mitra-bayar");
isiMitraBayar("pf4pm-mitra-bayar");
isiMitraBayar("pf4mr-mitra-bayar");

/* Autocomplete Kelurahan → otomatis isi Kecamatan/Kabupaten/Provinsi.
   Dipakai berulang untuk tiap tipe PUM lewat prefix id field-nya. */
function bindKelurahanAutocomplete(prefix) {
  $(`#${prefix}-kelurahan`).oninput = () => {
    const q = $(`#${prefix}-kelurahan`).value.trim().toLowerCase();
    const list = $(`#${prefix}-kelurahan-list`);
    if (!q) { list.classList.remove("open"); list.innerHTML = ""; return; }

    const hits = DATA_WILAYAH.filter(w => w.kelurahan.toLowerCase().includes(q));
    if (!hits.length) { list.classList.remove("open"); list.innerHTML = ""; return; }

    list.innerHTML = hits.map(w => `
      <div class="autocomplete-item" data-kel="${esc(w.kelurahan)}">
        ${esc(w.kelurahan)}
        <small>${esc(w.kecamatan)}, ${esc(w.kabupaten)}, ${esc(w.provinsi)}</small>
      </div>`).join("");
    list.classList.add("open");
  };

  document.addEventListener("click", e => {
    const item = e.target.closest(`#${prefix}-kelurahan-list .autocomplete-item`);
    if (item) {
      const w = DATA_WILAYAH.find(x => x.kelurahan === item.dataset.kel);
      if (w) {
        $(`#${prefix}-kelurahan`).value  = w.kelurahan;
        $(`#${prefix}-kecamatan`).value  = w.kecamatan;
        $(`#${prefix}-kabupaten`).value  = w.kabupaten;
        $(`#${prefix}-provinsi`).value   = w.provinsi;
      }
      $(`#${prefix}-kelurahan-list`).classList.remove("open");
      return;
    }
    if (!e.target.closest(`#${prefix}-kelurahan`)) $(`#${prefix}-kelurahan-list`).classList.remove("open");
  });
}
bindKelurahanAutocomplete("pf");
bindKelurahanAutocomplete("pf4");
bindKelurahanAutocomplete("pf4pm");
bindKelurahanAutocomplete("pf4mr");

/* Cek Rekening — validasi format sederhana, tampilkan pop up jika tidak valid */
function bindCekRekening(prefix) {
  $(`#${prefix}-cek-rekening`).onclick = () => {
    const no = $(`#${prefix}-nomor-rekening`).value.trim();
    if (!/^\d{10,16}$/.test(no)) {
      showAlertPopup("Validasi Rekening", "Nomor Rekening Tidak Valid.");
      return;
    }
    toast("Nomor rekening valid.", "ok");
  };
}
bindCekRekening("pf4");
bindCekRekening("pf4pm");
bindCekRekening("pf4mr");

/* ================================================ FLAGGING » CHECK DAN BOOKING » INDIVIDU */

/* Autocomplete Mitra (bank) — generik, dipakai untuk kedua jenis individu */
function bindMitraAutocomplete(inputId, listId) {
  const input = $(`#${inputId}`);
  const list  = $(`#${listId}`);
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.classList.remove("open"); list.innerHTML = ""; return; }
    const hits = DATA_MITRA_BAYAR.filter(b => b.toLowerCase().includes(q));
    if (!hits.length) { list.classList.remove("open"); list.innerHTML = ""; return; }
    list.innerHTML = hits.map(b => `<div class="autocomplete-item" data-mitra="${esc(b)}">${esc(b)}</div>`).join("");
    list.classList.add("open");
  };
  document.addEventListener("click", e => {
    const item = e.target.closest(`#${listId} .autocomplete-item`);
    if (item) {
      input.value = item.dataset.mitra;
      list.classList.remove("open");
      return;
    }
    if (!e.target.closest(`#${inputId}`)) list.classList.remove("open");
  });
}
bindMitraAutocomplete("fcbi-a-mitra", "fcbi-a-mitra-list");
bindMitraAutocomplete("fcbi-p-mitra", "fcbi-p-mitra-list");

$("#fcbi-jenis").onchange = () => {
  $("#fcbi-hasil-aktif").style.display   = "none";
  $("#fcbi-hasil-pensiun").style.display = "none";
};

$("#fcbi-search").onclick = () => {
  const kpa   = $("#fcbi-kpa").value.trim();
  const jenis = $("#fcbi-jenis").value;
  $("#fcbi-hasil-aktif").style.display   = "none";
  $("#fcbi-hasil-pensiun").style.display = "none";

  if (!kpa)   { toast("Nomor KPA belum diisi.", "bad"); return; }
  if (!jenis) { toast("Pilih jenis individu terlebih dahulu.", "bad"); return; }

  if (jenis === "aktif") {
    const found = DATA_FLAGGING_AKTIF.find(p => p.kpa.toLowerCase() === kpa.toLowerCase());
    if (!found) {
      toast(`Nomor KPA "${kpa}" tidak ditemukan pada sistem ASABRI.`, "bad");
      return;
    }
    $("#fcbi-a-kpa").value  = found.kpa;
    $("#fcbi-a-nama").value = found.nama;
    $("#fcbi-a-mitra").value = "";
    $("#fcbi-hasil-aktif").style.display = "";
  } else {
    const found = DATA_FLAGGING_PENSIUN.find(p => p.kpa.toLowerCase() === kpa.toLowerCase());
    if (!found) {
      toast(`Nomor KPA "${kpa}" tidak ditemukan pada sistem ASABRI.`, "bad");
      return;
    }
    $("#fcbi-p-kpa").value               = found.kpa;
    $("#fcbi-p-nopensiun").value         = found.nomorPensiun;
    $("#fcbi-p-nopensiun-peminjam").value = "";
    $("#fcbi-p-nama-peminjam").value     = found.namaPeminjam;
    $("#fcbi-p-nama").value              = found.nama;
    $("#fcbi-p-mitra").value             = "";
    $("#fcbi-hasil-pensiun").style.display = "";
  }
};

$("#fcbi-a-booking").onclick = () => {
  if (!$("#fcbi-a-mitra").value.trim()) { toast("Mitra belum dipilih.", "bad"); return; }
  toast(`Booking pinjaman untuk ${$("#fcbi-a-nama").value} berhasil diajukan.`, "ok");
};

$("#fcbi-p-booking").onclick = () => {
  if (!$("#fcbi-p-nopensiun-peminjam").value.trim()) { toast("Nomor Pensiun Peminjam belum diisi.", "bad"); return; }
  if (!$("#fcbi-p-mitra").value.trim())              { toast("Mitra belum dipilih.", "bad"); return; }
  toast(`Booking pinjaman untuk ${$("#fcbi-p-nama").value} berhasil diajukan.`, "ok");
};

/* =============================================== FLAGGING » CHECK DAN BOOKING » KOLEKTIF */

bindMitraAutocomplete("fcbk-mitra", "fcbk-mitra-list");

$("#fcbk-jenis").onchange = () => {
  $("#fcbk-hasil-aktif").style.display   = "none";
  $("#fcbk-hasil-pensiun").style.display = "none";
};

$("#fcbk-upload").onclick = () => {
  const jenis = $("#fcbk-jenis").value;
  $("#fcbk-hasil-aktif").style.display   = "none";
  $("#fcbk-hasil-pensiun").style.display = "none";

  if (!jenis)                              { toast("Pilih jenis kolektif terlebih dahulu.", "bad"); return; }
  if (!$("#fcbk-mitra").value.trim())      { toast("Mitra belum dipilih.", "bad"); return; }

  if (jenis === "aktif") {
    $("#fcbk-a-body").innerHTML = DATA_FLAGGING_KOLEKTIF_AKTIF.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.kpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${esc(r.nama)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td><input type="checkbox" class="fcbk-a-chk" data-idx="${i}"></td>
      </tr>`).join("");
    $("#fcbk-hasil-aktif").style.display = "";
    toast(`File batch berhasil diunggah — ${DATA_FLAGGING_KOLEKTIF_AKTIF.length} peserta ditemukan.`, "ok");
  } else {
    $("#fcbk-p-body").innerHTML = DATA_FLAGGING_KOLEKTIF_PENSIUN.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.kpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${esc(r.nomorPensiun)}</td>
        <td>${esc(r.namaPeserta)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td><span class="pill ${r.hidup ? "pill-ok" : "pill-bad"}">${r.hidup ? "Hidup" : "Meninggal"}</span></td>
        <td>${esc(r.nomorPensiunPenerima)}</td>
        <td>${esc(r.namaPenerima)}</td>
        <td><input type="checkbox" class="fcbk-p-chk" data-idx="${i}"></td>
      </tr>`).join("");
    $("#fcbk-hasil-pensiun").style.display = "";
    toast(`File batch berhasil diunggah — ${DATA_FLAGGING_KOLEKTIF_PENSIUN.length} peserta ditemukan.`, "ok");
  }
};

function bindFcbkBooking(btnId, checkClass, rows, nameKey) {
  $(`#${btnId}`).onclick = () => {
    const checked = $$(`.${checkClass}`).filter(c => c.checked).map(c => rows[+c.dataset.idx]);
    if (!checked.length) { toast("Pilih minimal satu peserta untuk booking.", "bad"); return; }
    toast(`Booking pinjaman untuk ${checked.length} peserta (${checked.map(r => r[nameKey]).join(", ")}) berhasil diajukan.`, "ok");
  };
}
bindFcbkBooking("fcbk-a-booking", "fcbk-a-chk", DATA_FLAGGING_KOLEKTIF_AKTIF,    "nama");
bindFcbkBooking("fcbk-p-booking", "fcbk-p-chk", DATA_FLAGGING_KOLEKTIF_PENSIUN, "namaPeserta");

/* "Kembali" di Detail Pengajuan hanya kembali ke langkah Tipe KPR (PUM) —
   bukan keluar dari wizard — supaya data yang sudah diisi tidak hilang. */
$("#pf4-kembali").onclick = () => pfGoStep(3);
/* Field wajib di langkah 4 Detail Pengajuan — berbeda per tipe KPR (PUM). */
function pf4MissingFields() {
  const fileMissing = id => !($(`#${id}`).files && $(`#${id}`).files[0]);
  const missing = [];
  if (pfTipePum === "Kredit Rumah") {
    if (fileMissing("pf4-file-akad")) missing.push("Upload Fotocopy Akad Kredit");
    if (fileMissing("pf4-file-buku")) missing.push("Upload Buku Tabungan");
  } else if (pfTipePum === "Pembelian Rumah Secara Mandiri") {
    if (!$("#pf4pm-jenis-hak").value) missing.push("Jenis Hak Kepemilikan Atas Tanah");
    if (fileMissing("pf4pm-file-hak")) missing.push("Upload Fotocopy Sertifikat/Akta Jual Beli");
    if (!$("#pf4pm-alamat-perumahan").value.trim()) missing.push("Alamat Perumahan");
    if (fileMissing("pf4pm-file-buku")) missing.push("Upload Buku Tabungan");
  } else if (pfTipePum === "Membangun Rumah") {
    if (!$("#pf4mr-jenis-hak").value) missing.push("Jenis Hak Kepemilikan Atas Tanah");
    if (fileMissing("pf4mr-file-buku")) missing.push("Upload Buku Tabungan");
  }
  return missing;
}

$("#pf4-lanjut").onclick = () => {
  const missing = pf4MissingFields();
  if (missing.length) {
    toast(`Field wajib belum diisi: ${missing.join(", ")}.`, "bad");
    return;
  }

  const docs = pf5Docs() || [];
  const totalWajib = docs.filter(d => !d.kondisional).length;
  const doneWajib  = docs.filter((d, i) => !d.kondisional && pf5Uploaded[i]).length;
  if (doneWajib < totalWajib) {
    toast(`Lengkapi ${totalWajib - doneWajib} dokumen wajib terlebih dahulu.`, "bad");
    return;
  }

  /* Anggota militer (TNI AD/AU/AL) dengan masa kerja dinas < 2 tahun tidak
     bisa melanjutkan pengajuan PUM KPR. Masa Kerja Dinas dihitung otomatis
     dari Riwayat Kepangkatan Peserta di langkah 2. */
  const isTni = pfFound && /^TNI/i.test(pfFound.angkatan || "");
  const masaKerja = hitungMasaKerjaTahun();
  if (isTni && masaKerja !== null && masaKerja < 2) {
    showAlertPopup("Validasi Masa Kerja Dinas",
      "Pengajuan KPR (PUM) tidak dapat diproses karena Peserta merupakan Anggota Militer TNI AD/TNI AU/TNI AL dengan Masa Kerja Dinas kurang dari 2 Tahun");
    return;
  }
  pfGoStep(5);
};

/* ---------------------------------------------------- wizard: unggah dokumen */
let pf5RenderedTipe = null;
let pf5Uploaded = {};

/* Surat Pernyataan Kesanggupan bersifat wajib dan hanya muncul di daftar
   dokumen untuk peserta Polri dengan Masa Kerja Dinas < 2 tahun. */
function pf5SyaratPolri() {
  const isPolri  = pfFound && /^polri$/i.test(pfFound.angkatan || "");
  const masaKerja = hitungMasaKerjaTahun();
  return isPolri && masaKerja !== null && masaKerja < 2;
}
function pf5Docs() {
  const base = DATA_DOKUMEN_PERSYARATAN[pfTipePum];
  if (!base) return null;
  return pf5SyaratPolri() ? [...base, { label:"Surat Pernyataan Kesanggupan" }] : base;
}

function renderDocRow(d, i) {
  return `
    <div class="doc-row">
      <div class="doc-info">
        <span class="doc-ico">📄</span>
        <div>
          <div class="doc-label">${esc(d.label)}</div>
          ${d.note ? `<div class="doc-note">${esc(d.note)}</div>` : ""}
        </div>
      </div>
      <div class="doc-actions">
        <span class="pill ${d.kondisional ? "pill-warn" : "pill-bad"}" id="pf5-status-${i}">
          ${d.kondisional ? (d.note ? "Kondisional" : "Opsional") : "Belum diunggah"}
        </span>
        <label class="btn btn-primary btn-sm">
          ⬆ Unggah
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" data-doc-idx="${i}">
        </label>
      </div>
    </div>`;
}

function renderStep5() {
  $("#pf5-list-title").textContent = `Daftar Dokumen Persyaratan - ${PF4_LABEL[pfTipePum]}`;

  /* Bangun ulang daftar hanya saat tipe berubah — supaya status unggahan
     tidak hilang kalau user cuma bolak-balik antar langkah. */
  if (pf5RenderedTipe !== pfTipePum) {
    pf5RenderedTipe = pfTipePum;
    pf5Uploaded = {};
    const docs = pf5Docs();
    $("#pf5-list").innerHTML = docs
      ? docs.map((d, i) => renderDocRow(d, i)).join("")
      : `<div class="empty"><p>Daftar dokumen untuk tipe ini menyusul.</p></div>`;
  }
  updatePf5Progress();
}

function updatePf5Progress() {
  const docs = pf5Docs();
  if (!docs) {
    $("#pf5-progress-lbl").textContent  = "";
    $("#pf5-progress-fill").style.width = "0%";
    $("#pf5-alert-kurang").style.display  = "none";
    $("#pf5-alert-lengkap").style.display = "none";
    return;
  }
  const totalWajib = docs.filter(d => !d.kondisional).length;
  const doneWajib  = docs.filter((d, i) => !d.kondisional && pf5Uploaded[i]).length;
  const totalAll   = docs.length;
  const doneAll    = docs.filter((d, i) => pf5Uploaded[i]).length;

  $("#pf5-progress-lbl").textContent  = `${doneAll}/${totalAll} diunggah`;
  $("#pf5-progress-fill").style.width = `${Math.round(doneAll / totalAll * 100)}%`;

  const kurang = totalWajib - doneWajib;
  $("#pf5-alert-kurang").style.display  = kurang > 0 ? "" : "none";
  $("#pf5-alert-lengkap").style.display = kurang > 0 ? "none" : "";
  if (kurang > 0) {
    $("#pf5-alert-kurang-msg").textContent =
      `${kurang} dokumen wajib belum diunggah. Harap lengkapi sebelum melanjutkan.`;
  }
}

document.addEventListener("change", e => {
  const inp = e.target.closest("[data-doc-idx]");
  if (!inp || !inp.files[0]) return;
  const idx = +inp.dataset.docIdx;
  pf5Uploaded[idx] = inp.files[0];
  const pillEl = $(`#pf5-status-${idx}`);
  pillEl.className = "pill pill-ok";
  pillEl.textContent = "Terunggah";
  updatePf5Progress();
});

/* ---------------------------------------------------- wizard: review & simpan */
const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
  "Agustus","September","Oktober","November","Desember"];
const HARI_ID  = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

function fmtTgl(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${+d} ${BULAN_ID[+m - 1]} ${y}`;
}
function fmtTglHariIni() {
  const d = new Date();
  return `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/* ------------------------------------------------------- preview file unggahan
   File asli (bukan cuma nama-nya) disimpan di registry ini supaya tombol
   "Preview" di halaman Review & Simpan / Detail bisa membuka isinya —
   tetap berfungsi walau snapshot-nya sudah disimpan ke baris pengajuan. */
let filePreviewRegistry = {};
let filePreviewSeq = 0;
function registerFile(file) {
  if (!file) return null;
  const id = `fp${filePreviewSeq++}`;
  filePreviewRegistry[id] = file;
  return id;
}

function openFilePreview(id) {
  const file = filePreviewRegistry[id];
  if (!file) { toast("File tidak ditemukan untuk dipratinjau.", "bad"); return; }
  const url     = URL.createObjectURL(file);
  const isImage = file.type.startsWith("image/");
  const isPdf   = file.type === "application/pdf";

  $("#modal-title").textContent = "Preview Dokumen";
  $("#modal-sub").textContent   = file.name;
  $("#modal-body").innerHTML = `
    <div style="text-align:center;background:var(--field);border-radius:9px;overflow:hidden;${isImage || isPdf ? "" : "padding:36px 16px"}">
      ${isImage
        ? `<img src="${url}" alt="${esc(file.name)}" style="max-width:100%;max-height:60vh;display:block;margin:0 auto">`
        : isPdf
        ? `<iframe src="${url}" style="width:100%;height:60vh;border:0"></iframe>`
        : `<div style="color:var(--muted)"><div style="font-size:32px;margin-bottom:10px">📄</div>Preview tidak tersedia untuk tipe file ini. Gunakan tombol unduh untuk melihat isinya.</div>`}
    </div>
    <div class="form-actions">
      <a class="btn btn-ghost" href="${url}" download="${esc(file.name)}">⤓ Unduh</a>
      <button class="btn btn-primary" id="fp-close">Tutup</button>
    </div>`;
  openModal();
  $("#fp-close").onclick = closeModal;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-preview-file]");
  if (b) openFilePreview(b.dataset.previewFile);
});

/* Preview untuk berkas yang sudah tersimpan sebagai data (bukan File live di
   browser) — cth. berkas pada baris pengajuan Approval. Cuma nama file yang
   tersimpan, jadi ditampilkan sebagai placeholder, bukan isi dokumen asli. */
function openFilePreviewByName(name) {
  $("#modal-title").textContent = "Preview Dokumen";
  $("#modal-sub").textContent   = name;
  $("#modal-body").innerHTML = `
    <div style="text-align:center;background:var(--field);border-radius:9px;padding:36px 16px">
      <div style="color:var(--muted)"><div style="font-size:32px;margin-bottom:10px">📄</div>${esc(name)}<br>Preview tidak tersedia untuk data contoh ini.</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="fp-close">Tutup</button>
    </div>`;
  openModal();
  $("#fp-close").onclick = closeModal;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-preview-name]");
  if (b) openFilePreviewByName(b.dataset.previewName);
});

function reviewField(label, value, span2 = false, previewId = null) {
  return `<div class="field ${span2 ? "span2" : ""}">
    <label class="fl">${esc(label)}</label>
    <div class="t-strong" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span>${esc(value || "-")}</span>
      ${previewId ? `<button class="btn btn-ghost btn-sm" type="button" data-preview-file="${previewId}">👁 Preview</button>` : ""}
    </div>
  </div>`;
}

const PF6_PANEL = {
  "Kredit Rumah":                   "pf6-kredit-rumah",
  "Pembelian Rumah Secara Mandiri": "pf6-pembelian-mandiri",
  "Membangun Rumah":                "pf6-membangun-rumah"
};

const fv       = id => ($(`#${id}`) ? $(`#${id}`).value : "");
const fileName = id => { const f = $(`#${id}`); return f && f.files[0] ? f.files[0].name : ""; };

/* Bangun field {label, value, previewId} dari satu input file — dipakai
   untuk semua field "Upload ..." di ringkasan Review & Simpan / Detail. */
function fileField(label, id) {
  const f    = $(`#${id}`);
  const file = f && f.files[0] ? f.files[0] : null;
  return { label, value: file ? file.name : "Belum diunggah", previewId: registerFile(file) };
}

function fieldsToHtml(fields) {
  return fields.map(f => reviewField(f.label, f.value, f.wide, f.previewId)).join("");
}

function riwayatToGroups() {
  return $$("#riwayat-list .riwayat-block").map(b => {
    const inp  = b.querySelectorAll("input");
    const file = inp[3].files[0] || null;
    return [
      { label:"Pangkat", value: b.querySelector("select").value },
      { label:"Nomor SKEP Pengangkatan", value: inp[0].value },
      { label:"TMT Pengangkatan", value: fmtTgl(inp[1].value) },
      { label:"Tanggal SKEP Pengangkatan", value: fmtTgl(inp[2].value) },
      { label:"Upload SKEP Pengangkatan", value: file ? file.name : "Belum diunggah", previewId: registerFile(file) }
    ];
  });
}

/* Riwayat Kepangkatan Peserta dari sistem kepesertaan (read-only), dicocokkan
   lewat KTPA peserta yang sedang diproses di wizard. */
function kpRiwayatDbRows() {
  return (pfFound && DATA_RIWAYAT_KEPANGKATAN[pfFound.kpa]) || [];
}

function renderKpRiwayatDb() {
  const rows = kpRiwayatDbRows();
  $("#kp-riwayat-db-body").innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.pangkat)}</td>
      <td>${esc(r.nomorSkep)}</td>
      <td>${esc(fmtTgl(r.tmt))}</td>
      <td>${esc(fmtTgl(r.tglSkep))}</td>
    </tr>`).join("");
  $("#kp-riwayat-db-empty").style.display = rows.length ? "none" : "";
}

/* TMT tertua di antara Riwayat Kepangkatan Peserta (DB) dan Update
   Kepangkatan Peserta yang baru diisi — dipakai untuk menghitung Masa Kerja
   Dinas secara otomatis di langkah 4. */
function pfEarliestTmt() {
  const dbTmts = kpRiwayatDbRows().map(r => r.tmt);
  const updateTmts = $$("#riwayat-list .riwayat-block").map(b => b.querySelectorAll("input")[1].value).filter(Boolean);
  const all = [...dbTmts, ...updateTmts].filter(Boolean).sort();
  return all[0] || null;
}

function hitungMasaKerjaTahun() {
  const tmt = pfEarliestTmt();
  if (!tmt) return null;
  const start = new Date(tmt), now = new Date();
  let tahun = now.getFullYear() - start.getFullYear();
  if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) tahun--;
  return Math.max(0, tahun);
}

/* Snapshot lengkap dari semua field wizard (langkah 1–5) untuk tipe yang
   sedang aktif — dipakai untuk merender halaman Review & Simpan, dan
   disimpan apa adanya ke baris pengajuan saat Simpan Draft supaya halaman
   Detail nanti bisa menampilkan rincian yang sama persis. */
function buildStep6Snapshot() {
  const dataPeserta = [
    { label:"KTPA", value: fv("pf-ktpa") },
    { label:"NRP/NIP", value: fv("pf-nrp") },
    { label:"Nama Lengkap", value: fv("pf-nama") },
    { label:"Tempat Lahir", value: fv("pf-tempat-lahir") },
    { label:"Tanggal Lahir", value: fmtTgl(fv("pf-tgl-lahir")) },
    { label:"Jenis Kelamin", value: fv("pf-jk") },
    { label:"Status Kawin", value: fv("pf-kawin") },
    { label:"NIK", value: fv("pf-nik") },
    { label:"Nomor Handphone", value: fv("pf-hp") },
    { label:"Pangkat", value: fv("pf-pangkat") },
    { label:"Alamat", value: fv("pf-alamat") },
    { label:"RT", value: fv("pf-rt") },
    { label:"RW", value: fv("pf-rw") },
    { label:"Kelurahan", value: fv("pf-kelurahan") },
    { label:"Kecamatan", value: fv("pf-kecamatan") },
    { label:"Kabupaten/Kota", value: fv("pf-kabupaten") },
    { label:"Provinsi", value: fv("pf-provinsi") },
    { label:"Kode Pos", value: fv("pf-kodepos") }
  ];

  const riwayatDb = kpRiwayatDbRows();
  const riwayat = riwayatToGroups();

  let detailGroups = [];
  if (pfTipePum === "Kredit Rumah") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4-ktpa") },
        { label:"Pangkat", value: fv("pf4-pangkat") },
        { label:"UKER", value: fv("pf4-uker") },
        { label:"Plafon", value: fv("pf4-jumlah-pum") },
        { label:"Masa Kerja Dinas", value: fv("pf4-masa-kerja") },
        { label:"Alamat Rumah Pemohon", value: fv("pf4-rp-alamat"), wide:true },
        { label:"RT", value: fv("pf4-rp-rt") },
        { label:"RW", value: fv("pf4-rp-rw") },
        { label:"Kelurahan", value: fv("pf4-rp-kelurahan") },
        { label:"Kecamatan", value: fv("pf4-rp-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4-rp-kabupaten") },
        { label:"Provinsi", value: fv("pf4-rp-provinsi") },
        { label:"Kode Pos", value: fv("pf4-rp-kodepos") }
      ]},
      { title:"Data Kredit & Properti", fields:[
        { label:"Nama Perumahan", value: fv("pf4-nama-perumahan") },
        { label:"Nama Developer", value: fv("pf4-nama-developer") },
        { label:"Alamat Perumahan", value: fv("pf4-alamat-perumahan"), wide:true },
        { label:"Tipe Rumah", value: fv("pf4-tipe-rumah") },
        { label:"Blok-Nomor Rumah", value: fv("pf4-blok-rumah") },
        { label:"Kelurahan", value: fv("pf4-kelurahan") },
        { label:"Kecamatan", value: fv("pf4-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4-kabupaten") },
        { label:"Provinsi", value: fv("pf4-provinsi") },
        { label:"Jenis Kredit", value: fv("pf4-jenis-kredit") },
        { label:"Bank Kredit", value: fv("pf4-bank-kredit") },
        { label:"Nomor Akad Kredit", value: fv("pf4-nomor-akad") },
        { label:"Tanggal Akad Kredit", value: fmtTgl(fv("pf4-tgl-akad")) },
        fileField("Upload Fotocopy Akad Kredit", "pf4-file-akad")
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4-file-buku"),
        { label:"Catatan", value: fv("pf4-catatan"), wide:true }
      ]}
    ];
  } else if (pfTipePum === "Pembelian Rumah Secara Mandiri") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4pm-ktpa") },
        { label:"Pangkat", value: fv("pf4pm-pangkat") },
        { label:"UKER", value: fv("pf4pm-uker") },
        { label:"Plafon", value: fv("pf4pm-jumlah-pum") },
        { label:"Masa Kerja Dinas", value: fv("pf4pm-masa-kerja") },
        { label:"Alamat Rumah Pemohon", value: fv("pf4pm-rp-alamat"), wide:true },
        { label:"RT", value: fv("pf4pm-rp-rt") },
        { label:"RW", value: fv("pf4pm-rp-rw") },
        { label:"Kelurahan", value: fv("pf4pm-rp-kelurahan") },
        { label:"Kecamatan", value: fv("pf4pm-rp-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4pm-rp-kabupaten") },
        { label:"Provinsi", value: fv("pf4pm-rp-provinsi") },
        { label:"Kode Pos", value: fv("pf4pm-rp-kodepos") }
      ]},
      { title:"Data Properti", fields:[
        { label:"Jenis Hak Kepemilikan Atas Tanah", value: fv("pf4pm-jenis-hak") },
        { label:"Atas Nama Peserta atau Pasangan", value: fv("pf4pm-atas-nama") },
        { label:"Nomor Sertifikat/Akta Jual Beli", value: fv("pf4pm-nomor-hak") },
        { label:"Tanggal Sertifikat/Akta Jual Beli", value: fmtTgl(fv("pf4pm-tgl-hak")) },
        fileField("Upload Fotocopy Sertifikat/Akta Jual Beli", "pf4pm-file-hak"),
        { label:"Nama Perumahan", value: fv("pf4pm-nama-perumahan") },
        { label:"Nama Developer", value: fv("pf4pm-nama-developer") },
        { label:"Alamat Perumahan", value: fv("pf4pm-alamat-perumahan"), wide:true },
        { label:"Tipe Rumah", value: fv("pf4pm-tipe-rumah") },
        { label:"Blok-Nomor Rumah", value: fv("pf4pm-blok-rumah") },
        { label:"Kelurahan", value: fv("pf4pm-kelurahan") },
        { label:"Kecamatan", value: fv("pf4pm-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4pm-kabupaten") },
        { label:"Provinsi", value: fv("pf4pm-provinsi") }
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4pm-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4pm-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4pm-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4pm-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4pm-file-buku"),
        { label:"Catatan", value: fv("pf4pm-catatan"), wide:true }
      ]}
    ];
  } else if (pfTipePum === "Membangun Rumah") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4mr-ktpa") },
        { label:"Pangkat", value: fv("pf4mr-pangkat") },
        { label:"UKER", value: fv("pf4mr-uker") },
        { label:"Plafon", value: fv("pf4mr-jumlah-pum") },
        { label:"Masa Kerja Dinas", value: fv("pf4mr-masa-kerja") },
        { label:"Alamat Rumah Pemohon", value: fv("pf4mr-rp-alamat"), wide:true },
        { label:"RT", value: fv("pf4mr-rp-rt") },
        { label:"RW", value: fv("pf4mr-rp-rw") },
        { label:"Kelurahan", value: fv("pf4mr-rp-kelurahan") },
        { label:"Kecamatan", value: fv("pf4mr-rp-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4mr-rp-kabupaten") },
        { label:"Provinsi", value: fv("pf4mr-rp-provinsi") },
        { label:"Kode Pos", value: fv("pf4mr-rp-kodepos") }
      ]},
      { title:"Data Lokasi Pembangunan", fields:[
        { label:"Jenis Hak Kepemilikan Atas Tanah", value: fv("pf4mr-jenis-hak") },
        { label:"Atas Nama Peserta atau Pasangan", value: fv("pf4mr-atas-nama") },
        { label:"Nomor Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fv("pf4mr-nomor-hak") },
        { label:"Tanggal Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fmtTgl(fv("pf4mr-tgl-hak")) },
        fileField("Upload Sertifikat/Akta Jual Beli/Girik/Akta Hibah", "pf4mr-file-hak"),
        fileField("Fotocopy PBG (Persetujuan Bangunan Gedung)", "pf4mr-file-pbg"),
        { label:"Alamat Lengkap Rumah Yang Akan Dibangun", value: fv("pf4mr-alamat-baru"), wide:true },
        { label:"RT", value: fv("pf4mr-rt") },
        { label:"RW", value: fv("pf4mr-rw") },
        { label:"Kelurahan", value: fv("pf4mr-kelurahan") },
        { label:"Kecamatan", value: fv("pf4mr-kecamatan") },
        { label:"Kota/Kabupaten", value: fv("pf4mr-kabupaten") },
        { label:"Provinsi", value: fv("pf4mr-provinsi") }
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4mr-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4mr-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4mr-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4mr-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4mr-file-buku"),
        { label:"Catatan", value: fv("pf4mr-catatan"), wide:true }
      ]}
    ];
  }

  const docsDef = pf5Docs() || [];
  const dokumen = docsDef.map((d, i) => {
    const file = pf5Uploaded[i] || null;
    return {
      label: d.label, kondisional: !!d.kondisional, note: d.note,
      uploadedName: file ? file.name : null, previewId: registerFile(file)
    };
  });

  return { tipePum: pfTipePum, dataPeserta, riwayatDb, riwayat, detailGroups, dokumen };
}

/* Snapshot MENTAH (nilai input asli, bukan yang sudah diformat untuk
   ditampilkan) — dipakai untuk mengisi ulang wizard saat tombol "Ubah"
   diklik dari Daftar Pengajuan KPR (PUM). */
function buildRawSnapshot() {
  const fields = {};
  PF_TEXT_FIELD_IDS.forEach(id => { fields[id] = fv(id); });

  const files = {};
  PF_FILE_FIELD_IDS.forEach(id => { const f = $(`#${id}`); files[id] = (f && f.files[0]) || null; });

  const riwayat = $$("#riwayat-list .riwayat-block").map(b => {
    const inp = b.querySelectorAll("input");
    return {
      pangkat: b.querySelector("select").value,
      nomorSkep: inp[0].value, tmt: inp[1].value, tglSkep: inp[2].value, file: inp[3].files[0] || null
    };
  });

  return { tipePum: pfTipePum, fields, files, riwayat, docs: { ...pf5Uploaded } };
}

function dokumenToHtml(dokumen) {
  return dokumen.map(d => `
    <div class="doc-row">
      <div class="doc-info"><span class="doc-ico">📄</span><div class="doc-label">${esc(d.label)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="pill ${d.uploadedName ? "pill-ok" : (d.kondisional ? "pill-warn" : "pill-bad")}">${d.uploadedName ? "✓ " + esc(d.uploadedName) : (d.kondisional ? (d.note ? "Kondisional" : "Opsional") : "Belum diunggah")}</span>
        ${d.previewId ? `<button class="btn btn-ghost btn-sm" type="button" data-preview-file="${d.previewId}">👁 Preview</button>` : ""}
      </div>
    </div>`).join("");
}

const PF6_GROUP_IDS = {
  "pf6-kredit-rumah":      ["#pf6-dp-peserta",   "#pf6-dp-properti",   "#pf6-dp-rekening"],
  "pf6-pembelian-mandiri": ["#pf6pm-dp-peserta", "#pf6pm-dp-properti", "#pf6pm-dp-rekening"],
  "pf6-membangun-rumah":   ["#pf6mr-dp-peserta", "#pf6mr-dp-lokasi",   "#pf6mr-dp-rekening"]
};
const PF6_DOKUMEN_ID = {
  "pf6-kredit-rumah": "#pf6-dokumen", "pf6-pembelian-mandiri": "#pf6pm-dokumen", "pf6-membangun-rumah": "#pf6mr-dokumen"
};

function renderStep6() {
  $("#pf6-badge").textContent = `TIPE: ${PF4_LABEL[pfTipePum].toUpperCase()}`;

  const panelId = PF6_PANEL[pfTipePum];
  Object.values(PF6_PANEL).forEach(id => $(`#${id}`).style.display = "none");
  $("#pf6-tipe-lain").style.display = panelId ? "none" : "";
  if (!panelId) {
    $("#pf6-tipe-lain-msg").textContent =
      `Ringkasan pengajuan untuk tipe "${PF4_LABEL[pfTipePum]}" menyusul.`;
    return;
  }
  $(`#${panelId}`).style.display = "";

  const snap = buildStep6Snapshot();

  $("#pf6-data-peserta").innerHTML = fieldsToHtml(snap.dataPeserta);
  $("#pf6-riwayat-db").innerHTML = snap.riwayatDb.length
    ? `<div class="tbl-wrap"><table><thead><tr><th>No</th><th>Pangkat</th><th>Nomor SKEP</th><th>TMT Pangkat</th><th>Tanggal SKEP</th></tr></thead><tbody>${
        snap.riwayatDb.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.pangkat)}</td><td>${esc(r.nomorSkep)}</td><td>${esc(fmtTgl(r.tmt))}</td><td>${esc(fmtTgl(r.tglSkep))}</td></tr>`).join("")
      }</tbody></table></div>`
    : `<div class="hint" style="margin:0">Tidak ada riwayat kepangkatan pada sistem kepesertaan untuk peserta ini.</div>`;
  $("#pf6-riwayat").innerHTML = snap.riwayat.length
    ? snap.riwayat.map((fields, i) => `
        <div style="${i === snap.riwayat.length - 1 ? "" : "margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line-soft)"}">
          <div class="t-strong" style="font-size:12px;margin-bottom:8px">Update Kepangkatan Peserta #${i + 1}</div>
          <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(fields)}</div>
        </div>`).join("")
    : `<div class="hint" style="margin:0">Belum ada update kepangkatan peserta ditambahkan.</div>`;
  $("#pf6-tipe-pill").textContent = snap.tipePum;

  snap.detailGroups.forEach((g, i) => { $(PF6_GROUP_IDS[panelId][i]).innerHTML = fieldsToHtml(g.fields); });
  $(PF6_DOKUMEN_ID[panelId]).innerHTML = dokumenToHtml(snap.dokumen);
}

/* "Kembali" hanya balik ke langkah Unggah Dokumen — data yang sudah diisi tetap ada. */
$("#pf6-kembali").onclick = () => pfGoStep(4);

/* Pernyataan Atas Tanggung Jawab dan Keabsahan Data — wajib disetujui
   (seluruh poin dicentang) sebelum Simpan Draft Pengajuan diproses. */
const PF6_PERNYATAAN = [
  { title:"Keabsahan Data & Dokumen:",
    body:"Seluruh data, dokumen, dan informasi prajurit/anggota/peserta yang diunggah dan diinput ke dalam sistem ini adalah benar, sah, akurat, dan sesuai dengan dokumen aslinya." },
  { title:"Verifikasi Internal:",
    body:"Saya telah melakukan proses pemeriksaan dan verifikasi secara mandiri di tingkat UNOR/Kesatuan atas pemenuhan syarat kelayakan Pengajuan KPR (PUM) ASABRI bagi peserta yang bersangkutan." },
  { title:"Pernyataan Tanggung Jawab & Risiko Legal:",
    body:"Apabila di kemudian hari ditemukan ketidaksesuaian, pemalsuan data/dokumen, atau timbul permasalahan hukum maupun administratif terkait pengajuan ini, maka tanggung jawab penuh (baik administratif, perdata, maupun pidana) berada pada pihak PIC UNOR/Kesatuan, serta membebaskan pihak PT ASABRI (Persero) dari segala tuntutan hukum yang timbul akibat kesalahan penginputan data tersebut." },
  { title:"Persetujuan Ketentuan:",
    body:"Saya telah membaca, memahami, dan menyetujui seluruh syarat, ketentuan, serta prosedur pengajuan PUM KPR yang berlaku di PT ASABRI (Persero)." }
];

function pf6BukaPernyataan() {
  $("#modal-title").textContent = "Pernyataan Atas Tanggung Jawab dan Keabsahan Data Pengajuan KPR (PUM)";
  $("#modal-sub").textContent   = "Wajib disetujui sebelum pengajuan dapat disimpan sebagai draft.";
  $("#modal-body").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      ${PF6_PERNYATAAN.map((p, i) => `
        <div style="display:flex;gap:10px;align-items:flex-start">
          <input type="checkbox" id="pf6-pernyataan-${i}" class="pf6-pernyataan-chk" style="margin-top:3px;flex-shrink:0">
          <label for="pf6-pernyataan-${i}" style="font-size:12.5px;line-height:1.55;color:var(--body)">
            <span class="t-strong" style="display:block;color:var(--ink)">${i + 1}. ${esc(p.title)}</span>
            ${esc(p.body)}
          </label>
        </div>`).join("")}
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="pf6-pernyataan-batal">Batal</button>
      <button class="btn btn-primary" id="pf6-pernyataan-setuju">✓ Setuju & Simpan</button>
    </div>`;
  openModal();
  $("#pf6-pernyataan-batal").onclick = closeModal;
  $("#pf6-pernyataan-setuju").onclick = () => {
    const belumDicentang = $$(".pf6-pernyataan-chk").some(c => !c.checked);
    if (belumDicentang) {
      toast("Seluruh pernyataan harus dicentang sebelum melanjutkan.", "bad");
      return;
    }
    pf6SimpanDraft();
  };
}

function pf6SimpanDraft() {
  const kpa  = $("#pf-ktpa").value.trim() || pfFound.kpa;
  const snap = buildStep6Snapshot();
  const raw  = buildRawSnapshot();
  const tipeRumahPrefix = { "Kredit Rumah":"pf4", "Pembelian Rumah Secara Mandiri":"pf4pm" }[pfTipePum];
  const tipeRumah = (tipeRumahPrefix && $(`#${tipeRumahPrefix}-tipe-rumah`).value.trim()) || "-";

  if (pumEditingRow) {
    const r = pumEditingRow;
    const statusBerubah = r.status !== "Draft";
    Object.assign(r, {
      kpa, nrp: $("#pf-nrp").value.trim() || pfFound.nrp, npwp: pfFound.npwp,
      nama: $("#pf-nama").value.trim() || pfFound.nama, angkatan: pfFound.angkatan,
      tipePum: pfTipePum, tipeRumah, jumlah: pf4PlafonNominal() || r.jumlah,
      status: "Draft", detail: snap, raw
    });
    renderPum(); renderApproval();

    $("#modal-title").textContent = "Perubahan pengajuan tersimpan";
    $("#modal-sub").textContent   = `${r.kpa} — ${r.nama}`;
    $("#modal-body").innerHTML = `
      <div class="alert alert-ok"><span>✓</span><span>Pengajuan KPR (PUM) atas nama ${esc(r.nama)} berhasil diperbarui.${statusBerubah ? " Status dikembalikan ke Draft karena datanya berubah — submit ulang untuk diproses kembali." : ""}</span></div>
      <div class="form-actions"><button class="btn btn-primary" id="pf6-close">Lihat Daftar Pengajuan</button></div>`;
    openModal();
    $("#pf6-close").onclick = () => { closeModal(); pumEditingRow = null; go("pum"); };
    return;
  }

  const newRow = {
    _id: pumRows.length ? Math.max(...pumRows.map(r => r._id)) + 1 : 0,
    kpa, nrp: $("#pf-nrp").value.trim() || pfFound.nrp, npwp: pfFound.npwp,
    nama: $("#pf-nama").value.trim() || pfFound.nama, angkatan: pfFound.angkatan,
    tglAmbil: fmtTglHariIni(), tipePum: pfTipePum, tipeRumah,
    status: "Draft", jumlah: pf4PlafonNominal(),
    detail: snap, raw
  };
  pumRows.push(newRow);
  renderPum(); renderApproval();

  $("#modal-title").textContent = "Draft pengajuan tersimpan";
  $("#modal-sub").textContent   = `${newRow.kpa} — ${newRow.nama}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-ok"><span>✓</span><span>Pengajuan KPR (PUM) tipe ${esc(pfTipePum)} tersimpan sebagai draft di Daftar Pengajuan KPR (PUM). Gunakan tombol Submit pada daftar untuk mengirimkannya.</span></div>
    <div class="metrics m3" style="margin-bottom:4px">
      <div class="metric"><div class="metric-lbl">KPA</div><div class="metric-val" style="font-size:14px">${esc(newRow.kpa)}</div></div>
      <div class="metric"><div class="metric-lbl">Jumlah PUM</div><div class="metric-val" style="font-size:14px">${rp(newRow.jumlah)}</div></div>
      <div class="metric"><div class="metric-lbl">Status</div><div class="metric-val" style="font-size:14px">Draft</div></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" id="pf6-close">Lihat Daftar Pengajuan</button></div>`;
  openModal();
  $("#pf6-close").onclick = () => { closeModal(); go("pum"); };
}

$("#pf6-submit").onclick = pf6BukaPernyataan;

/* ================================================================= APPROVAL PUM KPR */
let apPage = 1;

function tipePumPillClass(tipe) {
  return tipe === "Kredit Rumah" ? "pill-info"
       : tipe === "Pembelian Rumah Secara Mandiri" ? "pill-ok"
       : tipe === "Membangun Rumah" ? "pill-warn" : "pill-info";
}

function renderApproval() {
  const fKta  = ($("#ap-f-kta").value  || "").toLowerCase();
  const fNpwp = ($("#ap-f-npwp").value || "").toLowerCase();
  const fNama = ($("#ap-f-nama").value || "").toLowerCase();
  const fNrp  = ($("#ap-f-nrp").value  || "").toLowerCase();
  const fSt   = $("#ap-filter").value;

  const rows = pumRows.filter(r =>
    (fSt === "all" || r.status === fSt) &&
    (!fKta  || r.kpa.toLowerCase().includes(fKta))   &&
    (!fNpwp || r.npwp.toLowerCase().includes(fNpwp)) &&
    (!fNama || r.nama.toLowerCase().includes(fNama)) &&
    (!fNrp  || r.nrp.toLowerCase().includes(fNrp)));

  const pageSize   = +$("#ap-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (apPage > totalPages) apPage = totalPages;
  const start     = (apPage - 1) * pageSize;
  const pageRows  = rows.slice(start, start + pageSize);

  $("#ap-body").innerHTML = pageRows.length ? pageRows.map(r => `
    <tr>
      <td class="t-strong">${esc(r.kpa)}</td><td>${esc(r.nrp)}</td><td>${esc(r.npwp)}</td>
      <td class="t-name">${esc(r.nama)}</td><td>${esc(r.angkatan)}</td><td>${esc(r.tglAmbil)}</td>
      <td><span class="pill ${tipePumPillClass(r.tipePum)}">${esc(r.tipePum)}</span></td>
      <td>${esc(r.tipeRumah)}</td><td>${rp(r.jumlah)}</td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-info btn-sm"         data-ap-detail="${r._id}">Detail</button>
        <button class="btn btn-danger-solid btn-sm" data-ap-hapus="${r._id}">Hapus</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada pengajuan</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#ap-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length}`;

  $("#ap-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === apPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-ap-page="${p}">${p}</button>
  `).join("");
}

["#ap-f-kta", "#ap-f-npwp", "#ap-f-nama", "#ap-f-nrp"].forEach(sel => $(sel).oninput = () => { apPage = 1; renderApproval(); });
$("#ap-filter").onchange    = () => { apPage = 1; renderApproval(); };
$("#ap-page-size").onchange = () => { apPage = 1; renderApproval(); };

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-ap-page]");
  if (bPage) { apPage = +bPage.dataset.apPage; renderApproval(); return; }

  const bApDetail = e.target.closest("[data-ap-detail]");
  if (bApDetail) {
    pumDetailRow        = pumRows.find(x => x._id === +bApDetail.dataset.apDetail);
    pumDetailContext    = "approval";
    pumDetailBackTarget = "approval-pum";
    renderPumDetailPage();
    go("pum-detail");
    return;
  }

  const bApHapus = e.target.closest("[data-ap-hapus]");
  if (bApHapus) {
    const id = +bApHapus.dataset.apHapus;
    const r  = pumRows.find(x => x._id === id);
    if (!confirm(`Hapus pengajuan KPR (PUM) atas nama ${r.nama}?`)) return;
    pumRows = pumRows.filter(x => x._id !== id);
    renderApproval();
    renderPum();
    toast(`Pengajuan ${r.nama} dihapus.`, "bad");
  }
});

/* ------------------------------------------- halaman Detail Pengajuan KPR (PUM) */
let pumDetailRow        = null;
let pumDetailContext    = "view";   // "view" (dari Pengelolaan KPR (PUM)) | "approval" (dari Approval KPR (PUM))
let pumDetailBackTarget = "pum";

function renderPumDetailPage() {
  const r = pumDetailRow;
  if (!r) return;

  $("#pd-title").textContent = r.nama;
  $("#pd-sub").textContent   = `${r.kpa} · ${r.nrp}`;
  $("#pd-badge").textContent = `TIPE: ${(r.tipePum || "-").toUpperCase()}`;
  $("#pd-crumb-module").textContent = pumDetailContext === "approval" ? "Approval KPR (PUM)" : "Pengelolaan KPR (PUM)";

  /* Tombol Setujui/Tolak/Revisi hanya tampil dari halaman Approval, dan
     dibatasi per role: Divisi Kepesertaan → Setujui/Tolak,
     PIC UNOR/Kesatuan → Revisi saja. */
  if (pumDetailContext === "approval") {
    const role = $("#top-role").value;
    $("#pd-actions").innerHTML = role === "Divisi Kepesertaan dan Pengembangan Manfaat"
      ? `<button class="btn btn-danger-solid" id="pd-tolak">✕ Tolak</button>
         <button class="btn btn-success" id="pd-setuju">✓ Setujui</button>`
      : `<button class="btn btn-gold" id="pd-revisi">↺ Revisi</button>`;
  } else {
    $("#pd-actions").innerHTML = "";
  }

  const basicFields = [
    { label:"KPA", value: r.kpa }, { label:"NRP/NIP", value: r.nrp },
    { label:"NPWP", value: r.npwp }, { label:"Angkatan", value: r.angkatan },
    { label:"Tanggal Ambil PUM", value: r.tglAmbil }, { label:"Status", value: r.status },
    { label:"Tipe PUM", value: r.tipePum }, { label:"Tipe Rumah", value: r.tipeRumah },
    { label:"Jumlah Ambil PUM", value: rp(r.jumlah) }
  ];

  if (!r.detail) {
    $("#pd-body").innerHTML = `
      <div class="subsection-title">Data Peserta</div>
      <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(basicFields)}</div>
      <div class="alert alert-info" style="margin-top:18px"><span>ⓘ</span><span>Rincian lengkap (Data Kepangkatan, Detail Pengajuan, Dokumen Terunggah) belum tersedia untuk pengajuan ini karena dibuat sebelum formulir pengajuan lengkap tersedia di sistem.</span></div>`;
    return;
  }

  const d = r.detail;
  $("#pd-body").innerHTML = `
    <div class="subsection-title">Data Peserta</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(d.dataPeserta)}</div>

    <div class="subsection-title">Riwayat Kepangkatan Peserta</div>
    ${(d.riwayatDb || []).length
      ? `<div class="tbl-wrap"><table><thead><tr><th>No</th><th>Pangkat</th><th>Nomor SKEP</th><th>TMT Pangkat</th><th>Tanggal SKEP</th></tr></thead><tbody>${
          d.riwayatDb.map((r2, i) => `<tr><td>${i + 1}</td><td>${esc(r2.pangkat)}</td><td>${esc(r2.nomorSkep)}</td><td>${esc(fmtTgl(r2.tmt))}</td><td>${esc(fmtTgl(r2.tglSkep))}</td></tr>`).join("")
        }</tbody></table></div>`
      : `<div class="hint" style="margin:0">Tidak ada riwayat kepangkatan pada sistem kepesertaan untuk peserta ini.</div>`}

    <div class="subsection-title">Update Kepangkatan Peserta</div>
    <div style="margin-top:14px">
      ${d.riwayat.length ? d.riwayat.map((fields, i) => `
        <div style="${i === d.riwayat.length - 1 ? "" : "margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line-soft)"}">
          <div class="t-strong" style="font-size:12px;margin-bottom:8px">Update Kepangkatan Peserta #${i + 1}</div>
          <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(fields)}</div>
        </div>`).join("") : `<div class="hint" style="margin:0">Belum ada update kepangkatan peserta ditambahkan.</div>`}
    </div>

    <div class="subsection-title">Tipe KPR (PUM)</div>
    <span class="pill pill-info" style="font-size:12px">${esc(d.tipePum)}</span>

    <div class="subsection-title">Detail Pengajuan - ${esc(d.tipePum)}</div>
    ${d.detailGroups.map(g => `
      <div class="hint" style="margin:14px 0 10px;font-weight:600;color:var(--body)">${esc(g.title)}</div>
      <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(g.fields)}</div>`).join("")}

    <div class="subsection-title">Dokumen Terunggah</div>
    ${dokumenToHtml(d.dokumen)}`;
}

$("#pd-kembali-atas").onclick = () => go(pumDetailBackTarget);
$("#pd-kembali").onclick      = () => go(pumDetailBackTarget);

document.addEventListener("click", e => {
  /* ---- Detail (dari Pengelolaan KPR (PUM) — tanpa aksi approval) ---- */
  const bDetail = e.target.closest("[data-pum-detail]");
  if (bDetail) {
    pumDetailRow        = pumRows.find(x => x._id === +bDetail.dataset.pumDetail);
    pumDetailContext    = "view";
    pumDetailBackTarget = "pum";
    renderPumDetailPage();
    go("pum-detail");
    return;
  }

  /* ---- Setujui / Tolak / Revisi (dari halaman Detail, context approval) ---- */
  if (e.target.closest("#pd-setuju")) {
    $("#modal-title").textContent = "Konfirmasi Persetujuan";
    $("#modal-sub").textContent   = `${pumDetailRow.kpa} — ${pumDetailRow.nama}`;
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Tanggal Akhir Kredit (Jatuh Tempo Pelunasan) <span class="req">*</span></label>
        <input class="inp" type="date" id="pd-tgl-akhir-kredit">
        <div class="hint">Pengajuan otomatis masuk ke Pelunasan KPR (PUM) begitu tanggal ini tercapai.</div>
      </div>
      <div class="field">
        <label class="fl">Alasan Menyetujui (Opsional)</label>
        <textarea class="inp" id="pd-alasan-setuju" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan catatan persetujuan (opsional)"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="pd-setuju-batal">Batal</button>
        <button class="btn btn-success" id="pd-setuju-konfirmasi">✓ Setujui</button>
      </div>`;
    openModal();
    $("#pd-setuju-batal").onclick = closeModal;
    $("#pd-setuju-konfirmasi").onclick = () => {
      const tglAkhirKredit = $("#pd-tgl-akhir-kredit").value;
      if (!tglAkhirKredit) { toast("Tanggal Akhir Kredit belum diisi.", "bad"); return; }
      pumDetailRow.status = "Disetujui";
      pumDetailRow.catatanApproval = $("#pd-alasan-setuju").value.trim();
      pumDetailRow.tglAkhirKredit  = tglAkhirKredit;
      pumDetailRow.masukPelunasan  = false;
      closeModal();
      renderApproval(); renderPum();
      toast(`Pengajuan ${pumDetailRow.nama} disetujui.`, "ok");
      go(pumDetailBackTarget);
      cekJatuhTempoPelunasan();
    };
    return;
  }
  if (e.target.closest("#pd-tolak")) {
    $("#modal-title").textContent = "Konfirmasi Penolakan";
    $("#modal-sub").textContent   = `${pumDetailRow.kpa} — ${pumDetailRow.nama}`;
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Alasan Menolak <span class="req">*</span></label>
        <textarea class="inp" id="pd-alasan-tolak" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan alasan penolakan"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="pd-tolak-batal">Batal</button>
        <button class="btn btn-danger-solid" id="pd-tolak-konfirmasi">✕ Tolak</button>
      </div>`;
    openModal();
    $("#pd-tolak-batal").onclick = closeModal;
    $("#pd-tolak-konfirmasi").onclick = () => {
      const alasan = $("#pd-alasan-tolak").value.trim();
      if (!alasan) { toast("Alasan menolak wajib diisi.", "bad"); return; }
      pumDetailRow.status = "Ditolak";
      pumDetailRow.catatanApproval = alasan;
      closeModal();
      renderApproval(); renderPum();
      toast(`Pengajuan ${pumDetailRow.nama} ditolak.`, "bad");
      go(pumDetailBackTarget);
    };
    return;
  }
  if (e.target.closest("#pd-revisi")) {
    pumDetailRow.status = "Draft";
    renderApproval(); renderPum();
    toast(`Pengajuan ${pumDetailRow.nama} dikembalikan ke PIC UNOR/Kesatuan untuk direvisi.`, "bad");
    go(pumDetailBackTarget);
    return;
  }

  /* ---- Ubah (buka ulang wizard Pengajuan KPR (PUM), terisi dengan data yang ada) ---- */
  const bUbah = e.target.closest("[data-pum-ubah]");
  if (bUbah) {
    const id = +bUbah.dataset.pumUbah;
    const r  = pumRows.find(x => x._id === id);
    openEditWizard(r);
    return;
  }

  /* ---- Hapus ---- */
  const bHapus = e.target.closest("[data-pum-hapus]");
  if (bHapus) {
    const id = +bHapus.dataset.pumHapus;
    const r  = pumRows.find(x => x._id === id);
    if (!confirm(`Hapus pengajuan KPR (PUM) atas nama ${r.nama}?`)) return;
    pumRows = pumRows.filter(x => x._id !== id);
    renderPum(); renderApproval();
    toast(`Pengajuan ${r.nama} dihapus.`, "bad");
    return;
  }

  /* ---- Submit (baris ini langsung muncul di Approval KPR (PUM) begitu statusnya Submitted) ---- */
  const bSubmit = e.target.closest("[data-pum-submit]");
  if (bSubmit) {
    const id = +bSubmit.dataset.pumSubmit;
    const r  = pumRows.find(x => x._id === id);
    if (r.status !== "Draft") { toast(`Pengajuan ${r.nama} sudah pernah disubmit.`); return; }
    r.status = "Submitted";
    renderPum(); renderApproval();
    toast(`Pengajuan ${r.nama} berhasil disubmit dan masuk ke Approval KPR (PUM).`, "ok");
  }
});

/* =============================================================== PELUNASAN */
const pillPel = s => s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn";
let pelPesertaRows = DATA_PELUNASAN_PESERTA.map(r => ({ ...r }));

/* Periode "Menunggu approval" yang sedang berjalan — pengajuan KPR (PUM)
   yang baru jatuh tempo ditambahkan ke sini. Dibuat otomatis untuk bulan
   berjalan kalau belum ada periode yang masih menunggu approval. */
function pelPeriodeAktif() {
  let p = pelPeriods.find(x => x.status === "Menunggu approval");
  if (p) return p;
  const now = new Date();
  const id  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const akhirBulan = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  p = {
    id, periode: `${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`,
    rangeText: `01–${akhirBulan} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`,
    peserta: 0, total: 0, status: "Menunggu approval"
  };
  pelPeriods.unshift(p);
  return p;
}

/* Integrasi Approval KPR (PUM) → Pelunasan KPR (PUM): pengajuan yang sudah
   Disetujui otomatis masuk begitu Tanggal Akhir Kredit-nya tercapai. */
function cekJatuhTempoPelunasan() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const jatuhTempo = pumRows.filter(r =>
    r.status === "Disetujui" && r.tglAkhirKredit && !r.masukPelunasan && r.tglAkhirKredit <= todayIso);
  if (!jatuhTempo.length) return;

  const p = pelPeriodeAktif();
  jatuhTempo.forEach(r => {
    pelPesertaRows.push({ ktpa: r.kpa, nama: r.nama, unor: r.angkatan, sisa: r.jumlah, lunas: r.jumlah });
    p.peserta += 1;
    p.total   += r.jumlah;
    r.masukPelunasan = true;
  });
  renderPel();
  toast(`${jatuhTempo.length} pengajuan KPR (PUM) jatuh tempo — masuk ke Pelunasan KPR (PUM) periode ${p.periode}.`, "ok");
}

function renderPel() {
  $("#pel-body").innerHTML = pelPeriods.map(p => `
    <tr>
      <td class="t-strong">${esc(p.periode)}</td><td>${p.peserta} peserta</td><td>${rp(p.total)}</td>
      <td><span class="pill ${pillPel(p.status)}">${esc(p.status)}</span></td>
      <td><button class="btn ${p.status === "Menunggu approval" ? "btn-primary" : "btn-success"} btn-sm btn-pill" data-pel="${esc(p.id)}">Detail</button></td>
    </tr>`).join("");
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pel]");
  if (!b) return;
  const p = pelPeriods.find(x => x.id === b.dataset.pel);

  $("#pel-d-title").textContent   = `Approval pelunasan KPR (PUM) — ${p.periode}`;
  $("#pel-d-jml").textContent     = p.peserta + " peserta";
  $("#pel-d-total").textContent   = rp(p.total);
  $("#pel-d-periode").textContent = p.rangeText;
  $("#pel-d-n").textContent       = p.peserta;
  $("#pel-d-shown").textContent   = pelPesertaRows.length;
  $("#pel-d-status").className    = "pill " + pillPel(p.status);
  $("#pel-d-status").textContent  = p.status;

  $("#pel-d-body").innerHTML = pelPesertaRows.map(x => `
    <tr><td>${esc(x.ktpa)}</td><td class="t-name">${esc(x.nama)}</td><td>${esc(x.unor)}</td>
    <td>${rp(x.sisa)}</td><td>${rp(x.lunas)}</td></tr>`).join("");

  const pending = p.status === "Menunggu approval";
  $("#pel-setuju").disabled = !pending;
  $("#pel-tolak").disabled  = !pending;
  $("#pel-setuju").dataset.id = p.id;
  $("#pel-tolak").dataset.id  = p.id;

  $("#pel-list").style.display = "none";
  $("#pel-detail").style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#pel-back").onclick = () => {
  $("#pel-detail").style.display = "none";
  $("#pel-list").style.display = "";
};

function putusanPelunasan(id, status, pesan, kind) {
  const p = pelPeriods.find(x => x.id === id);
  p.status = status;
  $("#pel-d-status").className   = "pill " + pillPel(status);
  $("#pel-d-status").textContent = status;
  $("#pel-setuju").disabled = true;
  $("#pel-tolak").disabled  = true;
  renderPel();
  toast(pesan, kind);
}
$("#pel-setuju").onclick = e => putusanPelunasan(e.target.dataset.id, "Disetujui",
  "Pelunasan disetujui. Data terkirim ke Dynamics 365, BA Rekon Piutang ter-generate.", "ok");
$("#pel-tolak").onclick = e => putusanPelunasan(e.target.dataset.id, "Ditolak",
  "Pelunasan ditolak dan dikembalikan untuk verifikasi ulang.", "bad");
$("#btn-export-pel").onclick = () => toast("Laporan pelunasan periodik diekspor.");

/* ================================================================= BUM KPR */
let bumPage = 1;
function renderBum() {
  const fDari     = $("#bum-f-dari").value;
  const fSampai   = $("#bum-f-sampai").value;
  const fCabang   = ($("#bum-f-cabang").value    || "").toLowerCase();
  const fNrp      = ($("#bum-f-nrp").value       || "").toLowerCase();
  const fNama     = ($("#bum-f-nama").value      || "").toLowerCase();
  const fPinjaman = ($("#bum-f-pinjaman").value  || "").toLowerCase();
  const fJenis    = $("#bum-f-jenis").value;

  const rows = bumRows.filter(r =>
    (fJenis === "all" || r.jenisPinjaman === fJenis) &&
    (!fCabang   || r.cabang.toLowerCase().includes(fCabang)) &&
    (!fNrp      || r.nrp.includes(fNrp)) &&
    (!fNama     || r.nama.toLowerCase().includes(fNama)) &&
    (!fPinjaman || r.nomorPinjaman.toLowerCase().includes(fPinjaman)) &&
    (!fDari     || r.tmt >= fDari) &&
    (!fSampai   || r.tmt <= fSampai));

  const pageSize   = +$("#bum-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (bumPage > totalPages) bumPage = totalPages;
  const start    = (bumPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#bum-body").innerHTML = pageRows.length ? pageRows.map(r => `
    <tr>
      <td class="t-strong">${esc(r.kpa)}</td>
      <td>${esc(r.nrp)}</td>
      <td>${esc(r.nama)}</td>
      <td>${esc(fmtTgl(r.tmt))}</td>
      <td>${esc(r.cabang)}</td>
      <td>${esc(r.nomorPinjaman)}</td>
      <td><span class="pill ${r.jenisPinjaman === "Program Khusus" ? "pill-warn" : "pill-ok"}">${esc(r.jenisPinjaman)}</span></td>
      <td>${rp(r.jumlah)}</td>
      <td>${rp(r.sisaHutang)}</td>
      <td>${rp(r.outstanding)}</td>
      <td><button class="btn btn-ghost btn-sm" data-bum-detail="${r.kpa}">👁 Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="11"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#bum-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} klaim`;

  $("#bum-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === bumPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-bum-page="${p}">${p}</button>
  `).join("");
}
$("#bum-cari").onclick         = () => { bumPage = 1; renderBum(); };
$("#bum-page-size").onchange   = () => { bumPage = 1; renderBum(); };
$("#bum-export-excel").onclick = () => toast("Daftar klaim KPR (BUM) diekspor ke Excel.");

function bumShowDetail(r) {
  $("#modal-title").textContent = "Detail Klaim KPR (BUM)";
  $("#modal-sub").textContent   = r.nomorPinjaman;
  $("#modal-body").innerHTML = `
    <div class="grid2">
      ${reviewField("Nomor Permohonan", r.nomorPermohonan)}
      ${reviewField("KPA", r.kpa)}
      ${reviewField("NRP/NIP", r.nrp)}
      ${reviewField("NIK", r.nik)}
      ${reviewField("Nama", r.nama)}
      ${reviewField("Jenis Kelamin", r.jk === "L" ? "Laki-laki" : r.jk === "P" ? "Perempuan" : "-")}
      ${reviewField("TMT", fmtTgl(r.tmt))}
      ${reviewField("Kantor Cabang", r.cabang)}
      ${reviewField("Nomor Pinjaman", r.nomorPinjaman)}
      ${reviewField("Jenis Pinjaman", r.jenisPinjaman)}
      ${reviewField("Jumlah", rp(r.jumlah))}
      ${reviewField("Sisa Hutang", rp(r.sisaHutang))}
      ${reviewField("Outstanding", rp(r.outstanding))}
      ${reviewField("Keterangan", r.keterangan, true)}
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bum-detail-tutup">Tutup</button>
    </div>`;
  openModal();
  $("#bum-detail-tutup").onclick = closeModal;
}

/* -------------------------------------------------- + Pemotongan Manfaat Klaim
   KPA wajib diisi terlebih dahulu — NRP, NIK, Nama, Tanggal Lahir, TMT Masuk,
   dan Jenis Kelamin otomatis terisi (read-only) dari BUM_KPA_LOOKUP begitu
   KPA valid. Simpan menambahkan baris baru langsung ke tabel Klaim KPR (BUM). */
function bumClearAutofill() {
  ["#bpk-nrp", "#bpk-nik", "#bpk-nama", "#bpk-tgl-lahir", "#bpk-tmt-masuk", "#bpk-jk", "#bpk-outstanding"].forEach(sel => $(sel).value = "");
}
function bumAutofillFromKpa() {
  const kpa   = $("#bpk-kpa").value.trim().toUpperCase();
  const found = BUM_KPA_LOOKUP[kpa];
  if (!found) { bumClearAutofill(); if (kpa) toast("KPA tidak ditemukan pada data peserta.", "bad"); return; }
  $("#bpk-nrp").value         = found.nrp;
  $("#bpk-nik").value         = found.nik;
  $("#bpk-nama").value        = found.nama;
  $("#bpk-tgl-lahir").value   = found.tglLahir;
  $("#bpk-tmt-masuk").value   = found.tmtMasuk;
  $("#bpk-jk").value          = found.jk === "L" ? "Laki-laki" : "Perempuan";
  $("#bpk-outstanding").value = rp(found.outstandingHutang);
}

function bumShowPemotongan() {
  $("#modal-title").textContent = "Pemotongan Manfaat Klaim";
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="grid2">
      <div class="field">
        <label class="fl">Nomor Permohonan <span class="req">*</span></label>
        <input class="inp" id="bpk-nomor-permohonan">
      </div>
      <div class="field">
        <label class="fl">Jenis Pinjaman <span class="req">*</span></label>
        <select class="inp" id="bpk-jenis-pinjaman">
          <option value="">-- Pilih Jenis Pinjaman --</option>
          <option value="Program Reguler">Program Reguler</option>
          <option value="Program Khusus">Program Khusus</option>
        </select>
      </div>
      <div class="field">
        <label class="fl">KPA <span class="req">*</span></label>
        <input class="inp" id="bpk-kpa" placeholder="-- Masukkan KPA --">
      </div>
      <div class="field">
        <label class="fl">NRP <span class="req">*</span></label>
        <input class="inp" id="bpk-nrp" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">NIK <span class="req">*</span></label>
        <input class="inp" id="bpk-nik" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Nama <span class="req">*</span></label>
        <input class="inp" id="bpk-nama" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Tanggal Lahir <span class="req">*</span></label>
        <input class="inp" type="date" id="bpk-tgl-lahir" disabled>
      </div>
      <div class="field">
        <label class="fl">TMT Masuk <span class="req">*</span></label>
        <input class="inp" type="date" id="bpk-tmt-masuk" disabled>
      </div>
      <div class="field">
        <label class="fl">Jenis Kelamin <span class="req">*</span></label>
        <input class="inp" id="bpk-jk" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Outstanding Hutang BUM <span class="req">*</span></label>
        <input class="inp" id="bpk-outstanding" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Nilai Pemotongan <span class="req">*</span></label>
        <input class="inp" type="number" min="0" id="bpk-jumlah" placeholder="0">
      </div>
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl">Keterangan <span class="req">*</span></label>
      <textarea class="inp" id="bpk-keterangan" style="height:70px;padding:9px 10px;resize:vertical"></textarea>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bpk-tutup">Tutup</button>
      <button class="btn btn-primary" id="bpk-simpan">💾 Simpan</button>
    </div>`;
  openModal();

  $("#bpk-tutup").onclick   = closeModal;
  $("#bpk-kpa").onblur      = bumAutofillFromKpa;
  $("#bpk-kpa").onchange    = bumAutofillFromKpa;

  $("#bpk-simpan").onclick = () => {
    const nomorPermohonan = $("#bpk-nomor-permohonan").value.trim();
    const jenisPinjaman   = $("#bpk-jenis-pinjaman").value;
    const kpa             = $("#bpk-kpa").value.trim().toUpperCase();
    const keterangan      = $("#bpk-keterangan").value.trim();
    const jumlah          = +$("#bpk-jumlah").value;
    const nrp = $("#bpk-nrp").value, nik = $("#bpk-nik").value, nama = $("#bpk-nama").value,
          tglLahir = $("#bpk-tgl-lahir").value, tmtMasuk = $("#bpk-tmt-masuk").value, jkText = $("#bpk-jk").value;

    if (!nomorPermohonan || !jenisPinjaman || !kpa || !keterangan || !jumlah) {
      toast("Seluruh field wajib diisi sebelum menyimpan.", "bad");
      return;
    }
    const found = BUM_KPA_LOOKUP[kpa];
    if (!found || !nrp || !nik || !nama || !tglLahir || !tmtMasuk) {
      toast("KPA tidak ditemukan pada data peserta.", "bad");
      return;
    }

    bumRows.unshift({
      kpa, nrp, nik, nama, jk: jkText === "Laki-laki" ? "L" : "P",
      tmt: tmtMasuk, cabang: found.cabang,
      nomorPinjaman: nomorPermohonan, nomorPermohonan,
      jenisPinjaman, jumlah, sisaHutang: jumlah, outstanding: found.outstandingHutang,
      keterangan
    });
    bumPage = 1;
    renderBum();
    closeModal();
    toast(`Pemotongan manfaat klaim untuk ${nama} berhasil disimpan.`, "ok");
  };
}
$("#bum-pemotongan-btn").onclick = bumShowPemotongan;

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-bum-detail]");
  if (bDetail) { bumShowDetail(bumRows.find(x => x.kpa === bDetail.dataset.bumDetail)); return; }

  const bPage = e.target.closest("[data-bum-page]");
  if (bPage) { bumPage = +bPage.dataset.bumPage; renderBum(); }
});

/* ========================================================== DISTRIBUSI BDN */
function renderDistHead() {
  $("#dist-head").innerHTML =
    `<th>Nomor KPA</th><th>Nama peserta</th>` +
    KANAL.map(([, label]) => `<th style="text-align:center">${esc(label)}</th>`).join("") +
    `<th>Aksi</th>`;
}
function renderDistMetrics() {
  $("#dist-metrics").innerHTML = KANAL.map(([k, label]) => {
    const ok   = distRows.filter(r => r[k] === "ok").length;
    const wait = distRows.filter(r => r[k] === "wait").length;
    const bad  = distRows.filter(r => r[k] === "bad").length;
    const sub  = bad  ? `<span class="bad-txt">${ok} terkirim · ${bad} gagal</span>`
               : wait ? `<span class="warn-txt">${ok} terkirim · ${wait} pending</span>`
                      : `<span class="ok-txt">${ok} terkirim</span>`;
    return `<div class="metric"><div class="metric-lbl">${esc(label)}</div>
      <div class="metric-val">${distRows.length}</div><div class="metric-sub">${sub}</div></div>`;
  }).join("");
}
function renderDist() {
  const q = ($("#dist-search").value || "").toLowerCase();
  let rows = distRows.filter(r => !q || r.kpa.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q));
  if (distOnlyBad) rows = rows.filter(r => KANAL.some(([k]) => r[k] !== "ok"));

  const glyph = s => s === "ok"   ? '<span class="g g-ok">✓</span>'
                   : s === "wait" ? '<span class="g g-wait">◷</span>'
                                  : '<span class="g g-bad">✕</span>';

  $("#dist-body").innerHTML = rows.length ? rows.map(r => {
    const idx = distRows.indexOf(r);
    const gagal = KANAL.some(([k]) => r[k] !== "ok");
    return `<tr>
      <td class="t-strong">${esc(r.kpa)}</td><td>${esc(r.nama)}</td>
      ${KANAL.map(([k]) => `<td style="text-align:center">${glyph(r[k])}</td>`).join("")}
      <td>${gagal ? `<button class="btn btn-ghost btn-sm" data-retry="${idx}">↻ Kirim ulang</button>`
                  : '<span class="hint" style="margin:0">—</span>'}</td>
    </tr>`;
  }).join("")
  : `<tr><td colspan="${KANAL.length + 3}"><div class="empty"><h4>Semua distribusi berhasil</h4><p>Tidak ada kanal yang gagal atau tertunda.</p></div></td></tr>`;

  $("#dist-count").textContent = `menampilkan ${rows.length} dari ${distRows.length} KPA terbit hari ini`;
  renderDistMetrics();
}
$("#dist-search").oninput = renderDist;
$("#dist-only-bad").onclick = () => {
  distOnlyBad = !distOnlyBad;
  const b = $("#dist-only-bad");
  b.classList.toggle("btn-danger", distOnlyBad);
  b.classList.toggle("btn-ghost", !distOnlyBad);
  b.textContent = distOnlyBad ? "✓ Menampilkan gagal/pending" : "⚠ Tampilkan hanya gagal/pending";
  renderDist();
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-retry]");
  if (!b) return;
  const r = distRows[+b.dataset.retry];
  KANAL.forEach(([k]) => { if (r[k] !== "ok") r[k] = "ok"; });
  renderDist();
  toast(`Distribusi BDN ${r.kpa} berhasil dikirim ulang ke semua kanal.`, "ok");
});

/* simulasi live: status "pending" sesekali berubah jadi "terkirim" */
setInterval(() => {
  if (!$("#s-distribusi").classList.contains("active")) return;
  const kandidat = [];
  distRows.forEach((r, i) => KANAL.forEach(([k]) => { if (r[k] === "wait") kandidat.push([i, k]); }));
  if (!kandidat.length) return;
  const [i, k] = kandidat[Math.floor(Math.random() * kandidat.length)];
  distRows[i][k] = "ok";
  $("#dist-ago").textContent = "· update baru saja";
  renderDist();
}, PENGATURAN.jedaSimulasi);

/* ============================== PENDAFTARAN PESERTA BARU » UPLOAD: riwayat */
let uploadRiwayatPage = 1;

function pillPendaftaranStatus(s) {
  return s === "Diterima" ? "pill-ok" : (s === "Ditolak" || s === "Ditolak Verifikasi") ? "pill-bad" : "pill-warn";
}

/* Stepper progres "Pengajuan → Verifikasi → Pengajuan Diterima/Ditolak" —
   dipakai di halaman Detail Pendaftaran Peserta Baru, baik mekanisme
   Perorangan (tanpa tahap verifikasi terpisah) maupun Kolektif (via Upload,
   dengan tahap verifikasi sungguhan). */
function renderProgressSteps(containerId, steps) {
  const bg = s => s.state === "done" ? "var(--green)" : s.state === "active" ? "var(--navy)" : s.state === "bad" ? "var(--red)" : "var(--line)";
  const fg = s => s.state === "pending" ? "var(--muted)" : "#fff";
  const icon = (s, i) => s.state === "done" ? "✓" : s.state === "bad" ? "✕" : i + 1;
  $(`#${containerId}`).innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(${steps.length},1fr)">
      ${steps.map((s, i) => `
        <div style="display:flex;align-items:center">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:${bg(s)};color:${fg(s)}">${icon(s, i)}</div>
          ${i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${s.state === "done" ? "var(--green)" : "var(--line)"};margin:0 6px"></div>` : ""}
        </div>`).join("")}
      ${steps.map(s => `<div style="font-size:11px;color:var(--body);text-align:center;padding-top:8px;line-height:1.3">${esc(s.label)}</div>`).join("")}
    </div>`;
}

/* Mekanisme Perorangan: tidak ada tahap verifikasi terpisah, jadi tahap
   "Verifikasi" otomatis dianggap lolos begitu pengajuan disimpan. */
function ppProgressSteps(approvalStatus) {
  return [
    { label: "Pengajuan", state: "done" },
    { label: approvalStatus === "Diterima" ? "Diterima" : approvalStatus === "Ditolak" ? "Ditolak" : "Diterima/Ditolak",
      state: approvalStatus === "Diterima" ? "done" : approvalStatus === "Ditolak" ? "bad" : "active" }
  ];
}

/* Mekanisme Kolektif (via Upload): melalui tahap Verifikasi Kolektif dulu
   sebelum masuk antrean Approval. */
function kolektifProgressSteps(status) {
  const verifState = status === "Belum Terverifikasi" ? "active" : status === "Ditolak Verifikasi" ? "bad" : "done";
  const verifLabel = status === "Ditolak Verifikasi" ? "Verifikasi Ditolak"
    : verifState === "done" ? "Verifikasi Diterima" : "Verifikasi Diterima/Ditolak";
  const approvalReached = status !== "Belum Terverifikasi" && status !== "Ditolak Verifikasi";
  const approvalState = !approvalReached ? "pending" : status === "Diterima" ? "done" : status === "Ditolak" ? "bad" : "active";
  const approvalLabel = status === "Diterima" ? "Pengajuan Diterima" : status === "Ditolak" ? "Pengajuan Ditolak" : "Pengajuan Diterima/Ditolak";
  return [
    { label: "Pengajuan", state: "done" },
    { label: verifLabel, state: verifState },
    { label: approvalLabel, state: approvalState }
  ];
}

function uploadGotoView(view) {
  $("#upload-riwayat-view").style.display        = view === "riwayat"        ? "" : "none";
  $("#upload-riwayat-detail-view").style.display  = view === "riwayat-detail" ? "" : "none";
  $("#upload-wizard-view").style.display          = view === "wizard"        ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderUploadRiwayat() {
  const fBatch    = ($("#upload-riwayat-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#upload-riwayat-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#upload-riwayat-f-kesatuan").value || "").toLowerCase();
  const fStatus   = $("#upload-riwayat-f-status").value;
  const fTanggal  = $("#upload-riwayat-f-tanggal").value;

  const rows = uploadBatchRows.filter(r =>
    (fStatus === "all" || r.status === fStatus) &&
    (!fBatch    || r.nomorBatch.toLowerCase().includes(fBatch)) &&
    (!fAgenda   || r.nomorAgenda.toLowerCase().includes(fAgenda)) &&
    (!fKesatuan || r.kesatuanPengaju.toLowerCase().includes(fKesatuan)) &&
    (!fTanggal  || fmtTgl(fTanggal) === r.tglPengajuan));
  const pageSize   = +$("#upload-riwayat-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (uploadRiwayatPage > totalPages) uploadRiwayatPage = totalPages;
  const start    = (uploadRiwayatPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#upload-riwayat-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(r.tglPengajuan)}</td>
      <td class="t-strong">${esc(r.nomorBatch)}</td>
      <td>${esc(r.nomorAgenda)}</td>
      <td>${esc(r.kesatuanPengaju)}</td>
      <td>${r.peserta.length}</td>
      <td><span class="pill ${pillPendaftaranStatus(r.status)}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-upload-riwayat-detail="${r._id}">Lihat</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Belum ada riwayat upload</h4><p>Klik "+ Unggah File Excel" untuk memulai.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#upload-riwayat-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;
  $("#upload-riwayat-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === uploadRiwayatPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-upload-riwayat-page="${p}">${p}</button>
  `).join("");
}
$("#upload-riwayat-page-size").onchange = () => { uploadRiwayatPage = 1; renderUploadRiwayat(); };
$("#upload-riwayat-cari").onclick = () => { uploadRiwayatPage = 1; renderUploadRiwayat(); };
$("#btn-export-upload-riwayat").onclick = () => toast("Riwayat upload diekspor ke Excel.");

function renderUploadRiwayatDetail(batch) {
  $("#upload-riwayat-detail-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;
  renderProgressSteps("upload-riwayat-detail-progress", kolektifProgressSteps(batch.status));
  $("#upload-riwayat-detail-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("");
  $("#upload-riwayat-detail-body").innerHTML = batch.peserta.length
    ? batch.peserta.map(p => `<tr>${FIELDS.map((f, i) =>
        `<td class="${i === 0 ? "stick-l " : ""}${i < 2 ? "t-strong" : ""}">${esc(p[f[0]])}</td>`
      ).join("")}</tr>`).join("")
    : `<tr><td colspan="${FIELDS.length}"><div class="empty"><h4>Tidak ada berkas</h4></div></td></tr>`;
}

$("#btn-upload-baru").onclick = () => {
  dirtyRows = DATA_LIST_KOTOR.map(r => ({ ...r, _err: { ...r._err } }));
  cleanRows = [];
  $("#k-nomor-agenda").value = "";
  $("#k-surat").value = "";
  $("#k-tgl-surat").value = "";
  $("#up-title").textContent = "Unggah file batch peserta";
  $("#up-sub").textContent   = "Format .xls / .csv sesuai template — maksimal 5.000 baris per batch";
  $("#to-step2").disabled = true;
  [2, 3].forEach(n => $(`.step[data-step="${n}"]`).disabled = true);
  gotoStep(1);
  uploadGotoView("wizard");
};
$("#k-batal").onclick = () => uploadGotoView("riwayat");
$("#upload-riwayat-detail-kembali").onclick = () => uploadGotoView("riwayat");

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-upload-riwayat-detail]");
  if (bDetail) {
    renderUploadRiwayatDetail(uploadBatchRows.find(x => x._id === +bDetail.dataset.uploadRiwayatDetail));
    uploadGotoView("riwayat-detail");
    return;
  }
  const bPage = e.target.closest("[data-upload-riwayat-page]");
  if (bPage) { uploadRiwayatPage = +bPage.dataset.uploadRiwayatPage; renderUploadRiwayat(); }
});

/* ============================== PENDAFTARAN PESERTA BARU » VERIFIKASI UPLOAD */
let verifPage = 1;
let verifCurrentBatchId = null;

function verifDisplayStatus(r) {
  if (r.status === "Belum Terverifikasi") return "Belum Terverifikasi";
  if (r.status === "Ditolak Verifikasi")  return "Ditolak Verifikasi";
  return "Lolos Verifikasi";
}

function verifGotoView(view) {
  $("#verif-list-view").style.display   = view === "list"   ? "" : "none";
  $("#verif-detail-view").style.display = view === "detail" ? "" : "none";
  $("#verif-revisi-view").style.display = view === "revisi" ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderVerifikasiList() {
  const fBatch    = ($("#verif-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#verif-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#verif-f-kesatuan").value || "").toLowerCase();
  const fStatus   = $("#verif-f-status").value;
  const fTanggal  = $("#verif-f-tanggal").value;

  const rows = uploadBatchRows.filter(r =>
    (fStatus === "all" || verifDisplayStatus(r) === fStatus) &&
    (!fBatch    || r.nomorBatch.toLowerCase().includes(fBatch)) &&
    (!fAgenda   || r.nomorAgenda.toLowerCase().includes(fAgenda)) &&
    (!fKesatuan || r.kesatuanPengaju.toLowerCase().includes(fKesatuan)) &&
    (!fTanggal  || fmtTgl(fTanggal) === r.tglPengajuan));

  const pageSize   = +$("#verif-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (verifPage > totalPages) verifPage = totalPages;
  const start    = (verifPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#verif-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(r.tglPengajuan)}</td>
      <td>${esc(r.kesatuanPengaju)}</td>
      <td class="t-strong">${esc(r.nomorBatch)}</td>
      <td>${esc(r.nomorAgenda)}</td>
      <td>${r.peserta.length}</td>
      <td><span class="pill ${pillPendaftaranStatus(verifDisplayStatus(r) === "Lolos Verifikasi" ? "Diterima" : verifDisplayStatus(r) === "Ditolak Verifikasi" ? "Ditolak" : "Tertunda")}">${esc(verifDisplayStatus(r).toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-verif-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#verif-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;
  $("#verif-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === verifPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-verif-page="${p}">${p}</button>
  `).join("");
}
$("#verif-cari").onclick = () => { verifPage = 1; renderVerifikasiList(); };
$("#verif-page-size").onchange = () => { verifPage = 1; renderVerifikasiList(); };
$("#verif-export").onclick = () => toast("Daftar verifikasi upload diekspor ke Excel.");

let verifDetailPage = 1;

function renderVerifDetail(batch) {
  $("#verif-detail-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;

  const pageSize   = 10;
  const totalPages = Math.max(1, Math.ceil(batch.peserta.length / pageSize));
  if (verifDetailPage > totalPages) verifDetailPage = totalPages;
  const start    = (verifDetailPage - 1) * pageSize;
  const pageRows = batch.peserta.slice(start, start + pageSize);

  $("#verif-detail-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("") + `<th class="stick-r">AKSI</th>`;
  $("#verif-detail-body").innerHTML = pageRows.length ? pageRows.map((p) => `
    <tr>${FIELDS.map((f, i) =>
      `<td class="${i === 0 ? "stick-l " : ""}${i < 2 ? "t-strong" : ""}">${esc(p[f[0]])}</td>`
    ).join("")}<td class="stick-r"><button class="btn btn-primary btn-sm btn-pill" data-verif-revisi="${batch._id}">Revisi</button></td></tr>`
  ).join("") : `<tr><td colspan="${FIELDS.length + 1}"><div class="empty"><h4>Tidak ada berkas</h4></div></td></tr>`;

  const shownFrom = batch.peserta.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, batch.peserta.length);
  $("#verif-detail-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${batch.peserta.length} peserta`;
  $("#verif-detail-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === verifDetailPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-verif-detail-page="${p}">${p}</button>
  `).join("");

  const isLastPage    = verifDetailPage === totalPages;
  const belumDiproses = batch.status === "Belum Terverifikasi";
  $("#verif-detail-actions").innerHTML = (isLastPage && belumDiproses) ? `
    <button class="btn btn-danger-solid" id="verif-tolak">✕ Tolak Verifikasi</button>
    <button class="btn btn-success" id="verif-setujui">✓ Setujui Verifikasi</button>` : "";
}

function verifConfirmSetujui(batch, onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Persetujuan Verifikasi";
  $("#modal-sub").textContent   = batch.nomorBatch;
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Catatan Persetujuan (Opsional)</label>
      <textarea class="inp" id="verif-alasan-setuju" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan catatan persetujuan (opsional)"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="verif-setuju-batal">Batal</button>
      <button class="btn btn-success" id="verif-setuju-konfirmasi">✓ Setujui</button>
    </div>`;
  openModal();
  $("#verif-setuju-batal").onclick = closeModal;
  $("#verif-setuju-konfirmasi").onclick = () => {
    const catatan = $("#verif-alasan-setuju").value.trim();
    closeModal();
    onConfirm(catatan);
  };
}
function verifConfirmTolak(batch, onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Penolakan Verifikasi";
  $("#modal-sub").textContent   = batch.nomorBatch;
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Alasan Menolak <span class="req">*</span></label>
      <textarea class="inp" id="verif-alasan-tolak" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan alasan penolakan"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="verif-tolak-batal">Batal</button>
      <button class="btn btn-danger-solid" id="verif-tolak-konfirmasi">✕ Tolak</button>
    </div>`;
  openModal();
  $("#verif-tolak-batal").onclick = closeModal;
  $("#verif-tolak-konfirmasi").onclick = () => {
    const alasan = $("#verif-alasan-tolak").value.trim();
    if (!alasan) { toast("Alasan menolak wajib diisi.", "bad"); return; }
    closeModal();
    onConfirm(alasan);
  };
}

const VERIF_EDITABLE = [
  ["sts", "STS PERSONIL"], ["unor", "UNOR"], ["angkatan", "ANGKATAN"],
  ["kdPangkat", "KODE PANGKAT"], ["kdKesatuan", "KODE_KESATUAN"], ["kdKancab", "KODE_KANCAB"]
];
function renderVerifRevisi(batch) {
  $("#verif-revisi-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;
  $("#verif-revisi-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("");
  $("#verif-revisi-body").innerHTML = batch.peserta.map((p, idx) => `
    <tr>${FIELDS.map((f, i) => {
      const editable = VERIF_EDITABLE.some(([k]) => k === f[0]);
      const cls = (i === 0 ? "stick-l " : "") + (i < 2 ? "t-strong" : "");
      return editable
        ? `<td class="${cls}"><input class="inp" style="min-width:120px" data-verif-edit-idx="${idx}" data-verif-edit-key="${f[0]}" value="${esc(p[f[0]])}"></td>`
        : `<td class="${cls}">${esc(p[f[0]])}</td>`;
    }).join("")}</tr>`
  ).join("");
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-verif-detail]");
  if (bDetail) {
    verifCurrentBatchId = +bDetail.dataset.verifDetail;
    verifDetailPage = 1;
    renderVerifDetail(uploadBatchRows.find(x => x._id === verifCurrentBatchId));
    verifGotoView("detail");
    return;
  }
  const bRevisi = e.target.closest("[data-verif-revisi]");
  if (bRevisi) {
    verifCurrentBatchId = +bRevisi.dataset.verifRevisi;
    renderVerifRevisi(uploadBatchRows.find(x => x._id === verifCurrentBatchId));
    verifGotoView("revisi");
    return;
  }
  const bPage = e.target.closest("[data-verif-page]");
  if (bPage) { verifPage = +bPage.dataset.verifPage; renderVerifikasiList(); return; }

  const bDetailPage = e.target.closest("[data-verif-detail-page]");
  if (bDetailPage) {
    verifDetailPage = +bDetailPage.dataset.verifDetailPage;
    renderVerifDetail(uploadBatchRows.find(x => x._id === verifCurrentBatchId));
    return;
  }

  if (e.target.closest("#verif-setujui")) {
    const batch = uploadBatchRows.find(x => x._id === verifCurrentBatchId);
    verifConfirmSetujui(batch, () => {
      batch.status = "Tertunda";
      renderUploadRiwayat();
      renderVerifikasiList();
      renderApprovalList();
      toast(`Batch ${batch.nomorBatch} lolos verifikasi dan masuk antrean Approval.`, "ok");
      verifGotoView("list");
    });
    return;
  }
  if (e.target.closest("#verif-tolak")) {
    const batch = uploadBatchRows.find(x => x._id === verifCurrentBatchId);
    verifConfirmTolak(batch, alasan => {
      batch.status = "Ditolak Verifikasi";
      batch.catatanVerifikasi = alasan;
      renderUploadRiwayat();
      renderVerifikasiList();
      toast(`Batch ${batch.nomorBatch} ditolak pada tahap verifikasi.`, "bad");
      verifGotoView("list");
    });
    return;
  }
});
$("#verif-detail-kembali").onclick = () => { renderVerifikasiList(); verifGotoView("list"); };
$("#verif-revisi-kembali").onclick = () => {
  renderVerifDetail(uploadBatchRows.find(x => x._id === verifCurrentBatchId));
  verifGotoView("detail");
};
$("#verif-simpan-revisi").onclick = () => {
  const batch = uploadBatchRows.find(x => x._id === verifCurrentBatchId);
  $$("#verif-revisi-body [data-verif-edit-idx]").forEach(inp => {
    batch.peserta[+inp.dataset.verifEditIdx][inp.dataset.verifEditKey] = inp.value.trim();
  });
  toast(`Perubahan data peserta batch ${batch.nomorBatch} tersimpan.`, "ok");
  renderVerifDetail(batch);
  verifGotoView("detail");
};

/* ============================== PENDAFTARAN PESERTA BARU » APPROVAL */
let apprPage = 1;
let apprCurrentType = null;
let apprCurrentId   = null;

function apprGotoView(view) {
  $("#appr-page-head").style.display     = view === "list" ? "" : "none";
  $("#appr-list-view").style.display     = view === "list" ? "" : "none";
  $("#appr-detail-a-view").style.display = view === "a"    ? "" : "none";
  $("#appr-detail-b-view").style.display = view === "b"    ? "" : "none";
  $("#appr-detail-c-view").style.display = view === "c"    ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function apprConfirmSetujui(onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Persetujuan";
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Catatan Persetujuan (Opsional)</label>
      <textarea class="inp" id="appr-alasan-setuju" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan catatan persetujuan (opsional)"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="appr-setuju-batal">Batal</button>
      <button class="btn btn-success" id="appr-setuju-konfirmasi">✓ Setujui</button>
    </div>`;
  openModal();
  $("#appr-setuju-batal").onclick = closeModal;
  $("#appr-setuju-konfirmasi").onclick = () => {
    const catatan = $("#appr-alasan-setuju").value.trim();
    closeModal();
    onConfirm(catatan);
  };
}
function apprConfirmTolak(onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Penolakan";
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Alasan Menolak <span class="req">*</span></label>
      <textarea class="inp" id="appr-alasan-tolak" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan alasan penolakan"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="appr-tolak-batal">Batal</button>
      <button class="btn btn-danger-solid" id="appr-tolak-konfirmasi">✕ Tolak</button>
    </div>`;
  openModal();
  $("#appr-tolak-batal").onclick = closeModal;
  $("#appr-tolak-konfirmasi").onclick = () => {
    const alasan = $("#appr-alasan-tolak").value.trim();
    if (!alasan) { toast("Alasan menolak wajib diisi.", "bad"); return; }
    closeModal();
    onConfirm(alasan);
  };
}

/* A. Perorangan — summary lengkap + Setujui/Tolak */
function renderApprovalDetailA(id) {
  const r = peroranganRows.find(x => x._id === id);
  apprCurrentType = "perorangan"; apprCurrentId = id;
  $("#appr-a-sub").textContent = `${r.dataPeserta.nama} — ${r.nomorAgenda}`;
  const p = r.dataPeserta;
  apprEditSection({
    headId: "appr-a-pengajuan-head", bodyId: "appr-a-pengajuan", obj: r.dataPengajuan,
    preamble: ppReviewRow("Jenis Pendaftaran Baru", r.dataPengajuan.jenis) + ppReviewRow("Nomor Agenda", r.nomorAgenda),
    fields: [
      { key: "nomorSurat", label: "Nomor Surat Pengantar" },
      { key: "instansi", label: "Kesatuan Pengaju" },
      { key: "tglSurat", label: "Tanggal Surat Pengantar" }
    ]
  });
  apprEditSection({
    headId: "appr-a-peserta-head", bodyId: "appr-a-peserta", obj: p,
    fields: PP_PESERTA_FIELDS.map(([key, label]) => ({ key, label }))
  });
  apprEditBerkas("appr-a-berkas-head", "appr-a-berkas", r.berkas);

  if (r.approvalStatus === "Tertunda") {
    $("#appr-a-actions").innerHTML = `
      <button class="btn btn-danger-solid" id="appr-a-tolak">✕ Tolak</button>
      <button class="btn btn-success" id="appr-a-setuju">✓ Setujui</button>`;
    $("#appr-a-setuju").onclick = () => apprConfirmSetujui(catatan => {
      r.approvalStatus = "Diterima"; r.catatanApproval = catatan;
      renderApprovalList();
      toast(`Pengajuan ${p.nama} disetujui.`, "ok");
      apprGotoView("list");
    });
    $("#appr-a-tolak").onclick = () => apprConfirmTolak(alasan => {
      r.approvalStatus = "Ditolak"; r.catatanApproval = alasan;
      renderApprovalList();
      toast(`Pengajuan ${p.nama} ditolak.`, "bad");
      apprGotoView("list");
    });
  } else {
    $("#appr-a-actions").innerHTML = `<span class="pill ${r.approvalStatus === "Diterima" ? "pill-ok" : "pill-bad"}">${esc(r.approvalStatus.toUpperCase())}</span>`;
  }
}

/* B. Kolektif — daftar peserta dalam satu batch */
function renderApprovalDetailBTable(batch) {
  const fBatch    = ($("#appr-b-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#appr-b-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#appr-b-f-kesatuan").value || "").toLowerCase();
  const fTanggal  = $("#appr-b-f-tanggal").value;
  const cocok = (!fBatch    || batch.nomorBatch.toLowerCase().includes(fBatch))
    && (!fAgenda   || batch.nomorAgenda.toLowerCase().includes(fAgenda))
    && (!fKesatuan || batch.kesatuanPengaju.toLowerCase().includes(fKesatuan))
    && (!fTanggal  || fmtTgl(fTanggal) === batch.tglPengajuan);

  $("#appr-b-body").innerHTML = cocok && batch.peserta.length ? batch.peserta.map((p, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(batch.tglPengajuan)}</td>
      <td class="t-strong">${esc(batch.nomorBatch)}</td>
      <td>${esc(batch.nomorAgenda)}</td>
      <td>${esc(batch.kesatuanPengaju)}</td>
      <td>1</td>
      <td class="t-name">${esc(p.nama)}</td>
      <td><button class="btn btn-info btn-sm" data-appr-c="${idx}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;
}
function renderApprovalDetailB(batchId) {
  const batch = uploadBatchRows.find(x => x._id === batchId);
  apprCurrentType = "kolektif"; apprCurrentId = batchId;
  $("#appr-b-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;
  $("#appr-b-f-batch").value    = batch.nomorBatch;
  $("#appr-b-f-agenda").value   = batch.nomorAgenda;
  $("#appr-b-f-kesatuan").value = batch.kesatuanPengaju;
  $("#appr-b-f-tanggal").value  = "";
  renderApprovalDetailBTable(batch);

  if (batch.status === "Tertunda") {
    $("#appr-b-actions").innerHTML = `
      <button class="btn btn-danger-solid" id="appr-b-tolak">✕ Tolak</button>
      <button class="btn btn-success" id="appr-b-setuju">✓ Setujui</button>`;
    $("#appr-b-setuju").onclick = () => apprConfirmSetujui(catatan => {
      const now = new Date();
      const pad = v => String(v).padStart(2, "0");
      batch.status = "Diterima"; batch.catatanApproval = catatan;
      batch.tglApproval = fmtTgl(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      renderApprovalList(); renderUploadRiwayat(); renderVerifikasiList(); renderNominatif();
      toast(`Batch ${batch.nomorBatch} disetujui.`, "ok");
      apprGotoView("list");
    });
    $("#appr-b-tolak").onclick = () => apprConfirmTolak(alasan => {
      batch.status = "Ditolak"; batch.catatanApproval = alasan;
      renderApprovalList(); renderUploadRiwayat(); renderVerifikasiList();
      toast(`Batch ${batch.nomorBatch} ditolak.`, "bad");
      apprGotoView("list");
    });
  } else {
    $("#appr-b-actions").innerHTML = `<span class="pill ${pillPendaftaranStatus(batch.status)}">${esc(batch.status.toUpperCase())}</span>`;
  }
}
$("#appr-b-cari").onclick   = () => renderApprovalDetailBTable(uploadBatchRows.find(x => x._id === apprCurrentId));
$("#appr-b-export").onclick = () => toast("Daftar peserta batch diekspor ke Excel.");

/* C. Kolektif — summary satu peserta (baca saja; Setujui/Tolak ada di
   halaman Detail Approval — Kolektif [B], berlaku untuk seluruh batch) */
function renderApprovalDetailC(batchId, pesertaIdx) {
  const batch = uploadBatchRows.find(x => x._id === batchId);
  const p = batch.peserta[pesertaIdx];
  $("#appr-c-sub").textContent = `${p.nama} — ${batch.nomorBatch}`;
  const dp = batch.dataPengajuan || {};
  apprEditSection({
    headId: "appr-c-pengajuan-head", bodyId: "appr-c-pengajuan", obj: dp,
    preamble: ppReviewRow("Jenis Pendaftaran Baru", dp.jenis || "Kolektif")
      + ppReviewRow("Nomor Agenda", batch.nomorAgenda) + ppReviewRow("Nomor Batch", batch.nomorBatch),
    fields: [
      { key: "nomorSurat", label: "Nomor Surat Pengantar" },
      { key: "instansi", label: "Kesatuan Pengaju" },
      { key: "tglSurat", label: "Tanggal Surat Pengantar" }
    ]
  });
  apprEditSection({
    headId: "appr-c-peserta-head", bodyId: "appr-c-peserta", obj: p,
    fields: FIELDS.map(([key, label]) => ({ key, label }))
  });
  apprEditBerkas("appr-c-berkas-head", "appr-c-berkas", p.berkas || (p.berkas = []));

  $("#appr-c-actions").innerHTML = `<span class="pill ${pillPendaftaranStatus(batch.status)}">${esc(batch.status.toUpperCase())}</span>`;
}

function apprCombinedRows() {
  /* Pengajuan Kolektif dari sub modul Perorangan (via "Jenis Pendaftaran Baru")
     belum masuk ke antrean Approval ini — halaman Detail A di sini hanya
     mengerti bentuk satu peserta (dataPeserta), belum daftar banyak peserta
     (pesertaList). Untuk sekarang pengajuan itu hanya bisa dilihat lewat
     riwayat di sub modul Perorangan sendiri. */
  const per = peroranganRows.filter(r => (r.jenis || "Perorangan") !== "Kolektif").map(r => ({
    type: "perorangan", refId: r._id,
    tglPengajuan: r.tglPengajuan, nomorBatch: "-", nomorAgenda: r.nomorAgenda,
    nomorSurat: r.dataPengajuan.nomorSurat, tglSurat: r.dataPengajuan.tglSurat,
    kesatuanPengaju: r.kesatuanPengaju, jumlahBerkas: r.berkas.filter(b => b.file).length,
    status: r.approvalStatus
  }));
  const kol = uploadBatchRows.filter(r => r.status !== "Belum Terverifikasi" && r.status !== "Ditolak Verifikasi").map(r => ({
    type: "kolektif", refId: r._id,
    tglPengajuan: r.tglPengajuan, nomorBatch: r.nomorBatch, nomorAgenda: r.nomorAgenda,
    nomorSurat: (r.dataPengajuan || {}).nomorSurat, tglSurat: (r.dataPengajuan || {}).tglSurat,
    kesatuanPengaju: r.kesatuanPengaju, jumlahBerkas: r.peserta.length,
    status: r.status
  }));
  return [...per, ...kol];
}

function renderApprovalList() {
  const fBatch     = ($("#appr-f-batch").value     || "").toLowerCase();
  const fAgenda    = ($("#appr-f-agenda").value    || "").toLowerCase();
  const fStatus    = $("#appr-f-status").value;
  const fKesatuan  = ($("#appr-f-kesatuan").value  || "").toLowerCase();
  const fTanggal   = $("#appr-f-tanggal").value;
  const fSurat     = ($("#appr-f-surat").value     || "").toLowerCase();
  const fTglSurat  = $("#appr-f-tgl-surat").value;

  const rows = apprCombinedRows().filter(r =>
    (fStatus === "all" || r.status === fStatus) &&
    (!fBatch    || r.nomorBatch.toLowerCase().includes(fBatch)) &&
    (!fAgenda   || r.nomorAgenda.toLowerCase().includes(fAgenda)) &&
    (!fKesatuan || r.kesatuanPengaju.toLowerCase().includes(fKesatuan)) &&
    (!fTanggal  || fmtTgl(fTanggal) === r.tglPengajuan) &&
    (!fSurat    || (r.nomorSurat || "").toLowerCase().includes(fSurat)) &&
    (!fTglSurat || fmtTgl(fTglSurat) === r.tglSurat));

  const pageSize   = +$("#appr-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (apprPage > totalPages) apprPage = totalPages;
  const start    = (apprPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#appr-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(r.tglPengajuan)}</td>
      <td class="t-strong">${esc(r.nomorBatch)}</td>
      <td>${esc(r.nomorAgenda)}</td>
      <td>${esc(r.nomorSurat || "-")}</td>
      <td>${esc(r.tglSurat || "-")}</td>
      <td>${esc(r.kesatuanPengaju)}</td>
      <td>${r.jumlahBerkas}</td>
      <td><span class="pill ${r.status === "Diterima" ? "pill-ok" : r.status === "Ditolak" ? "pill-bad" : "pill-warn"}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-appr-detail="${r.type}:${r.refId}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#appr-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;
  $("#appr-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === apprPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-appr-page="${p}">${p}</button>
  `).join("");
}
$("#appr-cari").onclick      = () => { apprPage = 1; renderApprovalList(); };
$("#appr-f-status").onchange = () => { apprPage = 1; renderApprovalList(); };
$("#appr-page-size").onchange = () => { apprPage = 1; renderApprovalList(); };
$("#appr-export").onclick    = () => toast("Daftar approval pendaftaran peserta baru diekspor ke Excel.");

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-appr-detail]");
  if (bDetail) {
    const [type, id] = bDetail.dataset.apprDetail.split(":");
    if (type === "perorangan") { renderApprovalDetailA(+id); apprGotoView("a"); }
    else { renderApprovalDetailB(+id); apprGotoView("b"); }
    return;
  }
  const bC = e.target.closest("[data-appr-c]");
  if (bC) { renderApprovalDetailC(apprCurrentId, +bC.dataset.apprC); apprGotoView("c"); return; }
  const bPage = e.target.closest("[data-appr-page]");
  if (bPage) { apprPage = +bPage.dataset.apprPage; renderApprovalList(); }
});
$("#appr-a-kembali").onclick = () => { renderApprovalList(); apprGotoView("list"); };
$("#appr-b-kembali").onclick = () => { renderApprovalList(); apprGotoView("list"); };
$("#appr-c-kembali").onclick = () => { renderApprovalDetailB(apprCurrentId); apprGotoView("b"); };

/* ============================== PENDAFTARAN PESERTA BARU » BUKU DAFTAR NOMINATIF
   Menampilkan batch kolektif yang sudah "Diterima" di Approval — daftar
   nominatif hanya untuk batch yang berstatus bersih/tervalidasi. */
let nominatifPage = 1;

function nominatifGotoView(view) {
  $("#nominatif-page-head").style.display   = view === "detail" ? "none" : "";
  $("#nominatif-list-view").style.display   = view === "list"   ? "" : "none";
  $("#nominatif-detail-view").style.display = view === "detail" ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderNominatif() {
  const fBatch    = ($("#nominatif-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#nominatif-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#nominatif-f-kesatuan").value || "").toLowerCase();
  const fTanggal  = $("#nominatif-f-tanggal").value;
  const fSurat    = ($("#nominatif-f-surat").value    || "").toLowerCase();
  const fTglSurat = $("#nominatif-f-tgl-surat").value;

  const rows = uploadBatchRows.filter(r => {
    const dp = r.dataPengajuan || {};
    return r.status === "Diterima"
      && (!fBatch    || r.nomorBatch.toLowerCase().includes(fBatch))
      && (!fAgenda   || r.nomorAgenda.toLowerCase().includes(fAgenda))
      && (!fKesatuan || r.kesatuanPengaju.toLowerCase().includes(fKesatuan))
      && (!fTanggal  || fmtTgl(fTanggal) === r.tglPengajuan)
      && (!fSurat    || (dp.nomorSurat || "").toLowerCase().includes(fSurat))
      && (!fTglSurat || fmtTgl(fTglSurat) === dp.tglSurat);
  });

  const pageSize   = +$("#nominatif-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (nominatifPage > totalPages) nominatifPage = totalPages;
  const start    = (nominatifPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#nominatif-body").innerHTML = pageRows.length ? pageRows.map((r, i) => {
    const dp = r.dataPengajuan || {};
    return `
    <tr>
      <td>${start + i + 1}</td>
      <td class="t-strong">${esc(r.nomorBatch)}</td>
      <td>${esc(r.nomorAgenda)}</td>
      <td>${esc(dp.nomorSurat || "-")}</td>
      <td>${esc(dp.tglSurat || "-")}</td>
      <td>${esc(r.kesatuanPengaju)}</td>
      <td>${r.peserta.length}</td>
      <td>${esc(r.tglApproval || "-")}</td>
      <td>${esc(r.tglPengajuan)}</td>
      <td>
        <button class="btn btn-info btn-sm" data-nominatif-detail="${r._id}">👤 Peserta</button>
        <button class="btn btn-primary btn-sm" data-nominatif-cetak="${r._id}">🖶 Cetak</button>
      </td>
    </tr>`;
  }).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#nominatif-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;
  $("#nominatif-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === nominatifPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-nominatif-page="${p}">${p}</button>
  `).join("");
}
$("#nominatif-cari").onclick       = () => { nominatifPage = 1; renderNominatif(); };
$("#nominatif-page-size").onchange = () => { nominatifPage = 1; renderNominatif(); };
$("#nominatif-export").onclick     = () => toast("Buku daftar nominatif diekspor ke Excel.");

function renderNominatifDetail(batch) {
  $("#nominatif-detail-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;
  $("#nominatif-detail-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("");
  $("#nominatif-detail-body").innerHTML = batch.peserta.length
    ? batch.peserta.map(p => `<tr>${FIELDS.map((f, i) =>
        `<td class="${i === 0 ? "stick-l " : ""}${i < 2 ? "t-strong" : ""}">${esc(p[f[0]])}</td>`
      ).join("")}</tr>`).join("")
    : `<tr><td colspan="${FIELDS.length}"><div class="empty"><h4>Tidak ada peserta</h4></div></td></tr>`;
}
$("#nominatif-detail-kembali").onclick = () => nominatifGotoView("list");

function nominatifCetak(batch) {
  $("#modal-title").textContent = "Cetak Dokumen";
  $("#modal-sub").textContent   = batch.nomorBatch;
  $("#modal-body").innerHTML = `
    <div class="form-actions" style="flex-direction:column;align-items:stretch;gap:8px">
      <button class="btn btn-ghost" id="nominatif-cetak-kpa" style="justify-content:flex-start">📋 Cetak KPA</button>
      <button class="btn btn-ghost" id="nominatif-cetak-surat" style="justify-content:flex-start">✉ Cetak Surat Pengantar</button>
    </div>`;
  openModal();
  $("#nominatif-cetak-kpa").onclick   = () => { closeModal(); toast(`KPA batch ${batch.nomorBatch} dicetak.`, "ok"); };
  $("#nominatif-cetak-surat").onclick = () => { closeModal(); toast(`Surat Pengantar batch ${batch.nomorBatch} dicetak.`, "ok"); };
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-nominatif-detail]");
  if (bDetail) {
    renderNominatifDetail(uploadBatchRows.find(x => x._id === +bDetail.dataset.nominatifDetail));
    nominatifGotoView("detail");
    return;
  }
  const bCetak = e.target.closest("[data-nominatif-cetak]");
  if (bCetak) { nominatifCetak(uploadBatchRows.find(x => x._id === +bCetak.dataset.nominatifCetak)); return; }
  const bPage = e.target.closest("[data-nominatif-page]");
  if (bPage) { nominatifPage = +bPage.dataset.nominatifPage; renderNominatif(); }
});

/* -------------------------------------- Pengelolaan Iuran Premi THT/JKK/JKm */
let premiPage = 1;

function fmtTglSlash(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function hitungMasaKerja(tmtIso) {
  const start = new Date(tmtIso);
  const now   = new Date();
  let bulan = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) bulan--;
  bulan = Math.max(0, bulan);
  const tahun = Math.floor(bulan / 12), sisaBulan = bulan % 12;
  return { totalBulan: bulan, label: `${bulan} bulan (${tahun} tahun ${sisaBulan} bulan)` };
}

function premiLengkap(r) { return !!(r.ktpa && r.pangkat && r.kesatuan); }

function renderPremiList() {
  const q = $("#premi-cari").value.trim().toLowerCase();
  const rows = !q ? DATA_IURAN_PREMI_PESERTA : DATA_IURAN_PREMI_PESERTA.filter(r =>
    (r.nama || "").toLowerCase().includes(q) || (r.nrp || "").toLowerCase().includes(q) ||
    (r.nik  || "").toLowerCase().includes(q) || (r.ktpa || "").toLowerCase().includes(q)
  );

  const pageSize   = +$("#premi-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  premiPage = Math.min(premiPage, totalPages);
  const start = (premiPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#premi-body").innerHTML = pageRows.length ? pageRows.map((r, i) => {
    const lengkap = premiLengkap(r);
    const idx = DATA_IURAN_PREMI_PESERTA.indexOf(r);
    return `<tr>
      <td>${start + i + 1}</td>
      <td>${esc(r.ktpa || "—")}</td>
      <td>${esc(r.nrp || "—")}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td>${esc(r.pangkat || "—")}</td>
      <td>${esc(r.kesatuan || "—")}</td>
      <td><button class="btn btn-primary btn-sm" data-premi-hitung="${idx}" ${lengkap ? "" : `disabled title="Data peserta belum lengkap"`}>🖩 Hitung Premi</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty"><h4>Tidak ada peserta</h4><p>Coba ubah kata kunci pencarian.</p></div></td></tr>`;

  $("#premi-count").textContent = `menampilkan ${pageRows.length} dari ${rows.length} peserta`;
  $("#premi-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === premiPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-premi-page="${p}">${p}</button>
  `).join("");
}
$("#premi-cari-btn").onclick = () => { premiPage = 1; renderPremiList(); };
$("#premi-cari").addEventListener("keydown", e => { if (e.key === "Enter") { premiPage = 1; renderPremiList(); } });
$("#premi-page-size").onchange = () => { premiPage = 1; renderPremiList(); };

function premiShowHasil(r) {
  const masa = hitungMasaKerja(r.tmtMasuk);
  const iuranBulanan = r.gaji * 0.03;
  const totalPremi = Math.round(iuranBulanan * masa.totalBulan);
  const manfaat = Math.round(totalPremi * 1.8);

  $("#modal-title").textContent = "🖩 Hasil Simulasi Premi";
  $("#modal-sub").textContent   = `${r.nama} · KTPA ${r.ktpa}`;
  $("#modal-body").innerHTML = `
    <div class="grid2" style="gap:14px">
      <div style="background:var(--blue-soft);border-radius:10px;padding:16px">
        <div class="fl caps" style="color:var(--blue-ink)">💳 Total Premi Sampai Saat Ini</div>
        <div style="font-size:22px;font-weight:700;color:var(--navy);margin-top:6px">${rp(totalPremi)}</div>
      </div>
      <div style="background:var(--green-soft);border-radius:10px;padding:16px">
        <div class="fl caps" style="color:var(--green-ink)">🐖 Nilai Manfaat Tabungan Asuransi</div>
        <div style="font-size:22px;font-weight:700;color:var(--green-ink);margin-top:6px">${rp(manfaat)}</div>
      </div>
    </div>
    <div class="grid3" style="margin-top:18px">
      <div class="field"><label class="fl caps">Nama</label><div class="t-strong">${esc(r.nama)}</div></div>
      <div class="field"><label class="fl caps">NRP / NIP</label><div>${esc(r.nrp)}</div></div>
      <div class="field"><label class="fl caps">No. KTPA</label><div>${esc(r.ktpa)}</div></div>
      <div class="field"><label class="fl caps">Unor</label><div>${esc(r.unor)}</div></div>
      <div class="field"><label class="fl caps">Tanggal Lahir</label><div>${fmtTglSlash(r.tglLahir)}</div></div>
      <div class="field"><label class="fl caps">TMT Masuk</label><div>${fmtTglSlash(r.tmtMasuk)}</div></div>
      <div class="field"><label class="fl caps">Tanggal Pensiun</label><div>${fmtTglSlash(r.tglPensiun)}</div></div>
      <div class="field"><label class="fl caps">Masa Kerja</label><div>${masa.label}</div></div>
      <div class="field"><label class="fl caps">Gaji Saat Ini</label><div>${rp(r.gaji)}</div></div>
    </div>
    <div class="hint" style="margin-top:14px;font-style:italic">Angka di atas adalah hasil simulasi layanan perhitungan premi (SIMPRE) dan bukan nilai final pembayaran.</div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="premi-modal-tutup">✕ Tutup</button>
      <button class="btn btn-primary" id="premi-modal-ulang">↻ Hitung Ulang</button>
    </div>`;
  openModal();
  $("#premi-modal-tutup").onclick = closeModal;
  $("#premi-modal-ulang").onclick = () => { toast("Simulasi premi dihitung ulang.", "ok"); premiShowHasil(r); };
}

document.addEventListener("click", e => {
  const bHitung = e.target.closest("[data-premi-hitung]");
  if (bHitung && !bHitung.disabled) premiShowHasil(DATA_IURAN_PREMI_PESERTA[+bHitung.dataset.premiHitung]);
  const bPage = e.target.closest("[data-premi-page]");
  if (bPage) { premiPage = +bPage.dataset.premiPage; renderPremiList(); }
});

/* ================================================================ E-DOSIR */
const EDOSIR_BULAN_LABEL = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
let edosirSort = { col: "nama", dir: 1 };

const edosirTotal = c => c.saldoAwal + c.bulan.reduce((a, b) => a + b, 0);

function edosirAggregates() {
  const rows = DATA_EDOSIR_CABANG;
  const saldoAwal = rows.reduce((s, c) => s + c.saldoAwal, 0);
  const bulanTotal = EDOSIR_BULAN_LABEL.map((_, i) => rows.reduce((s, c) => s + c.bulan[i], 0));
  const masuk = bulanTotal.reduce((a, b) => a + b, 0);
  const total = saldoAwal + masuk;
  const dataReal = EDOSIR_DATA_REAL_NASIONAL;
  const capaian = total / dataReal * 100;
  const top10 = [...rows].sort((a, b) => edosirTotal(b) - edosirTotal(a)).slice(0, 10);
  const terendah = rows
    .filter(c => c.real != null)
    .map(c => ({ nama: c.nama, capaian: edosirTotal(c) / c.real * 100 }))
    .sort((a, b) => a.capaian - b.capaian);
  return { rows, saldoAwal, bulanTotal, masuk, total, dataReal, capaian, top10, terendah };
}

/* ---- Grafik batang ringan berbasis SVG (thin marks, rounded data-end,
   gridline resesif, tooltip native via <title>) — dipakai untuk 2 chart. */
function edosirRoundedTopPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}
function edosirRoundedRightPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, h / 2, w));
  return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x},${y + h} Z`;
}
function edosirNiceMax(v) {
  if (v <= 0) return 10;
  const mag  = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
const edosirFmtRb = v => v === 0 ? "0" : (v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " rb";

function renderBarChartVertical(containerId, labels, values) {
  const w = 460, h = 260, padL = 44, padB = 26, padT = 10, padR = 10;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const maxVal = edosirNiceMax(Math.max(...values, 1));
  const ticks  = 4;
  const slotW  = plotW / values.length;
  const barW   = Math.max(6, slotW - 10);

  let svg = "";
  for (let i = 0; i <= ticks; i++) {
    const val = maxVal * i / ticks;
    const y = padT + plotH - (val / maxVal) * plotH;
    svg += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--line-soft)" stroke-width="1"/>`;
    svg += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="9.5" fill="var(--muted)">${edosirFmtRb(val)}</text>`;
  }
  values.forEach((v, i) => {
    const x = padL + i * slotW + (slotW - barW) / 2;
    const barH = maxVal ? (v / maxVal) * plotH : 0;
    const y = padT + plotH - barH;
    if (barH > 0) svg += `<path d="${edosirRoundedTopPath(x, y, barW, barH, 3)}" fill="var(--navy)"><title>${esc(labels[i])}: ${v.toLocaleString("id-ID")}</title></path>`;
    svg += `<text x="${x + barW / 2}" y="${h - padB + 14}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(labels[i])}</text>`;
  });
  $(`#${containerId}`).innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="Grafik dokumen masuk per bulan">${svg}</svg>`;
}

function renderBarChartHorizontal(containerId, labels, values) {
  const w = 460, rowH = 26, gap = 9, padL = 92, padR = 46, padT = 6, padB = 22;
  const plotW = w - padL - padR;
  const h = padT + padB + values.length * (rowH + gap) - gap;
  const maxVal = edosirNiceMax(Math.max(...values, 1));
  const ticks  = 4;

  let svg = "";
  for (let i = 0; i <= ticks; i++) {
    const val = maxVal * i / ticks;
    const x = padL + (val / maxVal) * plotW;
    svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${h - padB}" stroke="var(--line-soft)" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${h - padB + 14}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${edosirFmtRb(val)}</text>`;
  }
  values.forEach((v, i) => {
    const y = padT + i * (rowH + gap);
    const barW = maxVal ? (v / maxVal) * plotW : 0;
    svg += `<text x="${padL - 8}" y="${y + rowH / 2 + 3}" text-anchor="end" font-size="10.5" fill="var(--body)" font-weight="600">${esc(labels[i])}</text>`;
    if (barW > 0) svg += `<path d="${edosirRoundedRightPath(padL, y, barW, rowH, 3)}" fill="var(--navy)"><title>${esc(labels[i])}: ${v.toLocaleString("id-ID")}</title></path>`;
  });
  $(`#${containerId}`).innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="Grafik 10 cabang dengan dokumen terbanyak">${svg}</svg>`;
}

function edosirKomposisiRow(color, label, count, total) {
  return `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span style="flex:1;font-size:12.5px">${label}</span>
      <span class="t-strong" style="font-size:13px">${count}</span>
      <span style="color:var(--muted);font-size:11.5px;width:38px;text-align:right">${total ? Math.round(count / total * 100) : 0}%</span>
    </div>`;
}
function renderEdosirKomposisi(agg) {
  const total = agg.rows.length;
  /* Rincian real hanya tersedia untuk 5 cabang capaian terendah (lihat
     panel di sampingnya) — seluruh cabang lain dipastikan sudah ≥100%
     karena capaian nasional sudah di atas 100%. */
  $("#edosir-komposisi").innerHTML = `
    <div class="progress-track" style="height:8px"><div class="progress-fill" style="width:100%;background:var(--green)"></div></div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
      ${edosirKomposisiRow("var(--green)", "Capaian ≥ 100%", total, total)}
      ${edosirKomposisiRow("var(--amber)", "Capaian 90–99%", 0, total)}
      ${edosirKomposisiRow("var(--red)", "Capaian &lt; 90%", 0, total)}
    </div>`;
}

function renderEdosirTerendah(agg) {
  $("#edosir-terendah").innerHTML = agg.terendah.map(t => `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="t-strong" style="font-size:12.5px">${esc(t.nama)}</span>
        <span class="t-strong" style="color:var(--green-ink);font-size:12.5px">${t.capaian.toFixed(2).replace(".", ",")}%</span>
      </div>
      <div class="progress-track" style="height:7px"><div class="progress-fill" style="width:100%;background:var(--green)"></div></div>
    </div>`).join("");
}

const EDOSIR_COLS = [
  { key:"nama", label:"Kantor Cabang" },
  { key:"saldoAwal", label:"Saldo Awal" },
  ...EDOSIR_BULAN_LABEL.map((b, i) => ({ key:"bulan" + i, label:b }))
];
function edosirColValue(c, key) {
  if (key === "nama") return c.nama;
  if (key === "saldoAwal") return c.saldoAwal;
  return c.bulan[+key.slice(5)];
}

function renderEdosirThead() {
  $("#edosir-thead").innerHTML = `<th>No</th>` + EDOSIR_COLS.map(col => `
    <th class="${col.key === "nama" ? "stick-l" : ""}" data-edosir-sort="${col.key}" style="cursor:pointer;white-space:nowrap">
      ${esc(col.label)} <span style="opacity:.5">${edosirSort.col === col.key ? (edosirSort.dir === 1 ? "▲" : "▼") : "⇅"}</span>
    </th>`).join("");
}

function renderEdosirTable() {
  const q = $("#edosir-search").value.trim().toLowerCase();
  let rows = DATA_EDOSIR_CABANG.filter(c => !q || c.nama.toLowerCase().includes(q));
  rows = rows.slice().sort((a, b) => {
    const va = edosirColValue(a, edosirSort.col), vb = edosirColValue(b, edosirSort.col);
    return typeof va === "string" ? va.localeCompare(vb) * edosirSort.dir : (va - vb) * edosirSort.dir;
  });

  $("#edosir-tbody").innerHTML = rows.length ? rows.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="stick-l t-strong">${esc(c.nama)}</td>
      <td>${c.saldoAwal.toLocaleString("id-ID")}</td>
      ${c.bulan.map(v => `<td>${v.toLocaleString("id-ID")}</td>`).join("")}
    </tr>`).join("") : `<tr><td colspan="${EDOSIR_COLS.length + 1}"><div class="empty"><h4>Tidak ada kantor cabang</h4></div></td></tr>`;

  $("#edosir-tbl-sub").textContent = `Menampilkan ${rows.length} dari ${DATA_EDOSIR_CABANG.length} cabang — klik judul kolom untuk mengurutkan.`;

  const saldoTotal = DATA_EDOSIR_CABANG.reduce((s, c) => s + c.saldoAwal, 0);
  const bulanTotal = EDOSIR_BULAN_LABEL.map((_, i) => DATA_EDOSIR_CABANG.reduce((s, c) => s + c.bulan[i], 0));
  $("#edosir-tfoot").innerHTML = `
    <td></td>
    <td class="stick-l t-strong">Total</td>
    <td class="t-strong">${saldoTotal.toLocaleString("id-ID")}</td>
    ${bulanTotal.map(v => `<td class="t-strong">${v.toLocaleString("id-ID")}</td>`).join("")}`;
}

function renderEdosir() {
  const agg   = edosirAggregates();
  const tahun = $("#edosir-tahun").value;

  $("#edosir-jml-cabang").textContent   = `${DATA_EDOSIR_CABANG.length} kantor cabang`;
  $("#edosir-jml-cabang-2").textContent = DATA_EDOSIR_CABANG.length;
  $("#edosir-m-tahun-1").textContent    = tahun;
  $("#edosir-m-tahun-2").textContent    = tahun;
  $("#edosir-chart-tahun").textContent  = tahun;

  $("#edosir-m-saldo").textContent   = agg.saldoAwal.toLocaleString("id-ID");
  $("#edosir-m-masuk").textContent   = agg.masuk.toLocaleString("id-ID");
  $("#edosir-m-total").textContent   = agg.total.toLocaleString("id-ID");
  $("#edosir-m-real").textContent    = agg.dataReal.toLocaleString("id-ID");
  $("#edosir-m-capaian").textContent = agg.capaian.toFixed(2).replace(".", ",") + "%";
  $("#edosir-m-capaian-bar").style.cssText = `width:${Math.min(100, agg.capaian)}%;background:var(--green)`;

  renderBarChartVertical("edosir-chart-bulan", EDOSIR_BULAN_LABEL, agg.bulanTotal);
  renderBarChartHorizontal("edosir-chart-top10", agg.top10.map(c => c.nama), agg.top10.map(edosirTotal));
  renderEdosirKomposisi(agg);
  renderEdosirTerendah(agg);

  renderEdosirThead();
  renderEdosirTable();
}

$("#edosir-tahun").onchange = () => {
  if ($("#edosir-tahun").value !== "2026") {
    toast(`Data untuk tahun ${$("#edosir-tahun").value} belum tersedia.`, "bad");
    $("#edosir-tahun").value = "2026";
    return;
  }
  renderEdosir();
};
$("#edosir-export").onclick = () => toast("Rekapitulasi E-Dosir diekspor ke Excel.");
$("#edosir-search").oninput = renderEdosirTable;
document.addEventListener("click", e => {
  const th = e.target.closest("[data-edosir-sort]");
  if (!th) return;
  const col = th.dataset.edosirSort;
  if (edosirSort.col === col) edosirSort.dir *= -1;
  else { edosirSort.col = col; edosirSort.dir = 1; }
  renderEdosirThead();
  renderEdosirTable();
});

/* ====================================================================== SPTB */
function isiPilihanSptb() {
  $("#sptb-f-jenis").innerHTML  += SPTB_JENIS_PENSIUN.map(j => `<option>${esc(j)}</option>`).join("");
  $("#sptb-f-mitra").innerHTML  += SPTB_MITRA.map(m => `<option>${esc(m)}</option>`).join("");
  $("#sptb-f-cabang").innerHTML += SPTB_CABANG.map(c => `<option>${esc(c)}</option>`).join("");
}

function fmtTglShortId(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${+d} ${EDOSIR_BULAN_LABEL[+m - 1]} ${y}`;
}

function sptbHitungUmur(tglLahir) {
  const lahir = new Date(tglLahir), now = new Date();
  let umur = now.getFullYear() - lahir.getFullYear();
  if (now.getMonth() < lahir.getMonth() || (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate())) umur--;
  return umur;
}

function renderSptb() {
  const fStatus  = $("#sptb-f-status").value;
  const fJenis   = $("#sptb-f-jenis").value;
  const fMitra   = $("#sptb-f-mitra").value;
  const fCabang  = $("#sptb-f-cabang").value;
  const fNopens  = $("#sptb-f-nopens").value.trim();
  const umurMin  = $("#sptb-f-umur-min").value ? +$("#sptb-f-umur-min").value : null;
  const umurMax  = $("#sptb-f-umur-max").value ? +$("#sptb-f-umur-max").value : null;
  const sptbDari = $("#sptb-f-sptb-dari").value, sptbSampai = $("#sptb-f-sptb-sampai").value;
  const payDari  = $("#sptb-f-pay-dari").value,  paySampai  = $("#sptb-f-pay-sampai").value;

  const rows = DATA_SPTB.filter(r => {
    if (fStatus && r.status !== fStatus) return false;
    if (fJenis  && r.jenisPensiun !== fJenis) return false;
    if (fMitra  && r.mitra !== fMitra) return false;
    if (fCabang && r.cabang !== fCabang) return false;
    if (fNopens && !r.nopens.includes(fNopens)) return false;
    const umur = sptbHitungUmur(r.tglLahir);
    if (umurMin !== null && umur < umurMin) return false;
    if (umurMax !== null && umur > umurMax) return false;
    if (sptbDari || sptbSampai) {
      if (!r.sptbTerakhir) return false;
      if (sptbDari   && r.sptbTerakhir < sptbDari) return false;
      if (sptbSampai && r.sptbTerakhir > sptbSampai) return false;
    }
    if (payDari   && r.payTerakhir < payDari) return false;
    if (paySampai && r.payTerakhir > paySampai) return false;
    return true;
  });

  $("#sptb-body").innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${DATA_SPTB.indexOf(r) + 1}</td>
      <td class="t-strong">${esc(r.cabang)}</td>
      <td style="color:var(--navy);font-weight:600">${esc(r.nopens)}</td>
      <td>${esc(r.nrpNip)}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td>${fmtTglShortId(r.tglLahir)}</td>
      <td>${esc(r.mitra)}</td>
      <td>${esc(r.jenisPensiun)}</td>
      <td class="t-strong">${esc(r.unor)}</td>
      <td>${r.sptbTerakhir ? fmtTglShortId(r.sptbTerakhir) : "—"}</td>
      <td>${fmtTglShortId(r.payTerakhir)}</td>
      <td><span class="pill ${r.status === "Sudah SPTB" ? "pill-ok" : "pill-bad"}">${esc(r.status)}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-sptb-cetak="${DATA_SPTB.indexOf(r)}">🖶 Cetak Kartu Peserta</button></td>
    </tr>`).join("") : `<tr><td colspan="13"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  $("#sptb-count").textContent = `menampilkan ${rows.length} dari ${DATA_SPTB.length} peserta`;
}

$("#sptb-cari").onclick  = renderSptb;
$("#sptb-reset").onclick = () => {
  ["sptb-f-status", "sptb-f-jenis", "sptb-f-mitra", "sptb-f-cabang",
   "sptb-f-nopens", "sptb-f-umur-min", "sptb-f-umur-max",
   "sptb-f-sptb-dari", "sptb-f-sptb-sampai", "sptb-f-pay-dari", "sptb-f-pay-sampai"]
    .forEach(id => $(`#${id}`).value = "");
  renderSptb();
};
$("#sptb-export").onclick = e => {
  e.stopPropagation();
  $("#sptb-export-menu").style.display = $("#sptb-export-menu").style.display === "none" ? "" : "none";
};
document.addEventListener("click", e => {
  if (!e.target.closest("#sptb-export") && !e.target.closest("#sptb-export-menu")) $("#sptb-export-menu").style.display = "none";

  const bExport = e.target.closest("[data-sptb-export]");
  if (bExport) {
    $("#sptb-export-menu").style.display = "none";
    toast(`Data SPTB diekspor ke ${bExport.dataset.sptbExport === "excel" ? "Excel" : "PDF"}.`, "ok");
    return;
  }
  const bCetak = e.target.closest("[data-sptb-cetak]");
  if (bCetak) toast(`Kartu Peserta ${DATA_SPTB[+bCetak.dataset.sptbCetak].nama} berhasil dicetak.`, "ok");
});

/* ==================================================================== HOME */
const HOME_SEVERITY_PILL = { "Kritis":"pill-bad", "High":"pill-warn", "Sedang":"pill-info" };
const HOME_TAG_STYLE = {
  kebijakan: "background:var(--blue-soft);color:var(--blue-ink)",
  baru:      "background:var(--green-soft);color:var(--green-ink)",
  info:      "background:var(--red-soft);color:var(--red)"
};
const HOME_DOT_COLOR = { kebijakan:"var(--blue-ink)", info:"var(--red)" };

function renderHome() {
  $("#home-greeting").textContent = `Selamat Datang, ${$("#top-role").value} 👋`;

  $("#home-notif-count").textContent = `${DATA_HOME_NOTIFIKASI.length} tugas`;
  $("#home-notif-list").innerHTML = DATA_HOME_NOTIFIKASI.map(n => `
    <div style="border:1px solid var(--line-soft);border-radius:9px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div class="t-strong" style="font-size:12.5px">${esc(n.judul)}</div>
        <span class="pill ${HOME_SEVERITY_PILL[n.tingkat] || "pill-info"}" style="flex-shrink:0">${esc(n.tingkat)}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(n.id)} · ${esc(n.lokasi)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(n.modul)} · ${esc(n.tanggal)}</div>
    </div>`).join("");

  const kategoriCount = new Set(DATA_HOME_PENGUMUMAN.flatMap(p => p.tag.map(t => t.jenis))).size;
  $("#home-peng-count").textContent = `${kategoriCount} kategori`;
  $("#home-peng-list").innerHTML = DATA_HOME_PENGUMUMAN.map(p => `
    <div>
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${HOME_DOT_COLOR[p.dot] || "var(--muted)"};flex-shrink:0"></span>
        ${p.tag.map(t => `<span class="pill" style="${HOME_TAG_STYLE[t.jenis] || ""};font-size:9.5px;font-weight:700;padding:3px 8px">${esc(t.label)}</span>`).join("")}
      </div>
      <div class="t-strong" style="font-size:12.5px;margin-bottom:4px">${esc(p.judul)}</div>
      <div style="font-size:11.5px;color:var(--body);line-height:1.5;margin-bottom:6px">${esc(p.body)}</div>
      <div style="font-size:10.5px;color:var(--muted)">${esc(p.divisi)} · ${esc(p.tanggal)}</div>
    </div>`).join("");
}

/* ==================================================== PENGELOLAAN REQUEST UMUM
   `riwayat` adalah satu-satunya sumber kebenaran per request — "User Request",
   "User Terakhir Reply", dan "Diperbarui" pada tabel daftar semuanya
   diturunkan darinya supaya otomatis konsisten begitu ada balasan baru. */
let ruRows = DATA_REQUEST_UMUM.map((r, i) => ({ ...r, _id: i, riwayat: r.riwayat.map(h => ({ ...h })) }));

function ruUserRequest(r) { return r.riwayat[0].user; }
function ruUserReply(r)   { return r.riwayat.length > 1 ? r.riwayat[r.riwayat.length - 1].user : "—"; }
function ruDiperbarui(r)  { return r.riwayat[r.riwayat.length - 1].jam.split(" ").slice(0, 3).join(" "); }
function ruPillStatus(s)  { return s === "Selesai" ? "pill-ok" : s === "SLA Lewat" ? "pill-bad" : "pill-warn"; }
function ruFmtJam(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getDate()} ${BULAN_ID_SHORT[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ruFmtTgl(d) { return `${d.getDate()} ${BULAN_ID_SHORT[d.getMonth()]} ${d.getFullYear()}`; }

const RU_PAGE_SIZE = 5;
let ruPage = 1;

function ruPaginationHtml(totalPages) {
  const navBtn = (p, label, disabled) => `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" ${disabled ? "disabled" : `data-ru-page="${p}"`}>${label}</button>`;
  let html = navBtn(ruPage - 1, "‹", ruPage <= 1);
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn ${p === ruPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-ru-page="${p}">${p}</button>`;
  }
  html += navBtn(ruPage + 1, "›", ruPage >= totalPages);
  return html;
}

function renderRequestUmum() {
  const fPeserta = ($("#ru-f-peserta").value || "").toLowerCase();
  const fCabang  = ($("#ru-f-cabang").value  || "").toLowerCase();
  const fStatus  = $("#ru-f-status").value;
  const fTujuan  = $("#ru-f-tujuan").value;

  const rows = ruRows.filter(r =>
    (fStatus === "all" || r.status === fStatus) &&
    (fTujuan === "all" || r.tujuan === fTujuan) &&
    (!fPeserta || r.nama.toLowerCase().includes(fPeserta) || r.nrp.includes(fPeserta)) &&
    (!fCabang  || r.cabang.toLowerCase().includes(fCabang)));

  const totalPages = Math.max(1, Math.ceil(rows.length / RU_PAGE_SIZE));
  if (ruPage > totalPages) ruPage = totalPages;
  const start    = (ruPage - 1) * RU_PAGE_SIZE;
  const pageRows = rows.slice(start, start + RU_PAGE_SIZE);

  $("#ru-body").innerHTML = pageRows.length ? pageRows.map(r => `
    <tr>
      <td>${esc(r.tglRequest)}</td>
      <td><div class="t-strong">${esc(r.nama)}</div><div class="hint" style="margin:1px 0 0">${esc(r.nrp)}</div></td>
      <td>${esc(r.cabang)}</td>
      <td><span class="pill pill-info">${esc(r.tujuan)}</span></td>
      <td class="t-strong">${esc(r.subjek)}</td>
      <td class="truncate-cell" title="${esc(r.riwayat[0].isi)}">${esc(r.riwayat[0].isi)}</td>
      <td>${esc(ruUserRequest(r))}</td>
      <td>${esc(ruUserReply(r))}</td>
      <td>${esc(ruDiperbarui(r))}</td>
      <td><span class="pill ${ruPillStatus(r.status)}">${esc(r.status)}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-ru-detail="${r._id}">👁 Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="11"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + RU_PAGE_SIZE, rows.length);
  $("#ru-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} request`;
  $("#ru-pagination").innerHTML = ruPaginationHtml(totalPages);
}
renderRequestUmum();

$("#ru-cari").onclick  = () => { ruPage = 1; renderRequestUmum(); };
$("#ru-export").onclick = () => toast("Daftar request umum diekspor ke Excel.");

/* -------------------------------------------------------------- Detail Request Umum */
let ruDetailCurrentId = null;

function ruOpenDetail()  { $("#ru-detail-overlay").classList.add("open");    document.body.style.overflow = "hidden"; }
function ruCloseDetail() { $("#ru-detail-overlay").classList.remove("open"); document.body.style.overflow = ""; }

function ruShowDetail(r) {
  ruDetailCurrentId = r._id;
  $("#ru-detail-status").innerHTML = `<span class="pill ${ruPillStatus(r.status)}">${esc(r.status)}</span>`;
  $("#ru-detail-nama").textContent = r.nama;
  $("#ru-detail-kpa").textContent  = r.kpa;

  $("#ru-detail-riwayat-body").innerHTML = r.riwayat.map(h => `
    <tr>
      <td class="t-strong">${esc(h.jam)}</td>
      <td>${esc(h.user)}</td>
      <td>${esc(h.isi)}</td>
      <td>${h.file ? `<button class="btn btn-ghost btn-sm" data-ru-unduh="${esc(h.file)}">⭳ Unduh</button>` : "—"}</td>
    </tr>`).join("");

  $("#ru-balasan-isi").value  = "";
  $("#ru-balasan-file").value = "";
  ruOpenDetail();
}

$("#ru-detail-x").onclick      = ruCloseDetail;
$("#ru-detail-tutup").onclick  = ruCloseDetail;
$("#ru-detail-overlay").onclick = e => { if (e.target.id === "ru-detail-overlay") ruCloseDetail(); };
$("#ru-balasan-batal").onclick = () => { $("#ru-balasan-isi").value = ""; $("#ru-balasan-file").value = ""; };

$("#ru-balasan-simpan").onclick = () => {
  const isi  = $("#ru-balasan-isi").value.trim();
  const file = $("#ru-balasan-file").files[0];
  if (!isi || !file) { toast("Isi dan Attachment wajib diisi sebelum menyimpan.", "bad"); return; }

  const r = ruRows.find(x => x._id === ruDetailCurrentId);
  r.riwayat.push({ jam: ruFmtJam(new Date()), user: "Anda / Div. Kepers.", isi, file: file.name });
  renderRequestUmum();
  ruShowDetail(r);
  toast("Balasan berhasil disimpan.", "ok");
};

/* -------------------------------------------------------------- Tambah Request Umum */
function ruShowTambah() {
  $("#modal-title").textContent = "Tambah Request Umum";
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">KPA <span class="req">*</span></label>
      <input class="inp" id="ru-tambah-kpa" placeholder="-- Masukkan KPA --">
    </div>
    <div class="field">
      <label class="fl">Subjek <span class="req">*</span></label>
      <input class="inp" id="ru-tambah-subjek">
    </div>
    <div class="field">
      <label class="fl">Tujuan <span class="req">*</span></label>
      <select class="inp" id="ru-tambah-tujuan">
        <option value="">-- Silahkan Pilih Tujuan --</option>
        <option value="Kepesertaan">Kepesertaan</option>
        <option value="Pelayanan">Pelayanan</option>
      </select>
    </div>
    <div class="field">
      <label class="fl">Isi <span class="req">*</span></label>
      <textarea class="inp" id="ru-tambah-isi" style="height:80px;padding:9px 10px;resize:vertical"></textarea>
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl">Attachment <span class="req">*</span></label>
      <input type="file" class="inp" id="ru-tambah-file">
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="ru-tambah-tutup">Tutup</button>
      <button class="btn btn-primary" id="ru-tambah-simpan">Simpan Request Umum</button>
    </div>`;
  openModal();
  $("#ru-tambah-tutup").onclick = closeModal;
  $("#ru-tambah-simpan").onclick = () => {
    const kpa    = $("#ru-tambah-kpa").value.trim();
    const subjek = $("#ru-tambah-subjek").value.trim();
    const tujuan = $("#ru-tambah-tujuan").value;
    const isi    = $("#ru-tambah-isi").value.trim();
    const file   = $("#ru-tambah-file").files[0];
    if (!kpa || !subjek || !tujuan || !isi || !file) { toast("Seluruh field wajib diisi sebelum menyimpan.", "bad"); return; }

    const peserta = RU_KPA_LOOKUP[kpa.toUpperCase()];
    if (!peserta) { toast("KPA tidak ditemukan pada data peserta.", "bad"); return; }

    const now = new Date();
    ruRows.unshift({
      _id: ruRows.length ? Math.max(...ruRows.map(x => x._id)) + 1 : 0,
      kpa: kpa.toUpperCase(), nama: peserta.nama, nrp: peserta.nrp, cabang: peserta.cabang,
      tujuan, subjek, tglRequest: ruFmtTgl(now), status: "Belum Selesai",
      riwayat: [ { jam: ruFmtJam(now), user: "Anda", isi, file: file.name } ]
    });
    renderRequestUmum();
    closeModal();
    toast("Request umum baru berhasil disimpan.", "ok");
  };
}
$("#ru-tambah-btn").onclick = ruShowTambah;

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-ru-page]");
  if (bPage) { ruPage = +bPage.dataset.ruPage; renderRequestUmum(); return; }

  const bDetail = e.target.closest("[data-ru-detail]");
  if (bDetail) { ruShowDetail(ruRows.find(x => x._id === +bDetail.dataset.ruDetail)); }
});

/* ====================================================================== INIT */
$("#top-role").onchange = () => { toast(`Role diubah ke: ${$("#top-role").value}.`); renderHome(); };
$("#top-avatar").textContent = PENGATURAN.inisialUser;

isiPilihanKesatuan();
renderDashboard();
renderDirtyRekap();
renderClean();
renderPum();
renderApproval();
renderWizard();
renderRiwayat();
renderPel();
renderBum();
renderDistHead();
renderDist();
renderUploadRiwayat();
renderVerifikasiList();
renderApprovalList();
renderPeroranganRiwayat();
renderNominatif();
renderPremiList();
renderEdosir();
isiPilihanSptb();
renderSptb();
renderHome();
go("home");
