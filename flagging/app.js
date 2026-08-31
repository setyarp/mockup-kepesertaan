/* ===========================================================================
   app.js — LOGIKA APLIKASI FLAGGING MITRA BAYAR
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

const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
  "Agustus","September","Oktober","November","Desember"];

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  $("#toast").appendChild(t);
  setTimeout(() => t.remove(), 3600);
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
  /* Layar unggah selalu dimulai dari keadaan kosong. */
  if (id === "flagging-cb-check")          fcbkResetCheck();
  if (id === "flagging-pengajuan-unggah")  fpgResetUnggah();
  if (id === "flagging-takeover-tambah")   fttReset();
  if (id === "flagging-topup-tambah")      ftutReset();
  if (id === "flagging-penagihan-tambah")  fptReset();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b && !b.disabled) go(b.dataset.go);
});
$("#burger").onclick = () => $("#sidebar").classList.toggle("open");

/* Sidebar: buka/tutup grup nav-parent — generik untuk semua sub modul. */
$$(".nav-parent").forEach(btn => {
  btn.onclick = () => {
    const open     = btn.getAttribute("aria-expanded") === "true";
    const children = btn.nextElementSibling;
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    if (children && children.classList.contains("nav-children")) children.hidden = open;
  };
});

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
$("#modal-x").onclick = closeModal;
$("#modal-bg").onclick = e => { if (e.target.id === "modal-bg") closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* --------------------------------------------------------------- paginasi */
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

/* Pembulatan batas sumbu grafik ke angka "bulat" terdekat (1/2/2,5/5/10). */
function niceMax(v) {
  if (v <= 0) return 10;
  const mag  = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}


/* =============================== DASHBOARD FLAGGING PINJAMAN MITRA
   Lima grafik garis dengan gaya yang sama: gridline resesif, penanda titik
   bulat, sumbu Y ber-nice-max, dan tooltip native lewat <title>. Sengaja
   digambar manual sebagai SVG supaya tetap tanpa library/CDN. */

/* Angka sumbu Y disingkat "k" begitu melewati seribu, mengikuti kebiasaan
   grafik di kartu dashboard lain. */
function fdashFmtNilai(v) {
  if (Math.abs(v) < 1000) return String(+v.toFixed(1)).replace(".", ",");
  return String(+(v / 1000).toFixed(1)).replace(".", ",") + "k";
}

/* Sumbu Y grafik garis tidak selalu mulai dari nol: kalau seluruh nilai jauh di
   atas nol, dasar sumbu ikut dinaikkan supaya bentuk garisnya tetap terbaca. */
function fdashSkalaY(values) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const step  = niceMax((hi - lo) / 3 || 1);
  const min   = lo - (hi - lo) * .25 <= 0 ? 0 : Math.floor(lo / step) * step;
  const max   = Math.ceil(hi / step) * step;
  return { min, max: max === min ? min + step : max, step };
}

function renderLineChart(containerId, data, opts = {}) {
  const el = $(`#${containerId}`);
  if (!el) return;
  const { labels, values } = data;
  const color = opts.color || "var(--navy)";
  const w = 520, h = 300, padL = 62, padR = 22, padT = 16, padB = 54;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const { min, max, step } = fdashSkalaY(values);
  const x = i => labels.length === 1 ? padL + plotW / 2 : padL + i * (plotW / (labels.length - 1));
  const y = v => padT + plotH - (v - min) / (max - min) * plotH;

  let svg = "";
  /* Gridline horizontal + label sumbu Y */
  for (let v = min; v <= max + 1e-9; v += step) {
    svg += `<line x1="${padL}" y1="${y(v)}" x2="${w - padR}" y2="${y(v)}" stroke="var(--line-soft)" stroke-width="1"/>`;
    svg += `<text x="${padL - 10}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${fdashFmtNilai(v)}</text>`;
  }
  /* Gridline vertikal + label sumbu X */
  labels.forEach((lbl, i) => {
    svg += `<line x1="${x(i)}" y1="${padT}" x2="${x(i)}" y2="${padT + plotH}" stroke="var(--line-soft)" stroke-width="1"/>`;
    svg += `<text x="${x(i)}" y="${padT + plotH + 20}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(lbl)}</text>`;
  });
  /* Bingkai plot: hanya garis dasar, seperti pada grafik acuan */
  svg += `<line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="var(--line)" stroke-width="1.5"/>`;

  /* Judul sumbu */
  svg += `<text x="${padL + plotW / 2}" y="${h - 18}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(opts.xLabel || "Bulan")}</text>`;
  svg += `<text x="16" y="${padT + plotH / 2}" text-anchor="middle" font-size="9.5" letter-spacing=".05em" fill="var(--muted)" transform="rotate(-90 16 ${padT + plotH / 2})">${esc(data.satuan || "")}</text>`;

  /* Garis + titik data */
  svg += `<polyline points="${values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  values.forEach((v, i) => {
    svg += `<circle cx="${x(i)}" cy="${y(v)}" r="4.6" fill="${color}" stroke="var(--surface)" stroke-width="1.5">` +
           `<title>${esc(labels[i])} — ${esc(data.seri)}: ${v.toLocaleString("id-ID")}</title></circle>`;
  });

  el.innerHTML =
    `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="${esc(opts.aria || data.seri)}">${svg}</svg>` +
    `<div class="chart-legend"><span class="chart-legend-mark" style="background:${color}"></span>${esc(data.seri)}</div>`;
}

function renderFlaggingDashboard() {
  $("#fdash-mitra").textContent = DASHBOARD_FLAGGING_MITRA;
  $$(".fdash-tahun").forEach(e => e.textContent = DASHBOARD_FLAGGING_TAHUN);

  const d = DASHBOARD_FLAGGING;
  renderLineChart("fdash-site-visits", d.siteVisits,  { color: "var(--navy)",       aria: "Grafik jumlah akses mitra per bulan" });
  renderLineChart("fdash-booking",     d.booking,     { color: "var(--navy)",       aria: "Grafik jumlah nasabah booking per bulan" });
  renderLineChart("fdash-pengajuan",   d.pengajuan,   { color: "var(--chart-gold)", aria: "Grafik jumlah nasabah pengajuan per bulan" });
  renderLineChart("fdash-persetujuan", d.persetujuan, { color: "var(--chart-gold)", aria: "Grafik jumlah nasabah persetujuan per bulan" });
  renderLineChart("fdash-pelunasan",   d.pelunasan,   { color: "var(--chart-gold)", aria: "Grafik jumlah nasabah pelunasan per bulan" });
}

renderFlaggingDashboard();


/* ================= FLAGGING PINJAMAN MITRA » PENSIUNAN
   Rekap mitra bayar per periode. Filter dijalankan saat tombol "Cari" ditekan
   (bukan saat mengetik) supaya perilakunya sama dengan layar SPTB. */
let fpPager  = { hal: 1, per: 5 };
let fpFilter = { bulan: "Januari", tahun: "2025", mitra: "", cabang: "", jenis: [] };

/* Jenis Bayar boleh lebih dari satu, jadi dibuat sebagai panel kotak centang
   yang tampil seperti <select>. Semua jenis tercentang saat layar dibuka. */
const fpJenis = new Set(FP_JENIS_BAYAR);

function isiPilihanFp() {
  $("#fp-f-bulan").innerHTML = BULAN_ID.map(b => `<option>${esc(b)}</option>`).join("");
  $("#fp-f-bulan").value = fpFilter.bulan;
  $("#fp-jenis-pop").innerHTML = FP_JENIS_BAYAR.map(j => `
    <label class="multisel-opt">
      <input type="checkbox" value="${esc(j)}" ${fpJenis.has(j) ? "checked" : ""}>${esc(j)}
    </label>`).join("");
  fpTulisLabelJenis();
}

function fpTulisLabelJenis() {
  const el = $("#fp-jenis-val");
  const dipilih = FP_JENIS_BAYAR.filter(j => fpJenis.has(j));
  el.textContent = dipilih.length ? dipilih.join(", ") : "Pilih jenis bayar…";
  el.classList.toggle("kosong", dipilih.length === 0);
}

function fpTutupJenis() {
  $("#fp-jenis-pop").classList.remove("open");
  $("#fp-jenis-trigger").setAttribute("aria-expanded", "false");
}

$("#fp-jenis-trigger").onclick = () => {
  const buka = !$("#fp-jenis-pop").classList.contains("open");
  $("#fp-jenis-pop").classList.toggle("open", buka);
  $("#fp-jenis-trigger").setAttribute("aria-expanded", String(buka));
};
$("#fp-jenis-pop").onchange = e => {
  const c = e.target;
  if (c.checked) fpJenis.add(c.value); else fpJenis.delete(c.value);
  fpTulisLabelJenis();
};
document.addEventListener("click", e => {
  if (!e.target.closest("#fp-f-jenis")) fpTutupJenis();
});

function fpBacaFilter() {
  fpFilter = {
    bulan:  $("#fp-f-bulan").value,
    tahun:  $("#fp-f-tahun").value.trim(),
    mitra:  $("#fp-f-mitra").value.trim().toLowerCase(),
    cabang: $("#fp-f-cabang").value.trim().toLowerCase(),
    jenis:  FP_JENIS_BAYAR.filter(j => fpJenis.has(j))
  };
}

function fpRows() {
  const f = fpFilter;
  return DATA_FLAGGING_PENSIUNAN.filter(r =>
    r.bulan === f.bulan &&
    (!f.tahun  || String(r.tahun) === f.tahun) &&
    (!f.mitra  || r.mitra.toLowerCase().includes(f.mitra)) &&
    (!f.cabang || r.cabang.toLowerCase().includes(f.cabang)) &&
    f.jenis.includes(r.jenisBayar)
  );
}

function renderFlaggingPensiunan() {
  const rows = fpRows();
  const pg   = pagerPotong(rows, fpPager);

  $("#fp-body").innerHTML = pg.hal.length
    ? pg.hal.map((r, i) => `
      <tr>
        <td>${pg.mulai + i + 1}</td>
        <td class="t-strong">${esc(r.mitra)}</td>
        <td class="num">${r.flagging.toLocaleString("id-ID")}</td>
        <td class="num">${r.nonFlagging.toLocaleString("id-ID")}</td>
        <td class="num">${(r.flagging + r.nonFlagging).toLocaleString("id-ID")}</td>
        <td class="num">${rp(r.netto)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty">${
        fpFilter.jenis.length
          ? "Tidak ada mitra bayar yang cocok dengan filter."
          : "Pilih minimal satu Jenis Bayar untuk menampilkan data."
      }</div></td></tr>`;

  $("#fp-count").textContent = `Menampilkan ${rows.length.toLocaleString("id-ID")} data`;
  $("#fp-pager").innerHTML   = rows.length ? pagerHtml(fpPager, pg, "data-fp-hal") : "";
}

$("#fp-cari").onclick = () => { fpBacaFilter(); fpPager.hal = 1; renderFlaggingPensiunan(); };
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fp-hal]");
  if (b) { fpPager.hal = +b.dataset.fpHal; renderFlaggingPensiunan(); }
});

isiPilihanFp();
fpBacaFilter();
renderFlaggingPensiunan();

/* ================================================ FLAGGING » CHECK DAN BOOKING » INDIVIDU */

/* Autocomplete Mitra (bank/POS) — dipakai layar Kolektif; di layar Individu
   Mitra sudah terisi otomatis dari data peserta sehingga tidak perlu dicari.
   Semua handler menempel di elemennya sendiri (bukan document) supaya aman
   dipasang ulang setiap kali isi modal dibangun ulang. */
function bindMitraAutocomplete(inputId, listId) {
  const input = $(`#${inputId}`);
  const list  = $(`#${listId}`);
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    const hits = q ? DATA_MITRA_BAYAR.filter(b => b.toLowerCase().includes(q)) : [];
    if (!hits.length) { list.classList.remove("open"); list.innerHTML = ""; return; }
    list.innerHTML = hits.map(b => `<div class="autocomplete-item" data-mitra="${esc(b)}">${esc(b)}</div>`).join("");
    list.classList.add("open");
  };
  /* mousedown mendahului blur, jadi pilihannya sempat terbaca sebelum menutup */
  list.onmousedown = e => {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    e.preventDefault();
    input.value = item.dataset.mitra;
    list.classList.remove("open");
  };
  input.onblur = () => list.classList.remove("open");
}
/* Search field Nomor Pensiun Peminjam — daftarnya ikut peserta waris yang
   sedang tampil, jadi diisi ulang setiap kali pencarian KPA berhasil. */
let fcbiWarisPeminjam = [];
(() => {
  const input = $("#fcbi-w-nopensiun-peminjam");
  const list  = $("#fcbi-w-peminjam-list");
  const tutup = () => { list.classList.remove("open"); list.innerHTML = ""; };
  const buka = () => {
    const q = input.value.trim().toLowerCase();
    const hits = fcbiWarisPeminjam.filter(p =>
      p.nomorPensiun.toLowerCase().includes(q) || p.nama.toLowerCase().includes(q));
    if (!hits.length) { tutup(); return; }
    list.innerHTML = hits.map(p =>
      `<div class="autocomplete-item" data-nopens="${esc(p.nomorPensiun)}">${esc(p.nomorPensiun)}<small>${esc(p.nama)}</small></div>`).join("");
    list.classList.add("open");
  };
  /* Mengetik ulang membatalkan pilihan sebelumnya; fokus saja tidak. */
  input.oninput = () => { $("#fcbi-w-nama-peminjam").value = ""; buka(); };
  input.onfocus = buka;
  document.addEventListener("click", e => {
    const item = e.target.closest("#fcbi-w-peminjam-list .autocomplete-item");
    if (item) {
      const p = fcbiWarisPeminjam.find(x => x.nomorPensiun === item.dataset.nopens);
      input.value = p.nomorPensiun;
      $("#fcbi-w-nama-peminjam").value = p.nama;
      tutup();
      return;
    }
    if (!e.target.closest("#fcbi-w-nopensiun-peminjam")) tutup();
  });
})();

function fcbiSembunyikanHasil() {
  $("#fcbi-hasil-aktif").style.display   = "none";
  $("#fcbi-hasil-sendiri").style.display = "none";
  $("#fcbi-hasil-waris").style.display   = "none";
}
$("#fcbi-kpa").oninput = fcbiSembunyikanHasil;

/* Pop-up validasi nomor KPA: kalimatnya selalu berbentuk
   "Nomor KPA <chip> " + pesan, jadi nomornya menonjol seperti di rancangan. */
function fcbiPopupValidasi(kpa, v) {
  $("#modal-title").textContent = v.judul;
  $("#modal-sub").textContent   = "";
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico " + v.tone;
  $("#modal-ico").textContent   = v.tone === "warn" ? "⚠" : "⊗";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.7;margin-bottom:20px">
      Nomor KPA <span class="kpa-chip">${esc(kpa)}</span> ${esc(v.pesan)}
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="fcbi-val-close">⊗ Tutup</button>
    </div>`;
  openModal();
  $("#fcbi-val-close").onclick = closeModal;
}

/* Mengembalikan aturan validasi yang kena, atau null kalau peserta lolos.
   Flagging mitra diperiksa lebih dulu karena paling menentukan. */
function fcbiCekValidasi(p) {
  if (p.flaggingMitra) return {
    tone:"bad", judul:"Validasi tidak lolos",
    pesan:`terdaftar sudah termasuk dalam flagging Mitra ${p.flaggingMitra} — tidak bisa melanjutkan ke Pengajuan Cek Kredit Pinjaman Mitra.`
  };
  return p.validasi ? FCBI_VALIDASI[p.validasi] : null;
}

/* Gaji hanya bisa ditampilkan kalau parameter tarif peserta sudah ditentukan;
   kalau belum, field-nya tetap ada tapi dibiarkan kosong. */
function fcbiIsiGaji(prefix, p) {
  $(`#fcbi-${prefix}-gaji`).value = p.tarifDitentukan ? rp(p.gaji) : "";
  $(`#fcbi-${prefix}-gaji-hint`).style.display = p.tarifDitentukan ? "none" : "";
}

/* Peserta yang sedang tampil di kartu Informasi Peserta. */
let fcbiPeserta = null;

$("#fcbi-search").onclick = () => {
  const kpa = $("#fcbi-kpa").value.trim();
  fcbiSembunyikanHasil();
  if (!kpa) { toast("Nomor KPA belum diisi.", "bad"); return; }
  const cocok = p => p.kpa.toLowerCase() === kpa.toLowerCase();

  const p = DATA_FLAGGING_AKTIF.find(cocok)
         || DATA_FLAGGING_PENSIUN_SENDIRI.find(cocok)
         || DATA_FLAGGING_PENSIUN_WARIS.find(cocok);
  if (!p) { toast(`Nomor KPA "${kpa}" tidak ditemukan pada sistem ASABRI.`, "bad"); return; }

  const v = fcbiCekValidasi(p);
  if (v) { fcbiPopupValidasi(p.kpa, v); return; }

  fcbiPeserta = p;               /* dipakai tombol Booking di bawah */
  if (DATA_FLAGGING_AKTIF.includes(p)) {
    $("#fcbi-a-kpa").value   = p.kpa;
    $("#fcbi-a-nama").value  = p.nama;
    $("#fcbi-a-mitra").value = p.mitra;
    fcbiIsiGaji("a", p);
    $("#fcbi-hasil-aktif").style.display = "";
  } else if (DATA_FLAGGING_PENSIUN_SENDIRI.includes(p)) {
    $("#fcbi-s-kpa").value       = p.kpa;
    $("#fcbi-s-nopensiun").value = p.nomorPensiun;
    $("#fcbi-s-nama").value      = p.nama;
    $("#fcbi-s-mitra").value     = p.mitra;
    fcbiIsiGaji("s", p);
    $("#fcbi-hasil-sendiri").style.display = "";
  } else {
    fcbiWarisPeminjam = p.peminjam;
    $("#fcbi-w-kpa").value                = p.kpa;
    $("#fcbi-w-nopens").value             = p.nopens;
    $("#fcbi-w-nopensiun-peminjam").value = "";
    $("#fcbi-w-nama-peminjam").value      = "";
    $("#fcbi-w-nama").value               = p.nama;
    $("#fcbi-w-mitra").value              = p.mitra;
    fcbiIsiGaji("w", p);
    $("#fcbi-hasil-waris").style.display = "";
  }
};

/* Booking individu masuk ke antrean Persetujuan. Nomor pensiun diambil sesuai
   jenis pesertanya: `nomorPensiun` untuk pensiun sendiri, `nopens` untuk waris. */
function fcbiKirimPersetujuan(nama) {
  const p = fcbiPeserta;
  const masuk = fpsTambah({
    ktpa: p.kpa, nrp: p.nrp || "", mitra: p.mitra,
    nopens: p.nomorPensiun || p.nopens || "", nama, tglLahir: p.tglLahir || ""
  }, "Check dan Booking Individu");
  renderFps();
  toast(masuk
    ? `Booking pinjaman untuk ${nama} diajukan dan masuk antrean Persetujuan.`
    : `${nama} sudah punya pengajuan yang menunggu persetujuan.`, masuk ? "ok" : "bad");
}

$("#fcbi-a-booking").onclick = () => fcbiKirimPersetujuan($("#fcbi-a-nama").value);

$("#fcbi-s-booking").onclick = () => fcbiKirimPersetujuan($("#fcbi-s-nama").value);

$("#fcbi-w-booking").onclick = () => {
  if (!$("#fcbi-w-nama-peminjam").value.trim()) { toast("Nomor Pensiun Peminjam belum dipilih.", "bad"); return; }
  fcbiKirimPersetujuan($("#fcbi-w-nama-peminjam").value);
};


/* =============================================== FLAGGING » CHECK DAN BOOKING » KOLEKTIF */

let fcbkPager  = { hal: 1, per: 6 };
let fcbkFilter = { ktpa: "", nrp: "", nik: "", nama: "" };
/* Salinan yang bisa berubah — data asli di data.js dibiarkan utuh supaya
   refresh browser selalu mengembalikan kondisi awal. Baris batch bertambah
   tiap kali booking disimpan; status booking peserta ikut diperbarui. */
let fcbkBatchRows   = [...DATA_FLAGGING_KOLEKTIF_BATCH];
let fcbkPesertaRows = DATA_FLAGGING_KOLEKTIF_PESERTA.map(r => ({ ...r }));


/* ---- tab Mitra / Kolektif */
function fcbkGotoTab(tab) {
  $$("[data-fcbk-tab]").forEach(b => b.classList.toggle("active", b.dataset.fcbkTab === tab));
  $("#fcbk-panel-mitra").style.display   = tab === "mitra"   ? "" : "none";
  $("#fcbk-panel-peserta").style.display = tab === "peserta" ? "" : "none";
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fcbk-tab]");
  if (b) fcbkGotoTab(b.dataset.fcbkTab);
});

/* ---- tab Mitra: daftar peserta */
/* Tab Peserta hanya memuat peserta yang sudah dibooking — barisnya bertambah
   begitu tombol Booking di layar Check & Booking ditekan. */
function fcbkRows() {
  const f = fcbkFilter;
  return fcbkPesertaRows.filter(r => r.booking &&
    (!f.ktpa || r.ktpa.toLowerCase().includes(f.ktpa)) &&
    (!f.nrp  || r.nrp.includes(f.nrp)) &&
    /* Berkas mitra belum membawa kolom NIK, jadi filternya dicocokkan ke NRP
       yang pada peserta ASN memang berupa NIP 18 digit. */
    (!f.nik  || r.nrp.includes(f.nik)) &&
    (!f.nama || r.nama.toLowerCase().includes(f.nama) || r.namaPenerima.toLowerCase().includes(f.nama))
  );
}

/* Kode Y/T ditampilkan sebagai badge kecil supaya sekilas terbaca, sama
   seperti kolom status di tabel lain. */
const fcbkKode = v => `<span class="pill ${v === "Y" ? "pill-ok" : "pill-info"}">${esc(v)}</span>`;
const fcbkKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;

function renderFcbkPeserta() {
  const rows = fcbkRows();
  const pg   = pagerPotong(rows, fcbkPager);

  $("#fcbk-peserta-body").innerHTML = pg.hal.length
    ? pg.hal.map((r, i) => `
      <tr>
        <td>${pg.mulai + i + 1}</td>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${fcbkKosong(r.nomorPensiun)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td>${fcbkKode(r.pensiun)}</td>
        <td>${fcbkKode(r.hidup)}</td>
        <td>${fcbkKosong(r.nopensPenerima)}</td>
        <td class="t-strong">${esc(r.namaPenerima)}</td>
        <td><input type="checkbox" ${r.booking ? "checked" : ""} disabled
             aria-label="${r.booking ? "Sudah dibooking" : "Belum dibooking"}"></td>
      </tr>`).join("")
    : `<tr><td colspan="11"><div class="empty">${
        fcbkPesertaRows.some(r => r.booking)
          ? "Tidak ada peserta yang cocok dengan filter."
          : "Belum ada peserta yang dibooking. Jalankan Check &amp; Booking Flagging Kolektif terlebih dahulu."
      }</div></td></tr>`;

  $("#fcbk-peserta-count").innerHTML  = pagerNote(pg, "peserta", "");
  $("#fcbk-peserta-pager").innerHTML  = rows.length ? pagerHtml(fcbkPager, pg, "data-fcbk-hal") : "";
  renderTopNotif();
}

$("#fcbk-cari").onclick = () => {
  fcbkFilter = {
    ktpa:   $("#fcbk-f-ktpa").value.trim().toLowerCase(),
    nrp:    $("#fcbk-f-nrp").value.trim(),
    nik:    $("#fcbk-f-nik").value.trim(),
    nama:   $("#fcbk-f-nama").value.trim().toLowerCase()
  };
  fcbkPager.hal = 1;
  renderFcbkPeserta();
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fcbk-hal]");
  if (b) { fcbkPager.hal = +b.dataset.fcbkHal; renderFcbkPeserta(); }
});

/* ---- tab Mitra: riwayat batch */
function renderFcbkBatch() {
  $("#fcbk-batch-body").innerHTML = fcbkBatchRows.length
    ? fcbkBatchRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="t-strong">${esc(r.mitra)}</td>
        <td><span class="pill ${r.status === "Selesai" ? "pill-ok" : "pill-warn"}">${esc(r.status)}</span></td>
        <td>${esc(r.pengguna)}</td>
        <td>${esc(r.tanggal)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty">Belum ada batch kolektif yang diunggah.</div></td></tr>`;
  $("#fcbk-batch-count").textContent = `Menampilkan ${fcbkBatchRows.length} data`;
}

/* ---- layar Check & Booking Flagging Kolektif (Mitra + unggah berkas)
   Berkas yang diunggah ditampilkan apa adanya di tabel di bawah form; kolom
   Booking berupa kotak centang, dan peserta yang sudah pernah dibooking
   dikunci supaya tidak terpilih dua kali. */
let fcbkFilePilih = "";
let fcbkHasilTampil = false;
let fcbkHasilPager  = { hal: 1, per: 10 };
const fcbkPilih = new Set();          /* index baris yang dicentang */

bindMitraAutocomplete("fcbk-mitra", "fcbk-mitra-list");

function fcbkResetCheck() {
  fcbkFilePilih       = "";
  fcbkHasilTampil     = false;
  fcbkHasilPager.hal  = 1;
  fcbkPilih.clear();
  $("#fcbk-mitra").value             = "";
  $("#fcbk-file-nama").style.display = "none";
  $("#fcbk-hasil").style.display     = "none";
}

$("#fcbk-pilih-file").onclick = () => {
  fcbkFilePilih = "batch-flagging-kolektif.xlsx";
  $("#fcbk-file-nama").textContent   = `✓ ${fcbkFilePilih} siap diproses`;
  $("#fcbk-file-nama").style.display = "";
};

/* Hasil pengecekan per baris — baris tanpa kolom `validasi` berarti lolos. */
const fcbkValidasi = r => r.validasi
  ? `<span class="pill pill-bad">${esc(r.validasi)}</span>`
  : `<span class="pill pill-ok">Lolos</span>`;

function renderFcbkHasil() {
  const pg = pagerPotong(fcbkPesertaRows, fcbkHasilPager);
  /* Nomor urut dan kunci centang memakai index absolut, bukan index halaman,
     supaya pilihan tetap utuh saat pindah halaman. */
  $("#fcbk-hasil-body").innerHTML = pg.hal.map((r, n) => { const i = pg.mulai + n; return `
    <tr>
      <td>${i + 1}</td>
      <td class="t-strong">${esc(r.ktpa)}</td>
      <td>${esc(r.nrp)}</td>
      <td>${fcbkKosong(r.nomorPensiun)}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td>${esc(r.tglLahir)}</td>
      <td>${fcbkKode(r.pensiun)}</td>
      <td>${fcbkKode(r.hidup)}</td>
      <td>${fcbkKosong(r.nopensPenerima)}</td>
      <td class="t-strong">${esc(r.namaPenerima)}</td>
      <td>${fcbkValidasi(r)}</td>
      <td><input type="checkbox" data-fcbk-row="${i}" ${fcbkPilih.has(i) ? "checked" : ""}></td>
    </tr>`; }).join("");

  const total = fcbkPesertaRows.length;
  $("#fcbk-hasil-count").textContent = `${fcbkPilih.size} dari ${total} peserta dipilih`;
  $("#fcbk-hasil-note").innerHTML    = pagerNote(pg, "peserta", "");
  $("#fcbk-hasil-pager").innerHTML   = pagerHtml(fcbkHasilPager, pg, "data-fcbkh-hal");

  /* Centang-semua ikut keadaan baris: penuh, sebagian, atau kosong. */
  const all = $("#fcbk-chk-all");
  all.checked       = total > 0 && fcbkPilih.size === total;
  all.indeterminate = fcbkPilih.size > 0 && fcbkPilih.size < total;
}

$("#fcbk-chk-all").onchange = e => {
  fcbkPilih.clear();
  if (e.target.checked) fcbkPesertaRows.forEach((_, i) => fcbkPilih.add(i));
  renderFcbkHasil();
};
$("#fcbk-hasil-body").onchange = e => {
  const c = e.target.closest("[data-fcbk-row]");
  if (!c) return;
  const i = +c.dataset.fcbkRow;
  if (c.checked) fcbkPilih.add(i); else fcbkPilih.delete(i);
  renderFcbkHasil();
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fcbkh-hal]");
  if (b) { fcbkHasilPager.hal = +b.dataset.fcbkhHal; renderFcbkHasil(); }
});

$("#fcbk-proses").onclick = () => {
  if (!$("#fcbk-mitra").value.trim()) { toast("Mitra belum dipilih.", "bad"); return; }
  if (!fcbkFilePilih)                 { toast("File batch belum diunggah.", "bad"); return; }

  /* Peserta yang sudah dibooking ikut tercentang sejak awal, tapi tetap bisa
     dilepas centangnya kalau operator ingin membatalkan bookingnya. */
  fcbkPilih.clear();
  fcbkPesertaRows.forEach((r, i) => { if (r.booking) fcbkPilih.add(i); });
  fcbkHasilTampil    = true;
  fcbkHasilPager.hal = 1;
  renderFcbkHasil();
  $("#fcbk-hasil").style.display = "";
  const gagal = fcbkPesertaRows.filter(r => r.validasi).length;
  toast(`Berkas diproses — ${fcbkPesertaRows.length} peserta ditemukan` +
        (gagal ? `, ${gagal} tidak lolos validasi.` : "."), "ok");
};

$("#fcbk-simpan-booking").onclick = () => {
  const mitra = $("#fcbk-mitra").value.trim();
  if (!fcbkHasilTampil) { toast("Proses berkas terlebih dahulu.", "bad"); return; }
  if (!fcbkPilih.size)  { toast("Pilih minimal satu peserta untuk dibooking.", "bad"); return; }

  /* Yang tidak lolos validasi tidak boleh ikut dibooking. */
  const ditolak = [...fcbkPilih].filter(i => fcbkPesertaRows[i].validasi).length;
  if (ditolak) {
    toast(`${ditolak} peserta yang dipilih tidak lolos validasi — lepas centangnya terlebih dahulu.`, "bad");
    return;
  }

  const jumlah = fcbkPilih.size;
  /* Setiap peserta terpilih ikut masuk antrean Persetujuan. */
  let masuk = 0;
  fcbkPilih.forEach(i => {
    const r = fcbkPesertaRows[i];
    if (fpsTambah({
      ktpa: r.ktpa, nrp: r.nrp, mitra, nopens: r.nomorPensiun,
      nama: r.nama, tglLahir: r.tglLahir
    }, "Check dan Booking Kolektif")) masuk++;
  });
  fcbkPesertaRows.forEach((r, i) => r.booking = fcbkPilih.has(i));
  fcbkBatchRows.unshift({
    mitra, status:"Selesai", pengguna:"Operator Kepesertaan",
    tanggal: new Date().toISOString().slice(0, 10)
  });
  renderFcbkBatch();
  renderFcbkPeserta();
  renderFps();
  go("flagging-cb-kolektif");
  fcbkGotoTab("mitra");
  toast(`Booking flagging kolektif ${mitra} berhasil untuk ${jumlah} peserta` +
        (masuk ? `, ${masuk} masuk antrean Persetujuan.` : "."), "ok");
};

renderFcbkPeserta();
renderFcbkBatch();

/* ===================================================== FLAGGING » PINJAMAN » PENGAJUAN */

let fpgPager  = { hal: 1, per: 10 };
let fpgFilter = { cari: "", status: "Semua Status" };
/* Salinan hidup — status pinjaman berubah saat booking dibatalkan. */
let fpgRowsAll = DATA_FLAGGING_PENGAJUAN.map(r => ({ ...r, riwayat: r.riwayat.map(h => ({ ...h })) }));

$("#fpg-f-status").innerHTML =
  ["Semua Status", ...FPG_STATUS_PINJAMAN].map(s => `<option>${esc(s)}</option>`).join("");

const fpgPillStatus = s => `<span class="pill ${
  s === "Booked" ? "pill-ok" : s === "Dibatalkan" ? "pill-bad" : "pill-warn"}">${esc(s)}</span>`;
const fpgKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;

/* Semua status tampil di sini, termasuk yang masih "Pengajuan" dan sedang
   menunggu keputusan di Persetujuan. */
function fpgRows() {
  const f = fpgFilter;
  return fpgRowsAll.filter(r =>
    FPG_STATUS_PINJAMAN.includes(r.statusPinjaman) &&
    (f.status === "Semua Status" || r.statusPinjaman === f.status) &&
    (!f.cari || [r.ktpa, r.nrp, r.nama].some(v => v.toLowerCase().includes(f.cari)))
  );
}

function renderFpg() {
  const rows = fpgRows();
  const pg   = pagerPotong(rows, fpgPager);

  $("#fpg-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => `
      <tr>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${esc(r.mitra)}</td>
        <td>${fpgKosong(r.nomorPensiun)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td>${fpgPillStatus(r.statusPinjaman)}</td>
        <td>${esc(r.statusPensiun)}</td>
        <td>${fpgKosong(r.bookingTgl)}</td>
        <td>${fpgKosong(r.bookingUser)}</td>
        <td>${esc(r.pengajuanTgl)}</td>
        <td>${esc(r.pengajuanUser)}</td>
        <td class="truncate-cell" title="${esc(r.catatan)}">${fpgKosong(r.catatan)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-fpg-detail="${esc(r.ktpa)}">Detail</button>
          <button class="btn btn-ghost btn-sm" data-fpg-riwayat="${esc(r.ktpa)}">Riwayat</button>
          <button class="btn btn-danger btn-sm" data-fpg-batal="${esc(r.ktpa)}"
            ${r.statusPinjaman === "Booked" ? "" : "disabled"}
            title="${r.statusPinjaman === "Booked" ? "Batalkan booking" : "Hanya untuk pengajuan berstatus Booked"}">Batal Booking</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="14"><div class="empty">Tidak ada pengajuan yang cocok dengan filter.</div></td></tr>`;

  $("#fpg-count").innerHTML = pagerNote(pg, "pengajuan", "");
  $("#fpg-pager").innerHTML = rows.length ? pagerHtml(fpgPager, pg, "data-fpg-hal") : "";
}

$("#fpg-cari").onclick = () => {
  fpgFilter = {
    cari:   $("#fpg-f-cari").value.trim().toLowerCase(),
    status: $("#fpg-f-status").value
  };
  fpgPager.hal = 1;
  renderFpg();
};

/* ---- layar Unggah Pengajuan Flagging */
let fpgFilePilih = "";

bindMitraAutocomplete("fpg-mitra", "fpg-mitra-list");

function fpgResetUnggah() {
  fpgFilePilih = "";
  $("#fpg-mitra").value             = "";
  $("#fpg-file-nama").style.display = "none";
}

$("#fpg-pilih-file").onclick = () => {
  fpgFilePilih = "pengajuan-flagging.xlsx";
  $("#fpg-file-nama").textContent   = `✓ ${fpgFilePilih} siap diunggah`;
  $("#fpg-file-nama").style.display = "";
};

$("#fpg-kirim").onclick = () => {
  const mitra = $("#fpg-mitra").value.trim();
  if (!mitra)        { toast("Mitra belum dipilih.", "bad"); return; }
  if (!fpgFilePilih) { toast("Berkas pengajuan belum diunggah.", "bad"); return; }

  /* Submit mengirim pengajuan milik mitra tersebut yang masih berstatus
     "Pengajuan" ke antrean Persetujuan. */
  let masuk = 0;
  fpgRowsAll.filter(r => r.mitra === mitra && r.statusPinjaman === "Pengajuan").forEach(r => {
    if (fpsTambah({
      ktpa: r.ktpa, nrp: r.nrp, mitra: r.mitra, nopens: r.nomorPensiun,
      nama: r.nama, tglLahir: r.tglLahir
    }, "Pengajuan")) masuk++;
  });
  renderFps();
  go("flagging-pinjaman-pengajuan");
  toast(masuk
    ? `Berkas pengajuan flagging ${mitra} disubmit — ${masuk} peserta masuk antrean Persetujuan.`
    : `Berkas pengajuan flagging ${mitra} disubmit. Tidak ada pengajuan baru untuk mitra ini.`, "ok");
};

/* ---- aksi per baris */
const fpgCari = ktpa => fpgRowsAll.find(r => r.ktpa === ktpa);

function fpgBaris(label, nilai) {
  return `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--line-soft)">
    <div class="fl caps" style="width:170px;flex-shrink:0;margin:0">${esc(label)}</div>
    <div style="flex:1;font-size:12.5px;color:var(--ink);font-weight:600">${nilai || `<span style="color:var(--faint)">–</span>`}</div>
  </div>`;
}

/* ---- layar Detail Pengajuan (Data Pinjaman)
   Semua field dimulai terkunci; tombol Ubah membuka yang boleh disunting saja.
   KPA/NRP/Nama/NOPENS/Tanggal Lahir peserta, Mitra Bayar, dan Cabang Mitra
   Bayar tetap terkunci karena ikut data induk, bukan isian operator. */
let fpdRow = null;

/* Field yang boleh disunting setelah tombol Ubah ditekan. */
const FPD_EDITABLE = ["fpd-tgl-permohonan", "fpd-p-tgl-lahir", "fpd-p-nopens", "fpd-akhir-kredit",
  "fpd-p-nama", "fpd-norek-tab", "fpd-awal-kredit", "fpd-no-pk", "fpd-plafon", "fpd-norek-kredit",
  "fpd-angsuran", "fpd-jns-tab", "fpd-sub-kredit", "fpd-nik", "fpd-cek-nik",
  "fpd-sp3r", "fpd-pernyataan"];

/* Hanya pengajuan yang masih berstatus "Pengajuan" boleh disunting. Yang sudah
   Booked atau Dibatalkan dikunci: tombol Ubah disembunyikan dan diganti banner
   keterangan, supaya data yang sudah diputuskan tidak berubah lagi. */
const fpdBisaUbah = () => fpdRow && fpdRow.statusPinjaman === "Pengajuan";

function fpdSetUbah(aktif) {
  const boleh = fpdBisaUbah() && aktif;
  FPD_EDITABLE.forEach(id => { const el = $(`#${id}`); if (el) el.disabled = !boleh; });
  $("#fpd-actions").style.display   = boleh ? "" : "none";
  $("#fpd-ubah").style.display      = fpdBisaUbah() && !aktif ? "" : "none";
  $("#fpd-terkunci").style.display  = fpdBisaUbah() ? "none" : "";
  if (!fpdBisaUbah() && fpdRow) {
    $("#fpd-terkunci-teks").textContent =
      `Pengajuan berstatus ${fpdRow.statusPinjaman} tidak dapat diubah. ` +
      `Hanya pengajuan berstatus Pengajuan yang masih bisa disunting.`;
  }
}

function fpdIsi(r) {
  fpdRow = r;
  const p = r.pinjaman;
  $("#fpd-sub").textContent = `${r.ktpa} — ${r.nama}`;

  /* Info Peserta */
  $("#fpd-kpa").value       = r.ktpa;
  $("#fpd-nrp").value       = r.nrp;
  $("#fpd-nama").value      = r.nama;
  $("#fpd-nopens").value    = r.nomorPensiun;
  $("#fpd-tgl-lahir").value = r.tglLahir;
  $("#fpd-gaji").value      = p.gajiPeserta.toLocaleString("id-ID");

  /* Info Pinjaman */
  $("#fpd-tgl-permohonan").value = p.tglPermohonan;
  $("#fpd-p-tgl-lahir").value    = r.tglLahir;
  $("#fpd-p-nopens").value       = r.nomorPensiun;
  $("#fpd-akhir-kredit").value   = p.akhirKredit;
  $("#fpd-p-nama").value         = r.nama;
  $("#fpd-norek-tab").value      = p.norekTab;
  $("#fpd-awal-kredit").value    = p.awalKredit;
  $("#fpd-no-pk").value          = p.noPk;
  $("#fpd-plafon").value         = p.plafon.toLocaleString("id-ID");
  $("#fpd-cabang").value         = p.cabangMitra;
  $("#fpd-norek-kredit").value   = p.norekKredit;
  $("#fpd-angsuran").value       = p.angsuran.toLocaleString("id-ID");
  $("#fpd-mitra").value          = r.mitra;
  $("#fpd-sub-kredit").value     = p.subKredit;
  $("#fpd-jns-tab").value        = p.jnsTab;
  $("#fpd-nik").value            = p.nik;
  $("#fpd-sp3r").value           = "";
  $("#fpd-pernyataan").value     = "";
  $("#fpd-sp3r-nama").textContent       = `Berkas saat ini: ${p.lampiranSp3r}`;
  $("#fpd-pernyataan-nama").textContent = `Berkas saat ini: ${p.lampiranPernyataan}`;

  /* Hasil Cek NIK milik baris sebelumnya tidak boleh ikut terbawa. */
  fpdNikRujukan = null;
  fpdCekKecocokanNik();
  fpdSetUbah(false);
}

$("#fpd-ubah").onclick  = () => fpdSetUbah(true);
$("#fpd-batal").onclick = () => fpdIsi(fpdRow);   /* buang perubahan yang belum disimpan */

/* ---- Cek NIK
   Nama dan Tgl Lahir pada Info Pinjaman dibandingkan dengan registri NIK.
   Yang tidak cocok ditandai merah dan menahan Submit sampai diperbaiki;
   tandanya hilang sendiri begitu isinya sudah sama dengan data NIK. */
let fpdNikRujukan = null;      /* hasil Cek NIK terakhir, null = belum dicek */

function fpdTandaiField(fieldId, errId, salah, pesan) {
  $(`#${fieldId}`).classList.toggle("err", salah);
  $(`#${errId}`).textContent   = salah ? pesan : "";
  $(`#${errId}`).style.display = salah ? "" : "none";
}

/* Perbandingan nama longgar terhadap spasi & besar-kecil huruf. */
const fpdSamaNama = (a, b) =>
  a.trim().replace(/\s+/g, " ").toUpperCase() === b.trim().replace(/\s+/g, " ").toUpperCase();

function fpdCekKecocokanNik() {
  if (!fpdNikRujukan) return { nama: false, tgl: false };
  const nama = !fpdSamaNama($("#fpd-p-nama").value, fpdNikRujukan.nama);
  const tgl  = $("#fpd-p-tgl-lahir").value !== fpdNikRujukan.tglLahir;
  fpdTandaiField("fpd-f-nama", "fpd-err-nama", nama,
    "Nama Tidak Sesuai NIK, harap ubah nama sesuai NIK");
  fpdTandaiField("fpd-f-tgl-lahir", "fpd-err-tgl-lahir", tgl,
    "Tanggal Lahir Tidak Sesuai NIK, harap ubah nama sesuai NIK");
  return { nama, tgl };
}
/* Begitu operator memperbaiki isiannya, tanda merahnya ikut dievaluasi ulang. */
$("#fpd-p-nama").oninput       = fpdCekKecocokanNik;
$("#fpd-p-tgl-lahir").onchange = fpdCekKecocokanNik;

$("#fpd-cek-nik").onclick = () => {
  const nik = $("#fpd-nik").value.trim();
  if (!/^\d{16}$/.test(nik)) {
    showAlertPopupFpd("Validasi NIK", "NIK tidak valid — harus 16 digit angka.", "bad");
    return;
  }
  const rujukan = DATA_NIK[nik];
  if (!rujukan) {
    fpdNikRujukan = null;
    fpdCekKecocokanNik();
    showAlertPopupFpd("Validasi NIK", `NIK ${nik} tidak ditemukan pada data Dukcapil.`, "bad");
    return;
  }
  fpdNikRujukan = rujukan;
  const salah = fpdCekKecocokanNik();
  if (salah.nama || salah.tgl) {
    showAlertPopupFpd("Validasi NIK",
      `NIK ${nik} terdaftar atas nama ${rujukan.nama} (${rujukan.tglLahir}). ` +
      `Perbaiki data yang ditandai merah sebelum mengirim pengajuan.`, "bad");
    return;
  }
  showAlertPopupFpd("Validasi NIK", `NIK ${nik} valid dan cocok dengan Nama serta Tanggal Lahir.`, "ok");
};

function showAlertPopupFpd(judul, pesan, tone) {
  $("#modal-title").textContent = judul;
  $("#modal-sub").textContent   = "";
  $("#modal-body").innerHTML = `
    <div class="alert alert-${tone === "ok" ? "ok" : "bad"}"><span>${tone === "ok" ? "✓" : "⚠"}</span><span>${esc(pesan)}</span></div>
    <div class="form-actions" style="justify-content:flex-end"><button class="btn btn-ghost" id="fpd-alert-tutup">Tutup</button></div>`;
  openModal();
  $("#fpd-alert-tutup").onclick = closeModal;
}

const fpdAngka = v => Number(String(v).replace(/[^\d]/g, "")) || 0;

$("#fpd-simpan").onclick = () => {
  const nik = $("#fpd-nik").value.trim();
  if (!/^\d{16}$/.test(nik))                { toast("NIK harus 16 digit angka.", "bad"); return; }
  if (!$("#fpd-angsuran").value.trim())     { toast("Besaran Angsuran wajib diisi.", "bad"); return; }
  if (!$("#fpd-sub-kredit").value.trim())   { toast("Sub Kredit wajib diisi.", "bad"); return; }

  /* Hasil Cek NIK yang belum diperbaiki menahan pengiriman. */
  const salah = fpdCekKecocokanNik();
  if (salah.nama || salah.tgl) {
    toast("Perbaiki Nama dan/atau Tanggal Lahir agar sesuai NIK sebelum mengirim pengajuan.", "bad");
    return;
  }

  const p = fpdRow.pinjaman;
  p.tglPermohonan = $("#fpd-tgl-permohonan").value;
  p.akhirKredit   = $("#fpd-akhir-kredit").value;
  p.awalKredit    = $("#fpd-awal-kredit").value;
  p.norekTab      = $("#fpd-norek-tab").value.trim();
  p.norekKredit   = $("#fpd-norek-kredit").value.trim();
  p.noPk          = $("#fpd-no-pk").value.trim();
  p.plafon        = fpdAngka($("#fpd-plafon").value);
  p.angsuran      = fpdAngka($("#fpd-angsuran").value);
  p.jnsTab        = $("#fpd-jns-tab").value.trim();
  p.subKredit     = $("#fpd-sub-kredit").value.trim();
  p.nik           = nik;
  /* Nama & NOPENS pada Info Pinjaman boleh berbeda dari data peserta
     (mis. penerima waris), jadi disimpan di baris pengajuannya. */
  fpdRow.nama         = $("#fpd-p-nama").value.trim();
  fpdRow.nomorPensiun = $("#fpd-p-nopens").value.trim();
  fpdRow.tglLahir     = $("#fpd-p-tgl-lahir").value;

  const berkas = id => ($(`#${id}`).files && $(`#${id}`).files[0]);
  if (berkas("fpd-sp3r"))       p.lampiranSp3r       = berkas("fpd-sp3r").name;
  if (berkas("fpd-pernyataan")) p.lampiranPernyataan = berkas("fpd-pernyataan").name;

  fpdRow.riwayat.push({
    tgl: new Date().toISOString().slice(0, 10),
    user: "verifikator.kep",
    aksi: "Data pinjaman diubah",
    ket: "Perubahan disimpan dari layar Detail Pengajuan"
  });

  /* Submit sekaligus mengirim pengajuannya ke antrean Persetujuan. */
  const masuk = fpsTambah({
    ktpa: fpdRow.ktpa, nrp: fpdRow.nrp, mitra: fpdRow.mitra,
    nopens: fpdRow.nomorPensiun, nama: fpdRow.nama, tglLahir: fpdRow.tglLahir
  }, "Pengajuan");
  if (masuk) {
    fpdRow.riwayat.push({
      tgl: new Date().toISOString().slice(0, 10),
      user: "verifikator.kep",
      aksi: "Dikirim ke Persetujuan",
      ket: "Menunggu keputusan Divisi Kepesertaan"
    });
  }

  renderFpg();
  renderFps();
  fpdIsi(fpdRow);
  toast(masuk
    ? `Pengajuan ${fpdRow.nama} disubmit dan masuk antrean Persetujuan.`
    : `Data pinjaman ${fpdRow.nama} disimpan. ${fpdRow.nama} sudah punya pengajuan yang menunggu persetujuan.`,
    masuk ? "ok" : "");
};

/* ---- layar Riwayat Pengajuan
   Satu baris = satu update. Kolom identitas (Mitra, Nama, No KTPA, dst) diambil
   dari baris pengajuannya, sedangkan grup "Update" berisi jejak per kejadian.
   Keterangan tiap update dipasang sebagai tooltip pada kolom Status karena
   susunan kolomnya tidak menyediakan tempat khusus. */
function fprIsi(r) {
  const p = r.pinjaman;
  $("#fpr-sub").textContent = `${r.ktpa} — ${r.nama}`;
  $("#fpr-body").innerHTML = r.riwayat.map(h => `
    <tr>
      <td>${esc(p.tglPermohonan)}</td>
      <td>${esc(r.mitra)}</td>
      <td>${esc(p.cabangMitra)}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td class="t-strong">${esc(r.ktpa)}</td>
      <td>${fpgKosong(r.nomorPensiun)}</td>
      <td>${esc(p.nik)}</td>
      <td>${esc(p.noPk)}</td>
      <td>${esc(h.tgl)}</td>
      <td>${esc(h.user)}</td>
      <td class="t-strong" title="${esc(h.ket)}">${esc(h.aksi)}</td>
    </tr>`).join("");
  $("#fpr-count").textContent = `${r.riwayat.length} update tercatat.`;
}

function fpgBatalBooking(r) {
  $("#modal-title").textContent = "Pembatalan Booking";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico bad";
  $("#modal-ico").textContent   = "⊗";
  $("#modal-body").innerHTML = `
    <div class="field">
      <label class="fl" for="fpg-batal-alasan">Alasan Pembatalan <span class="req">*</span></label>
      <textarea class="inp" id="fpg-batal-alasan" style="height:74px;padding:9px 10px;resize:vertical"
        placeholder="Tuliskan alasan pembatalan booking..."></textarea>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="fpg-batal-batal">Batal</button>
      <button class="btn btn-danger-solid" id="fpg-batal-ok">Batalkan Booking</button>
    </div>`;
  openModal();
  $("#fpg-batal-batal").onclick = closeModal;
  $("#fpg-batal-ok").onclick = () => {
    const alasan = $("#fpg-batal-alasan").value.trim();
    if (!alasan) { toast("Alasan pembatalan wajib diisi.", "bad"); return; }

    /* Pembatalan booking tidak langsung berlaku — diajukan dulu ke Persetujuan,
       sama seperti Pembatalan Flagging dari layar Flagging. */
    const masuk = fpsTambah({
      ktpa: r.ktpa, nrp: r.nrp, mitra: r.mitra, nopens: r.nomorPensiun,
      nama: r.nama, tglLahir: r.tglLahir, aktivitas: "Pengajuan Pembatalan Booking",
      perubahan: [{ label:"Alasan Pembatalan", dari:"–", ke: alasan }]
    }, "Pengajuan");
    if (!masuk) {
      toast(`${r.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
      return;
    }
    r.riwayat.push({
      tgl: fpsHariIni(),
      user: "operator.mitra",
      aksi: "Pembatalan booking diajukan",
      ket: alasan
    });
    renderFpg();
    renderFps();
    closeModal();
    toast(`Pembatalan booking ${r.nama} diajukan — menunggu Persetujuan.`, "ok");
  };
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-fpg-detail]");
  if (bDetail) { fpdIsi(fpgCari(bDetail.dataset.fpgDetail)); go("flagging-pengajuan-detail"); return; }

  const bRiwayat = e.target.closest("[data-fpg-riwayat]");
  if (bRiwayat) { fprIsi(fpgCari(bRiwayat.dataset.fpgRiwayat)); go("flagging-pengajuan-riwayat"); return; }

  const bBatal = e.target.closest("[data-fpg-batal]");
  if (bBatal && !bBatal.disabled) { fpgBatalBooking(fpgCari(bBatal.dataset.fpgBatal)); return; }

  const bHal = e.target.closest("[data-fpg-hal]");
  if (bHal) { fpgPager.hal = +bHal.dataset.fpgHal; renderFpg(); }
});

renderFpg();

/* ==================================================== FLAGGING » PINJAMAN » PERSETUJUAN
   Antrean bersama. Tiga layar memasukkan barisnya lewat fpsTambah():
   Check dan Booking Individu, Check dan Booking Kolektif, dan Pengajuan. */

let fpsPager  = { hal: 1, per: 10 };
let fpsFilter = { cari: "", status: "Semua Status" };
let fpsRows   = DATA_FLAGGING_PERSETUJUAN.map(r => ({ ...r, riwayat: r.riwayat.map(h => ({ ...h })) }));

$("#fps-f-status").innerHTML =
  ["Semua Status", ...FPS_STATUS].map(s => `<option>${esc(s)}</option>`).join("");

const fpsHariIni = () => new Date().toISOString().slice(0, 10);
const fpsPill = s => `<span class="pill ${
  s === "Disetujui" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn"}">${esc(s)}</span>`;
const fpsKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;
/* Pelunasan diberi nada hijau supaya beda dari permintaan yang menambah beban. */
const fpsAktivitasPill = a =>
  `<span class="pill ${a === "Pelunasan" ? "pill-ok" : "pill-info"}">${esc(a || "–")}</span>`;

/* Satu peserta hanya boleh punya satu baris yang masih berstatus "Pengajuan",
   supaya antreannya tidak menumpuk saat layar sumber ditekan berulang kali. */
function fpsTambah(entry, sumber) {
  const adaAntre = fpsRows.some(r => r.ktpa === entry.ktpa && r.status === "Pending");
  if (adaAntre) return false;
  fpsRows.unshift({
    ktpa: entry.ktpa, nrp: entry.nrp || "", mitra: entry.mitra || "",
    nopens: entry.nopens || "", nama: entry.nama, tglLahir: entry.tglLahir || "",
    /* Semua pintu masuk saat ini berupa permohonan pinjaman baru; pemanggil
       boleh menimpanya lewat entry.aktivitas kalau nanti ada jenis lain. */
    aktivitas: entry.aktivitas || "Pengajuan Pinjaman",
    /* Muatan opsional dari layar Flagging: rincian "dari → ke" untuk
       ditampilkan, dan nilai yang diterapkan begitu permintaannya disetujui. */
    perubahan: entry.perubahan, nilaiBaru: entry.nilaiBaru, pelunasan: entry.pelunasan,
    takeoverBaru: entry.takeoverBaru,
    topupBaru: entry.topupBaru,
    /* Khusus take over: `mitra` adalah pengaju, `mitraAwal` pemberi kredit
       lama. Keduanya dipakai untuk menyalakan notifikasi antar mitra. */
    mitraAwal: entry.mitraAwal || "",
    status: "Pending", tglProses: "", sumber,
    riwayat: [{ tgl: fpsHariIni(), user: "operator.mitra", aksi: "Diajukan", ket: `Masuk dari ${sumber}` }]
  });
  return true;
}

function fpsDaftar() {
  const f = fpsFilter;
  return fpsRows.filter(r =>
    (f.status === "Semua Status" || r.status === f.status) &&
    (!f.cari || [r.ktpa, r.nrp, r.nama].some(v => String(v).toLowerCase().includes(f.cari)))
  );
}

function renderFps() {
  const rows = fpsDaftar();
  const pg   = pagerPotong(rows, fpsPager);

  $("#fps-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => `
      <tr>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${esc(r.mitra)}</td>
        <td>${fpsKosong(r.nopens)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td>${fpsAktivitasPill(r.aktivitas)}</td>
        <td>${fpsPill(r.status)}</td>
        <td>${fpsKosong(r.tglProses)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-fps-detail="${esc(r.ktpa)}">Detail</button>
          <button class="btn btn-ghost btn-sm" data-fps-riwayat="${esc(r.ktpa)}">Riwayat</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="10"><div class="empty">Tidak ada data persetujuan yang cocok dengan filter.</div></td></tr>`;

  $("#fps-count").innerHTML = pagerNote(pg, "data", "");
  $("#fps-pager").innerHTML = rows.length ? pagerHtml(fpsPager, pg, "data-fps-hal") : "";
  renderTopNotif();   /* lonceng navbar ikut menyesuaikan */
}

$("#fps-cari").onclick = () => {
  fpsFilter = {
    cari:   $("#fps-f-cari").value.trim().toLowerCase(),
    status: $("#fps-f-status").value
  };
  fpsPager.hal = 1;
  renderFps();
};

const fpsCari = ktpa => fpsRows.find(r => r.ktpa === ktpa);

/* Muatan permintaan diterapkan ke data pinjaman setelah disetujui. */
function fpsTerapkan(r) {
  /* Pembatalan booking sasarannya baris di Pinjaman » Pengajuan, bukan baris
     flagging — jadi ditangani lebih dulu sebelum pencarian ke fflRows. */
  if (r.aktivitas === "Pengajuan Pembatalan Booking") {
    const asal = fpgRowsAll.find(x => x.ktpa === r.ktpa && x.statusPinjaman === "Booked");
    if (!asal) return;
    asal.statusPinjaman = "Dibatalkan";
    asal.catatan        = r.perubahan.map(p => p.ke).join("; ");
    asal.riwayat.push({
      tgl: fpsHariIni(), user:"verifikator.kep",
      aksi:"Booking dibatalkan", ket: asal.catatan
    });
    renderFpg();
    return;
  }

  /* Take over sasarannya baris di Pinjaman » Take Over, bukan baris flagging.
     "Pengajuan Take Over" datang dari layar Tambahkan dan membuat baris baru;
     "Perubahan Take Over" datang dari layar Detail dan memperbarui yang ada. */
  if (r.aktivitas === "Pengajuan Take Over" && r.takeoverBaru) {
    if (!ftoRows.some(x => x.ktpa === r.ktpa)) {
      ftoRows.unshift({ ...r.takeoverBaru, status: "Diterima",
        asTgl: fpsHariIni(), asUser: "verifikator.kep",
        catatan: "Take over disetujui." });
      renderFto();
    }
    return;
  }

  /* Top up sasarannya baris di Pinjaman » Top Up. Satu peserta boleh punya
     beberapa top up, jadi barisnya selalu ditambahkan, tidak diperbarui. */
  if (r.aktivitas === "Pengajuan Top Up" && r.topupBaru) {
    ftuRows.unshift({ ...r.topupBaru, id: "tu" + (++ftuSeq), status: "Diterima",
      tglSetuju: fpsHariIni(), pengguna: "verifikator.kep" });
    renderFtu();
    return;
  }
  if (r.aktivitas === "Perubahan Take Over") {
    const to = ftoRows.find(x => x.ktpa === r.ktpa);
    if (!to) return;
    Object.assign(to.pinjaman, r.nilaiBaru);
    to.tglPelunasan = to.pinjaman.tglPelunasan;   /* kolom daftar ikut menyesuaikan */
    to.asTgl        = fpsHariIni();
    to.asUser       = "verifikator.kep";
    to.catatan      = r.perubahan.map(p => `${p.label}: ${p.dari} → ${p.ke}`).join("; ");
    renderFto();
    if (ftdRow === to) ftdIsi(to);
    return;
  }

  const pinjaman = fflRows.find(x => x.ktpa === r.ktpa);
  if (!pinjaman) return;
  if (r.aktivitas === "Pelunasan" && r.pelunasan) {
    pinjaman.statusPinjaman = "Lunas";
    pinjaman.kategori       = r.pelunasan.kategori;
    pinjaman.riwayat.push({
      tgl: r.pelunasan.tgl, user:"verifikator.kep", aksi:"Pelunasan",
      ket: r.pelunasan.ket + (r.pelunasan.berkas ? ` (berkas: ${r.pelunasan.berkas})` : "")
    });
  } else if (r.aktivitas === "Pengajuan Pembatalan Flagging") {
    pinjaman.statusPinjaman = "Dibatalkan";
    pinjaman.riwayat.push({
      tgl: fpsHariIni(), user:"verifikator.kep",
      aksi:"Pembatalan flagging disetujui",
      ket: r.perubahan.map(p => `${p.label}: ${p.ke}`).join("; ")
    });
  } else if (r.aktivitas === "Pelepasan Flagging") {
    /* Pinjamannya sudah lunas — statusnya tetap, yang dilepas hanya penanda
       flagging di mitra bayar, jadi cukup dicatat di riwayat. */
    pinjaman.statusTagih = "N";
    pinjaman.riwayat.push({
      tgl: fpsHariIni(), user:"verifikator.kep",
      aksi:"Pelepasan flagging disetujui",
      ket: r.perubahan.map(p => `${p.label}: ${p.ke}`).join("; ")
    });
  } else if (r.nilaiBaru) {
    Object.assign(pinjaman.pinjaman, r.nilaiBaru);
    if (r.nilaiBaru.nik !== undefined) pinjaman.nik = r.nilaiBaru.nik;
    pinjaman.riwayat.push({
      tgl: fpsHariIni(), user:"verifikator.kep",
      aksi:"Perubahan data disetujui",
      ket: r.perubahan.map(p => `${p.label}: ${p.dari} → ${p.ke}`).join("; ")
    });
  }
  renderFfl();
  if (ffdRow === pinjaman) ffdIsi(pinjaman);
}

/* ---- layar Detail Persetujuan
   Tombol Setujui/Tolak hanya aktif selama barisnya masih berstatus "Pengajuan";
   yang sudah diputuskan menampilkan banner keterangan sebagai gantinya. */
let fsdRow = null;

/* Satu field mati untuk tampilan baca-saja — dipakai kartu Info Pinjaman. */
function fsdField(label, nilai) {
  return `<div class="field">
    <label class="fl">${esc(label)}</label>
    <input class="inp" value="${esc(nilai || "–")}" disabled>
  </div>`;
}

/* Info Pinjaman diambil dari baris Pengajuan dengan KPA yang sama. Baris yang
   masuk lewat Check dan Booking belum punya berkas pinjaman, jadi kartunya
   tetap tampil tapi berisi keterangan kosong. */
function fsdIsiPinjaman(r) {
  const asal = fpgRowsAll.find(x => x.ktpa === r.ktpa);
  const ada  = !!(asal && asal.pinjaman);
  $("#fsd-pinjaman").style.display        = ada ? "" : "none";
  $("#fsd-pinjaman-kosong").style.display = ada ? "none" : "";
  if (!ada) { $("#fsd-pinjaman").innerHTML = ""; return; }

  const p = asal.pinjaman;
  $("#fsd-pinjaman").innerHTML = [
    fsdField("Tgl Permohonan",            p.tglPermohonan),
    fsdField("Awal Kredit",               p.awalKredit),
    fsdField("Tanggal Akhir Kredit",      p.akhirKredit),
    fsdField("Plafon",                    rp(p.plafon)),
    fsdField("Besaran Angsuran",          rp(p.angsuran)),
    fsdField("Gaji Peserta",              rp(p.gajiPeserta)),
    fsdField("Sub Kredit",                p.subKredit),
    fsdField("Jenis Tabungan",            p.jnsTab),
    fsdField("Cabang Mitra Bayar",        p.cabangMitra),
    fsdField("Nomor Rekening Tabungan",   p.norekTab),
    fsdField("Nomor Rekening Kredit",     p.norekKredit),
    fsdField("Nomor Perjanjian Kredit",   p.noPk),
    fsdField("NIK",                       p.nik),
    fsdField("Lampiran SP3R",             p.lampiranSp3r),
    fsdField("Lampiran Surat Pernyataan", p.lampiranPernyataan)
  ].join("");
}

function fsdIsi(r) {
  fsdRow = r;
  $("#fsd-sub").textContent        = `${r.ktpa} — ${r.nama}`;
  $("#fsd-kpa").value              = r.ktpa;
  $("#fsd-nrp").value              = r.nrp;
  $("#fsd-mitra").value            = r.mitra;
  $("#fsd-nopens").value           = r.nopens;
  $("#fsd-nama").value             = r.nama;
  $("#fsd-tgl-lahir").value        = r.tglLahir;
  $("#fsd-aktivitas").innerHTML    = fpsAktivitasPill(r.aktivitas);
  /* Kartu rincian hanya untuk permintaan yang membawa daftar "dari → ke". */
  $("#fsd-kartu-perubahan").style.display = r.perubahan ? "" : "none";
  if (r.perubahan) $("#fsd-perubahan").innerHTML = r.perubahan.map(p => `
    <tr>
      <td class="t-strong">${esc(p.label)}</td>
      <td>${esc(p.dari)}</td>
      <td class="t-strong">${esc(p.ke)}</td>
    </tr>`).join("");
  $("#fsd-status").innerHTML       = fpsPill(r.status);
  $("#fsd-tgl-proses").value       = r.tglProses || "—";
  $("#fsd-sumber").value           = r.sumber;

  fsdIsiPinjaman(r);

  const menunggu = r.status === "Pending";
  $("#fsd-actions").style.display = menunggu ? "" : "none";
  $("#fsd-selesai").style.display = menunggu ? "none" : "";
  if (!menunggu) {
    const akhir = r.riwayat[r.riwayat.length - 1];
    $("#fsd-selesai-teks").textContent =
      `Pengajuan sudah ${r.status.toLowerCase()} pada ${r.tglProses} oleh ${akhir.user}. ${akhir.ket}`;
  }
}

/* Modal konfirmasi bersama untuk Setujui (catatan opsional) dan
   Tolak (alasan wajib diisi). */
function fsdKonfirmasi(mode) {
  const setuju = mode === "setuju";
  const r = fsdRow;
  $("#modal-title").textContent = setuju ? "Konfirmasi Persetujuan" : "Konfirmasi Penolakan";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico " + (setuju ? "warn" : "bad");
  $("#modal-ico").textContent   = setuju ? "✓" : "⊗";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.7;margin-bottom:16px">
      Pengajuan flagging untuk <b>${esc(r.nama)}</b> pada mitra <b>${esc(r.mitra)}</b>
      akan ${setuju ? "<b>disetujui</b>" : "<b>ditolak</b>"}.
    </div>
    <div class="field">
      <label class="fl" for="fsd-alasan">${setuju
        ? "Catatan Persetujuan"
        : `Alasan Penolakan <span class="req">*</span>`}</label>
      <textarea class="inp" id="fsd-alasan" style="height:74px;padding:9px 10px;resize:vertical"
        placeholder="${setuju ? "Opsional — boleh dikosongkan." : "Wajib diisi."}"></textarea>
      ${setuju ? `<div class="hint">Boleh dikosongkan.</div>` : ""}
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="fsd-konfirm-batal">Batal</button>
      <button class="btn ${setuju ? "btn-success" : "btn-danger-solid"}" id="fsd-konfirm-ok">
        ${setuju ? "✓ Setujui" : "✕ Tolak"}</button>
    </div>`;
  openModal();
  $("#fsd-konfirm-batal").onclick = closeModal;
  $("#fsd-konfirm-ok").onclick = () => {
    const alasan = $("#fsd-alasan").value.trim();
    if (!setuju && !alasan) { toast("Alasan penolakan wajib diisi.", "bad"); return; }

    r.status    = setuju ? "Disetujui" : "Ditolak";
    r.tglProses = fpsHariIni();
    r.riwayat.push({
      tgl: r.tglProses,
      user: "verifikator.kep",
      aksi: setuju ? "Disetujui" : "Ditolak",
      ket: alasan || "Tanpa catatan tambahan"
    });

    /* Permintaan dari layar Flagging (Perubahan Data / Pelunasan /
       Pembatalan Flagging) langsung diterapkan begitu disetujui. */
    if (setuju && r.perubahan) fpsTerapkan(r);

    /* Keputusan di sini menutup pengajuannya: Disetujui → Booked,
       Ditolak → Dibatalkan. Barisnya lalu muncul di Pinjaman » Pengajuan. */
    const asal = fpgRowsAll.find(x => x.ktpa === r.ktpa && x.statusPinjaman === "Pengajuan");
    if (asal) {
      asal.statusPinjaman = setuju ? "Booked" : "Dibatalkan";
      asal.catatan        = alasan || asal.catatan;
      if (setuju) { asal.bookingTgl = r.tglProses; asal.bookingUser = "verifikator.kep"; }
      asal.riwayat.push({
        tgl: r.tglProses,
        user: "verifikator.kep",
        aksi: setuju ? "Booking disetujui" : "Pengajuan ditolak",
        ket: alasan || "Tanpa catatan tambahan"
      });
      renderFpg();
    }

    renderFps();
    fsdIsi(r);
    closeModal();
    toast(`Pengajuan ${r.nama} berhasil ${setuju ? "disetujui" : "ditolak"}.`, setuju ? "ok" : "");
  };
}

$("#fsd-setujui").onclick = () => fsdKonfirmasi("setuju");
$("#fsd-tolak").onclick   = () => fsdKonfirmasi("tolak");

function fpsShowRiwayat(r) {
  $("#modal-title").textContent = "Riwayat Persetujuan";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-body").innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>User</th><th>Aksi</th><th>Keterangan</th></tr></thead>
        <tbody>${r.riwayat.map(h => `
          <tr>
            <td>${esc(h.tgl)}</td>
            <td>${esc(h.user)}</td>
            <td class="t-strong">${esc(h.aksi)}</td>
            <td>${esc(h.ket)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="fps-riwayat-tutup">Tutup</button>
    </div>`;
  openModal();
  $("#fps-riwayat-tutup").onclick = closeModal;
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-fps-detail]");
  if (bDetail) { fsdIsi(fpsCari(bDetail.dataset.fpsDetail)); go("flagging-persetujuan-detail"); return; }

  const bRiwayat = e.target.closest("[data-fps-riwayat]");
  if (bRiwayat) { fpsShowRiwayat(fpsCari(bRiwayat.dataset.fpsRiwayat)); return; }

  const bHal = e.target.closest("[data-fps-hal]");
  if (bHal) { fpsPager.hal = +bHal.dataset.fpsHal; renderFps(); }
});

renderFps();

/* ======================================================= FLAGGING » PINJAMAN » FLAGGING
   Daftar pinjaman yang flagging-nya sudah aktif. Empat aksi per baris:
   Detail (halaman, bisa disunting), Pelunasan, Pembatalan, dan Riwayat. */

let fflPager  = { hal: 1, per: 10 };
let fflFilter = { cari: "", status: "Semua Status" };
let fflRows   = DATA_FLAGGING_PINJAMAN.map(r => ({
  ...r, pinjaman: { ...r.pinjaman }, riwayat: r.riwayat.map(h => ({ ...h }))
}));

$("#ffl-f-status").innerHTML =
  ["Semua Status", ...FFL_STATUS_PINJAMAN].map(s => `<option>${esc(s)}</option>`).join("");

const fflPill = s => `<span class="pill ${
  s === "Lunas" ? "pill-ok" : s === "Dibatalkan" ? "pill-bad" : "pill-info"}">${esc(s)}</span>`;
const fflKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;

function fflDaftar() {
  const f = fflFilter;
  return fflRows.filter(r =>
    (f.status === "Semua Status" || r.statusPinjaman === f.status) &&
    (!f.cari || [r.ktpa, r.nrp, r.nik, r.nama].some(v => String(v).toLowerCase().includes(f.cari)))
  );
}

function renderFfl() {
  const rows = fflDaftar();
  const pg   = pagerPotong(rows, fflPager);
  const aktif = r => r.statusPinjaman === "Disetujui";

  $("#ffl-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => {
      const p = r.pinjaman;
      return `
      <tr>
        <td class="t-strong">${fflKosong(r.ind)}</td>
        <td>${esc(r.mitra)}</td>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${fflKosong(r.nik)}</td>
        <td>${fflKosong(r.nomorPensiun)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${fflKosong(r.tglLahir)}</td>
        <td>${esc(p.tglPermohonan)}</td>
        <td>${esc(p.awalKredit)}</td>
        <td>${esc(p.akhirKredit)}</td>
        <td class="num">${p.plafon.toLocaleString("id-ID")}</td>
        <td>${esc(p.norekTab)}</td>
        <td>${esc(p.norekKredit)}</td>
        <td>${esc(p.noPk)}</td>
        <td>${fflPill(r.statusPinjaman)}</td>
        <td>${esc(r.statusTagih)}</td>
        <td>${fflKosong(r.kategori)}</td>
        <td>${fflKosong(r.tglSetuju)}</td>
        <td>${fflKosong(r.pengguna)}</td>
        <td class="stick-r" style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-ffl-detail="${esc(r.ktpa)}">Detail</button>
          <button class="btn btn-success btn-sm" data-ffl-lunas="${esc(r.ktpa)}" ${aktif(r) ? "" : "disabled"}
            title="${aktif(r) ? "Catat pelunasan" : "Hanya untuk pinjaman berstatus Disetujui"}">Pelunasan</button>
          <button class="btn btn-danger btn-sm" data-ffl-batal="${esc(r.ktpa)}" ${aktif(r) ? "" : "disabled"}
            title="${aktif(r) ? "Batalkan flagging" : "Hanya untuk pinjaman berstatus Disetujui"}">Pembatalan</button>
          <button class="btn btn-ghost btn-sm" data-ffl-riwayat="${esc(r.ktpa)}">Riwayat</button>
        </td>
      </tr>`; }).join("")
    : `<tr><td colspan="21"><div class="empty">Tidak ada pinjaman yang cocok dengan filter.</div></td></tr>`;

  $("#ffl-count").innerHTML = pagerNote(pg, "pinjaman", "");
  $("#ffl-pager").innerHTML = rows.length ? pagerHtml(fflPager, pg, "data-ffl-hal") : "";
}

$("#ffl-cari").onclick = () => {
  fflFilter = {
    cari:   $("#ffl-f-cari").value.trim().toLowerCase(),
    status: $("#ffl-f-status").value
  };
  fflPager.hal = 1;
  renderFfl();
};

const fflCari = ktpa => fflRows.find(r => r.ktpa === ktpa);

/* ---- Detail Flagging: Info Peserta + Info Pinjaman, bisa disunting seperti
   layar Detail Pengajuan. Hanya pinjaman berstatus Disetujui yang boleh diubah. */
let ffdRow = null;

const FFD_EDITABLE = ["ffd-tgl-permohonan", "ffd-no-pk", "ffd-awal-kredit", "ffd-norek-tab",
  "ffd-akhir-kredit", "ffd-norek-kredit", "ffd-plafon", "ffd-angsuran",
  "ffd-sub-kredit", "ffd-jns-tab", "ffd-nik"];

/* Pinjaman yang sudah Disetujui atau Lunas tidak boleh disunting — begitu pula
   yang Dibatalkan. Karena ketiganya adalah seluruh status yang mungkin di layar
   ini, praktisnya Detail Flagging bersifat baca-saja; daftar dibuat eksplisit
   supaya mudah dilonggarkan lagi kalau nanti ada status baru. */
const FFD_TERKUNCI = ["Disetujui", "Lunas", "Dibatalkan"];
const ffdBisaUbah = () => ffdRow && !FFD_TERKUNCI.includes(ffdRow.statusPinjaman);

function ffdSetUbah(aktif) {
  const boleh = ffdBisaUbah() && aktif;
  FFD_EDITABLE.forEach(id => { const el = $(`#${id}`); if (el) el.disabled = !boleh; });
  $("#ffd-actions").style.display  = boleh ? "" : "none";
  $("#ffd-ubah").style.display     = ffdBisaUbah() && !aktif ? "" : "none";
  $("#ffd-terkunci").style.display = ffdBisaUbah() ? "none" : "";
  if (!ffdBisaUbah() && ffdRow) {
    $("#ffd-terkunci-teks").textContent =
      `Pinjaman berstatus ${ffdRow.statusPinjaman} tidak dapat diubah. ` +
      `Data pinjaman yang flagging-nya sudah aktif hanya bisa dilihat.`;
  }
}

function ffdIsi(r) {
  ffdRow = r;
  const p = r.pinjaman;
  $("#ffd-sub").textContent = `${r.ktpa} — ${r.nama}`;

  $("#ffd-ktpa").value      = r.ktpa;
  $("#ffd-nrp").value       = r.nrp;
  $("#ffd-nama").value      = r.nama;
  $("#ffd-nopens").value    = r.nomorPensiun;
  $("#ffd-tgl-lahir").value = r.tglLahir;
  $("#ffd-gaji").value      = p.gajiPeserta.toLocaleString("id-ID");

  $("#ffd-tgl-permohonan").value = p.tglPermohonan;
  $("#ffd-no-pk").value          = p.noPk;
  $("#ffd-awal-kredit").value    = p.awalKredit;
  $("#ffd-norek-tab").value      = p.norekTab;
  $("#ffd-akhir-kredit").value   = p.akhirKredit;
  $("#ffd-norek-kredit").value   = p.norekKredit;
  $("#ffd-plafon").value         = p.plafon.toLocaleString("id-ID");
  $("#ffd-mitra").value          = r.mitra;
  $("#ffd-angsuran").value       = p.angsuran.toLocaleString("id-ID");
  $("#ffd-cabang").value         = p.cabangMitra;
  $("#ffd-sub-kredit").value     = p.subKredit;
  $("#ffd-jns-tab").value        = p.jnsTab;
  $("#ffd-nik").value            = p.nik;
  $("#ffd-status").innerHTML     = fflPill(r.statusPinjaman);

  ffdSetUbah(false);
}

$("#ffd-ubah").onclick  = () => ffdSetUbah(true);
$("#ffd-batal").onclick = () => ffdIsi(ffdRow);

/* Perubahan tidak langsung berlaku — dikirim sebagai permintaan persetujuan
   dengan aktivitas "Perubahan Data" ke Persetujuan. Hanya field
   yang benar-benar berubah yang ikut diajukan. */
$("#ffd-simpan").onclick = () => {
  if (!$("#ffd-angsuran").value.trim())   { toast("Besaran Angsuran wajib diisi.", "bad"); return; }
  if (!$("#ffd-sub-kredit").value.trim()) { toast("Sub Kredit wajib diisi.", "bad"); return; }

  const p = ffdRow.pinjaman;
  const isian = [
    { key:"tglPermohonan", label:"Tgl Pengajuan",             nilai: $("#ffd-tgl-permohonan").value },
    { key:"noPk",          label:"Nomor Perjanjian Kredit",   nilai: $("#ffd-no-pk").value.trim() },
    { key:"awalKredit",    label:"Awal Kredit",               nilai: $("#ffd-awal-kredit").value },
    { key:"norekTab",      label:"Nomor Rekening Tabungan",   nilai: $("#ffd-norek-tab").value.trim() },
    { key:"akhirKredit",   label:"Akhir Kredit",              nilai: $("#ffd-akhir-kredit").value },
    { key:"norekKredit",   label:"Nomor Rekening Kredit",     nilai: $("#ffd-norek-kredit").value.trim() },
    { key:"plafon",        label:"Plafon",                    nilai: fpdAngka($("#ffd-plafon").value),   uang:true },
    { key:"angsuran",      label:"Besaran Angsuran",          nilai: fpdAngka($("#ffd-angsuran").value), uang:true },
    { key:"subKredit",     label:"Sub Kredit",                nilai: $("#ffd-sub-kredit").value.trim() },
    { key:"jnsTab",        label:"Jenis Tabungan",            nilai: $("#ffd-jns-tab").value.trim() },
    { key:"nik",           label:"NIK",                       nilai: $("#ffd-nik").value.trim() }
  ];

  const berubah = isian.filter(f => String(f.nilai) !== String(p[f.key]));
  if (!berubah.length) { toast("Tidak ada perubahan untuk diajukan.", "bad"); return; }

  const tampil = f => f.uang ? rp(f.nilai) : (f.nilai || "–");
  const asal   = f => f.uang ? rp(p[f.key]) : (p[f.key] || "–");
  const masuk = fpsTambah({
    ktpa: ffdRow.ktpa, nrp: ffdRow.nrp, mitra: ffdRow.mitra, nopens: ffdRow.nomorPensiun,
    nama: ffdRow.nama, tglLahir: ffdRow.tglLahir, aktivitas: "Perubahan Data",
    perubahan: berubah.map(f => ({ label: f.label, dari: asal(f), ke: tampil(f) })),
    nilaiBaru: Object.fromEntries(berubah.map(f => [f.key, f.nilai]))
  }, "Detail Flagging");
  if (!masuk) {
    toast(`${ffdRow.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
    return;
  }

  ffdRow.riwayat.push({
    tgl: fpsHariIni(), user: "operator.mitra",
    aksi: "Perubahan data diajukan",
    ket: `${berubah.length} field menunggu persetujuan`
  });
  renderFps();
  ffdIsi(ffdRow);          /* kembalikan tampilan ke nilai lama yang masih berlaku */
  toast(`Perubahan data ${ffdRow.nama} diajukan — menunggu Persetujuan.`, "ok");
};

/* ---- layar Pelunasan
   Info Peserta & Info Pinjaman ditampilkan baca-saja (memakai fsdField), lalu
   bagian Pelunasan yang harus diisi. Tgl Pelunasan diisi awal dari Tanggal
   Akhir Kredit; kedua field wajib diisi sebelum bisa disimpan. */
let fplRow = null;

function fplIsi(r) {
  fplRow = r;
  const p = r.pinjaman;
  $("#fpl-sub").textContent = `${r.ktpa} — ${r.nama}`;

  $("#fpl-peserta").innerHTML = [
    fsdField("No. KTPA",      r.ktpa),
    fsdField("NRP/NIP",       r.nrp),
    fsdField("Nama",          r.nama),
    fsdField("Nomor Pensiun", r.nomorPensiun),
    fsdField("Tanggal Lahir", r.tglLahir),
    fsdField("Gaji Peserta",  rp(p.gajiPeserta))
  ].join("");

  $("#fpl-pinjaman").innerHTML = [
    fsdField("Tgl Pengajuan",             p.tglPermohonan),
    fsdField("Awal Kredit",               p.awalKredit),
    fsdField("Akhir Kredit",              p.akhirKredit),
    fsdField("Plafon",                    rp(p.plafon)),
    fsdField("Besaran Angsuran",          rp(p.angsuran)),
    fsdField("Sub Kredit",                p.subKredit),
    fsdField("Mitra Bayar",               r.mitra),
    fsdField("Cabang Mitra Bayar",        p.cabangMitra),
    fsdField("Jenis Tabungan",            p.jnsTab),
    fsdField("Nomor Rekening Tabungan",   p.norekTab),
    fsdField("Nomor Rekening Kredit",     p.norekKredit),
    fsdField("Nomor Perjanjian Kredit",   p.noPk)
  ].join("");

  $("#fpl-tgl").value    = p.akhirKredit;   /* mengikuti Tanggal Akhir Kredit */
  $("#fpl-ket").value    = "";
  $("#fpl-berkas").value = "";
  /* Hanya kategori yang boleh dipilih manual yang masuk daftar; Jatuh Tempo
     ditetapkan sistem lewat fplKategori(). */
  $("#fpl-kategori").innerHTML =
    [`<option value="">Pilih kategori pelunasan…</option>`,
     ...FFL_KATEGORI_PILIHAN.map(k => `<option>${esc(k)}</option>`)].join("");
  fplTinjauKategori();
}

/* Pelunasan yang tanggalnya sudah mencapai Tanggal Akhir Kredit dihitung
   sebagai jatuh tempo, apa pun pilihan operatornya. */
function fplKategori() {
  const tgl = $("#fpl-tgl").value;
  const akhir = fplRow ? fplRow.pinjaman.akhirKredit : "";
  if (tgl && akhir && tgl >= akhir) return FFL_KATEGORI_JATUH_TEMPO;
  return $("#fpl-kategori").value;
}

/* Beri tahu operator lebih dulu kalau tanggalnya membuat kategorinya dikunci
   sistem, supaya hasilnya tidak mengejutkan saat disimpan. */
function fplTinjauKategori() {
  const jatuhTempo = fplKategori() === FFL_KATEGORI_JATUH_TEMPO;
  $("#fpl-kategori").disabled = jatuhTempo;
  $("#fpl-kategori-hint").textContent = jatuhTempo
    ? `Tanggal pelunasan sudah mencapai Tanggal Akhir Kredit (${fplRow.pinjaman.akhirKredit}) — sistem mencatatnya sebagai ${FFL_KATEGORI_JATUH_TEMPO}.`
    : "Pelunasan sebelum Tanggal Akhir Kredit; pilih kategorinya.";
}
$("#fpl-tgl").onchange = fplTinjauKategori;

$("#fpl-simpan").onclick = () => {
  const tgl      = $("#fpl-tgl").value;
  const kategori = fplKategori();
  const ket      = $("#fpl-ket").value.trim();
  const f        = $("#fpl-berkas").files && $("#fpl-berkas").files[0];
  const berkas   = f ? f.name : "";
  if (!tgl)      { toast("Tgl Pelunasan wajib diisi.", "bad"); return; }
  if (!kategori) { toast("Kategori Pelunasan wajib dipilih.", "bad"); return; }
  if (!berkas)   { toast("Berkas bukti pelunasan wajib diunggah.", "bad"); return; }
  if (!ket)      { toast("Keterangan pelunasan wajib diisi.", "bad"); return; }

  /* Pelunasan juga lewat persetujuan — status baru berubah setelah disetujui. */
  const masuk = fpsTambah({
    ktpa: fplRow.ktpa, nrp: fplRow.nrp, mitra: fplRow.mitra, nopens: fplRow.nomorPensiun,
    nama: fplRow.nama, tglLahir: fplRow.tglLahir, aktivitas: "Pelunasan",
    perubahan: [
      { label:"Tgl Pelunasan",      dari:"–", ke: tgl },
      { label:"Kategori Pelunasan", dari:"–", ke: kategori },
      { label:"Berkas",             dari:"–", ke: berkas },
      { label:"Keterangan",         dari:"–", ke: ket }
    ],
    pelunasan: { tgl, kategori, ket, berkas }
  }, "Pelunasan");
  if (!masuk) {
    toast(`${fplRow.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
    return;
  }

  fplRow.riwayat.push({
    tgl, user: "operator.mitra", aksi: "Pelunasan diajukan", ket
  });
  renderFps();
  go("flagging-pinjaman-flagging");
  toast(`Pelunasan ${fplRow.nama} diajukan — menunggu Persetujuan.`, "ok");
};

/* ---- Pembatalan Flagging — modal konfirmasi dengan alasan wajib.
   Pelunasan punya layar sendiri karena isiannya lebih banyak. */
function fflPembatalan(r) {
  $("#modal-title").textContent = "Konfirmasi Pembatalan Flagging";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico bad";
  $("#modal-ico").textContent   = "⊗";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.7;margin-bottom:16px">
      Pinjaman <b>${esc(r.nama)}</b> di <b>${esc(r.mitra)}</b> akan ditandai
      <b>Dibatalkan</b>. Flagging pada mitra bayar ikut dilepas.
    </div>
    <div class="field">
      <label class="fl" for="ffl-alasan">Alasan Pembatalan <span class="req">*</span></label>
      <textarea class="inp" id="ffl-alasan" style="height:74px;padding:9px 10px;resize:vertical"
        placeholder="Wajib diisi."></textarea>
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="ffl-konfirm-batal">Batal</button>
      <button class="btn btn-danger-solid" id="ffl-konfirm-ok">✕ Batalkan Flagging</button>
    </div>`;
  openModal();
  $("#ffl-konfirm-batal").onclick = closeModal;
  $("#ffl-konfirm-ok").onclick = () => {
    const alasan = $("#ffl-alasan").value.trim();
    if (!alasan) { toast("Alasan pembatalan wajib diisi.", "bad"); return; }

    /* Sama seperti Perubahan Data dan Pelunasan, pembatalan tidak langsung
       berlaku — statusnya baru berubah setelah disetujui. */
    const masuk = fpsTambah({
      ktpa: r.ktpa, nrp: r.nrp, mitra: r.mitra, nopens: r.nomorPensiun,
      nama: r.nama, tglLahir: r.tglLahir, aktivitas: "Pengajuan Pembatalan Flagging",
      perubahan: [{ label:"Alasan Pembatalan", dari:"–", ke: alasan }]
    }, "Detail Flagging");
    if (!masuk) {
      toast(`${r.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
      return;
    }
    r.riwayat.push({
      tgl: fpsHariIni(), user: "operator.mitra",
      aksi: "Pembatalan flagging diajukan", ket: alasan
    });
    renderFps();
    closeModal();
    toast(`Pembatalan flagging ${r.nama} diajukan — menunggu Persetujuan.`, "ok");
  };
}

/* ---- layar Riwayat Flagging
   Satu baris = satu update. Kolom identitas diambil dari baris pinjamannya,
   grup "Update" berisi jejak per kejadian. Keterangan tiap update dipasang
   sebagai tooltip pada kolom Status karena susunan kolomnya tidak menyediakan
   tempat khusus — sama seperti Riwayat Pengajuan. */
function ffrIsi(r) {
  const p = r.pinjaman;
  $("#ffr-sub").textContent = `${r.ktpa} — ${r.nama}`;
  $("#ffr-body").innerHTML = r.riwayat.map(h => `
    <tr>
      <td>${esc(p.tglPermohonan)}</td>
      <td>${esc(r.mitra)}</td>
      <td>${esc(p.cabangMitra)}</td>
      <td class="t-strong">${esc(r.nama)}</td>
      <td class="t-strong">${esc(r.ktpa)}</td>
      <td>${fflKosong(r.nomorPensiun)}</td>
      <td>${fflKosong(r.nik)}</td>
      <td>${esc(p.noPk)}</td>
      <td>${esc(h.tgl)}</td>
      <td>${esc(h.user)}</td>
      <td class="t-strong" title="${esc(h.ket)}">${esc(h.aksi)}</td>
    </tr>`).join("");
  $("#ffr-count").textContent = `${r.riwayat.length} update tercatat.`;
}

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-ffl-detail]");
  if (bDetail) { ffdIsi(fflCari(bDetail.dataset.fflDetail)); go("flagging-flagging-detail"); return; }

  const bLunas = e.target.closest("[data-ffl-lunas]");
  if (bLunas && !bLunas.disabled) { fplIsi(fflCari(bLunas.dataset.fflLunas)); go("flagging-pelunasan"); return; }

  const bBatal = e.target.closest("[data-ffl-batal]");
  if (bBatal && !bBatal.disabled) { fflPembatalan(fflCari(bBatal.dataset.fflBatal)); return; }

  const bRiwayat = e.target.closest("[data-ffl-riwayat]");
  if (bRiwayat) { ffrIsi(fflCari(bRiwayat.dataset.fflRiwayat)); go("flagging-flagging-riwayat"); return; }

  const bHal = e.target.closest("[data-ffl-hal]");
  if (bHal) { fflPager.hal = +bHal.dataset.fflHal; renderFfl(); }
});

renderFfl();
/* ======================================================= FLAGGING » PINJAMAN » TAKE OVER
   Daftar pengalihan pinjaman antar mitra. Dua aksi per baris: Detail (halaman,
   bisa disunting) dan Hapus. Baris baru ditambahkan lewat layar Tambahkan
   Take Over yang mencari pesertanya dulu berdasarkan KPA. */

let ftoPager  = { hal: 1, per: 10 };
let ftoFilter = { cari: "", status: "Semua Status" };
let ftoRows   = DATA_FLAGGING_TAKEOVER.map(r => ({ ...r, pinjaman: { ...r.pinjaman } }));

const ftoKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;

$("#fto-f-status").innerHTML =
  ["Semua Status", ...FTO_STATUS].map(s => `<option>${esc(s)}</option>`).join("");

const ftoPill = s => `<span class="pill ${
  s === "Diterima" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn"}">${esc(s)}</span>`;

function ftoDaftar() {
  const f = ftoFilter;
  return ftoRows.filter(r =>
    (f.status === "Semua Status" || r.status === f.status) &&
    (!f.cari || [r.ktpa, r.nrp, r.nama].some(v => String(v).toLowerCase().includes(f.cari)))
  );
}

function renderFto() {
  const rows = ftoDaftar();
  const pg   = pagerPotong(rows, ftoPager);

  $("#fto-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => `
      <tr>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${esc(r.mitraAwal)}</td>
        <td class="t-strong">${esc(r.mitraPengajuan)}</td>
        <td>${ftoKosong(r.nomorPensiun)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${esc(r.tglLahir)}</td>
        <td>${esc(r.statusPensiun)}</td>
        <td>${ftoKosong(r.tglPelunasan)}</td>
        <td>${ftoKosong(r.toTgl)}</td>
        <td>${ftoKosong(r.toUser)}</td>
        <td>${ftoKosong(r.mtTgl)}</td>
        <td>${ftoKosong(r.mtUser)}</td>
        <td>${ftoKosong(r.asTgl)}</td>
        <td>${ftoKosong(r.asUser)}</td>
        <td>${ftoPill(r.status)}</td>
        <td class="truncate-cell" title="${esc(r.catatan)}">${ftoKosong(r.catatan)}</td>
        <td class="stick-r" style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-fto-detail="${esc(r.ktpa)}">Detail</button>
          <button class="btn btn-danger btn-sm" data-fto-hapus="${esc(r.ktpa)}">Hapus</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="18"><div class="empty">Tidak ada take over yang cocok dengan filter.</div></td></tr>`;

  $("#fto-count").innerHTML = pagerNote(pg, "take over", "");
  $("#fto-pager").innerHTML = rows.length ? pagerHtml(ftoPager, pg, "data-fto-hal") : "";
}

$("#fto-cari").onclick = () => {
  ftoFilter.cari = $("#fto-f-cari").value.trim().toLowerCase();
  ftoFilter.status = $("#fto-f-status").value;
  ftoPager.hal = 1;
  renderFto();
};

const ftoCari = ktpa => ftoRows.find(r => r.ktpa === ktpa);

/* ---- Detail Take Over
   Dibuka dalam keadaan terkunci; tombol Ubah membuka field yang boleh disunting
   lalu perubahannya disubmit sebagai permintaan ke Persetujuan. NOPENS, Nama,
   Tgl Lahir, Mitra Bayar, Cabang, dan NIK tetap terkunci karena ikut data induk. */
let ftdRow = null;

const FTD_EDITABLE = ["ftd-tgl-pelunasan", "ftd-akhir-kredit", "ftd-awal-kredit",
  "ftd-norek-tab", "ftd-norek-kredit", "ftd-no-pk", "ftd-plafon", "ftd-angsuran",
  "ftd-sub-kredit", "ftd-jns-tab", "ftd-sp3r", "ftd-pernyataan"];

function ftdSetUbah(aktif) {
  FTD_EDITABLE.forEach(id => { const el = $(`#${id}`); if (el) el.disabled = !aktif; });
  $("#ftd-actions-lihat").style.display = aktif ? "none" : "";
  $("#ftd-actions-ubah").style.display  = aktif ? "" : "none";
}

function ftdIsi(r) {
  ftdRow = r;
  const p = r.pinjaman;
  $("#ftd-sub").textContent = `${r.ktpa} — ${r.nama}`;

  $("#ftd-kpa").value       = r.ktpa;
  $("#ftd-nrp").value       = r.nrp;
  $("#ftd-nama").value      = r.nama;
  $("#ftd-nopens").value    = r.nomorPensiun;
  $("#ftd-tgl-lahir").value = r.tglLahir;
  $("#ftd-gaji").value      = p.gajiPeserta.toLocaleString("id-ID");

  $("#ftd-tgl-pelunasan").value = p.tglPelunasan;
  $("#ftd-p-tgl-lahir").value   = r.tglLahir;
  $("#ftd-p-nopens").value      = r.nomorPensiun;
  $("#ftd-akhir-kredit").value  = p.akhirKredit;
  $("#ftd-p-nama").value        = r.nama;
  $("#ftd-norek-tab").value     = p.norekTab;
  $("#ftd-awal-kredit").value   = p.awalKredit;
  $("#ftd-no-pk").value         = p.noPk;
  $("#ftd-plafon").value        = p.plafon.toLocaleString("id-ID");
  $("#ftd-cabang").value        = p.cabangMitra;
  $("#ftd-norek-kredit").value  = p.norekKredit;
  $("#ftd-angsuran").value      = p.angsuran.toLocaleString("id-ID");
  $("#ftd-mitra").value         = r.mitraPengajuan;
  $("#ftd-sub-kredit").value    = p.subKredit;
  $("#ftd-jns-tab").value       = p.jnsTab;
  $("#ftd-nik").value           = p.nik;
  $("#ftd-sp3r").value          = "";
  $("#ftd-pernyataan").value    = "";
  $("#ftd-sp3r-nama").textContent       = `Berkas saat ini: ${p.lampiranSp3r}`;
  $("#ftd-pernyataan-nama").textContent = `Berkas saat ini: ${p.lampiranPernyataan}`;

  ftdSetUbah(false);
}

$("#ftd-ubah").onclick  = () => ftdSetUbah(true);
$("#ftd-batal").onclick = () => ftdIsi(ftdRow);   /* buang perubahan yang belum disubmit */

$("#ftd-simpan").onclick = () => {
  if (!$("#ftd-angsuran").value.trim())   { toast("Besaran Angsuran wajib diisi.", "bad"); return; }
  if (!$("#ftd-sub-kredit").value.trim()) { toast("Sub Kredit wajib diisi.", "bad"); return; }

  const p = ftdRow.pinjaman;
  const berkas = id => ($(`#${id}`).files && $(`#${id}`).files[0]);
  const isian = [
    { key:"tglPelunasan", label:"Tgl Pelunasan",             nilai: $("#ftd-tgl-pelunasan").value },
    { key:"awalKredit",   label:"Awal Kredit",               nilai: $("#ftd-awal-kredit").value },
    { key:"akhirKredit",  label:"Tanggal Akhir Kredit",      nilai: $("#ftd-akhir-kredit").value },
    { key:"plafon",       label:"Plafon",                    nilai: fpdAngka($("#ftd-plafon").value), uang:true },
    { key:"angsuran",     label:"Besaran Angsuran",          nilai: fpdAngka($("#ftd-angsuran").value), uang:true },
    { key:"norekTab",     label:"Nomor Rekening Tabungan",   nilai: $("#ftd-norek-tab").value.trim() },
    { key:"norekKredit",  label:"Nomor Rekening Kredit",     nilai: $("#ftd-norek-kredit").value.trim() },
    { key:"noPk",         label:"Nomor Perjanjian Kredit",   nilai: $("#ftd-no-pk").value.trim() },
    { key:"subKredit",    label:"Sub Kredit",                nilai: $("#ftd-sub-kredit").value.trim() },
    { key:"jnsTab",       label:"Jenis Tabungan",            nilai: $("#ftd-jns-tab").value.trim() }
  ];
  if (berkas("ftd-sp3r"))
    isian.push({ key:"lampiranSp3r", label:"Lampiran SP3R", nilai: berkas("ftd-sp3r").name });
  if (berkas("ftd-pernyataan"))
    isian.push({ key:"lampiranPernyataan", label:"Lampiran Surat Pernyataan", nilai: berkas("ftd-pernyataan").name });

  const berubah = isian.filter(f => String(f.nilai) !== String(p[f.key]));
  if (!berubah.length) { toast("Tidak ada perubahan untuk diajukan.", "bad"); return; }

  const tampil = f => f.uang ? rp(f.nilai) : (f.nilai || "–");
  const asal   = f => f.uang ? rp(p[f.key]) : (p[f.key] || "–");
  const masuk = fpsTambah({
    ktpa: ftdRow.ktpa, nrp: ftdRow.nrp, mitra: ftdRow.mitraPengajuan || ftdRow.mitraAwal,
    nopens: ftdRow.nomorPensiun, nama: ftdRow.nama, tglLahir: ftdRow.tglLahir,
    aktivitas: "Perubahan Take Over",
    perubahan: berubah.map(f => ({ label: f.label, dari: asal(f), ke: tampil(f) })),
    nilaiBaru: Object.fromEntries(berubah.map(f => [f.key, f.nilai]))
  }, "Detail Take Over");
  if (!masuk) {
    toast(`${ftdRow.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
    return;
  }

  ftdIsi(ftdRow);          /* kembalikan tampilan ke nilai lama yang masih berlaku */
  go("flagging-pinjaman-takeover");
  toast(`Perubahan take over ${ftdRow.nama} disimpan — menunggu Persetujuan.`, "ok");
};

/* ---- Hapus baris take over */
function ftoHapus(r) {
  $("#modal-title").textContent = "Hapus Take Over";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico bad";
  $("#modal-ico").textContent   = "⊗";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.7;margin-bottom:18px">
      Data take over <b>${esc(r.nama)}</b> akan dihapus dari daftar.
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="fto-hapus-batal">Batal</button>
      <button class="btn btn-danger-solid" id="fto-hapus-ok">Hapus</button>
    </div>`;
  openModal();
  $("#fto-hapus-batal").onclick = closeModal;
  $("#fto-hapus-ok").onclick = () => {
    ftoRows = ftoRows.filter(x => x !== r);
    renderFto();
    closeModal();
    toast(`Take over ${r.nama} dihapus.`);
  };
}

/* ---- Tambahkan Take Over: cari peserta lalu simpan sebagai baris baru. */
let fttPeserta = null;

function fttReset() {
  fttPeserta = null;
  $("#ftt-kpa").value = "";
  $("#ftt-hasil").style.display = "none";
}

$("#ftt-search").onclick = () => {
  const kpa = $("#ftt-kpa").value.trim();
  $("#ftt-hasil").style.display = "none";
  if (!kpa) { toast("Nomor KPA belum diisi.", "bad"); return; }

  /* Peserta dicari di daftar pinjaman yang flagging-nya sudah aktif — hanya
     pinjaman berjalan yang masuk akal untuk dialihkan ke mitra lain. */
  const p = fflRows.find(x => x.ktpa.toLowerCase() === kpa.toLowerCase());
  if (!p) { toast(`Nomor KPA "${kpa}" tidak ditemukan pada daftar flagging.`, "bad"); return; }
  /* Hanya pinjaman yang masih berjalan yang masuk akal dialihkan; yang sudah
     Lunas atau Dibatalkan tidak punya sisa kewajiban untuk di-take over. */
  if (p.statusPinjaman !== "Disetujui") {
    toast(`Pinjaman ${p.nama} berstatus ${p.statusPinjaman} — tidak bisa di-take over.`, "bad");
    return;
  }
  if (ftoRows.some(x => x.ktpa === p.ktpa)) {
    toast(`${p.nama} sudah ada di daftar take over.`, "bad");
    return;
  }

  fttPeserta = p;
  fttIsiForm(p);
  $("#ftt-hasil").style.display = "";
};

/* Mitra pengaju take over diambil dari role yang sedang aktif kalau role itu
   memang salah satu mitra bayar; kalau tidak, dikosongkan supaya tidak
   tertukar dengan mitra lama peserta. */
const fttMitraPengaju = () =>
  DATA_MITRA_BAYAR.includes($("#top-role").value) ? $("#top-role").value : "";

function fttIsiForm(p) {
  const j = p.pinjaman;

  $("#ftt-kpa-r").value     = p.ktpa;
  $("#ftt-nrp").value       = p.nrp;
  $("#ftt-nama").value      = p.nama;
  $("#ftt-nopens").value    = p.nomorPensiun;
  $("#ftt-tgl-lahir").value = p.tglLahir;
  $("#ftt-gaji").value      = j.gajiPeserta.toLocaleString("id-ID");

  $("#ftt-tgl-pelunasan").value = "";
  $("#ftt-p-tgl-lahir").value   = p.tglLahir;
  $("#ftt-p-nopens").value      = p.nomorPensiun;
  $("#ftt-akhir-kredit").value  = j.akhirKredit;
  $("#ftt-p-nama").value        = p.nama;
  $("#ftt-norek-tab").value     = j.norekTab;
  $("#ftt-awal-kredit").value   = j.awalKredit;
  $("#ftt-no-pk").value         = j.noPk;
  $("#ftt-plafon").value        = j.plafon.toLocaleString("id-ID");
  $("#ftt-cabang").value        = j.cabangMitra;
  $("#ftt-norek-kredit").value  = j.norekKredit;
  $("#ftt-angsuran").value      = j.angsuran.toLocaleString("id-ID");
  $("#ftt-sub-kredit").value    = j.subKredit;
  $("#ftt-jns-tab").value       = j.jnsTab;
  $("#ftt-nik").value           = j.nik;
  $("#ftt-sp3r").value          = "";
  $("#ftt-pernyataan").value    = "";

  const mitra = fttMitraPengaju();
  $("#ftt-mitra").value = mitra;
  $("#ftt-mitra-hint").textContent = mitra
    ? "Mitra pengaju take over, mengikuti role aktif."
    : `Pilih role mitra bayar di navbar untuk menetapkan mitra pengaju. Mitra lama: ${p.mitra}.`;
}

/* Take over baru tidak langsung masuk daftar — diajukan dulu ke Persetujuan.
   Barisnya baru dibuat oleh fpsTerapkan() setelah permintaannya disetujui. */
$("#ftt-simpan").onclick = () => {
  if (!fttPeserta) { toast("Cari pesertanya terlebih dahulu.", "bad"); return; }
  const p = fttPeserta;
  const mitra  = $("#ftt-mitra").value.trim();
  const sp3r   = $("#ftt-sp3r").files && $("#ftt-sp3r").files[0];
  const nyata  = $("#ftt-pernyataan").files && $("#ftt-pernyataan").files[0];

  if (!mitra)                             { toast("Mitra pengaju belum ditetapkan — pilih role mitra bayar di navbar.", "bad"); return; }
  if (!$("#ftt-angsuran").value.trim())   { toast("Besaran Angsuran wajib diisi.", "bad"); return; }
  if (!$("#ftt-sub-kredit").value.trim()) { toast("Sub Kredit wajib diisi.", "bad"); return; }
  if (!sp3r)                              { toast("Lampiran SP3R wajib diunggah.", "bad"); return; }
  if (!nyata)                             { toast("Lampiran Surat Pernyataan Kredit Mitra Bayar wajib diunggah.", "bad"); return; }

  const baru = {
    ktpa: p.ktpa, nrp: p.nrp, mitraAwal: p.mitra, mitraPengajuan: mitra,
    nomorPensiun: p.nomorPensiun, nama: p.nama, tglLahir: p.tglLahir,
    statusPensiun: p.nomorPensiun ? "Y" : "T",
    tglPelunasan: $("#ftt-tgl-pelunasan").value,
    toTgl: fpsHariIni(), toUser: "operator.mitra",
    status: "Tertunda", mtTgl: "", mtUser: "", asTgl: "", asUser: "", catatan: "",
    pinjaman: {
      ...p.pinjaman,
      tglPelunasan: $("#ftt-tgl-pelunasan").value,
      awalKredit:   $("#ftt-awal-kredit").value,
      akhirKredit:  $("#ftt-akhir-kredit").value,
      plafon:       fpdAngka($("#ftt-plafon").value),
      angsuran:     fpdAngka($("#ftt-angsuran").value),
      norekTab:     $("#ftt-norek-tab").value.trim(),
      norekKredit:  $("#ftt-norek-kredit").value.trim(),
      noPk:         $("#ftt-no-pk").value.trim(),
      subKredit:    $("#ftt-sub-kredit").value.trim(),
      jnsTab:       $("#ftt-jns-tab").value.trim(),
      lampiranSp3r: sp3r.name, lampiranPernyataan: nyata.name
    }
  };

  const masuk = fpsTambah({
    ktpa: p.ktpa, nrp: p.nrp, mitra, nopens: p.nomorPensiun,
    nama: p.nama, tglLahir: p.tglLahir, aktivitas: "Pengajuan Take Over",
    mitraAwal: p.mitra,
    perubahan: [
      { label:"Mitra Awal",        dari:"–", ke: p.mitra },
      { label:"Mitra Take Over",   dari:"–", ke: mitra },
      { label:"Plafon",            dari:"–", ke: rp(baru.pinjaman.plafon) },
      { label:"Besaran Angsuran",  dari:"–", ke: rp(baru.pinjaman.angsuran) },
      { label:"Lampiran SP3R",     dari:"–", ke: sp3r.name },
      { label:"Lampiran Pernyataan", dari:"–", ke: nyata.name }
    ],
    takeoverBaru: baru
  }, "Tambahkan Take Over");
  if (!masuk) {
    toast(`${p.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
    return;
  }

  go("flagging-pinjaman-takeover");
  toast(`Pengajuan take over ${p.nama} disubmit — menunggu Persetujuan.`, "ok");
};

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-fto-detail]");
  if (bDetail) { ftdIsi(ftoCari(bDetail.dataset.ftoDetail)); go("flagging-takeover-detail"); return; }

  const bHapus = e.target.closest("[data-fto-hapus]");
  if (bHapus) { ftoHapus(ftoCari(bHapus.dataset.ftoHapus)); return; }

  const bHal = e.target.closest("[data-fto-hal]");
  if (bHal) { ftoPager.hal = +bHal.dataset.ftoHal; renderFto(); }
});

renderFto();

/* ========================================================== FLAGGING » PINJAMAN » TOP UP
   Daftar penambahan plafon pada pinjaman yang flagging-nya masih berjalan.
   Dua aksi per baris: Detail (halaman baca-saja) dan Hapus. Baris baru
   ditambahkan lewat layar Tambahkan Top Up yang mencari pesertanya dulu
   berdasarkan KPA, lalu diajukan ke Persetujuan seperti take over. */

let ftuPager  = { hal: 1, per: 10 };
let ftuFilter = { cari: "", status: "Semua Status" };
let ftuSeq    = 0;
let ftuRows   = DATA_FLAGGING_TOPUP.map(r => ({ ...r, id: "tu" + (++ftuSeq), pinjaman: { ...r.pinjaman } }));

const ftuKosong = v => (v || v === 0) ? esc(String(v)) : `<span style="color:var(--faint)">–</span>`;
const ftuPill   = s => `<span class="pill ${
  s === "Diterima" ? "pill-ok" : s === "Ditolak" ? "pill-bad" : "pill-warn"}">${esc(s)}</span>`;

$("#ftu-f-status").innerHTML =
  ["Semua Status", ...FTU_STATUS].map(s => `<option>${esc(s)}</option>`).join("");

/* Top up bisa berulang untuk peserta yang sama, jadi urutannya dihitung dari
   jumlah top up yang sudah tercatat pada KPA tersebut. */
const ftuBerikutnya = ktpa => ftuRows.filter(r => r.ktpa === ktpa).length + 1;

function ftuDaftar() {
  const f = ftuFilter;
  return ftuRows.filter(r =>
    (f.status === "Semua Status" || r.status === f.status) &&
    (!f.cari || [r.ktpa, r.nrp, r.nik, r.nama].some(v => String(v).toLowerCase().includes(f.cari)))
  );
}

function renderFtu() {
  const rows = ftuDaftar();
  const pg   = pagerPotong(rows, ftuPager);

  $("#ftu-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => {
      const p = r.pinjaman;
      return `
      <tr>
        <td class="t-strong">${ftuKosong(r.ind)}</td>
        <td>${esc(r.mitra)}</td>
        <td class="t-strong">${esc(r.ktpa)}</td>
        <td>${esc(r.nrp)}</td>
        <td>${ftuKosong(r.nik)}</td>
        <td>${ftuKosong(r.nomorPensiun)}</td>
        <td class="t-strong">${esc(r.nama)}</td>
        <td>${ftuKosong(r.tglLahir)}</td>
        <td class="num">${ftuKosong(r.topUpKe)}</td>
        <td>${esc(p.tglPermohonan)}</td>
        <td>${esc(p.awalKredit)}</td>
        <td>${esc(p.akhirKredit)}</td>
        <td class="num">${p.plafon.toLocaleString("id-ID")}</td>
        <td>${esc(p.norekTab)}</td>
        <td>${esc(p.norekKredit)}</td>
        <td>${esc(p.noPk)}</td>
        <td>${ftuPill(r.status)}</td>
        <td>${ftuKosong(r.kategori)}</td>
        <td>${ftuKosong(r.tglSetuju)}</td>
        <td>${ftuKosong(r.pengguna)}</td>
        <td class="stick-r" style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-ftu-detail="${esc(r.id)}">Detail</button>
          <button class="btn btn-danger btn-sm" data-ftu-hapus="${esc(r.id)}">Hapus</button>
        </td>
      </tr>`; }).join("")
    : `<tr><td colspan="21"><div class="empty">Tidak ada top up yang cocok dengan filter.</div></td></tr>`;

  $("#ftu-count").innerHTML = pagerNote(pg, "top up", "");
  $("#ftu-pager").innerHTML = rows.length ? pagerHtml(ftuPager, pg, "data-ftu-hal") : "";
}

$("#ftu-cari").onclick = () => {
  ftuFilter.cari = $("#ftu-f-cari").value.trim().toLowerCase();
  ftuFilter.status = $("#ftu-f-status").value;
  ftuPager.hal = 1;
  renderFtu();
};

/* Satu peserta boleh punya lebih dari satu baris top up, jadi barisnya
   dialamatkan lewat id internal, bukan KPA. */
const ftuCari = id => ftuRows.find(r => r.id === id);

/* ---- Detail Top Up: halaman baca-saja, susunannya mengikuti layar Tambahkan. */
function ftudField(label, nilai) {
  return `<div class="field">
    <label class="fl">${esc(label)}</label>
    <input class="inp" value="${esc(nilai || nilai === 0 ? String(nilai) : "–")}" disabled>
  </div>`;
}

function ftudIsi(r) {
  const p = r.pinjaman;
  $("#ftud-sub").textContent = `${r.ktpa} — ${r.nama} · Top up ke-${r.topUpKe}`;

  $("#ftud-peserta").innerHTML = [
    ftudField("KPA",           r.ktpa),
    ftudField("NRP/NIP",       r.nrp),
    ftudField("Nama",          r.nama),
    ftudField("NOPENS",        r.nomorPensiun),
    ftudField("Tanggal Lahir", r.tglLahir),
    ftudField("Gaji Peserta",  rp(p.gajiPeserta))
  ].join("");

  $("#ftud-topup").innerHTML = [
    ftudField("Tgl Permohonan",          p.tglPermohonan),
    ftudField("NOPENS",                  r.nomorPensiun),
    ftudField("Nama",                    r.nama),
    ftudField("Awal Kredit",             p.awalKredit),
    ftudField("Plafon",                  rp(p.plafon)),
    ftudField("Nomor Rekening Kredit",   p.norekKredit),
    ftudField("Mitra Bayar",             r.mitra),
    ftudField("Jenis Tabungan",          p.jnsTab),
    ftudField("NIK",                     p.nik || r.nik),
    ftudField("Tgl Lahir",               r.tglLahir),
    ftudField("Tanggal Akhir Kredit",    p.akhirKredit),
    ftudField("Nomor Rekening Tabungan", p.norekTab),
    ftudField("Nomor Perjanjian Kredit", p.noPk),
    ftudField("Cabang Mitra Bayar",      p.cabangMitra),
    ftudField("Top Up Ke",               r.topUpKe),
    ftudField("Besaran Angsuran",        rp(p.angsuran)),
    ftudField("Sub Kredit",              p.subKredit),
    ftudField("Lampiran SP3R",           p.lampiranSp3r),
    ftudField("Lampiran Surat Pernyataan Kredit Mitra Bayar", p.lampiranPernyataan)
  ].join("");
}

function ftuHapus(r) {
  $("#modal-title").textContent = "Hapus Top Up";
  $("#modal-sub").textContent   = `${r.ktpa} — ${r.nama}`;
  $("#modal-ico").style.display = "";
  $("#modal-ico").className     = "modal-ico bad";
  $("#modal-ico").textContent   = "⊗";
  $("#modal-body").innerHTML = `
    <div style="font-size:13px;color:var(--body);line-height:1.7;margin-bottom:18px">
      Top up ke-${esc(String(r.topUpKe))} milik <b>${esc(r.nama)}</b> akan dihapus dari daftar.
    </div>
    <div class="form-actions" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="ftu-hapus-batal">Batal</button>
      <button class="btn btn-danger-solid" id="ftu-hapus-ok">Hapus</button>
    </div>`;
  openModal();
  $("#ftu-hapus-batal").onclick = closeModal;
  $("#ftu-hapus-ok").onclick = () => {
    ftuRows = ftuRows.filter(x => x !== r);
    renderFtu();
    closeModal();
    toast(`Top up ${r.nama} dihapus.`);
  };
}

/* ---- Tambahkan Top Up: cari peserta lalu ajukan sebagai permintaan baru. */
let ftutPeserta = null;

function ftutReset() {
  ftutPeserta = null;
  $("#ftut-kpa").value = "";
  $("#ftut-hasil").style.display = "none";
}

$("#ftut-search").onclick = () => {
  const kpa = $("#ftut-kpa").value.trim();
  $("#ftut-hasil").style.display = "none";
  if (!kpa) { toast("Nomor KPA belum diisi.", "bad"); return; }

  /* Top up hanya masuk akal untuk pinjaman yang flagging-nya masih berjalan —
     yang sudah Lunas atau Dibatalkan tidak punya plafon untuk ditambah. */
  const p = fflRows.find(x => x.ktpa.toLowerCase() === kpa.toLowerCase());
  if (!p) { toast(`Nomor KPA "${kpa}" tidak ditemukan pada daftar flagging.`, "bad"); return; }
  if (p.statusPinjaman !== "Disetujui") {
    toast(`Pinjaman ${p.nama} berstatus ${p.statusPinjaman} — tidak bisa di-top up.`, "bad");
    return;
  }

  ftutPeserta = p;
  ftutIsiForm(p);
  $("#ftut-hasil").style.display = "";
};

function ftutIsiForm(p) {
  const j  = p.pinjaman;
  const ke = ftuBerikutnya(p.ktpa);

  $("#ftut-kpa-r").value     = p.ktpa;
  $("#ftut-nrp").value       = p.nrp;
  $("#ftut-nama").value      = p.nama;
  $("#ftut-nopens").value    = p.nomorPensiun;
  $("#ftut-tgl-lahir").value = p.tglLahir;
  $("#ftut-gaji").value      = j.gajiPeserta.toLocaleString("id-ID");

  $("#ftut-tgl-permohonan").value = "";
  $("#ftut-p-nopens").value       = p.nomorPensiun;
  $("#ftut-p-nama").value         = p.nama;
  $("#ftut-awal-kredit").value    = j.awalKredit;
  $("#ftut-plafon").value         = j.plafon.toLocaleString("id-ID");
  $("#ftut-norek-kredit").value   = j.norekKredit;
  $("#ftut-mitra").value          = p.mitra;
  $("#ftut-jns-tab").value        = j.jnsTab;
  $("#ftut-nik").value            = j.nik || p.nik;
  $("#ftut-p-tgl-lahir").value    = p.tglLahir;
  $("#ftut-akhir-kredit").value   = j.akhirKredit;
  $("#ftut-norek-tab").value      = j.norekTab;
  $("#ftut-no-pk").value          = j.noPk;
  $("#ftut-cabang").value         = j.cabangMitra;
  $("#ftut-topup-ke").value       = ke;
  $("#ftut-angsuran").value       = j.angsuran.toLocaleString("id-ID");
  $("#ftut-sub-kredit").value     = j.subKredit;
  $("#ftut-sp3r").value           = "";
  $("#ftut-pernyataan").value     = "";

  $("#ftut-topup-ke-hint").textContent = ke > 1
    ? `Peserta sudah punya ${ke - 1} top up sebelumnya.`
    : "Top up pertama untuk peserta ini.";
}

/* Top up baru tidak langsung masuk daftar — diajukan dulu ke Persetujuan.
   Barisnya baru dibuat oleh fpsTerapkan() setelah permintaannya disetujui. */
$("#ftut-simpan").onclick = () => {
  if (!ftutPeserta) { toast("Cari pesertanya terlebih dahulu.", "bad"); return; }
  const p     = ftutPeserta;
  const sp3r  = $("#ftut-sp3r").files && $("#ftut-sp3r").files[0];
  const nyata = $("#ftut-pernyataan").files && $("#ftut-pernyataan").files[0];

  if (!$("#ftut-nik").value.trim())        { toast("NIK wajib diisi.", "bad"); return; }
  if (!$("#ftut-angsuran").value.trim())   { toast("Besaran Angsuran wajib diisi.", "bad"); return; }
  if (!$("#ftut-sub-kredit").value.trim()) { toast("Sub Kredit wajib diisi.", "bad"); return; }
  if (!sp3r)                               { toast("Lampiran SP3R wajib diunggah.", "bad"); return; }
  if (!nyata)                              { toast("Lampiran Surat Pernyataan Kredit Mitra Bayar wajib diunggah.", "bad"); return; }

  const nik    = $("#ftut-nik").value.trim();
  const plafon = fpdAngka($("#ftut-plafon").value);
  const noPk   = $("#ftut-no-pk").value.trim();

  const baru = {
    ind: p.ind, mitra: p.mitra, ktpa: p.ktpa, nrp: p.nrp, nik,
    nomorPensiun: p.nomorPensiun, nama: $("#ftut-p-nama").value.trim() || p.nama,
    tglLahir: $("#ftut-p-tgl-lahir").value, topUpKe: ftuBerikutnya(p.ktpa),
    statusPinjaman: "Disetujui", statusTagih: "N", kategori: "", status: "Tertunda",
    tglSetuju: "", pengguna: "",
    pinjaman: {
      ...p.pinjaman, nik,
      tglPermohonan: $("#ftut-tgl-permohonan").value,
      awalKredit:    $("#ftut-awal-kredit").value,
      akhirKredit:   $("#ftut-akhir-kredit").value,
      plafon,
      angsuran:      fpdAngka($("#ftut-angsuran").value),
      norekTab:      $("#ftut-norek-tab").value.trim(),
      norekKredit:   $("#ftut-norek-kredit").value.trim(),
      noPk,
      subKredit:     $("#ftut-sub-kredit").value.trim(),
      jnsTab:        $("#ftut-jns-tab").value.trim(),
      lampiranSp3r:  sp3r.name, lampiranPernyataan: nyata.name
    }
  };

  const masuk = fpsTambah({
    ktpa: p.ktpa, nrp: p.nrp, mitra: p.mitra, nopens: p.nomorPensiun,
    nama: p.nama, tglLahir: p.tglLahir, aktivitas: "Pengajuan Top Up",
    perubahan: [
      { label:"Top Up Ke",          dari:"–", ke: String(baru.topUpKe) },
      { label:"Plafon",             dari: rp(p.pinjaman.plafon), ke: rp(plafon) },
      { label:"Besaran Angsuran",   dari: rp(p.pinjaman.angsuran), ke: rp(baru.pinjaman.angsuran) },
      { label:"Tanggal Akhir Kredit", dari: p.pinjaman.akhirKredit, ke: baru.pinjaman.akhirKredit },
      { label:"Lampiran SP3R",      dari:"–", ke: sp3r.name },
      { label:"Lampiran Pernyataan", dari:"–", ke: nyata.name }
    ],
    topupBaru: baru
  }, "Tambahkan Top Up");
  if (!masuk) {
    toast(`${p.nama} sudah punya permintaan yang menunggu persetujuan.`, "bad");
    return;
  }

  go("flagging-pinjaman-topup");
  toast(`Pengajuan top up ${p.nama} disubmit — menunggu Persetujuan.`, "ok");
};

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-ftu-detail]");
  if (bDetail) { ftudIsi(ftuCari(bDetail.dataset.ftuDetail)); go("flagging-topup-detail"); return; }

  const bHapus = e.target.closest("[data-ftu-hapus]");
  if (bHapus) { ftuHapus(ftuCari(bHapus.dataset.ftuHapus)); return; }

  const bHal = e.target.closest("[data-ftu-hal]");
  if (bHal) { ftuPager.hal = +bHal.dataset.ftuHal; renderFtu(); }
});

renderFtu();

/* ======================================================= FLAGGING » PINJAMAN » PENAGIHAN
   Dua tab dari satu sumber data yang sama: tab Mitra menampilkan batch
   penagihan per mitra bayar, tab Peserta meratakan seluruh `peserta` dari
   semua batch menjadi satu daftar. Batch baru dibuat lewat layar Tambah
   Penagihan Pinjaman — tombol Cari Data mengumpulkan peserta yang cocok
   dengan kriterianya lebih dulu, baru disimpan. */

let fpnPager  = { hal: 1, per: 10 };
let fpnFilter = { mitra: "", status: "Semua Status" };
let fpnSeq    = 0;
let fpnRows   = DATA_FLAGGING_PENAGIHAN.map(r => ({
  ...r, id: "pn" + (++fpnSeq), peserta: r.peserta.map(p => ({ ...p }))
}));

const fpnKosong = v => v ? esc(v) : `<span style="color:var(--faint)">–</span>`;

["#fpn-f-status", "#fpp-f-status"].forEach(sel => {
  $(sel).innerHTML = ["Semua Status", ...FPN_STATUS_PESERTA]
    .map(s => `<option>${esc(s)}</option>`).join("");
});
$("#fpt-status").innerHTML = FPN_STATUS_PESERTA.map(s => `<option>${esc(s)}</option>`).join("");

/* ---- tab Mitra / Peserta */
function fpnGotoTab(tab) {
  $$("[data-fpn-tab]").forEach(b => b.classList.toggle("active", b.dataset.fpnTab === tab));
  $("#fpn-panel-mitra").style.display   = tab === "mitra"   ? "" : "none";
  $("#fpn-panel-peserta").style.display = tab === "peserta" ? "" : "none";
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fpn-tab]");
  if (b) fpnGotoTab(b.dataset.fpnTab);
});

/* ---- tab Mitra */
function fpnDaftar() {
  const f = fpnFilter;
  return fpnRows.filter(r =>
    (f.status === "Semua Status" || r.statusPeserta === f.status) &&
    (!f.mitra || r.mitra.toLowerCase().includes(f.mitra))
  );
}

function renderFpn() {
  const rows = fpnDaftar();
  const pg   = pagerPotong(rows, fpnPager);

  $("#fpn-body").innerHTML = pg.hal.length
    ? pg.hal.map(r => `
      <tr>
        <td class="t-strong">${esc(r.mitra)}</td>
        <td>${esc(r.statusPeserta)}</td>
        <td>${esc(r.tglTagihan)}</td>
        <td>${esc(r.tglAwal)}</td>
        <td>${esc(r.tglAkhir)}</td>
        <td class="truncate-cell" title="${esc(r.catatan)}">${fpnKosong(r.catatan)}</td>
        <td>${esc(r.user)}</td>
        <td>${esc(r.tglBuat)}</td>
        <td class="stick-r" style="white-space:nowrap">
          <button class="btn btn-info btn-sm" data-fpn-detail="${esc(r.id)}">Detail</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="9"><div class="empty">Tidak ada penagihan yang cocok dengan filter.</div></td></tr>`;

  $("#fpn-count").innerHTML = pagerNote(pg, "penagihan", "");
  $("#fpn-pager").innerHTML = rows.length ? pagerHtml(fpnPager, pg, "data-fpn-hal") : "";
}

$("#fpn-cari").onclick = () => {
  fpnFilter.mitra  = $("#fpn-f-mitra").value.trim().toLowerCase();
  fpnFilter.status = $("#fpn-f-status").value;
  fpnPager.hal = 1;
  renderFpn();
};

const fpnCari = id => fpnRows.find(r => r.id === id);

/* ---- tab Peserta: seluruh peserta dari semua batch, dengan asal mitra dan
   tanggal tagihannya ikut dibawa supaya barisnya berdiri sendiri. */
let fppPager  = { hal: 1, per: 10 };
let fppFilter = { cari: "", status: "Semua Status" };

const fppPill = s => `<span class="pill ${
  s === "Terbayar" ? "pill-ok" : s === "Gagal" ? "pill-bad" : "pill-warn"}">${esc(s)}</span>`;

function fppDaftar() {
  const f = fppFilter;
  const semua = [];
  fpnRows.forEach(b => b.peserta.forEach(p =>
    semua.push({ ...p, mitra: b.mitra, tglTagihan: b.tglTagihan })));
  return semua.filter(p =>
    (f.status === "Semua Status" || p.statusPeserta === f.status) &&
    (!f.cari || [p.ktpa, p.nrp, p.nama].some(v => String(v).toLowerCase().includes(f.cari)))
  );
}

function renderFpp() {
  const rows = fppDaftar();
  const pg   = pagerPotong(rows, fppPager);

  $("#fpp-body").innerHTML = pg.hal.length
    ? pg.hal.map(p => `
      <tr>
        <td class="t-strong">${esc(p.ktpa)}</td>
        <td>${esc(p.nrp)}</td>
        <td>${fpnKosong(p.nomorPensiun)}</td>
        <td class="t-strong">${esc(p.nama)}</td>
        <td>${fpnKosong(p.tglLahir)}</td>
        <td>${p.statusPeserta === "Pensiun" ? "Y" : "T"}</td>
        <td>${esc(p.awalKredit)}</td>
        <td>${esc(p.akhirKredit)}</td>
        <td class="num">${p.plafon.toLocaleString("id-ID")}</td>
        <td>${fppPill(p.statusTagih)}</td>
        <td>${esc(p.statusUser)}</td>
        <td>${esc(p.statusTgl)}</td>
      </tr>`).join("")
    : `<tr><td colspan="12"><div class="empty">Tidak ada peserta yang cocok dengan filter.</div></td></tr>`;

  $("#fpp-count").innerHTML = pagerNote(pg, "peserta", "");
  $("#fpp-pager").innerHTML = rows.length ? pagerHtml(fppPager, pg, "data-fpp-hal") : "";
}

$("#fpp-cari").onclick = () => {
  fppFilter.cari   = $("#fpp-f-cari").value.trim().toLowerCase();
  fppFilter.status = $("#fpp-f-status").value;
  fppPager.hal = 1;
  renderFpp();
};

/* ---- Detail Penagihan: halaman baca-saja berisi kriteria batch dan
   daftar peserta yang ikut tertagih di dalamnya. */
function fpd2Field(label, nilai) {
  return `<div class="field">
    <label class="fl">${esc(label)}</label>
    <input class="inp" value="${esc(nilai || "–")}" disabled>
  </div>`;
}

/* Susunannya sama untuk hasil Cari Data dan Detail Penagihan: Info Peserta,
   Info Peminjam, penanda pensiun, lalu Info Kredit. */
function fpnBarisPeserta(daftar) {
  return daftar.length
    ? daftar.map(p => `
      <tr>
        <td class="t-strong">${esc(p.ktpa)}</td>
        <td>${esc(p.nrp)}</td>
        <td>${fpnKosong(p.nomorPensiun)}</td>
        <td class="t-strong">${esc(p.nama)}</td>
        <td>${fpnKosong(p.tglLahir)}</td>
        <td>${fpnKosong(p.pnNopens)}</td>
        <td>${esc(p.pnNama)}</td>
        <td>${p.statusPeserta === "Pensiun" ? "Y" : "T"}</td>
        <td>${esc(p.awalKredit)}</td>
        <td>${esc(p.akhirKredit)}</td>
        <td class="num">${p.plafon.toLocaleString("id-ID")}</td>
      </tr>`).join("")
    : `<tr><td colspan="11"><div class="empty">Tidak ada peserta pada penagihan ini.</div></td></tr>`;
}

const fpnTotal = daftar => daftar.reduce((a, p) => a + p.angsuran, 0);

function fpd2Isi(r) {
  $("#fpd2-sub").textContent = `${r.mitra} · Tagihan ${r.tglTagihan}`;
  $("#fpd2-info").innerHTML = [
    fpd2Field("Mitra Bayar",     r.mitra),
    fpd2Field("Status Peserta",  r.statusPeserta),
    fpd2Field("Tanggal Tagihan", r.tglTagihan),
    fpd2Field("Tanggal Awal",    r.tglAwal),
    fpd2Field("Tanggal Akhir",   r.tglAkhir),
    fpd2Field("Dibuat Oleh",     `${r.user} · ${r.tglBuat}`),
    fpd2Field("Catatan",         r.catatan),
    fpd2Field("Keterangan",      r.keterangan)
  ].join("");
  $("#fpd2-body").innerHTML = fpnBarisPeserta(r.peserta);
  $("#fpd2-note").textContent =
    `${r.peserta.length} peserta · total angsuran ${rp(fpnTotal(r.peserta))}`;
}

/* ---- Tambah Penagihan Pinjaman */
bindMitraAutocomplete("fpt-mitra", "fpt-mitra-list");

let fptHasil = [];

function fptReset() {
  fptHasil = [];
  $("#fpt-mitra").value      = "";
  $("#fpt-status").value     = FPN_STATUS_PESERTA[0];
  $("#fpt-tgl-awal").value   = "";
  $("#fpt-tgl-akhir").value  = "";
  $("#fpt-catatan").value    = "";
  $("#fpt-keterangan").value = "";
  $("#fpt-hasil").style.display = "none";
}

/* Peserta yang ditagih diambil dari pinjaman yang flagging-nya masih berjalan
   di mitra tersebut — hanya pinjaman aktif yang punya angsuran untuk ditagih.
   Status Aktif/Pensiun dibedakan dari ada tidaknya nomor pensiun. */
$("#fpt-cari-data").onclick = () => {
  const mitra  = $("#fpt-mitra").value.trim();
  const status = $("#fpt-status").value;
  const awal   = $("#fpt-tgl-awal").value;
  const akhir  = $("#fpt-tgl-akhir").value;

  $("#fpt-hasil").style.display = "none";
  if (!mitra)          { toast("Mitra Bayar belum dipilih.", "bad"); return; }
  if (!awal || !akhir) { toast("Tanggal awal dan akhir wajib diisi.", "bad"); return; }
  if (awal > akhir)    { toast("Tanggal awal melewati tanggal akhir.", "bad"); return; }

  fptHasil = fflRows
    .filter(r => r.statusPinjaman === "Disetujui" &&
                 r.mitra.toLowerCase() === mitra.toLowerCase())
    .map(r => ({
      ktpa: r.ktpa, nrp: r.nrp, nomorPensiun: r.nomorPensiun, nama: r.nama,
      tglLahir: r.tglLahir,
      statusPeserta: r.nomorPensiun ? "Pensiun" : "Aktif",
      /* Peserta yang meminjam untuk dirinya sendiri — Info Peminjam sama
         dengan Info Peserta. Yang berbeda hanya kasus pensiun waris. */
      pnNopens: r.nomorPensiun, pnNama: r.nama,
      awalKredit: r.pinjaman.awalKredit, akhirKredit: r.pinjaman.akhirKredit,
      plafon: r.pinjaman.plafon, angsuran: r.pinjaman.angsuran
    }))
    .filter(p => p.statusPeserta === status);

  $("#fpt-hasil-body").innerHTML = fpnBarisPeserta(fptHasil);
  $("#fpt-hasil-note").textContent = fptHasil.length
    ? `${fptHasil.length} peserta ditemukan · total angsuran ${rp(fpnTotal(fptHasil))}`
    : `Tidak ada peserta ${status.toLowerCase()} dengan flagging berjalan di ${mitra}.`;
  $("#fpt-hasil").style.display = "";
};

$("#fpt-simpan").onclick = () => {
  if (!fptHasil.length) { toast("Belum ada peserta untuk ditagih.", "bad"); return; }

  fpnRows.unshift({
    id: "pn" + (++fpnSeq),
    mitra: $("#fpt-mitra").value.trim(),
    statusPeserta: $("#fpt-status").value,
    tglTagihan: fpsHariIni(),
    tglAwal: $("#fpt-tgl-awal").value,
    tglAkhir: $("#fpt-tgl-akhir").value,
    catatan: $("#fpt-catatan").value.trim(),
    keterangan: $("#fpt-keterangan").value.trim(),
    user: "operator.kep", tglBuat: `${fpsHariIni()} 00:00:00`,
    /* Batch baru berarti tagihannya baru diterbitkan — statusnya "Ditagih"
       sampai pembayarannya dikonfirmasi. */
    peserta: fptHasil.map(p => ({ ...p,
      statusTagih: "Ditagih", statusUser: "operator.kep", statusTgl: fpsHariIni() }))
  });

  const jumlah = fptHasil.length;
  const mitra  = $("#fpt-mitra").value.trim();
  fpnPager.hal = 1;
  fppPager.hal = 1;
  renderFpn();
  renderFpp();
  go("flagging-pinjaman-penagihan");
  fpnGotoTab("mitra");
  toast(`Penagihan ${mitra} dibuat untuk ${jumlah} peserta.`, "ok");
};

document.addEventListener("click", e => {
  const bDetail = e.target.closest("[data-fpn-detail]");
  if (bDetail) { fpd2Isi(fpnCari(bDetail.dataset.fpnDetail)); go("flagging-penagihan-detail"); return; }

  const bHal = e.target.closest("[data-fpn-hal]");
  if (bHal) { fpnPager.hal = +bHal.dataset.fpnHal; renderFpn(); return; }

  const bHalP = e.target.closest("[data-fpp-hal]");
  if (bHalP) { fppPager.hal = +bHalP.dataset.fppHal; renderFpp(); }
});

renderFpn();
renderFpp();

/* ============================================== NOTIFIKASI DI NAVBAR (LONCENG)
   Isinya dirakit dari antrean yang sedang berjalan, bukan daftar statis — jadi
   angkanya ikut berkurang begitu sebuah permintaan disetujui atau ditolak. */

/* Sengaja `var`: dideklarasikan di bawah tapi sudah ada (bernilai undefined)
   sejak skrip mulai jalan, sehingga render tabel yang berjalan lebih dulu saat
   memuat halaman tidak menyentuh antrean yang belum sempat dibuat. */
var topNotifSiap = false;

/* Nama mitra di data lama ditulis kapital ("BANK BRI") sedangkan pilihan role
   memakai Title Case ("Bank BRI") — dibandingkan tanpa memedulikan huruf. */
const samaMitra = (a, b) =>
  !!a && !!b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

/* Notifikasi antar mitra pada alur take over: pengajuan memberi tahu mitra
   pemberi kredit lama, keputusannya memberi tahu mitra pengaju. */
function topNotifTakeOver(role) {
  const t = [];
  fpsRows.filter(r => r.aktivitas === "Pengajuan Take Over").forEach(r => {
    const tgl = r.tglProses || r.riwayat[0].tgl;
    if (r.status === "Pending" && samaMitra(r.mitraAwal, role)) t.push({
      judul: `Pengajuan Take Over dari ${r.mitra}`,
      meta1: `${r.ktpa} · ${r.nama}`,
      meta2: `Menunggu tanggapan Anda · ${tgl}`,
      tingkat: "KRITIS", go: "flagging-persetujuan"
    });
    if (r.status !== "Pending" && samaMitra(r.mitra, role)) t.push({
      judul: `${r.status === "Disetujui" ? "Persetujuan" : "Penolakan"} Take Over dari ${r.mitraAwal}`,
      meta1: `${r.ktpa} · ${r.nama}`,
      meta2: `Pengajuan take over Anda · ${tgl}`,
      tingkat: r.status === "Disetujui" ? "HIGH" : "KRITIS",
      go: "flagging-pinjaman-takeover"
    });
  });
  return t;
}

function topNotifTugas() {
  const role  = $("#top-role").value;
  const tugas = topNotifTakeOver(role);
  /* Antrean persetujuan adalah pekerjaan Divisi Kepesertaan, bukan mitra —
     kalau ikut ditampilkan ke mitra, pengajuan take over yang sama muncul dua
     kali di lonceng yang sama. */
  const mitra = DATA_MITRA_BAYAR.includes(role);

  /* Permohonan pinjaman baru lebih mendesak daripada permintaan susulan atas
     pinjaman yang sudah berjalan, jadi tingkatnya dibedakan. */
  if (!mitra) fpsRows.filter(r => r.status === "Pending").forEach(r => tugas.push({
    judul: `Persetujuan ${r.aktivitas}`,
    meta1: `${r.ktpa} · ${r.mitra}`,
    meta2: `Persetujuan · ${r.riwayat[0].tgl}`,
    tingkat: r.aktivitas === "Pengajuan Pinjaman" ? "KRITIS" : "HIGH",
    go: "flagging-persetujuan"
  }));

  /* Peserta yang belum dibooking masih menunggu tindakan operator mitra. */
  const belum = fcbkPesertaRows.filter(r => !r.booking).length;
  if (belum) tugas.push({
    judul: "Peserta Belum Dibooking",
    meta1: `${belum} peserta pada batch kolektif`,
    meta2: "Check dan Booking » Kolektif",
    tingkat: "HIGH",
    go: "flagging-cb-kolektif"
  });

  return tugas;
}

const topNotifPill = t => t === "KRITIS" ? "pill-bad" : "pill-warn";

function renderTopNotif() {
  if (!topNotifSiap) return;
  const tugas = topNotifTugas();
  const badge = $("#top-bell-count");
  badge.textContent = tugas.length;
  badge.hidden      = tugas.length === 0;
  $("#top-notif-count").textContent = `${tugas.length} TUGAS`;

  $("#top-notif-list").innerHTML = tugas.length
    ? tugas.map(t => `
      <button class="notif-item" data-go="${esc(t.go)}">
        <div class="notif-item-top">
          <div class="notif-item-judul">${esc(t.judul)}</div>
          <span class="pill ${topNotifPill(t.tingkat)}">${esc(t.tingkat)}</span>
        </div>
        <div class="notif-item-meta">${esc(t.meta1)}</div>
        <div class="notif-item-meta">${esc(t.meta2)}</div>
      </button>`).join("")
    : `<div class="empty" style="padding:28px 20px">Tidak ada tugas yang menunggu.</div>`;
}

function topNotifTutup() {
  $("#top-notif").hidden = true;
  $("#top-bell").setAttribute("aria-expanded", "false");
  $("#top-bell").classList.remove("open");
}

$("#top-bell").onclick = e => {
  e.stopPropagation();
  const buka = $("#top-notif").hidden;
  if (buka) renderTopNotif();
  $("#top-notif").hidden = !buka;
  $("#top-bell").setAttribute("aria-expanded", String(buka));
  $("#top-bell").classList.toggle("open", buka);
};
$("#top-notif-all").onclick = () => { topNotifTutup(); go("flagging-persetujuan"); };
/* Klik di luar popover — termasuk klik pada salah satu notifikasinya, yang
   navigasinya sudah ditangani handler [data-go] di router. */
document.addEventListener("click", e => {
  if (!e.target.closest(".notif-wrap")) topNotifTutup();
  else if (e.target.closest(".notif-item")) topNotifTutup();
});

topNotifSiap = true;
renderTopNotif();

/* ====================================================================== INIT */
/* Role mitra bayar langsung diberi tahu pengajuan flagging miliknya yang
   ditolak — daftarnya diambil dari antrean Persetujuan. */
$("#top-role").onchange = () => {
  const role = $("#top-role").value;
  toast(`Role diubah ke: ${role}.`);
  fpsRows.filter(r => r.mitra === role && r.status === "Ditolak")
         .forEach(r => toast(`Pengajuan Flagging KPA ${r.ktpa} ditolak.`, "bad"));
  /* Isi lonceng berbeda per role, jadi ikut disegarkan saat role berganti. */
  renderTopNotif();
};
go("flagging-dashboard");
