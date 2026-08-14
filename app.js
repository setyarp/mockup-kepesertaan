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
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

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
$("#to-step2").onclick = () => { renderDirty(); gotoStep(2); };
$("#to-step3").onclick = () => {
  if (dirtyRows.length) { toast(`Masih ada ${dirtyRows.length} data yang perlu direvisi.`, "bad"); return; }
  $(`.step[data-step="3"]`).disabled = false;
  renderClean(); gotoStep(3);
};
$("#btn-export-dirty").onclick = () => toast("Rekap data bermasalah diekspor ke Excel.");

/* ============================================= PEREMAJAAN DATA » PEMUTAKHIRAN DATA */

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

  $("#pmd-submit").disabled = valid === 0;

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
    status:      "Pending"
  });
  renderPeremajaanApproval();

  toast(`Pemutakhiran "${jenis.templateNama.replace("Template ", "")}" berhasil disubmit dan diteruskan ke persetujuan.`, "ok");
  pmdResetUpload();
  $(`.step[data-pmd-step="2"]`).disabled = true;
  pmdGotoStep(1);
};

/* ==================================================== PEREMAJAAN DATA » APPROVAL PEMUTAKHIRAN DATA */

function pillPemutakhiran(s) {
  return s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn";
}
function pemutakhiranJenisLabel(jenisKey) {
  return DATA_PEREMAJAAN[jenisKey] ? DATA_PEREMAJAAN[jenisKey].templateNama.replace("Template ", "") : jenisKey;
}

let pmaPage = 1;
function renderPeremajaanApproval() {
  const fBatch  = ($("#pma-f-batch").value  || "").toLowerCase();
  const fStatus = $("#pma-f-status").value;

  const rows = pmaBatchRows.filter(r =>
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
      <td><button class="btn btn-info btn-sm" data-pma-lihat="${r._id}">👁 Lihat</button></td>
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
$("#pma-reset").onclick = () => {
  $("#pma-f-batch").value = "";
  $("#pma-f-status").value = "all";
  pmaPage = 1;
  renderPeremajaanApproval();
};
$("#pma-page-size").onchange = () => { pmaPage = 1; renderPeremajaanApproval(); };

function pmaShowDetail(r) {
  $("#modal-title").textContent = "Detail Batch Pemutakhiran Data";
  $("#modal-sub").textContent   = r.noBatch;
  $("#modal-body").innerHTML = `
    <div class="grid3" style="margin-bottom:6px">
      ${reviewField("Nomor Batch", r.noBatch)}
      ${reviewField("Jenis Pemutakhiran Data", pemutakhiranJenisLabel(r.jenis))}
      ${reviewField("Waktu Unggah", r.waktu)}
      ${reviewField("Jumlah Baris", r.jumlahBaris)}
      <div class="field">
        <label class="fl">Status</label>
        <div class="t-strong"><span class="pill ${pillPemutakhiran(r.status)}">${esc(r.status.toUpperCase())}</span></div>
      </div>
    </div>
    ${r.status === "Pending" ? `
      <div class="form-actions">
        <button class="btn btn-danger-solid" id="pma-tolak">✕ Tolak</button>
        <button class="btn btn-success" id="pma-setuju">✓ Setujui</button>
      </div>` : `
      <div class="form-actions" style="justify-content:flex-end">
        <button class="btn btn-ghost" id="pma-tutup">Tutup</button>
      </div>`}`;
  openModal();

  $("#pma-tutup") && ($("#pma-tutup").onclick = closeModal);

  $("#pma-setuju") && ($("#pma-setuju").onclick = () => {
    r.status = "Disetujui";
    renderPeremajaanApproval();
    closeModal();
    toast(`Batch ${r.noBatch} disetujui.`, "ok");
  });

  $("#pma-tolak") && ($("#pma-tolak").onclick = () => {
    $("#modal-body").innerHTML = `
      <div class="field">
        <label class="fl">Alasan Penolakan <span class="req">*</span></label>
        <textarea class="inp" id="pma-alasan-tolak" rows="3" placeholder="Tuliskan alasan penolakan batch ini..."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="pma-tolak-batal">Batal</button>
        <button class="btn btn-danger-solid" id="pma-tolak-konfirmasi">✕ Tolak Batch</button>
      </div>`;
    $("#pma-tolak-batal").onclick = () => pmaShowDetail(r);
    $("#pma-tolak-konfirmasi").onclick = () => {
      if (!$("#pma-alasan-tolak").value.trim()) { toast("Alasan penolakan wajib diisi.", "bad"); return; }
      r.status = "Ditolak";
      renderPeremajaanApproval();
      closeModal();
      toast(`Batch ${r.noBatch} ditolak.`, "bad");
    };
  });
}

document.addEventListener("click", e => {
  const bLihat = e.target.closest("[data-pma-lihat]");
  if (bLihat) { pmaShowDetail(pmaBatchRows.find(x => x._id === +bLihat.dataset.pmaLihat)); return; }

  const bPage = e.target.closest("[data-pma-page]");
  if (bPage) { pmaPage = +bPage.dataset.pmaPage; renderPeremajaanApproval(); }
});

/* -------------------------------------------------------- tabel List Kotor */
function renderDirty() {
  const q = ($("#dirty-search").value || "").toLowerCase();

  $("#dirty-head").innerHTML =
    FIELDS.map((f, i) => `<th class="${i === 0 ? "stick-l" : ""}">${esc(f[1])}</th>`).join("") +
    `<th class="stick-r">AKSI</th>`;

  const rows = dirtyRows.filter(r =>
    !q || r.nrp.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q));

  $("#dirty-body").innerHTML = rows.length ? rows.map(r => {
    const idx = dirtyRows.indexOf(r);
    const tds = FIELDS.map((f, i) => {
      const bad = r._err && r._err[f[0]];
      const cls = (i === 0 ? "stick-l " : "") + (i < 2 ? "t-strong" : "");
      return `<td class="${cls}" ${bad ? 'style="color:var(--red);font-weight:600"' : ""}>${esc(r[f[0]])}</td>`;
    }).join("");
    return `<tr>${tds}<td class="stick-r"><button class="btn btn-primary btn-sm btn-pill" data-revisi="${idx}">Revisi</button></td></tr>`;
  }).join("")
  : `<tr><td colspan="${FIELDS.length + 1}"><div class="empty"><h4>Tidak ada data bermasalah</h4><p>Semua baris sudah lolos validasi.</p></div></td></tr>`;

  $("#dirty-count").textContent = `menampilkan ${rows.length} dari ${dirtyRows.length} data bermasalah`;
  $("#dirty-msg").textContent = dirtyRows.length
    ? `Ditemukan ${dirtyRows.length} data pada file batch yang diupload memerlukan revisi`
    : "Semua data sudah diperbaiki. Lanjutkan ke tahap Preview & Simpan.";
  $("#dirty-alert").className = dirtyRows.length ? "alert alert-bad" : "alert alert-ok";
}
$("#dirty-search").oninput = renderDirty;

/* --------------------------------------------------- form revisi (modal) */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-revisi]");
  if (b) openRevisi(+b.dataset.revisi);
});

function openRevisi(i) {
  const r = dirtyRows[i];
  const badge = r._err ? Object.values(r._err)[0] : "";

  $("#modal-title").textContent = "Form revisi data peserta";
  $("#modal-sub").textContent = `Baris ${i + 1} — ${r.nama} · perbaiki field bermasalah lalu simpan`;
  $("#modal-body").innerHTML = `
    ${badge ? `<div class="alert alert-bad"><span>⚠</span><span>${esc(badge)}</span></div>` : ""}
    <div class="alert alert-info"><span>ⓘ</span><span>Field berwarna merah perlu diperbaiki. Field lain bisa diedit jika diperlukan namun tidak wajib.</span></div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">
      ${FIELDS.map(f => {
        const bad  = r._err && r._err[f[0]];
        const wide = FIELD_LEBAR.includes(f[0]) ? "span2" : "";
        return `<div class="field ${bad ? "err" : ""} ${wide}">
          <label class="fl">${esc(f[1])}</label>
          <input class="inp" data-fld="${f[0]}" value="${esc(r[f[0]])}">
          ${bad ? `<div class="err-msg">${esc(bad)}</div>` : ""}
        </div>`;
      }).join("")}
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="rev-cancel">× Batal</button>
      <button class="btn btn-primary" id="rev-save">▤ Simpan revisi</button>
    </div>`;

  openModal();
  $("#rev-cancel").onclick = closeModal;
  $("#rev-save").onclick = () => {
    const row = dirtyRows[i];
    $$("#modal-body [data-fld]").forEach(inp => row[inp.dataset.fld] = inp.value.trim());

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
    closeModal();
    renderDirty();
    toast(`Data ${row.nama} berhasil direvisi.`, "ok");
    if (!dirtyRows.length) $(`.step[data-step="3"]`).disabled = false;
  };
}

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
  const noBatch = "B-UPLOAD/2026/07082026/0" + (Math.floor(Math.random() * 8) + 1);
  $("#modal-title").textContent = "Batch berhasil disubmit";
  $("#modal-sub").textContent = "Menunggu approval Kabid Pulminpes";
  $("#modal-body").innerHTML = `
    <div class="alert alert-ok"><span>✓</span><span>${n} data peserta tersimpan sebagai satu batch pengajuan.</span></div>
    <div class="metrics m3" style="margin-bottom:4px">
      <div class="metric"><div class="metric-lbl">Nomor batch</div><div class="metric-val" style="font-size:14px">${noBatch}</div></div>
      <div class="metric"><div class="metric-lbl">Jumlah peserta</div><div class="metric-val">${n}</div></div>
      <div class="metric"><div class="metric-lbl">Status</div><div class="metric-val" style="font-size:14px">Menunggu approval</div></div>
    </div>
    <div class="hint">Setelah Kabid menyetujui: Nomor KPA terbit otomatis, berkas tersimpan ke e-Dosir, dan BDN didistribusikan ke seluruh kanal.</div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="sb-close">Tutup</button>
      <button class="btn btn-primary" id="sb-dist">Lihat monitoring distribusi</button>
    </div>`;
  openModal();
  $("#sb-close").onclick = closeModal;
  $("#sb-dist").onclick  = () => { closeModal(); go("distribusi"); };
};

/* ============================== PENDAFTARAN PESERTA BARU » PERORANGAN (wizard) */
$("#pp-instansi").innerHTML = DATA_INSTANSI_PENGIRIM.map(i => `<option>${esc(i)}</option>`).join("");
$("#pp2-pangkat").innerHTML = $("#pf-pangkat").innerHTML;
$("#pp2-uker").innerHTML   += DATA_UKER.map(u => `<option>${esc(u)}</option>`).join("");
$("#pp2-kancab").innerHTML += DATA_KANTOR_CABANG.map(k => `<option>${esc(k)}</option>`).join("");

/* Validasi NRP/NIP sudah terdaftar di sistem — dicek terhadap master data
   peserta, pesan error tampil di bawah field begitu diketik */
$("#pp2-nrp").oninput = () => {
  const nrp = $("#pp2-nrp").value.trim();
  const sudahAda = nrp && DATA_MASTER_PESERTA.some(p => p.nrp === nrp);
  $("#pp2-nrp-err").style.display   = sudahAda ? "" : "none";
  $("#pp2-nrp-err").textContent     = sudahAda ? "NRP/NIP ini sudah terdaftar dalam sistem." : "";
  $("#pp2-nrp").closest(".field").classList.toggle("err", sudahAda);
};

/* Autocomplete Desa/Kelurahan — satu field, hasil gabungan kelurahan/kecamatan/
   kabupaten/provinsi langsung ditampilkan begitu satu opsi dipilih. Memilih
   kelurahan juga otomatis menyarankan Kantor Cabang terdekat. */
$("#pp2-kelurahan").oninput = () => {
  const q = $("#pp2-kelurahan").value.trim().toLowerCase();
  const list = $("#pp2-kelurahan-list");
  if (!q) { list.classList.remove("open"); list.innerHTML = ""; return; }
  const hits = DATA_WILAYAH.filter(w => w.kelurahan.toLowerCase().includes(q));
  if (!hits.length) { list.classList.remove("open"); list.innerHTML = ""; return; }
  list.innerHTML = hits.map(w => `
    <div class="autocomplete-item" data-kel="${esc(w.kelurahan)}">
      ${esc(w.kelurahan)}<small>${esc(w.kecamatan)}, ${esc(w.kabupaten)}, ${esc(w.provinsi)}</small>
    </div>`).join("");
  list.classList.add("open");
};
document.addEventListener("click", e => {
  const item = e.target.closest("#pp2-kelurahan-list .autocomplete-item");
  if (item) {
    const w = DATA_WILAYAH.find(x => x.kelurahan === item.dataset.kel);
    if (w) {
      $("#pp2-kelurahan").value = `${w.kelurahan}, ${w.kecamatan}, ${w.kabupaten}, ${w.provinsi}`;
      const saran = DATA_KANTOR_CABANG_MAP[w.kabupaten];
      if (saran) {
        $("#pp2-kancab").value = saran;
        $("#pp2-kancab-saran").style.display = "";
        $("#pp2-kancab-saran").textContent = `💡 Disarankan otomatis berdasarkan alamat (${w.kabupaten}) — bisa diubah jika perlu.`;
      } else {
        $("#pp2-kancab-saran").style.display = "none";
      }
    }
    $("#pp2-kelurahan-list").classList.remove("open");
    return;
  }
  if (!e.target.closest("#pp2-kelurahan")) $("#pp2-kelurahan-list").classList.remove("open");
});

function ppGotoStep(n) {
  [1, 2, 3, 4].forEach(i => {
    $("#pp-step-" + i).style.display = i === n ? "" : "none";
    const b = $(`.step[data-pp-step="${i}"]`);
    b.classList.toggle("active", i === n);
    b.classList.toggle("done",   i <  n);
  });
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
  $("#pp-jenis").value = "perorangan";
  $("#pp-nomor-surat").value = "";
  $("#pp-tgl-terima").value  = "";
  $("#pp-tgl-surat").value   = "";
  $("#pp-instansi").value    = DATA_INSTANSI_PENGIRIM[0];
  PP2_ALL_IDS.forEach(id => $(`#${id}`).value = "");
  $("#pp2-nrp-err").style.display = "none";
  $("#pp2-nrp").closest(".field").classList.remove("err");
  $("#pp2-kancab-saran").style.display = "none";
  pp3Fixed = {};
  pp3Dynamic = [];
  renderPp3Fixed();
  renderPp3Dynamic();
  [2, 3, 4].forEach(n => $(`.step[data-pp-step="${n}"]`).disabled = true);
}

$("#pp-1-lanjut").onclick = () => {
  if (!$("#pp-jenis").value)         { toast("Jenis Pendaftaran Baru belum dipilih.", "bad"); return; }
  if (!$("#pp-tgl-terima").value)    { toast("Tanggal Terima belum diisi.", "bad"); return; }
  $(`.step[data-pp-step="2"]`).disabled = false;
  ppGotoStep(2);
};
$("#pp-2-kembali").onclick = () => ppGotoStep(1);
$("#pp-2-lanjut").onclick = () => {
  const kosong = PP2_WAJIB.filter(f => !$(`#${f[0]}`).value.trim());
  if (kosong.length) {
    toast(`Field wajib belum diisi: ${kosong.map(f => f[1]).join(", ")}.`, "bad");
    return;
  }
  if ($("#pp2-nrp-err").style.display !== "none") {
    toast("NRP/NIP sudah terdaftar dalam sistem — periksa kembali.", "bad");
    return;
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
  const nama = $("#pp2-nama").value.trim() || "peserta";
  toast(`Pengajuan ${nama} diajukan ke Kabid Pulminpes.`, "ok");
  ppResetAll();
  ppGotoStep(1);
};

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
const PF_STEPS = ["Data Peserta", "Kepangkatan", "Tipe KPR (PUM)", "Detail Pengajuan", "Unggah Dokumen", "Review & Simpan"];
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
  $("#pf-step-5").style.display = n === 5 ? "" : "none";
  $("#pf-step-6").style.display = n === 6 ? "" : "none";
  if (n === 4) renderStep4();
  if (n === 5) renderStep5();
  if (n === 6) renderStep6();
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* Semua field teks/tanggal/dropdown wizard yang bisa direkam & dipulihkan
   ulang untuk mode "Ubah" — sengaja tidak termasuk 4 field "Terisi Otomatis"
   di setiap tipe (KTPA/Pangkat/UKER/Jumlah PUM) karena itu dihitung ulang
   otomatis dari pfFound + Pangkat setiap kali langkah 4 dirender. */
const PF_TEXT_FIELD_IDS = [
  "pf-ktpa", "pf-nrp", "pf-nama", "pf-masa-kerja", "pf-tempat-lahir", "pf-tgl-lahir",
  "pf-jk", "pf-kawin", "pf-nik", "pf-hp", "pf-alamat", "pf-pangkat",
  "pf2-nomor-skep", "pf2-tmt", "pf2-tgl-skep",
  "pf4-nama-perumahan", "pf4-nama-developer", "pf4-alamat-perumahan", "pf4-tipe-rumah",
  "pf4-blok-rumah", "pf4-kelurahan", "pf4-kecamatan", "pf4-kabupaten", "pf4-provinsi",
  "pf4-jenis-kredit", "pf4-bank-kredit", "pf4-nomor-akad", "pf4-tgl-akad", "pf4-alamat-pemohon",
  "pf4-nama-rekening", "pf4-nomor-rekening", "pf4-mitra-bayar", "pf4-cabang-mitra",
  "pf4pm-jenis-hak", "pf4pm-atas-nama", "pf4pm-nomor-hak", "pf4pm-tgl-hak",
  "pf4pm-nama-perumahan", "pf4pm-nama-developer", "pf4pm-alamat-perumahan", "pf4pm-tipe-rumah",
  "pf4pm-blok-rumah", "pf4pm-kelurahan", "pf4pm-kecamatan", "pf4pm-kabupaten", "pf4pm-provinsi",
  "pf4pm-alamat-pemohon", "pf4pm-nama-rekening", "pf4pm-nomor-rekening", "pf4pm-mitra-bayar", "pf4pm-cabang-mitra",
  "pf4mr-jenis-hak", "pf4mr-atas-nama", "pf4mr-nomor-hak", "pf4mr-tgl-hak",
  "pf4mr-alamat-baru", "pf4mr-alamat-pemohon",
  "pf4mr-nama-rekening", "pf4mr-nomor-rekening", "pf4mr-mitra-bayar", "pf4mr-cabang-mitra"
];
const PF_FILE_FIELD_IDS = [
  "pf2-file", "pf4-file-akad", "pf4-file-buku", "pf4pm-file-hak", "pf4pm-file-buku", "pf4mr-file-buku"
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

function bukaFormPeserta(found) {
  pumEditingRow = null;
  pfFound = found;
  $("#pf-ktpa").value        = found.kpa;
  $("#pf-nrp").value         = found.nrp;
  $("#pf-nama").value        = found.nama;
  $("#pf-masa-kerja").value  = "";
  $("#pf-tempat-lahir").value = "";
  $("#pf-tgl-lahir").value   = "";
  $("#pf-jk").value          = "";
  $("#pf-kawin").value       = "";
  $("#pf-nik").value         = "";
  $("#pf-hp").value          = "";
  $("#pf-alamat").value      = "";
  $("#pf-pangkat").value     = "";

  $("#pf2-nomor-skep").value = "";
  $("#pf2-tmt").value        = "";
  $("#pf2-tgl-skep").value   = "";
  $("#pf2-file").value       = "";
  riwayatItems = [];
  renderRiwayat();

  pfSelectTipe("Kredit Rumah");
  resetFields([
    "pf4-nama-perumahan", "pf4-nama-developer", "pf4-alamat-perumahan", "pf4-tipe-rumah",
    "pf4-blok-rumah", "pf4-kelurahan", "pf4-kecamatan", "pf4-kabupaten", "pf4-provinsi",
    "pf4-jenis-kredit", "pf4-bank-kredit",
    "pf4-nomor-akad", "pf4-tgl-akad", "pf4-file-akad", "pf4-alamat-pemohon",
    "pf4-nama-rekening", "pf4-nomor-rekening", "pf4-mitra-bayar", "pf4-cabang-mitra", "pf4-file-buku",

    "pf4pm-jenis-hak", "pf4pm-atas-nama", "pf4pm-nomor-hak", "pf4pm-tgl-hak", "pf4pm-file-hak",
    "pf4pm-nama-perumahan", "pf4pm-nama-developer", "pf4pm-alamat-perumahan", "pf4pm-tipe-rumah",
    "pf4pm-blok-rumah", "pf4pm-kelurahan", "pf4pm-kecamatan", "pf4pm-kabupaten", "pf4pm-provinsi",
    "pf4pm-alamat-pemohon",
    "pf4pm-nama-rekening", "pf4pm-nomor-rekening", "pf4pm-mitra-bayar", "pf4pm-cabang-mitra", "pf4pm-file-buku",

    "pf4mr-jenis-hak", "pf4mr-atas-nama", "pf4mr-nomor-hak", "pf4mr-tgl-hak",
    "pf4mr-alamat-baru", "pf4mr-alamat-pemohon",
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
      riwayatItems.push(++riwayatSeq);
      renderRiwayat();
      const block = $(`.riwayat-block[data-riwayat="${riwayatItems[riwayatItems.length - 1]}"]`);
      const inp   = block.querySelectorAll("input");
      inp[0].value = rw.nomorSkep; inp[1].value = rw.tmt; inp[2].value = rw.tglSkep;
      setFileInputEl(inp[3], rw.file);
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
$("#pf-lanjut").onclick = () => {
  if (!$("#pf-ktpa").value.trim() || !$("#pf-nrp").value.trim()) {
    toast("KTPA dan NRP/NIP wajib diisi.", "bad"); return;
  }
  if (!$("#pf-pangkat").value) { toast("Pangkat belum dipilih.", "bad"); return; }

  /* Anggota militer (TNI AD/AU/AL) dengan masa kerja dinas < 2 tahun tidak
     bisa melanjutkan pengajuan PUM KPR. */
  const masaKerjaRaw = $("#pf-masa-kerja").value.trim();
  const isTni = pfFound && /^TNI/i.test(pfFound.angkatan || "");
  if (isTni && masaKerjaRaw !== "" && parseNum(masaKerjaRaw) < 2) {
    showAlertPopup("Validasi Masa Kerja Dinas",
      "Pengajuan KPR (PUM) tidak dapat diproses karena Peserta merupakan Anggota Militer TNI AD/TNI AU/TNI AL dengan Masa Kerja Dinas kurang dari 2 Tahun");
    return;
  }

  pfGoStep(2);
};

/* ---------------------------------------------------- wizard: kepangkatan */
let riwayatItems = [];
let riwayatSeq   = 0;

function riwayatBlock(id, idx) {
  return `
    <div class="riwayat-block" data-riwayat="${id}" style="padding:16px 0;border-top:1px solid var(--line-soft)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="t-strong" style="font-size:12px;color:var(--body)">Riwayat Kepangkatan #${idx + 1}</div>
        <button class="link-danger" data-riwayat-hapus="${id}">✕ Hapus</button>
      </div>
      <div class="grid3" style="grid-template-columns:1fr 1fr">
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

function renderRiwayat() {
  $("#riwayat-list").innerHTML = riwayatItems.map((id, idx) => riwayatBlock(id, idx)).join("");
  $("#riwayat-empty").style.display = riwayatItems.length ? "none" : "";
}

$("#btn-tambah-riwayat").onclick = () => {
  riwayatItems.push(++riwayatSeq);
  renderRiwayat();
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-riwayat-hapus]");
  if (!b) return;
  riwayatItems = riwayatItems.filter(x => x !== +b.dataset.riwayatHapus);
  renderRiwayat();
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
  $(`#${prefix}-ktpa`).value       = pfFound.kpa;
  $(`#${prefix}-pangkat`).value    = $("#pf-pangkat").value || "-";
  $(`#${prefix}-uker`).value       = pfFound.uker || "-";
  $(`#${prefix}-jumlah-pum`).value = rp(pfFound.plafonPum || 0);
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
bindKelurahanAutocomplete("pf4");
bindKelurahanAutocomplete("pf4pm");

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
$("#pf4-lanjut").onclick = () => pfGoStep(5);

/* ---------------------------------------------------- wizard: unggah dokumen */
let pf5RenderedTipe = null;
let pf5Uploaded = {};

function renderDocRow(d, i) {
  return `
    <div class="doc-row">
      <div class="doc-info">
        <span class="doc-ico">📄</span>
        <div>
          <div class="doc-label">${esc(d.label)}</div>
          ${d.kondisional ? `<div class="doc-note">${esc(d.note)}</div>` : ""}
        </div>
      </div>
      <div class="doc-actions">
        <span class="pill ${d.kondisional ? "pill-warn" : "pill-bad"}" id="pf5-status-${i}">
          ${d.kondisional ? "Kondisional" : "Belum diunggah"}
        </span>
        <label class="btn btn-primary btn-sm">
          ⬆ Unggah
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" data-doc-idx="${i}">
        </label>
      </div>
    </div>`;
}

function renderStep5() {
  $("#pf5-badge").textContent     = `TIPE: ${PF4_LABEL[pfTipePum].toUpperCase()}`;
  $("#pf5-list-title").textContent = `Daftar Dokumen Persyaratan - ${PF4_LABEL[pfTipePum]}`;

  /* Bangun ulang daftar hanya saat tipe berubah — supaya status unggahan
     tidak hilang kalau user cuma bolak-balik antar langkah. */
  if (pf5RenderedTipe !== pfTipePum) {
    pf5RenderedTipe = pfTipePum;
    pf5Uploaded = {};
    const docs = DATA_DOKUMEN_PERSYARATAN[pfTipePum];
    $("#pf5-list").innerHTML = docs
      ? docs.map((d, i) => renderDocRow(d, i)).join("")
      : `<div class="empty"><p>Daftar dokumen untuk tipe ini menyusul.</p></div>`;
  }
  updatePf5Progress();
}

function updatePf5Progress() {
  const docs = DATA_DOKUMEN_PERSYARATAN[pfTipePum];
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

$("#pf5-kembali").onclick = () => pfGoStep(4);
$("#pf5-lanjut").onclick = () => {
  const docs = DATA_DOKUMEN_PERSYARATAN[pfTipePum] || [];
  const totalWajib = docs.filter(d => !d.kondisional).length;
  const doneWajib  = docs.filter((d, i) => !d.kondisional && pf5Uploaded[i]).length;
  if (doneWajib < totalWajib) {
    toast(`Lengkapi ${totalWajib - doneWajib} dokumen wajib terlebih dahulu.`, "bad");
    return;
  }
  pfGoStep(6);
};

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
      { label:"Nomor SKEP Pengangkatan", value: inp[0].value },
      { label:"TMT Pengangkatan", value: fmtTgl(inp[1].value) },
      { label:"Tanggal SKEP Pengangkatan", value: fmtTgl(inp[2].value) },
      { label:"Upload SKEP Pengangkatan", value: file ? file.name : "Belum diunggah", previewId: registerFile(file) }
    ];
  });
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
    { label:"Masa Kerja Dinas", value: fv("pf-masa-kerja") ? `${fv("pf-masa-kerja")} Tahun` : "" },
    { label:"Tempat Lahir", value: fv("pf-tempat-lahir") },
    { label:"Tanggal Lahir", value: fmtTgl(fv("pf-tgl-lahir")) },
    { label:"Jenis Kelamin", value: fv("pf-jk") },
    { label:"Status Kawin", value: fv("pf-kawin") },
    { label:"Nomor Identitas KTP (NIK)", value: fv("pf-nik") },
    { label:"Nomor Handphone", value: fv("pf-hp") },
    { label:"Alamat Lengkap", value: fv("pf-alamat"), wide:true },
    { label:"Pangkat", value: fv("pf-pangkat") }
  ];

  const dataKepangkatan = [
    { label:"Nomor SKEP Pangkat Terakhir", value: fv("pf2-nomor-skep") },
    { label:"TMT Pangkat Terakhir", value: fmtTgl(fv("pf2-tmt")) },
    { label:"Tanggal SKEP Pangkat Terakhir", value: fmtTgl(fv("pf2-tgl-skep")) },
    fileField("Fotocopy SKEP Pangkat Terakhir", "pf2-file")
  ];

  const riwayat = riwayatToGroups();

  let detailGroups = [];
  if (pfTipePum === "Kredit Rumah") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4-ktpa") },
        { label:"Pangkat", value: fv("pf4-pangkat") },
        { label:"UKER", value: fv("pf4-uker") },
        { label:"Jumlah PUM", value: fv("pf4-jumlah-pum") }
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
        fileField("Upload Fotocopy Akad Kredit", "pf4-file-akad"),
        { label:"Alamat Rumah Pemohon", value: fv("pf4-alamat-pemohon"), wide:true }
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4-file-buku")
      ]}
    ];
  } else if (pfTipePum === "Pembelian Rumah Secara Mandiri") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4pm-ktpa") },
        { label:"Pangkat", value: fv("pf4pm-pangkat") },
        { label:"UKER", value: fv("pf4pm-uker") },
        { label:"Jumlah PUM", value: fv("pf4pm-jumlah-pum") }
      ]},
      { title:"Data Properti", fields:[
        { label:"Jenis Hak Kepemilikan Atas Tanah", value: fv("pf4pm-jenis-hak") },
        { label:"Atas Nama Peserta atau Istri", value: fv("pf4pm-atas-nama") },
        { label:"Nomor Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fv("pf4pm-nomor-hak") },
        { label:"Tanggal Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fmtTgl(fv("pf4pm-tgl-hak")) },
        fileField("Upload Fotocopy Sertifikat/Akta Jual Beli/Girik/Akta Hibah", "pf4pm-file-hak"),
        { label:"Nama Perumahan", value: fv("pf4pm-nama-perumahan") },
        { label:"Nama Developer", value: fv("pf4pm-nama-developer") },
        { label:"Alamat Perumahan", value: fv("pf4pm-alamat-perumahan"), wide:true },
        { label:"Tipe Rumah", value: fv("pf4pm-tipe-rumah") },
        { label:"Blok-Nomor Rumah", value: fv("pf4pm-blok-rumah") },
        { label:"Kelurahan", value: fv("pf4pm-kelurahan") },
        { label:"Kecamatan", value: fv("pf4pm-kecamatan") },
        { label:"Kabupaten/Kota", value: fv("pf4pm-kabupaten") },
        { label:"Provinsi", value: fv("pf4pm-provinsi") },
        { label:"Alamat Rumah Pemohon", value: fv("pf4pm-alamat-pemohon"), wide:true }
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4pm-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4pm-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4pm-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4pm-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4pm-file-buku")
      ]}
    ];
  } else if (pfTipePum === "Membangun Rumah") {
    detailGroups = [
      { title:"Data Peserta (Terisi Otomatis)", fields:[
        { label:"KTPA", value: fv("pf4mr-ktpa") },
        { label:"Pangkat", value: fv("pf4mr-pangkat") },
        { label:"UKER", value: fv("pf4mr-uker") },
        { label:"Jumlah PUM", value: fv("pf4mr-jumlah-pum") }
      ]},
      { title:"Data Lokasi Pembangunan", fields:[
        { label:"Jenis Hak Kepemilikan Atas Tanah", value: fv("pf4mr-jenis-hak") },
        { label:"Atas Nama Peserta atau Istri", value: fv("pf4mr-atas-nama") },
        { label:"Nomor Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fv("pf4mr-nomor-hak") },
        { label:"Tanggal Sertifikat/Akta Jual Beli/Girik/Akta Hibah", value: fmtTgl(fv("pf4mr-tgl-hak")) },
        { label:"Alamat Lengkap Rumah Yang Akan Dibangun", value: fv("pf4mr-alamat-baru"), wide:true },
        { label:"Alamat Rumah Pemohon", value: fv("pf4mr-alamat-pemohon"), wide:true }
      ]},
      { title:"Data Rekening Penyaluran KPR (PUM)", fields:[
        { label:"Nama Rekening Peserta Penyaluran KPR (PUM)", value: fv("pf4mr-nama-rekening") },
        { label:"Nomor Rekening Tujuan", value: fv("pf4mr-nomor-rekening") },
        { label:"Mitra Bayar", value: fv("pf4mr-mitra-bayar") },
        { label:"Cabang Mitra Bayar", value: fv("pf4mr-cabang-mitra") },
        fileField("Upload Buku Tabungan", "pf4mr-file-buku")
      ]}
    ];
  }

  const docsDef = DATA_DOKUMEN_PERSYARATAN[pfTipePum] || [];
  const dokumen = docsDef.map((d, i) => {
    const file = pf5Uploaded[i] || null;
    return {
      label: d.label, kondisional: !!d.kondisional,
      uploadedName: file ? file.name : null, previewId: registerFile(file)
    };
  });

  return { tipePum: pfTipePum, dataPeserta, dataKepangkatan, riwayat, detailGroups, dokumen };
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
    return { nomorSkep: inp[0].value, tmt: inp[1].value, tglSkep: inp[2].value, file: inp[3].files[0] || null };
  });

  return { tipePum: pfTipePum, fields, files, riwayat, docs: { ...pf5Uploaded } };
}

function dokumenToHtml(dokumen) {
  return dokumen.map(d => `
    <div class="doc-row">
      <div class="doc-info"><span class="doc-ico">📄</span><div class="doc-label">${esc(d.label)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="pill ${d.uploadedName ? "pill-ok" : (d.kondisional ? "pill-warn" : "pill-bad")}">${d.uploadedName ? "✓ " + esc(d.uploadedName) : (d.kondisional ? "Kondisional" : "Belum diunggah")}</span>
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

  $("#pf6-data-peserta").innerHTML     = fieldsToHtml(snap.dataPeserta);
  $("#pf6-data-kepangkatan").innerHTML = fieldsToHtml(snap.dataKepangkatan);
  $("#pf6-riwayat").innerHTML = snap.riwayat.length
    ? snap.riwayat.map((fields, i) => `
        <div style="${i === snap.riwayat.length - 1 ? "" : "margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line-soft)"}">
          <div class="t-strong" style="font-size:12px;margin-bottom:8px">Riwayat Kepangkatan #${i + 1}</div>
          <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(fields)}</div>
        </div>`).join("")
    : `<div class="hint" style="margin:0">Belum ada riwayat kepangkatan ditambahkan.</div>`;
  $("#pf6-tipe-pill").textContent = snap.tipePum;

  snap.detailGroups.forEach((g, i) => { $(PF6_GROUP_IDS[panelId][i]).innerHTML = fieldsToHtml(g.fields); });
  $(PF6_DOKUMEN_ID[panelId]).innerHTML = dokumenToHtml(snap.dokumen);
}

/* "Kembali" hanya balik ke langkah Unggah Dokumen — data yang sudah diisi tetap ada. */
$("#pf6-kembali").onclick = () => pfGoStep(5);

$("#pf6-submit").onclick = () => {
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
      tipePum: pfTipePum, tipeRumah, jumlah: pfFound.plafonPum || r.jumlah,
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
    status: "Draft", jumlah: pfFound.plafonPum || 0,
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
};

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

    <div class="subsection-title">Data Kepangkatan</div>
    <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(d.dataKepangkatan)}</div>
    <div style="margin-top:14px">
      ${d.riwayat.length ? d.riwayat.map((fields, i) => `
        <div style="${i === d.riwayat.length - 1 ? "" : "margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line-soft)"}">
          <div class="t-strong" style="font-size:12px;margin-bottom:8px">Riwayat Kepangkatan #${i + 1}</div>
          <div class="grid3" style="grid-template-columns:1fr 1fr">${fieldsToHtml(fields)}</div>
        </div>`).join("") : `<div class="hint" style="margin:0">Belum ada riwayat kepangkatan ditambahkan.</div>`}
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
      pumDetailRow.status = "Disetujui";
      pumDetailRow.catatanApproval = $("#pd-alasan-setuju").value.trim();
      closeModal();
      renderApproval(); renderPum();
      toast(`Pengajuan ${pumDetailRow.nama} disetujui.`, "ok");
      go(pumDetailBackTarget);
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
  $("#pel-d-shown").textContent   = DATA_PELUNASAN_PESERTA.length;
  $("#pel-d-status").className    = "pill " + pillPel(p.status);
  $("#pel-d-status").textContent  = p.status;

  $("#pel-d-body").innerHTML = DATA_PELUNASAN_PESERTA.map(x => `
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
function renderBumMetrics() {
  $("#bum-metrics").innerHTML = DATA_BUM_METRIK.map(m => `
    <div class="metric">
      <div class="metric-lbl">${esc(m.label)}</div>
      <div class="metric-val ${m.warna === "bad" ? "bad" : ""}">${esc(m.nilai)}</div>
      <div class="metric-sub ${esc(m.warna)}">${esc(m.sub)}</div>
    </div>`).join("");
}
function renderBum() {
  const f = $("#bum-filter").value;
  const rows = bumRows.filter(r => f === "all" || r.program === f);
  $("#bum-body").innerHTML = rows.map(r => {
    const cls = r.status.startsWith("BATAL")    ? "pill-bad"
              : r.status.startsWith("MENUNGGU") ? "pill-warn" : "pill-ok";
    return `<tr>
      <td>${esc(r.ktpa)}</td><td class="t-name">${esc(r.nama)}</td><td>${esc(r.unor)}</td>
      <td><span class="pill ${r.program === "Khusus" ? "pill-warn" : "pill-ok"}">${esc(r.program)}</span></td>
      <td>${rp(r.out)}</td><td><span class="pill ${cls}">${esc(r.status)}</span></td>
    </tr>`;
  }).join("");
  $("#bum-count").textContent = `menampilkan ${rows.length} dari ${bumRows.length} peserta dengan kewajiban BUM KPR`;
}
$("#bum-filter").onchange = renderBum;

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

/* ====================================================================== INIT */
$("#top-role").onchange = () => toast(`Role diubah ke: ${$("#top-role").value}.`);
$("#top-avatar").textContent = PENGATURAN.inisialUser;

isiPilihanKesatuan();
renderDashboard();
renderDirty();
renderClean();
renderPum();
renderApproval();
renderWizard();
renderRiwayat();
renderPel();
renderBumMetrics();
renderBum();
renderDistHead();
renderDist();
go("dashboard");
