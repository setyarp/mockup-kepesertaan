# Panduan Pengembangan — Prototipe Kepesertaan YANDU NextGen

Dokumen ini untuk **siapa pun (manusia atau AI)** yang menambah layar atau fitur
baru di prototipe ini. Untuk cara menjalankan & mengedit data contoh, lihat
[BACA-DULU.md](BACA-DULU.md).

## Aturan emas

> **Ikuti gaya yang sudah ada di folder ini. Titik.**
>
> Semua yang dibutuhkan — warna, komponen, pola markup — sudah lengkap di
> `style.css` dan `index.html`. **Jangan** merujuk, menyalin, atau meminta akses
> ke repo lain. Kolaborator lain belum tentu punya repo tersebut, dan prototipe
> ini harus tetap bisa dikerjakan hanya dengan isi folder ini.

Sebelum menulis markup baru: **cari layar existing yang paling mirip**, lalu tiru
strukturnya. Hampir semua pola sudah pernah dipakai di suatu tempat.

## Batasan teknis

- **HTML/CSS/JS polos.** Tanpa build step, tanpa npm, tanpa framework.
- **Tanpa CDN dan tanpa request jaringan.** Satu-satunya pengecualian adalah
  `@import` font di baris atas `style.css`, dan itu pun sudah punya fallback
  font sistem supaya tetap jalan offline.
- **Ikon = karakter Unicode** (`⌕ ▤ ✎ ⌫ ⌄ ✓ ⚠`), bukan library ikon.
- Data hanya di memori: refresh = kembali ke kondisi awal. Ini disengaja.

## Isi folder

| File | Peran |
|---|---|
| `index.html` | Semua layar. Satu layar = satu `<section class="screen" id="s-xxx">` |
| `data.js` | Semua data contoh, dikelompokkan bernomor (`1. DAFTAR KOLOM`, dst) |
| `app.js` | Router, render tabel, validasi |
| `style.css` | Design system. **Semua warna & komponen didefinisikan di sini** |
| `logo-asabri-white.png` | Logo di navbar |

---

## Menambah layar baru

**1 — Tombol menu** di `index.html`, di dalam `<nav class="sidebar">`:

```html
<button class="nav-item" data-go="nama-layar">Judul Menu</button>
```

Untuk menu bertingkat, ikuti pola `nav-parent` + `nav-children` yang sudah ada.

**2 — Section layar**, di dalam `<main class="content">`:

```html
<section class="screen" id="s-nama-layar">
  <div class="crumb"><span>Beranda</span><span>›</span><span>Kepesertaan</span><span>›</span><b>Judul Layar</b></div>

  <div class="page-head">
    <div>
      <h2 class="page-title">Judul Layar</h2>
      <div class="page-sub">Satu kalimat penjelasan singkat.</div>
    </div>
    <button class="btn btn-primary">+ Aksi Utama</button>
  </div>

  <div class="card">
    <!-- isi -->
  </div>
</section>
```

`id` section **wajib** `s-` + nilai `data-go`. Router `go()` di `app.js`
menyambungkan keduanya secara otomatis, sekaligus membuka grup sidebar di
sepanjang jalur menu — tidak perlu menulis handler navigasi sendiri.

**3 — Data** di `data.js`, sebagai blok bernomor baru dengan komentar judul,
mengikuti gaya blok yang sudah ada.

**4 — Render** di `app.js`: satu fungsi `renderNamaLayar()` yang mengisi
`innerHTML` dari `<tbody>` atau kontainer terkait.

---

## Token warna — `:root` di `style.css`

**Jangan menulis hex baru di markup.** Pakai variabel; kalau perlu warna yang
belum ada, tambahkan variabelnya di `:root` dulu.

| Variabel | Untuk |
|---|---|
| `--navy` | Warna aksi utama: tombol primary, tab aktif, kepala kartu review |
| `--navy-dark` / `--navy-top` | Ujung gradien navbar |
| `--gold` | Aksen "NEXTGEN" saja |
| `--ink` / `--body` / `--muted` / `--faint` | Judul / teks isi / label / teks samar |
| `--line` / `--line-soft` | Garis kartu & tabel / pembatas antar baris |
| `--bg` / `--surface` / `--field` | Kanvas / kartu putih / latar input |
| `--green` `--green-soft` `--green-ink` `--green-line` | Status sukses |
| `--red` `--red-soft` `--red-ink` `--red-line` | Status gagal / error |
| `--amber` `--amber-soft` `--amber-ink` `--amber-line` | Status menunggu |
| `--blue-soft` `--blue-ink` `--blue-line` | Info / netral-biru |

Perubahan tema cukup dilakukan di blok `:root`; seluruh layar ikut menyesuaikan.

## Katalog komponen

Pakai kelas ini apa adanya. Semuanya sudah ada di `style.css`.

**Kontainer**

```html
<div class="card">…</div>                    <!-- panel putih standar -->
<h3 class="card-title">Judul Kartu</h3>
<h4 class="section-title">Sub Bagian</h4>    <!-- ada titik biru di depan -->
<div class="subsection-title">LABEL GRUP</div>
```

**Tombol** — `btn` selalu dipasang, lalu satu varian:

| Kelas | Untuk |
|---|---|
| `btn btn-primary` | Aksi utama (Simpan, Cari, Kirim) |
| `btn btn-ghost` | Aksi sekunder (Batal, Export, Kembali) |
| `btn btn-success` | Setujui |
| `btn btn-danger` | Tolak / Hapus (garis tepi merah) |
| `btn btn-danger-solid` | Hapus permanen, butuh penekanan |
| `btn btn-info` | Aksi baris tabel (Detail, Lihat) |
| `btn btn-gold` | Aksi khusus, jarang dipakai |

Tambahkan `btn-sm` untuk ukuran kecil (di dalam baris tabel), `btn-pill` untuk
bentuk kapsul.

**Badge status** — `pill` + tone:

```html
<span class="pill pill-ok">Disetujui</span>
<span class="pill pill-warn">Menunggu</span>
<span class="pill pill-bad">Ditolak</span>
<span class="pill pill-info">Draft</span>
```

**Tabel** — selalu bungkus dengan `.tbl-wrap` supaya bisa scroll horizontal:

```html
<div class="tbl-wrap">
  <table>
    <thead><tr><th>No</th><th>Nama</th></tr></thead>
    <tbody id="xxx-body"></tbody>
  </table>
</div>
```

Tabel **tidak memakai zebra** — cukup sorot saat kursor lewat, dan itu sudah
otomatis. Untuk tabel sangat lebar tambahkan `class="wide-table"` pada `<table>`,
lalu `stick-l` / `stick-r` pada sel yang harus menempel di kiri/kanan.

**Form**

```html
<div class="grid3">                      <!-- atau grid2 -->
  <div class="field">
    <label class="fl" for="x">Nama Lengkap <span class="req">*</span></label>
    <input class="inp" id="x" placeholder="…">
    <div class="hint">Keterangan opsional.</div>
  </div>
</div>
<div class="form-actions">
  <button class="btn btn-ghost">Batal</button>
  <button class="btn btn-primary">Simpan</button>
</div>
```

Label otomatis tampil sebagai huruf kapital kecil — tulis saja normal.
Untuk error: tambahkan kelas `err` pada `.field`, lalu `<div class="err-msg">`.
Input rupiah pakai `.money`. Kolom yang perlu lebar pakai `span2` / `span3`.

**Lainnya**

| Kelas | Untuk |
|---|---|
| `alert alert-info` / `alert-ok` / `alert-bad` | Banner pesan |
| `metrics m3` / `m4` / `m5` + `metric` | Kartu angka ringkasan |
| `wizard` + `wizard-step` | Indikator langkah bergaya lingkaran |
| `stepper` / `stepper-pill` + `step` | Indikator langkah bergaya bar |
| `tabs` + `tab` | Tab bergaris bawah |
| `dropzone` / `upload-zone` | Area unggah berkas |
| `tipe-grid` + `tipe-card` | Kartu pilihan besar |
| `review-card` | Ringkasan sebelum simpan |
| `empty` | Keadaan kosong, dipasang di dalam `<td colspan>` |

## Helper di `app.js`

```js
$("#id")            // querySelector
$$(".kelas")        // querySelectorAll → array
rp(1250000)         // "Rp 1.250.000"
esc(teksDariData)   // escape HTML — WAJIB untuk nilai yang masuk innerHTML
go("nama-layar")    // pindah layar
toast("Pesan")      // notifikasi; toast(msg,"ok") atau toast(msg,"bad")
openModal() / closeModal()   // modal bersama; isi #modal-title, #modal-sub, #modal-body
```

## Yang jangan dilakukan

- Menulis hex warna atau `box-shadow` langsung di markup — pakai variabel dan
  kelas yang sudah ada.
- Membuat kelas tombol/badge/tabel baru padahal sudah ada padanannya.
- Menambah library, CDN, font, atau file build.
- Menyimpan data ke `localStorage` — refresh harus selalu mengembalikan kondisi
  awal supaya mudah didemokan berulang.
- Memasukkan nilai dari `data.js` ke `innerHTML` tanpa `esc()`.
