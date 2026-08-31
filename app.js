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
/* Ukuran berkas dari <input type="file"> → "12 KB" / "1,4 MB". */
const ukuranBerkas = b => {
  const n = Number(b) || 0;
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
};

/* Role aktif dipilih lewat chip di navbar. Kewenangan yang dibedakan:
   Divisi Kepesertaan → verifikasi, persetujuan, dan kelola referensi;
   PIC UNOR/Kesatuan  → merevisi pengajuan miliknya;
   Kantor Cabang      → mengajukan dan memantau, tanpa hak persetujuan. */
const ROLE_DIVISI = "Divisi Kepesertaan dan Pengembangan Manfaat";
const ROLE_CABANG = "Kantor Cabang";
const ROLE_PIC    = "PIC UNOR/Kesatuan";
const ROLE_LAYANAN = "Divisi Layanan";
const roleSaatIni = () => $("#top-role").value;

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
let bumRows    = DATA_BUM.map(r => ({ ...r }));
let bumPelunasanRows = DATA_BUM_PELUNASAN.map(r => ({ ...r }));
let distRows   = DATA_DISTRIBUSI.map(r => ({ ...r }));
let distOnlyBad = false;
let pmaBatchRows = DATA_PEMUTAKHIRAN_BATCH.map((r, i) => ({ ...r, _id: i }));
let peroranganRows  = DATA_PENDAFTARAN_PERORANGAN.map((r, i) => ({ ...r, _id: i }));
let uploadBatchRows = DATA_UPLOAD_BATCH.map((r, i) => ({ ...r, _id: i }));

/* --------------------------------------------------------- Nomor Agenda
   Selalu diterbitkan otomatis oleh sistem — tidak pernah diketik pengguna.
     Kolektif  : <NOMOR SURAT PENGANTAR>/<no urut>/<username>
     Perorangan: <no urut>/<username>
   Nomor urut berjalan satu deret untuk semua jenis pendaftaran; nilai awal
   melanjutkan data contoh di data.js.                                    */
let agendaSeq = peroranganRows.length + uploadBatchRows.length;
function nomorAgendaBaru(nomorSurat) {
  const urut = String(++agendaSeq).padStart(4, "0");
  const surat = (nomorSurat || "").trim();
  return `${surat ? surat + "/" : ""}${urut}/${PENGATURAN.username}`;
}

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
  if (id === "pelunasan") { renderPel(); cekJatuhTempoPelunasan(); }
  if (id === "alih-status") alihStatusGotoView("list");
  if (id === "ref-kolektif") refKolektifGotoView("list");
  if (id === "pendaftaran-nominatif") nominatifGotoView("list");
  if (id === "dapem")        { renderDapemMetrics(); renderDapemList(); }
  if (id === "dapem-proses")   renderDapemProses();
  if (id === "dapem-validasi") renderValidasiKep();
  if (id === "dapem-keuangan") renderKeuangan();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b && !b.disabled) go(b.dataset.go);
});
$("#burger").onclick = () => $("#sidebar").classList.toggle("open");

/* ------------------------------------------------------------------- modal */
function openModal()  { $("#modal-bg").classList.add("open");    document.body.style.overflow = "hidden"; }
function closeModal() {
  $("#modal-bg").classList.remove("open"); document.body.style.overflow = "";
  /* Ikon judul bersifat opsional — selalu dikosongkan supaya modal berikutnya
     tidak ikut kebagian ikon milik modal sebelumnya. */
  $("#modal-ico").style.display = "none";
  $("#modal-ico").textContent   = "";
  $("#modal-ico").className     = "modal-ico";   /* buang nada warn/bad */
}

/* Modal konfirmasi umum (mengganti window.confirm() bawaan browser supaya
   tampilannya konsisten dengan desain aplikasi). onConfirm dipanggil setelah
   modal ditutup jika pengguna menekan tombol konfirmasi. */
function confirmModal(message, onConfirm, opts = {}) {
  $("#modal-title").textContent = opts.title || "Konfirmasi";
  $("#modal-sub").textContent   = "";
  $("#modal-ico").style.display = "";
  $("#modal-ico").textContent   = opts.icon || "⚠";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.5;margin-bottom:18px">${esc(message)}</div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="confirm-modal-batal">${esc(opts.batalLabel || "Batal")}</button>
      <button class="btn ${opts.okClass || "btn-danger-solid"}" id="confirm-modal-ok">${esc(opts.okLabel || "Hapus")}</button>
    </div>`;
  openModal();
  $("#confirm-modal-batal").onclick = closeModal;
  $("#confirm-modal-ok").onclick = () => { closeModal(); onConfirm(); };
}
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

/* Berkas asli diunduh lewat atribut href/download pada tombolnya (lihat
   index.html); handler ini hanya menampilkan notifikasi. */
$("#btn-template").onclick = () => toast("Template Pendaftaran Peserta Kolektif diunduh.");
/* Berkas dipilih dari komputer pengguna lewat <input type="file"> tersembunyi.
   Isinya tidak benar-benar dibaca — prototipe selalu memakai DATA_LIST_KOTOR
   sebagai hasil validasi; yang diambil dari berkas asli hanya namanya. */
$("#btn-upload").onclick = () => $("#k-file-batch").click();
$("#k-file-batch").onchange = e => {
  const file = e.target.files && e.target.files[0];
  /* Dikosongkan supaya memilih berkas yang sama lagi tetap memicu onchange. */
  e.target.value = "";
  if (!file) return;
  konfirmasiUploadKolektif(file, () => prosesUploadKolektif(file));
};

/* Berkas baru diproses setelah dikonfirmasi, supaya pengguna sempat
   membatalkan kalau yang terpilih ternyata berkas yang salah. */
function konfirmasiUploadKolektif(file, onConfirm) {
  $("#modal-title").textContent = "Konfirmasi Upload";
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="metric" style="margin-bottom:16px">
      <div class="metric-lbl">Nama File</div>
      <div class="metric-val" style="font-size:14px">${esc(file.name)} (${ukuranBerkas(file.size)})</div>
    </div>
    <div class="hint" style="margin:0">Apakah Anda yakin akan memproses file registrasi kolektif ini? File akan diparse dan divalidasi per baris.</div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="ku-batal">Batal</button>
      <button class="btn btn-primary" id="ku-konfirmasi">Ya, Upload</button>
    </div>`;
  openModal();
  $("#ku-batal").onclick = closeModal;
  $("#ku-konfirmasi").onclick = () => { closeModal(); onConfirm(); };
}

function prosesUploadKolektif(file) {
  $("#up-title").textContent = file.name;
  $("#up-sub").textContent = `${dirtyRows.length} baris terbaca — ${dirtyRows.length} memerlukan revisi, 0 siap disubmit`;
  $("#to-step2").disabled = false;
  $(`.step[data-step="2"]`).disabled = false;
  toast(`File tervalidasi. ${dirtyRows.length} data masuk List Kotor.`, "bad");
}
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
      <td>${esc(r.unor || "-")}</td>
      <td><span class="pill ${pillPemutakhiran(r.status)}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-pmd-riwayat-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#pmd-riwayat-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} data`;

  $("#pmd-riwayat-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === pmdRiwayatPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-pmd-riwayat-page="${p}">${p}</button>
  `).join("");
}
renderPmdRiwayat();

/* Progres 2 tahap batch pemutakhiran. Status "Disetujui" di modul ini setara
   "Diterima" di sub modul Pendaftaran, jadi bentuk steppernya sama persis —
   cukup dipetakan, tidak perlu fungsi tahapan sendiri. */
function pmdProgressSteps(status) {
  return ppProgressSteps(status === "Disetujui" ? "Diterima" : status);
}

function pmdShowRiwayatDetail(batch) {
  $("#pmd-riwayat-detail-sub").textContent = `${batch.noBatch} — ${pemutakhiranJenisLabel(batch.jenis)}`;
  renderProgressSteps("pmd-riwayat-detail-progress", pmdProgressSteps(batch.status));
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

function pmdResetUpload() {
  $("#pmd-dropzone").classList.remove("has-file");
  $("#pmd-file-title").textContent = "Tarik file ke sini atau klik untuk memilih";
  $("#pmd-file-sub").textContent   = "Format .xlsx, maksimal 5 MB";
  $("#pmd-btn-validasi").disabled  = true;
}

/* Judul dan berkas tombol "⤓ Unduh" mengikuti Jenis Pemutakhiran Data yang
   dipilih; berkas asli diunduh lewat atribut href/download pada tombolnya. */
function pmdSetTemplate(jenisKey) {
  const jenis = DATA_PEREMAJAAN[jenisKey];
  $("#pmd-template-title").textContent = jenis.templateNama;
  const tombol = $("#pmd-btn-template");
  tombol.href = encodeURIComponent(jenis.templateFile);
  tombol.setAttribute("download", jenis.templateFile);
}

$("#pmd-jenis").onchange = () => {
  pmdSetTemplate($("#pmd-jenis").value);
  pmdResetUpload();
};
pmdSetTemplate($("#pmd-jenis").value);

$("#pmd-btn-template").onclick = () => toast(`${DATA_PEREMAJAAN[$("#pmd-jenis").value].templateNama} diunduh.`);

/* Simulasi unggah berkas: modal berisi bilah progres yang berjalan sampai 100%,
   lalu menutup sendiri dan menandai dropzone sudah berisi berkas. Menutup modal
   di tengah jalan (× atau klik latar) membatalkan unggahan. */
function pmdMulaiUpload(namaFile, onSelesai) {
  $("#modal-title").textContent = "Mengunggah Berkas";
  $("#modal-sub").textContent   = namaFile;
  $("#modal-body").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <div style="font-size:13px;font-weight:600" id="pmd-up-state">Mengunggah…</div>
      <div style="font-size:12px;color:var(--muted)" id="pmd-up-pct">0%</div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="pmd-up-fill"></div></div>
    <div class="hint" style="margin:0" id="pmd-up-note">Jangan menutup jendela ini sampai unggahan selesai.</div>`;
  openModal();

  let pct = 0;
  const timer = setInterval(() => {
    /* Modal ditutup pengguna → batalkan unggahan. */
    if (!$("#modal-bg").classList.contains("open")) {
      clearInterval(timer);
      toast("Unggahan dibatalkan.", "bad");
      return;
    }
    pct = Math.min(100, pct + 7 + Math.random() * 11);
    const bulat = Math.round(pct);
    $("#pmd-up-fill").style.width = `${bulat}%`;
    $("#pmd-up-pct").textContent  = `${bulat}%`;
    if (pct < 100) return;

    clearInterval(timer);
    $("#pmd-up-fill").style.background = "var(--green)";
    $("#pmd-up-state").textContent = "✓ Berkas berhasil diunggah";
    $("#pmd-up-note").textContent  = "Berkas siap divalidasi.";
    setTimeout(() => { closeModal(); onSelesai(); }, 700);
  }, 180);
}

$("#pmd-dropzone").onclick = () => {
  const jenisKey = $("#pmd-jenis").value;
  const namaFile = `data_${jenisKey}_peserta.xlsx`;
  pmdMulaiUpload(namaFile, () => {
    $("#pmd-dropzone").classList.add("has-file");
    $("#pmd-file-title").textContent = namaFile;
    $("#pmd-file-sub").textContent   = `${DATA_PEREMAJAAN[jenisKey].rows.length} baris terbaca — siap divalidasi`;
    $("#pmd-btn-validasi").disabled  = false;
  });
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
/* Nomor batch: UNOR/Bulan/Tahun/Nomor Urut — mis. TNI-AD/08/2026/0001.
   Nomor urut berjalan per UNOR untuk bulan dan tahun yang sama. */
function pmdGenerateBatchNo(unor, d) {
  const pad = n => String(n).padStart(2, "0");
  const awalan = `${unor}/${pad(d.getMonth() + 1)}/${d.getFullYear()}/`;
  const urut   = pmaBatchRows.filter(r => r.noBatch.startsWith(awalan)).length + 1;
  return awalan + String(urut).padStart(4, "0");
}

$("#pmd-submit").onclick = () => {
  if ($("#pmd-submit").disabled) return;
  const jenisKey = $("#pmd-jenis").value;
  const jenis    = DATA_PEREMAJAAN[jenisKey];
  const unor     = $("#pmd-unor").value;
  const now      = new Date();

  pmaBatchRows.unshift({
    _id: pmaBatchRows.length ? Math.max(...pmaBatchRows.map(r => r._id)) + 1 : 0,
    noBatch:     pmdGenerateBatchNo(unor, now),
    jenis:       jenisKey,
    waktu:       pmdFmtWaktuBatch(now),
    userUpload:  PENGATURAN.namaUser,
    unor:        unor,
    jumlahBaris: jenis.rows.length,
    status:      "Pending",
    kolom:       jenis.kolom,
    rows:        jenis.rows.map(r => ({ ...r }))
  });
  renderPeremajaanApproval();
  renderPmdRiwayat();

  toast(`Pemutakhiran "${jenis.label}" berhasil disubmit dan diteruskan ke persetujuan.`, "ok");
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
  return DATA_PEREMAJAAN[jenisKey] ? DATA_PEREMAJAAN[jenisKey].label : jenisKey;
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
      <td>${esc(r.userUpload || "-")}</td>
      <td>${r.jumlahBaris}</td>
      <td><span class="pill ${pillPemutakhiran(r.status)}">${esc(r.status.toUpperCase())}</span></td>
      <td><button class="btn btn-info btn-sm" data-pma-detail="${r._id}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

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
  renderProgressSteps("pma-detail-progress", pmdProgressSteps(r.status));
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
  const noSurat  = $("#k-surat").value.trim();
  const noAgenda = nomorAgendaBaru(noSurat);
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
      nomorSurat: noSurat,
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
      nomorAgenda: nomorAgendaBaru(dataPengajuan.nomorSurat),
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
      nomorAgenda: nomorAgendaBaru(),
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
let plafonPager = { hal: 1, per: 10 };

function renderPlafon() {
  const pg = pagerPotong(plafonRows, plafonPager);
  $("#plafon-body").innerHTML = pg.hal.length ? pg.hal.map((r, i) => `
    <tr>
      <td>${pg.mulai + i + 1}</td>
      <td>${esc(r.statusPersonil)}</td>
      <td>${esc(r.angkatan)}</td>
      <td>${esc(r.kesatuan)}</td>
      <td>${esc(r.golongan)}</td>
      <td>${esc(r.pangkat)}</td>
      <td>${rp(r.nominal)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-plafon-ubah="${r._id}">✎ Ubah</button>
        <button class="btn btn-danger-solid btn-sm" data-plafon-hapus="${r._id}">Hapus</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="8"><div class="empty"><h4>Belum ada data plafon</h4><p>Klik "+ Input Plafon" untuk menambahkan.</p></div></td></tr>`;
  $("#plafon-note").innerHTML  = pagerNote(pg, "plafon", "");
  $("#plafon-pager").innerHTML = pagerHtml(plafonPager, pg, "data-plafon-hal");
}

/* Pilihan Pangkat mengikuti kombinasi Status Personil + Angkatan + Golongan
   yang sedang dipilih (lihat PLAFON_PANGKAT di data.js) — PPPK punya daftar
   sendiri (GOL.I–GOL.XVII) yang tidak bergantung pada Angkatan/Golongan. */
function plafonPangkatOptions(statusPersonil, angkatan, golongan) {
  if (statusPersonil === "PPPK") return PLAFON_PANGKAT_PPPK;
  if (!statusPersonil || !angkatan || !golongan) return [];
  return PLAFON_PANGKAT[`${statusPersonil}|${angkatan}|${golongan}`] || [];
}

function plafonRenderPangkatSelect(selectedPangkat) {
  const statusPersonil = $("#plafon-status-personil").value;
  const angkatan        = $("#plafon-angkatan").value;
  const golongan         = $("#plafon-golongan").value;
  const opts = plafonPangkatOptions(statusPersonil, angkatan, golongan);
  $("#plafon-pangkat").innerHTML =
    `<option value="">${opts.length ? "Pilih pangkat" : "Lengkapi Status Personil / Angkatan / Golongan dahulu"}</option>` +
    opts.map(p => `<option ${p === selectedPangkat ? "selected" : ""}>${esc(p)}</option>`).join("");
  $("#plafon-pangkat").disabled = opts.length === 0;
}

function plafonForm(existing) {
  $("#modal-title").textContent = existing ? "Ubah Plafon" : "Input Plafon";
  $("#modal-sub").textContent   = "Parameter Plafon PUM KPR";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Status Personil <span class="req">*</span></label>
      <select class="inp" id="plafon-status-personil">
        <option value="">Pilih status personil</option>
        ${PLAFON_STATUS_PERSONIL.map(s => `<option ${existing && existing.statusPersonil === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Angkatan <span class="req">*</span></label>
      <select class="inp" id="plafon-angkatan">
        <option value="">Pilih angkatan</option>
        ${PLAFON_ANGKATAN.map(a => `<option ${existing && existing.angkatan === a ? "selected" : ""}>${esc(a)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Kesatuan <span class="req">*</span></label>
      <select class="inp" id="plafon-kesatuan">
        <option value="">Pilih kesatuan</option>
        ${PLAFON_KESATUAN.map(k => `<option ${existing && existing.kesatuan === k ? "selected" : ""}>${esc(k)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Golongan <span class="req">*</span></label>
      <select class="inp" id="plafon-golongan">
        <option value="">Pilih golongan</option>
        ${PLAFON_GOLONGAN.map(g => `<option ${existing && existing.golongan === g ? "selected" : ""}>${esc(g)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label class="fl">Pangkat <span class="req">*</span></label>
      <select class="inp" id="plafon-pangkat"></select>
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
  plafonRenderPangkatSelect(existing ? existing.pangkat : null);

  ["#plafon-status-personil", "#plafon-angkatan", "#plafon-golongan"].forEach(sel => {
    $(sel).onchange = () => plafonRenderPangkatSelect(null);
  });
  $("#plafon-nominal").oninput = e => {
    const n = angkaSaja(e.target.value);
    e.target.value = n ? Number(n).toLocaleString("id-ID") : "";
  };
  $("#plafon-batal").onclick = closeModal;
  $("#plafon-simpan").onclick = () => {
    const statusPersonil = $("#plafon-status-personil").value;
    const angkatan        = $("#plafon-angkatan").value;
    const kesatuan         = $("#plafon-kesatuan").value;
    const golongan         = $("#plafon-golongan").value;
    const pangkat          = $("#plafon-pangkat").value;
    const nominal          = parseNum($("#plafon-nominal").value);
    if (!statusPersonil) { toast("Status Personil belum dipilih.", "bad"); return; }
    if (!angkatan)        { toast("Angkatan belum dipilih.", "bad"); return; }
    if (!kesatuan)         { toast("Kesatuan belum dipilih.", "bad"); return; }
    if (!golongan)         { toast("Golongan belum dipilih.", "bad"); return; }
    if (!pangkat)          { toast("Pangkat belum dipilih.", "bad"); return; }
    if (!nominal)          { toast("Nominal Plafon belum diisi.", "bad"); return; }
    const dup = plafonRows.find(r =>
      r.statusPersonil === statusPersonil && r.angkatan === angkatan &&
      r.golongan === golongan && r.pangkat === pangkat &&
      (!existing || r._id !== existing._id));
    if (dup) { toast(`Plafon untuk pangkat ${pangkat} sudah ada — silakan Ubah data yang sudah ada.`, "bad"); return; }

    if (existing) {
      Object.assign(existing, { statusPersonil, angkatan, kesatuan, golongan, pangkat, nominal });
      toast(`Plafon ${pangkat} berhasil diubah.`, "ok");
    } else {
      plafonRows.push({ _id: plafonSeq++, statusPersonil, angkatan, kesatuan, golongan, pangkat, nominal });
      toast(`Plafon ${pangkat} berhasil ditambahkan.`, "ok");
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
    confirmModal(`Hapus plafon untuk angkatan ${r.angkatan}?`, () => {
      plafonRows = plafonRows.filter(x => x._id !== r._id);
      renderPlafon();
      toast(`Plafon ${r.angkatan} dihapus.`, "ok");
    }, { title: "Hapus Plafon" });
    return;
  }
  const plafonHal = e.target.closest("[data-plafon-hal]");
  if (plafonHal) { plafonPager.hal = +plafonHal.dataset.plafonHal; renderPlafon(); }
});
renderPlafon();

/* ================================================================= PUM KPR */
const pillPum = s => s === "Disetujui" ? "pill-ok" : s === "Ditolak" || s === "Revisi" ? "pill-bad" : s === "Submitted" ? "pill-info" : "pill-warn";

/* Label tampilan status di Daftar Pengajuan KPR (PUM) — "Submitted" tampil
   sebagai "Pending" supaya konsisten dengan istilah yang dipahami PIC UNOR/
   Kesatuan; status internal (dipakai untuk logika & filter) tidak berubah. */
const pumStatusLabel = s => s === "Submitted" ? "Pending" : s;

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
    <tr id="pum-row-${r._id}"${r.status === "Revisi" ? ` style="background:var(--red-soft)"` : ""}>
      <td class="t-strong">${esc(r.kpa)}</td><td>${esc(r.nrp)}</td><td>${esc(r.npwp)}</td>
      <td class="t-name">${esc(r.nama)}</td><td>${esc(r.angkatan)}</td><td>${esc(r.tglAmbil)}</td>
      <td>${esc(r.tipePum)}</td><td>${esc(r.tipeRumah)}</td>
      <td><span class="pill ${pillPum(r.status)}">${esc(pumStatusLabel(r.status))}</span></td>
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

/* Dipanggil dari notifikasi "Revisi Pengajuan KPR (PUM)" — pastikan baris
   pengajuannya benar-benar tampil (reset filter yang mungkin masih
   menyembunyikannya), lalu gulir langsung ke baris itu. */
function sorotBarisPum(id) {
  if (!pumRows.some(r => r._id === id)) return;
  $("#pum-filter").value = "all";
  ["#pum-f-kpa", "#pum-f-npwp", "#pum-f-nama", "#pum-f-nrp"].forEach(sel => $(sel).value = "");
  renderPum();
  requestAnimationFrame(() => {
    const el = $(`#pum-row-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ---------------------------------------------------------- pengajuan baru */
$("#btn-ajukan-pum").onclick = () => {
  $("#pum-baru-kpa").value = "";
  $("#pum-baru-hasil").style.display = "none";
  $("#pum-baru-hasil").innerHTML = "";
  go("pum-baru");
};
$("#pum-baru-kembali").onclick = () => go("pum");

function showAlertPopup(title, msg, sub = "", type = "bad") {
  $("#modal-title").textContent = title;
  $("#modal-sub").textContent = sub;
  $("#modal-body").innerHTML = `
    <div class="alert alert-${type}"><span>${type === "ok" ? "✓" : "⚠"}</span><span>${esc(msg)}</span></div>
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
    pumValidasiPopup(existing.status === "Draft" || existing.status === "Revisi"
      ? `Nomor KPA ${existing.kpa} tidak dapat melanjutkan Pengajuan KPR (PUM) karena data masih dalam proses Pengajuan KPR (PUM).`
      : `Nomor KPA ${existing.kpa} tidak dapat melanjutkan Pengajuan KPR (PUM) karena data sudah pernah diinput.`);
    return;
  }

  const found = DATA_MASTER_PESERTA.find(x => x.kpa.toLowerCase() === kpa.toLowerCase());
  if (!found) {
    toast(`Nomor KPA "${kpa}" tidak ditemukan pada sistem ASABRI.`, "bad");
    return;
  }

  /* Anggota TNI dengan Masa Kerja Dinas < 2 Tahun belum memenuhi syarat
     Pengajuan KPR (PUM) — tampilkan data seperti biasa tapi kunci "Lanjutkan". */
  const masaKerjaAwal = /^tni/i.test(found.angkatan || "") ? masaKerjaKpaAwal(found.kpa) : null;
  const belumMemenuhiSyarat = masaKerjaAwal !== null && masaKerjaAwal < 2;

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
      <button class="btn btn-primary" id="pum-baru-lanjut" ${belumMemenuhiSyarat ? "disabled" : ""}>Lanjutkan →</button>
    </div>`;

  if (belumMemenuhiSyarat) {
    showAlertPopup("Validasi Masa Kerja Dinas", `Masa Kerja Dinas KPA ${found.kpa} kurang dari 2 Tahun.`);
  } else {
    toast(`Data peserta ${found.nama} berhasil diambil dari sistem.`, "ok");
  }

  $("#pum-baru-lanjut").onclick = () => { if (!belumMemenuhiSyarat) bukaFormPeserta(found); };
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
    showAlertPopup("Validasi NIK", "NIK tidak valid, mohon input NIK yang valid.");
    return;
  }
  showAlertPopup("Validasi NIK", "NIK valid", "", "ok");
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
  $(`#${prefix}-nama-peserta`).value = pfFound.nama || "-";
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
      showAlertPopup("Validasi Rekening", "Nomor Rekening Tidak Valid, silahkan masukkan Nomor Rekening yang Valid.");
      return;
    }
    showAlertPopup("Validasi Rekening", "Nomor Rekening Valid", "", "ok");
  };
}
bindCekRekening("pf4");
bindCekRekening("pf4pm");
bindCekRekening("pf4mr");

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
  const wajib = !d.kondisional;
  return `
    <div class="doc-row">
      <div class="doc-info">
        <span class="doc-ico">📄</span>
        <div>
          <div class="doc-label">${esc(d.label)}${wajib ? ` <span class="req">*</span>` : ` <span class="hint" style="display:inline;font-weight:400">(Opsional)</span>`}</div>
          ${d.note ? `<div class="doc-note">${esc(d.note)}</div>` : ""}
        </div>
      </div>
      <div class="doc-actions">
        <span class="pill pill-ok" id="pf5-status-${i}" style="display:none">Terunggah</span>
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
  pillEl.style.display = "";
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

function tahunDariTmt(tmt) {
  if (!tmt) return null;
  const start = new Date(tmt), now = new Date();
  let tahun = now.getFullYear() - start.getFullYear();
  if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) tahun--;
  return Math.max(0, tahun);
}

function hitungMasaKerjaTahun() {
  return tahunDariTmt(pfEarliestTmt());
}

/* Masa Kerja Dinas dari Riwayat Kepangkatan Peserta (DB) langsung berdasarkan
   Nomor KPA — dipakai di langkah "Cari Data Peserta" sebelum wizard (dan
   pfFound) terbentuk. */
function masaKerjaKpaAwal(kpa) {
  const rows = DATA_RIWAYAT_KEPANGKATAN[kpa] || [];
  const tmts = rows.map(r => r.tmt).filter(Boolean).sort();
  return tahunDariTmt(tmts[0] || null);
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
        { label:"Nama Peserta", value: fv("pf4-nama-peserta") },
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
        { label:"Nama Peserta", value: fv("pf4pm-nama-peserta") },
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
        { label:"Nama Peserta", value: fv("pf4mr-nama-peserta") },
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
    ? `<div class="tbl-wrap"><table><thead><tr><th>No</th><th>Pangkat</th><th>Nomor SKEP Pengangkatan</th><th>TMT Pengangkatan</th><th>Tanggal SKEP Pengangkatan</th></tr></thead><tbody>${
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
      <button class="btn btn-primary" id="pf6-pernyataan-setuju" disabled>✓ Setuju & Simpan</button>
    </div>`;
  openModal();
  $("#pf6-pernyataan-batal").onclick = closeModal;

  const tombolSetuju = $("#pf6-pernyataan-setuju");
  const cekSemuaDicentang = () => {
    tombolSetuju.disabled = $$(".pf6-pernyataan-chk").some(c => !c.checked);
  };
  $$(".pf6-pernyataan-chk").forEach(c => c.onchange = cekSemuaDicentang);

  tombolSetuju.onclick = () => {
    if (tombolSetuju.disabled) return;
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

/* Label status untuk tabel & filter Approval KPR (PUM) — status internal
   (Submitted/Disetujui/Ditolak/Draft) ditampilkan sebagai Tertunda/Diterima/
   Ditolak/Tertunda supaya konsisten dengan istilah di halaman approval lain. */
function statusApprovalLabel(s) {
  return s === "Disetujui" ? "Diterima" : s === "Ditolak" ? "Ditolak" : "Tertunda";
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
      <td><span class="pill ${pillPum(r.status)}">${esc(statusApprovalLabel(r.status))}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-info btn-sm"         data-ap-detail="${r._id}">Detail</button>
        <button class="btn btn-danger-solid btn-sm" data-ap-hapus="${r._id}">Hapus</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="11"><div class="empty"><h4>Tidak ada pengajuan</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

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
     dibatasi per role: Divisi Kepesertaan → Tolak/Revisi/Setujui,
     PIC UNOR/Kesatuan & Kantor Cabang → hanya memantau status pengajuan. */
  if (pumDetailContext === "approval") {
    const role = roleSaatIni();
    $("#pd-actions").innerHTML =
        role === ROLE_DIVISI ? `<button class="btn btn-danger-solid" id="pd-tolak">✕ Tolak</button>
                                <button class="btn btn-gold" id="pd-revisi-divisi">↺ Revisi</button>
                                <button class="btn btn-success" id="pd-setuju">✓ Setujui</button>`
      :                        `<span class="hint" style="margin:0">Role ${esc(role)} hanya dapat memantau status pengajuan.</span>`;
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

  /* Muncul selama status masih "Revisi" (dikembalikan lewat tombol "Revisi"
     di Approval, dengan catatan penolakan tersimpan) — supaya PIC UNOR/
     Kesatuan tahu apa yang perlu diperbaiki sebelum submit ulang. Hilang lagi
     otomatis begitu statusnya berubah (diedit ulang jadi Draft, atau sudah
     disubmit ulang). */
  const detailRevisiHtml = (r.status === "Revisi" && r.catatanApproval)
    ? `<div class="subsection-title">Detail Revisi</div>
       <div class="alert alert-warn" style="margin-bottom:18px"><span>↺</span><span>${esc(r.catatanApproval)}</span></div>`
    : "";

  if (!r.detail) {
    $("#pd-body").innerHTML = `
      ${detailRevisiHtml}
      <div class="subsection-title">Data Peserta</div>
      <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(basicFields)}</div>
      <div class="alert alert-info" style="margin-top:18px"><span>ⓘ</span><span>Rincian lengkap (Data Kepangkatan, Detail Pengajuan, Dokumen Terunggah) belum tersedia untuk pengajuan ini karena dibuat sebelum formulir pengajuan lengkap tersedia di sistem.</span></div>`;
    return;
  }

  const d = r.detail;
  $("#pd-body").innerHTML = `
    ${detailRevisiHtml}
    <div class="subsection-title">Data Peserta</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(d.dataPeserta)}</div>

    <div class="subsection-title">Riwayat Kepangkatan Peserta</div>
    ${(d.riwayatDb || []).length
      ? `<div class="tbl-wrap"><table><thead><tr><th>No</th><th>Pangkat</th><th>Nomor SKEP Pengangkatan</th><th>TMT Pengangkatan</th><th>Tanggal SKEP Pengangkatan</th></tr></thead><tbody>${
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
  if (e.target.closest("#pd-revisi-divisi")) {
    $("#modal-title").textContent = "Revisi Pengajuan KPR (PUM)";
    $("#modal-sub").textContent   = `${pumDetailRow.kpa} — ${pumDetailRow.nama}`;
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Detail Revisi <span class="req">*</span></label>
        <textarea class="inp" id="pd-detail-revisi" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Jelaskan bagian yang perlu diperbaiki oleh PIC UNOR/Kesatuan"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="pd-revisi-divisi-batal">Batal</button>
        <button class="btn btn-gold" id="pd-revisi-divisi-simpan">↺ Simpan Revisi</button>
      </div>`;
    openModal();
    $("#pd-revisi-divisi-batal").onclick = closeModal;
    $("#pd-revisi-divisi-simpan").onclick = () => {
      const detailRevisi = $("#pd-detail-revisi").value.trim();
      if (!detailRevisi) { toast("Detail Revisi wajib diisi.", "bad"); return; }
      pumDetailRow.status = "Revisi";
      pumDetailRow.catatanApproval = detailRevisi;
      closeModal();
      renderApproval(); renderPum();
      toast(`Pengajuan ${pumDetailRow.nama} dikembalikan ke PIC UNOR/Kesatuan untuk direvisi.`, "bad");
      go(pumDetailBackTarget);
    };
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
    if (r.status !== "Draft" && r.status !== "Revisi") { toast(`Pengajuan ${r.nama} sudah pernah disubmit.`); return; }
    r.status = "Submitted";
    renderPum(); renderApproval();
    toast(`Pengajuan ${r.nama} berhasil disubmit dan masuk ke Approval KPR (PUM).`, "ok");
  }
});

/* =============================================================== PELUNASAN */
/* Satu baris = satu peserta yang KPR (PUM)-nya jatuh tempo. Daftar & filter
   mengikuti pola halaman Approval KPR (PUM); keputusan Setujui/Tolak diambil
   per peserta di halaman Detail Pelunasan KPR (PUM). */
const pillPel = s => s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn";
let pelRows   = DATA_PELUNASAN.map((r, i) => ({ ...r, _id: i }));
let pelNextId = pelRows.length;
let pelPage   = 1;

/* Integrasi Approval KPR (PUM) → Pelunasan KPR (PUM): pengajuan yang sudah
   Disetujui otomatis masuk begitu Tanggal Akhir Kredit-nya tercapai. */
function cekJatuhTempoPelunasan() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const jatuhTempo = pumRows.filter(r =>
    r.status === "Disetujui" && r.tglAkhirKredit && !r.masukPelunasan && r.tglAkhirKredit <= todayIso);
  if (!jatuhTempo.length) return;

  jatuhTempo.forEach(r => {
    const d = new Date(r.tglAkhirKredit);
    const tglJatuhTempo = `${HARI_ID[d.getDay()]}, ${fmtTgl(r.tglAkhirKredit)}`;
    pelRows.unshift({
      _id: pelNextId++, kpa: r.kpa, nrp: r.nrp, npwp: r.npwp, nama: r.nama,
      angkatan: r.angkatan, uker: extractDetailField(r, "UKER") || "-", cabang: r.kancab || "-",
      tglAmbil: r.tglAmbil, tipePum: r.tipePum, tipeRumah: r.tipeRumah, jumlah: r.jumlah,
      tglAkhirKredit: tglJatuhTempo, periode: `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`,
      tglPelunasan: tglJatuhTempo, sisaPiutang: r.jumlah, jumlahDilunasi: r.jumlah,
      caraPelunasan: "Otomatis — jatuh tempo", status: "Pending", catatan: ""
    });
    r.masukPelunasan = true;
  });
  pelPage = 1;
  renderPel();
  toast(`${jatuhTempo.length} pengajuan KPR (PUM) jatuh tempo — masuk ke Pelunasan KPR (PUM).`, "ok");
}

function renderPel() {
  const fKpa  = ($("#pel-f-kpa").value  || "").toLowerCase();
  const fNpwp = ($("#pel-f-npwp").value || "").toLowerCase();
  const fNama = ($("#pel-f-nama").value || "").toLowerCase();
  const fNrp  = ($("#pel-f-nrp").value  || "").toLowerCase();
  const fSt   = $("#pel-filter").value;

  const rows = pelRows.filter(r =>
    (fSt === "all" || r.status === fSt) &&
    (!fKpa  || r.kpa.toLowerCase().includes(fKpa))   &&
    (!fNpwp || r.npwp.toLowerCase().includes(fNpwp)) &&
    (!fNama || r.nama.toLowerCase().includes(fNama)) &&
    (!fNrp  || r.nrp.toLowerCase().includes(fNrp)));

  const pageSize   = +$("#pel-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (pelPage > totalPages) pelPage = totalPages;
  const start    = (pelPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#pel-body").innerHTML = pageRows.length ? pageRows.map(r => `
    <tr>
      <td class="t-strong">${esc(r.kpa)}</td><td>${esc(r.nrp)}</td><td>${esc(r.npwp)}</td>
      <td class="t-name">${esc(r.nama)}</td><td>${esc(r.angkatan)}</td><td>${esc(r.tglAmbil)}</td>
      <td><span class="pill ${tipePumPillClass(r.tipePum)}">${esc(r.tipePum)}</span></td>
      <td>${esc(r.tipeRumah)}</td><td>${rp(r.jumlah)}</td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-info btn-sm"         data-pel-detail="${r._id}">Detail</button>
        <button class="btn btn-danger-solid btn-sm" data-pel-hapus="${r._id}">Hapus</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada data pelunasan</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#pel-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length}`;

  $("#pel-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === pelPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-pel-page="${p}">${p}</button>
  `).join("");
}

["#pel-f-kpa", "#pel-f-npwp", "#pel-f-nama", "#pel-f-nrp"].forEach(sel => $(sel).oninput = () => { pelPage = 1; renderPel(); });
$("#pel-filter").onchange    = () => { pelPage = 1; renderPel(); };
$("#pel-page-size").onchange = () => { pelPage = 1; renderPel(); };
$("#btn-export-pel").onclick = () => toast("Laporan pelunasan KPR (PUM) diekspor ke Excel.");

/* --------------------------------------- halaman Detail Pelunasan KPR (PUM) */
let pelDetailRow = null;

function renderPelDetailPage() {
  const r = pelDetailRow;
  if (!r) return;

  $("#peld-title").textContent  = r.nama;
  $("#peld-sub").textContent    = `${r.kpa} · ${r.nrp} · jatuh tempo ${r.tglAkhirKredit}`;
  $("#peld-status").className   = "pill " + pillPel(r.status);
  $("#peld-status").textContent = r.status;

  $("#peld-body").innerHTML = `
    <div class="metrics m3">
      <div class="metric"><div class="metric-lbl">Sisa piutang</div><div class="metric-val">${rp(r.sisaPiutang)}</div></div>
      <div class="metric"><div class="metric-lbl">Jumlah dilunasi</div><div class="metric-val">${rp(r.jumlahDilunasi)}</div></div>
      <div class="metric"><div class="metric-lbl">Periode jatuh tempo</div><div class="metric-val">${esc(r.periode)}</div></div>
    </div>

    <div class="subsection-title">Data Peserta</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml([
      { label: "KPA", value: r.kpa }, { label: "NRP/NIP", value: r.nrp },
      { label: "NPWP", value: r.npwp }, { label: "Nama Peserta", value: r.nama },
      { label: "Angkatan", value: r.angkatan }, { label: "UKER/Kesatuan", value: r.uker },
      { label: "Kantor Cabang", value: r.cabang }
    ])}</div>

    <div class="subsection-title">Data KPR (PUM)</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml([
      { label: "Tipe PUM", value: r.tipePum }, { label: "Tipe Rumah", value: r.tipeRumah },
      { label: "Tanggal Ambil PUM", value: r.tglAmbil },
      { label: "Jumlah Ambil PUM", value: rp(r.jumlah) },
      { label: "Tanggal Akhir Kredit", value: r.tglAkhirKredit }
    ])}</div>

    <div class="subsection-title">Rincian Pelunasan</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml([
      { label: "Periode Jatuh Tempo", value: r.periode },
      { label: "Tanggal Pelunasan", value: r.tglPelunasan },
      { label: "Sisa Piutang", value: rp(r.sisaPiutang) },
      { label: "Jumlah Dilunasi", value: rp(r.jumlahDilunasi) },
      { label: "Cara Pelunasan", value: r.caraPelunasan },
      { label: "Status Pelunasan", value: r.status },
      { label: "Catatan Approval", value: r.catatan || "-", wide: true }
    ])}</div>

    ${r.status === "Pending"
      ? `<div class="alert alert-info" style="margin-top:18px"><span>ⓘ</span><span>Setelah disetujui: data pelunasan terkirim ke Dynamics 365 dan Berita Acara Rekon Piutang ter-generate.</span></div>`
      : r.status === "Disetujui"
        ? `<div class="alert alert-ok" style="margin-top:18px"><span>✓</span><span>Pelunasan disetujui — data terkirim ke Dynamics 365 dan Berita Acara Rekon Piutang sudah ter-generate.</span></div>`
        : `<div class="alert alert-bad" style="margin-top:18px"><span>⚠</span><span>Pelunasan ditolak — data dikembalikan untuk verifikasi ulang.</span></div>`}`;

  $("#peld-actions").innerHTML = r.status === "Pending"
    ? `<button class="btn btn-danger-solid" id="peld-tolak">✕ Tolak</button>
       <button class="btn btn-success" id="peld-setuju">✓ Setujui Pelunasan</button>`
    : `<span class="pill ${pillPel(r.status)}">${esc(r.status.toUpperCase())}</span>`;
}

function putusanPelunasan(status, catatan, pesan, kind) {
  pelDetailRow.status  = status;
  pelDetailRow.catatan = catatan;
  if (status === "Ditolak") pelDetailRow.jumlahDilunasi = 0;
  renderPel();
  renderPelDetailPage();
  toast(pesan, kind);
  go("pelunasan");
}

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-pel-page]");
  if (bPage) { pelPage = +bPage.dataset.pelPage; renderPel(); return; }

  const bDetail = e.target.closest("[data-pel-detail]");
  if (bDetail) {
    pelDetailRow = pelRows.find(x => x._id === +bDetail.dataset.pelDetail);
    renderPelDetailPage();
    go("pelunasan-detail");
    return;
  }

  const bHapus = e.target.closest("[data-pel-hapus]");
  if (bHapus) {
    const id = +bHapus.dataset.pelHapus;
    const r  = pelRows.find(x => x._id === id);
    if (!confirm(`Hapus data pelunasan KPR (PUM) atas nama ${r.nama}?`)) return;
    pelRows = pelRows.filter(x => x._id !== id);
    renderPel();
    toast(`Data pelunasan ${r.nama} dihapus.`, "bad");
    return;
  }

  if (e.target.closest("#peld-setuju")) {
    $("#modal-title").textContent = "Konfirmasi Persetujuan Pelunasan";
    $("#modal-sub").textContent   = `${pelDetailRow.kpa} — ${pelDetailRow.nama}`;
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Catatan Persetujuan</label>
        <textarea class="inp" id="peld-catatan-setuju" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Opsional"></textarea>
        <div class="hint">Data terkirim ke Dynamics 365 dan Berita Acara Rekon Piutang ter-generate setelah disetujui.</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="peld-setuju-batal">Batal</button>
        <button class="btn btn-success" id="peld-setuju-konfirmasi">✓ Setujui Pelunasan</button>
      </div>`;
    openModal();
    $("#peld-setuju-batal").onclick = closeModal;
    $("#peld-setuju-konfirmasi").onclick = () => {
      const catatan = $("#peld-catatan-setuju").value.trim();
      closeModal();
      putusanPelunasan("Disetujui",
        catatan || "Data terkirim ke Dynamics 365, Berita Acara Rekon Piutang ter-generate.",
        `Pelunasan ${pelDetailRow.nama} disetujui. Data terkirim ke Dynamics 365, BA Rekon Piutang ter-generate.`, "ok");
    };
    return;
  }

  if (e.target.closest("#peld-tolak")) {
    $("#modal-title").textContent = "Konfirmasi Penolakan Pelunasan";
    $("#modal-sub").textContent   = `${pelDetailRow.kpa} — ${pelDetailRow.nama}`;
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Alasan Menolak <span class="req">*</span></label>
        <textarea class="inp" id="peld-alasan-tolak" style="height:90px;padding:9px 10px;resize:vertical" placeholder="Tuliskan alasan penolakan"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="peld-tolak-batal">Batal</button>
        <button class="btn btn-danger-solid" id="peld-tolak-konfirmasi">✕ Tolak Pelunasan</button>
      </div>`;
    openModal();
    $("#peld-tolak-batal").onclick = closeModal;
    $("#peld-tolak-konfirmasi").onclick = () => {
      const alasan = $("#peld-alasan-tolak").value.trim();
      if (!alasan) { toast("Alasan penolakan wajib diisi.", "bad"); return; }
      closeModal();
      putusanPelunasan("Ditolak", alasan,
        `Pelunasan ${pelDetailRow.nama} ditolak dan dikembalikan untuk verifikasi ulang.`, "bad");
    };
  }
});

$("#peld-kembali").onclick      = () => go("pelunasan");
$("#peld-kembali-atas").onclick = () => go("pelunasan");

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
      ${reviewField("Nominal Pinjaman", rp(r.jumlah))}
      ${reviewField("Sisa Hutang", rp(r.sisaHutang))}
      ${reviewField("Saldo Outstanding", rp(r.outstanding))}
      ${r.nilaiPemotongan ? reviewField("Nilai Pemotongan", rp(r.nilaiPemotongan)) : ""}
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
  ["#bpk-nrp", "#bpk-nik", "#bpk-nama", "#bpk-tgl-lahir", "#bpk-tmt-masuk", "#bpk-jk",
   "#bpk-nominal-pinjaman", "#bpk-sisa-hutang", "#bpk-saldo-outstanding"].forEach(sel => $(sel).value = "");
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
  $("#bpk-jk").value                 = found.jk === "L" ? "Laki-laki" : "Perempuan";
  $("#bpk-nominal-pinjaman").value   = rp(found.nominalPinjaman);
  $("#bpk-sisa-hutang").value        = rp(found.sisaHutang);
  $("#bpk-saldo-outstanding").value  = rp(found.saldoOutstanding);
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
        <label class="fl">Nominal Pinjaman <span class="req">*</span></label>
        <input class="inp" id="bpk-nominal-pinjaman" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Sisa Hutang <span class="req">*</span></label>
        <input class="inp" id="bpk-sisa-hutang" readonly placeholder="Otomatis terisi dari KPA">
      </div>
      <div class="field">
        <label class="fl">Saldo Outstanding <span class="req">*</span></label>
        <input class="inp" id="bpk-saldo-outstanding" readonly placeholder="Otomatis terisi dari KPA">
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
    const nilaiPemotongan = +$("#bpk-jumlah").value;
    const nrp = $("#bpk-nrp").value, nik = $("#bpk-nik").value, nama = $("#bpk-nama").value,
          tglLahir = $("#bpk-tgl-lahir").value, tmtMasuk = $("#bpk-tmt-masuk").value, jkText = $("#bpk-jk").value;

    if (!nomorPermohonan || !jenisPinjaman || !kpa || !keterangan || !nilaiPemotongan) {
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
      jenisPinjaman,
      jumlah: found.nominalPinjaman, sisaHutang: found.sisaHutang, outstanding: found.saldoOutstanding,
      nilaiPemotongan, keterangan
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

/* ==================================================== PELUNASAN KPR (BUM) */
let bplPage = 1;
function renderBumPelunasan() {
  const fDari     = $("#bpl-f-dari").value;
  const fSampai   = $("#bpl-f-sampai").value;
  const fCabang   = ($("#bpl-f-cabang").value || "").toLowerCase();
  const fNrp      = ($("#bpl-f-nrp").value    || "").toLowerCase();
  const fNama     = ($("#bpl-f-nama").value   || "").toLowerCase();
  const fPotongan = $("#bpl-f-potongan").value;
  const fJenis    = $("#bpl-f-jenis").value;

  const rows = bumPelunasanRows.filter(r =>
    (fPotongan === "all" || r.jenisPotongan === fPotongan) &&
    (fJenis    === "all" || r.jenisHutang   === fJenis) &&
    (!fCabang || r.cabang.toLowerCase().includes(fCabang)) &&
    (!fNrp    || r.nrp.includes(fNrp)) &&
    (!fNama   || r.nama.toLowerCase().includes(fNama)) &&
    (!fDari   || r.tglSp >= fDari) &&
    (!fSampai || r.tglSp <= fSampai));

  const pageSize   = +$("#bpl-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (bplPage > totalPages) bplPage = totalPages;
  const start    = (bplPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#bpl-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td class="stick-l">${start + i + 1}</td>
      <td class="t-strong">${esc(r.kpa)}</td>
      <td>${esc(r.nrp)}</td>
      <td>${esc(r.nama)}</td>
      <td>${esc(fmtTgl(r.tmt))}</td>
      <td>${esc(r.nomorPinjaman)}</td>
      <td>${esc(r.jenisPotongan)}</td>
      <td><span class="pill ${r.jenisHutang === "Program Khusus" ? "pill-warn" : "pill-ok"}">${esc(r.jenisHutang)}</span></td>
      <td>${rp(r.jumlah)}</td>
      <td>${rp(r.sisaHutang)}</td>
      <td>${rp(r.bruto)}</td>
      <td>${rp(r.nominal)}</td>
      <td>${esc(r.cabang)}</td>
      <td>${esc(fmtTgl(r.tglSp))}</td>
      <td>${esc(fmtTgl(r.tglDps))}</td>
      <td>${esc(fmtTgl(r.tglPeriode))}</td>
      <td class="stick-r" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-bpl-detail="${r.nomorPinjaman}">👁 Detail</button>
        <button class="btn btn-info btn-sm" data-bpl-upload="${r.nomorPinjaman}">⬆ Upload Bukti Angsuran</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="17"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#bpl-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} pelunasan`;

  $("#bpl-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === bplPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-bpl-page="${p}">${p}</button>
  `).join("");
}
$("#bpl-cari").onclick         = () => { bplPage = 1; renderBumPelunasan(); };
$("#bpl-page-size").onchange   = () => { bplPage = 1; renderBumPelunasan(); };
$("#bpl-export-excel").onclick = () => toast("Daftar pelunasan KPR (BUM) diekspor ke Excel.");

/* --------------------------------------------------------- Halaman Detail
   Field-nya sama persis dengan kolom tabel, terisi otomatis dari baris yang
   dipilih dan dikunci (readonly) — halaman ini hanya untuk melihat. Khusus
   jenis hutang Program Reguler muncul satu field tambahan, Imbal Jasa
   Program Reguler, yang ikut terisi otomatis. */
let bplDetailRow = null;

function bplDetailField(label, value, span2 = false) {
  return `<div class="field ${span2 ? "span2" : ""}">
    <label class="fl">${esc(label)}</label>
    <input class="inp" readonly value="${esc(value || "-")}">
  </div>`;
}
function renderBumPelunasanDetail() {
  const r = bplDetailRow;
  if (!r) return;

  $("#bpld-title").textContent  = r.nama;
  $("#bpld-sub").textContent    = `${r.kpa} · ${r.nrp} · ${r.nomorPinjaman}`;
  $("#bpld-jenis").className    = "pill " + (r.jenisHutang === "Program Khusus" ? "pill-warn" : "pill-ok");
  $("#bpld-jenis").textContent  = r.jenisHutang;

  $("#bpld-body").innerHTML = `
    <div class="subsection-title">Data Peserta</div>
    <div class="grid2">
      ${bplDetailField("KPA", r.kpa)}
      ${bplDetailField("NRP/NIP", r.nrp)}
      ${bplDetailField("Nama", r.nama, true)}
      ${bplDetailField("TMT", fmtTgl(r.tmt))}
      ${bplDetailField("Kantor Cabang", r.cabang)}
    </div>

    <div class="subsection-title">Data Pinjaman</div>
    <div class="grid2">
      ${bplDetailField("No Pinjaman", r.nomorPinjaman)}
      ${bplDetailField("Jenis Hutang", r.jenisHutang)}
      ${bplDetailField("Jumlah", rp(r.jumlah))}
      ${bplDetailField("Sisa Hutang", rp(r.sisaHutang))}
    </div>

    <div class="subsection-title">Rincian Pelunasan</div>
    <div class="grid2">
      ${bplDetailField("Jenis Potongan/Keterangan", r.jenisPotongan, true)}
      ${bplDetailField("Bruto", rp(r.bruto))}
      ${bplDetailField("Nominal", rp(r.nominal))}
      ${r.jenisHutang === "Program Reguler"
          ? bplDetailField("Imbal Jasa Program Reguler", rp(r.imbalJasa), true) : ""}
      ${bplDetailField("Tanggal SP", fmtTgl(r.tglSp))}
      ${bplDetailField("Tanggal DPS", fmtTgl(r.tglDps))}
      ${bplDetailField("Tanggal Periode", fmtTgl(r.tglPeriode), true)}
    </div>`;
}
function bplShowDetail(r) {
  if (!r) return;
  bplDetailRow = r;
  renderBumPelunasanDetail();
  go("bum-pelunasan-detail");
}
$("#bpld-kembali").onclick      = () => go("bum-pelunasan");
$("#bpld-kembali-atas").onclick = () => go("bum-pelunasan");
$("#bpld-upload").onclick       = () => bplShowUpload(bplDetailRow);

/* ---------------------- Upload Bukti Angsuran Pembayaran Hutang KPR (BUM)
   Dibuka dari tombol "Upload Bukti Angsuran" pada kolom Aksi, jadi data
   peserta (KPA, NRP/NIP, Nama, Jenis Program, Nominal Hutang) langsung
   terisi dari baris yang diklik dan dikunci. Sisanya — Tanggal Bayar,
   Angsuran Ke, Status, dan Bukti Setor — wajib diisi petugas. */
function bplShowUpload(r) {
  if (!r) return;
  $("#modal-title").textContent = "Upload Bukti Angsuran Pembayaran Hutang KPR (BUM)";
  $("#modal-sub").textContent   = `${r.nama} · ${r.nomorPinjaman}`;
  $("#modal-body").innerHTML = `
    <div class="grid2">
      <div class="field">
        <label class="fl">Tanggal Bayar <span class="req">*</span></label>
        <input class="inp" type="date" id="bpu-tgl-bayar">
      </div>
      <div class="field">
        <label class="fl">Angsuran Ke <span class="req">*</span></label>
        <input class="inp" type="number" min="1" id="bpu-angsuran" placeholder="Contoh: 12">
      </div>
      <div class="field">
        <label class="fl">KPA <span class="req">*</span></label>
        <input class="inp" id="bpu-kpa" readonly value="${esc(r.kpa)}">
      </div>
      <div class="field">
        <label class="fl">NRP/NIP <span class="req">*</span></label>
        <input class="inp" id="bpu-nrp" disabled value="${esc(r.nrp)}">
      </div>
      <div class="field">
        <label class="fl">Nama <span class="req">*</span></label>
        <input class="inp" id="bpu-nama" disabled value="${esc(r.nama)}">
      </div>
      <div class="field">
        <label class="fl">Jenis Program <span class="req">*</span></label>
        <select class="inp" id="bpu-program" disabled>
          <option value="Program Khusus" ${r.jenisHutang === "Program Khusus" ? "selected" : ""}>Program Khusus</option>
          <option value="Program Reguler" ${r.jenisHutang === "Program Reguler" ? "selected" : ""}>Program Reguler</option>
        </select>
      </div>
      <div class="field">
        <label class="fl">Nominal Hutang <span class="req">*</span></label>
        <input class="inp" id="bpu-nominal" disabled value="${esc(rp(r.sisaHutang))}">
      </div>
      <div class="field">
        <label class="fl">Status <span class="req">*</span></label>
        <input class="inp" id="bpu-status" placeholder="Contoh: Lunas Sebagian">
      </div>
      <div class="field span2" style="margin-bottom:0">
        <label class="fl">Upload Bukti Setor <span class="req">*</span></label>
        <input class="inp" type="file" id="bpu-bukti" accept=".pdf,.jpg,.jpeg,.png">
        <div class="hint" id="bpu-bukti-nama">Belum ada berkas terunggah.</div>
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bpu-tutup">Tutup</button>
      <button class="btn btn-primary" id="bpu-simpan">💾 Simpan</button>
    </div>`;
  openModal();

  $("#bpu-tutup").onclick  = closeModal;
  $("#bpu-bukti").onchange = e => {
    const f = e.target.files[0];
    $("#bpu-bukti-nama").textContent = f ? `${f.name} · ${ukuranBerkas(f.size)}` : "Belum ada berkas terunggah.";
  };

  $("#bpu-simpan").onclick = () => {
    const tglBayar = $("#bpu-tgl-bayar").value;
    const angsuran = $("#bpu-angsuran").value.trim();
    const status   = $("#bpu-status").value.trim();
    const bukti    = $("#bpu-bukti").files[0];

    if (!tglBayar || !angsuran || !status || !bukti) {
      toast("Seluruh field wajib diisi sebelum menyimpan.", "bad");
      return;
    }
    closeModal();
    toast(`Bukti angsuran ke-${angsuran} untuk ${r.nama} berhasil diunggah.`, "ok");
  };
}

/* -------------------------- Unggah Data Pelunasan Pinjaman KPR (BUM)
   Unggah kolektif: petugas memilih Jenis Hutang, Kantor Cabang, dan ketiga
   tanggal, lalu melampirkan berkas data pelunasan. Submit menambahkan satu
   baris per peserta yang punya pinjaman BUM pada kombinasi tersebut. */
function bplUnggahPeserta(jenisHutang, cabang) {
  const sudahAda = new Set(bumPelunasanRows.map(r => r.nomorPinjaman));
  return DATA_BUM.filter(r =>
    r.jenisPinjaman === jenisHutang && r.cabang === cabang && !sudahAda.has(r.nomorPinjaman));
}
function bplShowUnggahData() {
  const daftarCabang = [...new Set(DATA_BUM.map(r => r.cabang))].sort();
  $("#modal-title").textContent = "Unggah Data Pelunasan Pinjaman KPR (BUM)";
  $("#modal-sub").textContent   = "Seluruh field wajib diisi.";
  $("#modal-body").innerHTML = `
    <div class="grid2">
      <div class="field">
        <label class="fl">Jenis Hutang <span class="req">*</span></label>
        <select class="inp" id="bpd-jenis">
          <option value="">-- Pilih Jenis Hutang --</option>
          <option value="Program Khusus">Program Khusus</option>
          <option value="Program Reguler">Program Reguler</option>
        </select>
      </div>
      <div class="field">
        <label class="fl">Kantor Cabang <span class="req">*</span></label>
        <select class="inp" id="bpd-cabang">
          <option value="">-- Pilih Kantor Cabang --</option>
          ${daftarCabang.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="fl">Tanggal SP <span class="req">*</span></label>
        <input class="inp" type="date" id="bpd-tgl-sp">
      </div>
      <div class="field">
        <label class="fl">Tanggal DPS <span class="req">*</span></label>
        <input class="inp" type="date" id="bpd-tgl-dps">
      </div>
      <div class="field">
        <label class="fl">Tanggal Periode <span class="req">*</span></label>
        <input class="inp" type="date" id="bpd-tgl-periode">
      </div>
      <div class="field span2" style="margin-bottom:0">
        <label class="fl">Unggah Data Pelunasan <span class="req">*</span></label>
        <input class="inp" type="file" id="bpd-berkas" accept=".xls,.xlsx,.csv">
        <div class="hint" id="bpd-berkas-nama">Belum ada berkas terunggah.</div>
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bpd-batal">Batal</button>
      <button class="btn btn-primary" id="bpd-submit">Submit</button>
    </div>`;
  openModal();

  $("#bpd-batal").onclick   = closeModal;
  $("#bpd-berkas").onchange = e => {
    const f = e.target.files[0];
    $("#bpd-berkas-nama").textContent = f ? `${f.name} · ${ukuranBerkas(f.size)}` : "Belum ada berkas terunggah.";
  };

  $("#bpd-submit").onclick = () => {
    const jenisHutang = $("#bpd-jenis").value;
    const cabang      = $("#bpd-cabang").value;
    const tglSp       = $("#bpd-tgl-sp").value;
    const tglDps      = $("#bpd-tgl-dps").value;
    const tglPeriode  = $("#bpd-tgl-periode").value;
    const berkas      = $("#bpd-berkas").files[0];

    if (!jenisHutang || !cabang || !tglSp || !tglDps || !tglPeriode || !berkas) {
      toast("Seluruh field wajib diisi sebelum submit.", "bad");
      return;
    }
    const peserta = bplUnggahPeserta(jenisHutang, cabang);
    if (!peserta.length) {
      toast(`Tidak ada peserta ${jenisHutang} di ${cabang} yang belum masuk daftar pelunasan.`, "bad");
      return;
    }

    peserta.forEach(p => {
      const nominal = p.sisaHutang + p.outstanding;
      bumPelunasanRows.unshift({
        kpa: p.kpa, nrp: p.nrp, nama: p.nama, tmt: p.tmt,
        nomorPinjaman: p.nomorPinjaman,
        jenisPotongan: "Tabungan Asuransi",
        jenisHutang,
        jumlah: p.jumlah, sisaHutang: p.sisaHutang,
        bruto: Math.round(nominal * 1.05), nominal,
        ...(jenisHutang === "Program Reguler" ? { imbalJasa: Math.round(p.jumlah * 0.02) } : {}),
        cabang, tglSp, tglDps, tglPeriode
      });
    });
    bplPage = 1;
    renderBumPelunasan();
    closeModal();
    toast(`${peserta.length} data pelunasan ${jenisHutang} — ${cabang} berhasil ditambahkan.`, "ok");
  };
}
$("#bpl-unggah-btn").onclick = bplShowUnggahData;

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-bpl-detail]");
  if (bDetail) {
    bplShowDetail(bumPelunasanRows.find(x => x.nomorPinjaman === bDetail.dataset.bplDetail));
    return;
  }
  const bUpload = e.target.closest("[data-bpl-upload]");
  if (bUpload) {
    bplShowUpload(bumPelunasanRows.find(x => x.nomorPinjaman === bUpload.dataset.bplUpload));
    return;
  }
  const bPage = e.target.closest("[data-bpl-page]");
  if (bPage) { bplPage = +bPage.dataset.bplPage; renderBumPelunasan(); }
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
  $("#k-file-batch").value = "";
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
  renderProgressSteps("verif-detail-progress", kolektifProgressSteps(batch.status));

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
  renderProgressSteps("appr-a-progress", ppProgressSteps(r.approvalStatus));
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
let apprDetailBPage = 1;

/* Tombol Setujui/Tolak sengaja hanya muncul di halaman terakhir, supaya
   pengapproval melihat seluruh peserta batch dulu sebelum memutuskan —
   pola yang sama dipakai di Verifikasi Kolektif. */
function renderApprovalDetailBActions(batch, halamanTerakhir) {
  if (batch.status !== "Tertunda") {
    $("#appr-b-actions").innerHTML = `<span class="pill ${pillPendaftaranStatus(batch.status)}">${esc(batch.status.toUpperCase())}</span>`;
    return;
  }
  if (!halamanTerakhir) {
    $("#appr-b-actions").innerHTML = `<div class="hint" style="margin:0">Buka halaman terakhir untuk menyetujui atau menolak batch ini.</div>`;
    return;
  }
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
}

function renderApprovalDetailBTable(batch) {
  const fBatch    = ($("#appr-b-f-batch").value    || "").toLowerCase();
  const fAgenda   = ($("#appr-b-f-agenda").value   || "").toLowerCase();
  const fKesatuan = ($("#appr-b-f-kesatuan").value || "").toLowerCase();
  const fTanggal  = $("#appr-b-f-tanggal").value;
  const cocok = (!fBatch    || batch.nomorBatch.toLowerCase().includes(fBatch))
    && (!fAgenda   || batch.nomorAgenda.toLowerCase().includes(fAgenda))
    && (!fKesatuan || batch.kesatuanPengaju.toLowerCase().includes(fKesatuan))
    && (!fTanggal  || fmtTgl(fTanggal) === batch.tglPengajuan);

  const rows = cocok ? batch.peserta : [];
  const pageSize   = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (apprDetailBPage > totalPages) apprDetailBPage = totalPages;
  const start    = (apprDetailBPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#appr-b-body").innerHTML = pageRows.length ? pageRows.map((p, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(batch.tglPengajuan)}</td>
      <td class="t-strong">${esc(batch.nomorBatch)}</td>
      <td>${esc(batch.nomorAgenda)}</td>
      <td>${esc(batch.kesatuanPengaju)}</td>
      <td>1</td>
      <td class="t-name">${esc(p.nama)}</td>
      <td><button class="btn btn-info btn-sm" data-appr-c="${start + i}">Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#appr-b-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} peserta`;
  $("#appr-b-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === apprDetailBPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-appr-b-page="${p}">${p}</button>
  `).join("");

  renderApprovalDetailBActions(batch, apprDetailBPage === totalPages);
}
function renderApprovalDetailB(batchId) {
  const batch = uploadBatchRows.find(x => x._id === batchId);
  apprCurrentType = "kolektif"; apprCurrentId = batchId;
  $("#appr-b-sub").textContent = `${batch.nomorBatch} — ${batch.peserta.length} peserta`;
  renderProgressSteps("appr-b-progress", kolektifProgressSteps(batch.status));
  $("#appr-b-f-batch").value    = batch.nomorBatch;
  $("#appr-b-f-agenda").value   = batch.nomorAgenda;
  $("#appr-b-f-kesatuan").value = batch.kesatuanPengaju;
  $("#appr-b-f-tanggal").value  = "";
  apprDetailBPage = 1;
  renderApprovalDetailBTable(batch);
}
$("#appr-b-cari").onclick   = () => {
  apprDetailBPage = 1;
  renderApprovalDetailBTable(uploadBatchRows.find(x => x._id === apprCurrentId));
};
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

  /* Status "Tertunda" tidak ditampilkan di sini — keputusan Setujui/Tolak
     ada di halaman Detail Approval Kolektif [B], berlaku untuk seluruh batch. */
  const apprCAksi = $("#appr-c-actions");
  if (batch.status === "Tertunda") {
    apprCAksi.innerHTML = ""; apprCAksi.style.display = "none";
  } else {
    apprCAksi.style.display = "";
    apprCAksi.innerHTML = `<span class="pill ${pillPendaftaranStatus(batch.status)}">${esc(batch.status.toUpperCase())}</span>`;
  }
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
  if (bPage) { apprPage = +bPage.dataset.apprPage; renderApprovalList(); return; }
  const bPageB = e.target.closest("[data-appr-b-page]");
  if (bPageB) {
    apprDetailBPage = +bPageB.dataset.apprBPage;
    renderApprovalDetailBTable(uploadBatchRows.find(x => x._id === apprCurrentId));
  }
});
$("#appr-a-kembali").onclick = () => { renderApprovalList(); apprGotoView("list"); };
$("#appr-b-kembali").onclick = () => { renderApprovalList(); apprGotoView("list"); };
/* Hanya tabelnya yang dirender ulang supaya halaman paginasi yang sedang
   dibuka tidak melompat kembali ke halaman 1. */
$("#appr-c-kembali").onclick = () => {
  renderApprovalDetailBTable(uploadBatchRows.find(x => x._id === apprCurrentId));
  apprGotoView("b");
};

/* ============================== PENDAFTARAN PESERTA BARU » DAFTAR NOMINATIF
   Menampilkan batch kolektif yang sudah "Diterima" di Approval — daftar
   nominatif hanya untuk batch yang berstatus bersih/tervalidasi. */
let nominatifPage = 1;

function nominatifGotoView(view) {
  $("#nominatif-page-head").style.display   = view === "list"   ? "" : "none";
  $("#nominatif-list-view").style.display   = view === "list"   ? "" : "none";
  $("#nominatif-detail-view").style.display = view === "detail" ? "" : "none";
  $("#nominatif-kpa-view").style.display    = view === "kpa"    ? "" : "none";
  cetakMenuTutup();
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
        <button class="btn btn-ghost btn-sm" data-nominatif-detail="${r._id}">👤 Peserta ›</button>
        <button class="btn btn-primary btn-sm" data-nominatif-cetak="${r._id}">🖶 Cetak ⌄</button>
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

/* -------- Menu "Cetak" (KPA / Surat Pengantar)
   Menunya melayang di atas halaman (position:fixed) supaya tidak terpotong
   oleh scroll horizontal .tbl-wrap; posisinya dihitung dari tombol pemicu. */
let cetakMenuBatch = null;

function cetakMenuTutup() {
  $("#cetak-menu").classList.remove("open");
  cetakMenuBatch = null;
}
function cetakMenuBuka(btn, batch) {
  const menu = $("#cetak-menu");
  cetakMenuBatch = batch;
  menu.classList.add("open");                     /* dibuka dulu agar lebarnya terbaca */
  const r = btn.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  const kiri = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
  const atas = r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6;
  menu.style.left = `${kiri}px`;
  menu.style.top  = `${Math.max(12, atas)}px`;
}
document.addEventListener("click", e => {
  if (!$("#cetak-menu").classList.contains("open")) return;
  if (e.target.closest("#cetak-menu") || e.target.closest("[data-nominatif-cetak]")) return;
  cetakMenuTutup();
});
window.addEventListener("scroll", cetakMenuTutup, true);
window.addEventListener("resize", cetakMenuTutup);
document.addEventListener("keydown", e => { if (e.key === "Escape") cetakMenuTutup(); });

$("#cetak-menu-kpa").onclick = () => {
  const batch = cetakMenuBatch; cetakMenuTutup();
  if (batch) { renderNominatifKpa(batch); nominatifGotoView("kpa"); }
};
$("#cetak-menu-surat").onclick = () => {
  const batch = cetakMenuBatch; cetakMenuTutup();
  if (batch) nominatifSuratPengantar(batch);
};

/* -------- Pratinjau Cetak KPA
   Peserta hasil upload belum punya nomor KTPA, jadi nomor kartu dan pola
   barcode-nya dibangkitkan secara tetap (deterministik) dari NRP + nama —
   supaya kartu yang sama selalu tampil dengan nomor yang sama. */
const KPA_ANGKATAN = { "1":"TNI AD", "2":"TNI AL", "3":"TNI AU", "4":"POLRI", "5":"PNS KEMHAN" };

function kpaHash(teks, awal) {
  let h = awal;
  for (const c of String(teks)) h = (h * 33 + c.charCodeAt(0)) % 233280;
  return h;
}
function kpaAngkatan(p) {
  const t = `${p.angkatan || ""} ${p.kesatuan || ""}`.toUpperCase();
  if (t.includes("POLRI"))  return "POLRI";
  if (t.includes("TNI AL")) return "TNI AL";
  if (t.includes("TNI AU")) return "TNI AU";
  if (t.includes("TNI AD")) return "TNI AD";
  return KPA_ANGKATAN[String(p.angkatan)] || (p.angkatan || "-");
}
function kpaNomor(p) {
  if (p.ktpa) return p.ktpa;
  const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const h = kpaHash(`${p.nrp || ""}${p.nama || ""}`, 7);
  return HURUF[h % 24] + HURUF[(h >> 4) % 24] + String(h % 1000000).padStart(6, "0");
}
function kpaBarcode(kode) {
  const KELAS = ["kpa-bar", "kpa-bar w2", "kpa-bar w3", "kpa-bar sp"];
  let h = kpaHash(kode, 11);
  return Array.from({ length: 30 }, () => {
    h = (h * 9301 + 49297) % 233280;
    return `<i class="${KELAS[h % 4]}"></i>`;
  }).join("");
}
function kpaTglHariIni() {
  const d = new Date(), p2 = n => String(n).padStart(2, "0");
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function kpaBaris(label, nilai) {
  return `<div class="kpa-row"><div class="kpa-k">${esc(label)}</div><span>:</span>
            <div class="kpa-v">${esc(nilai || "–")}</div></div>`;
}

function renderNominatifKpa(batch) {
  const n = batch.peserta.length;
  $("#nominatif-kpa-sub").textContent =
    `KPA Batch ${batch.nomorBatch} · ${n} kartu. Periksa pratinjau, lalu tekan Cetak untuk menyimpan sebagai PDF.`;
  $("#nominatif-kpa-grid").innerHTML = n ? batch.peserta.map(p => {
    const no = kpaNomor(p);
    return `
    <div class="kpa-card">
      <div class="kpa-head">
        <div class="kpa-org"><b>PT. ASABRI (PERSERO)</b><div>JAKARTA</div></div>
        <div>
          <div class="kpa-jenis">Kartu Tanda Peserta Asabri (KTPA)</div>
          <div class="kpa-no"><span>NO</span><b>${esc(no)}</b></div>
        </div>
      </div>
      ${kpaBaris("Nama", (p.nama || "").toUpperCase())}
      ${kpaBaris("NRP/NIP", p.nrp)}
      ${kpaBaris("Tanggal Lahir", p.tglLahir)}
      ${kpaBaris("Tanggal jadi Peserta", p.tmtSkep)}
      <div class="kpa-sts">Anggota / ${esc(kpaAngkatan(p))}</div>
      <div class="kpa-place">Jakarta, ${kpaTglHariIni()}</div>
      <div class="kpa-foot">
        <div class="kpa-barcode">${kpaBarcode(no)}</div>
        <div class="kpa-sign"><b>SONNY WIDJAJA</b>LETJEN TNI (PURN)</div>
      </div>
    </div>`;
  }).join("")
    : `<div class="empty"><h4>Tidak ada peserta</h4><p>Batch ini belum memiliki data peserta.</p></div>`;
}
$("#nominatif-kpa-kembali").onclick = () => nominatifGotoView("list");
$("#nominatif-kpa-cetak").onclick   = () => window.print();

/* -------- Cetak Surat Pengantar (modal isian nomor & pejabat) */
const BULAN_ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

function nominatifSuratPengantar(batch) {
  const d = new Date();
  const nomorAwal = `…/PA.01.01/G/${BULAN_ROMAWI[d.getMonth()]}/${d.getFullYear()}`;
  $("#modal-ico").textContent   = "✉";
  $("#modal-ico").style.display = "";
  $("#modal-title").textContent = "Cetak Surat Pengantar";
  $("#modal-sub").textContent   = `Batch ${batch.nomorBatch}`;
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl caps" for="sp-nomor">No Surat Pengantar</label>
      <input class="inp" id="sp-nomor" value="${esc(nomorAwal)}">
      <div class="hint">Ganti “…” di depan dengan nomor urut surat.</div>
    </div>
    <div class="field">
      <label class="fl caps" for="sp-tujuan">Tujuan Kirim</label>
      <select class="inp" id="sp-tujuan">
        <option>Kantor Cabang</option>
        <option>Kantor Pusat</option>
        <option>Kesatuan Pengaju</option>
      </select>
    </div>
    <div class="field">
      <label class="fl caps" for="sp-atas-nama">Atas Nama</label>
      <input class="inp" id="sp-atas-nama" value="Kadiv Kepesertaan">
    </div>
    <div class="field">
      <label class="fl caps" for="sp-pejabat">Nama Pejabat</label>
      <input class="inp" id="sp-pejabat" placeholder="Nama pejabat penanda tangan">
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl caps" for="sp-jabatan">Jabatan</label>
      <input class="inp" id="sp-jabatan" placeholder="Jabatan pejabat penanda tangan">
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="sp-tutup">✕ Tutup</button>
      <button class="btn btn-primary" id="sp-cetak">🖶 Cetak Surat Pengantar</button>
    </div>`;
  openModal();
  $("#sp-tutup").onclick = closeModal;
  $("#sp-cetak").onclick = () => {
    const nomor = $("#sp-nomor").value.trim();
    if (!nomor || nomor.includes("…")) { toast("Lengkapi nomor urut surat pengantar.", "bad"); return; }
    if (!$("#sp-pejabat").value.trim() || !$("#sp-jabatan").value.trim()) {
      toast("Nama pejabat dan jabatan wajib diisi.", "bad"); return;
    }
    closeModal();
    toast(`Surat Pengantar ${nomor} untuk batch ${batch.nomorBatch} dicetak.`, "ok");
  };
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-nominatif-detail]");
  if (bDetail) {
    renderNominatifDetail(uploadBatchRows.find(x => x._id === +bDetail.dataset.nominatifDetail));
    nominatifGotoView("detail");
    return;
  }
  const bCetak = e.target.closest("[data-nominatif-cetak]");
  if (bCetak) {
    const batch = uploadBatchRows.find(x => x._id === +bCetak.dataset.nominatifCetak);
    if ($("#cetak-menu").classList.contains("open") && cetakMenuBatch === batch) cetakMenuTutup();
    else cetakMenuBuka(bCetak, batch);
    return;
  }
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
let edosirSort  = { col: "nama", dir: 1 };
let edosirPager = { hal: 1, per: 10 };

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

  const pg = pagerPotong(rows, edosirPager);
  $("#edosir-tbody").innerHTML = pg.hal.length ? pg.hal.map((c, i) => `
    <tr>
      <td>${pg.mulai + i + 1}</td>
      <td class="stick-l t-strong">${esc(c.nama)}</td>
      <td>${c.saldoAwal.toLocaleString("id-ID")}</td>
      ${c.bulan.map(v => `<td>${v.toLocaleString("id-ID")}</td>`).join("")}
    </tr>`).join("") : `<tr><td colspan="${EDOSIR_COLS.length + 1}"><div class="empty"><h4>Tidak ada kantor cabang</h4></div></td></tr>`;

  $("#edosir-tbl-sub").innerHTML = pagerNote(pg, "cabang", "— klik judul kolom untuk mengurutkan.");
  $("#edosir-pager").innerHTML   = pagerHtml(edosirPager, pg, "data-edosir-hal");

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
$("#edosir-search").oninput = () => { edosirPager.hal = 1; renderEdosirTable(); };
document.addEventListener("click", e => {
  const th = e.target.closest("[data-edosir-sort]");
  if (th) {
    const col = th.dataset.edosirSort;
    if (edosirSort.col === col) edosirSort.dir *= -1;
    else { edosirSort.col = col; edosirSort.dir = 1; }
    renderEdosirThead();
    renderEdosirTable();
    return;
  }
  const edosirHal = e.target.closest("[data-edosir-hal]");
  if (edosirHal) { edosirPager.hal = +edosirHal.dataset.edosirHal; renderEdosirTable(); }
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

/* Warna badge Status Approval SPTB */
const SPTB_PILL_APPROVAL = { "Disetujui":"pill-ok", "Ditolak":"pill-bad", "Tertunda":"pill-warn" };

let sptbPager = { hal: 1, per: 10 };

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

  const pg = pagerPotong(rows, sptbPager);
  $("#sptb-body").innerHTML = pg.hal.length ? pg.hal.map(r => `
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
      <td>${fmtTglShortId(r.tglPengajuan)}</td>
      <td><span class="pill ${r.statusPengajuan === "Pengajuan" ? "pill-info" : "pill-warn"}">${esc(r.statusPengajuan)}</span></td>
      <td>${fmtTglShortId(r.tglApproval)}</td>
      <td>${r.statusApproval ? `<span class="pill ${SPTB_PILL_APPROVAL[r.statusApproval]}">${esc(r.statusApproval)}</span>` : "—"}</td>
      <td><button class="btn btn-ghost btn-sm" data-sptb-cetak="${DATA_SPTB.indexOf(r)}">🖶 Cetak Kartu Peserta</button></td>
    </tr>`).join("") : `<tr><td colspan="17"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter pencarian.</p></div></td></tr>`;

  $("#sptb-count").innerHTML  = pagerNote(pg, "peserta", "");
  $("#sptb-pager").innerHTML  = pagerHtml(sptbPager, pg, "data-sptb-hal");
}

$("#sptb-cari").onclick  = () => { sptbPager.hal = 1; renderSptb(); };
$("#sptb-reset").onclick = () => {
  ["sptb-f-status", "sptb-f-jenis", "sptb-f-mitra", "sptb-f-cabang",
   "sptb-f-nopens", "sptb-f-umur-min", "sptb-f-umur-max",
   "sptb-f-sptb-dari", "sptb-f-sptb-sampai", "sptb-f-pay-dari", "sptb-f-pay-sampai"]
    .forEach(id => $(`#${id}`).value = "");
  sptbPager.hal = 1;
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
  if (bCetak) { toast(`Kartu Peserta ${DATA_SPTB[+bCetak.dataset.sptbCetak].nama} berhasil dicetak.`, "ok"); return; }

  const sptbHal = e.target.closest("[data-sptb-hal]");
  if (sptbHal) { sptbPager.hal = +sptbHal.dataset.sptbHal; renderSptb(); }
});

/* ==================================================================== HOME */
const HOME_SEVERITY_PILL = { "Kritis":"pill-bad", "High":"pill-warn", "Sedang":"pill-info" };
const HOME_TAG_STYLE = {
  kebijakan: "background:var(--blue-soft);color:var(--blue-ink)",
  baru:      "background:var(--green-soft);color:var(--green-ink)",
  info:      "background:var(--red-soft);color:var(--red)"
};
const HOME_DOT_COLOR = { kebijakan:"var(--blue-ink)", info:"var(--red)" };

/* Notifikasi PIC UNOR/Kesatuan menggantikan daftar umum saat role itu aktif —
   dibangun otomatis dari setiap pengajuan KPR (PUM) yang sedang berstatus
   Revisi (lihat pumRows), bukan data statis, supaya selalu sesuai kondisi
   pengajuan yang sebenarnya. Dipakai bersama oleh panel Notifikasi di Home
   dan lonceng di navbar supaya jumlahnya tidak pernah berbeda antar layar. */
function notifRevisiPicUnor() {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  const tanggal = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return pumRows.filter(r => r.status === "Revisi").map(r => ({
    judul: "Revisi Pengajuan KPR (PUM)",
    detail: `KPA ${r.kpa} ${r.nama} ${r.angkatan} Pengajuan KPR (PUM) terdapat revisi dengan sisa waktu SLA 3 Hari Kerja.`,
    tanggal, tingkat: "High", go: "pum", pumId: r._id
  }));
}
/* Notifikasi yang lahir saat request umum dialihkan ke Divisi Layanan. Isinya
   bertambah selama sesi berjalan (hilang saat refresh, seperti data lain) dan
   setiap entri hanya tampil untuk role pada `untuk`. */
let ruNotifPengalihan = [];

function notifikasiUntukRole() {
  const role = roleSaatIni();
  if (role === ROLE_PIC) return notifRevisiPicUnor();
  const pengalihan = ruNotifPengalihan.filter(n => n.untuk === role);
  /* Entri ber-`untuk` hanya untuk role tersebut. Entri tanpa `untuk` adalah
     tugas umum yang tidak ditampilkan ke Divisi Layanan — role itu hanya
     menerima notifikasi yang memang dialamatkan kepadanya. */
  const umum = DATA_HOME_NOTIFIKASI.filter(n => n.untuk ? n.untuk === role : role !== ROLE_LAYANAN);
  return [...pengalihan, ...umum];
}
function notifMetaHtml(n) {
  return n.detail
    ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(n.detail)}</div>
       <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(n.tanggal)}</div>`
    : `<div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(n.id)} · ${esc(n.lokasi)}</div>
       <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(n.modul)} · ${esc(n.tanggal)}</div>`;
}

function renderHome() {
  $("#home-greeting").textContent = `Selamat Datang, ${$("#top-role").value} 👋`;

  const notif = notifikasiUntukRole();
  $("#home-notif-count").textContent = `${notif.length} tugas`;
  $("#home-notif-list").innerHTML = notif.map(n => `
    <div style="border:1px solid var(--line-soft);border-radius:9px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div class="t-strong" style="font-size:12.5px">${esc(n.judul)}</div>
        <span class="pill ${HOME_SEVERITY_PILL[n.tingkat] || "pill-info"}" style="flex-shrink:0">${esc(n.tingkat)}</span>
      </div>
      ${notifMetaHtml(n)}
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
function ruFmtJam(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getDate()} ${BULAN_ID_SHORT[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ruFmtTgl(d) { return `${d.getDate()} ${BULAN_ID_SHORT[d.getMonth()]} ${d.getFullYear()}`; }

const RU_PAGE_SIZE = 5;
let ruPage = 1;
/* _id baris yang disorot setelah dibuka lewat notifikasi; null = tidak ada. */
let ruSorotId = null;

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
    <tr id="ru-row-${r._id}"${r._id === ruSorotId ? ` class="row-sorot"` : ""}>
      <td>${esc(r.tglRequest)}</td>
      <td><div class="t-strong">${esc(r.nama)}</div><div class="hint" style="margin:1px 0 0">${esc(r.nrp)}</div></td>
      <td>${esc(r.cabang)}</td>
      <td><span class="pill pill-info">${esc(r.tujuan)}</span></td>
      <td class="t-strong">${esc(r.subjek)}</td>
      <td class="truncate-cell" title="${esc(r.riwayat[0].isi)}">${esc(r.riwayat[0].isi)}</td>
      <td>${esc(ruUserRequest(r))}</td>
      <td>${esc(ruUserReply(r))}</td>
      <td>${esc(ruDiperbarui(r))}</td>
      <td><button class="btn btn-ghost btn-sm" data-ru-detail="${r._id}">👁 Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + RU_PAGE_SIZE, rows.length);
  $("#ru-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} request`;
  $("#ru-pagination").innerHTML = ruPaginationHtml(totalPages);
}
renderRequestUmum();

/* Dipanggil dari notifikasi "Pengajuan Request Umum Kantor Cabang" — filter
   dikosongkan dulu supaya baris yang dituju pasti ikut tampil, lalu halaman
   digeser ke halaman yang memuatnya dan barisnya disorot. */
function sorotBarisRequestUmum(kpa) {
  const idx = ruRows.findIndex(r => r.kpa === kpa);
  if (idx < 0) return;
  $("#ru-f-peserta").value = "";
  $("#ru-f-cabang").value  = "";
  $("#ru-f-status").value  = "all";
  $("#ru-f-tujuan").value  = "all";
  ruSorotId = ruRows[idx]._id;
  ruPage    = Math.floor(idx / RU_PAGE_SIZE) + 1;
  renderRequestUmum();
  requestAnimationFrame(() => {
    const el = $(`#ru-row-${ruSorotId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

$("#ru-cari").onclick  = () => { ruPage = 1; ruSorotId = null; renderRequestUmum(); };
$("#ru-export").onclick = () => toast("Daftar request umum diekspor ke Excel.");

/* -------------------------------------------------------------- Detail Request Umum */
let ruDetailCurrentId = null;

function ruOpenDetail()  { $("#ru-detail-overlay").classList.add("open");    document.body.style.overflow = "hidden"; }
function ruCloseDetail() { $("#ru-detail-overlay").classList.remove("open"); document.body.style.overflow = ""; }

function ruShowDetail(r) {
  ruDetailCurrentId = r._id;

  $("#ru-detail-riwayat-body").innerHTML = r.riwayat.map(h => `
    <tr>
      <td class="t-strong">${esc(h.jam)}</td>
      <td>${esc(h.user)}</td>
      <td>${esc(h.isi)}</td>
      <td>${h.file ? `<button class="btn btn-ghost btn-sm" data-ru-unduh="${esc(h.file)}">⭳ Unduh</button>` : "—"}</td>
    </tr>`).join("");

  $("#ru-balasan-isi").value  = "";
  $("#ru-balasan-file").value = "";
  /* Pengalihan ke Divisi Layanan hanya hak Divisi Kepesertaan. */
  $("#ru-alihkan").style.display = roleSaatIni() === ROLE_DIVISI ? "" : "none";
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

/* ------------------------------------------- Alihkan request ke Divisi Layanan
   Popup ini berdiri di atas overlay detail (letaknya setelah overlay detail di
   index.html, z-index-nya sama, jadi otomatis menumpuk di atasnya). Karena
   overlay detail sudah mengunci scroll halaman, popup ini tidak menyentuh
   document.body.style.overflow supaya kuncinya tidak lepas saat popup ditutup. */
function ruOpenAlih()  { $("#ru-alih-overlay").classList.add("open"); }
function ruCloseAlih() { $("#ru-alih-overlay").classList.remove("open"); }

function ruShowAlih() {
  const r = ruRows.find(x => x._id === ruDetailCurrentId);
  if (!r) return;
  $("#ru-alih-peserta").textContent = `${r.kpa} · ${r.nama} (${r.nrp}) · ${r.cabang}`;
  $("#ru-alih-alasan").value = "";
  $("#ru-alih-field").classList.remove("err");
  $("#ru-alih-err").style.display = "none";
  ruOpenAlih();
}

/* Dua notifikasi sekaligus: satu untuk Kantor Cabang pengirim request, satu
   untuk Divisi Layanan yang menerima limpahannya. Keduanya membuka layar
   Pengelolaan Request Umum dan menyorot baris yang sama. */
function ruBuatNotifPengalihan(r) {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  const tanggal = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  ruNotifPengalihan.unshift(
    { untuk: ROLE_CABANG, judul: "Request Umum Dialihkan", tingkat: "Sedang",
      detail: `Pengajuan Request Umum Peserta KPA ${r.kpa} a.n. ${r.nama} dialihkan ke Divisi Layanan.`,
      tanggal, go: "request-umum", ruKpa: r.kpa },
    { untuk: ROLE_LAYANAN, judul: "Pengalihan Request Umum Masuk", tingkat: "High",
      detail: `Pengalihan Pengajuan Request Umum Peserta KPA ${r.kpa} a.n. ${r.nama} dari Divisi Kepesertaan dan Pengembangan Manfaat.`,
      tanggal, go: "request-umum", ruKpa: r.kpa });
}

$("#ru-alihkan").onclick    = ruShowAlih;
$("#ru-alih-x").onclick     = ruCloseAlih;
$("#ru-alih-batal").onclick = ruCloseAlih;
$("#ru-alih-overlay").onclick = e => { if (e.target.id === "ru-alih-overlay") ruCloseAlih(); };

$("#ru-alih-submit").onclick = () => {
  const alasan = $("#ru-alih-alasan").value.trim();
  if (!alasan) {
    $("#ru-alih-field").classList.add("err");
    $("#ru-alih-err").style.display = "";
    return;
  }

  const r = ruRows.find(x => x._id === ruDetailCurrentId);
  r.tujuan = "Pelayanan";
  r.riwayat.push({
    jam: ruFmtJam(new Date()), user: "Anda / Div. Kepers.",
    isi: `Pengajuan dialihkan ke Divisi Layanan. Alasan: ${alasan}`, file: null
  });
  ruBuatNotifPengalihan(r);

  ruCloseAlih();
  renderRequestUmum();
  ruShowDetail(r);
  renderTopNotif();
  renderHome();
  toast(`Request umum ${r.kpa} dialihkan ke Divisi Layanan.`, "ok");
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
      <label class="fl">Kategori <span class="req">*</span></label>
      <select class="inp" id="ru-tambah-kategori">
        <option value="">-- Silahkan Pilih Kategori --</option>
        <option value="Klaim Online">Klaim Online</option>
        <option value="Peremajaan Data">Peremajaan Data</option>
        <option value="Lainnya">Lainnya</option>
      </select>
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
    const kpa      = $("#ru-tambah-kpa").value.trim();
    const kategori = $("#ru-tambah-kategori").value;
    const subjek   = $("#ru-tambah-subjek").value.trim();
    const tujuan   = $("#ru-tambah-tujuan").value;
    const isi      = $("#ru-tambah-isi").value.trim();
    const file     = $("#ru-tambah-file").files[0];
    if (!kpa || !kategori || !subjek || !tujuan || !isi || !file) { toast("Seluruh field wajib diisi sebelum menyimpan.", "bad"); return; }

    const peserta = RU_KPA_LOOKUP[kpa.toUpperCase()];
    if (!peserta) { toast("KPA tidak ditemukan pada data peserta.", "bad"); return; }

    const now = new Date();
    ruRows.unshift({
      _id: ruRows.length ? Math.max(...ruRows.map(x => x._id)) + 1 : 0,
      kpa: kpa.toUpperCase(), nama: peserta.nama, nrp: peserta.nrp, cabang: peserta.cabang,
      kategori, tujuan, subjek, tglRequest: ruFmtTgl(now), status: "Belum Selesai",
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
  if (bPage) { ruPage = +bPage.dataset.ruPage; ruSorotId = null; renderRequestUmum(); return; }

  const bDetail = e.target.closest("[data-ru-detail]");
  if (bDetail) { ruShowDetail(ruRows.find(x => x._id === +bDetail.dataset.ruDetail)); }
});

/* ================================================ PENGELOLAAN ALIH STATUS PESERTA
   Satu baris daftar = satu pengajuan (bukan satu peserta). Layar ini punya tiga
   tampilan yang bergantian di dalam satu <section>:
     list   — filter + tabel pengajuan
     detail — ringkasan satu pengajuan (Perorangan) / tabel pesertanya (Kolektif)
     form   — tambah pengajuan baru, bercabang Perorangan vs Kolektif
   Seluruh perubahan hanya mengenai salinan di memori (asRows); data.js sendiri
   tidak pernah disentuh. */
let asRows = DATA_ALIH_STATUS_PENGAJUAN.map((r, i) => ({ ...r, _id: i }));

const AS_KOLOM = [
  { key:"tglPengajuan", label:"Tanggal Pengajuan" },
  { key:"mekanisme",    label:"Mekanisme Alih Status Peserta" },
  { key:"tipePeserta",  label:"Tipe Peserta" },
  { key:"tipe",         label:"Tipe Alih Status Peserta" },
  { key:"jumlahBerkas", label:"Jumlah Berkas" }
];

const AS_PAGE_SIZE = 5;
let asPage = 1;
let asSort = { col:null, dir:1 };   /* null = urutan asli data, belum diurutkan */

function asFmtTgl(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function asJumlahBerkas(r) { return r.peserta.length; }

function asPillTipe(t) {
  return t === "Masuk" ? "pill-ok" : t === "Batal" ? "pill-bad" : "pill-info";
}

/* Deret halaman dengan elipsis: halaman 1 dan terakhir selalu tampil,
   sisanya jendela di sekitar halaman aktif. */
function asDeretHalaman(totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const sekitar = [asPage - 1, asPage, asPage + 1].filter(p => p > 1 && p < totalPages);
  const nomor = [1, ...sekitar, totalPages];
  const hasil = [];
  nomor.forEach((p, i) => {
    if (i && p - nomor[i - 1] > 1) hasil.push("…");
    hasil.push(p);
  });
  return hasil;
}

function asPaginationHtml(totalPages) {
  const nav = (p, label, disabled) => `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" ${disabled ? "disabled" : `data-as-page="${p}"`}>${label}</button>`;
  return nav(asPage - 1, "‹", asPage <= 1)
    + asDeretHalaman(totalPages).map(p => p === "…"
        ? `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" disabled>…</button>`
        : `<button class="btn ${p === asPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-as-page="${p}">${p}</button>`).join("")
    + nav(asPage + 1, "›", asPage >= totalPages);
}

function asBarisTersaring() {
  const fTanggal   = $("#as-f-tanggal").value;
  const fMekanisme = $("#as-f-mekanisme").value;
  const fTipePeserta = $("#as-f-tipe-peserta").value;
  const fTipe      = $("#as-f-tipe").value;

  return asRows.filter(r =>
    (!fTanggal || r.tglPengajuan === fTanggal) &&
    (fMekanisme   === "all" || r.mekanisme   === fMekanisme) &&
    (fTipePeserta === "all" || r.tipePeserta === fTipePeserta) &&
    (fTipe        === "all" || r.tipe        === fTipe));
}

function renderAlihStatus() {
  $("#as-thead").innerHTML = `<th>No</th>` + AS_KOLOM.map(k => `
    <th data-as-sort="${k.key}" style="cursor:pointer;white-space:nowrap">
      ${esc(k.label)} <span style="opacity:.5">${asSort.col === k.key ? (asSort.dir === 1 ? "▲" : "▼") : "⇅"}</span>
    </th>`).join("") + `<th>Aksi</th>`;

  const rows = asBarisTersaring();
  if (asSort.col) rows.sort((a, b) => {
    const nilai = r => asSort.col === "jumlahBerkas" ? asJumlahBerkas(r) : r[asSort.col] || "";
    return String(nilai(a)).localeCompare(String(nilai(b)), "id", { numeric: true }) * asSort.dir;
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / AS_PAGE_SIZE));
  if (asPage > totalPages) asPage = totalPages;
  const start    = (asPage - 1) * AS_PAGE_SIZE;
  const pageRows = rows.slice(start, start + AS_PAGE_SIZE);

  $("#as-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td class="t-strong">${esc(asFmtTgl(r.tglPengajuan))}</td>
      <td>${esc(r.mekanisme)}</td>
      <td>${esc(r.tipePeserta)}</td>
      <td><span class="pill ${asPillTipe(r.tipe)}">${esc(r.tipe)}</span></td>
      <td>${asJumlahBerkas(r)}</td>
      <td><button class="btn btn-info btn-sm" data-as-detail="${r._id}">👁 Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="7"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + AS_PAGE_SIZE, rows.length);
  $("#as-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} pengajuan`;
  $("#as-pagination").innerHTML = asPaginationHtml(totalPages);
}

$("#as-cari").onclick   = () => { asPage = 1; renderAlihStatus(); };
$("#as-export").onclick = () => toast(`Daftar pengajuan alih status (${asBarisTersaring().length} pengajuan) diekspor ke Excel.`);

/* ------------------------------------------------------- Detail pengajuan */
function asNilaiPeserta(p, kolom) {
  const v = p[kolom.key];
  if (v === null || v === undefined || v === "") return "—";
  if (kolom.tipe === "tanggal") return asFmtTgl(v);
  if (kolom.tipe === "rupiah")  return rp(v);
  return String(v);
}

function asShowDetail(r) {
  $("#as-detail-sub").textContent =
    `${r.mekanisme} · ${r.tipePeserta} · Alih Status ${r.tipe} · ${asJumlahBerkas(r)} berkas`;
  $("#as-d-tanggal").textContent     = asFmtTgl(r.tglPengajuan);
  $("#as-d-mekanisme").textContent   = r.mekanisme;
  $("#as-d-tipe-peserta").textContent = r.tipePeserta;
  $("#as-d-tipe").textContent        = r.tipe;

  const kolektif = r.mekanisme === "Kolektif";
  $("#as-detail-perorangan").style.display = kolektif ? "none" : "";
  $("#as-detail-kolektif").style.display   = kolektif ? "" : "none";

  if (kolektif) {
    $("#as-detail-kolektif-judul").textContent = `Daftar Peserta pada Berkas (${asJumlahBerkas(r)})`;
    $("#as-detail-head").innerHTML = `<th class="stick-l">No</th>`
      + ALIH_STATUS_KOLOM_PESERTA.map(k => `<th>${esc(k.label)}</th>`).join("");
    $("#as-detail-body").innerHTML = r.peserta.map((p, i) => `
      <tr>
        <td class="stick-l">${i + 1}</td>
        ${ALIH_STATUS_KOLOM_PESERTA.map(k => `<td>${esc(asNilaiPeserta(p, k))}</td>`).join("")}
      </tr>`).join("");
  } else {
    const p = r.peserta[0] || {};
    const baris = (k) => `
      <div class="review-row">
        <div class="fl">${esc(k.label)}</div>
        <div class="val">${esc(asNilaiPeserta(p, k))}</div>
      </div>`;
    const grup = (judul, keys) => `
      <div class="subsection-title">${esc(judul)}</div>
      <div class="grid3">${ALIH_STATUS_KOLOM_PESERTA.filter(k => keys.includes(k.key)).map(baris).join("")}</div>`;

    $("#as-detail-ringkas").innerHTML =
        grup("Data Peserta", ["nrpBaru","nrpLama","nama","tglLahir","angkatan","unor",
                              "statusPersonil","gol","tmtPangkat","gajiPokok","statusMenikah"])
      + grup("Data Alih Status", ["satkerLama","satkerBaru","tglPindah","noSkep","tglSkep"])
      + grup("Data Pembayaran", ["jumlahDiizinkan","tglBayar","noDpb"])
      + `<div class="grid3">
           <div class="review-row">
             <div class="fl">Bukti Pembayaran</div>
             <div class="val">${p.buktiBayar ? esc(p.buktiBayar) : "—"}</div>
           </div>
         </div>`;
  }
  alihStatusGotoView("detail");
}

$("#as-detail-kembali").onclick = () => alihStatusGotoView("list");
$("#as-detail-export").onclick  = () => toast("Daftar peserta pada berkas diekspor ke Excel.");

/* --------------------------------------------- Form Alih Status Peserta (tambah)
   Bukan modal: form tampil sebagai tampilan lain di dalam layar yang sama,
   pola yang dipakai juga oleh Pendaftaran Perorangan (riwayat ↔ wizard).

   Alurnya bercabang di langkah 1 (Data Pengajuan):
     Perorangan → 2. Input Alih Status Peserta (form satu peserta)
     Kolektif   → 2. Unggah Berkas  →  3. Validasi dan Submit */
let asFormStep = 1;

function alihStatusGotoView(view) {
  $("#as-list-view").style.display   = view === "list"   ? "" : "none";
  $("#as-detail-view").style.display = view === "detail" ? "" : "none";
  $("#as-form-view").style.display   = view === "form"   ? "" : "none";
  const ujung = view === "detail" ? "Detail Pengajuan Alih Status"
              : view === "form"   ? $("#asf-title").textContent
              : null;
  $("#as-crumb").innerHTML = ujung
    ? `<span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><span>Pengelolaan Alih Status Peserta</span><span>›</span><b>${esc(ujung)}</b>`
    : `<span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><b>Pengelolaan Alih Status Peserta</b>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function asJalurKolektif() { return $("#asf-mekanisme").value === "Kolektif"; }

/* Label langkah mengikuti mekanisme yang sedang dipilih — Perorangan hanya
   punya dua langkah, Kolektif tiga. */
function asLangkah() {
  return asJalurKolektif()
    ? ["Data Pengajuan", "Unggah Berkas", "Validasi dan Submit"]
    : ["Data Pengajuan", "Input Alih Status Peserta"];
}

function asRenderStepper() {
  $("#asf-stepper").innerHTML = asLangkah().map((l, i) => {
    const n = i + 1;
    const kelas = n === asFormStep ? "step active" : n < asFormStep ? "step done" : "step";
    return `<button class="${kelas}" data-asf-step="${n}" ${n > asFormStep ? "disabled" : ""}>${n}. ${esc(l)}</button>`;
  }).join("");
}

function asGotoStep(n) {
  asFormStep = n;
  const kolektif = asJalurKolektif();
  $("#asf-step-1").style.display          = n === 1 ? "" : "none";
  $("#asf-step-perorangan").style.display = n === 2 && !kolektif ? "" : "none";
  $("#asf-step-unggah").style.display     = n === 2 &&  kolektif ? "" : "none";
  $("#asf-step-validasi").style.display   = n === 3 ? "" : "none";
  asRenderStepper();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#asf-stepper").onclick = e => {
  const b = e.target.closest("[data-asf-step]");
  if (b && !b.disabled) asGotoStep(+b.dataset.asfStep);
};

$("#asf-mekanisme").onchange = () => { asResetUnggah(); asRenderStepper(); };

/* ---------------------------------------------------------- langkah 1 */
const AS_PENGAJUAN_WAJIB = [
  ["asf-mekanisme",    "Pilih Mekanisme Alih Status Peserta"],
  ["asf-tipe-peserta", "Tipe Peserta"],
  ["asf-tipe",         "Tipe Alih Status Peserta"]
];

function asCekWajib(daftar) {
  const kurang = daftar.filter(([id]) => !$("#" + id).value.trim());
  daftar.forEach(([id]) => $("#" + id).closest(".field").classList.remove("err"));
  kurang.forEach(([id]) => $("#" + id).closest(".field").classList.add("err"));
  if (kurang.length) toast(`${kurang[0][1]} wajib diisi.`, "bad");
  return kurang.length === 0;
}

function asKonteksPengajuan() {
  return {
    mekanisme:   $("#asf-mekanisme").value,
    tipePeserta: $("#asf-tipe-peserta").value,
    tipe:        $("#asf-tipe").value
  };
}

$("#asf-batal").onclick = () => alihStatusGotoView("list");

$("#asf-lanjut").onclick = () => {
  if (!asCekWajib(AS_PENGAJUAN_WAJIB)) return;
  $("#asf-rekap-mekanisme").textContent    = $("#asf-mekanisme").value;
  $("#asf-rekap-tipe-peserta").textContent = $("#asf-tipe-peserta").value;
  $("#asf-rekap-tipe").textContent         = $("#asf-tipe").value;
  asGotoStep(2);
};

/* ------------------------------------- langkah 2a: form perorangan */
const AS_FORM_FIELD = [
  ["asf-nrp-baru",     "nrpBaru"],     ["asf-nrp-lama",    "nrpLama"],
  ["asf-nama",         "nama"],        ["asf-tgl-lahir",   "tglLahir"],
  ["asf-angkatan",     "angkatan"],    ["asf-unor",        "unor"],
  ["asf-personil",     "statusPersonil"], ["asf-gol",      "gol"],
  ["asf-tmt",          "tmtPangkat"],  ["asf-gaji",        "gajiPokok"],
  ["asf-menikah",      "statusMenikah"], ["asf-satker-lama", "satkerLama"],
  ["asf-satker-baru",  "satkerBaru"],  ["asf-tgl-pindah",  "tglPindah"],
  ["asf-no-skep",      "noSkep"],      ["asf-tgl-skep",    "tglSkep"],
  ["asf-jumlah",       "jumlahDiizinkan"], ["asf-tgl-bayar", "tglBayar"],
  ["asf-no-dpb",       "noDpb"]
];

/* Field wajib mengikuti tanda (*) di form. */
const AS_FORM_WAJIB = [
  ["asf-nrp-baru",  "NRP/NIP Baru"], ["asf-nama",     "Nama Peserta"],
  ["asf-tgl-lahir", "Tanggal Lahir"],["asf-angkatan", "Angkatan"],
  ["asf-personil",  "Status Personil"], ["asf-tgl-pindah", "Tanggal Pindah"]
];

function asShowForm() {
  $("#asf-mekanisme").value    = "";
  $("#asf-tipe-peserta").value = "";
  $("#asf-tipe").value         = "";
  AS_FORM_FIELD.forEach(([id]) => { $("#" + id).value = ""; });
  $("#asf-bukti").value = "";
  $("#asf-bukti-nama").textContent = "Belum ada berkas terunggah.";
  $$("#as-form-view .field").forEach(f => f.classList.remove("err"));
  asResetUnggah();
  asGotoStep(1);
  alihStatusGotoView("form");
}

$("#asf-bukti").onchange = () => {
  const f = $("#asf-bukti").files[0];
  $("#asf-bukti-nama").textContent = f ? `Berkas dipilih: ${f.name}` : "Belum ada berkas terunggah.";
};

$("#asf-pero-kembali").onclick = () => asGotoStep(1);

$("#asf-simpan").onclick = () => {
  if (!asCekWajib(AS_FORM_WAJIB)) return;

  const p = {};
  AS_FORM_FIELD.forEach(([id, key]) => { p[key] = $("#" + id).value.trim(); });
  p.nama      = p.nama.toUpperCase();
  p.nrpLama   = p.nrpLama || null;
  p.gajiPokok = +p.gajiPokok.replace(/\D/g, "") || 0;
  p.jumlahDiizinkan = +p.jumlahDiizinkan || 0;
  const berkas = $("#asf-bukti").files[0];
  p.buktiBayar = berkas ? berkas.name : null;

  asTambahPengajuan([p]);
  toast("Pengajuan alih status peserta berhasil disimpan.", "ok");
};

/* Pengajuan baru selalu masuk paling atas dengan tanggal pengajuan hari ini. */
function asTambahPengajuan(peserta) {
  asRows.unshift({
    ...asKonteksPengajuan(),
    tglPengajuan: new Date().toISOString().slice(0, 10),
    peserta,
    _id: asRows.length ? Math.max(...asRows.map(x => x._id)) + 1 : 0
  });
  asPage = 1;
  renderAlihStatus();
  alihStatusGotoView("list");
}

/* ------------------------------- langkah 2b & 3: unggah kolektif */
function asResetUnggah() {
  $("#asf-dropzone").classList.remove("has-file");
  $("#asf-file-title").textContent = "Tarik file ke sini atau klik untuk memilih";
  $("#asf-file-sub").textContent   = "Format .xlsx, maksimal 5 MB";
  $("#asf-btn-validasi").disabled  = true;
}

function isiPilihanGolAlihStatus() {
  $("#asf-gol").innerHTML = `<option value="">— Silahkan Pilih Pangkat —</option>`
    + ALIH_STATUS_GOL.map(g => `<option>${esc(g)}</option>`).join("");
}

function asSetTemplate() {
  $("#asf-template-title").textContent = DATA_ALIH_STATUS_KOLEKTIF.templateNama;
  const tombol = $("#asf-btn-template");
  tombol.href = encodeURIComponent(DATA_ALIH_STATUS_KOLEKTIF.templateFile);
  tombol.setAttribute("download", DATA_ALIH_STATUS_KOLEKTIF.templateFile);
}
asSetTemplate();

$("#asf-btn-template").onclick = () => toast(`${DATA_ALIH_STATUS_KOLEKTIF.templateNama} diunduh.`);

$("#asf-dropzone").onclick = () => {
  $("#asf-dropzone").classList.add("has-file");
  $("#asf-file-title").textContent = DATA_ALIH_STATUS_KOLEKTIF.namaBerkas;
  $("#asf-file-sub").textContent   = `${DATA_ALIH_STATUS_KOLEKTIF.rows.length} baris terbaca — siap divalidasi`;
  $("#asf-btn-validasi").disabled  = false;
};

$("#asf-unggah-kembali").onclick = () => asGotoStep(1);

$("#asf-btn-validasi").onclick = () => {
  const data  = DATA_ALIH_STATUS_KOLEKTIF;
  const total = data.rows.length;
  const valid          = data.rows.filter(r => r.status === "valid").length;
  const tanpaPerubahan = data.rows.filter(r => r.status === "tanpa-perubahan").length;
  const ditolak        = data.rows.filter(r => r.status === "ditolak").length;

  $("#asf-metrics").innerHTML = `
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

  $("#asf-alert-warn").style.display = valid === 0 ? "" : "none";

  const rowsDitolak = data.rows.filter(r => r.status === "ditolak");
  if (rowsDitolak.length) {
    $("#asf-error-head").innerHTML =
      `<th>Baris</th>` + data.kolomError.map(k => `<th>${esc(k)}</th>`).join("") + `<th>Alasan Ditolak</th>`;
    $("#asf-error-body").innerHTML = rowsDitolak.map(r => `
      <tr>
        <td>${data.rows.indexOf(r) + 1}</td>
        ${r.nilai.slice(0, data.kolomError.length).map(v => `<td>${esc(v)}</td>`).join("")}
        <td class="bad-txt">${r.alasan.map(a => `• ${esc(a)}`).join("<br>")}</td>
      </tr>`).join("");
    $("#asf-error-body").closest(".tbl-wrap").style.display = "";
    $("#asf-error-empty").style.display = "none";
  } else {
    $("#asf-error-body").innerHTML = "";
    $("#asf-error-body").closest(".tbl-wrap").style.display = "none";
    $("#asf-error-empty").style.display = "";
  }

  $("#asf-submit").disabled = valid === 0;
  asGotoStep(3);
  toast(`Berkas tervalidasi. ${valid} dari ${total} baris siap disubmit.`, valid ? "ok" : "bad");
};

$("#asf-validasi-kembali").onclick = () => asGotoStep(2);
$("#asf-export-validasi").onclick  = () => toast("Rekap hasil validasi diekspor ke Excel.");

/* Baris valid dari berkas kolektif menjadi satu pengajuan baru. Kolom yang
   tidak ada di berkas contoh dibiarkan kosong supaya jelas belum terisi. */
$("#asf-submit").onclick = () => {
  if ($("#asf-submit").disabled) return;
  const peserta = DATA_ALIH_STATUS_KOLEKTIF.rows
    .filter(r => r.status === "valid")
    .map(r => {
      const [nrpBaru, nama, satkerBaru, tglPindah] = r.nilai;
      return { nrpBaru, nrpLama:null, nama, satkerBaru, tglPindah, buktiBayar:null };
    });
  asTambahPengajuan(peserta);
  toast(`${peserta.length} baris alih status kolektif berhasil disubmit.`, "ok");
};

$("#as-tambah").onclick = asShowForm;

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-as-page]");
  if (bPage) { asPage = +bPage.dataset.asPage; renderAlihStatus(); return; }

  const th = e.target.closest("[data-as-sort]");
  if (th) {
    const col = th.dataset.asSort;
    asSort = { col, dir: asSort.col === col ? -asSort.dir : 1 };
    renderAlihStatus();
    return;
  }

  const bDetail = e.target.closest("[data-as-detail]");
  if (bDetail) { asShowDetail(asRows.find(x => x._id === +bDetail.dataset.asDetail)); }
});

/* ============================================== NOTIFIKASI DI NAVBAR (LONCENG)
   Ringkasan 5 notifikasi teratas; sumber datanya sama dengan panel Notifikasi
   di Home supaya jumlahnya tidak pernah berbeda antar layar. */
function renderTopNotif() {
  const list = notifikasiUntukRole();
  const n = list.length;
  const badge = $("#top-bell-count");
  badge.textContent = n > 9 ? "9+" : n;
  badge.hidden = n === 0;
  $("#top-bell").setAttribute("aria-label", `Notifikasi (${n} tugas)`);
  $("#top-notif-count").textContent = `${n} tugas`;
  $("#top-notif-list").innerHTML = list.slice(0, 5).map(x => `
    <button class="notif-item" type="button" data-notif-go="${esc(x.go || "home")}" ${x.pumId !== undefined ? `data-notif-pum-id="${x.pumId}"` : ""} ${x.ruKpa ? `data-notif-ru-kpa="${esc(x.ruKpa)}"` : ""}>
      <div class="notif-item-top">
        <span class="notif-item-judul">${esc(x.judul)}</span>
        <span class="pill ${HOME_SEVERITY_PILL[x.tingkat] || "pill-info"}" style="flex-shrink:0">${esc(x.tingkat)}</span>
      </div>
      ${x.detail
        ? `<div class="notif-item-meta">${esc(x.detail)}</div><div class="notif-item-meta">${esc(x.tanggal)}</div>`
        : `<div class="notif-item-meta">${esc(x.id)} · ${esc(x.lokasi)}</div><div class="notif-item-meta">${esc(x.modul)} · ${esc(x.tanggal)}</div>`}
    </button>`).join("")
    || `<div class="empty" style="padding:18px 14px">Tidak ada notifikasi.</div>`;
}

function toggleTopNotif(buka) {
  const pop = $("#top-notif");
  const tampil = buka === undefined ? pop.hidden : buka;
  pop.hidden = !tampil;
  $("#top-bell").classList.toggle("open", tampil);
  $("#top-bell").setAttribute("aria-expanded", String(tampil));
}

$("#top-bell").onclick = (e) => { e.stopPropagation(); toggleTopNotif(); };
$("#top-notif").onclick = (e) => {
  e.stopPropagation();
  const item = e.target.closest(".notif-item");
  if (!item) return;
  toggleTopNotif(false);
  go(item.dataset.notifGo || "home");
  if (item.dataset.notifPumId !== undefined) sorotBarisPum(+item.dataset.notifPumId);
  if (item.dataset.notifRuKpa) sorotBarisRequestUmum(item.dataset.notifRuKpa);
};
$("#top-notif-all").onclick = () => { toggleTopNotif(false); go("home"); };
document.addEventListener("click", () => toggleTopNotif(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleTopNotif(false); });

/* ============================================ PENGELOLAAN DATA PESERTA */
const DP_PAGE_SIZE = 10;
let dpPage = 1;

/* Satu baris kriteria = { tipe, op, nilai }. Tombol "+ Filter" menambah baris
   baru; semua baris digabung dengan DAN. Indeks di array dipakai sebagai
   data-attribute supaya nilai bisa dibaca balik dari DOM sebelum di-render
   ulang (menambah/menghapus baris tidak boleh menghapus isian yang lain). */
let dpKriteria = [{ tipe:0, op:0, nilai:"" }];
let dpFilter   = { alih:"Semua", status:"AKTIF", valid:"semua" };

function isiPilihanDataPeserta() {
  const opsi = (arr, dipilih) => arr
    .map(v => `<option${v === dipilih ? " selected" : ""}>${esc(v)}</option>`).join("");
  $("#dp-f-alih").innerHTML   = opsi(PESERTA_KELOLA_ALIH_STATUS, "Semua");
  $("#dp-f-status").innerHTML = opsi(PESERTA_KELOLA_STATUS, "AKTIF");
  $("#dp-f-valid").innerHTML  = opsi(PESERTA_KELOLA_VALID, "semua");
  renderKriteriaDataPeserta();
}

/* Simpan isian baris kriteria yang sedang tampil ke dpKriteria. */
function dpBacaKriteria() {
  $$("[data-dp-baris]").forEach(baris => {
    const i = +baris.dataset.dpBaris;
    dpKriteria[i] = {
      tipe:  +baris.querySelector("[data-dp-k-tipe]").value,
      op:    +baris.querySelector("[data-dp-k-op]").value,
      nilai: baris.querySelector("[data-dp-k-nilai]").value.trim()
    };
  });
}

function renderKriteriaDataPeserta() {
  const optTipe = dipilih => PESERTA_KELOLA_TIPE_CARI
    .map((t, i) => `<option value="${i}"${i === dipilih ? " selected" : ""}>${esc(t.label)}</option>`).join("");
  const optOp = dipilih => PESERTA_KELOLA_OPERATOR
    .map((t, i) => `<option value="${i}"${i === dipilih ? " selected" : ""}>${esc(t.label)}</option>`).join("");

  $("#dp-kriteria").innerHTML = dpKriteria.map((k, i) => {
    const terakhir = i === dpKriteria.length - 1;
    const tombol = terakhir
      ? `<button class="btn btn-ghost" id="dp-tambah-filter">+ Filter</button>`
      : `<button class="btn btn-danger" data-dp-hapus="${i}" title="Hapus kriteria ini">⌫</button>`;
    return `
      <div data-dp-baris="${i}" style="display:grid;grid-template-columns:1.5fr 1.1fr 1.8fr auto;gap:10px 20px;align-items:flex-end;margin-bottom:16px">
        <div class="field" style="margin-bottom:0">
          <label class="fl caps">Tipe Pencarian</label>
          <select class="inp" data-dp-k-tipe="${i}">${optTipe(k.tipe)}</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="fl caps">Tipe</label>
          <select class="inp" data-dp-k-op="${i}">${optOp(k.op)}</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="fl caps">Nilai Pencarian</label>
          <input class="inp" data-dp-k-nilai="${i}" value="${esc(k.nilai)}" placeholder="Masukkan kata kunci pencarian...">
        </div>
        <div>${tombol}</div>
      </div>`;
  }).join("");
}

/* "dd-mm-yyyy" -> angka yyyymmdd supaya bisa dibandingkan besar/kecil.
   Mengembalikan null kalau teksnya bukan tanggal berformat itu. */
function dpKunciTanggal(teks) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((teks || "").trim());
  return m ? +(m[3] + m[2] + m[1]) : null;
}

/* Bandingkan satu sel dengan satu baris kriteria. */
function dpCocokKriteria(p, k) {
  const nilai = (k.nilai || "").trim();
  if (!nilai) return true;
  const field = PESERTA_KELOLA_TIPE_CARI[k.tipe];
  const oper  = PESERTA_KELOLA_OPERATOR[k.op];
  const sel   = String(p[field.key] ?? "");

  if (oper.op === "serupa") return sel.toLowerCase().includes(nilai.toLowerCase());

  let kiri, kanan;
  if (oper.tanggal) {
    kiri  = dpKunciTanggal(sel);
    kanan = dpKunciTanggal(nilai);
    if (kiri === null || kanan === null) return false;   // salah satu bukan tanggal
  } else if (sel !== "" && nilai !== "" && !isNaN(sel) && !isNaN(nilai)) {
    kiri  = +sel;
    kanan = +nilai;
  } else {
    kiri  = sel.toLowerCase();
    kanan = nilai.toLowerCase();
  }

  if (oper.op === "eq")  return kiri === kanan;
  if (oper.op === "gt")  return kiri >   kanan;
  if (oper.op === "lt")  return kiri <   kanan;
  if (oper.op === "gte") return kiri >=  kanan;
  if (oper.op === "lte") return kiri <=  kanan;
  return true;
}

function dpHasil() {
  return DATA_PESERTA_KELOLA.filter(p =>
    dpKriteria.every(k => dpCocokKriteria(p, k)) &&
    (dpFilter.alih   === "Semua"      || p.alihStatus    === dpFilter.alih) &&
    (dpFilter.status === "SEMUA DATA" || p.statusPeserta === dpFilter.status) &&
    (dpFilter.valid  === "semua"      || p.statusValid   === dpFilter.valid));
}

function dpPaginationHtml(totalPages) {
  const navBtn = (p, label, disabled) =>
    `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" data-dp-page="${p}"${disabled ? " disabled" : ""}>${label}</button>`;
  let html = navBtn(dpPage - 1, "‹", dpPage <= 1);
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn ${p === dpPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-dp-page="${p}">${p}</button>`;
  }
  html += navBtn(dpPage + 1, "›", dpPage >= totalPages);
  return html;
}

function renderDataPeserta() {
  const rows       = dpHasil();
  const totalPages = Math.max(1, Math.ceil(rows.length / DP_PAGE_SIZE));
  if (dpPage > totalPages) dpPage = totalPages;
  const start    = (dpPage - 1) * DP_PAGE_SIZE;
  const pageRows = rows.slice(start, start + DP_PAGE_SIZE);

  $("#dp-body").innerHTML = pageRows.length ? pageRows.map((p, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(p.nrp)}</td>
      <td>${esc(p.nopens)}</td>
      <td>${esc(p.ktpa)}</td>
      <td><span class="t-name">${esc(p.nama)}</span></td>
      <td>${esc(p.tglLahir)}</td>
      <td>${esc(p.tmt)}</td>
      <td>${esc(p.noSkep)}</td>
      <td>${esc(p.tglSkep)}</td>
      <td>${esc(p.pangkatAwal)}</td>
      <td>${esc(p.kesatuan)}</td>
      <td>${esc(p.vip)}</td>
      <td><button class="btn btn-info btn-sm" data-dp-detail="${esc(p.migrasiId)}">👁 Detail</button></td>
    </tr>`).join("")
    : `<tr><td colspan="13"><div class="empty"><h4>Data peserta tidak ditemukan</h4><p>Coba ubah kriteria pencarian atau filter status.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + DP_PAGE_SIZE, rows.length);
  $("#dp-count").textContent   = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} peserta`;
  $("#dp-pagination").innerHTML = dpPaginationHtml(totalPages);
}

function dpCari() {
  dpBacaKriteria();
  dpFilter = {
    alih:   $("#dp-f-alih").value,
    status: $("#dp-f-status").value,
    valid:  $("#dp-f-valid").value
  };
  dpPage = 1;
  renderDataPeserta();
}

/* ---------------------------------------------------- Detail Data Peserta */
let dpPesertaAktif = null;
let dpTabAktif     = "profil";

/* "dd-mm-yyyy" → "26 Februari 1965". Nilai "-" dibiarkan apa adanya. */
function dpTglPanjang(teks) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((teks || "").trim());
  return m ? `${+m[1]} ${BULAN_ID[+m[2] - 1]} ${m[3]}` : (teks || "-");
}

/* Kolom "Angkatan" di ringkasan ditulis "POLRI / Prajurit". Golongan
   personilnya diturunkan dari angkatan + status peserta supaya tidak perlu
   disimpan dua kali di data.js. */
function dpPersonil(p) {
  if (p.angkatan === "KEMHAN")     return "ASN";
  if (p.statusPeserta === "PENSIUN") return "Pensiunan";
  return "Prajurit";
}

function dpBukaDetail(migrasiId) {
  const p = DATA_PESERTA_KELOLA.find(x => x.migrasiId === migrasiId);
  if (!p) return;
  dpPesertaAktif = p;
  dpTabAktif     = "profil";
  renderDetailPeserta();
  go("data-peserta-detail");
}

function renderDetailPeserta() {
  const p = dpPesertaAktif;
  if (!p) return;

  $("#dpd-nama").textContent  = p.nama;
  $("#dpd-crumb").textContent = p.nama;

  const baris = (label, nilai) => `
    <tr>
      <td style="width:230px"><label class="fl" style="margin:0">${esc(label)}</label></td>
      <td class="t-strong">${esc(nilai)}</td>
    </tr>`;
  $("#dpd-ringkas").innerHTML =
    baris("Nomor Unik",     p.migrasiId) +
    baris("Nopens",         p.nopens) +
    baris("NRP",            p.nrp) +
    baris("Nama",           p.nama) +
    baris("Angkatan",       `${p.angkatan} / ${dpPersonil(p)}`) +
    baris("Tanggal Lahir",  dpTglPanjang(p.tglLahir)) +
    baris("Pangkat Akhir",  p.pangkatAkhir) +
    baris("Status Pensiun", p.statusPeserta === "PENSIUN" ? "SUDAH PENSIUN" : "BELUM PENSIUN");

  $("#dpd-tabs").innerHTML = PESERTA_KELOLA_TAB.map(t =>
    `<button class="tab${t.key === dpTabAktif ? " active" : ""}" data-dpd-tab="${esc(t.key)}">${esc(t.label)}</button>`).join("");

  renderPanelDetailPeserta();
}

function dpPillStatusAxapta(status) {
  if (status === "Posted")      return "pill-ok";
  if (status === "Journalized") return "pill-info";
  return "pill-warn";
}

/* Tabelnya 18 kolom, jadi memakai wide-table dengan kolom Nama Penerima
   menempel di kiri supaya tetap terbaca saat digeser mendatar. */
function renderTabHakPeserta() {
  const rows = dpPesertaAktif.hakProduk || [];
  $("#dpd-panel").innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 class="section-title" style="margin-bottom:6px">Hak / Produk</h3>
          <div class="page-sub" style="margin:0">Pembayaran hak dan produk peserta beserta jejak pembukuannya di Axapta.</div>
        </div>
        <button class="btn btn-primary" id="dpd-hak-transaksi">+ Transaksi Hak/Produk</button>
      </div>
      <div class="tbl-wrap">
        <table class="wide-table" style="min-width:2200px">
          <thead><tr>
            <th class="stick-l">Nama Penerima</th><th>Hubungan Keluarga</th><th>Produk</th><th>Tanggal Kejadian</th>
            <th>Bruto</th><th>Potongan</th><th>Potongan Pajak</th><th>Netto</th>
            <th>Cabang Mitra</th><th>Mitra Bayar</th><th>Nomor SP</th><th>Kode Bayar</th>
            <th>Nomor DPS</th><th>Tanggal DPS</th><th>Status Axapta</th><th>Tanggal Axapta</th>
            <th>ID Axapta</th><th>User Axapta</th>
          </tr></thead>
          <tbody>${rows.length ? rows.map(r => `
            <tr>
              <td class="stick-l t-strong">${esc(r.namaPenerima)}</td>
              <td>${esc(r.hubungan)}</td>
              <td>${esc(r.produk)}</td>
              <td>${esc(r.tglKejadian)}</td>
              <td>${esc(rp(r.bruto))}</td>
              <td>${esc(r.potongan ? rp(r.potongan) : "-")}</td>
              <td>${esc(rp(r.potonganPajak))}</td>
              <td class="t-strong">${esc(rp(r.netto))}</td>
              <td>${esc(r.cabangMitra)}</td>
              <td>${esc(r.mitraBayar)}</td>
              <td>${esc(r.nomorSP)}</td>
              <td>${esc(r.kodeBayar)}</td>
              <td>${esc(r.nomorDPS)}</td>
              <td>${esc(r.tglDPS)}</td>
              <td><span class="pill ${dpPillStatusAxapta(r.statusAxapta)}">${esc(r.statusAxapta)}</span></td>
              <td>${esc(r.tglAxapta)}</td>
              <td>${esc(r.idAxapta)}</td>
              <td>${esc(r.userAxapta)}</td>
            </tr>`).join("")
            : `<tr><td colspan="18"><div class="empty"><h4>Belum ada transaksi</h4><p>Peserta ini belum punya pembayaran hak atau produk.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  $("#dpd-hak-transaksi").onclick = () =>
    toast("Form transaksi hak/produk akan menyusul sesuai referensi FSD.");
}

function dpPillStatusHutang(status) {
  if (status === "Lunas")     return "pill-ok";
  if (status === "Take Over") return "pill-warn";
  return "pill-info";
}

/* Tab Hutang: dua section, masing-masing kartunya sendiri. */
function renderTabHutangPeserta() {
  const hutang = dpPesertaAktif.hutang      || [];
  const mitra  = dpPesertaAktif.hutangMitra || [];

  const barisHutang = hutang.length ? hutang.map(h => `
    <tr>
      <td>${esc(h.tmt)}</td>
      <td class="t-strong">${esc(h.noPiutang)}</td>
      <td>${esc(h.jenis)}</td>
      <td>${esc(rp(h.jumlah))}</td>
      <td>${esc(rp(h.sudahBayar))}</td>
      <td class="t-strong">${esc(rp(h.sisa))}</td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty"><h4>Tidak ada hutang</h4><p>Peserta ini tidak punya hutang kepada ASABRI.</p></div></td></tr>`;

  const barisMitra = mitra.length ? mitra.map(m => `
    <tr>
      <td class="t-strong">${esc(m.mitraBayar)}</td>
      <td>${esc(m.tglPengajuan)}</td>
      <td>${esc(m.awalKredit)}</td>
      <td>${esc(m.akhirKredit)}</td>
      <td>${esc(rp(m.plafon))}</td>
      <td>${esc(m.noRekTab)}</td>
      <td>${esc(m.noRekKredit)}</td>
      <td>${esc(m.noPinjaman)}</td>
      <td><span class="pill ${dpPillStatusHutang(m.status)}">${esc(m.status)}</span></td>
      <td>${esc(m.tarif)}</td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada hutang mitra</h4><p>Peserta ini tidak punya pinjaman pada bank/mitra penyalur.</p></div></td></tr>`;

  $("#dpd-panel").innerHTML = `
    <div class="card">
      <h3 class="section-title" style="margin-bottom:6px">Hutang</h3>
      <div class="page-sub" style="margin:0 0 14px">Hutang peserta kepada ASABRI beserta sisa angsurannya.</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>TMT</th><th>No Piutang</th><th>Jenis Piutang</th>
            <th>Jumlah</th><th>Jumlah Sudah Bayar</th><th>Jumlah Sisa Hutang</th>
          </tr></thead>
          <tbody>${barisHutang}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title" style="margin-bottom:6px">Hutang Mitra</h3>
      <div class="page-sub" style="margin:0 0 14px">Pinjaman peserta pada bank atau mitra penyalur.</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Mitra Bayar</th><th>Tgl Pengajuan</th><th>Awal Kredit</th><th>Akhir Kredit</th>
            <th>Plafon</th><th>Nomor Rekening Tab</th><th>Nomor Rekening Kredit</th>
            <th>Nomor Pinjaman Kredit</th><th>Status</th><th>Tarif</th>
          </tr></thead>
          <tbody>${barisMitra}</tbody>
        </table>
      </div>
    </div>`;
}

/* Tabelnya 22 kolom, jadi memakai wide-table: kolom No menempel di kiri dan
   kolom Aksi di kanan supaya tetap terlihat saat digeser mendatar. */
const DPD_KELUARGA_KOLOM = [
  "No", "Tgl Entry", "Nopens", "Nama", "Hubungan Keluarga", "Tempat Lahir", "Tgl Lahir",
  "Tgl Menikah", "Tgl Meninggal", "Tgl Mulai Kuliah", "Tgl Selesai Kuliah",
  "Tgl Mulai Kerja", "Tgl Selesai Kerja", "Pekerjaan",
  "Tgl Berhenti di Tunjang", "Tgl di Tunjang Kembali",
  "Nama Rekening", "Nomor Rekening", "Mitra Bayar", "Cabang Mitra Bayar",
  "Nomor Identitas", "Aksi"
];

/* Nama field per baris keluarga — dipakai saat menambah anggota baru lewat
   form Edit Keluarga, supaya semua kolom terisi "-" dan tidak ada sel kosong. */
const DPD_KELUARGA_FIELD = [
  "tglEntry", "nopens", "nama", "hubungan", "tempatLahir", "tglLahir",
  "tglMenikah", "tglMeninggal", "tglMulaiKuliah", "tglSelesaiKuliah",
  "tglMulaiKerja", "tglSelesaiKerja", "pekerjaan",
  "tglBerhentiTunjang", "tglTunjangKembali",
  "namaRekening", "nomorRekening", "mitraBayar", "cabangMitraBayar",
  "nomorIdentitas"
];

function renderTabKeluargaPeserta() {
  const rows = dpPesertaAktif.keluarga || [];
  const thead = DPD_KELUARGA_KOLOM.map((k, i) => {
    const stick = i === 0 ? " class=\"stick-l\"" : (i === DPD_KELUARGA_KOLOM.length - 1 ? " class=\"stick-r\"" : "");
    return `<th${stick}>${esc(k)}</th>`;
  }).join("");

  $("#dpd-panel").innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 class="section-title" style="margin-bottom:6px">Keluarga</h3>
          <div class="page-sub" style="margin:0">Pasangan dan anak yang terdaftar sebagai ahli waris peserta.</div>
        </div>
        <button class="btn btn-primary" id="dpd-keluarga-edit">✎ Edit Keluarga</button>
      </div>
      <div class="tbl-wrap">
        <table class="wide-table">
          <thead><tr>${thead}</tr></thead>
          <tbody>${rows.length ? rows.map((r, i) => `
            <tr>
              <td class="stick-l">${i + 1}</td>
              <td>${esc(r.tglEntry)}</td>
              <td>${esc(r.nopens)}</td>
              <td class="t-strong">${esc(r.nama)}</td>
              <td>${esc(r.hubungan)}</td>
              <td>${esc(r.tempatLahir)}</td>
              <td>${esc(r.tglLahir)}</td>
              <td>${esc(r.tglMenikah)}</td>
              <td>${esc(r.tglMeninggal)}</td>
              <td>${esc(r.tglMulaiKuliah)}</td>
              <td>${esc(r.tglSelesaiKuliah)}</td>
              <td>${esc(r.tglMulaiKerja)}</td>
              <td>${esc(r.tglSelesaiKerja)}</td>
              <td>${esc(r.pekerjaan)}</td>
              <td>${esc(r.tglBerhentiTunjang)}</td>
              <td>${esc(r.tglTunjangKembali)}</td>
              <td>${esc(r.namaRekening)}</td>
              <td>${esc(r.nomorRekening)}</td>
              <td>${esc(r.mitraBayar)}</td>
              <td>${esc(r.cabangMitraBayar)}</td>
              <td>${esc(r.nomorIdentitas)}</td>
              <td class="stick-r"><button class="btn btn-info btn-sm" data-dpd-keluarga="${i}">✎ Ubah</button></td>
            </tr>`).join("")
            : `<tr><td colspan="${DPD_KELUARGA_KOLOM.length}"><div class="empty"><h4>Data Keluarga Kosong</h4><p>Belum ada anggota keluarga yang terdaftar untuk peserta ini.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  $("#dpd-keluarga-edit").onclick = () => dpFormKeluarga(null);
  $$("[data-dpd-keluarga]").forEach(b => {
    b.onclick = () => dpFormKeluarga(+b.dataset.dpdKeluarga);
  });
}

/* ------------------------------------------- Form Data Keluarga (layar) */
/* Indeks baris keluarga yang sedang diubah; null berarti menambah anggota
   baru. Baris input rekening ditahan di dkfRekening supaya isian tidak hilang
   saat baris ditambah atau dihapus. */
let dkfIdx      = null;
let dkfRekening = [];

/* Hubungan di data contoh ditulis "ANAK KE-1", "ANAK KE-2", dst; dropdown
   hanya mengenal "ANAK". Yang tidak ada padanannya di daftar (misalnya SUAMI)
   dibiarkan kosong supaya tidak terlihat seolah-olah sudah terisi benar. */
function dpHubunganTerpilih(hubungan) {
  const h = (hubungan || "").replace(/ KE-\d+$/, "");
  return KELUARGA_HUBUNGAN.includes(h) ? h : "";
}

/* Tanggal hari ini dalam format "dd-mm-yyyy", sama seperti data contoh. */
function dpTglHariIni() {
  const d = new Date();
  const pad = v => String(v).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/* Data contoh menyimpan tanggal "dd-mm-yyyy", <input type="date"> memakai
   "yyyy-mm-dd"; kolom kosong ditulis "-". Dua helper ini yang menjembatani. */
function dkfKeInput(teks) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(teks || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function dkfDariInput(nilai) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nilai || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "-";
}
/* Nilai untuk ditaruh di <input>: "-" dan undefined sama-sama jadi kosong. */
function dkfIsi(nilai) {
  return nilai && nilai !== "-" ? nilai : "";
}

/* Isi semua dropdown di form. Dipanggil sekali saat prototipe dimuat. */
function isiPilihanFormKeluarga() {
  const opsi = (arr, kosong) =>
    `<option value="">${esc(kosong)}</option>` + arr.map(v => `<option>${esc(v)}</option>`).join("");
  $("#dkf-hubungan").innerHTML     = opsi(KELUARGA_HUBUNGAN, "— Pilih hubungan keluarga —");
  $("#dkf-kelamin").innerHTML      = opsi(KELUARGA_JENIS_KELAMIN, "— Pilih jenis kelamin —");
  $("#dkf-status-kawin").innerHTML = opsi(KELUARGA_STATUS_KAWIN, "— Pilih status perkawinan —");
  $("#dkf-pekerjaan").innerHTML    = opsi(KELUARGA_PEKERJAAN, "— Silahkan Pilih Pekerjaan —");
  $("#dkf-tipe-dokumen").innerHTML = opsi(KELUARGA_TIPE_DOKUMEN, "— Pilih Tipe —");
  $("#dkf-tipe-akta").innerHTML     = opsi(KELUARGA_TIPE_DOKUMEN, "— Pilih Tipe —");
  $("#dkf-file-lama").innerHTML     = opsi(KELUARGA_DOKUMEN_TERSEDIA, "— Silahkan Pilih Dokumen —");
  $("#dkf-file-akta-lama").innerHTML = opsi(KELUARGA_DOKUMEN_TERSEDIA, "— Silahkan Pilih Dokumen —");
}

/* Pilihan "Orang Tua" untuk hubungan ANAK: peserta itu sendiri dan
   pasangannya yang sudah terdaftar di tabel Keluarga. */
function dkfIsiOrangTua() {
  const pasangan = (dpPesertaAktif.keluarga || [])
    .filter(k => k.hubungan === "ISTRI" || k.hubungan === "SUAMI")
    .map(k => k.nama);
  $("#dkf-orangtua").innerHTML = `<option value="">— Silahkan Pilih Keluarga —</option>` +
    [dpPesertaAktif.nama, ...pasangan].map(v => `<option>${esc(v)}</option>`).join("");
}

/* Detail anggota keluarga baru muncul setelah hubungannya dipilih. */
/* Field opsional di form → pembungkus .field-nya di layar. */
const DKF_FIELD_OPSIONAL = {
  orangTua:      "#dkf-f-orangtua",
  akta:          "#dkf-f-akta",
  mulaiKerja:    "#dkf-f-mulai-kerja",
  berhentiKerja: "#dkf-f-berhenti-kerja",
  mulaiKuliah:   "#dkf-f-mulai-kuliah",
  selesaiKuliah: "#dkf-f-selesai-kuliah"
};

function dkfToggleDetail() {
  const hubungan = $("#dkf-hubungan").value;
  $("#dkf-detail").hidden = !hubungan;

  /* Tiap hubungan punya rangkaian field sendiri — lihat KELUARGA_FIELD_TAMPIL
     di data.js. Urutan field di markup sudah disusun supaya sisanya mengalir
     benar berapa pun yang disembunyikan. */
  const tampil = KELUARGA_FIELD_TAMPIL[hubungan] || KELUARGA_FIELD_BAWAAN;
  Object.keys(DKF_FIELD_OPSIONAL).forEach(k => {
    $(DKF_FIELD_OPSIONAL[k]).hidden = !tampil.includes(k);
  });

  /* Jenis kelamin sudah pasti untuk sebagian hubungan — isikan saja, tapi
     jangan menimpa pilihan yang sudah dibuat sendiri oleh petugas. */
  const bawaan = KELUARGA_KELAMIN_BAWAAN[hubungan];
  if (bawaan && !$("#dkf-kelamin").value) $("#dkf-kelamin").value = bawaan;

  dkfToggleAkta();   /* File Akta ikut hilang kalau Tipe Akta-nya hilang */
}

/* File Identitas mengikuti Tipe Dokumen Identitas: unggah berkas baru, pilih
   berkas yang sudah ada di E-Dosir, atau belum tampil sama sekali. */
function dkfToggleDokumen() {
  const tipe = $("#dkf-tipe-dokumen").value;
  $("#dkf-file-wrap").hidden = !tipe;
  $("#dkf-file-baru").hidden = tipe !== "Dokumen Baru";
  $("#dkf-file-lama").hidden = tipe !== "Dokumen Yang Sudah Ada";
}

/* File Akta Kelahiran mengikuti pola yang sama, dan hanya ikut tampil kalau
   Tipe Dokumen Akta Kelahiran memang dipakai oleh hubungan yang dipilih. */
function dkfToggleAkta() {
  const tipe = $("#dkf-tipe-akta").value;
  $("#dkf-f-file-akta").hidden   = $("#dkf-f-akta").hidden || !tipe;
  $("#dkf-file-akta-baru").hidden = tipe !== "Dokumen Baru";
  $("#dkf-file-akta-lama").hidden = tipe !== "Dokumen Yang Sudah Ada";
}

/* Buka layar form. `idx` = indeks baris keluarga, atau null untuk menambah. */
function dpFormKeluarga(idx) {
  dkfIdx      = idx;
  dkfRekening = [{ nama:"", nomor:"", mitra:"", cabang:"" }];

  const row = idx === null ? null : dpPesertaAktif.keluarga[idx];
  const r   = row || {};
  $("#dkf-judul").textContent         = row ? "Ubah Data Keluarga" : "Tambah Data Keluarga";
  $("#dkf-crumb-peserta").textContent = dpPesertaAktif.nama;

  $("#dkf-hubungan").value = dpHubunganTerpilih(row && row.hubungan);
  $("#dkf-hubungan").closest(".field").classList.remove("err");
  $("#dkf-hubungan-err").hidden = true;

  $("#dkf-nama").value         = row ? dkfIsi(r.nama).replace("(belum diisi)", "") : "";
  $("#dkf-tempat-lahir").value = dkfIsi(r.tempatLahir);
  $("#dkf-tgl-lahir").value    = dkfKeInput(r.tglLahir);
  $("#dkf-kelamin").value      = dkfIsi(r.jenisKelamin);
  $("#dkf-status-kawin").value = dkfIsi(r.statusKawin);
  $("#dkf-nik").value          = dkfIsi(r.nomorIdentitas);
  $("#dkf-pekerjaan").value    = KELUARGA_PEKERJAAN.includes(r.pekerjaan) ? r.pekerjaan : "";

  $("#dkf-tgl-meninggal").value        = dkfKeInput(r.tglMeninggal);
  $("#dkf-tgl-mulai-kerja").value      = dkfKeInput(r.tglMulaiKerja);
  $("#dkf-tgl-berhenti-kerja").value   = dkfKeInput(r.tglSelesaiKerja);
  $("#dkf-tgl-mulai-kuliah").value     = dkfKeInput(r.tglMulaiKuliah);
  $("#dkf-tgl-selesai-kuliah").value   = dkfKeInput(r.tglSelesaiKuliah);
  $("#dkf-tgl-berhenti-tunjang").value = dkfKeInput(r.tglBerhentiTunjang);
  $("#dkf-tgl-tunjang-kembali").value  = dkfKeInput(r.tglTunjangKembali);

  dkfIsiOrangTua();
  $("#dkf-orangtua").value       = dkfIsi(r.orangTua);
  $("#dkf-tipe-akta").value      = dkfIsi(r.tipeAkta);
  $("#dkf-file-akta-baru").value = "";
  $("#dkf-file-akta-lama").value = dkfIsi(r.fileAkta);

  $("#dkf-tipe-dokumen").value = dkfIsi(r.tipeDokumen);
  $("#dkf-file-baru").value    = "";
  $("#dkf-file-lama").value    = dkfIsi(r.fileIdentitas);

  $("#dkf-alamat").value  = dkfIsi(r.alamat);
  $("#dkf-kodepos").value = dkfIsi(r.kodePos);
  $("#dkf-rt").value      = dkfIsi(r.rt);
  $("#dkf-rw").value      = dkfIsi(r.rw);
  $("#dkf-desa").value    = dkfIsi(r.desa);
  $("#dkf-telepon").value = dkfIsi(r.telepon);
  $("#dkf-hp").value      = dkfIsi(r.handphone);
  $("#dkf-email").value   = dkfIsi(r.email);
  $("#dkf-ibu").value     = dkfIsi(r.namaIbu);

  $("#dkf-ahli-waris").checked = !!r.ahliWaris;
  $("#dkf-persen").value       = dkfIsi(r.persenAhliWaris);
  $("#dkf-persen").disabled    = !r.ahliWaris;

  dkfToggleDetail();
  dkfToggleDokumen();
  renderRiwayatRekeningKeluarga();
  renderRekeningKeluarga();
  go("keluarga-form");
}

$("#dkf-hubungan").onchange     = dkfToggleDetail;
$("#dkf-tipe-dokumen").onchange = dkfToggleDokumen;
$("#dkf-tipe-akta").onchange    = dkfToggleAkta;
$("#dkf-ahli-waris").onchange   = () => {
  const aktif = $("#dkf-ahli-waris").checked;
  $("#dkf-persen").disabled = !aktif;
  if (!aktif) $("#dkf-persen").value = "";
};

function renderRiwayatRekeningKeluarga() {
  const rows = dkfIdx === null ? [] : (dpPesertaAktif.keluarga[dkfIdx].rekening || []);
  $("#dkf-riwayat-body").innerHTML = rows.length ? rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td>${esc(r.nomor)}</td>
      <td>${esc(r.mitra)}</td>
      <td>${esc(r.cabang)}</td>
    </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty"><h4>Belum ada rekening</h4><p>Rekening yang ditambahkan di bawah akan muncul di daftar ini.</p></div></td></tr>`;
}

/* Simpan isian baris rekening yang sedang tampil ke dkfRekening. */
function dkfBacaRekening() {
  $$("[data-dkf-baris]").forEach(baris => {
    const i = +baris.dataset.dkfBaris;
    dkfRekening[i] = {
      nama:   baris.querySelector("[data-dkf-nama]").value.trim(),
      nomor:  baris.querySelector("[data-dkf-nomor]").value.trim(),
      mitra:  baris.querySelector("[data-dkf-mitra]").value,
      cabang: baris.querySelector("[data-dkf-cabang]").value.trim()
    };
  });
}

function renderRekeningKeluarga() {
  const optMitra = dipilih => `<option value="">— Pilih mitra bayar —</option>` +
    DATA_MITRA_BAYAR.map(m => `<option${m === dipilih ? " selected" : ""}>${esc(m)}</option>`).join("");

  $("#dkf-rekening").innerHTML = dkfRekening.map((r, i) => {
    const terakhir = i === dkfRekening.length - 1;
    const tombol = terakhir
      ? `<button class="btn btn-ghost" id="dkf-tambah-rekening">+ Rekening</button>`
      : `<button class="btn btn-danger" data-dkf-hapus="${i}" title="Hapus baris rekening ini">⌫</button>`;
    return `
      <div data-dkf-baris="${i}" style="display:grid;grid-template-columns:1.3fr 1.2fr 1.3fr 1.4fr auto;gap:10px 20px;align-items:flex-end;margin-bottom:16px">
        <div class="field" style="margin-bottom:0">
          <label class="fl">Nama Rekening</label>
          <input class="inp" data-dkf-nama="${i}" value="${esc(r.nama)}" placeholder="Nama pemilik rekening">
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="fl">Nomor Rekening</label>
          <input class="inp" data-dkf-nomor="${i}" value="${esc(r.nomor)}" placeholder="0000-00-000000">
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="fl">Mitra Bayar</label>
          <select class="inp" data-dkf-mitra="${i}">${optMitra(r.mitra)}</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="fl">Cabang Mitra Bayar</label>
          <input class="inp" data-dkf-cabang="${i}" value="${esc(r.cabang)}" placeholder="Nama kantor cabang mitra">
        </div>
        <div>${tombol}</div>
      </div>`;
  }).join("");
}

$("#s-keluarga-form").addEventListener("click", e => {
  if (e.target.closest("#dkf-tambah-rekening")) {
    dkfBacaRekening();
    dkfRekening.push({ nama:"", nomor:"", mitra:"", cabang:"" });
    renderRekeningKeluarga();
    return;
  }
  const bHapus = e.target.closest("[data-dkf-hapus]");
  if (bHapus) {
    dkfBacaRekening();
    dkfRekening.splice(+bHapus.dataset.dkfHapus, 1);
    if (!dkfRekening.length) dkfRekening = [{ nama:"", nomor:"", mitra:"", cabang:"" }];
    renderRekeningKeluarga();
  }
});

function dkfKembali() {
  go("data-peserta-detail");
  renderTabKeluargaPeserta();
}
$("#dkf-kembali").onclick = dkfKembali;
$("#dkf-batal").onclick   = dkfKembali;

$("#dkf-simpan").onclick = () => {
  const hubungan = $("#dkf-hubungan").value;
  if (!hubungan) {
    $("#dkf-hubungan").closest(".field").classList.add("err");
    $("#dkf-hubungan-err").hidden = false;
    return;
  }
  dkfBacaRekening();
  /* Baris rekening yang benar-benar diisi saja yang ikut tersimpan. */
  const rekeningBaru = dkfRekening.filter(r => r.nama && r.nomor && r.mitra);

  let row;
  if (dkfIdx === null) {
    row = {};
    DPD_KELUARGA_FIELD.forEach(f => { row[f] = "-"; });
    row.rekening = [];
    row.tglEntry = dpTglHariIni();
    row.nama     = "(belum diisi)";
    dpPesertaAktif.keluarga.push(row);
  } else {
    row = dpPesertaAktif.keluarga[dkfIdx];
  }
  row.hubungan = hubungan;

  /* Profil anggota keluarga. Isian kosong disimpan "-" supaya tabel Keluarga
     tidak pernah punya sel hampa. */
  const teks = id => $(id).value.trim() || "-";
  row.nama            = $("#dkf-nama").value.trim() || "(belum diisi)";
  row.tempatLahir     = teks("#dkf-tempat-lahir");
  row.tglLahir        = dkfDariInput($("#dkf-tgl-lahir").value);
  row.jenisKelamin    = teks("#dkf-kelamin");
  row.statusKawin     = teks("#dkf-status-kawin");
  row.nomorIdentitas  = teks("#dkf-nik");
  row.pekerjaan       = teks("#dkf-pekerjaan");
  row.tglMeninggal       = dkfDariInput($("#dkf-tgl-meninggal").value);
  row.tglBerhentiTunjang = dkfDariInput($("#dkf-tgl-berhenti-tunjang").value);
  row.tglTunjangKembali  = dkfDariInput($("#dkf-tgl-tunjang-kembali").value);

  /* Field opsional yang sedang disembunyikan tidak ikut disimpan — supaya
     tanggal kuliah tidak menempel di istri, dan sebaliknya. */
  const tampil = k => !$(DKF_FIELD_OPSIONAL[k]).hidden;
  const tglOpsional = (k, id) => tampil(k) ? dkfDariInput($(id).value) : "-";
  row.orangTua = tampil("orangTua") ? teks("#dkf-orangtua")  : "-";
  row.tipeAkta = tampil("akta")     ? teks("#dkf-tipe-akta") : "-";
  row.fileAkta = row.tipeAkta === "Dokumen Baru"
    ? (($("#dkf-file-akta-baru").files[0] || {}).name || "-")
    : (row.tipeAkta === "-" ? "-" : teks("#dkf-file-akta-lama"));
  row.tglMulaiKerja    = tglOpsional("mulaiKerja",    "#dkf-tgl-mulai-kerja");
  row.tglSelesaiKerja  = tglOpsional("berhentiKerja", "#dkf-tgl-berhenti-kerja");
  row.tglMulaiKuliah   = tglOpsional("mulaiKuliah",   "#dkf-tgl-mulai-kuliah");
  row.tglSelesaiKuliah = tglOpsional("selesaiKuliah", "#dkf-tgl-selesai-kuliah");

  row.tipeDokumen   = teks("#dkf-tipe-dokumen");
  row.fileIdentitas = row.tipeDokumen === "Dokumen Baru"
    ? (($("#dkf-file-baru").files[0] || {}).name || "-")
    : teks("#dkf-file-lama");

  row.alamat    = teks("#dkf-alamat");
  row.kodePos   = teks("#dkf-kodepos");
  row.rt        = teks("#dkf-rt");
  row.rw        = teks("#dkf-rw");
  row.desa      = teks("#dkf-desa");
  row.telepon   = teks("#dkf-telepon");
  row.handphone = teks("#dkf-hp");
  row.email     = teks("#dkf-email");
  row.namaIbu   = teks("#dkf-ibu");

  row.ahliWaris       = $("#dkf-ahli-waris").checked;
  row.persenAhliWaris = row.ahliWaris ? teks("#dkf-persen") : "-";

  row.rekening = (row.rekening || []).concat(rekeningBaru);

  /* Kolom rekening di tabel Keluarga selalu memperlihatkan entri terakhir. */
  const aktif = row.rekening[row.rekening.length - 1];
  if (aktif) {
    row.namaRekening     = aktif.nama;
    row.nomorRekening    = aktif.nomor;
    row.mitraBayar       = aktif.mitra;
    row.cabangMitraBayar = aktif.cabang;
  }

  dkfKembali();
  toast(dkfIdx === null ? "Anggota keluarga ditambahkan." : "Data keluarga diperbarui.", "ok");
};

/* Warna badge Tipe Perubahan SPTB — dipakai bersama oleh tab SPTB dan tab
   Riwayat Perubahan Data supaya tipe yang sama selalu berwarna sama. */
function dpPillTipeSptb(tipe) {
  if (tipe === "Pangkat")  return "pill-info";
  if (tipe === "Keluarga") return "pill-warn";
  return "pill-ok";
}

function renderTabSptbPeserta() {
  const rows = dpPesertaAktif.sptb || [];
  $("#dpd-panel").innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 class="section-title" style="margin-bottom:6px">SPTB</h3>
          <div class="page-sub" style="margin:0">Surat Pernyataan Tanda Bukti Diri yang pernah diajukan peserta.</div>
        </div>
        <button class="btn btn-ghost" id="dpd-sptb-export">⭳ Export Excel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>No</th><th>Tanggal SPTB</th><th>Tipe Perubahan SPTB</th><th>Keterangan</th>
          </tr></thead>
          <tbody>${rows.length ? rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(dpTglPanjang(r.tglSptb))}</td>
              <td><span class="pill ${dpPillTipeSptb(r.tipe)}">${esc(r.tipe)}</span></td>
              <td>${esc(r.keterangan)}</td>
            </tr>`).join("")
            : `<tr><td colspan="4"><div class="empty"><h4>Belum ada SPTB</h4><p>Peserta ini belum pernah mengajukan SPTB.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  $("#dpd-sptb-export").onclick = () =>
    toast(`Riwayat SPTB ${dpPesertaAktif.nama} diekspor ke Excel.`);
}

function renderTabPerubahanPeserta() {
  const rows = dpPesertaAktif.perubahan || [];
  $("#dpd-panel").innerHTML = `
    <div class="card">
      <h3 class="section-title">Riwayat Perubahan Data</h3>
      <div class="page-sub" style="margin:-8px 0 14px">Perubahan data peserta yang sudah disetujui, beserta nilai sebelum dan sesudahnya.</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>No</th><th>Tanggal Approval SPTB</th><th>User Approval</th><th>Sumber SPTB</th>
            <th>Tipe Perubahan SPTB</th><th>Data Lama</th><th>Data Baru</th>
          </tr></thead>
          <tbody>${rows.length ? rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(dpTglPanjang(r.tglApproval))}</td>
              <td>${esc(r.userApproval)}</td>
              <td>${esc(r.sumber)}</td>
              <td><span class="pill ${dpPillTipeSptb(r.tipe)}">${esc(r.tipe)}</span></td>
              <td style="color:var(--muted)">${esc(r.lama)}</td>
              <td class="t-strong">${esc(r.baru)}</td>
            </tr>`).join("")
            : `<tr><td colspan="7"><div class="empty"><h4>Belum ada perubahan data</h4><p>Belum ada SPTB peserta ini yang disetujui.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderPanelDetailPeserta() {
  const p   = dpPesertaAktif;
  const tab = PESERTA_KELOLA_TAB.find(t => t.key === dpTabAktif);

  if (dpTabAktif === "keluarga")  return renderTabKeluargaPeserta();
  if (dpTabAktif === "hutang")    return renderTabHutangPeserta();
  if (dpTabAktif === "hak")       return renderTabHakPeserta();
  if (dpTabAktif === "sptb")      return renderTabSptbPeserta();
  if (dpTabAktif === "perubahan") return renderTabPerubahanPeserta();

  if (dpTabAktif !== "profil") {
    $("#dpd-panel").innerHTML = `
      <div class="card">
        <div class="empty">
          <h4>${esc(tab.label)} belum tersedia</h4>
          <p>${esc(tab.sub)} Isinya akan menyusul sesuai referensi FSD.</p>
        </div>
      </div>`;
    return;
  }

  const pr = p.profil;
  /* Satu sel label + nilai. Nominal 0 ditulis "-" supaya tidak terbaca
     seolah-olah peserta menerima Rp 0. */
  const sel  = (label, nilai) => `
    <div class="review-row"><div class="fl">${esc(label)}</div><div class="val">${esc(nilai)}</div></div>`;
  const rupiah = v => v ? rp(v) : "-";
  const seksi = (judul, isi) => `
    <div class="card">
      <h3 class="section-title">${esc(judul)}</h3>
      <div class="grid3">${isi}</div>
    </div>`;

  $("#dpd-panel").innerHTML =
    seksi("Data Administrasi Pengajuan",
      sel("Nomor Batch", pr.nomorBatch) +
      sel("Nomor Agenda", pr.nomorAgenda) +
      sel("UNOR", pr.unor) +
      sel("Kantor Cabang Asabri", pr.kancab)) +

    seksi("Data Kepangkatan / Riwayat Dinas",
      sel("TMT Pengangkatan", dpTglPanjang(p.tmt)) +
      sel("Nomor SKEP Pengangkatan", p.noSkep) +
      sel("Tanggal SKEP Pengangkatan", dpTglPanjang(p.tglSkep)) +
      sel("Pangkat Awal", p.pangkatAwal) +
      sel("Bintang Jasa", pr.bintangJasa) +
      sel("Kesatuan Awal", pr.kesatuanAwal) +
      sel("Kesatuan", p.kesatuan) +
      sel("Kesatuan Akhir", pr.kesatuanAkhir) +
      sel("UNOR Akhir", pr.unorAkhir) +
      sel("PDW", pr.pdw) +
      sel("Perkiraan MKD", pr.perkiraanMkd) +
      sel("Masa Kerja Gaji", pr.masaKerjaGaji)) +

    seksi("Data Identitas Peserta",
      sel("Tempat Lahir", p.tempatLahir) +
      sel("Jenis Kelamin", pr.jenisKelamin) +
      sel("Status Kawin", pr.statusKawin) +
      sel("Nomor Identitas", pr.nomorIdentitas) +
      sel("NPWP", pr.npwp) +
      sel("Nama Ibu Kandung", pr.namaIbu) +
      sel("Alamat", pr.alamat) +
      sel("RT", pr.rt) +
      sel("RW", pr.rw) +
      sel("Kode Pos", pr.kodePos) +
      sel("Desa / Kelurahan", pr.desa) +
      sel("Kecamatan", pr.kecamatan) +
      sel("Kota", pr.kota) +
      sel("Provinsi", pr.provinsi) +
      sel("No Telepon", pr.telepon) +
      sel("No Handphone", pr.handphone)) +

    seksi("Data Status & Monitoring Kepesertaan",
      sel("Status Valid", p.statusValid) +
      sel("Tanggal SPTB Terakhir", dpTglPanjang(pr.tglSptbTerakhir)) +
      sel("Tanggal Hilang TMT", dpTglPanjang(pr.tglHilangTmt)) +
      sel("Tanggal Di Ketemukan", dpTglPanjang(pr.tglDitemukan)) +
      sel("Tanggal Meninggal", dpTglPanjang(pr.tglMeninggal))) +

    seksi("Data Pensiun",
      sel("NOPENS", p.nopens) +
      sel("Nomor SKEP Pensiun", p.noSkepPensiun) +
      sel("Tanggal SKEP Pensiun", dpTglPanjang(p.tglSkepPensiun)) +
      sel("Gaji Pokok Terakhir (Perkiraan)", rupiah(pr.gajiPokokTerakhir)) +
      sel("Penspok", rupiah(pr.penspok)) +
      sel("Batas Hak", dpTglPanjang(pr.batasHak)) +
      sel("Tunjangan Cacat", rupiah(pr.tunjanganCacat)) +
      sel("TMT SKPP", dpTglPanjang(pr.tmtSkpp))) +

    seksi("Data DAPEM",
      sel("Tanggal DAPEM Terakhir", dpTglPanjang(pr.tglDapemTerakhir)) +
      sel("Tanggal Pengambilan Uang Terakhir", dpTglPanjang(pr.tglAmbilUangTerakhir))) +

    `<div class="card">
      <div class="form-actions" style="border-top:0;padding-top:0;margin-top:0">
        <button class="btn btn-primary" id="dpd-mutakhir">✎ Ubah Data</button>
      </div>
    </div>`;

  $("#dpd-mutakhir").onclick = () => go("peremajaan-pemutakhiran");
}

$("#dpd-kembali").onclick = () => go("data-peserta");
$("#dpd-tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-dpd-tab]");
  if (!b) return;
  dpTabAktif = b.dataset.dpdTab;
  $$("#dpd-tabs .tab").forEach(t => t.classList.toggle("active", t.dataset.dpdTab === dpTabAktif));
  renderPanelDetailPeserta();
});

$("#dp-cari").onclick             = dpCari;
$("#dp-export-nominatif").onclick = () => toast("Daftar nominatif hasil pencarian diekspor ke Excel.");

$("#s-data-peserta").addEventListener("click", e => {
  if (e.target.closest("#dp-tambah-filter")) {
    dpBacaKriteria();
    dpKriteria.push({ tipe:0, op:0, nilai:"" });
    renderKriteriaDataPeserta();
    return;
  }
  const bHapus = e.target.closest("[data-dp-hapus]");
  if (bHapus) {
    dpBacaKriteria();
    dpKriteria.splice(+bHapus.dataset.dpHapus, 1);
    if (!dpKriteria.length) dpKriteria = [{ tipe:0, op:0, nilai:"" }];
    renderKriteriaDataPeserta();
    return;
  }
  const bPage = e.target.closest("[data-dp-page]");
  if (bPage && !bPage.disabled) { dpPage = +bPage.dataset.dpPage; renderDataPeserta(); return; }
  const bDetail = e.target.closest("[data-dp-detail]");
  if (bDetail) dpBukaDetail(bDetail.dataset.dpDetail);
});

$("#s-data-peserta").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches("[data-dp-k-nilai]")) dpCari();
});

/* ====================================================================== INIT */
/* Ganti role = ganti kewenangan, jadi layar yang tombolnya dibatasi role
   (UNOR, Referensi Kolektif, Status Peserta, Batas Usia Pensiun, SPP Data
   Peserta) digambar ulang. */
$("#top-role").onchange = () => {
  toast(`Role diubah ke: ${roleSaatIni()}.`);
  renderHome();
  renderTopNotif();
  renderUnor();
  renderRefKolektif();
  renderStatusPeserta();
  renderBup();
  renderSpp();
};
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
renderBumPelunasan();
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
isiPilihanGolAlihStatus();
renderAlihStatus();
isiPilihanDataPeserta();
isiPilihanFormKeluarga();
renderDataPeserta();
renderHome();
renderTopNotif();
go("home");

/* ============================================================ PEMBENTUKAN DAPEM
   Model kerja: Periode → Run → Tahap → Temuan → Koreksi.
   Langkah tanpa keputusan dijalankan sistem (tidak diberi tombol); yang
   diberi tombol hanya temuan yang butuh keputusan manusia.                  */

/* salinan hidup — data.js dibiarkan utuh */
let dapemTahap  = DAPEM_TAHAP.map(t => ({ ...t }));
let dapemGate   = DAPEM_GATE.map(g => ({ ...g, sisa: g.temuan, catatan: "" }));
let dapemTemuan = JSON.parse(JSON.stringify(DAPEM_TEMUAN));
let dapemAktif  = { periode: DAPEM_PARAM.blnbyr, jenis: DAPEM_PARAM.jenis };
let dapemTab    = "generate";
let dapemGateAktif = null;

const PILL_STATUS = {
  "Berjalan": "pill-warn", "Draft": "pill-info", "Selesai": "pill-ok",
  "Menunggu": "pill-warn", "Siap": "pill-ok"
};
const miliar = n => n >= 1e12 ? (n / 1e12).toFixed(2).replace(".", ",") + " T"
              : n >= 1e9  ? (n / 1e9 ).toFixed(2).replace(".", ",") + " M"
              : n >= 1e6  ? (n / 1e6 ).toFixed(2).replace(".", ",") + " Jt"
              : rp(n);

/* status sebuah pemeriksaan selalu punya tiga keadaan yang dibedakan tegas —
   "bersih" TIDAK BOLEH terlihat sama dengan "belum dijalankan". */
function statusGate(g) {
  const t = dapemTahap.find(x => x.kode === g.tahap);
  if (t && t.status === "terkunci")             return { pill: "pill-info", teks: "● Belum dijalankan" };
  if (g.catatan)                                return { pill: "pill-info", teks: "Diabaikan" };
  if (g.sisa > 0)                               return { pill: "pill-warn", teks: "⚠ Perlu tindakan" };
  return                                             { pill: "pill-ok",   teks: "✓ Bersih" };
}

/* ---------------------------------------------------- daftar periode dapem */
function renderDapemList() {
  const jenis  = $("#dapem-f-jenis").value;
  const status = $("#dapem-f-status").value;
  const cari   = $("#dapem-f-cari").value.trim().toLowerCase();

  const rows = DAPEM_PERIODE.filter(d =>
    (!jenis  || d.jenis  === jenis) &&
    (!status || d.status === status) &&
    (!cari   || d.periode.includes(cari)));

  $("#dapem-body").innerHTML = rows.length ? rows.map(d => {
    const buka = d.status === "Draft"   ? `<button class="btn btn-ghost btn-sm" data-dapem-buka="${esc(d.periode)}|${esc(d.jenis)}">Mulai</button>`
               : d.status === "Selesai" ? `<button class="btn btn-info btn-sm"  data-dapem-buka="${esc(d.periode)}|${esc(d.jenis)}">Lihat</button>`
               :                          `<button class="btn btn-info btn-sm"  data-dapem-buka="${esc(d.periode)}|${esc(d.jenis)}">Buka</button>`;
    /* periode yang sudah punya baris bisa langsung dibuka datanya */
    const adaData = DAPEM_DATA.some(r => r.periode === d.periode && r.jenis === d.jenis);
    const aksi = `<div style="display:flex;gap:6px">${buka}${adaData
      ? `<button class="btn btn-ghost btn-sm" data-dapem-data="${esc(d.periode)}|${esc(d.jenis)}">Peserta</button>` : ""}</div>`;
    return `<tr>
      <td><b>${esc(d.periode)}</b></td>
      <td>${esc(d.jenis)}</td>
      <td>${esc(d.tahap)}${d.tahapNo ? ` <span style="color:var(--faint)">(${d.tahapNo}/6)</span>` : ""}</td>
      <td><span class="pill ${PILL_STATUS[d.status] || "pill-info"}">${esc(d.status)}</span></td>
      <td>${esc(d.menunggu)}</td>
      <td>${d.nopens ? d.nopens.toLocaleString("id-ID") : "—"}</td>
      <td>${d.bruto ? miliar(d.bruto) : "—"}</td>
      <td>${d.netto ? miliar(d.netto) : "—"}</td>
      <td>${d.temuan ? `<b style="color:var(--amber-ink)">${d.temuan}</b>` : "—"}</td>
      <td>${esc(d.cutoff)}</td>
      <td>${aksi}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="11"><div class="empty"><h4>Tidak ada periode</h4><p>Ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  $("#dapem-note").textContent = `${rows.length} periode ditampilkan`;
}

function renderDapemMetrics() {
  const aktif  = DAPEM_PERIODE.find(d => d.status === "Berjalan");
  const temuan = dapemGate.reduce((a, g) => {
    const t = dapemTahap.find(x => x.kode === g.tahap);
    return a + (t && t.status !== "terkunci" ? g.sisa : 0);
  }, 0);
  const items = [
    { l: "Periode Berjalan", v: aktif ? `${aktif.periode} · ${aktif.jenis}` : "—", c: "navy" },
    { l: "Tahap Saat Ini",   v: aktif ? `${aktif.tahapNo} dari 6` : "—",           c: "" },
    { l: "Temuan Terbuka",   v: temuan,                                            c: temuan ? "bad" : "ok" },
    { l: "Batas Cut-off",    v: aktif ? aktif.cutoff : "—",                        c: "" }
  ];
  $("#dapem-metrics").innerHTML = items.map(m => `
    <div class="metric">
      <div class="metric-lbl">${esc(m.l)}</div>
      <div class="metric-val ${m.c}">${esc(m.v)}</div>
    </div>`).join("");
}

/* ------------------------------------------------------------ ruang kerja */
function renderDapemProses() {
  $("#dp-judul").textContent = `Pembentukan DAPEM · ${dapemAktif.jenis} · ${dapemAktif.periode}`;
  const t = dapemTahap.find(x => x.status === "aktif") || dapemTahap[dapemTahap.length - 1];
  $("#dp-sub").innerHTML = `Tahap ${t.no} dari 6 — ${esc(t.nama)} · <span class="pill pill-warn">Menunggu: ${esc(t.aktor)}</span>`;

  /* Parameter run: di proses manual nilai-nilai ini diketik ulang di ratusan
     tempat. Di sini ditetapkan sekali dan dipakai seluruh pemeriksaan. */
  const p = DAPEM_PARAM;
  const param = [
    ["Bulan Bayar Dapem", p.blnbyr], ["Bulan Pembanding", p.blnbyrPrev],
    ["Jenis Bayar", `${p.jnsbyr} — ${p.jenis}`], ["Tanggal Cut-off", p.tglCutoff],
    ["Tanggal Dapem", p.tglDapem], ["Rentang Otentikasi", `${p.otenDari} – ${p.otenSampai}`],
    ["Awal Tahun Pajak", p.tahunPajakAwal], ["Dijalankan Oleh", PENGATURAN.namaUser || "TI Manajemen Data"]
  ];
  $("#dp-param").innerHTML = param.map(([l, v]) => `
    <div class="review-row"><div class="fl">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join("");

  renderDemo();
  renderBannerTahap();

  $("#dp-tabs").innerHTML = dapemTahap.map(t => `
    <button class="tab ${t.kode === dapemTab ? "active" : ""}" data-dp-tab="${t.kode}" title="${esc(t.aktor)}">
      ${t.no} · ${esc(t.nama)}${t.status === "terkunci" ? " 🔒" : t.status === "selesai" ? " ✓" : ""}
    </button>`).join("");

  renderDapemTahap();
}

function renderDapemTahap() {
  const t = dapemTahap.find(x => x.kode === dapemTab);
  const r = DAPEM_RINGKAS[dapemTab];
  const gates = dapemGate.filter(g => g.tahap === dapemTab);
  const perlu = t.status === "terkunci" ? [] : gates.filter(g => g.sisa > 0 && !g.catatan);
  /* keputusan hanya milik lajur TI; tahap lain sekadar dilihat dari sini */
  const milikKita = laneTahap(dapemTab) === "ti";
  const sisa  = gates.filter(g => !perlu.includes(g));
  const html = [];

  if (t.status === "terkunci") html.push(`
    <div class="alert alert-info"><span>🔒</span><span>Tahap ini terkunci sampai tahap sebelumnya ditandai selesai. Isinya ditampilkan sebagai pratinjau — pemeriksaan belum dijalankan.</span></div>`);

  /* angka kontrol — menggantikan catatan jumlah baris di komentar SQL */
  html.push(`
    <div class="metrics m4">
      <div class="metric"><div class="metric-lbl">Jumlah Nopens</div>
        <div class="metric-val navy">${r.nopens.toLocaleString("id-ID")}
          ${r.delta ? `<span style="font-size:12px;color:${r.delta > 0 ? "var(--green)" : "var(--red)"}"> ${r.delta > 0 ? "+" : ""}${r.delta}</span>` : ""}
        </div></div>
      <div class="metric"><div class="metric-lbl">Bruto</div><div class="metric-val">${miliar(r.bruto)}</div></div>
      <div class="metric"><div class="metric-lbl">Netto</div><div class="metric-val">${miliar(r.netto)}</div></div>
      <div class="metric"><div class="metric-lbl">Penanggung Jawab</div><div class="metric-val" style="font-size:14px">${esc(t.aktor)}</div></div>
    </div>`);

  /* langkah otomatis — tanpa tombol, tapi tetap bisa diaudit */
  const oto = DAPEM_OTOMATIS[dapemTab] || [];
  const totalBaris = oto.reduce((a, o) => a + o.baris, 0);
  html.push(`
    <div class="card" style="margin-bottom:18px">
      <div class="head-row" style="margin-bottom:12px">
        <h3 class="card-title" style="margin:0">Dikerjakan sistem</h3>
        <div class="head-divider"></div>
        <span class="pill pill-ok">${oto.length} langkah${t.status === "terkunci" ? " (belum dijalankan)" : ` · ${totalBaris.toLocaleString("id-ID")} baris disesuaikan`}</span>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-dp-log="${esc(dapemTab)}">▤ Lihat Log</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Langkah</th><th>Parameter</th><th>Baris Terpengaruh</th></tr></thead>
        <tbody>${oto.length ? oto.map(o => `
          <tr><td>${esc(o.nama)}</td><td style="color:var(--muted)">${esc(o.param)}</td>
              <td>${t.status === "terkunci" ? "—" : o.baris.toLocaleString("id-ID")}</td></tr>`).join("")
          : `<tr><td colspan="3"><div class="empty"><h4>Tidak ada langkah otomatis</h4><p>Seluruh pekerjaan di tahap ini butuh keputusan.</p></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`);

  /* yang butuh keputusan — fokus layar */
  html.push(`
    <div class="card" style="margin-bottom:18px">
      <h3 class="card-title">${milikKita
        ? `Perlu keputusan Anda — ${perlu.length} dari ${gates.length} pemeriksaan`
        : `Menunggu keputusan ${esc(t.aktor)} — ${perlu.length} dari ${gates.length} pemeriksaan`}</h3>
      ${!milikKita && perlu.length ? `<div class="alert alert-info"><span>ⓘ</span><span>Keputusan atas temuan ini ada di ${esc(t.aktor)}. Dari layar ini Anda hanya dapat melihat daftarnya.</span></div>` : ""}
      <div class="tbl-wrap"><table>
        <thead><tr><th style="width:76px">Kode</th><th>Pemeriksaan</th><th style="width:82px">Temuan</th><th style="width:168px">Status</th><th style="width:96px">Aksi</th></tr></thead>
        <tbody>${perlu.length ? perlu.map(g => baris_gate(g, t)).join("")
          : `<tr><td colspan="7"><div class="empty"><h4>Tidak ada yang perlu diputuskan</h4><p>${t.status === "terkunci" ? "Pemeriksaan tahap ini belum dijalankan." : "Seluruh pemeriksaan tahap ini bersih."}</p></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`);

  if (sisa.length) html.push(`
    <div class="card" style="margin-bottom:18px">
      <div class="head-row" style="margin-bottom:12px">
        <h3 class="card-title" style="margin:0">Pemeriksaan lain</h3>
        <div class="head-divider"></div>
        <span class="pill pill-info">${sisa.length} pemeriksaan</span>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th style="width:76px">Kode</th><th>Pemeriksaan</th><th style="width:82px">Temuan</th><th style="width:168px">Status</th><th style="width:96px">Aksi</th></tr></thead>
        <tbody>${sisa.map(g => baris_gate(g, t)).join("")}</tbody>
      </table></div>
    </div>`);

  if (dapemTab === "pajak" || dapemTab === "sipp") html.push(kartu_putaran(dapemTab));
  if (dapemTab === "sipp") html.push(kartu_berkas());
  if (dapemTab === "sipp") html.push(kartuSippDok());
  if (dapemTab === "yar")  html.push(kartuYarBaru());

  const bisa = t.status === "aktif" && perlu.length === 0;
  html.push(`
    <div class="form-actions">
      <button class="btn btn-ghost" data-dp-log="${esc(dapemTab)}">Ekspor Ringkasan Tahap</button>
      <button class="btn btn-primary" id="dp-selesai" ${bisa ? "" : "disabled"}>Tandai Tahap ${t.no} Selesai →</button>
    </div>
    ${t.status === "aktif" && perlu.length
      ? `<div class="tbl-note">${milikKita
          ? `Masih ada ${perlu.length} pemeriksaan yang perlu diputuskan sebelum tahap ini bisa ditutup.`
          : `Tahap ini baru dapat ditutup setelah ${esc(t.aktor)} mengirim hasil validasinya.`}</div>`
      : ""}`);

  $("#dp-isi").innerHTML = html.join("");
}

function baris_gate(g, t) {
  const st = statusGate(g);
  const bisaTinjau = t.status !== "terkunci" && g.sisa > 0 && dapemTemuan[g.kode];
  const label = laneTahap(g.tahap) === "ti" ? "Tinjau" : "Lihat";
  return `<tr>
    <td><b>${esc(g.kode)}</b></td>
    <td>
      <div>${esc(g.nama)}
        <span class="pill ${g.sev === "tinggi" ? "pill-bad" : "pill-info"}" style="margin-left:6px">${esc(g.sev)}</span>
      </div>
      <div style="color:var(--muted);font-size:11px;margin-top:3px">${esc(g.param)}</div>
    </td>
    <td>${t.status === "terkunci" ? "—" : `<b>${g.sisa || 0}</b>`}</td>
    <td><span class="pill ${st.pill}">${esc(st.teks)}</span></td>
    <td>${bisaTinjau
      ? `<button class="btn btn-info btn-sm" data-dp-tinjau="${esc(g.kode)}">${label}</button>`
      : `<button class="btn btn-ghost btn-sm" disabled>${label}</button>`}</td>
  </tr>`;
}

/* putaran kirim–terima dengan pihak luar — di proses manual hanya ada di email */
function kartu_putaran(kode) {
  const judul = kode === "pajak" ? "Putaran Validasi Bagian Pajak" : "Putaran Validasi SIPP";
  const rows  = DAPEM_PUTARAN[kode] || [];
  return `
    <div class="card" style="margin-bottom:18px">
      <h3 class="card-title">${esc(judul)}</h3>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Putaran</th><th>Dikirim</th><th>Oleh</th><th>Berkas</th><th>Dibalas</th><th>Hasil</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><b>${r.putaran}</b></td><td>${esc(r.kirim)}</td><td>${esc(r.oleh)}</td>
          <td>${esc(r.berkas)}</td><td>${esc(r.balas)}</td><td>${esc(r.hasil)}</td>
          <td><span class="pill ${PILL_STATUS[r.status] || "pill-info"}">${esc(r.status)}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <div class="tbl-note">Hanya berkas yang datanya berubah yang dikirim ulang pada putaran berikutnya.</div>
    </div>`;
}

/* nama berkas dibentuk sistem — di proses manual diketik dan mudah salah tanggal */
function kartu_berkas() {
  return `
    <div class="card" style="margin-bottom:18px">
      <h3 class="card-title">Berkas ADK untuk SIPP</h3>
      <div class="alert alert-info"><span>ⓘ</span><span>Penamaan berkas dibentuk otomatis dari bulan bayar dan tanggal pembentukan, sehingga tidak perlu diketik manual.</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>No</th><th>Jenis</th><th>Nama Berkas</th><th>Jumlah Baris</th><th>Status</th></tr></thead>
        <tbody>${DAPEM_BERKAS_SIPP.map(b => `<tr>
          <td>${b.urut}</td><td>${esc(b.jenis)}</td>
          <td style="font-family:ui-monospace,monospace;font-size:11.5px">${esc(b.nama)}</td>
          <td>${b.baris.toLocaleString("id-ID")}</td>
          <td><span class="pill ${PILL_STATUS[b.status] || "pill-info"}">${esc(b.status)}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>`;
}

/* dua langkah yang di dokumen proses tidak punya kotaknya sendiri, padahal
   menentukan peserta dibayar atau tidak */
function kartu_yar() {
  return `
    <div class="card" style="margin-bottom:18px">
      <h3 class="card-title">Langkah Wajib Sebelum & Sesudah Unggah</h3>
      <div class="alert alert-info"><span>⚠</span><span>Kedua langkah ini tidak tercantum di bagan proses, tetapi wajib dikerjakan dan berpengaruh langsung pada pembayaran peserta.</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Urutan</th><th>Langkah</th><th>Keterangan</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Aktifkan mode pemeliharaan</td><td>Mencegah transaksi lain masuk saat data dipindahkan ke tabel pembayaran</td><td><span class="pill pill-info">Belum</span></td></tr>
          <tr><td>2</td><td>Unggah data dapem ke tabel pembayaran</td><td>Beserta proses potong hutang dapem</td><td><span class="pill pill-info">Belum</span></td></tr>
          <tr><td>3</td><td>Tetapkan kode otentikasi</td><td>Dijamin / bayar langsung / blokir sampai peserta melakukan otentikasi</td><td><span class="pill pill-info">Belum</span></td></tr>
          <tr><td>4</td><td>Nonaktifkan mode pemeliharaan</td><td>Dikembalikan setelah seluruh proses selesai</td><td><span class="pill pill-info">Belum</span></td></tr>
        </tbody>
      </table></div>
    </div>`;
}

/* ------------------------------------------------------------ tinjau temuan */
function bukaTemuan(kode) {
  dapemGateAktif = kode;
  const g = dapemGate.find(x => x.kode === kode);
  const d = dapemTemuan[kode];
  $("#dtm-judul").textContent = `${g.kode} · ${g.nama}`;
  $("#dtm-sub").textContent   = `${dapemAktif.jenis} · ${dapemAktif.periode} — ${d.baris.length} temuan`;
  $("#dtm-aturan").lastElementChild.textContent = d.aturan;
  $("#dtm-param").textContent = "Parameter: " + g.param;
  const punyaWewenang = laneTahap(g.tahap) === "ti";
  ["#dtm-terapkan", "#dtm-abaikan", "#dtm-all", "#dtm-none"]
    .forEach(sel => $(sel).style.display = punyaWewenang ? "" : "none");
  $("#dtm-terapkan").textContent = d.aksi;
  $("#dtm-head").innerHTML = `<th style="width:34px"></th>` +
    d.kolom.map(k => `<th>${esc(k)}</th>`).join("");
  renderTemuanBody();
  go("dapem-temuan");
}

function renderTemuanBody() {
  const d = dapemTemuan[dapemGateAktif];
  $("#dtm-body").innerHTML = d.baris.map((b, i) => `
    <tr>
      <td><input type="checkbox" data-dtm-row="${i}" ${b.pilih ? "checked" : ""}></td>
      ${b.sel.map((v, j) => `<td>${j === 0 ? `<b>${esc(v)}</b>` : esc(v)}</td>`).join("")}
    </tr>`).join("");
  const n = d.baris.filter(b => b.pilih).length;
  $("#dtm-note").innerHTML = `<b>${n}</b> dari ${d.baris.length} baris terpilih. Baris yang tidak dicentang dianggap sudah benar dan tidak akan diubah.`;
  $("#dtm-terapkan").disabled = n === 0;
}

/* pratinjau dampak — rumus dapem berantai, satu perubahan merambat ke tujuh
   kolom, jadi hasilnya diperlihatkan sebelum disimpan */
function pratinjauDampak() {
  const d = dapemTemuan[dapemGateAktif];
  const g = dapemGate.find(x => x.kode === dapemGateAktif);
  const n = d.baris.filter(b => b.pilih).length;
  const contoh = d.baris.find(b => b.pilih);
  const dampak = [
    ["Pensiun pokok",   "1.058.700", "794.000"],
    ["Tunjangan anak",     "21.174",       "0"],
    ["Tunjangan beras",   "144.840",  "72.420"],
    ["Tunjangan lain",     "68.320",  "34.160"],
    ["Jumlah bruto",    "1.293.034", "900.580"],
    ["Jumlah potongan",    "21.597",  "15.880"],
    ["Jumlah netto",    "1.271.500", "884.700"]
  ];
  $("#modal-title").textContent = d.aksi;
  $("#modal-sub").textContent   = `${g.kode} · ${n} baris akan diubah pada dapem ${dapemAktif.periode}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Perubahan pada satu kolom merambat ke bruto, potongan, netto, pembulatan, dan kembali ke bruto. Berikut dampaknya pada baris pertama yang terpilih.</span></div>
    <div class="subsection-title">CONTOH DAMPAK — ${esc(contoh.sel[0])} · ${esc(contoh.sel[1])}</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
      <tbody>${dampak.map(([k, a, b]) => `<tr><td>${esc(k)}</td>
        <td style="color:var(--muted)">${esc(a)}</td><td><b>${esc(b)}</b></td></tr>`).join("")}</tbody>
    </table></div>
    <div class="field" style="margin-top:16px">
      <label class="fl" for="dtm-alasan">Alasan / nomor tiket <span class="req">*</span></label>
      <input class="inp" id="dtm-alasan" placeholder="Contoh: hasil validasi Kepesertaan 20 Jun 2026 / #23817">
      <div class="hint">Alasan tersimpan bersama nilai lama, sehingga koreksi bisa ditelusuri kembali.</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="dtm-batal">Batal</button>
      <button class="btn btn-primary" id="dtm-konfirm">Terapkan ke ${n} baris</button>
    </div>`;
  openModal();
  $("#dtm-batal").onclick = closeModal;
  $("#dtm-konfirm").onclick = () => {
    const alasan = $("#dtm-alasan").value.trim();
    if (!alasan) { toast("Alasan wajib diisi.", "bad"); $("#dtm-alasan").focus(); return; }
    d.baris = d.baris.filter(b => !b.pilih);
    g.sisa  = d.baris.length;
    closeModal();
    toast(`${n} baris diperbaiki pada ${g.kode}.`, "ok");
    if (!d.baris.length) { renderDapemProses(); go("dapem-proses"); }
    else renderTemuanBody();
  };
}

function abaikanTemuan() {
  const d = dapemTemuan[dapemGateAktif];
  const g = dapemGate.find(x => x.kode === dapemGateAktif);
  const n = d.baris.filter(b => b.pilih).length;
  if (!n) { toast("Belum ada baris yang dipilih.", "bad"); return; }
  $("#modal-title").textContent = "Abaikan temuan";
  $("#modal-sub").textContent   = `${g.kode} · ${n} baris akan ditandai sudah benar`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Temuan yang diabaikan tetap tercatat beserta alasannya, dan akan muncul kembali pada periode berikutnya bila kondisinya masih sama.</span></div>
    <div class="field">
      <label class="fl" for="dtm-alasan2">Alasan diabaikan <span class="req">*</span></label>
      <input class="inp" id="dtm-alasan2" placeholder="Contoh: sudah sesuai, kelebihan potong periode lalu">
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="dtm-batal2">Batal</button>
      <button class="btn btn-primary" id="dtm-konfirm2">Abaikan ${n} baris</button>
    </div>`;
  openModal();
  $("#dtm-batal2").onclick = closeModal;
  $("#dtm-konfirm2").onclick = () => {
    const alasan = $("#dtm-alasan2").value.trim();
    if (!alasan) { toast("Alasan wajib diisi.", "bad"); $("#dtm-alasan2").focus(); return; }
    d.baris = d.baris.filter(b => !b.pilih);
    g.sisa  = d.baris.length;
    closeModal();
    toast(`${n} baris diabaikan dengan alasan tercatat.`);
    if (!d.baris.length) { renderDapemProses(); go("dapem-proses"); }
    else renderTemuanBody();
  };
}

function logEksekusi(tahapKode) {
  const t = dapemTahap.find(x => x.kode === tahapKode);
  const oto = DAPEM_OTOMATIS[tahapKode] || [];
  $("#modal-title").textContent = "Log Eksekusi";
  $("#modal-sub").textContent   = `Tahap ${t.no} · ${t.nama} — dapem ${dapemAktif.periode}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Seluruh langkah otomatis tercatat lengkap dengan parameter dan jumlah baris terpengaruh, sehingga hasilnya tetap bisa diperiksa tanpa membuka basis data.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Waktu</th><th>Langkah</th><th>Parameter</th><th>Baris</th><th>Oleh</th></tr></thead>
      <tbody>${oto.map((o, i) => `<tr>
        <td>16 Jun 2026 ${String(8 + i).padStart(2, "0")}:${String(12 + i * 7).padStart(2, "0")}</td>
        <td>${esc(o.nama)}</td><td style="color:var(--muted)">${esc(o.param)}</td>
        <td>${o.baris.toLocaleString("id-ID")}</td><td>Sistem</td></tr>`).join("")}</tbody>
    </table></div>`;
  openModal();
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  const buka = e.target.closest("[data-dapem-buka]");
  if (buka) {
    const [periode, jenis] = buka.dataset.dapemBuka.split("|");
    dapemAktif = { periode, jenis };
    dapemTab = (dapemTahap.find(t => t.status === "aktif") || dapemTahap[0]).kode;
    renderDapemProses();
    go("dapem-proses");
    return;
  }
  const tab = e.target.closest("[data-dp-tab]");
  if (tab) { dapemTab = tab.dataset.dpTab; renderDapemProses(); return; }

  const tinjau = e.target.closest("[data-dp-tinjau]");
  if (tinjau) { bukaTemuan(tinjau.dataset.dpTinjau); return; }

  const log = e.target.closest("[data-dp-log]");
  if (log) { logEksekusi(log.dataset.dpLog); return; }

  if (e.target.id === "dp-selesai") {
    const t = dapemTahap.find(x => x.kode === dapemTab);
    t.status = "selesai";
    const next = dapemTahap.find(x => x.no === t.no + 1);
    if (next) { next.status = "aktif"; dapemTab = next.kode; toast(`Tahap ${t.no} selesai. Tahap ${next.no} dibuka.`, "ok"); }
    else toast("Seluruh tahap selesai. Rekap III siap dicek Keuangan.", "ok");
    renderDapemProses();
    renderDapemMetrics();
    return;
  }
  if (e.target.id === "dapem-baru") { toast("Periode baru dibuat sebagai draft."); return; }
});

document.addEventListener("change", e => {
  const row = e.target.closest("[data-dtm-row]");
  if (row) {
    dapemTemuan[dapemGateAktif].baris[+row.dataset.dtmRow].pilih = row.checked;
    renderTemuanBody();
  }
});

["dapem-f-jenis", "dapem-f-status", "dapem-f-cari"].forEach(id => {
  const el = $("#" + id);
  if (el) el.addEventListener("input", renderDapemList);
});

/* ======================================================== PEMBENTUKAN NON DAPEM
   Sepuluh langkah F1.2.1–F1.2.10 dikelompokkan menjadi lima kartu berurutan.
   Kartu berikutnya baru terbuka setelah kartu sebelumnya bersih — di dokumen
   proses syarat ini tertulis tegas: "jika tidak ada selisih maka melanjutkan".
   Beda mendasar dengan dapem: di sini Pajak MENARIK sendiri datanya, bukan
   dikirimi berkas, sehingga TI hanya bisa menginformasikan lalu menunggu.     */

let nd = {
  selisih:      NONDAPEM_SELISIH.map(r => ({ ...r })),
  gate:         NONDAPEM_GATE.map(g => ({ ...g, sisa: g.temuan, catatan: "" })),
  temuan:       JSON.parse(JSON.stringify(NONDAPEM_TEMUAN)),
  hitung:       NONDAPEM_HITUNG.map(h => ({ ...h, selesai: false })),
  backup:       false,
  infoPajak:    false,
  balikan:      false,
  infoKeuangan: false
};
let ndGateAktif = null;

/* tone lajur ditulis lokal — JENIS_TONE baru dibuat di blok setelah ini */
const ND_TONE = {
  "dalam sistem":    "pill-info",
  "luar sistem":     "pill-warn",
  "luar organisasi": "pill-bad"
};

/* angka temuan disamakan dengan jumlah baris contoh yang tersedia, supaya
   kolom Temuan tidak pernah berbeda dengan isi tabelnya */
nd.gate.forEach(g => {
  if (g.kode === "N-01") { g.temuan = nd.selisih.length; g.sisa = nd.selisih.length; return; }
  const d = nd.temuan[g.kode];
  if (d) { g.temuan = d.baris.length; g.sisa = d.baris.length; }
});

/* ------------------------------------------------- keadaan tiap langkah */
const ndBersih = () => nd.gate.filter(g => g.kode !== "N-01").every(g => g.sisa === 0);

function ndLangkah() {
  if (nd.selisih.length)                                    return 1;  /* F1.2.1 · F1.2.2 */
  if (!ndBersih())                                          return 2;  /* F1.2.3          */
  if (!nd.backup || !nd.infoPajak)                          return 3;  /* F1.2.4 · F1.2.5 */
  if (!nd.balikan)                                          return 4;  /* F1.2.6 · F1.2.7 */
  if (!nd.hitung.every(h => h.selesai) || !nd.infoKeuangan)  return 5;  /* F1.2.8 · F1.2.9 */
  return 6;                                                            /* F1.2.10        */
}

const ND_JUDUL = ["", "Rekonsiliasi Ringkasan vs Rincian", "Kelengkapan Data",
                  "Backup & Penyerahan ke Bagian Pajak", "Validasi Bagian Pajak",
                  "Perhitungan Ulang & Penyerahan ke Keuangan"];

/* bola sedang di tangan siapa */
const ndLane = () => {
  const l = ndLangkah();
  return l <= 3 ? "ti" : l === 4 ? "pajak" : l === 5 ? "ti" : "keuangan";
};

/* ------------------------------------------------------------ layar utama */
function renderNondapem() {
  const p = NONDAPEM_PARAM;
  $("#nd-param").innerHTML = [
    ["Bulan Bayar Non Dapem",  p.blnbyr],
    ["Dibentuk Bersama Dapem", p.blnbyrDapem],
    ["Jenis Bayar",            p.jnsbyr]
  ].map(([l, v]) => `<div class="review-row"><div class="fl">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join("");
  $("#nd-param-note").textContent =
    `Bulan bayar non dapem selalu satu bulan di belakang dapem yang sedang dikerjakan — ${p.blnbyr} ditarik saat dapem ${p.blnbyrDapem} dibentuk. Hanya bulan bayar yang berubah tiap periode.`;

  const r = NONDAPEM_RINGKAS;
  $("#nd-metrics").innerHTML = [
    { l: "Jumlah Nopens",           v: r.nopens.toLocaleString("id-ID"),  c: "navy" },
    { l: "Pensiun Pertama (10)",    v: r.jenis10.toLocaleString("id-ID"), c: "" },
    { l: "Kekurangan Pensiun (11)", v: r.jenis11.toLocaleString("id-ID"), c: "" },
    { l: "Uang Duka Wafat (12)",    v: r.jenis12.toLocaleString("id-ID"), c: "" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  renderNdDemo();
  renderNdBanner();
  renderNdIsi();
}

/* kerangka kartu — nomor langkah + indeks proses supaya mudah dicocokkan
   dengan dokumen Business Process Non Dapem */
function ndKartu(no, judul, fidx, isi, terkunci) {
  return `<div class="card" style="margin-bottom:18px">
    <div class="head-row" style="margin-bottom:12px">
      <h3 class="card-title" style="margin:0">${no}. ${esc(judul)}</h3>
      <div class="head-divider"></div>
      <span class="pill pill-info">${esc(fidx)}</span>
      ${terkunci ? `<span class="pill pill-info" style="margin-left:auto">🔒 Terkunci</span>` : ""}
    </div>
    ${terkunci ? `<div class="alert alert-info"><span>🔒</span><span>Langkah ini terbuka setelah langkah sebelumnya bersih. Isinya ditampilkan sebagai pratinjau — belum dijalankan.</span></div>` : ""}
    ${isi}
  </div>`;
}

function renderNdIsi() {
  $("#nd-isi").innerHTML = [ndKartu1(), ndKartu2(), ndKartu3(), ndKartu4(), ndKartu5()].join("");
}

/* ------------------------------------------- 1. rekonsiliasi (F1.2.1 · F1.2.2) */
function ndKartu1() {
  const n = nd.selisih.filter(r => r.pilih).length;
  const isi = `
    <div class="alert alert-info"><span>ⓘ</span><span>Membandingkan <b>AP3_TBL_YAR_ALL</b> (ringkasan) dengan <b>yan_yar_all_detil</b> (rincian) untuk jenis bayar 11. Hanya baris yang berselisih yang ditampilkan — sebelumnya dua tabel ini ditarik lalu dicocokkan di Excel.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th style="width:34px"></th><th>Nopens</th><th>Nama</th><th>Jenis Bayar</th>
        <th>Bruto Ringkasan</th><th>Bruto Rincian</th><th>Selisih</th><th>Dugaan Sebab</th></tr></thead>
      <tbody>${nd.selisih.length ? nd.selisih.map((r, i) => `<tr>
        <td><input type="checkbox" data-nd-row="${i}" ${r.pilih ? "checked" : ""}></td>
        <td><b>${esc(r.nopens)}</b></td><td>${esc(r.nama)}</td><td>${esc(r.jenis)}</td>
        <td>${esc(r.ringkasan)}</td>
        <td>${r.rincianKosong ? `<span style="color:var(--red)">tidak ada rincian</span>` : esc(r.rincian)}</td>
        <td>${esc(r.selisih ?? "—")}</td>
        <td style="color:var(--muted)">${esc(r.sebab)}</td></tr>`).join("")
      : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada selisih</h4><p>Ringkasan dan rincian sudah sama untuk seluruh nopens.</p></div></td></tr>`}
      </tbody>
    </table></div>
    ${nd.selisih.length ? `
      <div class="tbl-note"><b>${n}</b> dari ${nd.selisih.length} baris terpilih. Baris yang tidak dicentang dianggap sudah benar.</div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="nd-abaikan" ${n ? "" : "disabled"}>Abaikan terpilih…</button>
        <button class="btn btn-primary" id="nd-samakan" ${n ? "" : "disabled"}>Samakan nomor pengajuan</button>
      </div>` : ""}`;
  return ndKartu(1, ND_JUDUL[1], "F1.2.1 · F1.2.2", isi, false);
}

/* ---------------------------------------- 2. kelengkapan data (F1.2.3) */
function ndKartu2() {
  const kunci = nd.selisih.length > 0;
  const isi = `
    <div class="tbl-wrap"><table>
      <thead><tr><th style="width:76px">Kode</th><th>Pemeriksaan</th><th style="width:82px">Temuan</th>
        <th style="width:168px">Status</th><th style="width:96px">Aksi</th></tr></thead>
      <tbody>${nd.gate.map(g => ndBarisGate(g, kunci)).join("")}</tbody>
    </table></div>
    <div class="tbl-note" style="text-align:left">N-01 mengikuti sisa selisih pada langkah 1. N-02 dan N-03 bersih pada periode ini, jadi tidak punya rincian untuk ditinjau.</div>`;
  return ndKartu(2, ND_JUDUL[2], "F1.2.3", isi, kunci);
}

function ndBarisGate(g, kunci) {
  const st = kunci      ? { pill: "pill-info", teks: "● Belum dijalankan" }
           : g.catatan  ? { pill: "pill-info", teks: "Diabaikan" }
           : g.sisa > 0 ? { pill: "pill-warn", teks: "⚠ Perlu tindakan" }
                        : { pill: "pill-ok",   teks: "✓ Bersih" };
  const bisa = !kunci && g.sisa > 0 && nd.temuan[g.kode];
  return `<tr>
    <td><b>${esc(g.kode)}</b></td>
    <td>
      <div>${esc(g.nama)}
        <span class="pill ${g.sev === "tinggi" ? "pill-bad" : "pill-info"}" style="margin-left:6px">${esc(g.sev)}</span>
      </div>
      <div style="color:var(--muted);font-size:11px;margin-top:3px">${esc(g.param)}</div>
    </td>
    <td>${kunci ? "—" : `<b>${g.sisa || 0}</b>`}</td>
    <td><span class="pill ${st.pill}">${esc(st.teks)}</span></td>
    <td>${bisa ? `<button class="btn btn-info btn-sm" data-nd-gate="${esc(g.kode)}">Tinjau</button>`
               : `<button class="btn btn-ghost btn-sm" disabled>Tinjau</button>`}</td>
  </tr>`;
}

/* -------------------------------- 3. backup & serah ke pajak (F1.2.4 · F1.2.5) */
function ndKartu3() {
  const kunci = nd.selisih.length > 0 || !ndBersih();
  const b = NONDAPEM_BACKUP;
  const isi = `
    <div class="alert alert-warn"><span>⚠</span><span>Backup tidak tercantum sebagai kotak keputusan di bagan proses, tetapi wajib dikerjakan sebelum data diserahkan ke Pajak — begitu PPh diperbarui, nilai lamanya hanya ada di salinan ini.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th style="width:64px">Urutan</th><th>Langkah</th><th>Keterangan</th>
        <th style="width:110px">Baris</th><th style="width:120px">Status</th><th style="width:130px">Aksi</th></tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Backup data non dapem ke DB Dev</td>
          <td style="color:var(--muted)">${esc(b.sumber)} → ${esc(b.tujuan)}
            <div style="font-family:ui-monospace,monospace;font-size:11px;margin-top:3px">${esc(b.param)}</div></td>
          <td>${nd.backup ? b.baris.toLocaleString("id-ID") : "—"}</td>
          <td><span class="pill ${nd.backup ? "pill-ok" : "pill-info"}">${nd.backup ? "✓ Selesai" : "Belum"}</span></td>
          <td>${nd.backup ? `<button class="btn btn-ghost btn-sm" disabled>Selesai</button>`
                          : `<button class="btn btn-info btn-sm" id="nd-backup" ${kunci ? "disabled" : ""}>Jalankan</button>`}</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Informasikan ke Bagian Pajak</td>
          <td style="color:var(--muted)">Pajak menarik sendiri datanya dari ${esc(NONDAPEM_PUTARAN.sumber)}</td>
          <td>—</td>
          <td><span class="pill ${nd.infoPajak ? "pill-ok" : "pill-info"}">${nd.infoPajak ? "✓ Sudah" : "Belum"}</span></td>
          <td>${nd.infoPajak ? `<button class="btn btn-ghost btn-sm" disabled>Sudah</button>`
                             : `<button class="btn btn-info btn-sm" id="nd-info-pajak" ${nd.backup && !kunci ? "" : "disabled"}>Informasikan</button>`}</td>
        </tr>
      </tbody>
    </table></div>`;
  return ndKartu(3, ND_JUDUL[3], "F1.2.4 · F1.2.5", isi, kunci);
}

/* ------------------------------------ 4. validasi pajak (F1.2.6 · F1.2.7) */
function ndKartu4() {
  const kunci = !nd.infoPajak;
  const P = NONDAPEM_PUTARAN;
  const isi = `
    <div class="alert alert-info"><span>ⓘ</span><span>Pada non dapem, Bagian Pajak <b>menarik sendiri</b> datanya — tidak ada berkas yang dikirim dari sini. Yang bisa dilakukan hanya menginformasikan lalu menunggu balikan, dan itu berjalan di luar sistem.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Putaran</th><th>Diinfokan</th><th>Oleh</th><th>Sumber Tarikan Pajak</th>
        <th>Balikan Diterima</th><th>Berkas Balikan</th><th>Hasil</th><th>Status</th></tr></thead>
      <tbody>${kunci
        ? `<tr><td colspan="8"><div class="empty"><h4>Belum ada putaran</h4><p>Putaran tercatat setelah Bagian Pajak diinformasikan pada langkah 3.</p></div></td></tr>`
        : `<tr>
            <td><b>${P.putaran}</b></td><td>${esc(P.info)}</td><td>${esc(P.oleh)}</td>
            <td style="color:var(--muted)">${esc(P.sumber)}</td>
            <td>${nd.balikan ? esc(P.balas) : "—"}</td>
            <td>${nd.balikan ? `<span style="font-family:ui-monospace,monospace;font-size:11.5px">${esc(P.berkas)}</span>` : "—"}</td>
            <td>${nd.balikan ? esc(P.hasil) : "Menunggu balasan"}</td>
            <td><span class="pill ${nd.balikan ? "pill-ok" : "pill-warn"}">${nd.balikan ? "Selesai" : "Menunggu"}</span></td>
          </tr>`}
      </tbody>
    </table></div>
    ${nd.balikan ? `<div class="tbl-note" style="text-align:left">Balikan diunggah ke tabel <b>${esc(P.tabel)}</b> — nama tabel ikut berubah tiap periode. Nama kolom pada berkas balikan sering berbeda, jadi dicocokkan ulang setiap putaran.</div>` : ""}
    <div class="form-actions">
      <button class="btn btn-primary" data-nd-unggah="1" ${!kunci && !nd.balikan ? "" : "disabled"}>⬆ Unggah Balikan Pajak</button>
    </div>`;
  return ndKartu(4, ND_JUDUL[4], "F1.2.6 · F1.2.7", isi, kunci);
}

/* --------------------------- 5. perhitungan ulang & keuangan (F1.2.8 · F1.2.9) */
function ndKartu5() {
  const kunci = !nd.balikan;
  const semua = nd.hitung.every(h => h.selesai);
  const isi = `
    <div class="alert alert-info"><span>ⓘ</span><span>Lima perhitungan berurutan — satu perubahan PPh merambat ke potongan, tunjangan lain, bruto, lalu pembulatan. Langkah 1–3 hanya jenis bayar 10 dan 11; uang duka wafat (12) tidak dikenakan PPh, tetapi tetap ikut pada langkah 4 dan 5.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th style="width:64px">Urutan</th><th>Langkah</th><th>Rumus</th>
        <th style="width:130px">Parameter</th><th style="width:100px">Baris</th>
        <th style="width:120px">Status</th><th style="width:110px">Aksi</th></tr></thead>
      <tbody>${nd.hitung.map((h, i) => {
        const siap = i === 0 || nd.hitung[i - 1].selesai;
        return `<tr>
          <td>${h.urut}</td><td>${esc(h.nama)}</td>
          <td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--muted)">${esc(h.rumus)}</td>
          <td style="color:var(--muted)">${esc(h.param)}</td>
          <td>${h.selesai ? h.baris.toLocaleString("id-ID") : "—"}</td>
          <td><span class="pill ${h.selesai ? "pill-ok" : "pill-info"}">${h.selesai ? "✓ Selesai" : "Belum"}</span></td>
          <td>${h.selesai ? `<button class="btn btn-ghost btn-sm" disabled>Selesai</button>`
                          : `<button class="btn btn-info btn-sm" data-nd-hitung="${i}" ${siap && !kunci ? "" : "disabled"}>Jalankan</button>`}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="nd-rekap" ${semua && !nd.infoKeuangan && !kunci ? "" : "disabled"}>
        Informasikan ke Keuangan bahwa Rekap III Non Dapem siap
      </button>
    </div>
    ${nd.infoKeuangan ? `<div class="tbl-note">Keuangan sudah diberi tahu — Rekap III dapat dicetak dari menu <b>Rekap III Non Dapem</b>.</div>` : ""}`;
  return ndKartu(5, ND_JUDUL[5], "F1.2.8 · F1.2.9", isi, kunci);
}

/* -------------------------------------------------------------- banner lajur */
function renderNdBanner() {
  const slot = $("#nd-banner");
  if (!slot) return;
  const l = ndLangkah(), lane = ndLane();
  const selesai = lane === "keuangan" ? ["ti", "pajak"] : nd.balikan ? ["pajak"] : [];
  const info  = NONDAPEM_LANE.find(x => x.kode === lane);
  const strip = stripLane(lane, selesai, NONDAPEM_LANE);
  const P = NONDAPEM_PUTARAN;

  if (l === 6) {
    slot.innerHTML = strip + `<div class="alert alert-ok" style="margin-bottom:18px"><span>✓</span><span>Seluruh langkah selesai. Rekap III Non Dapem siap dicetak Div. Keuangan.</span></div>`;
    return;
  }
  if (lane === "ti") {
    slot.innerHTML = strip + `
      <div class="alert alert-ok" style="margin-bottom:18px">
        <span>⚑</span><span><b>Giliran Anda</b> — Langkah ${l} dari 5: ${esc(ND_JUDUL[l])}.</span>
      </div>`;
    return;
  }
  slot.innerHTML = strip + `
    <div class="card" style="margin-bottom:18px;border-left:3px solid var(--amber)">
      <div class="head-row" style="margin-bottom:0">
        <div>
          <div style="font-size:14px;font-weight:800;color:var(--ink)">
            ⏳ Menunggu Bagian Pajak — ${esc(P.lama)}
            <span class="pill ${ND_TONE[info.jenis]}" style="margin-left:8px">${esc(info.jenis)}</span>
          </div>
          <div class="page-sub" style="margin-top:4px">
            Diinfokan ${esc(P.info)} oleh ${esc(P.oleh)} · Pajak menarik sendiri dari ${esc(P.sumber)}
          </div>
          <div class="tbl-note" style="text-align:left;margin-top:6px">Penyerahan dan balikan berjalan lewat email, di luar sistem.</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:9px">
          <button class="btn btn-ghost btn-sm" id="nd-ingatkan">Ingatkan</button>
          <button class="btn btn-primary btn-sm" data-nd-unggah="1">⬆ Unggah Balikan Pajak</button>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ tinjau temuan */
function bukaTemuanNd(kode) {
  const d = nd.temuan[kode];
  if (!d) { toast(`Rincian ${kode} tidak tersedia pada periode ini.`, "bad"); return; }
  ndGateAktif = kode;
  const g = nd.gate.find(x => x.kode === kode);
  $("#ndt-judul").textContent = `${g.kode} · ${g.nama}`;
  $("#ndt-sub").textContent   = `Non Dapem ${NONDAPEM_PARAM.blnbyr} — ${d.baris.length} temuan`;
  $("#ndt-aturan").lastElementChild.textContent = d.aturan;
  $("#ndt-param").textContent = "Parameter: " + g.param;
  $("#ndt-terapkan").textContent = d.aksi;
  $("#ndt-head").innerHTML = `<th style="width:34px"></th>` + d.kolom.map(k => `<th>${esc(k)}</th>`).join("");
  renderNdTemuanBody();
  go("non-dapem-temuan");
}

function renderNdTemuanBody() {
  const d = nd.temuan[ndGateAktif];
  $("#ndt-body").innerHTML = d.baris.map((b, i) => `
    <tr>
      <td><input type="checkbox" data-ndt-row="${i}" ${b.pilih ? "checked" : ""}></td>
      ${b.sel.map((v, j) => `<td>${j === 0 ? `<b>${esc(v)}</b>` : esc(v)}</td>`).join("")}
    </tr>`).join("");
  const n = d.baris.filter(b => b.pilih).length;
  $("#ndt-note").innerHTML = `<b>${n}</b> dari ${d.baris.length} baris terpilih. Baris yang tidak dicentang dianggap sudah benar dan tidak akan diubah.`;
  $("#ndt-terapkan").disabled = n === 0;
}

/* dampaknya dihitung dari angka baris itu sendiri, bukan contoh tetap */
const ndAngka = t => +String(t).replace(/\./g, "") || 0;

function ndPratinjauDampak() {
  const d = nd.temuan[ndGateAktif];
  const g = nd.gate.find(x => x.kode === ndGateAktif);
  const n = d.baris.filter(b => b.pilih).length;
  const c = d.baris.find(b => b.pilih);
  const bruto = ndAngka(c.sel[3]), pph = ndAngka(c.sel[4]);
  const f = v => v.toLocaleString("id-ID");
  const dampak = [
    ["POT_PPH21",       f(pph),         "0"],
    ["Jumlah potongan", f(pph),         "0"],
    ["Jumlah bruto",    f(bruto),       f(bruto)],
    ["Jumlah netto",    f(bruto - pph), f(bruto)]
  ];
  $("#modal-title").textContent = d.aksi;
  $("#modal-sub").textContent   = `${g.kode} · ${n} baris akan diubah pada non dapem ${NONDAPEM_PARAM.blnbyr}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Menolkan PPh ikut mengubah jumlah potongan dan netto. Berikut dampaknya pada baris pertama yang terpilih.</span></div>
    <div class="subsection-title">CONTOH DAMPAK — ${esc(c.sel[0])} · ${esc(c.sel[1])}</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
      <tbody>${dampak.map(([k, a, b]) => `<tr><td>${esc(k)}</td>
        <td style="color:var(--muted)">${esc(a)}</td><td><b>${esc(b)}</b></td></tr>`).join("")}</tbody>
    </table></div>
    <div class="field" style="margin-top:16px">
      <label class="fl" for="ndt-alasan">Alasan / nomor tiket <span class="req">*</span></label>
      <input class="inp" id="ndt-alasan" placeholder="Contoh: konfirmasi Bagian Pajak 03 Jul 2026 / #24019">
      <div class="hint">Alasan tersimpan bersama nilai lama, sehingga koreksi bisa ditelusuri kembali.</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="ndt-batal">Batal</button>
      <button class="btn btn-primary" id="ndt-konfirm">Terapkan ke ${n} baris</button>
    </div>`;
  openModal();
  $("#ndt-batal").onclick = closeModal;
  $("#ndt-konfirm").onclick = () => {
    if (!$("#ndt-alasan").value.trim()) { toast("Alasan wajib diisi.", "bad"); $("#ndt-alasan").focus(); return; }
    d.baris = d.baris.filter(b => !b.pilih);
    g.sisa  = d.baris.length;
    closeModal();
    toast(`${n} baris diperbaiki pada ${g.kode}.`, "ok");
    if (!d.baris.length) { renderNondapem(); go("non-dapem"); } else renderNdTemuanBody();
  };
}

function ndAbaikanTemuan() {
  const d = nd.temuan[ndGateAktif];
  const g = nd.gate.find(x => x.kode === ndGateAktif);
  const n = d.baris.filter(b => b.pilih).length;
  if (!n) { toast("Belum ada baris yang dipilih.", "bad"); return; }
  $("#modal-title").textContent = "Abaikan temuan";
  $("#modal-sub").textContent   = `${g.kode} · ${n} baris akan ditandai sudah benar`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Temuan yang diabaikan tetap tercatat beserta alasannya, dan akan muncul kembali pada periode berikutnya bila kondisinya masih sama.</span></div>
    <div class="field">
      <label class="fl" for="ndt-alasan2">Alasan diabaikan <span class="req">*</span></label>
      <input class="inp" id="ndt-alasan2" placeholder="Contoh: sudah dikoreksi lewat pengajuan terpisah">
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="ndt-batal2">Batal</button>
      <button class="btn btn-primary" id="ndt-konfirm2">Abaikan ${n} baris</button>
    </div>`;
  openModal();
  $("#ndt-batal2").onclick = closeModal;
  $("#ndt-konfirm2").onclick = () => {
    if (!$("#ndt-alasan2").value.trim()) { toast("Alasan wajib diisi.", "bad"); $("#ndt-alasan2").focus(); return; }
    d.baris = d.baris.filter(b => !b.pilih);
    g.sisa  = d.baris.length;
    closeModal();
    toast(`${n} baris diabaikan dengan alasan tercatat.`);
    if (!d.baris.length) { renderNondapem(); go("non-dapem"); } else renderNdTemuanBody();
  };
}

/* rekonsiliasi langkah 1 — pola sama, tapi datanya baris selisih */
function ndAbaikanSelisih() {
  const n = nd.selisih.filter(r => r.pilih).length;
  $("#modal-title").textContent = "Abaikan selisih";
  $("#modal-sub").textContent   = `${n} baris akan ditandai sudah benar`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Selisih yang diabaikan tetap tercatat beserta alasannya, dan akan muncul kembali bulan berikutnya bila kondisinya masih sama.</span></div>
    <div class="field">
      <label class="fl" for="nd-alasan">Alasan diabaikan <span class="req">*</span></label>
      <input class="inp" id="nd-alasan" placeholder="Contoh: PP dan UKP diajukan bersamaan, sudah diverifikasi lewat KTPA">
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="nd-alasan-batal">Batal</button>
      <button class="btn btn-primary" id="nd-alasan-ok">Abaikan ${n} baris</button>
    </div>`;
  openModal();
  $("#nd-alasan-batal").onclick = closeModal;
  $("#nd-alasan-ok").onclick = () => {
    if (!$("#nd-alasan").value.trim()) { toast("Alasan wajib diisi.", "bad"); $("#nd-alasan").focus(); return; }
    nd.selisih = nd.selisih.filter(r => !r.pilih);
    nd.gate[0].sisa = nd.selisih.length;
    closeModal();
    renderNondapem();
    toast(`${n} baris diabaikan dengan alasan tercatat.`);
  };
}

/* ---------------------------------------------------------------- log eksekusi */
function ndLog() {
  const baris = [];
  if (nd.backup) baris.push(["Backup data non dapem ke DB Dev", NONDAPEM_BACKUP.param, NONDAPEM_BACKUP.baris]);
  nd.hitung.filter(h => h.selesai).forEach(h => baris.push([h.nama, h.param, h.baris]));
  $("#modal-title").textContent = "Log Eksekusi";
  $("#modal-sub").textContent   = `Non Dapem ${NONDAPEM_PARAM.blnbyr} — langkah yang dijalankan sistem`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Hanya langkah tanpa keputusan yang tercatat di sini, lengkap dengan parameter dan jumlah baris terpengaruh, sehingga hasilnya tetap bisa diperiksa tanpa membuka basis data.</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Waktu</th><th>Langkah</th><th>Parameter</th><th>Baris</th><th>Oleh</th></tr></thead>
      <tbody>${baris.length ? baris.map(([n, pr, b], i) => `<tr>
        <td>03 Jul 2026 ${String(9 + i).padStart(2, "0")}:${String(15 + i * 6).padStart(2, "0")}</td>
        <td>${esc(n)}</td><td style="color:var(--muted)">${esc(pr)}</td>
        <td>${b.toLocaleString("id-ID")}</td><td>Sistem</td></tr>`).join("")
      : `<tr><td colspan="5"><div class="empty"><h4>Belum ada langkah otomatis</h4><p>Log terisi setelah backup dan perhitungan ulang dijalankan.</p></div></td></tr>`}
      </tbody>
    </table></div>`;
  openModal();
}

/* --------------------------------------------------- Rekap III — sisi Keuangan */
function renderNdKeuangan() {
  if (!$("#ndk-body")) return;
  const p = NONDAPEM_PARAM;
  $("#ndk-sub").textContent =
    `Non Dapem ${p.blnbyr} · jenis bayar ${p.jnsbyr} — dibentuk bersama dapem ${p.blnbyrDapem}.`;
  $("#ndk-banner").innerHTML = nd.infoKeuangan
    ? `<div class="alert alert-ok" style="margin-bottom:18px"><span>⚑</span><span><b>Giliran Anda</b> — TI Manajemen Data menyatakan Rekap III Non Dapem ${esc(p.blnbyr)} sudah bisa dicek dan dicetak.</span></div>`
    : `<div class="alert alert-info" style="margin-bottom:18px"><span>⏳</span><span>Rekap III Non Dapem belum tersedia. Menunggu TI Manajemen Data menyelesaikan perhitungan ulang setelah balikan Bagian Pajak.</span></div>`;

  const tot = NONDAPEM_REKAP_MAK.reduce((a, r) => ({
    bruto: a.bruto + r.bruto, netto: a.netto + r.netto
  }), { bruto: 0, netto: 0 });

  $("#ndk-metrics").innerHTML = [
    { l: "Bulan Bayar",   v: p.blnbyr,                    c: "navy" },
    { l: "Mata Anggaran", v: NONDAPEM_REKAP_MAK.length,   c: "" },
    { l: "Total Bruto",   v: miliar(tot.bruto),           c: "" },
    { l: "Total Netto",   v: miliar(tot.netto),           c: nd.infoKeuangan ? "ok" : "" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  $("#ndk-body").innerHTML = NONDAPEM_REKAP_MAK.map(r => `<tr>
    <td><b>${esc(r.mak)}</b></td><td>${esc(r.uraian)}</td>
    <td>${r.jumlah.toLocaleString("id-ID")}</td>
    <td>${miliar(r.bruto)}</td><td>${miliar(r.netto)}</td>
  </tr>`).join("");
  /* jumlah nopens TIDAK dijumlahkan antar mata anggaran — satu peserta bisa
     muncul di beberapa MAK sekaligus, sehingga totalnya akan menyesatkan */
  $("#ndk-total").innerHTML = `<td colspan="2">TOTAL</td>
    <td style="color:var(--muted);font-weight:600">—</td>
    <td>${miliar(tot.bruto)}</td><td>${miliar(tot.netto)}</td>`;
  $("#ndk-cetak").disabled = !nd.infoKeuangan;
}

/* ------------------------------------------------------- bar kendali peragaan */
function renderNdDemo() {
  const slot = $("#nd-demo");
  if (!slot) return;
  const l = ndLangkah();
  slot.innerHTML = `
    <div style="border:1.5px dashed var(--line); border-radius:12px; padding:12px 16px;
                margin-bottom:18px; background:var(--field); display:flex; align-items:center;
                gap:12px; flex-wrap:wrap">
      <span class="pill pill-info">PERAGAAN</span>
      <span style="font-size:11.5px;font-weight:700;color:var(--muted)">Lompat ke langkah</span>
      ${[1, 2, 3, 4, 5].map(n => `
        <button class="btn btn-sm ${n === l ? "btn-primary" : "btn-ghost"}" data-nd-demo="${n}">${n}</button>`).join("")}
      <button class="btn btn-sm ${l === 6 ? "btn-primary" : "btn-ghost"}" data-nd-demo="6">Selesai</button>
      <span style="margin-left:auto">
        <button class="btn btn-ghost btn-sm" data-nd-demo="0">Ulang dari awal</button>
      </span>
    </div>`;
}

/* pindahkan run ke langkah tertentu: langkah sebelumnya dianggap beres */
function ndKeLangkah(n) {
  nd.selisih = n > 1 ? [] : NONDAPEM_SELISIH.map(r => ({ ...r }));
  nd.temuan  = JSON.parse(JSON.stringify(NONDAPEM_TEMUAN));
  nd.gate.forEach(g => {
    g.catatan = "";
    if (g.kode === "N-01") { g.sisa = nd.selisih.length; return; }
    const d = nd.temuan[g.kode];
    if (n > 2) { if (d) d.baris = []; g.sisa = 0; }
    else       { g.sisa = d ? d.baris.length : 0; }
  });
  nd.backup       = n > 3;
  nd.infoPajak    = n > 3;
  nd.balikan      = n > 4;
  nd.hitung.forEach(h => h.selesai = n > 5);
  nd.infoKeuangan = n > 5;
  renderNondapem();
  renderNdKeuangan();
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  if (e.target.id === "nd-samakan") {
    const n = nd.selisih.filter(r => r.pilih).length;
    nd.selisih = nd.selisih.filter(r => !r.pilih);
    nd.gate[0].sisa = nd.selisih.length;
    renderNondapem();
    toast(`${n} baris disamakan nomor pengajuannya (yya_id).`, "ok");
    return;
  }
  if (e.target.id === "nd-abaikan")    { ndAbaikanSelisih(); return; }
  if (e.target.id === "nd-backup") {
    nd.backup = true; renderNondapem();
    toast(`Backup selesai — ${NONDAPEM_BACKUP.baris.toLocaleString("id-ID")} baris disalin ke DB Dev.`, "ok");
    return;
  }
  if (e.target.id === "nd-info-pajak") {
    nd.infoPajak = true; renderNondapem();
    toast("Bagian Pajak diberi tahu bahwa Non Dapem sudah bisa ditarik.", "ok");
    return;
  }
  if (e.target.id === "nd-ingatkan")   { toast("Pengingat dikirim ke Bagian Pajak."); return; }
  if (e.target.id === "nd-rekap") {
    nd.infoKeuangan = true; renderNondapem(); renderNdKeuangan();
    toast("Div. Keuangan diberi tahu bahwa Rekap III Non Dapem sudah bisa dicek.", "ok");
    return;
  }
  if (e.target.id === "nd-log")   { ndLog(); return; }
  if (e.target.id === "ndk-cetak") { toast("Rekap III Non Dapem dicetak.", "ok"); return; }

  const unggah = e.target.closest("[data-nd-unggah]");
  if (unggah) {
    nd.balikan = true; renderNondapem();
    toast(`Balikan ${NONDAPEM_PUTARAN.berkas} diunggah ke ${NONDAPEM_PUTARAN.tabel}.`, "ok");
    return;
  }
  const g = e.target.closest("[data-nd-gate]");
  if (g) { bukaTemuanNd(g.dataset.ndGate); return; }

  const h = e.target.closest("[data-nd-hitung]");
  if (h) {
    const l = nd.hitung[+h.dataset.ndHitung];
    l.selesai = true;
    renderNondapem();
    toast(`${l.nama} — ${l.baris.toLocaleString("id-ID")} baris disesuaikan.`, "ok");
    return;
  }
  const demo = e.target.closest("[data-nd-demo]");
  if (demo) {
    const n = +demo.dataset.ndDemo;
    ndKeLangkah(n === 0 ? 1 : n);
    toast(n === 0 ? "Peragaan dikembalikan ke kondisi awal."
                  : n === 6 ? "Peragaan dipindahkan ke kondisi selesai."
                            : `Peragaan dipindahkan ke Langkah ${n}.`);
    return;
  }
});

document.addEventListener("change", e => {
  const row = e.target.closest("[data-nd-row]");
  if (row) { nd.selisih[+row.dataset.ndRow].pilih = row.checked; renderNdIsi(); return; }
  const trow = e.target.closest("[data-ndt-row]");
  if (trow) { nd.temuan[ndGateAktif].baris[+trow.dataset.ndtRow].pilih = trow.checked; renderNdTemuanBody(); }
});

$("#ndt-all").onclick  = () => { nd.temuan[ndGateAktif].baris.forEach(b => b.pilih = true);  renderNdTemuanBody(); };
$("#ndt-none").onclick = () => { nd.temuan[ndGateAktif].baris.forEach(b => b.pilih = false); renderNdTemuanBody(); };
$("#ndt-terapkan").onclick = ndPratinjauDampak;
$("#ndt-abaikan").onclick  = ndAbaikanTemuan;

$("#dtm-all").onclick  = () => { dapemTemuan[dapemGateAktif].baris.forEach(b => b.pilih = true);  renderTemuanBody(); };
$("#dtm-none").onclick = () => { dapemTemuan[dapemGateAktif].baris.forEach(b => b.pilih = false); renderTemuanBody(); };
$("#dtm-terapkan").onclick = pratinjauDampak;
$("#dtm-abaikan").onclick  = abaikanTemuan;

renderDapemMetrics();
renderDapemList();
renderNondapem();

/* ==================================================== LINTAS UNIT & VALIDASI
   Menjawab satu pertanyaan tanpa perlu diklik: bola sedang di tangan siapa. */

/* jumlah temuan disamakan dengan contoh baris yang tersedia, supaya angka di
   daftar pemeriksaan tidak berbeda dengan isi tabelnya */
dapemGate.forEach(g => {
  const d = dapemTemuan[g.kode];
  if (d) { g.temuan = d.baris.length; g.sisa = d.baris.length; }
});

let validasiKep = {};          // "K-01:0" → { putusan, catatan }
let validasiKepTerkirim = false;

let laneTahap = kode => DAPEM_TAHAP_LANE[kode];
const JENIS_TONE = {
  "dalam sistem":    "pill-info",
  "luar sistem":     "pill-warn",
  "luar organisasi": "pill-bad"
};

/* strip lajur aktor — versi hidup dari bagan proses yang sudah mereka kenal */
function stripLane(laneAktif, selesai, lanes = DAPEM_LANE) {
  return `<div class="stepper stepper-pill" style="margin-bottom:14px">
    ${lanes.map(l => {
      const kelas = l.kode === laneAktif ? "step active"
                  : selesai.includes(l.kode) ? "step done" : "step";
      return `<div class="${kelas}" style="cursor:default">
        <div>${esc(l.nama)}${l.kode === laneAktif ? " ◉" : selesai.includes(l.kode) ? " ✓" : ""}</div>
        <div style="font-size:9.5px;font-weight:700;opacity:.75;margin-top:2px">${esc(l.jenis)}</div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderBannerTahap() {
  const t    = dapemTahap.find(x => x.status === "aktif");
  const slot = $("#dp-banner");
  if (!slot) return;
  if (!t) { slot.innerHTML = `<div class="alert alert-ok"><span>✓</span><span>Seluruh tahap selesai. Rekap III siap dicek Keuangan.</span></div>`; return; }

  const lane    = laneTahap(t.kode);
  const info    = DAPEM_LANE.find(l => l.kode === lane);
  const selesai = dapemTahap.filter(x => x.status === "selesai").map(x => laneTahap(x.kode));
  const tunggu  = DAPEM_MENUNGGU[t.kode];
  const perlu   = dapemGate.filter(g => g.tahap === t.kode && g.sisa > 0).length;

  /* giliran sendiri — pekerjaan ada di tangan pengguna layar ini */
  if (lane === "ti") {
    slot.innerHTML = stripLane(lane, selesai) + `
      <div class="alert alert-ok" style="margin-bottom:18px">
        <span>⚑</span>
        <span><b>Giliran Anda</b> — Tahap ${t.no} ${esc(t.nama)}.
        ${perlu ? `${perlu} pemeriksaan perlu diputuskan sebelum tahap ini bisa ditutup.`
                : "Seluruh pemeriksaan bersih, tahap siap ditutup."}</span>
      </div>`;
    return;
  }

  /* menunggu pihak lain — yang menunggu manusia, bukan sistem */
  const aksi = tunggu && tunggu.aksi === "buka"
    ? `<button class="btn btn-primary btn-sm" data-go="${esc(tunggu.tujuan)}">${esc(tunggu.aksiLabel)}</button>`
    : tunggu ? `<button class="btn btn-primary btn-sm" data-dp-unggah="${esc(t.kode)}">${esc(tunggu.aksiLabel)}</button>` : "";

  slot.innerHTML = stripLane(lane, selesai) + `
    <div class="card" style="margin-bottom:18px;border-left:3px solid var(--amber)">
      <div class="head-row" style="margin-bottom:0">
        <div>
          <div style="font-size:14px;font-weight:800;color:var(--ink)">
            ⏳ Menunggu ${esc(t.aktor)} — ${esc(tunggu ? tunggu.lama : "—")}
            <span class="pill ${JENIS_TONE[info.jenis]}" style="margin-left:8px">${esc(info.jenis)}</span>
          </div>
          <div class="page-sub" style="margin-top:4px">
            ${tunggu ? `Dikirim ${esc(tunggu.sejak)} oleh ${esc(tunggu.oleh)} · ${esc(tunggu.rincian)}` : ""}
          </div>
          ${info.jenis === "luar organisasi"
            ? `<div class="tbl-note" style="text-align:left;margin-top:6px">Pengiriman dan balasan dilakukan di luar sistem melalui SharePoint Validasi SIPP.</div>` : ""}
        </div>
        <div style="margin-left:auto;display:flex;gap:9px">
          <button class="btn btn-ghost btn-sm" data-dp-ingatkan="${esc(t.kode)}">Ingatkan</button>
          ${aksi}
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------- layar validasi sisi Kepesertaan */
function renderValidasiKep() {
  const v = DAPEM_VALIDASI_KEP;
  const gates = dapemGate.filter(g => g.tahap === "kepesertaan" && dapemTemuan[g.kode]);
  const total = gates.reduce((a, g) => a + dapemTemuan[g.kode].baris.length, 0);
  const sudah = Object.keys(validasiKep).length;

  $("#dv-sub").textContent = `Dapem ${v.jenis} · ${v.periode} — dikirim ${v.dikirim} oleh ${v.oleh}`;
  $("#dv-pengantar").lastElementChild.textContent = v.pengantar;

  $("#dv-banner").innerHTML = validasiKepTerkirim
    ? `<div class="alert alert-ok" style="margin-bottom:18px"><span>✓</span><span><b>Hasil validasi sudah dikirim</b> ke TI Manajemen Data. Menunggu perbaikan dari sisi TI.</span></div>`
    : `<div class="alert alert-warn" style="margin-bottom:18px"><span>⚑</span><span><b>Giliran Anda</b> — ${total} baris perlu diperiksa. Batas waktu ${esc(v.batas)}.</span></div>`;

  $("#dv-metrics").innerHTML = [
    { l: "Periode", v: `${v.periode} · ${v.jenis}`, c: "navy" },
    { l: "Perlu Diperiksa", v: `${sudah} / ${total}`, c: sudah === total ? "ok" : "" },
    { l: "Batas Waktu", v: v.batas, c: "" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  $("#dv-isi").innerHTML = gates.map(g => {
    const d = dapemTemuan[g.kode];
    return `<div class="card" style="margin-bottom:18px">
      <h3 class="card-title">${esc(g.kode)} · ${esc(g.nama)}</h3>
      <div class="alert alert-info"><span>ⓘ</span><span>${esc(d.aturan)}</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr>${d.kolom.map(k => `<th>${esc(k)}</th>`).join("")}<th style="width:210px">Putusan</th></tr></thead>
        <tbody>${d.baris.map((b, i) => {
          const key = `${g.kode}:${i}`, p = validasiKep[key];
          return `<tr>
            ${b.sel.map((val, j) => `<td>${j === 0 ? `<b>${esc(val)}</b>` : esc(val)}</td>`).join("")}
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm ${p && p.putusan === "sesuai" ? "btn-success" : "btn-ghost"}"
                        data-dv-putus="${esc(key)}|sesuai">Sesuai</button>
                <button class="btn btn-sm ${p && p.putusan === "tidak" ? "btn-danger" : "btn-ghost"}"
                        data-dv-putus="${esc(key)}|tidak">Tidak</button>
              </div>
              ${p && p.putusan === "tidak"
                ? `<input class="inp" style="margin-top:6px" placeholder="Catatan untuk TI…"
                          data-dv-catatan="${esc(key)}" value="${esc(p.catatan || "")}">` : ""}
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>`;
  }).join("");

  const tidak = Object.values(validasiKep).filter(p => p.putusan === "tidak").length;
  $("#dv-progres").textContent = validasiKepTerkirim
    ? "Hasil validasi sudah dikirim."
    : `${sudah} dari ${total} baris sudah diputuskan${tidak ? ` · ${tidak} ditandai tidak sesuai` : ""}.`;
  $("#dv-kirim").disabled = validasiKepTerkirim || sudah < total;
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  const putus = e.target.closest("[data-dv-putus]");
  if (putus) {
    const [key, nilai] = putus.dataset.dvPutus.split("|");
    const lama = validasiKep[key];
    validasiKep[key] = { putusan: nilai, catatan: lama ? lama.catatan : "" };
    renderValidasiKep();
    return;
  }
  const ingat = e.target.closest("[data-dp-ingatkan]");
  if (ingat) {
    const t = dapemTahap.find(x => x.kode === ingat.dataset.dpIngatkan);
    toast(`Pengingat dikirim ke ${t.aktor}.`);
    return;
  }
  const unggah = e.target.closest("[data-dp-unggah]");
  if (unggah) {
    if (unggah.dataset.dpUnggah === "sipp") { modalUnggahSipp(); return; }
    toast("Pilih berkas balikan untuk diunggah.");
    return;
  }

  if (e.target.id === "dv-simpan") { toast("Hasil sementara disimpan."); return; }
  if (e.target.id === "dv-kirim") {
    const tidak = Object.values(validasiKep).filter(p => p.putusan === "tidak").length;
    validasiKepTerkirim = true;
    renderValidasiKep();
    toast(tidak ? `Hasil validasi dikirim — ${tidak} baris dikembalikan ke TI.` : "Hasil validasi dikirim — seluruh baris dinyatakan sesuai.", "ok");
    return;
  }
});

document.addEventListener("input", e => {
  const c = e.target.closest("[data-dv-catatan]");
  if (c) { const key = c.dataset.dvCatatan; if (validasiKep[key]) validasiKep[key].catatan = c.value; }
});

renderValidasiKep();
renderDapemMetrics();

/* ============================================== JALUR BALIK, PERAGAAN, KEUANGAN */

/* F1.1.6 — begitu Kepesertaan mengirim hasil, temuan yang ditandai tidak sesuai
   berpindah menjadi pekerjaan TI. Tanpa ini alur berhenti di Tahap 2. */
laneTahap = kode =>
  (kode === "kepesertaan" && validasiKepTerkirim) ? "ti" : DAPEM_TAHAP_LANE[kode];

let langkahYar = DAPEM_LANGKAH_YAR.map(l => ({ ...l, selesai: false }));
let rekapSiap  = false;

function serahkanKembaliKeTI() {
  dapemGate.filter(g => g.tahap === "kepesertaan").forEach(g => {
    const d = dapemTemuan[g.kode];
    if (!d) return;
    d.baris = d.baris.filter((b, i) => {
      const p = validasiKep[`${g.kode}:${i}`];
      return p && p.putusan === "tidak";
    });
    d.baris.forEach(b => b.pilih = true);
    g.sisa = d.baris.length;
  });
}

/* --------------------------------------------------------- bar kendali peragaan
   Sengaja dibedakan tampilannya supaya jelas ini alat bantu demo, bukan
   bagian dari aplikasi yang akan dibangun. */
function renderDemo() {
  const slot = $("#dp-demo");
  if (!slot) return;
  const aktif = dapemTahap.find(t => t.status === "aktif");
  slot.innerHTML = `
    <div style="border:1.5px dashed var(--line); border-radius:12px; padding:12px 16px;
                margin-bottom:18px; background:var(--field); display:flex; align-items:center;
                gap:12px; flex-wrap:wrap">
      <span class="pill pill-info">PERAGAAN</span>
      <span style="font-size:11.5px;font-weight:700;color:var(--muted)">Lompat ke tahap</span>
      ${dapemTahap.map(t => `
        <button class="btn btn-sm ${aktif && t.kode === aktif.kode ? "btn-primary" : "btn-ghost"}"
                data-demo-tahap="${t.no}">${t.no}</button>`).join("")}
      <span style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-demo="isi">Isi ulang temuan</button>
        <button class="btn btn-ghost btn-sm" data-demo="ulang">Ulang dari awal</button>
      </span>
    </div>`;
}

/* kembalikan seluruh temuan ke kondisi awal */
function demoIsiUlang() {
  dapemTemuan = JSON.parse(JSON.stringify(DAPEM_TEMUAN));
  dapemGate.forEach(g => {
    const d = dapemTemuan[g.kode];
    if (d) { g.temuan = d.baris.length; g.sisa = d.baris.length; }
    g.catatan = "";
  });
}

/* pindahkan run ke tahap tertentu: tahap sebelumnya dianggap beres */
function demoKeTahap(no) {
  demoIsiUlang();
  validasiKep = {};
  validasiKepTerkirim = no > 2;
  dapemTahap.forEach(t => {
    t.status = t.no < no ? "selesai" : t.no === no ? "aktif" : "terkunci";
    if (t.no < no) dapemGate.filter(g => g.tahap === t.kode).forEach(g => {
      const d = dapemTemuan[g.kode]; if (d) d.baris = [];
      g.sisa = 0;
    });
  });
  langkahYar.forEach(l => l.selesai = no > 6);
  rekapSiap = no > 6;
  dapemTab = dapemTahap.find(t => t.no === no).kode;
  renderDapemProses(); renderDapemMetrics(); renderValidasiKep(); renderKeuangan();
}

function demoUlang() {
  dapemTahap = DAPEM_TAHAP.map(t => ({ ...t }));
  langkahYar = DAPEM_LANGKAH_YAR.map(l => ({ ...l, selesai: false }));
  validasiKep = {}; validasiKepTerkirim = false; rekapSiap = false;
  demoIsiUlang();
  dapemTab = "generate";
  renderDapemProses(); renderDapemMetrics(); renderValidasiKep(); renderKeuangan();
  toast("Peragaan dikembalikan ke kondisi awal.");
}

/* ------------------------------------------------------------ sisi Keuangan */
function renderKeuangan() {
  if (!$("#dk-body")) return;
  const p = DAPEM_PERIODE[0];
  $("#dk-sub").textContent = `Dapem ${p.jenis} · ${p.periode} — rekapitulasi belanja pensiun per mata anggaran.`;
  $("#dk-banner").innerHTML = rekapSiap
    ? `<div class="alert alert-ok" style="margin-bottom:18px"><span>⚑</span><span><b>Giliran Anda</b> — TI Manajemen Data menyatakan Rekap III dapem ${esc(p.periode)} sudah bisa dicek dan dicetak.</span></div>`
    : `<div class="alert alert-info" style="margin-bottom:18px"><span>⏳</span><span>Rekap III belum tersedia. Menunggu TI Manajemen Data menyelesaikan unggah data dapem ke tabel pembayaran.</span></div>`;

  const tot = DAPEM_REKAP_MAK.reduce((a, r) => ({
    jumlah: a.jumlah + r.jumlah, bruto: a.bruto + r.bruto, netto: a.netto + r.netto
  }), { jumlah: 0, bruto: 0, netto: 0 });

  $("#dk-metrics").innerHTML = [
    { l: "Periode",       v: `${p.periode} · ${p.jenis}`,            c: "navy" },
    { l: "Mata Anggaran", v: DAPEM_REKAP_MAK.length,                 c: "" },
    { l: "Total Bruto",   v: miliar(tot.bruto),                      c: "" },
    { l: "Total Netto",   v: miliar(tot.netto),                      c: rekapSiap ? "ok" : "" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  $("#dk-body").innerHTML = DAPEM_REKAP_MAK.map(r => `<tr>
    <td><b>${esc(r.mak)}</b></td><td>${esc(r.uraian)}</td>
    <td>${r.jumlah.toLocaleString("id-ID")}</td>
    <td>${miliar(r.bruto)}</td><td>${miliar(r.netto)}</td>
  </tr>`).join("");
  /* jumlah nopens TIDAK dijumlahkan antar mata anggaran — satu peserta bisa
     muncul di beberapa MAK sekaligus, sehingga totalnya akan menyesatkan */
  $("#dk-total").innerHTML = `<td colspan="2">TOTAL</td>
    <td style="color:var(--muted);font-weight:600">—</td>
    <td>${miliar(tot.bruto)}</td><td>${miliar(tot.netto)}</td>`;
  $("#dk-cetak").disabled  = !rekapSiap;
  $("#dk-export").disabled = !rekapSiap;
}

/* ------------------------------------------------- daftar langkah wajib tahap 6 */
function kartuYarBaru() {
  const semua = langkahYar.every(l => l.selesai);
  return `
    <div class="card" style="margin-bottom:18px">
      <h3 class="card-title">Langkah Wajib Sebelum & Sesudah Unggah</h3>
      <div class="alert alert-warn"><span>⚠</span><span>Kedua langkah mode pemeliharaan tidak tercantum di bagan proses, tetapi wajib dikerjakan dan berpengaruh langsung pada pembayaran peserta.</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th style="width:64px">Urutan</th><th>Langkah</th><th>Keterangan</th><th style="width:120px">Status</th><th style="width:110px">Aksi</th></tr></thead>
        <tbody>${langkahYar.map((l, i) => {
          const sebelumnya = i === 0 || langkahYar[i - 1].selesai;
          return `<tr>
            <td>${l.urut}</td><td>${esc(l.nama)}</td>
            <td style="color:var(--muted)">${esc(l.ket)}</td>
            <td><span class="pill ${l.selesai ? "pill-ok" : "pill-info"}">${l.selesai ? "✓ Selesai" : "Belum"}</span></td>
            <td>${l.selesai
              ? `<button class="btn btn-ghost btn-sm" disabled>Selesai</button>`
              : `<button class="btn btn-info btn-sm" data-yar-langkah="${i}" ${sebelumnya ? "" : "disabled"}>Jalankan</button>`}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="form-actions">
        <button class="btn btn-primary" id="yar-info" ${semua && !rekapSiap ? "" : "disabled"}>
          Informasikan ke Keuangan bahwa Rekap III siap
        </button>
      </div>
      ${rekapSiap ? `<div class="tbl-note">Keuangan sudah diberi tahu — Rekap III dapat dicetak dari menu Rekap III Dapem.</div>` : ""}
    </div>`;
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  const lompat = e.target.closest("[data-demo-tahap]");
  if (lompat) { demoKeTahap(+lompat.dataset.demoTahap); toast(`Peragaan dipindahkan ke Tahap ${lompat.dataset.demoTahap}.`); return; }
  const demo = e.target.closest("[data-demo]");
  if (demo) {
    if (demo.dataset.demo === "isi") { demoIsiUlang(); renderDapemProses(); renderValidasiKep(); toast("Temuan contoh diisi ulang."); }
    else demoUlang();
    return;
  }
  const lang = e.target.closest("[data-yar-langkah]");
  if (lang) {
    langkahYar[+lang.dataset.yarLangkah].selesai = true;
    renderDapemTahap();
    toast(`${langkahYar[+lang.dataset.yarLangkah].nama} — selesai.`, "ok");
    return;
  }
  if (e.target.id === "yar-info") {
    rekapSiap = true; renderDapemTahap(); renderKeuangan();
    toast("Div. Keuangan diberi tahu bahwa Rekap III sudah bisa dicek.", "ok");
    return;
  }
  if (e.target.id === "dk-cetak") { toast("Rekap III (KU 000) dicetak.", "ok"); return; }
});

/* Jalur balik F1.1.6. Didaftarkan setelah handler asli, sehingga berjalan
   ketika pengiriman sudah benar-benar ditandai. */
document.addEventListener("click", e => {
  if (e.target.id !== "dv-kirim" || !validasiKepTerkirim) return;
  serahkanKembaliKeTI();
  renderDapemProses(); renderDapemMetrics();
});

renderKeuangan();
renderNdKeuangan();

/* ============================================ DATA DAPEM, DOKUMEN SIPP, EXPORT
   Tiga penutup alur dapem:
     · Data DAPEM   — seluruh baris yang terbentuk, bisa dilihat & diekspor
     · Dokumen SIPP — balikan dari luar organisasi, terlacak per putaran
     · Export Rekap III — hasil akhir yang dipakai Div. Keuangan               */

/* ------------------------------------------------------- pagination bersama
   Dipakai dua daftar peserta (dapem & non dapem). Bentuk tombolnya mengikuti
   pager yang sudah ada di modul Pendaftaran dan Request Umum. */
function pagerPotong(rows, st) {
  const maxHal = Math.max(1, Math.ceil(rows.length / st.per));
  if (st.hal > maxHal) st.hal = maxHal;      /* filter menyusut → jangan nyangkut */
  if (st.hal < 1) st.hal = 1;
  const mulai = (st.hal - 1) * st.per;
  return { total: rows.length, maxHal, mulai, hal: rows.slice(mulai, mulai + st.per) };
}

/* halaman dipangkas dengan elipsis supaya tidak melebar saat datanya banyak */
function pagerHtml(st, p, attr) {
  const tbl = (isi, aktif, hal, mati) =>
    `<button class="btn ${aktif ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0"` +
    `${mati ? " disabled" : ` ${attr}="${hal}"`}>${isi}</button>`;
  const nomor = [];
  for (let i = 1; i <= p.maxHal; i++) {
    if (i === 1 || i === p.maxHal || Math.abs(i - st.hal) <= 1) nomor.push(i);
    else if (nomor[nomor.length - 1] !== "…") nomor.push("…");
  }
  return tbl("‹", false, st.hal - 1, st.hal <= 1)
       + nomor.map(i => i === "…"
           ? `<span style="padding:0 3px;color:var(--faint);font-size:11px;align-self:center">…</span>`
           : tbl(i, i === st.hal, i, false)).join("")
       + tbl("›", false, st.hal + 1, st.hal >= p.maxHal);
}

function pagerNote(p, satuan, ekor) {
  const dari = p.total ? p.mulai + 1 : 0;
  return `Menampilkan <b>${dari}–${Math.min(p.mulai + p.hal.length, p.total)}</b> dari ${p.total.toLocaleString("id-ID")} ${satuan}. ${ekor}`;
}

/* satu tempat untuk memasang selektor jumlah baris */
function pasangPer(id, st, render) {
  const el = $("#" + id);
  if (!el) return;
  el.value = String(st.per);
  el.onchange = () => { st.per = +el.value; st.hal = 1; render(); };
}

/* salinan hidup — data.js dibiarkan utuh */
let sippDok = DAPEM_SIPP_DOK.map(d => ({ ...d }));

/* rumus dapem dipakai satu kali di sini, supaya tidak ada versi kedua */
function hitungBaris(r) {
  const sub   = r.pokok + r.istri + r.anak + r.beras + r.lain;
  const bruto = sub + r.bulat;
  return { sub, bruto, netto: bruto - r.pot };
}

/* -------------------------------------------------------------- Data DAPEM */
let ddPeriode = { periode: DAPEM_PARAM.blnbyr, jenis: DAPEM_PARAM.jenis };
let ddFilter  = { jiwa: "", bank: "", oten: "", cari: "" };
let ddPager   = { hal: 1, per: 10 };

function ddOpsi(sel, kosong, nilai) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = `<option value="">${kosong}</option>` +
    nilai.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

function initDataDapem() {
  if (!$("#dd-body")) return;
  const uniq = f => [...new Set(DAPEM_DATA.map(f))].sort();
  ddOpsi("#dd-f-jiwa",    "Semua kode jiwa",   uniq(r => r.jiwa));
  ddOpsi("#dd-f-bank",    "Semua kantor bayar", uniq(r => r.bank));
  ["jiwa", "bank", "oten", "cari"].forEach(k => {
    const el = $("#dd-f-" + k);
    if (el) el.addEventListener("input", () => { ddFilter[k] = el.value; ddPager.hal = 1; renderDataDapem(); });
  });
  pasangPer("dd-per", ddPager, renderDataDapem);
  renderDataDapem();
}

function ddBaris() {
  const c = ddFilter.cari.trim().toLowerCase();
  return DAPEM_DATA.filter(r =>
    r.periode === ddPeriode.periode && r.jenis === ddPeriode.jenis &&
    (!ddFilter.jiwa    || r.jiwa === ddFilter.jiwa) &&
    (!ddFilter.bank    || r.bank === ddFilter.bank) &&
    (!ddFilter.oten    || r.oten === ddFilter.oten) &&
    (!c || r.nopens.toLowerCase().includes(c) || r.nama.toLowerCase().includes(c)
        || r.nik.toLowerCase().includes(c)));
}

function renderDataDapem() {
  if (!$("#dd-body")) return;
  const rows = ddBaris();
  const P = DAPEM_PERIODE.find(d => d.periode === ddPeriode.periode && d.jenis === ddPeriode.jenis)
            || { nopens: 0, bruto: 0, netto: 0 };

  $("#dd-sub").innerHTML = `Dapem ${esc(ddPeriode.jenis)} · ${esc(ddPeriode.periode)} — ` +
    `peserta yang terbit pada bulan bayar ini`;

  /* angka ringkasan diambil dari periodenya, BUKAN dijumlah dari baris contoh —
     kalau dijumlah dari sampel, totalnya akan berbeda dari Daftar Periode */
  $("#dd-metrics").innerHTML = [
    { l: "Bulan Bayar",   v: `${ddPeriode.periode} · ${ddPeriode.jenis}`, c: "navy" },
    { l: "Jumlah Nopens", v: P.nopens ? P.nopens.toLocaleString("id-ID") : "—", c: "" },
    { l: "Jumlah Bruto",  v: P.bruto ? miliar(P.bruto) : "—",                  c: "" },
    { l: "Jumlah Netto",  v: P.netto ? miliar(P.netto) : "—",                  c: "ok" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  const pg = pagerPotong(rows, ddPager);
  const n  = v => v.toLocaleString("id-ID");
  $("#dd-body").innerHTML = pg.hal.length ? pg.hal.map((r, i) => {
    const h = hitungBaris(r);
    return `<tr>
      <td class="stick-l"><b>${esc(r.nopens)}</b></td>
      <td>${esc(r.nama)}</td><td>${esc(r.jiwa)}</td><td>${esc(r.nik)}</td>
      <td>${esc(r.mak)}</td><td>${esc(r.bank)}</td><td>${esc(r.cab)}</td>
      <td style="font-family:ui-monospace,monospace">${esc(r.norek)}</td>
      <td>${n(r.pokok)}</td><td>${n(r.istri)}</td><td>${n(r.anak)}</td><td>${n(r.beras)}</td>
      <td>${n(r.lain)}</td><td>${n(r.bulat)}</td>
      <td><b>${n(h.bruto)}</b></td><td>${n(r.pot)}</td><td><b>${n(h.netto)}</b></td>
      <td><span class="pill ${r.oten === "00" ? "pill-ok" : "pill-info"}">${esc(r.oten)}</span></td>
      <td class="stick-r"><button class="btn btn-info btn-sm" data-dd-detail="${pg.mulai + i}">Detail</button></td>
    </tr>`;
  }).join("")
  : `<tr><td colspan="19"><div class="empty"><h4>Tidak ada baris</h4><p>Ubah filter atau kata kunci pencarian. Periode berstatus Draft belum punya baris apa pun.</p></div></td></tr>`;

  $("#dd-note").innerHTML = pagerNote(pg, "peserta",
    P.nopens ? `Pada data sebenarnya periode ini berisi ${P.nopens.toLocaleString("id-ID")} nopens.` : "");
  $("#dd-pager").innerHTML = pagerHtml(ddPager, pg, "data-dd-hal");
}

function ddDetail(i) {
  const r = ddBaris()[i];
  const h = hitungBaris(r);
  const n = v => v.toLocaleString("id-ID");
  const grup = (judul, isi) => `
    <div class="subsection-title">${esc(judul)}</div>
    <div class="tbl-wrap"><table><tbody>${isi.map(([k, v]) => `
      <tr><td style="width:44%;color:var(--muted)">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}
    </tbody></table></div>`;
  $("#modal-title").textContent = `${r.nopens} · ${r.nama}`;
  $("#modal-sub").textContent   = `Dapem ${r.jenis} · ${r.periode}`;
  $("#modal-body").innerHTML =
    grup("IDENTITAS", [["Nomor Pensiun", r.nopens], ["Nama", r.nama],
                       ["Kode Jiwa", r.jiwa], ["NIK", r.nik]]) +
    grup("PEMBAYARAN", [["Mata Anggaran", r.mak], ["Kantor Bayar", r.bank],
                        ["Kode Cabang", r.cab], ["Nomor Rekening", r.norek],
                        ["Kode Otentikasi", r.oten === "00" ? "00 — dijamin" : "31 — bayar langsung"]]) +
    grup("PERHITUNGAN", [["Pensiun Pokok", n(r.pokok)], ["Tunjangan Istri", n(r.istri)],
                         ["Tunjangan Anak", n(r.anak)], ["Tunjangan Beras", n(r.beras)],
                         ["Tunjangan Lain", n(r.lain)],
                         ["Subtotal", n(h.sub)], ["Pembulatan", n(r.bulat)],
                         ["Jumlah Bruto", n(h.bruto)], ["Jumlah Potongan", n(r.pot)],
                         ["Jumlah Netto", n(h.netto)]]) +
    `<div class="tbl-note" style="text-align:left">Netto selalu kelipatan 100 — pembulatan dihitung dari selisihnya, bukan diisi manual.</div>`;
  openModal();
}

/* ------------------------------------------------- dokumen balikan dari SIPP */
function kartuSippDok() {
  const t = dapemTahap.find(x => x.kode === "sipp");
  const terkunci = t.status === "terkunci";
  return `
    <div class="card" style="margin-bottom:18px">
      <div class="head-row" style="margin-bottom:12px">
        <h3 class="card-title" style="margin:0">Dokumen Balikan dari SIPP</h3>
        <div class="head-divider"></div>
        <span class="pill ${sippDok.length ? "pill-ok" : "pill-info"}">${sippDok.length} dokumen</span>
      </div>
      <div class="alert alert-info"><span>ⓘ</span><span>SIPP berada di luar organisasi — berkas ADK dikirim dan hasil validasinya diterima lewat SharePoint Validasi SIPP. Dokumen yang diunggah di sini tercatat per putaran, sehingga tidak lagi hanya tersimpan di folder pribadi.</span></div>

      <div class="dropzone ${sippDok.length ? "has-file" : ""}" id="dp-sipp-drop" ${terkunci ? 'style="opacity:.55;pointer-events:none"' : ""}>
        <div style="font-size:26px;color:var(--slate);margin-bottom:10px">☁⬆</div>
        <div style="font-weight:600;margin-bottom:4px">Tarik dokumen balikan SIPP ke sini atau klik untuk memilih</div>
        <div class="hint" style="margin:0">Format .xlsx, .csv, .pdf, atau .zip — maksimal 25 MB per berkas</div>
      </div>

      <div class="tbl-wrap" style="margin-top:16px"><table>
        <thead><tr><th style="width:74px">Putaran</th><th>Jenis Dokumen</th><th>Nama Berkas</th>
          <th style="width:88px">Ukuran</th><th>Diunggah</th><th>Catatan</th><th style="width:96px">Aksi</th></tr></thead>
        <tbody>${sippDok.length ? sippDok.map((d, i) => `<tr>
          <td><b>${d.putaran}</b></td>
          <td>${esc(d.jenis)}</td>
          <td style="font-family:ui-monospace,monospace;font-size:11.5px">${esc(d.nama)}</td>
          <td>${esc(d.ukuran)}</td>
          <td>${esc(d.tgl)}<div style="color:var(--muted);font-size:11px">${esc(d.oleh)}</div></td>
          <td style="color:var(--muted)">${esc(d.catatan)}</td>
          <td><button class="btn btn-danger btn-sm" data-dp-sipp-hapus="${i}">Hapus</button></td>
        </tr>`).join("")
        : `<tr><td colspan="7"><div class="empty"><h4>Belum ada dokumen</h4><p>Unggah hasil validasi setelah SIPP mengirim balikannya.</p></div></td></tr>`}
        </tbody>
      </table></div>
      <div class="tbl-note" style="text-align:left">Nama berkas disimpan apa adanya untuk penelusuran, tetapi pada aplikasi sebenarnya berkas fisiknya dinamai ulang dan disimpan di luar webroot.</div>
    </div>`;
}

function modalUnggahSipp() {
  const putaran = (DAPEM_PUTARAN.sipp || []).length || 1;
  $("#modal-title").textContent = "Unggah Balikan SIPP";
  $("#modal-sub").textContent   = `Dapem ${dapemAktif.jenis} · ${dapemAktif.periode} — putaran ${putaran}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-info"><span>ⓘ</span><span>Satu dokumen per unggahan. Jenis dokumen dipilih agar balikan bisa dicocokkan dengan berkas ADK yang dikirim.</span></div>
    <div class="grid2">
      <div class="field">
        <label class="fl" for="ds-jenis">Jenis dokumen <span class="req">*</span></label>
        <select class="inp" id="ds-jenis">${DAPEM_SIPP_JENIS.map(j => `<option>${esc(j)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label class="fl" for="ds-putaran">Putaran</label>
        <input class="inp" id="ds-putaran" value="${putaran}" readonly>
        <div class="hint">Mengikuti putaran validasi SIPP yang sedang berjalan.</div>
      </div>
    </div>
    <div class="field">
      <label class="fl" for="ds-nama">Nama berkas <span class="req">*</span></label>
      <input class="inp" id="ds-nama" value="Hasil_Validasi_SIPP_${esc(DAPEM_PARAM.blnbyr)}_p${putaran}.xlsx">
      <div class="hint">Format .xlsx, .csv, .pdf, atau .zip — maksimal 25 MB.</div>
    </div>
    <div class="field">
      <label class="fl" for="ds-catatan">Catatan</label>
      <input class="inp" id="ds-catatan" placeholder="Contoh: penspok tidak sama pada 8 nopens">
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="ds-batal">Batal</button>
      <button class="btn btn-primary" id="ds-ok">⬆ Unggah</button>
    </div>`;
  openModal();
  $("#ds-batal").onclick = closeModal;
  $("#ds-ok").onclick = () => {
    const nama = $("#ds-nama").value.trim();
    if (!nama) { toast("Nama berkas wajib diisi.", "bad"); $("#ds-nama").focus(); return; }
    if (!/\.(xlsx|csv|pdf|zip)$/i.test(nama)) {
      toast("Format berkas tidak diizinkan — pakai .xlsx, .csv, .pdf, atau .zip.", "bad"); return;
    }
    sippDok.push({
      putaran, jenis: $("#ds-jenis").value, nama,
      ukuran: "1,2 MB", oleh: PENGATURAN.namaUser || "Menda",
      tgl: "26 Jun 2026 09:40",
      catatan: $("#ds-catatan").value.trim() || "—"
    });
    closeModal();
    if (dapemTab === "sipp") renderDapemTahap();
    toast(`${nama} diunggah sebagai balikan SIPP putaran ${putaran}.`, "ok");
  };
}

/* ------------------------------------------------------------------- export */
function modalExport(cfg) {
  $("#modal-title").textContent = cfg.judul;
  $("#modal-sub").textContent   = cfg.sub;
  $("#modal-body").innerHTML = `
    <div class="grid2">
      <div class="field">
        <label class="fl" for="ex-format">Format berkas</label>
        <select class="inp" id="ex-format">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
      </div>
      <div class="field">
        <label class="fl" for="ex-lingkup">Cakupan data</label>
        <select class="inp" id="ex-lingkup">
          ${cfg.lingkup.map((l, i) => `<option value="${i}">${esc(l)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="review-card" style="margin-bottom:16px">
      <div class="review-card-head">Akan diekspor</div>
      <div class="review-card-body">
        <div class="grid2">${cfg.ringkas.map(([k, v]) => `
          <div class="review-row"><div class="fl">${esc(k)}</div><div class="val">${esc(v)}</div></div>`).join("")}
        </div>
      </div>
    </div>
    <div class="alert alert-info"><span>ⓘ</span><span>Sel yang diawali <b>=</b>, <b>+</b>, <b>-</b>, atau <b>@</b> di-escape lebih dulu, supaya berkas hasil export tidak dieksekusi sebagai formula saat dibuka.</span></div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="ex-batal">Batal</button>
      <button class="btn btn-primary" id="ex-ok">⬇ Export</button>
    </div>`;
  openModal();
  $("#ex-batal").onclick = closeModal;
  $("#ex-ok").onclick = () => {
    const fmt = $("#ex-format").value;
    closeModal();
    toast(`${cfg.nama}.${fmt} dibentuk dan diunduh.`, "ok");
  };
}

function exportRekapIII() {
  const p = DAPEM_PERIODE[0];
  const tot = DAPEM_REKAP_MAK.reduce((a, r) => ({ bruto: a.bruto + r.bruto, netto: a.netto + r.netto }),
                                     { bruto: 0, netto: 0 });
  modalExport({
    judul: "Export Rekap III DAPEM",
    sub:   `Dapem ${p.jenis} · ${p.periode} — hasil akhir pembentukan dapem`,
    lingkup: ["Rekap per mata anggaran", "Rekap + rincian per nomor pensiun"],
    ringkas: [["Periode", `${p.periode} · ${p.jenis}`],
              ["Mata Anggaran", `${DAPEM_REKAP_MAK.length} baris`],
              ["Total Bruto", miliar(tot.bruto)],
              ["Total Netto", miliar(tot.netto)]],
    nama: `Rekap-III-DAPEM-${p.periode}-${p.jenis}`
  });
}

function exportDataDapem() {
  const rows = ddBaris();
  const tot = rows.reduce((a, r) => a + hitungBaris(r).netto, 0);
  const P = DAPEM_PERIODE.find(d => d.periode === ddPeriode.periode && d.jenis === ddPeriode.jenis) || {};
  modalExport({
    judul: "Export Daftar Peserta DAPEM",
    sub:   `Dapem ${ddPeriode.jenis} · ${ddPeriode.periode}`,
    lingkup: ["Baris sesuai filter aktif", "Seluruh peserta pada periode ini"],
    ringkas: [["Periode", `${ddPeriode.periode} · ${ddPeriode.jenis}`],
              ["Sesuai Filter", `${rows.length} baris`],
              ["Seluruh Periode", P.nopens ? `${P.nopens.toLocaleString("id-ID")} nopens` : "—"],
              ["Kolom", "18 kolom sesuai tampilan"]],
    nama: `Daftar-Peserta-DAPEM-${ddPeriode.periode}-${ddPeriode.jenis}`
  });
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  const lihat = e.target.closest("[data-dapem-data]");
  if (lihat) {
    const [periode, jenis] = lihat.dataset.dapemData.split("|");
    ddPeriode = { periode, jenis };
    ddFilter  = { jiwa: "", bank: "", oten: "", cari: "" };
    ddPager.hal = 1;
    ["jiwa", "bank", "oten", "cari"].forEach(k => {
      const el = $("#dd-f-" + k); if (el) el.value = "";
    });
    renderDataDapem();
    go("dapem-data");
    return;
  }
  const det = e.target.closest("[data-dd-detail]");
  if (det) { ddDetail(+det.dataset.ddDetail); return; }

  if (e.target.id === "dd-reset") {
    ddFilter = { jiwa: "", bank: "", oten: "", cari: "" };
    ddPager.hal = 1;
    ["jiwa", "bank", "oten", "cari"].forEach(k => {
      const el = $("#dd-f-" + k); if (el) el.value = "";
    });
    renderDataDapem();
    return;
  }
  const ddHal = e.target.closest("[data-dd-hal]");
  if (ddHal) { ddPager.hal = +ddHal.dataset.ddHal; renderDataDapem(); return; }
  if (e.target.id === "dd-export") { exportDataDapem(); return; }
  if (e.target.id === "dk-export") { exportRekapIII();  return; }
  if (e.target.id === "dp-sipp-drop" || e.target.closest("#dp-sipp-drop")) { modalUnggahSipp(); return; }

  const hapus = e.target.closest("[data-dp-sipp-hapus]");
  if (hapus) {
    const d = sippDok[+hapus.dataset.dpSippHapus];
    sippDok.splice(+hapus.dataset.dpSippHapus, 1);
    if (dapemTab === "sipp") renderDapemTahap();
    toast(`${d.nama} dihapus.`);
    return;
  }
});

initDataDapem();

/* ================================ DAFTAR PESERTA NON DAPEM
   Sama seperti dapem, tapi dimensi utamanya jenis bayar (10/11/12) — bukan
   bulan bayar, karena non dapem hanya punya satu bulan bayar per run.       */

let nnFilter = { jenis: "", bank: "", pph: "", cari: "" };
let nnPager  = { hal: 1, per: 10 };

/* rumus non dapem — satu tempat, sama dengan SQL-nya */
function hitungNd(r) {
  const tunjLain = r.cacat + r.pph + r.irja;
  const sub      = r.pokok + r.istri + r.anak + r.beras + tunjLain;
  const potong   = r.potLain + r.pph;
  const bruto    = sub + r.bulat;
  return { tunjLain, sub, potong, bruto, netto: bruto - potong };
}

function initPesertaNd() {
  if (!$("#nn-body")) return;
  ddOpsi("#nn-f-bank", "Semua kantor bayar",
         [...new Set(NONDAPEM_DATA.map(r => r.bank))].sort());
  ["jenis", "bank", "pph", "cari"].forEach(k => {
    const el = $("#nn-f-" + k);
    if (el) el.addEventListener("input", () => { nnFilter[k] = el.value; nnPager.hal = 1; renderPesertaNd(); });
  });
  pasangPer("nn-per", nnPager, renderPesertaNd);
  renderPesertaNd();
}

function nnBaris() {
  const c = nnFilter.cari.trim().toLowerCase();
  return NONDAPEM_DATA.filter(r =>
    (!nnFilter.jenis || r.jenis === nnFilter.jenis) &&
    (!nnFilter.bank  || r.bank  === nnFilter.bank) &&
    (!nnFilter.pph   || (nnFilter.pph === "ada" ? r.pph > 0 : r.pph === 0)) &&
    (!c || r.nopens.toLowerCase().includes(c) || r.nama.toLowerCase().includes(c)
        || r.nik.toLowerCase().includes(c)));
}

function renderPesertaNd() {
  if (!$("#nn-body")) return;
  const p = NONDAPEM_PARAM, R = NONDAPEM_RINGKAS;
  const rows = nnBaris();
  const pg   = pagerPotong(rows, nnPager);
  const n    = v => v.toLocaleString("id-ID");

  $("#nn-sub").textContent =
    `Non Dapem ${p.blnbyr} · jenis bayar ${p.jnsbyr} — peserta yang dibayar di luar dapem`;

  /* angka ringkasan dari run-nya, bukan dijumlah dari baris contoh */
  $("#nn-metrics").innerHTML = [
    { l: "Bulan Bayar",   v: p.blnbyr,               c: "navy" },
    { l: "Jumlah Nopens", v: n(R.nopens),            c: "" },
    { l: "Jumlah Bruto",  v: miliar(R.bruto),        c: "" },
    { l: "Jumlah Netto",  v: miliar(R.netto),        c: "ok" }
  ].map(m => `<div class="metric"><div class="metric-lbl">${esc(m.l)}</div><div class="metric-val ${m.c}">${esc(m.v)}</div></div>`).join("");

  $("#nn-body").innerHTML = pg.hal.length ? pg.hal.map((r, i) => {
    const h = hitungNd(r);
    return `<tr>
      <td class="stick-l"><b>${esc(r.nopens)}</b></td>
      <td>${esc(r.nama)}</td>
      <td><span class="pill ${r.jenis === "12" ? "pill-warn" : "pill-info"}">${esc(r.jenis)}</span></td>
      <td>${esc(r.nik)}</td><td>${esc(r.mak)}</td><td>${esc(r.bank)}</td><td>${esc(r.cab)}</td>
      <td style="font-family:ui-monospace,monospace">${esc(r.norek)}</td>
      <td>${n(r.pokok)}</td><td>${n(r.istri)}</td><td>${n(r.anak)}</td><td>${n(r.beras)}</td>
      <td>${n(h.tunjLain)}</td>
      <td>${r.pph ? (r.jenis === "12"
            ? `<b style="color:var(--red)">${n(r.pph)}</b>` : n(r.pph)) : "0"}</td>
      <td>${n(r.bulat)}</td>
      <td><b>${n(h.bruto)}</b></td><td>${n(h.potong)}</td><td><b>${n(h.netto)}</b></td>
      <td class="stick-r"><button class="btn btn-info btn-sm" data-nn-detail="${pg.mulai + i}">Detail</button></td>
    </tr>`;
  }).join("")
  : `<tr><td colspan="19"><div class="empty"><h4>Tidak ada peserta</h4><p>Ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  $("#nn-note").innerHTML = pagerNote(pg, "peserta",
    `Pada data sebenarnya run ini berisi ${n(R.nopens)} nopens. PPh merah = uang duka wafat yang masih terkena potongan (temuan N-04).`);
  $("#nn-pager").innerHTML = pagerHtml(nnPager, pg, "data-nn-hal");
}

function nnDetail(i) {
  const r = nnBaris()[i];
  const h = hitungNd(r);
  const n = v => v.toLocaleString("id-ID");
  const grup = (judul, isi) => `
    <div class="subsection-title">${esc(judul)}</div>
    <div class="tbl-wrap"><table><tbody>${isi.map(([k, v]) => `
      <tr><td style="width:44%;color:var(--muted)">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}
    </tbody></table></div>`;
  $("#modal-title").textContent = `${r.nopens} · ${r.nama}`;
  $("#modal-sub").textContent   =
    `Non Dapem ${NONDAPEM_PARAM.blnbyr} — jenis bayar ${r.jenis} · ${NONDAPEM_JENIS_LABEL[r.jenis]}`;
  $("#modal-body").innerHTML =
    (r.jenis === "12" && r.pph
      ? `<div class="alert alert-bad"><span>⚠</span><span>Uang duka wafat tidak dikenakan PPh 21, tetapi baris ini masih memiliki potongan ${n(r.pph)}. Perbaikannya ada di temuan <b>N-04</b>.</span></div>` : "") +
    grup("IDENTITAS", [["Nomor Pensiun", r.nopens], ["Nama Penerima", r.nama],
                       ["Jenis Bayar", `${r.jenis} — ${NONDAPEM_JENIS_LABEL[r.jenis]}`], ["NIK", r.nik]]) +
    grup("PEMBAYARAN", [["Mata Anggaran", r.mak], ["Kantor Bayar", r.bank],
                        ["Kode Cabang", r.cab], ["Nomor Rekening", r.norek]]) +
    grup("PERHITUNGAN", [["Pensiun Pokok", n(r.pokok)], ["Tunjangan Istri", n(r.istri)],
                         ["Tunjangan Anak", n(r.anak)], ["Tunjangan Beras", n(r.beras)],
                         ["Tunjangan Cacat", n(r.cacat)], ["Tunjangan IRJA", n(r.irja)],
                         ["PPh 21", n(r.pph)],
                         ["Tunjangan Lain (cacat + PPh + IRJA)", n(h.tunjLain)],
                         ["Subtotal", n(h.sub)], ["Pembulatan", n(r.bulat)],
                         ["Jumlah Bruto", n(h.bruto)],
                         ["Potongan Lain", n(r.potLain)],
                         ["Jumlah Potongan", n(h.potong)], ["Jumlah Netto", n(h.netto)]]) +
    `<div class="tbl-note" style="text-align:left">Netto selalu kelipatan 100 — pembulatan dihitung dari selisihnya, bukan diisi manual.</div>`;
  openModal();
}

function exportPesertaNd() {
  const rows = nnBaris();
  modalExport({
    judul: "Export Daftar Peserta NON DAPEM",
    sub:   `Non Dapem ${NONDAPEM_PARAM.blnbyr} · jenis bayar ${NONDAPEM_PARAM.jnsbyr}`,
    lingkup: ["Baris sesuai filter aktif", "Seluruh peserta pada run ini"],
    ringkas: [["Bulan Bayar", NONDAPEM_PARAM.blnbyr],
              ["Sesuai Filter", `${rows.length} baris`],
              ["Seluruh Run", `${NONDAPEM_RINGKAS.nopens.toLocaleString("id-ID")} nopens`],
              ["Kolom", "18 kolom sesuai tampilan"]],
    nama: `Daftar-Peserta-NON-DAPEM-${NONDAPEM_PARAM.blnbyr}`
  });
}

/* --------------------------------------------------------------- interaksi */
document.addEventListener("click", e => {
  const det = e.target.closest("[data-nn-detail]");
  if (det) { nnDetail(+det.dataset.nnDetail); return; }

  const hal = e.target.closest("[data-nn-hal]");
  if (hal) { nnPager.hal = +hal.dataset.nnHal; renderPesertaNd(); return; }

  if (e.target.id === "nn-reset") {
    nnFilter = { jenis: "", bank: "", pph: "", cari: "" };
    nnPager.hal = 1;
    ["jenis", "bank", "pph", "cari"].forEach(k => {
      const el = $("#nn-f-" + k); if (el) el.value = "";
    });
    renderPesertaNd();
    return;
  }
  if (e.target.id === "nn-export") { exportPesertaNd(); return; }
});

initPesertaNd();

/* ====================================== KODE ACUAN REFERENSI KEPESERTAAN
   Layar "Daftar Kode Referensi" sudah tidak ada, tetapi daftar kodenya masih
   dibaca layar lain (mis. SPP Data Peserta) untuk mengisi pilihan Pangkat dan
   Satker/Kesatuan agar konsisten dengan tabel referensi ASABRI. */
const refRows = DATA_REFERENSI;

/* ========================= PENGELOLAAN REFERENSI DATA KEPESERTAAN » UNOR
   Pemeliharaan daftar Unit Organisasi. Pencarian memakai pasangan Jenis
   Pencarian + Nilai Pencarian (bukan satu kotak bebas) supaya sejalan dengan
   layar pemeliharaan referensi lain, ditambah rentang Tanggal Buat.
   Kode UNOR harus unik — dicek saat tambah maupun ubah. */
let unorRows = DATA_UNOR.map((u, i) => ({ ...u, _id: i }));

const UNOR_PAGE_SIZE = 10;
const UNOR_HARI  = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const UNOR_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
let unorPage = 1;

/* "04/07/2026" → { d: Date, panjang: "Sabtu, 4 Juli 2026" } */
function unorTanggal(dmy) {
  const [d, m, y] = (dmy || "").split("/").map(Number);
  const tgl = new Date(y, m - 1, d);
  return { d: tgl, panjang: `${UNOR_HARI[tgl.getDay()]}, ${d} ${UNOR_BULAN[m - 1]} ${y}` };
}
function unorTglHariIni() {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/* Nilai <input type="date"> ("2026-07-04") → Date lokal, supaya perbandingan
   rentang tidak meleset satu hari karena new Date("…") dibaca sebagai UTC. */
function unorTglInput(v) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function unorKodeTerpakai(kode, kecualiId) {
  return unorRows.some(u => u._id !== kecualiId && u.kode.toUpperCase() === kode.toUpperCase());
}

function isiPilihanUnor() {
  $("#unor-f-jenis").innerHTML = `<option value="">- Silakan Pilih Jenis Pencarian -</option>`
    + UNOR_JENIS_CARI.map(j => `<option value="${j.key}">${esc(j.label)}</option>`).join("");
}

function unorBarisTersaring() {
  const jenis  = $("#unor-f-jenis").value;
  const nilai  = ($("#unor-f-nilai").value || "").trim().toLowerCase();
  const dari   = $("#unor-f-dari").value;
  const sampai = $("#unor-f-sampai").value;

  return unorRows.filter(u => {
    if (nilai) {
      /* Jenis Pencarian kosong = cari di semua kolom. */
      const kolom = jenis ? [u[jenis]] : [u.kode, u.nama, u.deskripsi];
      if (!kolom.some(v => (v || "").toLowerCase().includes(nilai))) return false;
    }
    const t = unorTanggal(u.tgl).d;
    if (dari   && t < unorTglInput(dari))   return false;
    if (sampai && t > unorTglInput(sampai)) return false;
    return true;
  });
}

function unorPaginationHtml(totalPages) {
  const nav = (p, label, disabled) => `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" ${disabled ? "disabled" : `data-unor-page="${p}"`}>${label}</button>`;
  let html = nav(unorPage - 1, "‹", unorPage <= 1);
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn ${p === unorPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-unor-page="${p}">${p}</button>`;
  }
  return html + nav(unorPage + 1, "›", unorPage >= totalPages);
}

/* Pemeliharaan kode referensi adalah kewenangan Bidang Lojita di Divisi
   Kepesertaan; Kantor Cabang dan PIC UNOR/Kesatuan hanya melihat daftarnya. */
function unorBolehKelola() { return roleSaatIni() === ROLE_DIVISI; }

function renderUnor() {
  const boleh      = unorBolehKelola();
  const rows       = unorBarisTersaring();
  const totalPages = Math.max(1, Math.ceil(rows.length / UNOR_PAGE_SIZE));
  if (unorPage > totalPages) unorPage = totalPages;
  const start    = (unorPage - 1) * UNOR_PAGE_SIZE;
  const pageRows = rows.slice(start, start + UNOR_PAGE_SIZE);

  $("#unor-body").innerHTML = pageRows.length ? pageRows.map((u, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${esc(unorTanggal(u.tgl).panjang)}</td>
      <td class="t-name">${esc(u.kode)}</td>
      <td class="t-strong">${esc(u.nama)}</td>
      <td class="truncate-cell" title="${esc(u.deskripsi)}">${esc(u.deskripsi)}</td>
      <td style="white-space:nowrap">${boleh ? `
        <button class="btn btn-info btn-sm" data-unor-ubah="${u._id}" title="Ubah UNOR">✎</button>
        <button class="btn btn-danger btn-sm" data-unor-hapus="${u._id}" title="Hapus UNOR">⌫</button>` : "—"}
      </td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty"><h4>Tidak ada unit organisasi</h4><p>Coba ubah kata kunci atau rentang Tanggal Buat.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + UNOR_PAGE_SIZE, rows.length);
  $("#unor-tambah").style.display = boleh ? "" : "none";
  $("#unor-count").textContent    = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} unit organisasi`;
  $("#unor-pagination").innerHTML = unorPaginationHtml(totalPages);
  $("#unor-badge").textContent    = `${rows.length} entri`;
}

/* ------------------------------------------------------- Tambah / Ubah UNOR */
function unorForm(judul, awal, simpan) {
  $("#modal-title").textContent = judul;
  $("#modal-sub").textContent   = "Kode Unit Organisasi harus unik.";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Kode Unit Organisasi <span class="req">*</span></label>
      <input class="inp" id="unor-m-kode" value="${esc(awal.kode || "")}" placeholder="Contoh: UNOR-AD-046">
      <div class="hint">Pola kode: UNOR-&lt;matra&gt;-&lt;nomor urut&gt;.</div>
    </div>
    <div class="field">
      <label class="fl">Nama Unit Organisasi <span class="req">*</span></label>
      <input class="inp" id="unor-m-nama" value="${esc(awal.nama || "")}">
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl">Deskripsi Unit Organisasi</label>
      <textarea class="inp" id="unor-m-deskripsi" style="height:80px;padding:9px 10px;resize:vertical">${esc(awal.deskripsi || "")}</textarea>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="unor-m-batal">Batal</button>
      <button class="btn btn-primary" id="unor-m-simpan">Simpan</button>
    </div>`;
  openModal();
  $("#unor-m-batal").onclick  = closeModal;
  $("#unor-m-simpan").onclick = () => {
    const nilai = {
      kode:      $("#unor-m-kode").value.trim().toUpperCase(),
      nama:      $("#unor-m-nama").value.trim(),
      deskripsi: $("#unor-m-deskripsi").value.trim()
    };
    if (!nilai.kode || !nilai.nama) { toast("Kode dan Nama Unit Organisasi wajib diisi.", "bad"); return; }
    simpan(nilai);
  };
}

$("#unor-tambah").onclick = () => unorForm("Tambah UNOR", {}, nilai => {
  if (unorKodeTerpakai(nilai.kode, null)) {
    toast(`Kode ${nilai.kode} sudah terdaftar pada daftar UNOR.`, "bad");
    return;
  }
  unorRows.unshift({
    ...nilai, tgl: unorTglHariIni(),
    _id: unorRows.length ? Math.max(...unorRows.map(u => u._id)) + 1 : 0
  });
  unorPage = 1;
  renderUnor();
  closeModal();
  toast("Unit organisasi baru berhasil disimpan.", "ok");
});

function unorUbah(u) {
  unorForm("Ubah UNOR", u, nilai => {
    if (unorKodeTerpakai(nilai.kode, u._id)) {
      toast(`Kode ${nilai.kode} sudah terdaftar pada daftar UNOR.`, "bad");
      return;
    }
    Object.assign(u, nilai);
    renderUnor();
    closeModal();
    toast("Perubahan unit organisasi berhasil disimpan.", "ok");
  });
}

function unorHapus(u) {
  $("#modal-title").textContent = "Hapus Unit Organisasi";
  $("#modal-sub").textContent   = `${u.kode} · ${u.nama}`;
  $("#modal-body").innerHTML = `
    <div class="alert alert-bad"><span>⚠</span><span>Unit organisasi yang dihapus tidak lagi tersedia sebagai pilihan pada pengisian data peserta. Pastikan tidak ada peserta aktif yang masih terhubung ke unit ini.</span></div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="unor-hapus-batal">Batal</button>
      <button class="btn btn-danger-solid" id="unor-hapus-ya">Hapus</button>
    </div>`;
  openModal();
  $("#unor-hapus-batal").onclick = closeModal;
  $("#unor-hapus-ya").onclick    = () => {
    unorRows = unorRows.filter(x => x._id !== u._id);
    renderUnor();
    closeModal();
    toast(`Unit organisasi ${u.kode} berhasil dihapus.`, "ok");
  };
}

$("#unor-cari").onclick   = () => { unorPage = 1; renderUnor(); };
$("#unor-export").onclick = () => toast("Daftar unit organisasi diekspor ke Excel.");

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-unor-page]");
  if (bPage) { unorPage = +bPage.dataset.unorPage; renderUnor(); return; }

  const bUbah = e.target.closest("[data-unor-ubah]");
  if (bUbah) { unorUbah(unorRows.find(u => u._id === +bUbah.dataset.unorUbah)); return; }

  const bHapus = e.target.closest("[data-unor-hapus]");
  if (bHapus) { unorHapus(unorRows.find(u => u._id === +bHapus.dataset.unorHapus)); return; }
});

/* ==================== PENGELOLAAN REFERENSI DATA KEPESERTAAN » KOLEKTIF
   Penambahan referensi lewat berkas Excel. Daftar awal merekap berapa berkas
   yang sudah pernah diunggah per Jenis Referensi; tombol Tambah membuka alur
   dua langkah: Unggah Referensi → Validasi dan Submit. Tombol Simpan baru
   aktif kalau seluruh baris berkas lolos validasi. */
let rkRows = DATA_REF_KOLEKTIF.map((r, i) => ({ ...r, berkas: r.berkas.map(b => ({ ...b })), _id: i }));

const RK_LANGKAH = ["Unggah Referensi", "Validasi dan Submit"];
let rkfStep   = 1;
let rkfJenis  = null;     // entri REF_KOLEKTIF_JENIS yang sedang dipilih
let rkfBerkas = false;    // berkas contoh sudah "terunggah" atau belum
let rkDetail  = null;     // jenis referensi yang sedang dibuka detailnya

/* Pemeliharaan referensi adalah kewenangan Bidang Lojita di Divisi
   Kepesertaan; role lain hanya melihat daftarnya. */
function rkBolehKelola() { return roleSaatIni() === ROLE_DIVISI; }

function refKolektifGotoView(view) {
  $("#rk-list-view").style.display   = view === "list"   ? "" : "none";
  $("#rk-detail-view").style.display = view === "detail" ? "" : "none";
  $("#rk-form-view").style.display   = view === "form"   ? "" : "none";
  const ujung = view === "detail" ? `Detail ${rkDetail ? rkDetail.jenis : ""}`.trim()
              : view === "form"   ? "Tambah Referensi Kolektif"
              : null;
  $("#rk-crumb").innerHTML =
    `<span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><span>Pengelolaan Referensi Data Kepesertaan</span>`
    + (ujung ? `<span>›</span><span>Kolektif</span><span>›</span><b>${esc(ujung)}</b>`
             : `<span>›</span><b>Kolektif</b>`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Pilihan filter diambil dari daftar yang ada supaya jenis baru hasil unggahan
   ikut muncul; nilai yang sedang dipilih dipertahankan. */
function rkIsiFilterJenis() {
  const sel = $("#rk-f-jenis");
  const dipilih = sel.value || "all";
  sel.innerHTML = `<option value="all">Semua Jenis Referensi</option>`
    + rkRows.map(r => `<option>${esc(r.jenis)}</option>`).join("");
  sel.value = rkRows.some(r => r.jenis === dipilih) ? dipilih : "all";
}

function rkBarisTersaring() {
  const fJenis = $("#rk-f-jenis").value;
  return rkRows.filter(r => fJenis === "all" || r.jenis === fJenis);
}

function renderRefKolektif() {
  rkIsiFilterJenis();
  const rows  = rkBarisTersaring();
  const total = rows.reduce((n, r) => n + r.berkas.length, 0);

  $("#rk-body").innerHTML = rows.length ? rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="t-strong">${esc(r.jenis)}</td>
      <td>${r.berkas.length} berkas</td>
      <td style="white-space:nowrap">
        <button class="btn btn-info btn-sm" data-rk-detail="${r._id}">👁 Detail</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="4"><div class="empty"><h4>Belum ada referensi kolektif</h4><p>Ubah filter Jenis Referensi, atau unggah berkas lewat tombol Tambah Referensi Kolektif.</p></div></td></tr>`;

  $("#rk-tambah").style.display = rkBolehKelola() ? "" : "none";
  $("#rk-badge").textContent    = `${rows.length} jenis`;
  $("#rk-count").textContent    = `${total} berkas referensi terunggah dari ${rows.length} jenis referensi.`;
}

/* --------------------------------------------- Detail berkas per jenis */
function rkShowDetail(r) {
  rkDetail = r;
  $("#rkd-title").textContent = `Referensi Kolektif — ${r.jenis}`;
  $("#rkd-sub").textContent   = `${r.berkas.length} berkas pernah diunggah untuk jenis referensi ${r.jenis}.`;
  $("#rkd-body").innerHTML = r.berkas.length ? r.berkas.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="t-name">${esc(b.nama)}</td>
      <td>${esc(b.tgl)}</td>
      <td>${b.baris} baris</td>
      <td>${esc(b.oleh)}</td>
      <td><span class="pill pill-ok">${esc(b.status)}</span></td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty"><h4>Belum ada berkas</h4><p>Jenis referensi ini belum pernah menerima unggahan kolektif.</p></div></td></tr>`;
  refKolektifGotoView("detail");
}

$("#rkd-kembali").onclick = () => refKolektifGotoView("list");

/* ------------------------------------------- Tambah Referensi Kolektif */
function rkRenderStepper() {
  $("#rkf-stepper").innerHTML = RK_LANGKAH.map((l, i) => {
    const n = i + 1;
    const kelas = n === rkfStep ? "step active" : n < rkfStep ? "step done" : "step";
    return `<button class="${kelas}" data-rkf-step="${n}" ${n > rkfStep ? "disabled" : ""}>${n}. ${esc(l)}</button>`;
  }).join("");
}

function rkGotoStep(n) {
  rkfStep = n;
  $("#rkf-step-1").style.display = n === 1 ? "" : "none";
  $("#rkf-step-2").style.display = n === 2 ? "" : "none";
  rkRenderStepper();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isiPilihanRefKolektif() {
  $("#rkf-jenis").innerHTML = `<option value="">— Silahkan Pilih Jenis Referensi —</option>`
    + REF_KOLEKTIF_JENIS.map(j => `<option value="${j.key}">${esc(j.label)}</option>`).join("");
}

/* Berkas ikut direset setiap Jenis Referensi berubah — kolom templatenya
   berbeda, jadi berkas lama tidak lagi cocok untuk divalidasi. */
function rkResetUnggah() {
  rkfBerkas = false;
  $("#rkf-dropzone").classList.remove("has-file");
  $("#rkf-file-title").textContent = "Tarik file ke sini atau klik untuk memilih";
  $("#rkf-file-sub").textContent   = "Format .xlsx, maksimal 5 MB";
  $("#rkf-lanjut").disabled        = true;
}

function rkShowForm() {
  rkfJenis = null;
  $("#rkf-jenis").value               = "";
  $("#rkf-template").value            = "";
  $("#rkf-btn-template").disabled     = true;
  $("#rkf-template-hint").textContent = "Pilih Jenis Referensi lebih dulu untuk mengunduh templatenya.";
  rkResetUnggah();
  rkGotoStep(1);
  refKolektifGotoView("form");
}

$("#rk-tambah").onclick = rkShowForm;
$("#rk-cari").onclick   = () => renderRefKolektif();
$("#rk-export").onclick = () => toast("Daftar referensi kolektif diekspor ke Excel.");
$("#rkf-batal").onclick = () => refKolektifGotoView("list");

/* Field Template Referensi menyesuaikan Jenis Referensi yang dipilih. */
$("#rkf-jenis").onchange = () => {
  rkfJenis = REF_KOLEKTIF_JENIS.find(j => j.key === $("#rkf-jenis").value) || null;
  $("#rkf-template").value            = rkfJenis ? `${rkfJenis.templateNama}.xlsx` : "";
  $("#rkf-btn-template").disabled     = !rkfJenis;
  $("#rkf-template-hint").textContent = rkfJenis
    ? `Kolom template: ${rkfJenis.kolom.join(", ")}.`
    : "Pilih Jenis Referensi lebih dulu untuk mengunduh templatenya.";
  rkResetUnggah();
};

$("#rkf-btn-template").onclick = () => {
  if (!rkfJenis) return;
  toast(`${rkfJenis.templateNama} diunduh.`);
};

$("#rkf-dropzone").onclick = () => {
  if (!rkfJenis) { toast("Pilih Jenis Referensi lebih dulu.", "bad"); return; }
  rkfBerkas = true;
  $("#rkf-dropzone").classList.add("has-file");
  $("#rkf-file-title").textContent = rkfJenis.namaBerkas;
  $("#rkf-file-sub").textContent   = `${rkfJenis.rows.length} baris terbaca — siap divalidasi`;
  $("#rkf-lanjut").disabled        = false;
};

/* Tabel hasil validasi mengikuti kolom berkas yang diunggah, ditambah kolom
   Status dan Keterangan supaya baris bermasalah langsung terlihat. */
function rkRenderValidasi() {
  const j       = rkfJenis;
  const total   = j.rows.length;
  const ditolak = j.rows.filter(r => r.status === "ditolak").length;
  const valid   = total - ditolak;

  $("#rkf-metrics").innerHTML = `
    <div class="metric">
      <div class="metric-lbl">TOTAL BARIS</div>
      <div class="metric-val navy">${total}</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">VALID</div>
      <div class="metric-val ok">${valid}</div>
    </div>
    <div class="metric">
      <div class="metric-lbl">ERROR</div>
      <div class="metric-val bad">${ditolak}</div>
    </div>`;

  $("#rkf-alert-bad").style.display = ditolak ? "" : "none";
  $("#rkf-alert-ok").style.display  = ditolak ? "none" : "";
  $("#rkf-tabel-judul").textContent = `Hasil Validasi — ${j.namaBerkas}`;

  $("#rkf-hasil-head").innerHTML = `<th>No</th>`
    + j.kolom.map(k => `<th>${esc(k)}</th>`).join("")
    + `<th>Status</th><th>Keterangan</th>`;

  $("#rkf-hasil-body").innerHTML = j.rows.map((r, i) => {
    const gagal = r.status === "ditolak";
    return `
      <tr>
        <td>${i + 1}</td>
        ${j.kolom.map((_, c) => `<td>${esc(r.nilai[c] || "-")}</td>`).join("")}
        <td><span class="pill ${gagal ? "pill-bad" : "pill-ok"}">${gagal ? "Error" : "Valid"}</span></td>
        <td class="${gagal ? "bad-txt" : ""}">${gagal ? r.alasan.map(a => `• ${esc(a)}`).join("<br>") : "—"}</td>
      </tr>`;
  }).join("");

  /* Simpan hanya boleh ditekan kalau tidak ada satu pun baris error. */
  $("#rkf-simpan").disabled = ditolak > 0;
}

$("#rkf-lanjut").onclick = () => {
  if (!rkfJenis || !rkfBerkas) { toast("Jenis Referensi dan berkas wajib diisi.", "bad"); return; }
  rkRenderValidasi();
  rkGotoStep(2);
  const ditolak = rkfJenis.rows.filter(r => r.status === "ditolak").length;
  toast(ditolak
    ? `Validasi selesai — ${ditolak} baris masih error.`
    : `Validasi selesai — seluruh ${rkfJenis.rows.length} baris valid.`, ditolak ? "bad" : "ok");
};

$("#rkf-validasi-kembali").onclick = () => rkGotoStep(1);
$("#rkf-export").onclick           = () => toast("Hasil validasi diekspor ke Excel.");

$("#rkf-simpan").onclick = () => {
  if ($("#rkf-simpan").disabled) return;
  const jenis = rkfJenis;
  let entri = rkRows.find(r => r.jenis === jenis.label);
  if (!entri) {
    entri = { jenis: jenis.label, berkas: [], _id: rkRows.length ? Math.max(...rkRows.map(r => r._id)) + 1 : 0 };
    rkRows.push(entri);
  }
  entri.berkas.unshift({
    nama:   jenis.namaBerkas,
    tgl:    unorTglHariIni(),
    baris:  jenis.rows.length,
    oleh:   PENGATURAN.namaUser,
    status: "Selesai"
  });
  renderRefKolektif();
  refKolektifGotoView("list");
  toast(`${jenis.rows.length} baris referensi ${jenis.label} berhasil disimpan.`, "ok");
};

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-rk-detail]");
  if (bDetail) { rkShowDetail(rkRows.find(r => r._id === +bDetail.dataset.rkDetail)); return; }

  const bStep = e.target.closest("[data-rkf-step]");
  if (bStep && !bStep.disabled) rkGotoStep(+bStep.dataset.rkfStep);
});

/* ============ PENGELOLAAN REFERENSI DATA KEPESERTAAN » STATUS PESERTA
   Daftar nilai Status Peserta yang boleh dipakai layar lain. Tanggal Buat
   diisi sistem saat entri dibuat, jadi tidak bisa diketik pengguna. Format
   tanggalnya sama dengan layar UNOR — helper unorTanggal()/unorTglHariIni()
   di atas dipakai ulang supaya tampilannya seragam satu sub modul. */
let stpRows = DATA_STATUS_PESERTA.map((s, i) => ({ ...s, _id: i }));

function stpBolehKelola() { return roleSaatIni() === ROLE_DIVISI; }

/* Pilihan filter mengikuti isi daftar supaya status baru ikut muncul; nilai
   yang sedang dipilih dipertahankan selama masih ada di daftar. */
function stpIsiFilter() {
  const sel = $("#stp-f-status");
  const dipilih = sel.value || "all";
  sel.innerHTML = `<option value="all">Semua Status Peserta</option>`
    + stpRows.map(s => `<option>${esc(s.status)}</option>`).join("");
  sel.value = stpRows.some(s => s.status === dipilih) ? dipilih : "all";
}

function stpBarisTersaring() {
  const f = $("#stp-f-status").value;
  return stpRows.filter(s => f === "all" || s.status === f);
}

function renderStatusPeserta() {
  stpIsiFilter();
  const boleh = stpBolehKelola();
  const rows  = stpBarisTersaring();

  $("#stp-body").innerHTML = rows.length ? rows.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(unorTanggal(s.tgl).panjang)}</td>
      <td class="t-strong">${esc(s.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-info btn-sm" data-stp-detail="${s._id}">👁 Detail</button>
        ${boleh ? `<button class="btn btn-danger btn-sm" data-stp-hapus="${s._id}" title="Hapus Status Peserta">⌫</button>` : ""}
      </td>
    </tr>`).join("")
    : `<tr><td colspan="4"><div class="empty"><h4>Tidak ada status peserta</h4><p>Ubah filter Status Peserta, atau tambahkan lewat tombol Tambah Status Peserta.</p></div></td></tr>`;

  $("#stp-tambah").style.display = boleh ? "" : "none";
  $("#stp-badge").textContent    = `${rows.length} entri`;
  $("#stp-count").textContent    = `Menampilkan ${rows.length} dari ${stpRows.length} status peserta.`;
}

/* Tanggal Buat ditampilkan readonly — nilainya selalu tanggal hari ini. */
$("#stp-tambah").onclick = () => {
  const hariIni = unorTglHariIni();
  $("#modal-title").textContent = "Tambah Status Peserta";
  $("#modal-sub").textContent   = "Status Peserta yang ditambahkan langsung tersedia sebagai pilihan di layar lain.";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Tanggal Buat</label>
      <input class="inp" id="stp-m-tgl" readonly value="${esc(unorTanggal(hariIni).panjang)}">
      <div class="hint">Terisi otomatis oleh sistem saat entri disimpan.</div>
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl">Status Peserta <span class="req">*</span></label>
      <input class="inp" id="stp-m-status" placeholder="Contoh: Cuti di Luar Tanggungan Negara">
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="stp-m-batal">Batal</button>
      <button class="btn btn-primary" id="stp-m-simpan">Simpan</button>
    </div>`;
  openModal();
  $("#stp-m-batal").onclick  = closeModal;
  $("#stp-m-simpan").onclick = () => {
    const status = $("#stp-m-status").value.trim();
    if (!status) { toast("Status Peserta wajib diisi.", "bad"); return; }
    if (stpRows.some(s => s.status.toLowerCase() === status.toLowerCase())) {
      toast(`Status Peserta ${status} sudah terdaftar.`, "bad");
      return;
    }
    stpRows.unshift({
      tgl: hariIni, status, oleh: PENGATURAN.namaUser,
      keterangan: "Belum ada keterangan.",
      _id: stpRows.length ? Math.max(...stpRows.map(s => s._id)) + 1 : 0
    });
    renderStatusPeserta();
    closeModal();
    toast("Status peserta baru berhasil disimpan.", "ok");
  };
};

function stpDetail(s) {
  $("#modal-title").textContent = "Detail Status Peserta";
  $("#modal-sub").textContent   = s.status;
  $("#modal-body").innerHTML = `
    <div class="review-card">
      <div class="review-card-head">Data Status Peserta</div>
      <div class="review-card-body">
        <div class="review-row"><div class="fl">Tanggal Buat</div><div class="val">${esc(unorTanggal(s.tgl).panjang)}</div></div>
        <div class="review-row"><div class="fl">Status Peserta</div><div class="val">${esc(s.status)}</div></div>
        <div class="review-row"><div class="fl">Dibuat Oleh</div><div class="val">${esc(s.oleh)}</div></div>
        <div class="review-row"><div class="fl">Keterangan</div><div class="val">${esc(s.keterangan)}</div></div>
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="stp-d-tutup">Tutup</button>
    </div>`;
  openModal();
  $("#stp-d-tutup").onclick = closeModal;
}

function stpHapus(s) {
  $("#modal-title").textContent = "Hapus Status Peserta";
  $("#modal-sub").textContent   = s.status;
  $("#modal-body").innerHTML = `
    <div class="alert alert-bad"><span>⚠</span><span>Status peserta yang dihapus tidak lagi tersedia sebagai pilihan pada pengisian data peserta. Pastikan tidak ada peserta yang masih memakai status ini.</span></div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="stp-h-batal">Batal</button>
      <button class="btn btn-danger-solid" id="stp-h-ya">Hapus</button>
    </div>`;
  openModal();
  $("#stp-h-batal").onclick = closeModal;
  $("#stp-h-ya").onclick    = () => {
    stpRows = stpRows.filter(x => x._id !== s._id);
    renderStatusPeserta();
    closeModal();
    toast(`Status peserta ${s.status} berhasil dihapus.`, "ok");
  };
}

$("#stp-cari").onclick   = () => renderStatusPeserta();
$("#stp-export").onclick = () => toast("Daftar status peserta diekspor ke Excel.");

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-stp-detail]");
  if (bDetail) { stpDetail(stpRows.find(s => s._id === +bDetail.dataset.stpDetail)); return; }

  const bHapus = e.target.closest("[data-stp-hapus]");
  if (bHapus) { stpHapus(stpRows.find(s => s._id === +bHapus.dataset.stpHapus)); return; }
});

/* ====== PENGELOLAAN REFERENSI DATA KEPESERTAAN » BATAS USIA PENSIUN
   Bentuknya sama persis dengan layar Status Peserta di atas: daftar nilai
   referensi dengan Tanggal Buat dari sistem, ditambah/dihapus lewat modal. */
let bupRows = DATA_BUP.map((b, i) => ({ ...b, _id: i }));

function bupBolehKelola() { return roleSaatIni() === ROLE_DIVISI; }

function bupIsiFilter() {
  const sel = $("#bup-f-nilai");
  const dipilih = sel.value || "all";
  sel.innerHTML = `<option value="all">Semua Batas Usia Pensiun</option>`
    + bupRows.map(b => `<option>${esc(b.bup)}</option>`).join("");
  sel.value = bupRows.some(b => b.bup === dipilih) ? dipilih : "all";
}

function bupBarisTersaring() {
  const f = $("#bup-f-nilai").value;
  return bupRows.filter(b => f === "all" || b.bup === f);
}

function renderBup() {
  bupIsiFilter();
  const boleh = bupBolehKelola();
  const rows  = bupBarisTersaring();

  $("#bup-body").innerHTML = rows.length ? rows.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(unorTanggal(b.tgl).panjang)}</td>
      <td class="t-strong">${esc(b.bup)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-info btn-sm" data-bup-detail="${b._id}">👁 Detail</button>
        ${boleh ? `<button class="btn btn-danger btn-sm" data-bup-hapus="${b._id}" title="Hapus Batas Usia Pensiun">⌫</button>` : ""}
      </td>
    </tr>`).join("")
    : `<tr><td colspan="4"><div class="empty"><h4>Tidak ada batas usia pensiun</h4><p>Ubah filter Batas Usia Pensiun, atau tambahkan lewat tombol Tambah Batas Usia Pensiun.</p></div></td></tr>`;

  $("#bup-tambah").style.display = boleh ? "" : "none";
  $("#bup-badge").textContent    = `${rows.length} entri`;
  $("#bup-count").textContent    = `Menampilkan ${rows.length} dari ${bupRows.length} batas usia pensiun.`;
}

$("#bup-tambah").onclick = () => {
  const hariIni = unorTglHariIni();
  $("#modal-title").textContent = "Tambah Batas Usia Pensiun";
  $("#modal-sub").textContent   = "Batas usia pensiun dipakai sebagai acuan perhitungan hak peserta.";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl">Tanggal Buat</label>
      <input class="inp" id="bup-m-tgl" readonly value="${esc(unorTanggal(hariIni).panjang)}">
      <div class="hint">Terisi otomatis oleh sistem saat entri disimpan.</div>
    </div>
    <div class="grid2">
      <div class="field">
        <label class="fl">Angkatan <span class="req">*</span></label>
        <select class="inp" id="bup-m-angkatan">
          <option value="">Pilih Angkatan</option>
          ${BUP_ANGKATAN.map(a => `<option>${esc(a)}</option>`).join("")}
        </select>
      </div>
      <div class="field" id="bup-m-gol-field">
        <label class="fl">Golongan <span class="req">*</span></label>
        <select class="inp" id="bup-m-gol" disabled>
          <option value="">Pilih Angkatan lebih dulu</option>
        </select>
      </div>
    </div>
    <div class="field" style="margin-bottom:0">
      <label class="fl">Batas Usia Pensiun <span class="req">*</span></label>
      <div style="display:flex;align-items:center;gap:8px">
        <input class="inp" type="number" id="bup-m-nilai" min="1" max="99" placeholder="Contoh: 58">
        <span style="color:var(--muted)">Tahun</span>
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bup-m-batal">Batal</button>
      <button class="btn btn-primary" id="bup-m-simpan">Simpan</button>
    </div>`;
  openModal();

  /* Golongan mengikuti Angkatan; ASN tidak punya Golongan sehingga fieldnya
     disembunyikan. */
  $("#bup-m-angkatan").onchange = () => {
    const angkatan = $("#bup-m-angkatan").value;
    const daftar   = BUP_GOLONGAN[angkatan];
    const sel      = $("#bup-m-gol");
    $("#bup-m-gol-field").style.display = daftar ? "" : "none";
    sel.disabled  = !daftar;
    sel.innerHTML = daftar
      ? `<option value="">Pilih Golongan</option>` + daftar.map(g => `<option>${esc(g)}</option>`).join("")
      : `<option value="">Pilih Angkatan lebih dulu</option>`;
  };

  $("#bup-m-batal").onclick  = closeModal;
  $("#bup-m-simpan").onclick = () => {
    const angkatan = $("#bup-m-angkatan").value;
    const golongan = $("#bup-m-gol").value;
    const usia     = $("#bup-m-nilai").value.trim();
    if (!angkatan) { toast("Angkatan wajib dipilih.", "bad"); return; }
    if (BUP_GOLONGAN[angkatan] && !golongan) { toast("Golongan wajib dipilih.", "bad"); return; }
    if (!usia) { toast("Batas Usia Pensiun wajib diisi.", "bad"); return; }
    if (!/^\d+$/.test(usia) || +usia < 1) { toast("Batas Usia Pensiun harus berupa angka tahun.", "bad"); return; }
    const nilai = `${+usia} Tahun`;
    const gol   = BUP_GOLONGAN[angkatan] ? golongan : "";
    if (bupRows.some(b => b.angkatan === angkatan && (b.golongan || "") === gol && b.bup.toLowerCase() === nilai.toLowerCase())) {
      toast("Batas usia pensiun tersebut sudah terdaftar.", "bad");
      return;
    }
    bupRows.unshift({
      tgl: hariIni, angkatan, golongan: gol,
      bup: nilai, oleh: PENGATURAN.namaUser,
      keterangan: "Belum ada keterangan.",
      _id: bupRows.length ? Math.max(...bupRows.map(b => b._id)) + 1 : 0
    });
    renderBup();
    closeModal();
    toast("Batas usia pensiun baru berhasil disimpan.", "ok");
  };
};

function bupDetail(b) {
  $("#modal-title").textContent = "Detail Batas Usia Pensiun";
  $("#modal-sub").textContent   = b.bup;
  $("#modal-body").innerHTML = `
    <div class="review-card">
      <div class="review-card-head">Data Batas Usia Pensiun</div>
      <div class="review-card-body">
        <div class="review-row"><div class="fl">Tanggal Buat</div><div class="val">${esc(unorTanggal(b.tgl).panjang)}</div></div>
        <div class="review-row"><div class="fl">Angkatan</div><div class="val">${esc(b.angkatan || "-")}</div></div>
        <div class="review-row"><div class="fl">Golongan</div><div class="val">${esc(b.golongan || "-")}</div></div>
        <div class="review-row"><div class="fl">Batas Usia Pensiun</div><div class="val">${esc(b.bup)}</div></div>
        <div class="review-row"><div class="fl">Dibuat Oleh</div><div class="val">${esc(b.oleh)}</div></div>
        <div class="review-row"><div class="fl">Keterangan</div><div class="val">${esc(b.keterangan)}</div></div>
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bup-d-tutup">Tutup</button>
    </div>`;
  openModal();
  $("#bup-d-tutup").onclick = closeModal;
}

function bupHapus(b) {
  $("#modal-title").textContent = "Hapus Batas Usia Pensiun";
  $("#modal-sub").textContent   = b.bup;
  $("#modal-body").innerHTML = `
    <div class="alert alert-bad"><span>⚠</span><span>Batas usia pensiun yang dihapus tidak lagi dipakai sebagai acuan perhitungan hak peserta. Pastikan tidak ada perhitungan berjalan yang masih merujuk entri ini.</span></div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bup-h-batal">Batal</button>
      <button class="btn btn-danger-solid" id="bup-h-ya">Hapus</button>
    </div>`;
  openModal();
  $("#bup-h-batal").onclick = closeModal;
  $("#bup-h-ya").onclick    = () => {
    bupRows = bupRows.filter(x => x._id !== b._id);
    renderBup();
    closeModal();
    toast("Batas usia pensiun berhasil dihapus.", "ok");
  };
}

$("#bup-cari").onclick   = () => renderBup();
$("#bup-export").onclick = () => toast("Daftar batas usia pensiun diekspor ke Excel.");

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-bup-detail]");
  if (bDetail) { bupDetail(bupRows.find(b => b._id === +bDetail.dataset.bupDetail)); return; }

  const bHapus = e.target.closest("[data-bup-hapus]");
  if (bHapus) { bupHapus(bupRows.find(b => b._id === +bHapus.dataset.bupHapus)); return; }
});

/* ============================================================ SPP DATA PESERTA
   Alur: permohonan dari Kantor Cabang → officer memverifikasi terhadap
   rekomendasi data peserta serupa (restore) atau menginput data baru →
   workflow persetujuan → data peserta tersedia di YANDU NextGen. */
let sppRows = DATA_SPP.map((r, i) => ({ ...r, _id: i, rekomendasi: r.rekomendasi.map(k => ({ ...k })) }));

const SPP_PAGE_SIZE = 5;
const SPP_TAB_STATUS = {
  verifikasi: ["Menunggu Verifikasi"],
  approval:   ["Menunggu Persetujuan"],
  riwayat:    ["Disetujui", "Ditolak"]
};
const SPP_TAB_JUDUL = { verifikasi:"Permohonan Masuk", approval:"Menunggu Persetujuan", riwayat:"Riwayat Permohonan" };
let sppTab = "verifikasi";
let sppPage = 1;
let sppCurrent = null;      // permohonan yang sedang dibuka
let sppTindakan = "";       // "Restore Data" | "Input Data Baru"
let sppModeBaca = false;    // true = hanya melihat (tab Riwayat / Persetujuan)

function sppPillStatus(s) {
  return s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad"
       : s === "Menunggu Persetujuan" ? "pill-info" : "pill-warn";
}
function sppPillSumber(s) { return s === "Belum Termigrasi" ? "pill-info" : s === "Data Terhapus" ? "pill-warn" : "pill-info"; }
function sppPillSkor(n)   { return n >= 90 ? "pill-ok" : n >= 70 ? "pill-warn" : "pill-bad"; }

function isiPilihanSpp() {
  const cabang = [...new Set(sppRows.map(r => r.cabang))].sort();
  $("#spp-f-cabang").innerHTML = `<option value="all">Semua Kantor Cabang</option>`
    + cabang.map(c => `<option>${esc(c)}</option>`).join("");
}

function sppBarisTersaring() {
  const fCari     = ($("#spp-f-cari").value || "").toLowerCase();
  const fCabang   = $("#spp-f-cabang").value;
  const fTindakan = $("#spp-f-tindakan").value;
  return sppRows.filter(r =>
    SPP_TAB_STATUS[sppTab].includes(r.status) &&
    (fCabang   === "all" || r.cabang   === fCabang) &&
    (fTindakan === "all" || r.tindakan === fTindakan) &&
    (!fCari || r.nama.toLowerCase().includes(fCari) || r.kpa.toLowerCase().includes(fCari)
            || r.nrp.includes(fCari) || r.no.toLowerCase().includes(fCari)));
}

function sppPaginationHtml(totalPages) {
  const nav = (p, label, disabled) => `<button class="btn btn-ghost btn-sm" style="min-width:30px;padding:0" ${disabled ? "disabled" : `data-spp-page="${p}"`}>${label}</button>`;
  let html = nav(sppPage - 1, "‹", sppPage <= 1);
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn ${p === sppPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-spp-page="${p}">${p}</button>`;
  }
  return html + nav(sppPage + 1, "›", sppPage >= totalPages);
}

function sppAksiHtml(r) {
  /* Verifikasi dan persetujuan adalah kewenangan Divisi Kepesertaan; Kantor
     Cabang sebagai pengaju hanya memantau permohonannya. */
  if (roleSaatIni() !== ROLE_DIVISI) return `<button class="btn btn-info btn-sm" data-spp-detail="${r._id}">👁 Detail</button>`;
  if (r.status === "Menunggu Verifikasi") return `<button class="btn btn-info btn-sm" data-spp-verifikasi="${r._id}">⌕ Verifikasi</button>`;
  if (r.status === "Menunggu Persetujuan") return `
    <button class="btn btn-info btn-sm" data-spp-detail="${r._id}">👁 Detail</button>
    <button class="btn btn-success btn-sm" data-spp-setuju="${r._id}">✓ Setujui</button>
    <button class="btn btn-danger btn-sm" data-spp-tolak="${r._id}">✕ Tolak</button>`;
  return `<button class="btn btn-info btn-sm" data-spp-detail="${r._id}">👁 Detail</button>`;
}

function renderSppMetrik() {
  $("#spp-m-total").textContent      = sppRows.length;
  $("#spp-m-verifikasi").textContent = sppRows.filter(r => r.status === "Menunggu Verifikasi").length;
  $("#spp-m-approval").textContent   = sppRows.filter(r => r.status === "Menunggu Persetujuan").length;
  $("#spp-m-selesai").textContent    = sppRows.filter(r => r.status === "Disetujui").length;
}

function renderSpp() {
  const rows       = sppBarisTersaring();
  const totalPages = Math.max(1, Math.ceil(rows.length / SPP_PAGE_SIZE));
  if (sppPage > totalPages) sppPage = totalPages;
  const start    = (sppPage - 1) * SPP_PAGE_SIZE;
  const pageRows = rows.slice(start, start + SPP_PAGE_SIZE);

  $("#spp-tbl-title").textContent = SPP_TAB_JUDUL[sppTab];
  $("#spp-body").innerHTML = pageRows.length ? pageRows.map(r => `
    <tr>
      <td class="t-strong">${esc(r.no)}</td>
      <td>${esc(r.tgl)}</td>
      <td>${esc(r.kpa)}</td>
      <td><div class="t-strong">${esc(r.nama)}</div><div class="hint" style="margin:1px 0 0">${esc(r.kesatuan)}</div></td>
      <td>${esc(r.nrp)}</td>
      <td>${esc(r.cabang)}</td>
      <td>${r.dokumen.length} berkas</td>
      <td>${r.tindakan ? `<span class="pill pill-info">${esc(r.tindakan)}</span>` : "—"}</td>
      <td><span class="pill ${sppPillStatus(r.status)}">${esc(r.status)}</span></td>
      <td style="white-space:nowrap">${sppAksiHtml(r)}</td>
    </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty"><h4>Tidak ada permohonan</h4><p>Coba ubah tab, filter, atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + SPP_PAGE_SIZE, rows.length);
  $("#spp-count").textContent    = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} permohonan`;
  $("#spp-pagination").innerHTML = sppPaginationHtml(totalPages);
  renderSppMetrik();
}

/* ------------------------------------------ Verifikasi / detail satu permohonan */
function sppTampilkanDaftar() {
  $("#spp-list-view").style.display   = "";
  $("#spp-detail-view").style.display = "none";
  $("#spp-crumb").innerHTML = `<span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><b>SPP Data Peserta</b>`;
  sppCurrent = null;
}

function sppSetTindakan(nilai) {
  sppTindakan = nilai;
  $("#spp-d-tindakan").innerHTML = nilai
    ? `<span class="pill pill-info">${esc(nilai)}</span>`
    : "—";
}

function sppBuka(r, modeBaca) {
  sppCurrent  = r;
  sppModeBaca = modeBaca || roleSaatIni() !== ROLE_DIVISI;
  sppTindakan = r.tindakan || "";

  $("#spp-list-view").style.display   = "none";
  $("#spp-detail-view").style.display = "";
  $("#spp-crumb").innerHTML = `<span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><span>SPP Data Peserta</span><span>›</span><b>${esc(r.no)}</b>`;
  $("#spp-d-title").textContent = modeBaca ? `Detail Permohonan ${r.no}` : `Verifikasi Permohonan ${r.no}`;
  $("#spp-d-sub").textContent   = modeBaca
    ? "Ringkasan hasil verifikasi dan dokumen permohonan."
    : "Cek data pengajuan dan dokumen, lalu tentukan apakah data peserta di-restore atau diinput baru.";

  const baris = [
    ["No. Permohonan", r.no], ["Tanggal Pengajuan", r.tgl], ["Status", r.status],
    ["Nomor KPA", r.kpa], ["Nama Peserta", r.nama], ["NRP / NIP", r.nrp],
    ["NIK", r.nik], ["Tanggal Lahir", r.tglLahir], ["Pangkat / Golongan", r.pangkat],
    ["Kesatuan / Satker", r.kesatuan], ["Kantor Cabang Pengaju", r.cabang], ["Officer Pengaju", r.pengaju],
    ["No. Request Umum", r.noRequest]
  ];
  $("#spp-d-pengajuan").innerHTML = baris.map(([label, nilai]) => `
    <div class="review-row">
      <div class="fl">${esc(label)}</div>
      <div class="val">${label === "Status" ? `<span class="pill ${sppPillStatus(nilai)}">${esc(nilai)}</span>` : esc(nilai)}</div>
    </div>`).join("");

  $("#spp-d-dokumen").innerHTML = r.dokumen.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="t-strong">${esc(d)}</td>
      <td><button class="btn btn-ghost btn-sm" data-spp-unduh="${esc(d)}">⭳ Unduh</button></td>
    </tr>`).join("");

  $("#spp-d-rekom-count").textContent = `${r.rekomendasi.length} data serupa`;
  $("#spp-d-rekom-body").innerHTML = r.rekomendasi.length ? r.rekomendasi.map((k, i) => `
    <tr>
      <td class="t-strong">${esc(k.nama)}</td>
      <td>${esc(k.nrp)}</td>
      <td>${esc(k.kpa)}</td>
      <td>${esc(k.tglLahir)}</td>
      <td>${esc(k.satker)}</td>
      <td><span class="pill ${sppPillSumber(k.sumber)}">${esc(k.sumber)}</span></td>
      <td><span class="pill ${sppPillSkor(k.skor)}">${k.skor}%</span></td>
      <td>${sppModeBaca ? "—" : `<button class="btn btn-success btn-sm" data-spp-restore="${i}">✓ Pilih & Restore</button>`}</td>
    </tr>`).join("")
    : `<tr><td colspan="8"><div class="empty"><h4>Tidak ada data serupa</h4><p>Sistem tidak menemukan data peserta yang mirip — lanjutkan dengan penambahan data peserta baru.</p></div></td></tr>`;

  // Form penambahan data baru: prefill dari data pengajuan, kode dari tabel referensi
  const aktif = refRows.filter(x => x.status === "Aktif");
  const opsi  = (jenis, terpilih) => aktif.filter(x => x.jenis === jenis)
    .map(x => `<option ${x.uraian === terpilih ? "selected" : ""}>${esc(x.uraian)}</option>`).join("")
    + (aktif.some(x => x.jenis === jenis && x.uraian === terpilih) ? "" : `<option selected>${esc(terpilih)}</option>`);
  $("#spp-b-kpa").value      = r.kpa;
  $("#spp-b-nama").value     = r.nama;
  $("#spp-b-nrp").value      = r.nrp;
  $("#spp-b-nik").value      = r.nik;
  $("#spp-b-lahir").value    = r.tglLahir;
  $("#spp-b-kancab").value   = r.cabang;
  $("#spp-b-pangkat").innerHTML  = opsi("Pangkat", r.pangkat);
  $("#spp-b-kesatuan").innerHTML = opsi("Satker/Kesatuan", r.kesatuan);
  $("#spp-form-baru").style.display = sppTindakan === "Input Data Baru" ? "" : "none";

  $$("#spp-form-baru .inp").forEach(el => { el.disabled = sppModeBaca; });

  $("#spp-d-catatan").value    = r.catatan || "";
  $("#spp-d-catatan").disabled = sppModeBaca;
  $("#spp-input-baru").style.display = sppModeBaca ? "none" : "";
  $("#spp-d-aksi").style.display     = sppModeBaca ? "none" : "";
  sppSetTindakan(sppTindakan);
}

$("#spp-kembali").onclick = sppTampilkanDaftar;

$("#spp-input-baru").onclick = () => {
  sppSetTindakan("Input Data Baru");
  $("#spp-form-baru").style.display = "";
  toast("Lengkapi form penambahan data peserta baru.");
};

$("#spp-ajukan").onclick = () => {
  const r = sppCurrent;
  if (!sppTindakan) { toast("Pilih data rekomendasi untuk di-restore atau tekan Input Data Baru.", "bad"); return; }
  const catatan = $("#spp-d-catatan").value.trim();
  if (!catatan) { toast("Catatan verifikasi wajib diisi.", "bad"); return; }
  if (sppTindakan === "Input Data Baru") {
    const wajib = ["#spp-b-kpa", "#spp-b-nama", "#spp-b-nrp", "#spp-b-nik", "#spp-b-lahir"];
    if (wajib.some(sel => !$(sel).value.trim())) { toast("Lengkapi seluruh field wajib pada form data peserta baru.", "bad"); return; }
    r.nama    = $("#spp-b-nama").value.trim();
    r.nrp     = $("#spp-b-nrp").value.trim();
    r.nik     = $("#spp-b-nik").value.trim();
    r.pangkat = $("#spp-b-pangkat").value;
    r.kesatuan = $("#spp-b-kesatuan").value;
  }
  r.tindakan = sppTindakan;
  r.catatan  = catatan;
  r.status   = "Menunggu Persetujuan";
  sppTab  = "approval";
  sppPage = 1;
  $$("[data-spp-tab]").forEach(x => x.classList.toggle("active", x.dataset.sppTab === "approval"));
  renderSpp();
  sppTampilkanDaftar();
  toast(`Permohonan ${r.no} diajukan ke persetujuan.`, "ok");
};

$("#spp-tolak").onclick = () => {
  const r = sppCurrent;
  const catatan = $("#spp-d-catatan").value.trim();
  if (!catatan) { toast("Catatan verifikasi wajib diisi sebagai alasan penolakan.", "bad"); return; }
  r.status   = "Ditolak";
  r.catatan  = catatan;
  r.tindakan = "";
  renderSpp();
  sppTampilkanDaftar();
  toast(`Permohonan ${r.no} ditolak dan dikembalikan ke Kantor Cabang.`, "ok");
};

$("#spp-cari").onclick   = () => { sppPage = 1; renderSpp(); };
$("#spp-export").onclick = () => toast("Daftar permohonan SPP diekspor ke Excel.");

$$("[data-spp-tab]").forEach(t => t.onclick = () => {
  $$("[data-spp-tab]").forEach(x => x.classList.toggle("active", x === t));
  sppTab  = t.dataset.sppTab;
  sppPage = 1;
  renderSpp();
});

document.addEventListener("click", e => {
  const bPage = e.target.closest("[data-spp-page]");
  if (bPage) { sppPage = +bPage.dataset.sppPage; renderSpp(); return; }

  const bVerifikasi = e.target.closest("[data-spp-verifikasi]");
  if (bVerifikasi) { sppBuka(sppRows.find(r => r._id === +bVerifikasi.dataset.sppVerifikasi), false); return; }

  const bDetail = e.target.closest("[data-spp-detail]");
  if (bDetail) { sppBuka(sppRows.find(r => r._id === +bDetail.dataset.sppDetail), true); return; }

  const bRestore = e.target.closest("[data-spp-restore]");
  if (bRestore) {
    const k = sppCurrent.rekomendasi[+bRestore.dataset.sppRestore];
    sppSetTindakan("Restore Data");
    $("#spp-form-baru").style.display = "none";
    $("#spp-d-catatan").value = `Data ditemukan pada sumber ${k.sumber} (kemiripan ${k.skor}%) atas nama ${k.nama} — ${k.nrp}. Data diaktifkan kembali sesuai dokumen persyaratan.`;
    toast(`Data ${k.nama} dipilih untuk di-restore.`, "ok");
    return;
  }

  const bUnduh = e.target.closest("[data-spp-unduh]");
  if (bUnduh) { toast(`Dokumen diunduh: ${bUnduh.dataset.sppUnduh}`); return; }

  const bSetuju = e.target.closest("[data-spp-setuju]");
  if (bSetuju) {
    const r = sppRows.find(x => x._id === +bSetuju.dataset.sppSetuju);
    r.status  = "Disetujui";
    r.catatan = `${r.catatan} Disetujui — data peserta tersedia di YANDU NextGen dan siap dipakai Kantor Cabang.`;
    renderSpp();
    toast(`Permohonan ${r.no} disetujui — data peserta kini tersedia di sistem.`, "ok");
    return;
  }

  const bTolak = e.target.closest("[data-spp-tolak]");
  if (bTolak) {
    const r = sppRows.find(x => x._id === +bTolak.dataset.sppTolak);
    $("#modal-title").textContent = "Tolak Permohonan SPP";
    $("#modal-sub").textContent   = `${r.no} · ${r.nama} · ${r.cabang}`;
    $("#modal-body").innerHTML = `
      <div class="field" style="margin-bottom:0">
        <label class="fl">Alasan Penolakan <span class="req">*</span></label>
        <textarea class="inp" id="spp-tolak-alasan" style="height:80px;padding:9px 10px;resize:vertical"></textarea>
      </div>
      <div class="form-actions" style="justify-content:flex-end">
        <button class="btn btn-ghost" id="spp-tolak-batal">Batal</button>
        <button class="btn btn-danger-solid" id="spp-tolak-kirim">Tolak Permohonan</button>
      </div>`;
    openModal();
    $("#spp-tolak-batal").onclick = closeModal;
    $("#spp-tolak-kirim").onclick = () => {
      const alasan = $("#spp-tolak-alasan").value.trim();
      if (!alasan) { toast("Alasan penolakan wajib diisi.", "bad"); return; }
      r.status   = "Ditolak";
      r.tindakan = "";
      r.catatan  = alasan;
      renderSpp();
      closeModal();
      toast(`Permohonan ${r.no} ditolak.`, "ok");
    };
  }
});

isiPilihanUnor();
renderUnor();
isiPilihanRefKolektif();
renderRefKolektif();
renderStatusPeserta();
renderBup();
isiPilihanSpp();
renderSpp();


/* ================================================== PEMBATALAN KPR (BUM)
   Satu daftar untuk semua pembatalan; cara prosesnya dibedakan oleh
   `statusPeserta` saat surat pembatalan YPPSDP masuk (lihat
   BUM_STATUS_PESERTA di data.js):

   "Aktif"   — surat langsung dari YPPSDP ke ASABRI, Div. Kepesertaan tinggal
     merekam empat data pembatalan, lalu bisa diekspor.
   "Pensiun" — sudah proses klaim THT / sudah pensiun. Pengajuan masuk lewat
     Request Umum Kantor Cabang beserta kelengkapan dokumen, dan baru selesai
     setelah Divisi Keuangan menerbitkan SP pembayaran pemotongan (No SP,
     Tanggal DPS, No DPS) — tiga kolom itu yang hanya terisi di sini. */

let bumPembatalanRows = DATA_BUM_PEMBATALAN.map((r, i) => ({ ...r, _id: i }));
let bpbPage = 1;

const BPB_PILL_STATUS  = { "Tercatat":"pill-info", "Menunggu SP":"pill-warn", "Selesai":"pill-ok" };
const BPB_PILL_PESERTA = { "Aktif":"pill-info", "Pensiun":"pill-warn" };

function isiPilihanBpb() {
  $("#bpb-f-keterangan").innerHTML =
    `<option value="all">Semua</option>` +
    BUM_PEMBATALAN_KETERANGAN.map(k => `<option>${esc(k)}</option>`).join("");
}

function renderBumPembatalan() {
  const fDari       = $("#bpb-f-dari").value;
  const fSampai     = $("#bpb-f-sampai").value;
  const fCabang     = ($("#bpb-f-cabang").value || "").toLowerCase();
  const fKtpa       = ($("#bpb-f-ktpa").value   || "").toLowerCase();
  const fNrp        = ($("#bpb-f-nrp").value    || "").toLowerCase();
  const fNama       = ($("#bpb-f-nama").value   || "").toLowerCase();
  const fPeserta    = $("#bpb-f-peserta").value;
  const fKeterangan = $("#bpb-f-keterangan").value;
  const fStatus     = $("#bpb-f-status").value;

  const rows = bumPembatalanRows.filter(r =>
    (fPeserta    === "all" || r.statusPeserta === fPeserta) &&
    (fKeterangan === "all" || r.keterangan    === fKeterangan) &&
    (fStatus     === "all" || r.status        === fStatus) &&
    (!fCabang || r.cabang.toLowerCase().includes(fCabang)) &&
    (!fKtpa   || r.kpa.toLowerCase().includes(fKtpa)) &&
    (!fNrp    || r.nrp.includes(fNrp)) &&
    (!fNama   || r.nama.toLowerCase().includes(fNama)) &&
    (!fDari   || r.tglSurat >= fDari) &&
    (!fSampai || r.tglSurat <= fSampai));

  const pageSize   = +$("#bpb-page-size").value;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (bpbPage > totalPages) bpbPage = totalPages;
  const start    = (bpbPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("#bpb-body").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td class="stick-l">${start + i + 1}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td>${esc(r.nrp)}</td>
      <td>${esc(r.kpa)}</td>
      <td><span class="pill ${BPB_PILL_PESERTA[r.statusPeserta]}">${esc(r.statusPeserta)}</span></td>
      <td>${esc(r.keterangan)}</td>
      <td>${rp(r.nominal)}</td>
      <td>${esc(r.noSurat)}</td>
      <td>${esc(fmtTgl(r.tglSurat))}</td>
      <td>${esc(r.noSp || "—")}</td>
      <td>${esc(fmtTgl(r.tglDps) || "—")}</td>
      <td>${esc(r.noDps || "—")}</td>
      <td>${esc(r.cabang)}</td>
      <td><span class="pill ${BPB_PILL_STATUS[r.status]}">${esc(r.status)}</span></td>
      <td class="stick-r" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-bpb-detail="${r._id}">👁 Detail</button>
        ${r.status === "Menunggu SP"
            ? `<button class="btn btn-info btn-sm" data-bpb-sp="${r._id}">🧾 Terbitkan SP</button>` : ""}
      </td>
    </tr>`).join("")
    : `<tr><td colspan="15"><div class="empty"><h4>Tidak ada data</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

  const shownFrom = rows.length ? start + 1 : 0;
  const shownTo   = Math.min(start + pageSize, rows.length);
  $("#bpb-count").textContent = `Menampilkan ${shownFrom}-${shownTo} dari ${rows.length} pembatalan`;

  $("#bpb-pagination").innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
    <button class="btn ${p === bpbPage ? "btn-primary" : "btn-ghost"} btn-sm" style="min-width:30px;padding:0" data-bpb-page="${p}">${p}</button>
  `).join("");
}

$("#bpb-cari").onclick       = () => { bpbPage = 1; renderBumPembatalan(); };
$("#bpb-page-size").onchange = () => { bpbPage = 1; renderBumPembatalan(); };
$("#bpb-export-excel").onclick = () => toast(
  "Data pembatalan diekspor ke Excel: Nama, NRP, Nomor KTPA, Nominal, Nomor & Tanggal surat pembatalan, " +
  "beserta Nomor SP pembatalan, Tanggal DPS, dan Nomor DPS untuk peserta pensiun.");

/* ------------------------------------------------------------ Halaman Detail
   Field mengikuti kolom tabel dan dikunci — halaman ini hanya untuk melihat.
   Blok "Pengajuan Kantor Cabang" dan "Penerbitan SP Pembayaran" hanya muncul
   untuk peserta pensiun, karena keduanya tidak ada pada peserta aktif. */
let bpbDetailRow = null;

function renderBumPembatalanDetail() {
  const r = bpbDetailRow;
  if (!r) return;

  $("#bpbd-title").textContent   = r.nama;
  $("#bpbd-sub").textContent     = `${r.kpa} · ${r.nrp} · ${r.nomorPinjaman}`;
  $("#bpbd-peserta").className   = "pill " + BPB_PILL_PESERTA[r.statusPeserta];
  $("#bpbd-peserta").textContent = "Peserta " + r.statusPeserta;
  $("#bpbd-status").className    = "pill " + BPB_PILL_STATUS[r.status];
  $("#bpbd-status").textContent  = r.status;
  $("#bpbd-sp").style.display    = r.status === "Menunggu SP" ? "" : "none";

  const dokumen = r.dokumen || [];
  $("#bpbd-body").innerHTML = `
    <div class="subsection-title">Data Peserta</div>
    <div class="grid2">
      ${bplDetailField("Nama", r.nama, true)}
      ${bplDetailField("NRP/NIP", r.nrp)}
      ${bplDetailField("Nomor KTPA", r.kpa)}
      ${bplDetailField("Status Peserta", r.statusPeserta)}
      ${bplDetailField("Kantor Cabang", r.cabang)}
      ${bplDetailField("Nomor Pinjaman", r.nomorPinjaman)}
      ${bplDetailField("Jenis Pinjaman", r.jenisPinjaman)}
    </div>

    <div class="subsection-title">Data Pembatalan</div>
    <div class="grid2">
      ${bplDetailField("Status Keterangan Pembatalan", r.keterangan, true)}
      ${bplDetailField("Nomor Surat Pembatalan", r.noSurat)}
      ${bplDetailField("Tanggal Surat Pembatalan", fmtTgl(r.tglSurat))}
      ${bplDetailField("Nominal Pembatalan", rp(r.nominal), true)}
    </div>

    ${r.statusPeserta === "Pensiun" ? `
      <div class="subsection-title">Pengajuan Kantor Cabang</div>
      <div class="grid2">
        ${bplDetailField("Nomor Request Umum", r.noRequest)}
        ${bplDetailField("Diajukan Oleh", r.cabang)}
      </div>
      <div style="margin-top:6px">
        ${BUM_PEMBATALAN_DOKUMEN.map(d => `
          <div class="doc-row">
            <div class="doc-info"><span class="doc-ico">📄</span><div class="doc-label">${esc(d)}</div></div>
            <div class="doc-actions">
              <span class="pill ${dokumen.includes(d) ? "pill-ok" : "pill-bad"}">${dokumen.includes(d) ? "✓ Lengkap" : "Belum diunggah"}</span>
            </div>
          </div>`).join("")}
      </div>

      <div class="subsection-title">Penerbitan SP Pembayaran — Divisi Keuangan</div>
      <div class="grid2">
        ${bplDetailField("Nomor SP Pembatalan", r.noSp)}
        ${bplDetailField("Nomor DPS", r.noDps)}
        ${bplDetailField("Tanggal DPS", fmtTgl(r.tglDps), true)}
      </div>
      ${r.status === "Menunggu SP"
        ? `<div class="alert alert-warn" style="margin-top:14px"><span>⚠</span><span>SP pembayaran pemotongan BUM KPR belum diterbitkan Divisi Keuangan, sehingga Nomor SP, Tanggal DPS, dan Nomor DPS belum terisi pada data pembatalan.</span></div>`
        : `<div class="alert alert-ok" style="margin-top:14px"><span>✓</span><span>SP pembayaran pemotongan BUM KPR sudah terbit. Seluruh kolom data pembatalan untuk peserta pensiun sudah lengkap.</span></div>`}
    ` : `<div class="alert alert-info" style="margin-top:18px"><span>ⓘ</span><span>Peserta masih aktif saat surat pembatalan diterima, sehingga pembatalan tidak melalui Request Umum dan tidak memerlukan SP pembayaran pemotongan.</span></div>`}`;
}
function bpbShowDetail(r) {
  if (!r) return;
  bpbDetailRow = r;
  renderBumPembatalanDetail();
  go("bum-pembatalan-detail");
}
$("#bpbd-kembali").onclick      = () => go("bum-pembatalan");
$("#bpbd-kembali-atas").onclick = () => go("bum-pembatalan");
$("#bpbd-sp").onclick           = () => bpbShowSp(bpbDetailRow);

/* --------------------------------------------- Proses Pembatalan BUM KPR
   Nomor KTPA diketik lebih dulu; data peserta dan pinjamannya terisi dari
   DATA_BUM, sedangkan Status Peserta diambil dari BUM_STATUS_PESERTA. Blok
   "Pengajuan Kantor Cabang" muncul otomatis hanya untuk peserta pensiun. */
function bpbAutofillFromKtpa() {
  const kpa = ($("#bpp-ktpa").value || "").trim().toUpperCase();
  $("#bpp-ktpa").value = kpa;

  const src           = DATA_BUM.find(x => x.kpa === kpa);
  const statusPeserta = src ? (BUM_STATUS_PESERTA[kpa] || "") : "";

  $("#bpp-nrp").value      = src ? src.nrp : "";
  $("#bpp-nama").value     = src ? src.nama : "";
  $("#bpp-cabang").value   = src ? src.cabang : "";
  $("#bpp-pinjaman").value = src ? src.nomorPinjaman : "";
  $("#bpp-jenis").value    = src ? src.jenisPinjaman : "";
  $("#bpp-status").value   = statusPeserta;

  $("#bpp-blok-pensiun").style.display = statusPeserta === "Pensiun" ? "" : "none";

  const nota = $("#bpp-nota");
  if (!kpa) {
    nota.className = "alert alert-info";
    nota.innerHTML = `<span>ⓘ</span><span>Masukkan Nomor KTPA peserta — status peserta dan kelengkapan yang diperlukan akan menyesuaikan otomatis.</span>`;
  } else if (!statusPeserta) {
    nota.className = "alert alert-bad";
    nota.innerHTML = `<span>⚠</span><span>Nomor KTPA tidak ditemukan pada data pinjaman BUM KPR.</span>`;
  } else if (statusPeserta === "Aktif") {
    nota.className = "alert alert-info";
    nota.innerHTML = `<span>ⓘ</span><span>Peserta masih aktif — surat pembatalan diterima langsung dari YPPSDP, tanpa Request Umum dan tanpa SP pembayaran pemotongan.</span>`;
  } else {
    nota.className = "alert alert-warn";
    nota.innerHTML = `<span>⚠</span><span>Peserta sudah proses klaim THT / pensiun — pembatalan wajib melalui Request Umum Kantor Cabang, lalu ditutup SP pembayaran pemotongan dari Divisi Keuangan.</span>`;
  }
}

function bpbShowProses() {
  $("#modal-title").textContent = "Proses Pembatalan BUM KPR";
  $("#modal-sub").textContent   = "Perekaman surat pembatalan BUM KPR dari YPPSDP.";
  $("#modal-body").innerHTML = `
    <div class="alert alert-info" id="bpp-nota"><span>ⓘ</span><span>Masukkan Nomor KTPA peserta — status peserta dan kelengkapan yang diperlukan akan menyesuaikan otomatis.</span></div>

    <div class="subsection-title">Data Peserta</div>
    <div class="grid2">
      <div class="field">
        <label class="fl">Nomor KTPA <span class="req">*</span></label>
        <input class="inp" id="bpp-ktpa" placeholder="-- Masukkan Nomor KTPA --">
      </div>
      <div class="field">
        <label class="fl">NRP/NIP <span class="req">*</span></label>
        <input class="inp" id="bpp-nrp" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
      <div class="field">
        <label class="fl">Nama <span class="req">*</span></label>
        <input class="inp" id="bpp-nama" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
      <div class="field">
        <label class="fl">Kantor Cabang <span class="req">*</span></label>
        <input class="inp" id="bpp-cabang" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
      <div class="field">
        <label class="fl">Nomor Pinjaman <span class="req">*</span></label>
        <input class="inp" id="bpp-pinjaman" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
      <div class="field">
        <label class="fl">Jenis Pinjaman <span class="req">*</span></label>
        <input class="inp" id="bpp-jenis" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
      <div class="field span2">
        <label class="fl">Status Peserta <span class="req">*</span></label>
        <input class="inp" id="bpp-status" readonly placeholder="Otomatis terisi dari Nomor KTPA">
      </div>
    </div>

    <div id="bpp-blok-pensiun" style="display:none">
      <div class="subsection-title">Pengajuan Kantor Cabang</div>
      <div class="grid2">
        <div class="field span2">
          <label class="fl">Nomor Request Umum <span class="req">*</span></label>
          <input class="inp" id="bpp-request" placeholder="Contoh: RU-2026-00251">
          <div class="hint">Nomor Request Umum pembatalan BUM KPR yang diajukan Kantor Cabang.</div>
        </div>
        <div class="field">
          <label class="fl">Surat Permohonan Pembatalan BUM KPR <span class="req">*</span></label>
          <input class="inp" type="file" id="bpp-dok-1" accept=".pdf,.jpg,.jpeg,.png">
          <div class="hint" id="bpp-dok-1-nama">Belum ada berkas terunggah.</div>
        </div>
        <div class="field">
          <label class="fl">Surat Pembatalan BUM KPR dari YPPSDP <span class="req">*</span></label>
          <input class="inp" type="file" id="bpp-dok-2" accept=".pdf,.jpg,.jpeg,.png">
          <div class="hint" id="bpp-dok-2-nama">Belum ada berkas terunggah.</div>
        </div>
      </div>
    </div>

    <div class="subsection-title">Data Pembatalan</div>
    <div class="grid2">
      <div class="field span2">
        <label class="fl">Status Keterangan Pembatalan <span class="req">*</span></label>
        <select class="inp" id="bpp-keterangan">
          <option value="">-- Pilih Status Keterangan Pembatalan --</option>
          ${BUM_PEMBATALAN_KETERANGAN.map(k => `<option>${esc(k)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="fl">Nomor Surat Pembatalan <span class="req">*</span></label>
        <input class="inp" id="bpp-no-surat" placeholder="Contoh: B/440/YPPSDP/VII/2026">
      </div>
      <div class="field">
        <label class="fl">Tanggal Surat Pembatalan <span class="req">*</span></label>
        <input class="inp" type="date" id="bpp-tgl-surat">
      </div>
      <div class="field span2" style="margin-bottom:0">
        <label class="fl">Nominal Pembatalan <span class="req">*</span></label>
        <div class="money"><span>Rp</span><input id="bpp-nominal" inputmode="numeric" placeholder="0" aria-label="Nominal pembatalan"></div>
      </div>
    </div>

    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bpp-tutup">Tutup</button>
      <button class="btn btn-primary" id="bpp-simpan">💾 Simpan Pembatalan</button>
    </div>`;
  openModal();

  $("#bpp-tutup").onclick = closeModal;
  $("#bpp-ktpa").onblur   = bpbAutofillFromKtpa;
  $("#bpp-ktpa").onchange = bpbAutofillFromKtpa;
  [1, 2].forEach(n => $(`#bpp-dok-${n}`).onchange = e => {
    const f = e.target.files[0];
    $(`#bpp-dok-${n}-nama`).textContent = f ? `${f.name} · ${ukuranBerkas(f.size)}` : "Belum ada berkas terunggah.";
  });
  $("#bpp-nominal").oninput = e => {
    const n = angkaSaja(e.target.value);
    e.target.value = n ? Number(n).toLocaleString("id-ID") : "";
  };

  $("#bpp-simpan").onclick = () => {
    const kpa           = $("#bpp-ktpa").value.trim().toUpperCase();
    const src           = DATA_BUM.find(x => x.kpa === kpa);
    const statusPeserta = src ? (BUM_STATUS_PESERTA[kpa] || "") : "";
    const keterangan    = $("#bpp-keterangan").value;
    const noSurat       = $("#bpp-no-surat").value.trim();
    const tglSurat      = $("#bpp-tgl-surat").value;
    const nominal       = parseNum($("#bpp-nominal").value);

    if (!statusPeserta) { toast("Nomor KTPA tidak ditemukan pada data pinjaman BUM KPR.", "bad"); return; }
    if (!keterangan || !noSurat || !tglSurat || !nominal) {
      toast("Status keterangan, nomor & tanggal surat, serta nominal pembatalan wajib diisi.", "bad");
      return;
    }

    const dokumen = [];
    let noRequest = "";
    if (statusPeserta === "Pensiun") {
      noRequest = $("#bpp-request").value.trim();
      if ($("#bpp-dok-1").files[0]) dokumen.push(BUM_PEMBATALAN_DOKUMEN[0]);
      if ($("#bpp-dok-2").files[0]) dokumen.push(BUM_PEMBATALAN_DOKUMEN[1]);
      if (!noRequest || dokumen.length < 2) {
        toast("Peserta pensiun wajib melampirkan Nomor Request Umum beserta kedua dokumen kelengkapan.", "bad");
        return;
      }
    }

    bumPembatalanRows.unshift({
      _id: bumPembatalanRows.length ? Math.max(...bumPembatalanRows.map(r => r._id)) + 1 : 0,
      kpa, nrp: src.nrp, nama: src.nama, cabang: src.cabang,
      nomorPinjaman: src.nomorPinjaman, jenisPinjaman: src.jenisPinjaman,
      statusPeserta, keterangan, noSurat, tglSurat, nominal,
      status: statusPeserta === "Aktif" ? "Tercatat" : "Menunggu SP",
      noRequest, noSp: "", tglDps: "", noDps: "", dokumen
    });
    bpbPage = 1;
    renderBumPembatalan();
    closeModal();
    toast(statusPeserta === "Aktif"
      ? `Pembatalan BUM KPR ${src.nama} tercatat dan siap diekspor.`
      : `Pembatalan BUM KPR ${src.nama} tercatat, menunggu SP pembayaran dari Divisi Keuangan.`, "ok");
  };
}
$("#bpb-proses-btn").onclick = bpbShowProses;

/* ------------------- SP Pembayaran Pemotongan BUM KPR (Divisi Keuangan)
   Langkah penutup untuk peserta pensiun. Begitu SP terbit, Nomor SP, Tanggal DPS, dan
   Nomor DPS ikut tertarik bersama data pembatalan lainnya. */
function bpbShowSp(r) {
  if (!r) return;
  $("#modal-title").textContent = "Terbitkan SP Pembayaran Pemotongan BUM KPR";
  $("#modal-sub").textContent   = `${r.nama} · ${r.kpa} · ${r.cabang}`;
  $("#modal-body").innerHTML = `
    <div class="grid2">
      <div class="field">
        <label class="fl">Nomor Surat Pembatalan</label>
        <input class="inp" readonly value="${esc(r.noSurat)}">
      </div>
      <div class="field">
        <label class="fl">Nomor Request Umum</label>
        <input class="inp" readonly value="${esc(r.noRequest || "-")}">
      </div>
      <div class="field span2">
        <label class="fl">Nominal Pembatalan</label>
        <input class="inp" readonly value="${esc(rp(r.nominal))}">
      </div>
      <div class="field">
        <label class="fl">Nomor SP Pembatalan <span class="req">*</span></label>
        <input class="inp" id="bps-no-sp" placeholder="Contoh: SP/1205/KEU/VIII/2026">
      </div>
      <div class="field">
        <label class="fl">Nomor DPS <span class="req">*</span></label>
        <input class="inp" id="bps-no-dps" placeholder="Contoh: DPS-2026-08-0071">
      </div>
      <div class="field span2" style="margin-bottom:0">
        <label class="fl">Tanggal DPS <span class="req">*</span></label>
        <input class="inp" type="date" id="bps-tgl-dps">
      </div>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="bps-tutup">Tutup</button>
      <button class="btn btn-primary" id="bps-simpan">🧾 Terbitkan SP</button>
    </div>`;
  openModal();

  $("#bps-tutup").onclick = closeModal;
  $("#bps-simpan").onclick = () => {
    const noSp   = $("#bps-no-sp").value.trim();
    const noDps  = $("#bps-no-dps").value.trim();
    const tglDps = $("#bps-tgl-dps").value;
    if (!noSp || !noDps || !tglDps) { toast("Nomor SP, Nomor DPS, dan Tanggal DPS wajib diisi.", "bad"); return; }

    r.noSp   = noSp;
    r.noDps  = noDps;
    r.tglDps = tglDps;
    r.status = "Selesai";
    renderBumPembatalan();
    if (bpbDetailRow === r) renderBumPembatalanDetail();
    closeModal();
    toast(`SP pembayaran pemotongan BUM KPR untuk ${r.nama} berhasil diterbitkan.`, "ok");
  };
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-bpb-detail]");
  if (bDetail) { bpbShowDetail(bumPembatalanRows.find(x => x._id === +bDetail.dataset.bpbDetail)); return; }

  const bSp = e.target.closest("[data-bpb-sp]");
  if (bSp) { bpbShowSp(bumPembatalanRows.find(x => x._id === +bSp.dataset.bpbSp)); return; }

  const bPage = e.target.closest("[data-bpb-page]");
  if (bPage) { bpbPage = +bPage.dataset.bpbPage; renderBumPembatalan(); }
});

isiPilihanBpb();
renderBumPembatalan();
