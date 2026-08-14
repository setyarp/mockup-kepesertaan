/* ===========================================================================
   data.js — SEMUA DATA CONTOH PROTOTIPE
   ---------------------------------------------------------------------------
   File ini sengaja dipisah supaya mudah diubah tanpa menyentuh logika aplikasi.
   Aman untuk diedit sendiri. Aturan singkat:
     - Teks selalu diapit tanda kutip "..."
     - Angka TANPA titik/koma  →  benar: 1250000000   salah: 1.250.000.000
     - Tiap baris data dipisah koma, baris terakhir boleh tanpa koma
     - Jangan hapus tanda kurung [ ] { } yang membungkusnya
   Setelah diedit: simpan file, lalu refresh browser (Ctrl+R / Cmd+R).
   =========================================================================== */


/* ---------------------------------------------------------------------------
   1. DAFTAR KOLOM DATA PESERTA
   Dipakai bersama oleh: tabel List Kotor, tabel Preview & Simpan,
   form Revisi, dan form Registrasi Individu.
   Format: ["kunci_data", "JUDUL KOLOM YANG TAMPIL"]
   Menambah kolom di sini otomatis menambahkannya di semua tampilan tersebut.
   --------------------------------------------------------------------------- */
const FIELDS = [
  ["nrp",        "NRP/NIP"],
  ["nama",       "NAMA"],
  ["sts",        "STS PERSONIL"],
  ["unor",       "UNOR"],
  ["angkatan",   "ANGKATAN"],
  ["pangkat",    "PANGKAT"],
  ["kdPangkat",  "KODE PANGKAT"],
  ["noSkep",     "NO SKEP"],
  ["tglSkep",    "TGL SKEP"],
  ["tmtSkep",    "TMT SKEP"],
  ["kesatuan",   "KESATUAN"],
  ["kdKesatuan", "KODE KESATUAN"],
  ["kdKancab",   "KODE KANCAB"],
  ["jnsKel",     "JNS KEL"],
  ["tmpLahir",   "TEMPAT LAHIR"],
  ["tglLahir",   "TGL LAHIR"],
  ["alamat",     "ALAMAT"],
  ["kelurahan",  "KELURAHAN"],
  ["kecamatan",  "KECAMATAN"],
  ["kota",       "KOTA"],
  ["propinsi",   "PROPINSI"],
  ["noHp",       "NO HP"],
  ["email",      "EMAIL"],
  ["nik",        "NIK"],
  ["npwp",       "NPWP"]
];

/* Field yang wajib diisi (ditandai bintang merah + divalidasi saat simpan) */
const FIELD_WAJIB = ["nrp", "nama", "nik"];

/* Field yang ditampilkan lebih lebar (2 kolom) di form */
const FIELD_LEBAR = ["alamat", "kesatuan", "email"];


/* ---------------------------------------------------------------------------
   2. DATA LIST KOTOR — baris yang gagal validasi saat upload batch
   Kunci "_err" menandai field bermasalah beserta pesan errornya.
   Contoh menambah error lain:  _err: { nik: "NIK harus 16 digit" }
   Kalau baris tidak punya error, hapus saja seluruh baris "_err".
   --------------------------------------------------------------------------- */
const DATA_LIST_KOTOR = [
  {
    nrp:"199304252023212034", nama:"Mawar", sts:"1", unor:"3", angkatan:"3",
    pangkat:"LETTU", kdPangkat:"3772", noSkep:"KEP/1416/X/2023",
    tglSkep:"10/26/2023", tmtSkep:"11/1/2023",
    kesatuan:"KEMENTERIAN PERTAHANAN", kdKesatuan:"638012", kdKancab:"2000",
    jnsKel:"2", tmpLahir:"Tulungagung", tglLahir:"15/08/1996",
    alamat:"Perumahan Purimas", kelurahan:"Botoran", kecamatan:"Botoran",
    kota:"Kabupaten Tulungagung", propinsi:"Jawa Timur",
    noHp:"086839042913", email:"mawar@gmail.com",
    nik:"3217942852321203", npwp:"4324273418312",
    _err:{ nrp:"NRP/NIP duplikat, harap cek kembali" }
  },
  {
    nrp:"199304252023212034", nama:"Melati", sts:"1", unor:"3", angkatan:"3",
    pangkat:"KAPTEN", kdPangkat:"3773", noSkep:"KEP/1416/X/2023",
    tglSkep:"26/10/2023", tmtSkep:"26/10/2023",
    kesatuan:"KEMENTERIAN PERTAHANAN", kdKesatuan:"638012", kdKancab:"2000",
    jnsKel:"2", tmpLahir:"Cirebon", tglLahir:"4/13/1990",
    alamat:"Perumahan Watumas", kelurahan:"Ciledug", kecamatan:"Ciledug",
    kota:"Kabupaten Cirebon", propinsi:"Jawa Barat",
    noHp:"087395631850", email:"melati@gmail.com",
    nik:"4367817847835096", npwp:"73182137318414",
    _err:{ nrp:"NRP/NIP duplikat, harap cek kembali" }
  }
];


/* ---------------------------------------------------------------------------
   3. SALDO ALOKASI DANA KPR (PUM) per kesatuan
   Kunci (mis. "mabes-tni") harus cocok dengan nilai <option> di index.html.
   --------------------------------------------------------------------------- */
const DATA_SALDO = {
  "mabes-tni":   { label:"Mabes TNI",              saldo:1250000000 },
  "mabes-polri": { label:"Mabes Polri",            saldo:940000000  },
  "kemhan":      { label:"Kementerian Pertahanan", saldo:2100000000 }
};

/* Pilihan tahun pada field Periode */
const DATA_TAHUN = ["2026", "2027", "2028"];


/* ---------------------------------------------------------------------------
   4. MASTER DATA PESERTA (dipakai oleh pencarian "Nomor KPA" saat membuat
      Pengajuan Baru PUM KPR — mensimulasikan data yang ditarik dari ASABRI)
   --------------------------------------------------------------------------- */
const DATA_MASTER_PESERTA = [
  { kpa:"CD317049", nrp:"119596",             npwp:"73.104.502.7-009.000", nama:"Intan M. Sari",
    angkatan:"TNI-AL", uker:"Polres Jakarta Barat",  plafonPum:350000000 },
  { kpa:"CY104869", nrp:"197804081998032003", npwp:"89.231.218.2-603.000", nama:"Made Wardani",
    angkatan:"TNI-AL", uker:"Polres Jakarta Selatan", plafonPum:300000000 },
  { kpa:"CE360625", nrp:"132170",             npwp:"85.465.740.0-514.000", nama:"Kenedi",
    angkatan:"TNI-AL", uker:"Kodim 0501 Jakarta Pusat", plafonPum:325000000 },
  { kpa:"CE358403", nrp:"127485",             npwp:"95.023.091.2-643.000", nama:"Firman Dewantoro",
    angkatan:"TNI-AL", uker:"Polres Bekasi",         plafonPum:300000000 },
  { kpa:"CD319552", nrp:"126284",             npwp:"92.704.589.8-126.000", nama:"Aprildo Anang Riyadi",
    angkatan:"TNI-AL", uker:"Polres Tangerang",      plafonPum:350000000 },
  { kpa:"CC306323", nrp:"14621/P",            npwp:"08.544.963.5-603.000", nama:"Heriyanto, S.KM",
    angkatan:"TNI-AL", uker:"Polres Bogor",          plafonPum:400000000 },
  { kpa:"CD400871", nrp:"148820",             npwp:"77.310.229.4-882.000", nama:"Yusuf Pratama",
    angkatan:"TNI-AD", uker:"Kodim 0733 Semarang",   plafonPum:300000000 },
  { kpa:"BP000111", nrp:"84071073",           npwp:"12.345.678.9-001.000", nama:"Andi Saputra",
    angkatan:"Polri",  uker:"Polres Bandung",         plafonPum:320000000 },
  { kpa:"EP000112", nrp:"199801152020121003", npwp:"23.456.789.0-002.000", nama:"Eko Prasetyo",
    angkatan:"TNI-AU", uker:"Lanud Adisutjipto",      plafonPum:310000000 },

  /* Ditambahkan supaya tersedia 10 Nomor KPA "bersih" (belum pernah dipakai
     bikin pengajuan) untuk simulasi Pengajuan KPR (PUM) baru — lihat catatan
     di BACA-DULU.md / balasan chat untuk daftar lengkapnya. */
  { kpa:"AD500221", nrp:"142376",             npwp:"14.257.836.9-114.000", nama:"Bambang Setiawan",
    angkatan:"TNI-AD", uker:"Kodim 0709 Kebumen",       plafonPum:340000000 },
  { kpa:"AL600334", nrp:"198502102010121004", npwp:"25.368.947.0-225.000", nama:"Dewi Anggraini",
    angkatan:"TNI-AL", uker:"Lanal Surabaya",           plafonPum:315000000 },
  { kpa:"AU700445", nrp:"156234",             npwp:"36.479.058.1-336.000", nama:"Rudi Hartono",
    angkatan:"TNI-AU", uker:"Lanud Halim Perdanakusuma",plafonPum:360000000 },
  { kpa:"PL800556", nrp:"87023456",           npwp:"47.580.169.2-447.000", nama:"Siti Nurhaliza",
    angkatan:"Polri",  uker:"Polres Surabaya",          plafonPum:330000000 },
  { kpa:"AD500667", nrp:"199003152015031002", npwp:"58.691.270.3-558.000", nama:"Joko Widiyanto",
    angkatan:"TNI-AD", uker:"Kodim 0610 Sumedang",      plafonPum:305000000 },
  { kpa:"AL600778", nrp:"163890",             npwp:"69.702.381.4-669.000", nama:"Maria Christina",
    angkatan:"TNI-AL", uker:"Lanal Banyuwangi",         plafonPum:295000000 },
  { kpa:"PL800889", nrp:"91045678",           npwp:"70.813.492.5-770.000", nama:"Agus Salim",
    angkatan:"Polri",  uker:"Polres Depok",             plafonPum:375000000 },

  /* Batch ke-2: 10 Nomor KPA "bersih" lagi (berbeda dari batch pertama di atas),
     juga belum pernah dipakai bikin pengajuan. */
  { kpa:"TA910123", nrp:"178432",             npwp:"81.924.605.6-881.000", nama:"Slamet Riyadi",
    angkatan:"TNI-AD", uker:"Kodim 0610 Cimahi",         plafonPum:320000000 },
  { kpa:"TB920234", nrp:"199105202018081005", npwp:"92.035.716.7-992.000", nama:"Nur Aisyah",
    angkatan:"TNI-AD", uker:"Kodim 0714 Salatiga",       plafonPum:290000000 },
  { kpa:"LA930345", nrp:"185673",             npwp:"03.146.827.8-103.000", nama:"Hendra Gunawan",
    angkatan:"TNI-AL", uker:"Lanal Batam",               plafonPum:355000000 },
  { kpa:"LB940456", nrp:"199206182019022003", npwp:"14.257.938.9-214.000", nama:"Putri Ramadhani",
    angkatan:"TNI-AL", uker:"Lanal Ambon",               plafonPum:300000000 },
  { kpa:"UA950567", nrp:"192784",             npwp:"25.368.049.0-325.000", nama:"Yayan Kusuma",
    angkatan:"TNI-AU", uker:"Lanud Iswahjudi",           plafonPum:365000000 },
  { kpa:"UB960678", nrp:"199308142020051004", npwp:"36.479.150.1-436.000", nama:"Lestari Handayani",
    angkatan:"TNI-AU", uker:"Lanud Sulaiman",            plafonPum:285000000 },
  { kpa:"PA970789", nrp:"88056789",           npwp:"47.580.261.2-547.000", nama:"Fajar Nugroho",
    angkatan:"Polri",  uker:"Polres Malang",             plafonPum:340000000 },
  { kpa:"PB980890", nrp:"90067890",           npwp:"58.691.372.3-658.000", nama:"Ratna Sari",
    angkatan:"Polri",  uker:"Polres Semarang",           plafonPum:310000000 },
  { kpa:"PC990901", nrp:"92078901",           npwp:"69.702.483.4-769.000", nama:"Wahyu Saputro",
    angkatan:"Polri",  uker:"Polres Yogyakarta",         plafonPum:325000000 },
  { kpa:"TC911012", nrp:"165789",             npwp:"70.813.594.5-770.000", nama:"Indra Permana",
    angkatan:"TNI-AD", uker:"Kodim 0733 Solo",           plafonPum:350000000 }
];

/* Pilihan "Nama Instansi / Kesatuan Pengirim" pada form Pendaftaran Peserta Baru */
const DATA_INSTANSI_PENGIRIM = [
  "PUSKERSIN", "Mabes TNI AD", "Mabes TNI AL", "Mabes TNI AU", "Mabes Polri", "Kementerian Pertahanan"
];

/* Pilihan dropdown "Unit Kerja (UKER)" pada form Data Peserta — Pendaftaran
   Peserta Baru. Sebagian entri sudah punya kode (format "KODE - NAMA"),
   sebagian belum (format "- NAMA"), sesuai referensi data ASABRI. */
const DATA_UKER = [
  "344281 - KOREM-084/W DAM V/BRW",
  "639869 - GABRAH 84",
  "- KOREM 084",
  "- KOREM 084/BJ",
  "- KODIM 0827 REM 084/BJ",
  "- SECABA MILSUK ZI TA 1984/1985",
  "- KODIM 0830 REM 084/BJ",
  "- KODIM 0828 REM 084/BJ",
  "- KODIM 0829 REM 084/BJ",
  "- KODIM 0826 REM 084/BJ",
  "- KODIM 0817 REM 084/BJ",
  "- KODIM 0831 REM 084/BJ",
  "- MILSUK PAL TA1984/1985",
  "- MILSUK ARHANUD TA 1984/1985",
  "- SECABA MILSUK KODIKLATDAM VI/SLW TA 1983/1984",
  "- KOMANDO RESORT KEPOLISIAN 1084 JOMBANG"
];

/* Pilihan "Kantor Cabang" pada form Data Peserta */
const DATA_KANTOR_CABANG = [
  "Kanca Jakarta Pusat", "Kanca Jakarta Selatan", "Kanca Jakarta Barat", "Kanca Jakarta Timur",
  "Kanca Bandung", "Kanca Yogyakarta", "Kanca Surabaya", "Kanca Bekasi", "Kanca Tangerang",
  "Kanca Semarang", "Kanca Medan", "Kanca Makassar", "Kanca Denpasar"
];

/* Saran otomatis Kantor Cabang berdasarkan kabupaten/kota hasil pilihan
   Desa/Kelurahan — dipakai untuk auto-isi field "Kantor Cabang". */
const DATA_KANTOR_CABANG_MAP = {
  "Jakarta Barat":    "Kanca Jakarta Barat",
  "Jakarta Selatan":  "Kanca Jakarta Selatan",
  "Jakarta Timur":    "Kanca Jakarta Timur",
  "Kota Bandung":     "Kanca Bandung",
  "Sleman":           "Kanca Yogyakarta",
  "Kota Surabaya":    "Kanca Surabaya",
  "Kota Bekasi":      "Kanca Bekasi",
  "Kota Tangerang":   "Kanca Tangerang"
};

/* Saran dokumen yang bisa ditambahkan secara dinamis di step "Berkas
   Persyaratan" — Pendaftaran Peserta Baru. "KTP" dan "Surat Pengangkatan
   Pertama" sengaja tidak dimasukkan karena sudah jadi baris tetap/wajib. */
const DATA_BERKAS_SARAN = [
  "Kartu Tanda Peserta Asabri", "Kartu Tanda Anggota", "Surat Ijin Mengemudi", "Pasport",
  "Kartu Keluarga", "Surat Nikah / KPI", "Daftar Riwayat Hidup Singkat", "Buku Tabungan",
  "Akte Kelahiran / Surat Kenal Lahir", "Ijazah Sekolah Umum / Pendidikan Militer",
  "Struk Gaji/Carik Gaji Terakhir", "Surat Pengantar dari Kesatuan", "SKEP Pensiun",
  "SKEP Berhenti Karena Meninggal Dunia", "SKEP Pemberhentian", "SKEP Gugur / Tewas",
  "SKEP Cacat", "Surat Keterangan Pemberhentian Pembayaran",
  "Surat Keterangan Ahli Waris / Kuasa Ahli Waris", "Surat Keterangan Kematian",
  "Surat Keterangan Kehilangan dari Kepolisian", "PasPhoto", "Surat Keterangan Kuliah",
  "Kartu Penunjukan Istri dari Kesatuan", "Surat Keterangan Perwalian dari Pengadilan",
  "Surat Tanggungan Keluarga", "Surat Keterangan Janda / Duda",
  "Surat Keterangan Belum Menikah dan Belum Bekerja", "Daftar Keluarga",
  "Nomor Pokok Wajib Pajak", "KU-107", "Surat Permohonan Pembayaran", "Carik Dapem",
  "Surat Pembatalan BUM KPR", "Surat Pernyataan Kantor Bayar", "Request Umum",
  "Pinjaman Mitra", "Take Over :: Bukti Pelunasan", "Surat Kontrak",
  "Bukti Pelunasan dari Mitra", "Dokumen Cerai", "Surat Persetujuan Penunjukan Istri",
  "Bukti Setor", "Rincian Hutang"
];

/* Wilayah untuk autocomplete field "Kelurahan" — memilih satu baris otomatis
   mengisi Kecamatan, Kabupaten/Kota, dan Provinsi */
const DATA_WILAYAH = [
  { kelurahan:"Kebon Jeruk",  kecamatan:"Kebon Jeruk",         kabupaten:"Jakarta Barat",    provinsi:"DKI Jakarta" },
  { kelurahan:"Kemanggisan",  kecamatan:"Palmerah",            kabupaten:"Jakarta Barat",    provinsi:"DKI Jakarta" },
  { kelurahan:"Kemang",       kecamatan:"Mampang Prapatan",    kabupaten:"Jakarta Selatan",  provinsi:"DKI Jakarta" },
  { kelurahan:"Cibubur",      kecamatan:"Ciracas",             kabupaten:"Jakarta Timur",    provinsi:"DKI Jakarta" },
  { kelurahan:"Sukajadi",     kecamatan:"Sukajadi",            kabupaten:"Kota Bandung",     provinsi:"Jawa Barat" },
  { kelurahan:"Sukaluyu",     kecamatan:"Cibeunying Kaler",    kabupaten:"Kota Bandung",     provinsi:"Jawa Barat" },
  { kelurahan:"Ngaglik",      kecamatan:"Ngaglik",             kabupaten:"Sleman",           provinsi:"D.I. Yogyakarta" },
  { kelurahan:"Rungkut",      kecamatan:"Rungkut",             kabupaten:"Kota Surabaya",    provinsi:"Jawa Timur" },
  { kelurahan:"Jatiasih",     kecamatan:"Jatiasih",            kabupaten:"Kota Bekasi",      provinsi:"Jawa Barat" },
  { kelurahan:"Cikokol",      kecamatan:"Tangerang",           kabupaten:"Kota Tangerang",   provinsi:"Banten" }
];

/* 13 mitra bayar terdaftar untuk penyaluran KPR (PUM) */
const DATA_MITRA_BAYAR = [
  "Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BTN", "Bank BCA",
  "Bank Syariah Indonesia (BSI)", "Bank DKI", "Bank Jabar Banten (BJB)",
  "Bank Jatim", "Bank Sumut", "Bank Nagari", "Bank Riau Kepri", "Bank Kalbar"
];

/* Daftar dokumen persyaratan per tipe PUM KPR — dipakai di langkah "Unggah
   Dokumen". Tandai kondisional:true untuk dokumen yang tidak wajib bagi
   semua peserta (beri catatan singkat lewat "note"). */
const DATA_DOKUMEN_PERSYARATAN = {
  "Kredit Rumah": [
    { label:"Formulir pengajuan" },
    { label:"Surat pernyataan pengajuan" },
    { label:"Fotocopy KTPA" },
    { label:"Fotocopy kartu keluarga" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy buku nikah" },
    { label:"Surat pernyataan kesanggupan", kondisional:true,
      note:"Kondisional — hanya untuk peserta Polri dengan masa kerja < 2 tahun" }
  ],

  "Pembelian Rumah Secara Mandiri": [
    { label:"Formulir pengajuan" },
    { label:"Surat pernyataan pengajuan" },
    { label:"Fotocopy KTPA" },
    { label:"Fotocopy kartu keluarga" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy buku nikah" },
    { label:"Fotocopy surat kesepakatan jual beli" },
    { label:"Surat pernyataan kesanggupan", kondisional:true,
      note:"Kondisional — hanya untuk peserta Polri dengan masa kerja < 2 tahun" }
  ],

  "Membangun Rumah": [
    { label:"Formulir pengajuan" },
    { label:"Surat pernyataan pengajuan" },
    { label:"Fotocopy KTPA" },
    { label:"Fotocopy kartu keluarga" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy buku nikah" },
    { label:"Fotocopy bukti kepemilikan hak atas tanah" },
    { label:"Fotocopy PNG/Gambar Desain Rumah" },
    { label:"Surat pernyataan kesanggupan", kondisional:true,
      note:"Kondisional — hanya untuk peserta Polri dengan masa kerja < 2 tahun" }
  ]
};


/* ---------------------------------------------------------------------------
   5. DAFTAR PENGAJUAN KPR (PUM)
   Satu baris = satu peserta yang mengajukan ambil PUM.
   status: "Draft" (belum dikirim, masih bisa Ubah/Hapus) | "Submitted" (sudah dikirim)
   --------------------------------------------------------------------------- */
const DATA_PUM = [
  { kpa:"CD317049", nrp:"119596",             npwp:"73.104.502.7-009.000", nama:"Intan M. Sari",
    angkatan:"TNI-AL", tglAmbil:"Sel, 23 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"36/90",
    status:"Submitted", jumlah:25000000 },
  { kpa:"CY104869", nrp:"197804081998032003", npwp:"89.231.218.2-603.000", nama:"Made Wardani",
    angkatan:"TNI-AL", tglAmbil:"Sel, 23 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"45/111",
    status:"Draft",     jumlah:30000000 },
  { kpa:"CE360625", nrp:"132170",             npwp:"85.465.740.0-514.000", nama:"Kenedi",
    angkatan:"TNI-AL", tglAmbil:"Sel, 23 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"36/72",
    status:"Submitted", jumlah:20000000 },
  { kpa:"CE358403", nrp:"127485",             npwp:"95.023.091.2-643.000", nama:"Firman Dewantoro",
    angkatan:"TNI-AL", tglAmbil:"Sen, 22 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"36/94",
    status:"Draft",     jumlah:20000000 },
  { kpa:"CD319552", nrp:"126284",             npwp:"92.704.589.8-126.000", nama:"Aprildo Anang Riyadi",
    angkatan:"TNI-AL", tglAmbil:"Sen, 22 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"36/96",
    status:"Submitted", jumlah:25000000 },
  { kpa:"CC306323", nrp:"14621/P",            npwp:"08.544.963.5-603.000", nama:"Heriyanto, S.KM",
    angkatan:"TNI-AL", tglAmbil:"Sen, 22 Mei 2023", tipePum:"Kredit Rumah", tipeRumah:"36/96",
    status:"Submitted", jumlah:35000000 }
];


/* ---------------------------------------------------------------------------
   6. PELUNASAN KPR (PUM)
   status: "Menunggu approval" | "Disetujui" | "Ditolak"
   --------------------------------------------------------------------------- */
const DATA_PELUNASAN_PERIODE = [
  { id:"2026-07", periode:"Juli 2026", rangeText:"01–31 Juli 2026",
    peserta:42, total:1260000000, status:"Menunggu approval" },
  { id:"2026-06", periode:"Juni 2026", rangeText:"01–30 Juni 2026",
    peserta:38, total:980000000,  status:"Disetujui" },
  { id:"2026-05", periode:"Mei 2026",  rangeText:"01–31 Mei 2026",
    peserta:45, total:1410000000, status:"Disetujui" }
];

/* Rincian peserta yang tampil di halaman detail approval */
const DATA_PELUNASAN_PESERTA = [
  { ktpa:"CD317049", nama:"Intan M. Sari",        unor:"TNI-AL", sisa:25000000, lunas:25000000 },
  { ktpa:"CY104869", nama:"Made Wardani",         unor:"TNI-AL", sisa:30000000, lunas:30000000 },
  { ktpa:"CE360625", nama:"Kenedi",               unor:"TNI-AL", sisa:20000000, lunas:20000000 },
  { ktpa:"CE358403", nama:"Firman Dewantoro",     unor:"TNI-AD", sisa:20000000, lunas:20000000 },
  { ktpa:"CD319552", nama:"Aprildo Anang Riyadi", unor:"Polri",  sisa:25000000, lunas:25000000 },
  { ktpa:"CC306323", nama:"Heriyanto, S.KM",      unor:"Polri",  sisa:35000000, lunas:35000000 }
];


/* ---------------------------------------------------------------------------
   7. PENGELOLAAN KPR (BUM)
   program: "Reguler" | "Khusus"
   status : "MENUNGGU REKON YPPSDP" | "DIREKONKAN REGULER" |
            "DIREKONKAN KHUSUS"     | "BATAL AKAD KHUSUS" | "BATAL AKAD REGULER"
   --------------------------------------------------------------------------- */
const DATA_BUM = [
  { ktpa:"CD317049", nama:"Intan M. Sari",    unor:"TNI-AL", program:"Reguler", out:18000000, status:"MENUNGGU REKON YPPSDP" },
  { ktpa:"CY104869", nama:"Made Wardani",     unor:"TNI-AL", program:"Khusus",  out:12500000, status:"DIREKONKAN KHUSUS" },
  { ktpa:"CE360625", nama:"Kenedi",           unor:"TNI-AD", program:"Reguler", out:22000000, status:"DIREKONKAN REGULER" },
  { ktpa:"CE358403", nama:"Firman Dewantoro", unor:"Polri",  program:"Khusus",  out:9500000,  status:"BATAL AKAD KHUSUS" },
  { ktpa:"CD319552", nama:"Aprildo A. R.",    unor:"Polri",  program:"Reguler", out:15750000, status:"MENUNGGU REKON YPPSDP" }
];

/* Angka ringkasan (kartu metrik) di halaman BUM KPR */
const DATA_BUM_METRIK = [
  { label:"Outstanding Program Reguler", nilai:"Rp 8,4 M",  sub:"312 peserta aktif",        warna:"" },
  { label:"Outstanding Program Khusus",  nilai:"Rp 2,1 M",  sub:"78 peserta aktif",         warna:"" },
  { label:"Batal akad periode ini",      nilai:"6 peserta", sub:"menunggu rekap penagihan", warna:"bad" }
];


/* ---------------------------------------------------------------------------
   8. DISTRIBUSI BDN (multi-channel)
   Status tiap kanal: "ok" (terkirim) | "wait" (pending) | "bad" (gagal)
   --------------------------------------------------------------------------- */
const KANAL = [
  ["cetak",  "Cetak"],
  ["wa",     "WhatsApp"],
  ["email",  "Email"],
  ["push",   "Push mobile"],
  ["lojita", "Sync Lojita"]
];

const DATA_DISTRIBUSI = [
  { kpa:"B/000118/VII/2026", nama:"Intan M. Sari",    cetak:"ok",   wa:"ok",   email:"ok",  push:"ok",   lojita:"ok" },
  { kpa:"B/000119/VII/2026", nama:"Made Wardani",     cetak:"ok",   wa:"wait", email:"bad", push:"wait", lojita:"ok" },
  { kpa:"B/000120/VII/2026", nama:"Kenedi",           cetak:"ok",   wa:"ok",   email:"bad", push:"ok",   lojita:"ok" },
  { kpa:"B/000121/VII/2026", nama:"Firman Dewantoro", cetak:"wait", wa:"ok",   email:"ok",  push:"ok",   lojita:"ok" }
];


/* ---------------------------------------------------------------------------
   9. DASHBOARD — kartu ringkasan di halaman depan
   warna: "" (normal) | "ok" (hijau) | "warn" (kuning) | "bad" (merah)
   --------------------------------------------------------------------------- */
const DATA_DASHBOARD = [
  { label:"KPA terbit hari ini",        nilai:"128",        sub:"seluruhnya tersinkron ke Lojita", warna:"ok"   },
  { label:"Batch menunggu approval",    nilai:"3 batch",    sub:"1 batch lewat SLA 2 hari",        warna:"warn" },
  { label:"Pelunasan menunggu approval",nilai:"42 peserta", sub:"Rp 1.260.000.000",                warna:""     }
];


/* ---------------------------------------------------------------------------
   11. FLAGGING — CHECK DAN BOOKING INDIVIDU
   Data dummy yang tampil begitu tombol "Search" ditekan, dibedakan menurut
   Jenis Individu yang dipilih (Peserta Aktif / Peserta Pensiun).
   --------------------------------------------------------------------------- */
const DATA_FLAGGING_AKTIF = [
  { kpa:"CD400871", nama:"Yusuf Pratama" },
  { kpa:"CD317049", nama:"Intan M. Sari" }
];
const DATA_FLAGGING_PENSIUN = [
  { kpa:"CY104869", nomorPensiun:"PS-2019-004821", namaPeminjam:"Made Wardani", nama:"Made Wardani" }
];

/* ---------------------------------------------------------------------------
   12. FLAGGING — CHECK DAN BOOKING KOLEKTIF
   Data dummy yang tampil begitu tombol "Upload" ditekan, dibedakan menurut
   Jenis Kolektif yang dipilih (Peserta Aktif / Peserta Pensiun).
   --------------------------------------------------------------------------- */
const DATA_FLAGGING_KOLEKTIF_AKTIF = [
  { kpa:"CD400871", nrp:"148820",             nama:"Yusuf Pratama",     tglLahir:"12 Mei 1985" },
  { kpa:"BP000111", nrp:"84071073",           nama:"Andi Saputra",      tglLahir:"03 Januari 1990" },
  { kpa:"EP000112", nrp:"199801152020121003", nama:"Eko Prasetyo",      tglLahir:"22 Agustus 1988" }
];
const DATA_FLAGGING_KOLEKTIF_PENSIUN = [
  { kpa:"CY104869", nrp:"197804081998032003", nomorPensiun:"PS-2019-004821", namaPeserta:"Made Wardani",     tglLahir:"08 April 1978", hidup:true,  nomorPensiunPenerima:"PS-2019-004821-P", namaPenerima:"Made Wardani" },
  { kpa:"CE360625", nrp:"132170",             nomorPensiun:"PS-2015-002214", namaPeserta:"Kenedi",           tglLahir:"15 Maret 1970", hidup:false, nomorPensiunPenerima:"PS-2015-002214-P", namaPenerima:"Sri Kenedi (Istri)" },
  { kpa:"CE358403", nrp:"127485",             nomorPensiun:"PS-2012-001190", namaPeserta:"Firman Dewantoro", tglLahir:"27 Juni 1968",  hidup:true,  nomorPensiunPenerima:"PS-2012-001190-P", namaPenerima:"Firman Dewantoro" }
];

/* ---------------------------------------------------------------------------
   13. PEREMAJAAN DATA — PEMUTAKHIRAN DATA
   Kolom tabel & baris contoh hasil validasi, dibedakan menurut Jenis
   Pemutakhiran yang dipilih di step "Unggah Berkas". "langkah" tampil di
   panel "Langkah Pengisian".
   --------------------------------------------------------------------------- */
const DATA_PEREMAJAAN = {
  pokok: {
    templateNama: "Template Data Pokok Peserta",
    kolom:      ["NRP/NIP", "Nama", "Alamat", "No. HP", "Email"],
    kolomError: ["NRP/NIP", "Nama"],
    rows: [
      { nilai:["148820",             "Yusuf Pratama",     "Jl. Melati No. 12, Jakarta Timur", "0812-3456-7890", "yusuf.pratama@mail.com"], status:"valid" },
      { nilai:["84071073",           "Andi Saputra",      "Jl. Anggrek No. 5, Bandung",        "0813-2233-4455", "andi.saputra@mail.com"],  status:"valid" },
      { nilai:["199801152020121003", "Eko Prasetyo",      "Jl. Kenanga No. 8, Yogyakarta",     "0857-1122-3344", "eko.prasetyo@mail.com"],  status:"tanpa-perubahan" },
      { nilai:["XD222424",           "Nama Tidak Dikenal","-",                                 "-",              "-"],
        status:"ditolak", alasan:["NRP_NIP tidak ditemukan di data peserta"] }
    ],
    langkah: [
      "Unduh template dan isi mulai baris ke-3 (baris contoh dilewati).",
      "NRP/NIP wajib & harus cocok dengan data peserta terdaftar.",
      "Kolom Email diisi format email valid, No. HP diawali 08.",
      "Unggah, lalu klik Validasi untuk memeriksa tiap baris.",
      "Submit di tab Validasi untuk meneruskan ke persetujuan."
    ]
  },
  pangkat: {
    templateNama: "Template Data Riwayat Pangkat",
    kolom:      ["NRP/NIP", "Nama", "Pangkat Baru", "TMT Pangkat"],
    kolomError: ["NRP/NIP", "Nama"],
    rows: [
      { nilai:["148820", "Yusuf Pratama",      "Kolonel",                "01 Januari 2026"], status:"valid" },
      { nilai:["132170", "Kenedi",             "Komisaris Besar Polisi", "01 April 2026"],   status:"valid" },
      { nilai:["127485", "Firman Dewantoro",   "Letnan Kolonel",         "01 Juli 2026"],    status:"tanpa-perubahan" },
      { nilai:["XD222424", "Nama Tidak Dikenal","Mayor",                 "01 Agustus 2026"],
        status:"ditolak", alasan:["NRP_NIP tidak ditemukan di data peserta"] }
    ],
    langkah: [
      "Unduh template dan isi mulai baris ke-3 (baris contoh dilewati).",
      "NRP/NIP wajib & cocok dengan peserta; Pangkat Baru diisi kode dari master.",
      "TMT Pangkat diisi format tanggal DD-MM-YYYY.",
      "Unggah, lalu klik Validasi untuk memeriksa tiap baris.",
      "Submit di tab Validasi untuk meneruskan ke persetujuan."
    ]
  },
  keluarga: {
    templateNama: "Template Data Keluarga Peserta",
    kolom:      ["NRP/NIP", "NIK Anggota", "Nama Anggota", "Hubungan Keluarga", "Tanggal Lahir"],
    kolomError: ["NRP/NIP", "NIK"],
    rows: [
      { nilai:["148820",   "3271011203800001", "Siti Aminah",       "ISTRI", "12 Maret 1988"],  status:"valid" },
      { nilai:["148820",   "3271011203150002", "Raka Pratama",      "ANAK",  "05 Mei 2015"],     status:"valid" },
      { nilai:["84071073", "3273011501920001", "Rina Saputri",      "ISTRI", "15 Januari 1992"], status:"tanpa-perubahan" },
      { nilai:["XD222424", "5363563545422190", "Nama Tidak Dikenal","ANAK",  "-"],
        status:"ditolak", alasan:["NRP_NIP tidak ditemukan di data peserta"] }
    ],
    langkah: [
      "Unduh template dan isi mulai baris ke-3 (baris contoh dilewati).",
      "NRP_NIP wajib & cocok dengan peserta; NIK anggota wajib.",
      "HUBUNGAN_KELUARGA diisi kode dari master (mis. ISTRI).",
      "Unggah, lalu klik Validasi untuk memeriksa tiap baris.",
      "Submit di tab Validasi untuk meneruskan ke persetujuan."
    ]
  }
};

/* Kode prefiks nomor batch per Jenis Pemutakhiran Data (mis. PMK-KLG-...) */
const PEREMAJAAN_PREFIX = { pokok:"POK", pangkat:"PKT", keluarga:"KLG" };

/* ---------------------------------------------------------------------------
   14. PEREMAJAAN DATA — APPROVAL PEMUTAKHIRAN DATA
   Daftar batch yang sudah diunggah & disubmit dari "Pemutakhiran Data",
   menunggu (atau sudah mendapat) persetujuan. Baris baru ditambahkan ke sini
   otomatis begitu "Submit Data Batch" ditekan di modul Pemutakhiran Data.
   --------------------------------------------------------------------------- */
const DATA_PEMUTAKHIRAN_BATCH = [
  { noBatch:"PMK-KLG-20260725-225149-h7du", jenis:"keluarga", waktu:"26 Jul 2026, 05:51", jumlahBaris:1, status:"Pending" },
  { noBatch:"PMK-KLG-20260725-225021-rika", jenis:"keluarga", waktu:"26 Jul 2026, 05:50", jumlahBaris:1, status:"Pending" }
];

/* ---------------------------------------------------------------------------
   10. PENGATURAN UMUM
   --------------------------------------------------------------------------- */
const PENGATURAN = {
  namaUser:      "Adm. Wirata Atmaja",
  inisialUser:   "AW",
  role:          "User Pemerintahan / TNI / POLRI",
  namaFileBatch: "batch_kemhan_agustus2026.xlsx",
  /* Jeda simulasi status "pending" berubah jadi "terkirim" (milidetik) */
  jedaSimulasi:  6000
};
