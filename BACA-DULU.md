# Prototipe UI — Modul Kepesertaan YANDU NextGen

Prototipe interaktif untuk mendampingi dokumen FSD. Bukan kode produksi —
tujuannya agar user bisa *mencoba* alurnya, bukan hanya melihat gambar statis.

## Cara menjalankan

1. Pastikan **keempat file berada dalam satu folder yang sama**
2. Klik dua kali `index.html`

Tidak perlu install apa pun, tanpa server, tanpa internet.

> Jika suatu saat tampilan jadi polos/tanpa warna, biasanya karena `style.css`
> terpisah dari `index.html`. Pastikan semua file tetap satu folder.

## Isi folder

| File | Isinya | Perlu diedit? |
|---|---|---|
| `index.html` | Struktur halaman & susunan layar | Kadang |
| `data.js` | **Semua data contoh** | **Sering — mulai dari sini** |
| `app.js` | Logika interaksi (navigasi, validasi) | Jarang |
| `style.css` | Warna, ukuran, tata letak | Jarang |

## Mengedit data sendiri

Buka `data.js` dengan Notepad, VS Code, atau editor teks apa pun.
Semua bagian sudah diberi nomor dan penjelasan. Setelah menyimpan,
**refresh browser** (Ctrl+R / Cmd+R).

Aturan penulisan:
- Teks selalu diapit tanda kutip → `"Mawar"`
- Angka tanpa titik/koma → benar `1250000000`, salah `1.250.000.000`
- Antar baris data dipisah koma
- Jangan menghapus tanda kurung `[ ] { }` pembungkusnya

### Contoh 1 — mengubah saldo alokasi dana
Cari bagian **3. SALDO ALOKASI DANA**, ubah angkanya:
```js
"mabes-tni": { label:"Mabes TNI", saldo:1250000000 },
```

### Contoh 2 — menambah peserta di List Kotor
Cari bagian **2. DATA LIST KOTOR**, salin satu blok `{ ... }` yang sudah ada,
tempel di bawahnya (jangan lupa koma pemisah), lalu ganti isinya.

### Contoh 3 — menambah kolom data peserta
Cari bagian **1. DAFTAR KOLOM**, tambahkan satu baris:
```js
["golDarah", "GOLONGAN DARAH"],
```
Kolom otomatis muncul di tabel List Kotor, Preview, form Revisi,
dan form Registrasi Individu sekaligus.

## Layar yang tersedia

| Layar | Yang bisa dicoba |
|---|---|
| Dashboard | Kartu ringkasan + pintasan modul |
| Registrasi Peserta | Alur 3 tahap: Upload → List Kotor → Preview & Simpan; form Revisi dengan validasi NRP/NIP duplikat |
| Alokasi Dana PUM | Saldo LIVE per kesatuan, sisa saldo terhitung otomatis, tolak jika melebihi saldo |
| Pengelolaan PUM KPR | Daftar pengajuan per peserta, filter KPA/NPWP/Nama/NRP & status, aksi Detail/Ubah/Hapus/Submit, form Pengajuan Baru dengan pencarian Nomor KPA |
| Pelunasan PUM KPR | Daftar periode → detail approval → Setujui/Tolak |
| Pengelolaan BUM KPR | Filter Program Reguler/Khusus, status rekonsiliasi & batal akad |
| Monitoring BDN | Status 5 kanal distribusi, kirim ulang yang gagal, simulasi update otomatis |

## Catatan

- Data hanya tersimpan di memori browser. **Refresh = kembali ke kondisi awal.**
  Ini disengaja agar mudah didemokan berulang kali.
- Untuk menyimpan versi: salin seluruh folder dan beri nama bertanggal,
  misalnya `yandu-prototype-2026-08-07/`.
