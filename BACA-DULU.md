# Prototipe UI — Modul Kepesertaan YANDU NextGen

Prototipe interaktif untuk mendampingi dokumen FSD. Bukan kode produksi —
tujuannya agar user bisa *mencoba* alurnya, bukan hanya melihat gambar statis.

## Cara menjalankan

1. Pastikan **semua file berada dalam satu folder yang sama**
2. Klik dua kali `index.html`

Tidak perlu install apa pun dan tanpa server. Tanpa internet pun jalan —
hanya font Plus Jakarta Sans yang tidak terunduh, dan tampilan otomatis
memakai font sistem.

> Jika suatu saat tampilan jadi polos/tanpa warna, biasanya karena `style.css`
> terpisah dari `index.html`. Pastikan semua file tetap satu folder.

## Isi folder

| File | Isinya | Perlu diedit? |
|---|---|---|
| `index.html` | Struktur halaman & susunan layar | Kadang |
| `data.js` | **Semua data contoh** | **Sering — mulai dari sini** |
| `app.js` | Logika interaksi (navigasi, validasi) | Jarang |
| `style.css` | Warna, ukuran, tata letak | Jarang |
| `logo-asabri-white.png` | Logo di navbar | Tidak |
| `Template Pendaftaran Peserta Kolektif.xlsx` | Berkas yang diunduh tombol "⤓ Unduh template" di Pendaftaran Kolektif | Tidak |
| `Pemutakhiran Data *.xlsx` (3 berkas) | Template per Jenis Pemutakhiran Data di layar Peremajaan | Tidak |
| `CLAUDE.md` | Panduan untuk yang menambah layar/fitur baru | Jarang |

Seluruh warna dan komponen (tombol, tabel, form, badge) didefinisikan di
`style.css`, dan yang mengatur temanya cukup blok `:root` di bagian atas file
itu. **Kalau menambah layar baru, ikuti gaya yang sudah ada di folder ini** —
langkah dan daftar kelasnya ada di [CLAUDE.md](CLAUDE.md). Folder ini berdiri
sendiri; tidak perlu repo atau tool lain.

## Mengedit data sendiri

Buka `data.js` dengan Notepad, VS Code, atau editor teks apa pun.
Semua bagian diberi judul bernomor — **cari berdasarkan judulnya**, bukan
urutan nomornya (nomor mengikuti urutan pembuatan, bukan urutan di file).
Setelah menyimpan, **refresh browser** (Ctrl+R / Cmd+R).

Aturan penulisan:
- Teks selalu diapit tanda kutip → `"Mawar"`
- Angka tanpa titik/koma → benar `1250000000`, salah `1.250.000.000`
- Antar baris data dipisah koma
- Jangan menghapus tanda kurung `[ ] { }` pembungkusnya

### Contoh 1 — mengubah saldo alokasi dana
Cari bagian **3. SALDO ALOKASI DANA KPR (PUM)**, ubah angkanya:
```js
"mabes-tni": { label:"Mabes TNI", saldo:1250000000 },
```

### Contoh 2 — menambah peserta di List Kotor
Cari bagian **2. DATA LIST KOTOR**, salin satu blok `{ ... }` yang sudah ada,
tempel di bawahnya (jangan lupa koma pemisah), lalu ganti isinya.

### Contoh 3 — menambah kolom data peserta (alur Kolektif)
Cari bagian **1. DAFTAR KOLOM DATA PESERTA**, tambahkan satu baris:
```js
["golDarah", "GOLONGAN DARAH"],
```
Kolom otomatis muncul di tabel List Kotor, form Revisi, tabel Preview & Simpan,
dan tabel batch di Verifikasi Kolektif sekaligus. Pendaftaran **Perorangan**
punya daftar kolomnya sendiri di `app.js`.

### Contoh 4 — mengubah angka pada alur DAPEM / NON DAPEM
Cari bagian **20. PEMBENTUKAN DAPEM** atau **21. PEMBENTUKAN NON DAPEM**.
Yang paling sering diubah:
- `DAPEM_PARAM` / `NONDAPEM_PARAM` — bulan bayar, jenis bayar, tanggal cut-off
- `DAPEM_GATE` / `NONDAPEM_GATE` — daftar pemeriksaan beserta jumlah temuannya
- `DAPEM_TEMUAN` / `NONDAPEM_TEMUAN` — rincian baris yang muncul di layar Tinjau
- `DAPEM_DATA` (bagian **26**) — peserta yang tampil di Daftar Peserta DAPEM
- `NONDAPEM_DATA` (bagian **28**) — peserta yang tampil di Daftar Peserta NON DAPEM
- `DAPEM_SIPP_DOK` (bagian **27**) — dokumen balikan SIPP yang sudah terunggah

Pada `DAPEM_DATA` dan `NONDAPEM_DATA`, isi saja komponennya (pokok, tunjangan,
potongan, pembulatan). Jumlah bruto, tunjangan lain, dan netto **tidak** ditulis
di data — semuanya dihitung ulang di `app.js`, jadi angkanya tidak mungkin
bertentangan satu sama lain.

Jumlah temuan di daftar pemeriksaan **menyesuaikan sendiri** dengan banyaknya
baris rincian, jadi angkanya tidak akan pernah beda dengan isi tabelnya.

## Layar yang tersedia

Tanda **○** berarti layar masih kerangka — judul dan breadcrumb sudah ada,
isinya menyusul sesuai referensi FSD.

### Pendaftaran Peserta Baru
| Layar | Yang bisa dicoba |
|---|---|
| Perorangan | Pengajuan satu peserta lewat form bertahap |
| Kolektif | Unggah template Excel → List Kotor → Preview & Simpan; form Revisi dengan validasi NRP/NIP duplikat |
| Verifikasi Kolektif | Verifikasi batch hasil unggahan sebelum diteruskan |
| Approval Pendaftaran Peserta Baru | Persetujuan pendaftaran, perorangan maupun kolektif |
| Daftar Nominatif | Hanya batch berstatus bersih yang tervalidasi |

### Peremajaan Data Peserta
| Layar | Yang bisa dicoba |
|---|---|
| Pemutakhiran Data | Unggah template Excel per Jenis Pemutakhiran; sistem memeriksa isinya |
| Approval Pemutakhiran Data | Daftar batch yang menunggu maupun sudah diproses |

### Iuran Premi
| Layar | Yang bisa dicoba |
|---|---|
| Pengelolaan Iuran Premi THT, JKK, dan JKm | Daftar peserta aktif, tombol Hitung Premi menampilkan simulasi |

### Pengelolaan KPR (PUM)
| Layar | Yang bisa dicoba |
|---|---|
| Parameter Plafon | Nominal plafon PUM KPR per Angkatan |
| Alokasi Dana KPR (PUM) | Saldo LIVE per kesatuan, sisa saldo terhitung otomatis, tolak jika melebihi saldo |
| Pengajuan KPR (PUM) | Daftar pengajuan, filter KPA/NPWP/Nama/NRP & status, aksi Detail/Ubah/Hapus/Submit, form Pengajuan Baru dengan pencarian Nomor KPA |
| Approval KPR (PUM) | Persetujuan pengajuan yang sudah disubmit PIC UNOR/Kesatuan |
| Pelunasan KPR (PUM) | Daftar periode → detail approval → Setujui/Tolak |

### Pengelolaan Klaim KPR (BUM)
| Layar | Yang bisa dicoba |
|---|---|
| Klaim KPR (BUM) | Filter Program Reguler/Khusus, status rekonsiliasi & batal akad |
| ○ Pelunasan KPR (BUM) | — |
| ○ Pembatalan Akad KPR (BUM) | — |

### Perdapeman
| Layar | Yang bisa dicoba |
|---|---|
| Pembentukan DAPEM | Daftar periode → ruang kerja 6 tahap (Generate → Kepesertaan → Tunjuk Silang → Pajak → SIPP → Upload YAR). Parameter run ditetapkan sekali, strip lajur menunjukkan bola di tangan siapa, 30 pemeriksaan, layar Tinjau Temuan dengan pratinjau dampak berantai. Di tahap SIPP ada area unggah dokumen balikan, tercatat per putaran |
| ↳ Daftar Peserta DAPEM | Dibuka dari tombol **Peserta** di Daftar Periode: peserta yang terbit pada bulan bayar itu, 18 kolom, filter kode jiwa/kantor bayar/kode otentikasi + pencarian nopens-nama-NIK, Detail per peserta, Export, dan pagination (10/25/50/100 baris) |
| Pembentukan NON DAPEM | Lima langkah berurutan mengikuti F1.2.1–F1.2.9: rekonsiliasi ringkasan vs rincian → kelengkapan data → backup & serah ke Pajak → validasi Pajak → perhitungan ulang & serah ke Keuangan. Langkah berikutnya baru terbuka setelah yang sebelumnya bersih |
| ↳ Daftar Peserta NON DAPEM | Dibuka dari tombol **Daftar Peserta**: peserta yang dibayar di luar dapem, filter jenis bayar (10/11/12)/kantor bayar/ada-tidaknya potongan PPh + pencarian, Detail per peserta, Export, dan pagination. Uang duka wafat yang masih terkena PPh ditandai merah — itu temuan N-04 |
| Validasi Dapem | Sisi Div. Kepesertaan: hanya menyatakan Sesuai / Tidak Sesuai, tanpa tombol perbaikan. Yang ditandai tidak sesuai berpindah kembali menjadi pekerjaan TI |
| Rekap III Dapem | Sisi Keuangan: rekap per mata anggaran — **hasil akhir** pembentukan dapem. Cetak dan Export (xlsx/csv/pdf) terkunci sampai TI menyatakan siap |
| Rekap III Non Dapem | Sama, untuk pembayaran di luar dapem (F1.2.10) |

Kedua layar pembentukan punya **bar PERAGAAN** bergaris putus-putus untuk
melompat ke tahap/langkah mana pun tanpa mengklik seluruh alur — itu alat bantu
demo, bukan bagian dari aplikasi yang akan dibangun.

### Flagging Mitra Bayar — aplikasi terpisah

Modul Pengelolaan Flagging Pinjaman Mitra **sudah dipisah** menjadi aplikasi
sendiri di folder [`flagging/`](flagging/). Buka `flagging/index.html` untuk
menjalankannya — isinya lengkap dan berdiri sendiri (punya `index.html`,
`data.js`, `app.js`, dan `style.css` sendiri), jadi tidak ada berkas yang
dipinjam dari folder induk.

| Layar | Yang bisa dicoba |
|---|---|
| Dashboard | Lima grafik garis: Site Visits, Booking, Pengajuan, Persetujuan, Pelunasan |
| Pensiunan | Rekap per mitra bayar + filter periode/cabang/jenis bayar |
| Check dan Booking — Individu | Cari KPA → informasi peserta (aktif / pensiun sendiri / pensiun waris) + pop-up validasi |
| Check dan Booking — Kolektif | Unggah batch lewat tombol Check & Booking, dua tab: Mitra dan Peserta |
| ○ Pinjaman (Pengajuan, Persetujuan, Flagging, Take Over, Top Up, Penagihan) | — |
| ○ Laporan (Tagihan, Booking, Per Periode, Take Over) | — |
| ○ Parameter Penetapan Tarif | — |

### Lain-lain
| Layar | Yang bisa dicoba |
|---|---|
| Dashboard | Kartu ringkasan + pintasan modul |
| Pengelolaan Surat Pernyataan Tanda Bukti Diri (SPTB) | Pemantauan status Surat Pernyataan Tanda Bukti Diri |
| Manajemen Dokumen Peserta (E-Dosir) | Rekap digitalisasi dokumen per kantor cabang |
| Pengelolaan Request Umum | Informasi pemutakhiran data dari Kantor Cabang ke Divisi Kepesertaan |
| ○ Pengelolaan Alih Status Peserta | — |
| ○ Pengelolaan Data Peserta | — |

Beberapa layar tidak punya menu sendiri karena dibuka dari layar lain (ditandai
**↳** pada tabel di atas): **Monitoring Distribusi BDN** dari pintasan di
Dashboard, **Daftar Peserta DAPEM** dari Daftar Periode, **Daftar Peserta
NON DAPEM** dari layar Pembentukan NON DAPEM, serta Detail/Form
Pengajuan PUM dan layar Tinjau Temuan DAPEM/NON DAPEM.

## Catatan

- Data hanya tersimpan di memori browser. **Refresh = kembali ke kondisi awal.**
  Ini disengaja agar mudah didemokan berulang kali.
- Untuk menyimpan versi: salin seluruh folder dan beri nama bertanggal,
  misalnya `yandu-prototype-2026-08-21/`.
