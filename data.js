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
   Kunci "_err" menandai field bermasalah beserta pesan errornya — pesan ini
   yang dipakai untuk mengelompokkan baris di tabel "Rekap List Kotor".
   Contoh menambah error lain:  _err: { nik: "NIK harus 16 digit" }
   Kalau baris tidak punya error, hapus saja seluruh baris "_err".

   Untuk memudahkan bikin banyak baris contoh sekaligus, dipakai fungsi
   bantu buatBarisKotor() di bawah — silakan ubah angka "jumlah" atau
   "errMsg" kalau mau ganti skenario contohnya.
   --------------------------------------------------------------------------- */
function buatBarisKotor(jumlah, opsi) {
  const { prefixNama, mulai, errKey, errMsg, tglLahir, nik } = opsi;
  const baris = [];
  for (let i = 0; i < jumlah; i++) {
    const n = mulai + i;
    baris.push({
      nrp:`19930425202321${2000 + n}`, nama:`${prefixNama} ${i + 1}`,
      sts:"1", unor:"3", angkatan:"3", pangkat:"PRADA", kdPangkat:"1001",
      noSkep:`KEP/${1400 + n}/X/2023`, tglSkep:"10/26/2023", tmtSkep:"11/1/2023",
      kesatuan:"KEMENTERIAN PERTAHANAN", kdKesatuan:"638012", kdKancab:"2000",
      jnsKel: n % 2 === 0 ? "1" : "2", tmpLahir:"Tulungagung",
      tglLahir: tglLahir || "15/08/1996",
      alamat:`Perumahan Purimas Blok ${n}`, kelurahan:"Botoran", kecamatan:"Botoran",
      kota:"Kabupaten Tulungagung", propinsi:"Jawa Timur",
      noHp:`0868390${40000 + n}`, email:`peserta${n}@gmail.com`,
      nik: nik || `321794285232${1000 + n}`, npwp:`432427341${8000 + n}`,
      _err:{ [errKey]: errMsg }
    });
  }
  return baris;
}

const DATA_LIST_KOTOR = [
  ...buatBarisKotor(5, {
    prefixNama:"Peserta Muda", mulai:100, errKey:"tglLahir",
    errMsg:"Peserta dibawah umur 17 Tahun", tglLahir:"12/05/2015"
  }),
  ...buatBarisKotor(2, {
    prefixNama:"Peserta Format", mulai:200, errKey:"nik",
    errMsg:"NIK Tidak Sesuai Format", nik:"12345"
  }),
  ...buatBarisKotor(15, {
    prefixNama:"Peserta Invalid", mulai:300, errKey:"tglLahir",
    errMsg:"Tanggal Lahir Tidak Valid", tglLahir:"31/02/1995"
  })
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

/* Riwayat kepangkatan peserta dari sistem kepesertaan (dipakai di Kepangkatan
   pengajuan KPR (PUM) — ditampilkan otomatis saat KTPA cocok, hanya sebagian
   Nomor KPA di DATA_MASTER_PESERTA yang punya riwayat untuk simulasi). */
const DATA_RIWAYAT_KEPANGKATAN = {
  CD317049: [
    { pangkat:"Kopral Dua",    nomorSkep:"KEP/041/III/2008", tmt:"2008-03-01", tglSkep:"2008-02-20" },
    { pangkat:"Kopral Satu",   nomorSkep:"KEP/118/IV/2013",  tmt:"2013-04-01", tglSkep:"2013-03-18" },
    { pangkat:"Kopral Kepala", nomorSkep:"KEP/206/V/2019",   tmt:"2019-05-01", tglSkep:"2019-04-22" }
  ],
  AD500221: [
    { pangkat:"Prajurit Dua",  nomorSkep:"KEP/012/I/1999",   tmt:"1999-04-01", tglSkep:"1999-03-15" },
    { pangkat:"Prajurit Satu", nomorSkep:"KEP/089/VI/2004",  tmt:"2004-06-01", tglSkep:"2004-05-19" },
    { pangkat:"Kopral Dua",    nomorSkep:"KEP/157/II/2011",  tmt:"2011-02-01", tglSkep:"2011-01-20" }
  ],
  PL800556: [
    { pangkat:"Bhayangkara Dua",   nomorSkep:"KEP/027/VII/2009", tmt:"2009-07-01", tglSkep:"2009-06-22" },
    { pangkat:"Bhayangkara Satu",  nomorSkep:"KEP/095/VIII/2014", tmt:"2014-08-01", tglSkep:"2014-07-25" },
    { pangkat:"Brigadir Polisi Dua", nomorSkep:"KEP/183/IX/2020", tmt:"2020-09-01", tglSkep:"2020-08-24" }
  ],
  BP000111: [
    { pangkat:"Brigadir Polisi Dua",  nomorSkep:"KEP/033/V/2007",  tmt:"2007-05-01", tglSkep:"2007-04-18" },
    { pangkat:"Brigadir Polisi Satu", nomorSkep:"KEP/104/VI/2012", tmt:"2012-06-01", tglSkep:"2012-05-21" },
    { pangkat:"Brigadir Polisi Kepala", nomorSkep:"KEP/199/X/2018", tmt:"2018-10-01", tglSkep:"2018-09-14" }
  ]
};

/* Parameter Plafon PUM KPR per Angkatan & Golongan Kepangkatan */
const ANGKATAN_PLAFON = ["TNI-AD", "TNI-AL", "TNI-AU", "POLRI", "KEMHAN"];
const GOLONGAN_KEPANGKATAN = [
  "Tamtama", "Bintara", "Perwira Pertama", "Perwira Menengah", "Perwira Tinggi",
  "Golongan I/a – I/d", "Golongan II/a – II/d", "Golongan III/a – III/d",
  "Golongan IV/a – IV/c", "Golongan IV/d – IV/e"
];
const DATA_PARAMETER_PLAFON = [
  { angkatan:"TNI-AD", golongan:"Tamtama",          nominal:250000000 },
  { angkatan:"TNI-AD", golongan:"Bintara",           nominal:300000000 },
  { angkatan:"TNI-AD", golongan:"Perwira Pertama",   nominal:350000000 },
  { angkatan:"TNI-AD", golongan:"Perwira Menengah",  nominal:400000000 },
  { angkatan:"TNI-AD", golongan:"Perwira Tinggi",    nominal:450000000 },

  { angkatan:"TNI-AL", golongan:"Tamtama",          nominal:260000000 },
  { angkatan:"TNI-AL", golongan:"Bintara",           nominal:310000000 },
  { angkatan:"TNI-AL", golongan:"Perwira Pertama",   nominal:360000000 },
  { angkatan:"TNI-AL", golongan:"Perwira Menengah",  nominal:410000000 },
  { angkatan:"TNI-AL", golongan:"Perwira Tinggi",    nominal:460000000 },

  { angkatan:"TNI-AU", golongan:"Tamtama",          nominal:270000000 },
  { angkatan:"TNI-AU", golongan:"Bintara",           nominal:320000000 },
  { angkatan:"TNI-AU", golongan:"Perwira Pertama",   nominal:370000000 },
  { angkatan:"TNI-AU", golongan:"Perwira Menengah",  nominal:420000000 },
  { angkatan:"TNI-AU", golongan:"Perwira Tinggi",    nominal:470000000 },

  { angkatan:"POLRI",  golongan:"Tamtama",          nominal:240000000 },
  { angkatan:"POLRI",  golongan:"Bintara",           nominal:290000000 },
  { angkatan:"POLRI",  golongan:"Perwira Pertama",   nominal:340000000 },
  { angkatan:"POLRI",  golongan:"Perwira Menengah",  nominal:390000000 },
  { angkatan:"POLRI",  golongan:"Perwira Tinggi",    nominal:440000000 },

  { angkatan:"KEMHAN", golongan:"Tamtama",          nominal:230000000 },
  { angkatan:"KEMHAN", golongan:"Bintara",           nominal:280000000 },
  { angkatan:"KEMHAN", golongan:"Perwira Pertama",   nominal:330000000 },
  { angkatan:"KEMHAN", golongan:"Perwira Menengah",  nominal:380000000 },
  { angkatan:"KEMHAN", golongan:"Perwira Tinggi",    nominal:430000000 }
];

/* Pemetaan Pangkat (opsi dropdown "Pangkat" di Data Peserta PUM KPR) →
   Golongan Kepangkatan, dipakai untuk mencocokkan Plafon di Detail Pengajuan
   dengan Parameter Plafon (per Angkatan peserta + Golongan pangkatnya). */
const PANGKAT_TO_GOLONGAN = {
  /* PNS */
  "GOL.I/A":"Golongan I/a – I/d", "GOL.I/B":"Golongan I/a – I/d", "GOL.I/C":"Golongan I/a – I/d", "GOL.I/D":"Golongan I/a – I/d",
  "GOL.II/A":"Golongan II/a – II/d", "GOL.II/B":"Golongan II/a – II/d", "GOL.II/C":"Golongan II/a – II/d", "GOL.II/D":"Golongan II/a – II/d",
  "GOL.III/A":"Golongan III/a – III/d", "GOL.III/B":"Golongan III/a – III/d", "GOL.III/C":"Golongan III/a – III/d", "GOL.III/D":"Golongan III/a – III/d",
  "GOL.IV/A":"Golongan IV/a – IV/c", "GOL.IV/B":"Golongan IV/a – IV/c", "GOL.IV/C":"Golongan IV/a – IV/c",
  "GOL.IV/D":"Golongan IV/d – IV/e", "GOL.IV/E":"Golongan IV/d – IV/e",

  /* TNI-AD / TNI-AU: Tamtama & Bintara */
  "PRADA":"Tamtama", "PRATU":"Tamtama", "PRAKA":"Tamtama", "KOPDA":"Tamtama", "KOPTU":"Tamtama", "KOPKA":"Tamtama",
  "SERDA":"Bintara", "SERTU":"Bintara", "SERKA":"Bintara", "SERMA":"Bintara", "PELDA":"Bintara", "PELTU":"Bintara", "CAPA":"Bintara",
  /* TNI-AD/AL/AU: Pama & Pamen (nama pangkat sama di ketiga Angkatan) */
  "LETDA":"Perwira Pertama", "LETTU":"Perwira Pertama", "KAPTEN":"Perwira Pertama",
  "MAYOR":"Perwira Menengah", "LETKOL":"Perwira Menengah", "KOLONEL":"Perwira Menengah",
  /* TNI-AD Pati */
  "BRIGJEN TNI":"Perwira Tinggi", "MAYJEN TNI":"Perwira Tinggi", "LETJEN TNI":"Perwira Tinggi", "JENDERAL TNI":"Perwira Tinggi",
  /* TNI-AL: Tamtama & Pati */
  "KELASI DUA":"Tamtama", "KELASI SATU":"Tamtama", "KELASI KEPALA":"Tamtama",
  "LAKSMA TNI":"Perwira Tinggi", "LAKSDA TNI":"Perwira Tinggi", "LAKSDYA TNI":"Perwira Tinggi", "LAKSAMANA TNI":"Perwira Tinggi",
  /* TNI-AU: Pati */
  "MARSMA TNI":"Perwira Tinggi", "MARSDA TNI":"Perwira Tinggi", "MARSDYA TNI":"Perwira Tinggi", "MARSEKAL TNI":"Perwira Tinggi",

  /* POLRI */
  "BHARADA":"Tamtama", "BHARATU":"Tamtama", "BHARAKA":"Tamtama", "ABRIPDA":"Tamtama", "ABRIPTU":"Tamtama", "ABRIP":"Tamtama",
  "BRIPDA":"Bintara", "BRIPTU":"Bintara", "BRIPKA":"Bintara", "BRIGADIR":"Bintara", "AIPDA":"Bintara", "AIPTU":"Bintara",
  "IPDA":"Perwira Pertama", "IPTU":"Perwira Pertama", "AKP":"Perwira Pertama",
  "KOMPOL":"Perwira Menengah", "AKBP":"Perwira Menengah", "KOMBES POL":"Perwira Menengah",
  "BRIGJEN POL":"Perwira Tinggi", "IRJEN POL":"Perwira Tinggi", "KOMJEN POL":"Perwira Tinggi", "JENDERAL POL":"Perwira Tinggi"

  /* PPPK (GOL.I–GOL.XVII) sengaja tidak dipetakan — sistem golongannya
     berbeda dari 10 Golongan Kepangkatan di Parameter Plafon, jadi Plafon
     untuk Pangkat PPPK jatuh kembali ke plafon bawaan peserta. */
};

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
    { label:"Formulir Pengajuan" },
    { label:"Surat Pernyataan Pengajuan" },
    { label:"Fotocopy KPA" },
    { label:"Fotocopy Kartu Keluarga (KK)" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy Buku Nikah", kondisional:true }
  ],

  "Pembelian Rumah Secara Mandiri": [
    { label:"Formulir Pengajuan" },
    { label:"Surat Pernyataan Pengajuan" },
    { label:"Fotocopy KPA" },
    { label:"Fotocopy Kartu Keluarga (KK)" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy Buku Nikah", kondisional:true },
    { label:"Fotocopy Surat Kesepakatan Jual Beli", kondisional:true }
  ],

  "Membangun Rumah": [
    { label:"Formulir Pengajuan" },
    { label:"Surat Pernyataan Pengajuan" },
    { label:"Fotocopy KPA" },
    { label:"Fotocopy Kartu Keluarga (KK)" },
    { label:"Fotocopy KTP" },
    { label:"Fotocopy Buku Nikah", kondisional:true },
    { label:"Fotocopy bukti kepemilikan hak atas tanah" }
  ]
};
/* "Surat Pernyataan Kesanggupan" tidak ada di daftar statis di atas — field
   ini ditambahkan secara dinamis (lihat pf5Docs() di app.js) hanya untuk
   peserta Polri dengan Masa Kerja Dinas < 2 tahun, dan bersifat wajib. */


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
      { nilai:["XD222424", "Nama Tidak Dikenal","Mayor",                 "1 Agustus 2026"],
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
   15. PENDAFTARAN PESERTA BARU — data bersama antar sub modul Perorangan,
   Upload (Kolektif), Verifikasi Upload, dan Approval Pendaftaran Peserta Baru.

   DATA_PENDAFTARAN_PERORANGAN → disubmit dari sub modul Perorangan (Step 4),
   langsung masuk antrean Approval (approvalStatus "Tertunda").

   DATA_UPLOAD_BATCH → disubmit dari sub modul Upload (Kolektif, Step 3
   Pratinjau dan Simpan). Satu field "status" dipakai bersama di 3 halaman:
   "Belum Terverifikasi" (awal) → "Tertunda" (begitu "Setujui Verifikasi"
   ditekan di Verifikasi Upload — otomatis masuk antrean Approval) →
   "Diterima"/"Ditolak" (setelah diproses di Approval). Halaman Verifikasi
   Upload menampilkannya sebagai "Lolos Verifikasi" untuk status apa pun
   selain "Belum Terverifikasi" (karena dari sudut pandang verifikasi,
   yang penting sudah lolos atau belum — proses approval selanjutnya
   bukan urusan halaman ini).
   --------------------------------------------------------------------------- */
const DATA_PENDAFTARAN_PERORANGAN = [
  {
    id: 1,
    tglPengajuan: "5 Agustus 2026",
    kesatuanPengaju: "PUSKERSIN",
    nomorBatch: "-",
    nomorAgenda: "AG-20260805-0001",
    jenis: "Perorangan",
    approvalStatus: "Tertunda",
    catatanApproval: "",
    dataPengajuan: {
      jenis:"Perorangan", nomorSurat:"B/210/VIII/2026",
      instansi:"PUSKERSIN", tglSurat:"04 Agustus 2026"
    },
    dataPeserta: {
      nama:"Rahmat Hidayat", nrp:"199005152012011003", nik:"3271051505900003", npwp:"56.789.012.3-004.000",
      jk:"Laki-laki", tglLahir:"15 Mei 1990", tmpLahir:"Bandung",
      status:"Prajurit", angkatan:"TNI AD", unor:"Mabes TNI AD", uker:"- KOREM 084/BJ", pangkat:"Kapten",
      tmt:"01 Januari 2021", nomorSkep:"SKEP/210/I/2021", tglSkep:"01 Januari 2021",
      alamat:"Jl. Merdeka No. 10", rt:"03", rw:"02",
      kelurahan:"Kemanggisan, Palmerah, Jakarta Barat, DKI Jakarta",
      kodepos:"11480", telp:"081234567810", email:"rahmat.hidayat@mail.com", kancab:"Kancab Jakarta Barat"
    },
    berkas: [
      { label:"KTP", file:"ktp-rahmat.jpg" },
      { label:"Surat Pengangkatan Pertama", file:"sk-pengangkatan-rahmat.pdf" },
      { label:"Surat Pengantar", file:null }
    ]
  },
  {
    id: 2,
    tglPengajuan: "1 Agustus 2026",
    kesatuanPengaju: "Mabes Polri",
    nomorBatch: "-",
    nomorAgenda: "AG-20260801-0002",
    jenis: "Perorangan",
    approvalStatus: "Ditolak",
    catatanApproval: "Berkas SKEP Pengangkatan Pertama tidak terbaca jelas, harap unggah ulang.",
    dataPengajuan: {
      jenis:"Perorangan", nomorSurat:"B/188/VIII/2026",
      instansi:"Mabes Polri", tglSurat:"31 Juli 2026"
    },
    dataPeserta: {
      nama:"Siti Rahayu", nrp:"88034521", nik:"3273016006920004", npwp:"",
      jk:"Perempuan", tglLahir:"20 Juni 1992", tmpLahir:"Surabaya",
      status:"Prajurit", angkatan:"Polri", unor:"Mabes Polri", uker:"- KODIM 0827 REM 084/BJ", pangkat:"Ajun Komisaris Polisi",
      tmt:"01 Maret 2019", nomorSkep:"SKEP/95/III/2019", tglSkep:"01 Maret 2019",
      alamat:"Jl. Anggrek No. 5", rt:"01", rw:"04",
      kelurahan:"Rungkut, Rungkut, Kota Surabaya, Jawa Timur",
      kodepos:"60293", telp:"081298765432", email:"siti.rahayu@mail.com", kancab:"Kancab Surabaya"
    },
    berkas: [
      { label:"KTP", file:"ktp-siti.jpg" },
      { label:"Surat Pengangkatan Pertama", file:null },
      { label:"Surat Pengantar", file:"surat-pengantar-siti.pdf" }
    ]
  }
];

const DATA_UPLOAD_BATCH = [
  {
    id: 1,
    tglPengajuan: "6 Agustus 2026",
    kesatuanPengaju: "Mabes TNI",
    nomorBatch: "B-UPLOAD/2026/08060001",
    nomorAgenda: "AG-20260806-0003",
    status: "Belum Terverifikasi",
    catatanApproval: "",
    dataPengajuan: {
      jenis:"Kolektif", nomorSurat:"B/220/VIII/2026",
      instansi:"Mabes TNI", tglSurat:"5 Agustus 2026"
    },
    peserta: [
      { nrp:"199203102015031001", nama:"Andika Pratama", sts:"1", unor:"3", angkatan:"3",
        pangkat:"LETDA", kdPangkat:"3760", noSkep:"KEP/2001/VIII/2026", tglSkep:"05/08/2026", tmtSkep:"1/9/2026",
        kesatuan:"MABES TNI", kdKesatuan:"100001", kdKancab:"1000",
        jnsKel:"1", tmpLahir:"Semarang", tglLahir:"10/03/1992",
        alamat:"Jl. Diponegoro No. 20", kelurahan:"Botoran", kecamatan:"Botoran",
        kota:"Kabupaten Tulungagung", propinsi:"Jawa Timur",
        noHp:"081211122233", email:"andika.pratama@mail.com", nik:"3221031003920001", npwp:"12.987.654.3-100.000",
        berkas:[
          { label:"KTP", file:"ktp-andika.jpg" },
          { label:"Surat Pengangkatan Pertama", file:"sk-pengangkatan-andika.pdf" },
          { label:"Surat Pengantar", file:null }
        ] },
      { nrp:"199407222016022002", nama:"Yulia Wardhani", sts:"1", unor:"3", angkatan:"3",
        pangkat:"LETDA", kdPangkat:"3760", noSkep:"KEP/2002/VIII/2026", tglSkep:"05/08/2026", tmtSkep:"1/9/2026",
        kesatuan:"MABES TNI", kdKesatuan:"100001", kdKancab:"1000",
        jnsKel:"2", tmpLahir:"Yogyakarta", tglLahir:"22/07/1994",
        alamat:"Jl. Kaliurang No. 8", kelurahan:"Ngaglik", kecamatan:"Ngaglik",
        kota:"Sleman", propinsi:"D.I. Yogyakarta",
        noHp:"081233344455", email:"yulia.wardhani@mail.com", nik:"3404026207940002", npwp:"23.876.543.2-200.000",
        berkas:[
          { label:"KTP", file:"ktp-yulia.jpg" },
          { label:"Surat Pengangkatan Pertama", file:"sk-pengangkatan-yulia.pdf" },
          { label:"Surat Pengantar", file:"surat-pengantar-yulia.pdf" }
        ] }
    ]
  },
  {
    id: 2,
    tglPengajuan: "30 Juli 2026",
    kesatuanPengaju: "Mabes Polri",
    nomorBatch: "B-UPLOAD/2026/07300002",
    nomorAgenda: "AG-20260730-0004",
    status: "Tertunda",
    catatanApproval: "",
    dataPengajuan: {
      jenis:"Kolektif", nomorSurat:"B/198/VII/2026",
      instansi:"Mabes Polri", tglSurat:"29 Juli 2026"
    },
    peserta: [
      { nrp:"87056781", nama:"Deni Kurniawan", sts:"1", unor:"3", angkatan:"3",
        pangkat:"IPDA", kdPangkat:"2870", noSkep:"KEP/1870/VII/2026", tglSkep:"28/07/2026", tmtSkep:"1/8/2026",
        kesatuan:"MABES POLRI", kdKesatuan:"200002", kdKancab:"2000",
        jnsKel:"1", tmpLahir:"Medan", tglLahir:"12/11/1987",
        alamat:"Jl. Sisingamangaraja No. 15", kelurahan:"Cikokol", kecamatan:"Tangerang",
        kota:"Kota Tangerang", propinsi:"Banten",
        noHp:"081344455566", email:"deni.kurniawan@mail.com", nik:"3671121211870003", npwp:"34.765.432.1-300.000",
        berkas:[
          { label:"KTP", file:"ktp-deni.jpg" },
          { label:"Surat Pengangkatan Pertama", file:"sk-pengangkatan-deni.pdf" },
          { label:"Surat Pengantar", file:"surat-pengantar-deni.pdf" }
        ] },
      { nrp:"90067892", nama:"Maya Puspita", sts:"1", unor:"3", angkatan:"3",
        pangkat:"IPDA", kdPangkat:"2870", noSkep:"KEP/1871/VII/2026", tglSkep:"28/07/2026", tmtSkep:"1/8/2026",
        kesatuan:"MABES POLRI", kdKesatuan:"200002", kdKancab:"2000",
        jnsKel:"2", tmpLahir:"Palembang", tglLahir:"03/09/1990",
        alamat:"Jl. Sudirman No. 33", kelurahan:"Sukajadi", kecamatan:"Sukajadi",
        kota:"Kota Bandung", propinsi:"Jawa Barat",
        noHp:"081355566677", email:"maya.puspita@mail.com", nik:"3273030309900004", npwp:"45.654.321.0-400.000",
        berkas:[
          { label:"KTP", file:"ktp-maya.jpg" },
          { label:"Surat Pengangkatan Pertama", file:null },
          { label:"Surat Pengantar", file:"surat-pengantar-maya.pdf" }
        ] }
    ]
  },
  {
    id: 3,
    tglPengajuan: "20 Juli 2026",
    kesatuanPengaju: "Kementerian Pertahanan",
    nomorBatch: "B-UPLOAD/2026/07200003",
    nomorAgenda: "AG-20260720-0005",
    status: "Diterima",
    catatanApproval: "Data lengkap dan sesuai, disetujui.",
    tglApproval: "21 Juli 2026",
    dataPengajuan: {
      jenis:"Kolektif", nomorSurat:"B/172/VII/2026",
      instansi:"Kementerian Pertahanan", tglSurat:"18 Juli 2026"
    },
    peserta: [
      { nrp:"199501012018121001", nama:"Fajar Ramadhan", sts:"1", unor:"3", angkatan:"3",
        pangkat:"LETDA", kdPangkat:"3760", noSkep:"KEP/1500/VII/2026", tglSkep:"18/07/2026", tmtSkep:"1/8/2026",
        kesatuan:"KEMENTERIAN PERTAHANAN", kdKesatuan:"638012", kdKancab:"2000",
        jnsKel:"1", tmpLahir:"Makassar", tglLahir:"01/01/1995",
        alamat:"Jl. Sam Ratulangi No. 7", kelurahan:"Cibubur", kecamatan:"Ciracas",
        kota:"Jakarta Timur", propinsi:"DKI Jakarta",
        noHp:"081366677788", email:"fajar.ramadhan@mail.com", nik:"3175010101950005", npwp:"56.543.210.9-500.000",
        berkas:[
          { label:"KTP", file:"ktp-fajar.jpg" },
          { label:"Surat Pengangkatan Pertama", file:"sk-pengangkatan-fajar.pdf" },
          { label:"Surat Pengantar", file:"surat-pengantar-fajar.pdf" }
        ] }
    ]
  }
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

/* ---------------------------------------------------------------------------
   16. PENGELOLAAN IURAN PREMI THT, JKK, DAN JKm — daftar peserta aktif untuk
   simulasi perhitungan premi (SIMPRE). Baris dengan ktpa/pangkat/kesatuan
   kosong merepresentasikan data peserta yang belum lengkap tersinkron dari
   Pengelolaan Data Peserta — tombol "Hitung Premi"-nya nonaktif.
   --------------------------------------------------------------------------- */
const DATA_IURAN_PREMI_PESERTA = [
  { ktpa:"ED424185", nrp:"74020098",   nik:"3174012702740003", nama:"Mulyadi",
    pangkat:"AIPTU",    kesatuan:"POLRES METRO JAKSEL",   unor:"POLRI",
    tglLahir:"1974-02-07", tmtMasuk:"1993-11-27", tglPensiun:"2032-03-01", gaji:4965156 },
  { ktpa:"EY116960", nrp:"K10004501", nik:"3271025605850002", nama:"Betty Mewahani Nst",
    pangkat:"GOL.II/A", kesatuan:"POLRI",                 unor:"POLRI",
    tglLahir:"1985-05-16", tmtMasuk:"2008-03-01", tglPensiun:"2043-05-16", gaji:5210000 },
  { ktpa:"CE338860", nrp:"99916",     nik:"3671011203800004", nama:"Muhamad Arifin",
    pangkat:"KOPKA",    kesatuan:"KODIKMAR KOBANGDIKAL",  unor:"TNI AL",
    tglLahir:"1980-03-12", tmtMasuk:"2002-07-15", tglPensiun:"2038-03-12", gaji:4550000 },
  { ktpa:"",         nrp:"5354",      nik:"",                 nama:"Slamet Riyanto",
    pangkat:"",         kesatuan:"",                       unor:"",
    tglLahir:"", tmtMasuk:"", tglPensiun:"", gaji:0 },
  { ktpa:"",         nrp:"1234",      nik:"",                 nama:"Joni Hermawan",
    pangkat:"",         kesatuan:"",                       unor:"",
    tglLahir:"", tmtMasuk:"", tglPensiun:"", gaji:0 },
  { ktpa:"AD500221", nrp:"142376",    nik:"3273010512650005", nama:"Bambang Setiawan",
    pangkat:"SERKA",    kesatuan:"MABES TNI AD",           unor:"TNI AD",
    tglLahir:"1978-12-05", tmtMasuk:"1999-04-01", tglPensiun:"2036-12-05", gaji:4380000 },
  { ktpa:"AL600334", nrp:"156234",    nik:"3273025010830006", nama:"Dewi Anggraini",
    pangkat:"PENDA TK.I / III-B", kesatuan:"KEMENTERIAN PERTAHANAN", unor:"KEMHAN",
    tglLahir:"1983-02-10", tmtMasuk:"2010-12-01", tglPensiun:"2041-02-10", gaji:5620000 },
  { ktpa:"PL800556", nrp:"87023456",  nik:"3671022307820007", nama:"Rudi Hartono",
    pangkat:"SERTU",    kesatuan:"MABES TNI AU",           unor:"TNI AU",
    tglLahir:"1982-07-23", tmtMasuk:"2003-09-01", tglPensiun:"2040-07-23", gaji:4790000 }
];

/* ---------------------------------------------------------------------------
   17. HOME — Notifikasi & Pengumuman di halaman portal (Dashboard)
   Notifikasi.tingkat: "Kritis" | "High" | "Sedang"
   Pengumuman.tag: [{label, jenis:"kebijakan"|"baru"|"info"}]
   --------------------------------------------------------------------------- */
const DATA_HOME_NOTIFIKASI = [
  { judul:"Persetujuan Klaim JKK",           id:"FLKK-2025-00871",  lokasi:"KC Bandung",       modul:"Modul Klaim JKK",                    tanggal:"23/06/2026", tingkat:"Kritis" },
  { judul:"Verifikasi e-SPTB Peserta",       id:"SPTB-2025-04412",  lokasi:"KC Jakarta Pusat", modul:"Modul e-SPTB",                       tanggal:"22/06/2026", tingkat:"Kritis" },
  { judul:"Input LKPP Cabang",               id:"LKPP-2025-KC03",   lokasi:"KC Surabaya",      modul:"Modul LKPP Cabang",                  tanggal:"21/06/2026", tingkat:"High" },
  { judul:"Validasi Data Mitra Bayar",       id:"MITRA-2025-0071",  lokasi:"KC Medan",         modul:"Modul Mitra Bayar",                  tanggal:"20/06/2026", tingkat:"High" },
  { judul:"Review KKA Audit Internal",       id:"AUDIT-2025-0093",  lokasi:"KC Bandung",       modul:"Modul Audit Internal",               tanggal:"19/06/2026", tingkat:"High" },
  { judul:"Approval Pengajuan KPR (PUM)",    id:"PUM-2026-00231",   lokasi:"KC Semarang",      modul:"Modul KPR (PUM)",                    tanggal:"18/06/2026", tingkat:"Sedang" },
  { judul:"Verifikasi Upload Pendaftaran Peserta Baru", id:"BATCH-2026-0087", lokasi:"KC Yogyakarta", modul:"Modul Pendaftaran Peserta Baru", tanggal:"17/06/2026", tingkat:"Sedang" }
];

const DATA_HOME_PENGUMUMAN = [
  { tag:[{label:"KEBIJAKAN BARU", jenis:"kebijakan"}, {label:"BARU", jenis:"baru"}], dot:"kebijakan",
    judul:"Pembaruan Ketentuan Batas Plafon Kredit Pensiun 2026",
    body:"Menunjuk Surat Edaran Direksi SE-24/DIR/2026 mengenai penyesuaian plafon kredit pensiun bulanan sesuai indeks kelayakan…",
    divisi:"Divisi Regulasi", tanggal:"23 Juni 2026" },
  { tag:[{label:"KEBIJAKAN BARU", jenis:"kebijakan"}], dot:"kebijakan",
    judul:"Revisi Prosedur Klaim JKm – Berlaku Agustus 2026",
    body:"Revisi alur proses pengajuan berkas klaim Jaminan Kematian untuk mempercepat Service Level Agreement (SLA)…",
    divisi:"Divisi Pelayanan", tanggal:"20 Juni 2026" },
  { tag:[{label:"INFO PENTING SISTEM", jenis:"info"}, {label:"BARU", jenis:"baru"}], dot:"info",
    judul:"Scheduled Maintenance – 27 Juni 2026 Pukul 23.00–03.00 WIB",
    body:"Pemeliharaan terjadwal server database kepesertaan YANDU NG guna pembersihan log transaksional…",
    divisi:"Divisi IT", tanggal:"24 Juni 2026" }
];

/* ---------------------------------------------------------------------------
   18. DASHBOARD E-DOSIR — Manajemen Dokumen Peserta (E-Dosir)
   bulan: [Jan..Des] jumlah dokumen masuk per bulan, tahun berjalan.
   real: pembanding data real di cabang (hanya diisi utk 5 cabang dengan
   capaian terendah — dipakai panel "5 Capaian Terendah"; cabang lain null
   karena rincian real per-cabang tidak ditampilkan di tabel manapun).
   --------------------------------------------------------------------------- */
const EDOSIR_DATA_REAL_NASIONAL = 441442;
const DATA_EDOSIR_CABANG = [
  { nama:"AMBON",         saldoAwal:3945,  bulan:[138,11,51,135,35,50,68,52,0,0,0,0] },
  { nama:"BALIKPAPAN",    saldoAwal:21352, bulan:[27,17,2,218,268,83,308,1045,0,0,0,0] },
  { nama:"BANDA ACEH",    saldoAwal:4870,  bulan:[22,6,6,58,45,103,1354,871,0,0,0,0] },
  { nama:"BANDUNG",       saldoAwal:77320, bulan:[524,721,551,442,945,2095,4250,620,0,0,0,0] },
  { nama:"BANJARMASIN",   saldoAwal:7395,  bulan:[4,35,32,35,114,3,372,68,0,0,0,0] },
  { nama:"BATAM",         saldoAwal:2088,  bulan:[42,0,0,69,3,147,352,76,0,0,0,0], real:2572 },
  { nama:"BENGKULU",      saldoAwal:1317,  bulan:[4,6,21,27,49,60,548,57,0,0,0,0] },
  { nama:"CIREBON",       saldoAwal:6516,  bulan:[5,61,183,213,141,132,165,82,0,0,0,0] },
  { nama:"DENPASAR",      saldoAwal:13013, bulan:[234,171,125,174,199,194,282,195,0,0,0,0] },
  { nama:"JAKARTA",       saldoAwal:74573, bulan:[1285,1084,1455,3095,1858,2276,2192,845,0,0,0,0] },
  { nama:"JAYAPURA",      saldoAwal:6459,  bulan:[64,132,5,32,109,41,343,162,0,0,0,0] },
  { nama:"KENDARI",       saldoAwal:422,   bulan:[195,80,4,4,204,141,2097,676,0,0,0,0] },
  { nama:"KUPANG",        saldoAwal:3188,  bulan:[49,70,43,99,71,136,161,151,0,0,0,0] },
  { nama:"LAMPUNG",       saldoAwal:6467,  bulan:[89,64,42,1,1,82,76,25,0,0,0,0], real:6575 },
  { nama:"LHOKSEUMAWE",   saldoAwal:1534,  bulan:[0,0,0,0,1,749,190,1617,0,0,0,0] },
  { nama:"MADIUN",        saldoAwal:19412, bulan:[1127,940,206,1299,279,540,848,298,0,0,0,0] },
  { nama:"MAKASSAR",      saldoAwal:24755, bulan:[80,347,23,115,218,339,992,586,0,0,0,0] },
  { nama:"MALANG",        saldoAwal:25316, bulan:[182,150,260,242,557,1075,1950,1086,0,0,0,0] },
  { nama:"MANADO",        saldoAwal:3915,  bulan:[144,133,77,238,162,399,296,130,0,0,0,0] },
  { nama:"MATARAM",       saldoAwal:2101,  bulan:[9,72,34,71,38,47,64,247,0,0,0,0] },
  { nama:"MEDAN",         saldoAwal:18070, bulan:[19,18,17,26,241,2828,3076,1612,0,0,0,0] },
  { nama:"PADANG",        saldoAwal:7413,  bulan:[203,203,334,202,129,200,252,96,0,0,0,0] },
  { nama:"PALANGKARAYA",  saldoAwal:2302,  bulan:[38,50,31,43,80,48,325,44,0,0,0,0] },
  { nama:"PALEMBANG",     saldoAwal:20535, bulan:[174,150,101,137,184,466,313,948,0,0,0,0], real:21929 },
  { nama:"PALU",          saldoAwal:3424,  bulan:[99,36,1,9,22,32,351,773,0,0,0,0] },
  { nama:"PEKANBARU",     saldoAwal:5551,  bulan:[6,824,417,19,15,19,641,677,0,0,0,0] },
  { nama:"PONTIANAK",     saldoAwal:8593,  bulan:[86,66,72,119,108,241,304,46,0,0,0,0], real:9058 },
  { nama:"SEMARANG",      saldoAwal:44126, bulan:[1015,426,209,467,577,653,1258,567,0,0,0,0] },
  { nama:"SERANG",        saldoAwal:3946,  bulan:[80,75,78,245,250,304,476,193,0,0,0,0] },
  { nama:"SORONG",        saldoAwal:1364,  bulan:[36,5,9,13,18,42,88,63,0,0,0,0] },
  { nama:"SURABAYA",      saldoAwal:50314, bulan:[93,995,45,908,340,1861,2245,1631,0,0,0,0] },
  { nama:"TERNATE",       saldoAwal:1761,  bulan:[3,1,0,4,1,285,221,58,0,0,0,0], real:2208 },
  { nama:"YOGYAKARTA",    saldoAwal:14782, bulan:[457,746,265,82,864,2224,2104,968,0,0,0,0] }
];

/* ---------------------------------------------------------------------------
   19. MONITORING SPTB — Pengelolaan Surat Pernyataan Tanda Bukti Diri
   status: "Sudah SPTB" | "Belum SPTB"
   sptbTerakhir: null jika peserta belum pernah SPTB (kolom tampil "—")
   --------------------------------------------------------------------------- */
const SPTB_CABANG = ["KC Jakarta Pusat","KC Jakarta Selatan","KC Bandung","KC Surabaya","KC Medan",
  "KC Makassar","KC Yogyakarta","KC Denpasar","KC Semarang","KC Palembang","KC Balikpapan","KC Manado","KC Padang","KC Pekanbaru"];
const SPTB_MITRA = ["BRI","BNI","Mandiri","BTN"];
const SPTB_JENIS_PENSIUN = ["Pensiun Sendiri","Pensiun Waris","Tunjangan Orang Tua","Tunjangan Yatim Piatu"];

const DATA_SPTB = [
  { cabang:"KC Jakarta Pusat",   nopens:"0501234567", nrpNip:"NRP-19830011", nama:"Budi Santoso",       tglLahir:"1958-03-12", mitra:"BRI",     jenisPensiun:"Pensiun Sendiri",       unor:"KODAM JAYA",         sptbTerakhir:"2024-01-15", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Jakarta Pusat",   nopens:"0501234568", nrpNip:"NRP-19840022", nama:"Siti Rahayu",        tglLahir:"1960-07-05", mitra:"BNI",     jenisPensiun:"Pensiun Waris",         unor:"POLDA METRO",        sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Bandung",         nopens:"0501234569", nrpNip:"NIP-19620811", nama:"Ahmad Hidayat",      tglLahir:"1962-08-18", mitra:"Mandiri", jenisPensiun:"Pensiun Sendiri",       unor:"KODIKLAT AD",        sptbTerakhir:"2023-12-20", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Surabaya",        nopens:"0501234570", nrpNip:"NRP-19810033", nama:"Suprianto",          tglLahir:"1957-11-22", mitra:"BRI",     jenisPensiun:"Pensiun Sendiri",       unor:"LANTAMAL V",         sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Medan",           nopens:"0501234571", nrpNip:"NRP-19800044", nama:"Hotman Sihombing",   tglLahir:"1959-10-03", mitra:"BTN",     jenisPensiun:"Tunjangan Orang Tua",   unor:"KODAM I/BB",         sptbTerakhir:"2024-02-10", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Makassar",        nopens:"0501234572", nrpNip:"NRP-19650422", nama:"Andi Mappanyukki",   tglLahir:"1965-04-14", mitra:"BRI",     jenisPensiun:"Pensiun Waris",         unor:"POLDA SULSEL",       sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Yogyakarta",      nopens:"0501234573", nrpNip:"NRP-19820055", nama:"Sri Wahyuni",        tglLahir:"1961-12-29", mitra:"BNI",     jenisPensiun:"Tunjangan Yatim Piatu", unor:"LANUD ADISUTJIPTO",  sptbTerakhir:"2024-03-05", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Jakarta Selatan", nopens:"0501234574", nrpNip:"NRP-19781234", nama:"Wahyu Setiawan",     tglLahir:"1963-05-09", mitra:"Mandiri", jenisPensiun:"Pensiun Sendiri",       unor:"MABES TNI",          sptbTerakhir:"2024-04-11", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Denpasar",        nopens:"0501234575", nrpNip:"NRP-19701122", nama:"Made Wirawan",       tglLahir:"1966-02-17", mitra:"BTN",     jenisPensiun:"Pensiun Sendiri",       unor:"POLDA BALI",         sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Semarang",        nopens:"0501234576", nrpNip:"NIP-19590733", nama:"Endang Kartini",     tglLahir:"1964-09-25", mitra:"BRI",     jenisPensiun:"Pensiun Waris",         unor:"KODIM 0733",         sptbTerakhir:"2024-01-30", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Palembang",       nopens:"0501234577", nrpNip:"NRP-19881245", nama:"Rudi Alamsyah",      tglLahir:"1968-06-01", mitra:"BNI",     jenisPensiun:"Pensiun Sendiri",       unor:"POLDA SUMSEL",       sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Balikpapan",      nopens:"0501234578", nrpNip:"NRP-19770812", nama:"Muhammad Yusuf",     tglLahir:"1969-03-19", mitra:"Mandiri", jenisPensiun:"Tunjangan Orang Tua",   unor:"LANUD BALIKPAPAN",   sptbTerakhir:"2024-05-08", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Manado",          nopens:"0501234579", nrpNip:"NRP-19631204", nama:"Christine Rumondor", tglLahir:"1970-08-14", mitra:"BTN",     jenisPensiun:"Pensiun Waris",         unor:"KODAM XIII/MDK",     sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" },
  { cabang:"KC Padang",          nopens:"0501234580", nrpNip:"NIP-19551109", nama:"Zainal Abidin",      tglLahir:"1955-11-09", mitra:"BRI",     jenisPensiun:"Pensiun Sendiri",       unor:"KODIM 0312",         sptbTerakhir:"2023-11-19", payTerakhir:"2026-06-01", status:"Sudah SPTB" },
  { cabang:"KC Pekanbaru",       nopens:"0501234581", nrpNip:"NRP-19850317", nama:"Rina Marlina",       tglLahir:"1972-01-28", mitra:"BNI",     jenisPensiun:"Tunjangan Yatim Piatu", unor:"POLDA RIAU",         sptbTerakhir:null,         payTerakhir:"2026-06-01", status:"Belum SPTB" }
];
