/* =============================================================================
   FLAGGING MITRA BAYAR — DATA CONTOH
   Semua data prototipe untuk aplikasi Flagging Mitra Bayar, dikelompokkan
   bernomor. Aplikasi ini dipisah dari prototipe YANDU NextGen; datanya berdiri
   sendiri supaya folder ini bisa dijalankan tanpa berkas dari luar.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   1. MITRA BAYAR — daftar bank/POS penyalur
   --------------------------------------------------------------------------- */
const DATA_MITRA_BAYAR = [
  "Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BTN", "Bank BCA",
  "Bank Syariah Indonesia (BSI)", "Bank DKI", "Bank Jabar Banten (BJB)",
  "Bank Jatim", "Bank Sumut", "Bank Nagari", "Bank Riau Kepri", "Bank Kalbar",
  "PT Pos Indonesia"
];


/* ---------------------------------------------------------------------------
   2. CHECK DAN BOOKING — INDIVIDU
   Data dummy yang tampil begitu tombol "Search" ditekan. Jenis peserta tidak
   lagi dipilih manual — ditentukan dari nomor KPA yang dicari, jadi satu KPA
   hanya boleh muncul di salah satu dari tiga daftar di bawah.
   --------------------------------------------------------------------------- */

/* Aturan validasi yang dijalankan begitu nomor KPA ditemukan. Semuanya
   menghentikan proses — kartu Informasi Peserta tidak ditampilkan; `tone` dan
   `judul` hanya mengatur nada pop-up. Kalimatnya disambung di belakang
   "Nomor KPA <nnn>" pada pop-up. Validasi flagging mitra tidak ada di sini
   karena kalimatnya perlu menyebut nama mitranya. */
const FCBI_VALIDASI = {
  meninggal: { tone:"warn",
    judul:"Perhatian",
    pesan:"terdaftar sebagai Peserta meninggal dunia tetapi belum mengajukan klaim meninggal dunia." },
  ortuYatim: { tone:"bad",
    judul:"Validasi tidak lolos",
    pesan:"terdaftar sebagai Peserta dengan jenis pensiun orang tua dan yatim/piatu — tidak bisa melanjutkan ke Pengajuan Cek Kredit Pinjaman Mitra." },
  usia75: { tone:"bad",
    judul:"Validasi tidak lolos",
    pesan:"terdaftar sebagai Peserta dengan usia di atas 75 tahun — tidak bisa melanjutkan ke Pengajuan Cek Kredit Pinjaman Mitra." },
  ptdh: { tone:"bad",
    judul:"Validasi tidak lolos",
    pesan:"terdaftar memiliki status PTDH (Pemberhentian Tidak Dengan Hormat) — tidak bisa melanjutkan ke Pengajuan Cek Kredit Pinjaman Mitra." }
};

/* Keterangan kolom tambahan pada ketiga daftar di bawah:
   - mitra          : mitra bayar peserta, ikut terisi otomatis di form.
   - gaji           : nominal gaji/penghasilan dasar perhitungan pinjaman.
   - tarifDitentukan: false = parameter tarif untuk peserta ini belum ada,
                      sehingga field Gaji tampil kosong.
   - nrp, tglLahir  : ikut dibawa ke antrean Persetujuan saat Booking ditekan.
   - validasi       : kunci ke FCBI_VALIDASI di atas.
   - flaggingMitra  : nama mitra tempat peserta sudah ter-flagging. */

/* a. Peserta aktif */
const DATA_FLAGGING_AKTIF = [
  { kpa:"CD400871", nrp:"148820",   tglLahir:"1985-05-12", nama:"Yusuf Pratama",  mitra:"Bank BRI",          gaji:7250000, tarifDitentukan:true  },
  { kpa:"CD317049", nrp:"151204",   tglLahir:"1987-09-03", nama:"Intan M. Sari",  mitra:"Bank BNI",          gaji:6480000, tarifDitentukan:false },
  { kpa:"CD883155", nrp:"163077",   tglLahir:"1984-02-19", nama:"Hendra Wijaya",  mitra:"Bank Mandiri",      gaji:8100000, tarifDitentukan:true, validasi:"meninggal" },
  { kpa:"CD552018", nrp:"158431",   tglLahir:"1986-11-27", nama:"Bagas Nugroho",  mitra:"Bank Mandiri",      gaji:5900000, tarifDitentukan:true, validasi:"ptdh" },
  { kpa:"CD661247", nrp:"160982",   tglLahir:"1988-06-14", nama:"Rama Aditya",    mitra:"Bank BTN",          gaji:6750000, tarifDitentukan:true, flaggingMitra:"Bank BTN" }
];

/* b. Pensiun sendiri — peserta sendiri yang mengajukan pinjaman. */
const DATA_FLAGGING_PENSIUN_SENDIRI = [
  { kpa:"CY104869", nrp:"197804081998032003", tglLahir:"1978-04-08", nomorPensiun:"PS-2019-004821", nama:"Made Wardani",     mitra:"PT Pos Indonesia", gaji:4120000, tarifDitentukan:true  },
  { kpa:"CY338120", nrp:"141902",             tglLahir:"1972-01-30", nomorPensiun:"PS-2016-003077", nama:"Rohana Siregar",   mitra:"Bank Jatim",       gaji:3860000, tarifDitentukan:false },
  { kpa:"CY220745", nrp:"098231",             tglLahir:"1949-05-12", nomorPensiun:"PS-2008-000512", nama:"Sutrisno Hadi",    mitra:"PT Pos Indonesia", gaji:3240000, tarifDitentukan:true, validasi:"usia75" },
  { kpa:"CE358403", nrp:"127485",             tglLahir:"1968-06-27", nomorPensiun:"PS-2012-001190", nama:"Firman Dewantoro", mitra:"Bank BRI",         gaji:4480000, tarifDitentukan:true, flaggingMitra:"Bank BRI" }
];

/* c. Pensiun waris — peserta sudah meninggal, yang meminjam adalah penerima
   pensiun warisnya. Satu peserta bisa punya lebih dari satu penerima, karena
   itu Nomor Pensiun Peminjam dicari lewat search field lalu Nama Peminjam
   ikut terisi otomatis. */
const DATA_FLAGGING_PENSIUN_WARIS = [
  { kpa:"CE360625", nrp:"132170", tglLahir:"1970-03-15", nopens:"PS-2015-002214", nama:"Kenedi", mitra:"Bank BNI", gaji:3480000, tarifDitentukan:true, peminjam:[
      { nomorPensiun:"PS-2015-002214-01", nama:"Sri Rahayu (Istri)" },
      { nomorPensiun:"PS-2015-002214-02", nama:"Bayu Kenedi (Anak)" }
  ]},
  { kpa:"CX882140", nrp:"118034", tglLahir:"1966-02-09", nopens:"PS-2011-000774", nama:"Slamet Riyadi", mitra:"PT Pos Indonesia", gaji:2940000, tarifDitentukan:false, peminjam:[
      { nomorPensiun:"PS-2011-000774-01", nama:"Wagiyem (Istri)" }
  ]},
  { kpa:"CX770311", nrp:"109556", tglLahir:"1964-08-23", nopens:"PS-2009-000318", nama:"Darmawan", mitra:"Bank Sumut", gaji:2610000, tarifDitentukan:true, validasi:"ortuYatim", peminjam:[
      { nomorPensiun:"PS-2009-000318-01", nama:"Rusmiati (Ibu Kandung)" }
  ]}
];

/* ---------------------------------------------------------------------------
   3. CHECK DAN BOOKING — KOLEKTIF
   Daftar peserta yang muncul setelah file batch diunggah. Jenis kolektif tidak
   lagi dipilih manual: satu tabel menampung peserta aktif maupun pensiun,
   dibedakan lewat kolom Nomor Pensiun dan kelompok kolom Penerima.
   Kolom "pensiun" dan "hidup" memakai kode satu huruf seperti pada berkas
   kiriman mitra — Y = Ya, T = Tidak.

   Kolom "validasi" berisi alasan peserta tidak lolos pengecekan; baris tanpa
   kolom ini berarti lolos. Alasannya sengaja dibuat sependek mungkin karena
   tampil apa adanya di kolom Hasil Validasi.
   --------------------------------------------------------------------------- */
const DATA_FLAGGING_KOLEKTIF_PESERTA = [
  { ktpa:"BD316947", nrp:"544925",   nomorPensiun:"", nama:"DODY ISWAHYUDIONO", tglLahir:"1961-10-16", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"DODY ISWAHYUDIONO", booking:true  },
  { ktpa:"BE401859", nrp:"541451",   nomorPensiun:"", nama:"TARYONO",           tglLahir:"1962-06-20", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"TARYONO",           booking:true  },
  { ktpa:"EE331520", nrp:"63050076", nomorPensiun:"", nama:"RAHDI ROHENDI",     tglLahir:"1963-05-04", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"RAHDI ROHENDI",     booking:true  },
  { ktpa:"EE337485", nrp:"63010063", nomorPensiun:"", nama:"CHARLESE TOMASOA",  tglLahir:"1963-01-27", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"CHARLESE TOMASOA",  booking:true  },
  { ktpa:"ED337689", nrp:"62090675", nomorPensiun:"", nama:"SLAMET SUWARSONO",  tglLahir:"1962-09-04", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"SLAMET SUWARSONO",  booking:true  },
  { ktpa:"DE301113", nrp:"510791",   nomorPensiun:"", nama:"JAHJO BUDIJANTO",   tglLahir:"1962-05-07", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"JAHJO BUDIJANTO",   booking:true  },
  { ktpa:"BD318204", nrp:"545013",   nomorPensiun:"", nama:"SUPRIYADI",         tglLahir:"1961-11-22", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"SUPRIYADI",         booking:false },
  { ktpa:"BE402677", nrp:"541990",   nomorPensiun:"", nama:"AGUS SETIAWAN",     tglLahir:"1962-03-11", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"AGUS SETIAWAN",     booking:false },
  { ktpa:"EE332018", nrp:"63050211", nomorPensiun:"", nama:"BAMBANG HERMANTO",  tglLahir:"1963-07-19", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"BAMBANG HERMANTO",  booking:false },
  { ktpa:"ED338102", nrp:"62090884", nomorPensiun:"", nama:"MARWAN HIDAYAT",    tglLahir:"1962-12-30", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"MARWAN HIDAYAT",    booking:false, validasi:"Usia di atas 75 tahun" },

  { ktpa:"CY104869", nrp:"197804081998032003", nomorPensiun:"PS-2019-004821", nama:"MADE WARDANI",     tglLahir:"1978-04-08", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2019-004821-01", namaPenerima:"MADE WARDANI",        booking:false },
  { ktpa:"CE360625", nrp:"132170",             nomorPensiun:"PS-2015-002214", nama:"KENEDI",           tglLahir:"1970-03-15", pensiun:"Y", hidup:"T", nopensPenerima:"PS-2015-002214-01", namaPenerima:"SRI RAHAYU (ISTRI)",  booking:false, validasi:"Peserta meninggal, belum klaim" },
  { ktpa:"CE358403", nrp:"127485",             nomorPensiun:"PS-2012-001190", nama:"FIRMAN DEWANTORO", tglLahir:"1968-06-27", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2012-001190-01", namaPenerima:"FIRMAN DEWANTORO",    booking:false },
  { ktpa:"CX882140", nrp:"118034",             nomorPensiun:"PS-2011-000774", nama:"SLAMET RIYADI",    tglLahir:"1966-02-09", pensiun:"Y", hidup:"T", nopensPenerima:"PS-2011-000774-01", namaPenerima:"WAGIYEM (ISTRI)",     booking:false },
  { ktpa:"CX770311", nrp:"109556",             nomorPensiun:"PS-2009-000318", nama:"DARMAWAN",         tglLahir:"1964-08-23", pensiun:"Y", hidup:"T", nopensPenerima:"PS-2009-000318-01", namaPenerima:"RUSMIATI (IBU)",      booking:false, validasi:"Pensiun orang tua/yatim piatu" },
  { ktpa:"CY338120", nrp:"141902",             nomorPensiun:"PS-2016-003077", nama:"ROHANA SIREGAR",   tglLahir:"1972-01-30", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2016-003077-01", namaPenerima:"ROHANA SIREGAR",      booking:false },
  { ktpa:"CY220745", nrp:"098231",             nomorPensiun:"PS-2008-000512", nama:"SUTRISNO HADI",    tglLahir:"1949-05-12", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2008-000512-01", namaPenerima:"SUTRISNO HADI",       booking:false, validasi:"Usia di atas 75 tahun" },
  { ktpa:"CZ441207", nrp:"152880",             nomorPensiun:"PS-2018-004013", nama:"HERU SANTOSA",     tglLahir:"1974-09-17", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2018-004013-01", namaPenerima:"HERU SANTOSA",        booking:false },
  { ktpa:"CZ452988", nrp:"154317",             nomorPensiun:"PS-2018-004566", nama:"NURHAYATI",        tglLahir:"1975-11-02", pensiun:"Y", hidup:"Y", nopensPenerima:"PS-2018-004566-01", namaPenerima:"NURHAYATI",           booking:false },
  { ktpa:"CW661430", nrp:"087445",             nomorPensiun:"PS-2006-000129", nama:"MOCHAMAD ZEIN",    tglLahir:"1951-07-25", pensiun:"Y", hidup:"T", nopensPenerima:"PS-2006-000129-01", namaPenerima:"SITI AMINAH (ISTRI)", booking:false, validasi:"Peserta meninggal, belum klaim" },

  { ktpa:"BD319871", nrp:"545620",   nomorPensiun:"", nama:"WAHYU KURNIAWAN", tglLahir:"1961-04-18", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"WAHYU KURNIAWAN", booking:false },
  { ktpa:"BE403155", nrp:"542208",   nomorPensiun:"", nama:"SUGENG RIYANTO",  tglLahir:"1962-08-06", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"SUGENG RIYANTO",  booking:false },
  { ktpa:"EE333044", nrp:"63050398", nomorPensiun:"", nama:"ASEP SAEPUDIN",   tglLahir:"1963-10-11", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"ASEP SAEPUDIN",   booking:false },
  { ktpa:"EE338790", nrp:"63010502", nomorPensiun:"", nama:"YOHANES LEIMENA", tglLahir:"1963-03-29", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"YOHANES LEIMENA", booking:false },
  { ktpa:"ED339215", nrp:"62091106", nomorPensiun:"", nama:"DIDIK PURWANTO",  tglLahir:"1962-11-14", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"DIDIK PURWANTO",  booking:false },
  { ktpa:"DE302447", nrp:"511340",   nomorPensiun:"", nama:"HARTONO WIJAYA",  tglLahir:"1962-01-23", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"HARTONO WIJAYA",  booking:false },
  { ktpa:"BD320566", nrp:"546077",   nomorPensiun:"", nama:"IWAN SETIAWAN",   tglLahir:"1961-06-30", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"IWAN SETIAWAN",   booking:false },
  { ktpa:"BE404012", nrp:"542751",   nomorPensiun:"", nama:"RUDI HARTANTO",   tglLahir:"1962-02-15", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"RUDI HARTANTO",   booking:false },
  { ktpa:"EE334610", nrp:"63050644", nomorPensiun:"", nama:"DEDE SUHERMAN",   tglLahir:"1963-12-08", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"DEDE SUHERMAN",   booking:false, validasi:"Status PTDH" },
  { ktpa:"ED340188", nrp:"62091390", nomorPensiun:"", nama:"TEGUH PRAYITNO",  tglLahir:"1962-07-21", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"TEGUH PRAYITNO",  booking:false },

  { ktpa:"DA275319", nrp:"498106",   nomorPensiun:"", nama:"MUHAMAD YUSUF",   tglLahir:"1960-09-12", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"MUHAMAD YUSUF",   booking:false },
  { ktpa:"DA276804", nrp:"498772",   nomorPensiun:"", nama:"ANWAR SANUSI",    tglLahir:"1960-12-05", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"ANWAR SANUSI",    booking:false },
  { ktpa:"DB281945", nrp:"502330",   nomorPensiun:"", nama:"SUKARDI",         tglLahir:"1961-02-28", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"SUKARDI",         booking:false, validasi:"Sudah flagging di mitra lain" },
  { ktpa:"DB283077", nrp:"502918",   nomorPensiun:"", nama:"EDI SUSANTO",     tglLahir:"1961-08-09", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"EDI SUSANTO",     booking:false },
  { ktpa:"DC291266", nrp:"506415",   nomorPensiun:"", nama:"SITI MARYAM",     tglLahir:"1961-05-16", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"SITI MARYAM",     booking:false },
  { ktpa:"DC292703", nrp:"507082",   nomorPensiun:"", nama:"RATNA JUWITA",    tglLahir:"1961-10-03", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"RATNA JUWITA",    booking:false },
  { ktpa:"DD298114", nrp:"509237",   nomorPensiun:"", nama:"BUDI SANTOSO",    tglLahir:"1962-04-25", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"BUDI SANTOSO",    booking:false },
  { ktpa:"DD299560", nrp:"509854",   nomorPensiun:"", nama:"TRI WAHYUNI",     tglLahir:"1962-06-13", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"TRI WAHYUNI",     booking:false },
  { ktpa:"DE303901", nrp:"511876",   nomorPensiun:"", nama:"GUNAWAN SUDIRJO", tglLahir:"1962-10-19", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"GUNAWAN SUDIRJO", booking:false },
  { ktpa:"DE305238", nrp:"512443",   nomorPensiun:"", nama:"LILIS SURYANI",   tglLahir:"1962-12-01", pensiun:"T", hidup:"Y", nopensPenerima:"", namaPenerima:"LILIS SURYANI",   booking:false }
];

/* Riwayat batch kolektif yang sudah diunggah. Sengaja dikosongkan supaya
   keadaan awal tab "Kolektif" memperlihatkan empty state; barisnya bertambah
   setiap kali file batch diunggah dari kartu di atas. */
const DATA_FLAGGING_KOLEKTIF_BATCH = [];


/* ---------------------------------------------------------------------------
   4. DASHBOARD
   Angka ringkasan untuk grafik garis di layar Dashboard. `siteVisits` memakai
   nama bulan karena hanya menampilkan 3 bulan terakhir; deret lainnya memakai
   nomor bulan berjalan tahun 2026 (Januari–Juli).
   --------------------------------------------------------------------------- */
const DASHBOARD_FLAGGING_TAHUN = 2026;
const DASHBOARD_FLAGGING_MITRA = "Rendra Mitreka";
const DASHBOARD_FLAGGING_BULAN = ["1", "2", "3", "4", "5", "6", "7"];

const DASHBOARD_FLAGGING = {
  siteVisits:  { labels: ["Aug", "Jul", "Jun"], values: [18, 12, 7],                                   seri: "Jumlah Akses", satuan: "JUMLAH AKSES" },
  booking:     { labels: DASHBOARD_FLAGGING_BULAN, values: [5200, 5700, 2700, 4500, 3980, 4250, 4100], seri: "Nasabah",      satuan: "NASABAH" },
  pengajuan:   { labels: DASHBOARD_FLAGGING_BULAN, values: [7700, 9200, 4300, 7050, 5800, 7000, 7150], seri: "Nasabah",      satuan: "NASABAH" },
  persetujuan: { labels: DASHBOARD_FLAGGING_BULAN, values: [3650, 4700, 2250, 3480, 2870, 3400, 3650], seri: "Nasabah",      satuan: "NASABAH" },
  pelunasan:   { labels: DASHBOARD_FLAGGING_BULAN, values: [5, 32, 38, 48, 56, 71, 55],                seri: "Nasabah",      satuan: "NASABAH" }
};



/* ---------------------------------------------------------------------------
   5. PENSIUNAN
   Rekap per mitra bayar untuk satu periode (bulan + tahun), cabang, dan jenis
   bayar. `penerima` = flagging + nonFlagging; `netto` adalah total yang
   dibayarkan ke mitra pada periode tersebut.
   --------------------------------------------------------------------------- */
const FP_JENIS_BAYAR = ["Dapem Induk", "Non Dapem PP"];

const DATA_FLAGGING_PENSIUNAN = [
  { bulan:"Januari",  tahun:2025, cabang:"KC Jakarta Pusat",   jenisBayar:"Dapem Induk",  mitra:"Bank BRI",                     flagging:412, nonFlagging:828, netto:2480000000 },
  { bulan:"Januari",  tahun:2025, cabang:"KC Jakarta Selatan", jenisBayar:"Dapem Induk",  mitra:"Bank BNI",                     flagging:298, nonFlagging:578, netto:1752000000 },
  { bulan:"Januari",  tahun:2025, cabang:"KC Bandung",         jenisBayar:"Dapem Induk",  mitra:"Bank Mandiri",                 flagging:187, nonFlagging:345, netto:1064000000 },
  { bulan:"Januari",  tahun:2025, cabang:"KC Surabaya",        jenisBayar:"Non Dapem PP", mitra:"Bank BTN",                     flagging:154, nonFlagging:402, netto:1112000000 },
  { bulan:"Januari",  tahun:2025, cabang:"KC Medan",           jenisBayar:"Dapem Induk",  mitra:"Bank BCA",                     flagging:121, nonFlagging:289, netto:820000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Makassar",        jenisBayar:"Dapem Induk",  mitra:"Bank Syariah Indonesia (BSI)", flagging:96,  nonFlagging:233, netto:658000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Jakarta Pusat",   jenisBayar:"Non Dapem PP", mitra:"Bank DKI",                     flagging:74,  nonFlagging:168, netto:484000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Bandung",         jenisBayar:"Dapem Induk",  mitra:"Bank Jabar Banten (BJB)",      flagging:63,  nonFlagging:149, netto:424000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Surabaya",        jenisBayar:"Dapem Induk",  mitra:"Bank Jatim",                   flagging:58,  nonFlagging:131, netto:378000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Medan",           jenisBayar:"Non Dapem PP", mitra:"Bank Sumut",                   flagging:41,  nonFlagging:96,  netto:274000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Padang",          jenisBayar:"Dapem Induk",  mitra:"Bank Nagari",                  flagging:33,  nonFlagging:78,  netto:222000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Pekanbaru",       jenisBayar:"Dapem Induk",  mitra:"Bank Riau Kepri",              flagging:27,  nonFlagging:64,  netto:182000000  },
  { bulan:"Januari",  tahun:2025, cabang:"KC Balikpapan",      jenisBayar:"Non Dapem PP", mitra:"Bank Kalbar",                  flagging:19,  nonFlagging:45,  netto:128000000  },

  { bulan:"Februari", tahun:2025, cabang:"KC Jakarta Pusat",   jenisBayar:"Dapem Induk",  mitra:"Bank BRI",                     flagging:428, nonFlagging:845, netto:2546000000 },
  { bulan:"Februari", tahun:2025, cabang:"KC Jakarta Selatan", jenisBayar:"Dapem Induk",  mitra:"Bank BNI",                     flagging:305, nonFlagging:592, netto:1794000000 },
  { bulan:"Februari", tahun:2025, cabang:"KC Bandung",         jenisBayar:"Dapem Induk",  mitra:"Bank Mandiri",                 flagging:194, nonFlagging:358, netto:1104000000 },
  { bulan:"Februari", tahun:2025, cabang:"KC Surabaya",        jenisBayar:"Non Dapem PP", mitra:"Bank BTN",                     flagging:160, nonFlagging:411, netto:1142000000 },
  { bulan:"Februari", tahun:2025, cabang:"KC Medan",           jenisBayar:"Dapem Induk",  mitra:"Bank BCA",                     flagging:128, nonFlagging:297, netto:850000000  },
  { bulan:"Februari", tahun:2025, cabang:"KC Makassar",        jenisBayar:"Dapem Induk",  mitra:"Bank Syariah Indonesia (BSI)", flagging:101, nonFlagging:240, netto:682000000  },
  { bulan:"Februari", tahun:2025, cabang:"KC Padang",          jenisBayar:"Dapem Induk",  mitra:"Bank Nagari",                  flagging:36,  nonFlagging:81,  netto:234000000  },

  { bulan:"Maret",    tahun:2025, cabang:"KC Jakarta Pusat",   jenisBayar:"Dapem Induk",  mitra:"Bank BRI",                     flagging:441, nonFlagging:862, netto:2606000000 },
  { bulan:"Maret",    tahun:2025, cabang:"KC Jakarta Selatan", jenisBayar:"Dapem Induk",  mitra:"Bank BNI",                     flagging:312, nonFlagging:604, netto:1832000000 },
  { bulan:"Maret",    tahun:2025, cabang:"KC Bandung",         jenisBayar:"Dapem Induk",  mitra:"Bank Mandiri",                 flagging:201, nonFlagging:366, netto:1134000000 },
  { bulan:"Maret",    tahun:2025, cabang:"KC Surabaya",        jenisBayar:"Non Dapem PP", mitra:"Bank BTN",                     flagging:166, nonFlagging:419, netto:1170000000 },
  { bulan:"Maret",    tahun:2025, cabang:"KC Balikpapan",      jenisBayar:"Non Dapem PP", mitra:"Bank Kalbar",                  flagging:22,  nonFlagging:49,  netto:142000000  }
];


/* ---------------------------------------------------------------------------
   6. PINJAMAN — PENGAJUAN
   Daftar pengajuan flagging pinjaman yang dikirim mitra. `statusPinjaman`
   menggerakkan filter di layar sekaligus menentukan aksi yang tersedia:
   Pembatalan Booking hanya masuk akal untuk baris yang berstatus "Booked".
   `riwayat` dipakai tombol Riwayat — urut dari kejadian paling awal.
   `pinjaman` berisi Info Pinjaman yang tampil di layar Detail Pengajuan;
   namanya mengikuti kolom template unggahan (awal_kredit, plafon, no_pk, dst).
   --------------------------------------------------------------------------- */
/* Urutan status mengikuti perjalanan pengajuan: "Pengajuan" masih menunggu
   keputusan di Persetujuan, lalu jadi "Booked" atau "Dibatalkan". */
const FPG_STATUS_PINJAMAN = ["Pengajuan", "Booked", "Dibatalkan"];

const DATA_FLAGGING_PENGAJUAN = [
  { ktpa:"BD316947", nrp:"544925", mitra:"Bank BRI", nomorPensiun:"", nama:"DODY ISWAHYUDIONO", tglLahir:"1961-10-16",
    statusPinjaman:"Booked", statusPensiun:"Aktif",
    bookingTgl:"2026-07-02", bookingUser:"operator.bri", pengajuanTgl:"2026-07-01", pengajuanUser:"operator.bri",
    catatan:"Pengajuan pertama, berkas lengkap.",
    pinjaman:{ tglPermohonan:"2026-07-01", awalKredit:"2026-07-01", akhirKredit:"2031-07-01", plafon:150000000, gajiPeserta:7500000,
      norekTab:"0101000316947", norekKredit:"0109000316947", noPk:"PK/2026/07/0001", nik:"3171011610610001",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:2500000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BD316947.pdf", lampiranPernyataan:"Pernyataan-Kredit-BD316947.pdf" },
    riwayat:[
      { tgl:"2026-07-01", user:"operator.bri",   aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" },
      { tgl:"2026-07-02", user:"verifikator.kep", aksi:"Booking disetujui", ket:"Lolos pengecekan flagging" }
    ] },
  { ktpa:"BE401859", nrp:"541451", mitra:"Bank BRI", nomorPensiun:"", nama:"TARYONO", tglLahir:"1962-06-20",
    statusPinjaman:"Booked", statusPensiun:"Aktif",
    bookingTgl:"2026-07-02", bookingUser:"operator.bri", pengajuanTgl:"2026-07-01", pengajuanUser:"operator.bri",
    catatan:"",
    pinjaman:{ tglPermohonan:"2026-07-01", awalKredit:"2026-07-01", akhirKredit:"2031-07-01", plafon:90000000, gajiPeserta:4500000,
      norekTab:"0201000401859", norekKredit:"0209000401859", noPk:"PK/2026/07/0002", nik:"3171012006620002",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:1500000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BE401859.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE401859.pdf" },
    riwayat:[
      { tgl:"2026-07-01", user:"operator.bri",   aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" },
      { tgl:"2026-07-02", user:"verifikator.kep", aksi:"Booking disetujui", ket:"Lolos pengecekan flagging" }
    ] },
  { ktpa:"CY104869", nrp:"197804081998032003", mitra:"PT Pos Indonesia", nomorPensiun:"PS-2019-004821", nama:"MADE WARDANI", tglLahir:"1978-04-08",
    statusPinjaman:"Booked", statusPensiun:"Pensiun",
    bookingTgl:"2026-07-05", bookingUser:"operator.pos", pengajuanTgl:"2026-07-03", pengajuanUser:"operator.pos",
    catatan:"Penerima pensiun sendiri.",
    pinjaman:{ tglPermohonan:"2026-07-03", awalKredit:"2026-07-03", akhirKredit:"2031-07-03", plafon:60000000, gajiPeserta:3000000,
      norekTab:"0301000104869", norekKredit:"0309000104869", noPk:"PK/2026/07/0003", nik:"5171010804780003",
      jnsTab:"Giro", cabangMitra:"KC Denpasar", angsuran:1100000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CY104869.pdf", lampiranPernyataan:"Pernyataan-Kredit-CY104869.pdf" },
    riwayat:[
      { tgl:"2026-07-03", user:"operator.pos",    aksi:"Pengajuan dibuat", ket:"Diajukan lewat kantor pos cabang" },
      { tgl:"2026-07-05", user:"verifikator.kep", aksi:"Booking disetujui", ket:"Nopens cocok dengan data dapem" }
    ] },
  { ktpa:"EE331520", nrp:"63050076", mitra:"Bank BNI", nomorPensiun:"", nama:"RAHDI ROHENDI", tglLahir:"1963-05-04",
    statusPinjaman:"Pengajuan", statusPensiun:"Aktif",
    bookingTgl:"", bookingUser:"", pengajuanTgl:"2026-07-08", pengajuanUser:"operator.bni",
    catatan:"Menunggu verifikasi Divisi Kepesertaan.",
    pinjaman:{ tglPermohonan:"2026-07-08", awalKredit:"2026-07-08", akhirKredit:"2031-07-08", plafon:120000000, gajiPeserta:6000000,
      norekTab:"0401000331520", norekKredit:"0409000331520", noPk:"PK/2026/07/0004", nik:"3273010405630004",
      jnsTab:"Tabungan", cabangMitra:"KC Bandung", angsuran:2100000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-EE331520.pdf", lampiranPernyataan:"Pernyataan-Kredit-EE331520.pdf" },
    riwayat:[
      { tgl:"2026-07-08", user:"operator.bni", aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" }
    ] },
  { ktpa:"EE337485", nrp:"63010063", mitra:"Bank BNI", nomorPensiun:"", nama:"CHARLESE TOMASOA", tglLahir:"1963-01-27",
    statusPinjaman:"Pengajuan", statusPensiun:"Aktif",
    bookingTgl:"", bookingUser:"", pengajuanTgl:"2026-07-08", pengajuanUser:"operator.bni",
    catatan:"",
    pinjaman:{ tglPermohonan:"2026-07-08", awalKredit:"2026-07-08", akhirKredit:"2031-07-08", plafon:110000000, gajiPeserta:5500000,
      norekTab:"0501000337485", norekKredit:"0509000337485", noPk:"PK/2026/07/0005", nik:"3273012701630005",
      jnsTab:"Tabungan", cabangMitra:"KC Bandung", angsuran:1950000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-EE337485.pdf", lampiranPernyataan:"Pernyataan-Kredit-EE337485.pdf" },
    riwayat:[
      { tgl:"2026-07-08", user:"operator.bni", aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" }
    ] },
  { ktpa:"ED337689", nrp:"62090675", mitra:"Bank Mandiri", nomorPensiun:"", nama:"SLAMET SUWARSONO", tglLahir:"1962-09-04",
    statusPinjaman:"Pengajuan", statusPensiun:"Aktif",
    bookingTgl:"", bookingUser:"", pengajuanTgl:"2026-07-09", pengajuanUser:"operator.mandiri",
    catatan:"Berkas menyusul dari cabang.",
    pinjaman:{ tglPermohonan:"2026-07-09", awalKredit:"2026-07-09", akhirKredit:"2031-07-09", plafon:135000000, gajiPeserta:6750000,
      norekTab:"0601000337689", norekKredit:"0609000337689", noPk:"PK/2026/07/0006", nik:"3578010409620006",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:2300000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-ED337689.pdf", lampiranPernyataan:"Pernyataan-Kredit-ED337689.pdf" },
    riwayat:[
      { tgl:"2026-07-09", user:"operator.mandiri", aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" }
    ] },
  { ktpa:"CE358403", nrp:"127485", mitra:"Bank BRI", nomorPensiun:"PS-2012-001190", nama:"FIRMAN DEWANTORO", tglLahir:"1968-06-27",
    statusPinjaman:"Dibatalkan", statusPensiun:"Pensiun",
    bookingTgl:"2026-06-18", bookingUser:"operator.bri", pengajuanTgl:"2026-06-15", pengajuanUser:"operator.bri",
    catatan:"Sudah ter-flagging di mitra lain.",
    pinjaman:{ tglPermohonan:"2026-06-15", awalKredit:"2026-06-15", akhirKredit:"2031-06-15", plafon:75000000, gajiPeserta:3750000,
      norekTab:"0701000358403", norekKredit:"0709000358403", noPk:"PK/2026/07/0007", nik:"1271012706680007",
      jnsTab:"Giro", cabangMitra:"KC Medan", angsuran:1400000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CE358403.pdf", lampiranPernyataan:"Pernyataan-Kredit-CE358403.pdf" },
    riwayat:[
      { tgl:"2026-06-15", user:"operator.bri",    aksi:"Pengajuan dibuat",    ket:"Berkas batch diunggah" },
      { tgl:"2026-06-18", user:"verifikator.kep", aksi:"Booking disetujui",   ket:"Lolos pengecekan awal" },
      { tgl:"2026-06-27", user:"verifikator.kep", aksi:"Booking dibatalkan",  ket:"Ditemukan flagging aktif di Bank BTN" }
    ] },
  { ktpa:"CE360625", nrp:"132170", mitra:"Bank BNI", nomorPensiun:"PS-2015-002214", nama:"KENEDI", tglLahir:"1970-03-15",
    statusPinjaman:"Dibatalkan", statusPensiun:"Pensiun",
    bookingTgl:"2026-06-20", bookingUser:"operator.bni", pengajuanTgl:"2026-06-16", pengajuanUser:"operator.bni",
    catatan:"Peserta meninggal, belum mengajukan klaim.",
    pinjaman:{ tglPermohonan:"2026-06-16", awalKredit:"2026-06-16", akhirKredit:"2031-06-16", plafon:65000000, gajiPeserta:3250000,
      norekTab:"0801000360625", norekKredit:"0809000360625", noPk:"PK/2026/07/0008", nik:"1271011503700008",
      jnsTab:"Giro", cabangMitra:"KC Medan", angsuran:1250000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CE360625.pdf", lampiranPernyataan:"Pernyataan-Kredit-CE360625.pdf" },
    riwayat:[
      { tgl:"2026-06-16", user:"operator.bni",    aksi:"Pengajuan dibuat",   ket:"Berkas batch diunggah" },
      { tgl:"2026-06-20", user:"verifikator.kep", aksi:"Booking disetujui",  ket:"Lolos pengecekan awal" },
      { tgl:"2026-07-01", user:"verifikator.kep", aksi:"Booking dibatalkan", ket:"Peserta terdata meninggal dunia" }
    ] },
  { ktpa:"DE301113", nrp:"510791", mitra:"Bank BTN", nomorPensiun:"", nama:"JAHJO BUDIJANTO", tglLahir:"1962-05-07",
    statusPinjaman:"Booked", statusPensiun:"Aktif",
    bookingTgl:"2026-07-06", bookingUser:"operator.btn", pengajuanTgl:"2026-07-04", pengajuanUser:"operator.btn",
    catatan:"",
    pinjaman:{ tglPermohonan:"2026-07-04", awalKredit:"2026-07-04", akhirKredit:"2031-07-04", plafon:100000000, gajiPeserta:5000000,
      norekTab:"0901000301113", norekKredit:"0909000301113", noPk:"PK/2026/07/0009", nik:"3578010705620009",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:1800000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-DE301113.pdf", lampiranPernyataan:"Pernyataan-Kredit-DE301113.pdf" },
    riwayat:[
      { tgl:"2026-07-04", user:"operator.btn",    aksi:"Pengajuan dibuat",  ket:"Berkas batch diunggah" },
      { tgl:"2026-07-06", user:"verifikator.kep", aksi:"Booking disetujui", ket:"Lolos pengecekan flagging" }
    ] },
  { ktpa:"CY338120", nrp:"141902", mitra:"Bank Jatim", nomorPensiun:"PS-2016-003077", nama:"ROHANA SIREGAR", tglLahir:"1972-01-30",
    statusPinjaman:"Pengajuan", statusPensiun:"Pensiun",
    bookingTgl:"", bookingUser:"", pengajuanTgl:"2026-07-10", pengajuanUser:"operator.jatim",
    catatan:"Parameter tarif belum ditentukan.",
    pinjaman:{ tglPermohonan:"2026-07-10", awalKredit:"2026-07-10", akhirKredit:"2031-07-10", plafon:80000000, gajiPeserta:4000000,
      norekTab:"01001000338120", norekKredit:"01009000338120", noPk:"PK/2026/07/0010", nik:"3578013001720010",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:1450000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CY338120.pdf", lampiranPernyataan:"Pernyataan-Kredit-CY338120.pdf" },
    riwayat:[
      { tgl:"2026-07-10", user:"operator.jatim", aksi:"Pengajuan dibuat", ket:"Berkas batch diunggah" }
    ] },
  { ktpa:"CZ441207", nrp:"152880", mitra:"Bank Sumut", nomorPensiun:"PS-2018-004013", nama:"HERU SANTOSA", tglLahir:"1974-09-17",
    statusPinjaman:"Booked", statusPensiun:"Pensiun",
    bookingTgl:"2026-07-07", bookingUser:"operator.sumut", pengajuanTgl:"2026-07-05", pengajuanUser:"operator.sumut",
    catatan:"",
    pinjaman:{ tglPermohonan:"2026-07-05", awalKredit:"2026-07-05", akhirKredit:"2031-07-05", plafon:95000000, gajiPeserta:4750000,
      norekTab:"01101000441207", norekKredit:"01109000441207", noPk:"PK/2026/07/0011", nik:"1271011709740011",
      jnsTab:"Giro", cabangMitra:"KC Medan", angsuran:1700000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CZ441207.pdf", lampiranPernyataan:"Pernyataan-Kredit-CZ441207.pdf" },
    riwayat:[
      { tgl:"2026-07-05", user:"operator.sumut",  aksi:"Pengajuan dibuat",  ket:"Berkas batch diunggah" },
      { tgl:"2026-07-07", user:"verifikator.kep", aksi:"Booking disetujui", ket:"Lolos pengecekan flagging" }
    ] },
  { ktpa:"CW661430", nrp:"087445", mitra:"PT Pos Indonesia", nomorPensiun:"PS-2006-000129", nama:"MOCHAMAD ZEIN", tglLahir:"1951-07-25",
    statusPinjaman:"Dibatalkan", statusPensiun:"Pensiun",
    bookingTgl:"2026-06-22", bookingUser:"operator.pos", pengajuanTgl:"2026-06-19", pengajuanUser:"operator.pos",
    catatan:"Usia di atas 75 tahun.",
    pinjaman:{ tglPermohonan:"2026-06-19", awalKredit:"2026-06-19", akhirKredit:"2031-06-19", plafon:55000000, gajiPeserta:2750000,
      norekTab:"01201000661430", norekKredit:"01209000661430", noPk:"PK/2026/07/0012", nik:"7371012507510012",
      jnsTab:"Giro", cabangMitra:"KC Makassar", angsuran:1050000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CW661430.pdf", lampiranPernyataan:"Pernyataan-Kredit-CW661430.pdf" },
    riwayat:[
      { tgl:"2026-06-19", user:"operator.pos",    aksi:"Pengajuan dibuat",   ket:"Berkas batch diunggah" },
      { tgl:"2026-06-22", user:"verifikator.kep", aksi:"Booking disetujui",  ket:"Lolos pengecekan awal" },
      { tgl:"2026-06-30", user:"verifikator.kep", aksi:"Booking dibatalkan", ket:"Usia melewati batas 75 tahun" }
    ] }
];


/* ---------------------------------------------------------------------------
   7. PINJAMAN — PERSETUJUAN
   Antrean persetujuan. Barisnya berasal dari tiga tempat: Check dan Booking
   Individu, Check dan Booking Kolektif, dan unggahan di sub modul Pengajuan —
   nama sumbernya disimpan di `sumber` supaya terbaca di layar Detail.
   `tglProses` baru terisi setelah baris disetujui atau ditolak.
   --------------------------------------------------------------------------- */
const FPS_STATUS = ["Pending", "Disetujui", "Ditolak"];

/* Kolom `aktivitas` menyebut permintaan apa yang sedang diputuskan, bukan
   sekadar identitas pesertanya. Nilai yang dipakai:
   Pengajuan Pinjaman · Pengajuan Take Over · Pengajuan Top Up ·
   Perubahan Data · Perubahan Take Over · Pelunasan ·
   Pengajuan Pembatalan Flagging ·
   Pengajuan Pembatalan Booking · Pelepasan Flagging.
   Yang membawa muatan tambahan (`perubahan`) berasal dari layar Flagging —
   KPA-nya ada di DATA_FLAGGING_PINJAMAN — kecuali Pengajuan Pembatalan Booking
   yang menyasar DATA_FLAGGING_PENGAJUAN, serta Pengajuan/Perubahan Take Over
   yang menyasar DATA_FLAGGING_TAKEOVER. */

/* Baris yang berasal dari layar Flagging membawa muatan tambahan:
   `perubahan` = rincian "dari → ke" untuk ditampilkan di layar detail;
   `nilaiBaru` / `pelunasan` = isi yang diterapkan ke data pinjaman begitu
   permintaannya disetujui. */

const DATA_FLAGGING_PERSETUJUAN = [
  { ktpa:"BD316947", nrp:"544925", mitra:"Bank BRI", nopens:"", nama:"DODY ISWAHYUDIONO", tglLahir:"1961-10-16",
    aktivitas:"Pengajuan Pinjaman", status:"Disetujui", tglProses:"2026-07-02", sumber:"Check dan Booking Kolektif",
    riwayat:[
      { tgl:"2026-07-01", user:"operator.bri",    aksi:"Diajukan",  ket:"Masuk dari batch kolektif Bank BRI" },
      { tgl:"2026-07-02", user:"verifikator.kep", aksi:"Disetujui", ket:"Lolos pengecekan flagging" }
    ] },
  { ktpa:"CY104869", nrp:"197804081998032003", mitra:"PT Pos Indonesia", nopens:"PS-2019-004821", nama:"MADE WARDANI", tglLahir:"1978-04-08",
    aktivitas:"Pengajuan Pinjaman", status:"Disetujui", tglProses:"2026-07-05", sumber:"Check dan Booking Individu",
    riwayat:[
      { tgl:"2026-07-03", user:"operator.pos",    aksi:"Diajukan",  ket:"Booking individu peserta pensiun sendiri" },
      { tgl:"2026-07-05", user:"verifikator.kep", aksi:"Disetujui", ket:"Nopens cocok dengan data dapem" }
    ] },
  { ktpa:"EE331520", nrp:"63050076", mitra:"Bank BNI", nopens:"", nama:"RAHDI ROHENDI", tglLahir:"1963-05-04",
    aktivitas:"Pengajuan Pinjaman", status:"Pending", tglProses:"", sumber:"Pengajuan",
    riwayat:[
      { tgl:"2026-07-08", user:"operator.bni", aksi:"Diajukan", ket:"Unggahan berkas pengajuan Bank BNI" }
    ] },
  { ktpa:"ED337689", nrp:"62090675", mitra:"Bank Mandiri", nopens:"", nama:"SLAMET SUWARSONO", tglLahir:"1962-09-04",
    aktivitas:"Pengajuan Take Over", status:"Pending", tglProses:"", sumber:"Pengajuan",
    riwayat:[
      { tgl:"2026-07-09", user:"operator.mandiri", aksi:"Diajukan", ket:"Unggahan berkas pengajuan Bank Mandiri" }
    ] },
  { ktpa:"CE358403", nrp:"127485", mitra:"Bank BRI", nopens:"PS-2012-001190", nama:"FIRMAN DEWANTORO", tglLahir:"1968-06-27",
    aktivitas:"Pengajuan Pinjaman", status:"Ditolak", tglProses:"2026-06-27", sumber:"Check dan Booking Individu",
    riwayat:[
      { tgl:"2026-06-15", user:"operator.bri",    aksi:"Diajukan", ket:"Booking individu peserta pensiun sendiri" },
      { tgl:"2026-06-27", user:"verifikator.kep", aksi:"Ditolak",  ket:"Sudah ter-flagging di Bank BTN" }
    ] },
  { ktpa:"CW661430", nrp:"087445", mitra:"PT Pos Indonesia", nopens:"PS-2006-000129", nama:"MOCHAMAD ZEIN", tglLahir:"1951-07-25",
    aktivitas:"Pengajuan Pinjaman", status:"Ditolak", tglProses:"2026-06-30", sumber:"Check dan Booking Kolektif",
    riwayat:[
      { tgl:"2026-06-19", user:"operator.pos",    aksi:"Diajukan", ket:"Masuk dari batch kolektif PT Pos Indonesia" },
      { tgl:"2026-06-30", user:"verifikator.kep", aksi:"Ditolak",  ket:"Usia melewati batas 75 tahun" }
    ] },

  /* Tiga baris berikut memberi tiap mitra bayar pada pilihan role satu contoh
     penolakan, supaya notifikasi saat berganti role bisa langsung terlihat. */
  { ktpa:"EE337485", nrp:"63010063", mitra:"Bank BNI", nopens:"", nama:"CHARLESE TOMASOA", tglLahir:"1963-01-27",
    aktivitas:"Pengajuan Pinjaman", status:"Ditolak", tglProses:"2026-07-12", sumber:"Pengajuan",
    riwayat:[
      { tgl:"2026-07-08", user:"operator.bni",    aksi:"Diajukan", ket:"Unggahan berkas pengajuan Bank BNI" },
      { tgl:"2026-07-12", user:"verifikator.kep", aksi:"Ditolak",  ket:"Nomor rekening kredit tidak sesuai" }
    ] },
  { ktpa:"CD552018", nrp:"158431", mitra:"Bank Mandiri", nopens:"", nama:"BAGAS NUGROHO", tglLahir:"1986-11-27",
    aktivitas:"Pengajuan Top Up", status:"Ditolak", tglProses:"2026-07-14", sumber:"Check dan Booking Individu",
    riwayat:[
      { tgl:"2026-07-11", user:"operator.mandiri", aksi:"Diajukan", ket:"Booking individu peserta aktif" },
      { tgl:"2026-07-14", user:"verifikator.kep",  aksi:"Ditolak",  ket:"Peserta berstatus PTDH" }
    ] },
  { ktpa:"CZ452988", nrp:"154317", mitra:"Bank BCA", nopens:"PS-2018-004566", nama:"NURHAYATI", tglLahir:"1975-11-02",
    aktivitas:"Pengajuan Pinjaman", status:"Ditolak", tglProses:"2026-07-16", sumber:"Check dan Booking Kolektif",
    riwayat:[
      { tgl:"2026-07-13", user:"operator.bca",   aksi:"Diajukan", ket:"Masuk dari batch kolektif Bank BCA" },
      { tgl:"2026-07-16", user:"verifikator.kep", aksi:"Ditolak", ket:"Plafon melebihi batas kemampuan angsuran" }
    ] },

  { sumber:"Detail Flagging", ktpa:"ED342336", nrp:"66120160", mitra:"BANK WOORI SAUDARA", nopens:"ED342336111196",
    nama:"BIRMAN SIMANULANG", tglLahir:"1966-12-02",
    aktivitas:"Perubahan Data", status:"Pending", tglProses:"", pengaju:"ahmad.roji",
    perubahan:[
      { label:"Besaran Angsuran",        dari:"Rp 1.700.000", ke:"Rp 1.850.000" },
      { label:"Nomor Perjanjian Kredit", dari:"4994/PR-PSN111/13-10/25", ke:"4994/PR-PSN111/13-10/25-R1" }
    ],
    nilaiBaru:{ angsuran:1850000, noPk:"4994/PR-PSN111/13-10/25-R1" },
    riwayat:[ { tgl:"2026-07-18", user:"ahmad.roji", aksi:"Diajukan", ket:"Perubahan data dari layar Detail Flagging" } ] },
  { sumber:"Pelunasan", ktpa:"ED334862", nrp:"64020307", mitra:"BANK SYARIAH INDONESIA", nopens:"ED334862111030",
    nama:"SUWIRYO PRANOTO", tglLahir:"1964-02-01",
    aktivitas:"Pelunasan", status:"Disetujui", tglProses:"2026-05-18", pengaju:"ahmad.roji",
    perubahan:[
      { label:"Tgl Pelunasan", dari:"–", ke:"2026-05-18" },
      { label:"Keterangan",    dari:"–", ke:"Pelunasan sesuai jadwal" }
    ],
    pelunasan:{ tgl:"2026-05-18", ket:"Pelunasan sesuai jadwal" },
    riwayat:[
      { tgl:"2026-05-16", user:"ahmad.roji",     aksi:"Diajukan",  ket:"Pengajuan pelunasan dari layar Pelunasan" },
      { tgl:"2026-05-18", user:"verifikator.kep", aksi:"Disetujui", ket:"Bukti pelunasan lengkap" }
    ] },
  { sumber:"Detail Flagging", ktpa:"BE381141", nrp:"622519", mitra:"BANK WOORI SAUDARA", nopens:"201311127910",
    nama:"YOYO SUNARYO", tglLahir:"",
    aktivitas:"Perubahan Data", status:"Ditolak", tglProses:"2026-06-05", pengaju:"BRI002",
    perubahan:[
      { label:"Plafon", dari:"Rp 254.000.000", ke:"Rp 300.000.000" }
    ],
    nilaiBaru:{ plafon:300000000 },
    riwayat:[
      { tgl:"2026-06-02", user:"BRI002",         aksi:"Diajukan", ket:"Perubahan data dari layar Detail Flagging" },
      { tgl:"2026-06-05", user:"verifikator.kep", aksi:"Ditolak",  ket:"Plafon melebihi batas kemampuan angsuran" }
    ] },

  /* Dua baris berikut berasal dari layar Flagging dan menunjuk pinjaman yang
     benar-benar ada di DATA_FLAGGING_PINJAMAN — Pembatalan untuk pinjaman yang
     masih berjalan, Pelepasan untuk yang sudah lunas. */
  { sumber:"Detail Flagging", ktpa:"ED374512", nrp:"71060256", mitra:"BANK WOORI SAUDARA",
    nopens:"", nama:"SELAMAT HARIPAN", tglLahir:"1971-06-01",
    aktivitas:"Pengajuan Pembatalan Flagging", status:"Pending", tglProses:"",
    perubahan:[
      { label:"Alasan Pembatalan", dari:"–", ke:"Akad kredit dibatalkan peserta sebelum pencairan" }
    ],
    riwayat:[ { tgl:"2026-07-20", user:"BRI002", aksi:"Diajukan", ket:"Pembatalan flagging dari layar Detail Flagging" } ] },

  { sumber:"Detail Flagging", ktpa:"BE394193", nrp:"517801", mitra:"BANK WOORI SAUDARA",
    nopens:"200611029570", nama:"WATNO", tglLahir:"",
    aktivitas:"Pelepasan Flagging", status:"Disetujui", tglProses:"2026-07-15",
    perubahan:[
      { label:"Alasan Pelepasan", dari:"–", ke:"Pinjaman sudah lunas, flagging dilepas dari mitra bayar" }
    ],
    riwayat:[
      { tgl:"2026-07-13", user:"BRI004",          aksi:"Diajukan",  ket:"Pelepasan flagging dari layar Detail Flagging" },
      { tgl:"2026-07-15", user:"verifikator.kep", aksi:"Disetujui", ket:"Pelunasan terverifikasi, flagging dilepas" }
    ] },

  /* Tiga baris berikut memperagakan notifikasi antar mitra pada alur take over.
     Bank BRI berperan sebagai mitra pengaju (`mitra`), Bank Mandiri sebagai
     pemberi kredit lama (`mitraAwal`):
       Pending   → Bank Mandiri menerima "Pengajuan Take Over dari Bank BRI"
       Disetujui → Bank BRI menerima "Persetujuan Take Over dari Bank Mandiri"
       Ditolak   → Bank BRI menerima "Penolakan Take Over dari Bank Mandiri"   */
  { sumber:"Tambahkan Take Over", ktpa:"BE352608", nrp:"586045",
    mitra:"Bank BRI", mitraAwal:"Bank Mandiri", nopens:"201411062390",
    nama:"MAHFUDDIN", tglLahir:"1961-01-05",
    aktivitas:"Pengajuan Take Over", status:"Pending", tglProses:"",
    perubahan:[
      { label:"Mitra Awal",      dari:"–", ke:"Bank Mandiri" },
      { label:"Mitra Take Over", dari:"–", ke:"Bank BRI" }
    ],
    riwayat:[ { tgl:"2026-07-22", user:"operator.bri", aksi:"Diajukan", ket:"Pengajuan take over ke Bank Mandiri" } ] },

  { sumber:"Tambahkan Take Over", ktpa:"EE342429", nrp:"62090650",
    mitra:"Bank BRI", mitraAwal:"Bank Mandiri", nopens:"200114009280",
    nama:"RANNI ROULI SIMANJUNTAK", tglLahir:"1960-02-01",
    aktivitas:"Pengajuan Take Over", status:"Disetujui", tglProses:"2026-07-19",
    perubahan:[
      { label:"Mitra Awal",      dari:"–", ke:"Bank Mandiri" },
      { label:"Mitra Take Over", dari:"–", ke:"Bank BRI" }
    ],
    riwayat:[
      { tgl:"2026-07-17", user:"operator.bri",     aksi:"Diajukan",  ket:"Pengajuan take over ke Bank Mandiri" },
      { tgl:"2026-07-19", user:"verifikator.mandiri", aksi:"Disetujui", ket:"Sisa kewajiban sudah dilunasi" }
    ] },

  { sumber:"Tambahkan Take Over", ktpa:"BZ101618", nrp:"030126780",
    mitra:"Bank BRI", mitraAwal:"Bank Mandiri", nopens:"200221019480",
    nama:"NY. PADMIATUN", tglLahir:"1965-10-05",
    aktivitas:"Pengajuan Take Over", status:"Ditolak", tglProses:"2026-07-21",
    perubahan:[
      { label:"Mitra Awal",      dari:"–", ke:"Bank Mandiri" },
      { label:"Mitra Take Over", dari:"–", ke:"Bank BRI" }
    ],
    riwayat:[
      { tgl:"2026-07-18", user:"operator.bri",     aksi:"Diajukan", ket:"Pengajuan take over ke Bank Mandiri" },
      { tgl:"2026-07-21", user:"verifikator.mandiri", aksi:"Ditolak", ket:"Angsuran masih berjalan, belum bisa dialihkan" }
    ] }
];


/* ---------------------------------------------------------------------------
   8. REGISTRI NIK (DUKCAPIL)
   Sumber kebenaran tombol "Cek NIK" di layar Detail Pengajuan. Nama dan tanggal
   lahir di form dibandingkan ke sini; yang tidak cocok ditandai merah dan
   menahan Submit Pengajuan sampai diperbaiki.

   Tiga NIK sengaja dibuat berbeda dari isian form supaya validasinya bisa
   diperagakan: 3273010405630004 (nama beda), 3578010409620006 (tanggal lahir
   beda), dan 1271012706680007 (dua-duanya beda).
   --------------------------------------------------------------------------- */
const DATA_NIK = {
  "3171011610610001": { nama:"DODY ISWAHYUDIONO", tglLahir:"1961-10-16" },
  "3171012006620002": { nama:"TARYONO",           tglLahir:"1962-06-20" },
  "5171010804780003": { nama:"MADE WARDANI",      tglLahir:"1978-04-08" },
  "3273010405630004": { nama:"RAHDI ROHENDI S.",  tglLahir:"1963-05-04" },
  "3273012701630005": { nama:"CHARLESE TOMASOA",  tglLahir:"1963-01-27" },
  "3578010409620006": { nama:"SLAMET SUWARSONO",  tglLahir:"1962-09-14" },
  "1271012706680007": { nama:"FIRMAN DEWANTORO S.", tglLahir:"1968-06-17" },
  "1271011503700008": { nama:"KENEDI",            tglLahir:"1970-03-15" },
  "3578010705620009": { nama:"JAHJO BUDIJANTO",   tglLahir:"1962-05-07" },
  "3578013001720010": { nama:"ROHANA SIREGAR",    tglLahir:"1972-01-30" },
  "1271011709740011": { nama:"HERU SANTOSA",      tglLahir:"1974-09-17" },
  "7371012507510012": { nama:"MOCHAMAD ZEIN",     tglLahir:"1951-07-25" }
};


/* ---------------------------------------------------------------------------
   9. PINJAMAN — FLAGGING
   Pinjaman yang flagging-nya sudah aktif di mitra bayar. Kolom "I" adalah
   penanda indikator dari berkas mitra (N = ada catatan), "statusTagih" adalah
   penanda penagihan, dan `pinjaman` memakai bentuk yang sama dengan blok
   Pengajuan supaya layar detailnya bisa berbagi susunan field.
   Status "Dibatalkan" hanya muncul setelah tombol Pembatalan ditekan.
   --------------------------------------------------------------------------- */
const FFL_STATUS_PINJAMAN = ["Disetujui", "Lunas"];

/* Kategori hanya terisi untuk pinjaman berstatus Lunas — menjelaskan cara
   pelunasannya. "Pelunasan Jatuh Tempo" tidak pernah dipilih manual: sistem
   menetapkannya sendiri bila tanggal pelunasan sudah mencapai Tanggal Akhir
   Kredit. Yang bisa dipilih operator hanya yang ada di FFL_KATEGORI_PILIHAN. */
const FFL_KATEGORI_JATUH_TEMPO = "Pelunasan Jatuh Tempo";
const FFL_KATEGORI_PILIHAN     = ["Pelunasan dari Angsuran"];

const DATA_FLAGGING_PINJAMAN = [
  { ind:"N", mitra:"BANK MANTAP", ktpa:"BE404972", nrp:"517141", nik:"3201042907620002",
    nomorPensiun:"201511053900", nama:"MOH. SUEB", tglLahir:"1961-11-29",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"", pengguna:"",
    pinjaman:{ tglPermohonan:"2026-08-08", awalKredit:"2022-02-04", akhirKredit:"2028-02-04", plafon:30000000, gajiPeserta:1500000,
      norekTab:"9301500322216", norekKredit:"9301500322216", noPk:"F866976", nik:"3201042907620002",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:625000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE404972.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE404972.pdf" },
    riwayat:[ { tgl:"2026-08-08", user:"operator.mantap", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"BANK WOORI SAUDARA", ktpa:"BZ143428", nrp:"196707181991031007", nik:"3277021807600003",
    nomorPensiun:"BZ143428111028", nama:"SUROSO", tglLahir:"1967-07-18",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 11:47:00", pengguna:"BNI001",
    pinjaman:{ tglPermohonan:"2025-10-24", awalKredit:"2025-10-24", akhirKredit:"2028-12-24", plafon:100000000, gajiPeserta:5000000,
      norekTab:"1987574317", norekKredit:"1987574317", noPk:"0770/BKS/BFP/2025", nik:"3277021807600003",
      jnsTab:"Tabungan", cabangMitra:"KC Semarang", angsuran:2600000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BZ143428.pdf", lampiranPernyataan:"Pernyataan-Kredit-BZ143428.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"BNI001", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK BRI", ktpa:"BE502785", nrp:"31940543120872", nik:"",
    nomorPensiun:"BE502785111022", nama:"SAMI'AN", tglLahir:"",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 20:30:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2020-03-10", awalKredit:"2025-10-15", akhirKredit:"2040-10-15", plafon:210000000, gajiPeserta:10500000,
      norekTab:"0051010438675", norekKredit:"0051010842", noPk:"124163235/51/10/25", nik:"",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:2900000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BE502785.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE502785.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"BANK WOORI SAUDARA", ktpa:"BY124343", nrp:"196911071997032004", nik:"3301114711690004",
    nomorPensiun:"BY124343", nama:"MUSRIWATI", tglLahir:"1969-11-07",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 20:30:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2024-08-15", awalKredit:"2025-10-20", akhirKredit:"2034-10-17", plafon:220000000, gajiPeserta:11000000,
      norekTab:"100160306899", norekKredit:"GEN160202", noPk:"160/3100400003/ID02506", nik:"3301114711690004",
      jnsTab:"Tabungan", cabangMitra:"KC Semarang", angsuran:3100000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BY124343.pdf", lampiranPernyataan:"Pernyataan-Kredit-BY124343.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK WOORI SAUDARA", ktpa:"ED357776", nrp:"63090795", nik:"",
    nomorPensiun:"ED357776111072", nama:"DJAENI", tglLahir:"",
    statusPinjaman:"Lunas", kategori:"Pelunasan dari Angsuran", statusTagih:"N", tglSetuju:"2025-10-27 20:30:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2025-01-10", awalKredit:"2025-10-13", akhirKredit:"2030-10-13", plafon:35500000, gajiPeserta:1780000,
      norekTab:"9101059112", norekKredit:"9101059112", noPk:"736/PR-PSN529/13-10/25", nik:"",
      jnsTab:"Tabungan", cabangMitra:"KC Semarang", angsuran:740000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-ED357776.pdf", lampiranPernyataan:"Pernyataan-Kredit-ED357776.pdf" },
    riwayat:[
      { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" },
      { tgl:"2026-06-30", user:"ahmad.roji", aksi:"Pelunasan",      ket:"Pelunasan dipercepat oleh peserta" }
    ] },

  { ind:"", mitra:"BANK WOORI SAUDARA", ktpa:"ED342336", nrp:"66120160", nik:"3275090212660001",
    nomorPensiun:"ED342336111196", nama:"BIRMAN SIMANULANG", tglLahir:"1966-12-02",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 20:30:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2019-02-26", awalKredit:"2025-10-13", akhirKredit:"2034-10-13", plafon:120500000, gajiPeserta:6030000,
      norekTab:"1242804638488", norekKredit:"1242804638", noPk:"4994/PR-PSN111/13-10/25", nik:"3275090212660001",
      jnsTab:"Tabungan", cabangMitra:"KC Medan", angsuran:1700000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-ED342336.pdf", lampiranPernyataan:"Pernyataan-Kredit-ED342336.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"BANK SYARIAH INDONESIA", ktpa:"ED334862", nrp:"64020307", nik:"3203050102640016",
    nomorPensiun:"ED334862111030", nama:"SUWIRYO PRANOTO", tglLahir:"1964-02-01",
    statusPinjaman:"Lunas", kategori:"Pelunasan Jatuh Tempo", statusTagih:"N", tglSetuju:"2025-10-27 20:29:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2021-05-10", awalKredit:"2021-05-18", akhirKredit:"2026-05-18", plafon:70000000, gajiPeserta:3500000,
      norekTab:"7329686347", norekKredit:"7329686347", noPk:"WISE/2025100710270172", nik:"3203050102640016",
      jnsTab:"Giro", cabangMitra:"KC Bandung", angsuran:1450000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-ED334862.pdf", lampiranPernyataan:"Pernyataan-Kredit-ED334862.pdf" },
    riwayat:[
      { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" },
      { tgl:"2026-05-18", user:"ahmad.roji", aksi:"Pelunasan",      ket:"Pelunasan sesuai jadwal" }
    ] },

  { ind:"N", mitra:"BANK WOORI SAUDARA", ktpa:"BE381141", nrp:"622519", nik:"",
    nomorPensiun:"201311127910", nama:"YOYO SUNARYO", tglLahir:"",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 20:29:00", pengguna:"ahmad.roji",
    pinjaman:{ tglPermohonan:"2022-06-02", awalKredit:"2025-10-20", akhirKredit:"2040-10-19", plafon:254000000, gajiPeserta:12700000,
      norekTab:"194857789", norekKredit:"1986655460", noPk:"019/GPS/PK-FLEKSI PENSIUN", nik:"",
      jnsTab:"Tabungan", cabangMitra:"KC Bandung", angsuran:3400000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BE381141.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE381141.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"ahmad.roji", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"BANK WOORI SAUDARA", ktpa:"ED374512", nrp:"71060256", nik:"5108080106710004",
    nomorPensiun:"", nama:"SELAMAT HARIPAN", tglLahir:"1971-06-01",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2025-10-27 17:02:00", pengguna:"BRI002",
    pinjaman:{ tglPermohonan:"2025-10-27", awalKredit:"2025-10-27", akhirKredit:"2035-10-27", plafon:100000000, gajiPeserta:5000000,
      norekTab:"0307011392545", norekKredit:"3624010357", noPk:"124676721/3624/10/2025", nik:"5108080106710004",
      jnsTab:"Tabungan", cabangMitra:"KC Denpasar", angsuran:1400000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-ED374512.pdf", lampiranPernyataan:"Pernyataan-Kredit-ED374512.pdf" },
    riwayat:[ { tgl:"2025-10-27", user:"BRI002", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK WOORI SAUDARA", ktpa:"BE394193", nrp:"517801", nik:"",
    nomorPensiun:"200611029570", nama:"WATNO", tglLahir:"",
    statusPinjaman:"Lunas", kategori:"Pelunasan dari Angsuran", statusTagih:"N", tglSetuju:"2025-10-27 17:01:00", pengguna:"BRI004",
    pinjaman:{ tglPermohonan:"2025-10-27", awalKredit:"2025-10-27", akhirKredit:"2029-10-27", plafon:35000000, gajiPeserta:1750000,
      norekTab:"0360010304295", norekKredit:"0360010413", noPk:"124602300/360/10/25", nik:"",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:820000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE394193.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE394193.pdf" },
    riwayat:[
      { tgl:"2025-10-27", user:"BRI004",    aksi:"Flagging aktif", ket:"Pengajuan disetujui" },
      { tgl:"2026-07-11", user:"ahmad.roji", aksi:"Pelunasan",     ket:"Pelunasan dipercepat oleh peserta" }
    ] },

  /* Tiga baris di bawah sengaja disiapkan untuk menguji sub modul Take Over:
     nomornya mudah diingat (TO1000xx), statusnya Disetujui, dan belum ada di
     DATA_FLAGGING_TAKEOVER sehingga selalu lolos pencarian. */
  { ind:"", mitra:"BANK BRI", ktpa:"TO100001", nrp:"601234", nik:"3171010101700101",
    nomorPensiun:"201501010101", nama:"UJI TAKEOVER SATU", tglLahir:"1970-01-01",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-01-05 09:00:00", pengguna:"BRI001",
    pinjaman:{ tglPermohonan:"2026-01-02", awalKredit:"2026-01-05", akhirKredit:"2031-01-05", plafon:90000000, gajiPeserta:4500000,
      norekTab:"0201000100001", norekKredit:"0209000100001", noPk:"PK/2026/01/1001", nik:"3171010101700101",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:1600000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TO100001.pdf", lampiranPernyataan:"Pernyataan-Kredit-TO100001.pdf" },
    riwayat:[ { tgl:"2026-01-05", user:"BRI001", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK MANTAP", ktpa:"TO100002", nrp:"602345", nik:"3273010202680102",
    nomorPensiun:"", nama:"UJI TAKEOVER DUA", tglLahir:"1968-02-02",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-02-10 10:30:00", pengguna:"MTP002",
    pinjaman:{ tglPermohonan:"2026-02-06", awalKredit:"2026-02-10", akhirKredit:"2032-02-10", plafon:140000000, gajiPeserta:7000000,
      norekTab:"0202000100002", norekKredit:"0209000100002", noPk:"PK/2026/02/1002", nik:"3273010202680102",
      jnsTab:"Giro", cabangMitra:"KC Bandung", angsuran:2200000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-TO100002.pdf", lampiranPernyataan:"Pernyataan-Kredit-TO100002.pdf" },
    riwayat:[ { tgl:"2026-02-10", user:"MTP002", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"PT POS INDONESIA", ktpa:"TO100003", nrp:"603456", nik:"3578010303660103",
    nomorPensiun:"200903030303", nama:"UJI TAKEOVER TIGA", tglLahir:"1966-03-03",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-03-15 14:15:00", pengguna:"POS003",
    pinjaman:{ tglPermohonan:"2026-03-11", awalKredit:"2026-03-15", akhirKredit:"2030-03-15", plafon:65000000, gajiPeserta:3250000,
      norekTab:"0203000100003", norekKredit:"0209000100003", noPk:"PK/2026/03/1003", nik:"3578010303660103",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:1300000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TO100003.pdf", lampiranPernyataan:"Pernyataan-Kredit-TO100003.pdf" },
    riwayat:[ { tgl:"2026-03-15", user:"POS003", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  /* KPA uji coba untuk sub Top Up. TU100001 belum pernah di-top up,
     TU100002 dan TU100003 sudah punya riwayat di DATA_FLAGGING_TOPUP supaya
     kolom "Top Up Ke" ikut naik, dan TU100004 sengaja berstatus Lunas untuk
     menguji penolakan pencarian. */
  { ind:"", mitra:"BANK BRI", ktpa:"TU100001", nrp:"701234", nik:"3171010104750201",
    nomorPensiun:"201801010201", nama:"UJI TOPUP SATU", tglLahir:"1975-04-01",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-04-06 09:10:00", pengguna:"BRI021",
    pinjaman:{ tglPermohonan:"2026-04-02", awalKredit:"2026-04-06", akhirKredit:"2031-04-06", plafon:60000000, gajiPeserta:3000000,
      norekTab:"0301000200001", norekKredit:"0309000200001", noPk:"PK/2026/04/2001", nik:"3171010104750201",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:1100000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU100001.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU100001.pdf" },
    riwayat:[ { tgl:"2026-04-06", user:"BRI021", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK MANTAP", ktpa:"TU100002", nrp:"702345", nik:"3273010205730202",
    nomorPensiun:"201705020202", nama:"UJI TOPUP DUA", tglLahir:"1973-05-02",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-05-11 11:25:00", pengguna:"MTP022",
    pinjaman:{ tglPermohonan:"2026-05-07", awalKredit:"2026-05-11", akhirKredit:"2032-05-11", plafon:95000000, gajiPeserta:4750000,
      norekTab:"0302000200002", norekKredit:"0309000200002", noPk:"PK/2026/05/2002", nik:"3273010205730202",
      jnsTab:"Giro", cabangMitra:"KC Bandung", angsuran:1700000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-TU100002.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU100002.pdf" },
    riwayat:[ { tgl:"2026-05-11", user:"MTP022", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"", mitra:"PT POS INDONESIA", ktpa:"TU100003", nrp:"703456", nik:"3578010306710203",
    nomorPensiun:"201406030203", nama:"UJI TOPUP TIGA", tglLahir:"1971-06-03",
    statusPinjaman:"Disetujui", statusTagih:"N", tglSetuju:"2026-06-16 15:40:00", pengguna:"POS023",
    pinjaman:{ tglPermohonan:"2026-06-12", awalKredit:"2026-06-16", akhirKredit:"2033-06-16", plafon:130000000, gajiPeserta:6500000,
      norekTab:"0303000200003", norekKredit:"0309000200003", noPk:"PK/2026/06/2003", nik:"3578010306710203",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:2100000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU100003.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU100003.pdf" },
    riwayat:[ { tgl:"2026-06-16", user:"POS023", aksi:"Flagging aktif", ket:"Pengajuan disetujui" } ] },

  { ind:"N", mitra:"BANK BNI", ktpa:"TU100004", nrp:"704567", nik:"3374010407690204",
    nomorPensiun:"201207040204", nama:"UJI TOPUP EMPAT", tglLahir:"1969-07-04",
    statusPinjaman:"Lunas", statusTagih:"Y", kategori:"Pelunasan dari Angsuran",
    tglSetuju:"2026-02-20 08:55:00", pengguna:"BNI024",
    pinjaman:{ tglPermohonan:"2021-02-15", awalKredit:"2021-02-20", akhirKredit:"2027-02-20", plafon:48000000, gajiPeserta:2400000,
      norekTab:"0304000200004", norekKredit:"0309000200004", noPk:"PK/2021/02/2004", nik:"3374010407690204",
      jnsTab:"Tabungan", cabangMitra:"KC Semarang", angsuran:820000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU100004.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU100004.pdf" },
    riwayat:[
      { tgl:"2021-02-20", user:"BNI024", aksi:"Flagging aktif", ket:"Pengajuan disetujui" },
      { tgl:"2026-02-20", user:"verifikator.kep", aksi:"Pelunasan", ket:"Dilunasi dari angsuran" }
    ] }
];



/* ---------------------------------------------------------------------------
   10. PINJAMAN — TAKE OVER
   Pengalihan pinjaman peserta dari mitra lama ke mitra baru. `mitraAwal` adalah
   pemberi kredit sekarang, `mitraPengajuan` adalah calon penerima take over.
   Tiga pasang kolom tanggal/user mencatat siapa memproses di tahap mana:
   Takeover (mitra pengaju), Mitra Takeover (mitra lama), dan ASABRI.
   `pinjaman` memakai bentuk yang sama dengan blok Pengajuan supaya layar
   detailnya bisa berbagi susunan field.
   --------------------------------------------------------------------------- */
/* Perjalanan satu take over: "Tertunda" selama masih menunggu tanggapan mitra
   lama, lalu "Diterima" atau "Ditolak" setelah diputuskan. */
const FTO_STATUS = ["Tertunda", "Diterima", "Ditolak"];

const DATA_FLAGGING_TAKEOVER = [
  { ktpa:"BE416312", nrp:"615637", mitraAwal:"BANK BRI", mitraPengajuan:"BANK SMBC",
    nomorPensiun:"BE416312111200", nama:"ELDALIWAN", tglLahir:"1967-12-30", statusPensiun:"Y",
    tglPelunasan:"2023-02-27", toTgl:"2023-03-03", toUser:"BTPN007",
    status:"Tertunda", mtTgl:"", mtUser:"", asTgl:"", asUser:"", catatan:"",
    pinjaman:{ tglPelunasan:"2023-02-27", awalKredit:"2023-03-03", akhirKredit:"2028-03-03",
      plafon:85000000, gajiPeserta:4250000, norekTab:"0101000416312", norekKredit:"0109000416312",
      noPk:"TO/2023/03/0001", nik:"3171013012670001", jnsTab:"Tabungan",
      cabangMitra:"KC Jakarta Pusat", angsuran:1450000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE416312.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE416312.pdf" } },

  { ktpa:"BE352608", nrp:"586045", mitraAwal:"BANK BRI", mitraPengajuan:"BANK SMBC",
    nomorPensiun:"201411062390", nama:"MAHFUDDIN", tglLahir:"1961-01-05", statusPensiun:"Y",
    tglPelunasan:"2023-01-18", toTgl:"2023-03-03", toUser:"BTPN007",
    status:"Tertunda", mtTgl:"", mtUser:"", asTgl:"", asUser:"", catatan:"",
    pinjaman:{ tglPelunasan:"2023-01-18", awalKredit:"2023-03-03", akhirKredit:"2029-03-03",
      plafon:120000000, gajiPeserta:6000000, norekTab:"0102000352608", norekKredit:"0109000352608",
      noPk:"TO/2023/03/0002", nik:"3171010501610002", jnsTab:"Tabungan",
      cabangMitra:"KC Jakarta Selatan", angsuran:1900000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE352608.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE352608.pdf" } },

  { ktpa:"EE342429", nrp:"62090650", mitraAwal:"BANK MANTAP", mitraPengajuan:"BANK WOORI SAUDARA",
    nomorPensiun:"200114009280", nama:"RANNI ROULI SIMANJUNTAK", tglLahir:"1960-02-01", statusPensiun:"Y",
    tglPelunasan:"2023-03-03", toTgl:"2023-03-03", toUser:"BWS001",
    status:"Diterima", mtTgl:"2023-03-06", mtUser:"MTP014", asTgl:"2023-03-08", asUser:"verifikator.kep", catatan:"Take over disetujui.",
    pinjaman:{ tglPelunasan:"2023-03-03", awalKredit:"2023-03-03", akhirKredit:"2030-03-03",
      plafon:95000000, gajiPeserta:4750000, norekTab:"0103000342429", norekKredit:"0109000342429",
      noPk:"TO/2023/03/0003", nik:"1271010102600003", jnsTab:"Tabungan",
      cabangMitra:"KC Medan", angsuran:1550000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-EE342429.pdf", lampiranPernyataan:"Pernyataan-Kredit-EE342429.pdf" } },

  { ktpa:"BE456330", nrp:"3900024911069", mitraAwal:"BANK BRI", mitraPengajuan:"BANK WOORI SAUDARA",
    nomorPensiun:"", nama:"ZAMZAMI", tglLahir:"1969-10-10", statusPensiun:"T",
    tglPelunasan:"2023-03-03", toTgl:"2023-03-03", toUser:"BWS001",
    status:"Ditolak", mtTgl:"2023-03-07", mtUser:"BRI009", asTgl:"", asUser:"", catatan:"Angsuran di mitra lama masih berjalan.",
    pinjaman:{ tglPelunasan:"2023-03-03", awalKredit:"2023-03-03", akhirKredit:"2031-03-03",
      plafon:150000000, gajiPeserta:7500000, norekTab:"0104000456330", norekKredit:"0109000456330",
      noPk:"TO/2023/03/0004", nik:"1171011010690004", jnsTab:"Tabungan",
      cabangMitra:"KC Banda Aceh", angsuran:2200000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-BE456330.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE456330.pdf" } },

  { ktpa:"EE319601", nrp:"60120291", mitraAwal:"BANK MANTAP", mitraPengajuan:"BANK WOORI SAUDARA",
    nomorPensiun:"EE319601111051", nama:"BAMBANG SULISTYO GUNAWAN", tglLahir:"1960-01-19", statusPensiun:"T",
    tglPelunasan:"2023-03-03", toTgl:"2023-03-03", toUser:"BWS001",
    status:"Tertunda", mtTgl:"", mtUser:"", asTgl:"", asUser:"", catatan:"",
    pinjaman:{ tglPelunasan:"2023-03-03", awalKredit:"2023-03-03", akhirKredit:"2029-03-03",
      plafon:78000000, gajiPeserta:3900000, norekTab:"0105000319601", norekKredit:"0109000319601",
      noPk:"TO/2023/03/0005", nik:"3578011901600005", jnsTab:"Giro",
      cabangMitra:"KC Surabaya", angsuran:1350000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-EE319601.pdf", lampiranPernyataan:"Pernyataan-Kredit-EE319601.pdf" } },

  { ktpa:"BZ101618", nrp:"030126780", mitraAwal:"PT POS INDONESIA", mitraPengajuan:"BANK WOORI SAUDARA",
    nomorPensiun:"200221019480", nama:"NY. PADMIATUN", tglLahir:"1965-10-05", statusPensiun:"Y",
    tglPelunasan:"2023-03-03", toTgl:"2023-03-03", toUser:"BWS001",
    status:"Ditolak", mtTgl:"2023-03-09", mtUser:"POS006", asTgl:"", asUser:"", catatan:"Sisa kewajiban belum dilunasi.",
    pinjaman:{ tglPelunasan:"2023-03-03", awalKredit:"2023-03-03", akhirKredit:"2028-03-03",
      plafon:64000000, gajiPeserta:3200000, norekTab:"0106000101618", norekKredit:"0109000101618",
      noPk:"TO/2023/03/0006", nik:"3374010510650006", jnsTab:"Tabungan",
      cabangMitra:"KC Semarang", angsuran:1180000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BZ101618.pdf", lampiranPernyataan:"Pernyataan-Kredit-BZ101618.pdf" } },

  { ktpa:"CE318275", nrp:"72415", mitraAwal:"BANK BRI", mitraPengajuan:"BANK SMBC",
    nomorPensiun:"201712021990", nama:"JOKO MURYONO", tglLahir:"1967-07-17", statusPensiun:"Y",
    tglPelunasan:"2023-03-01", toTgl:"2023-03-03", toUser:"BTPN007",
    status:"Diterima", mtTgl:"2023-03-06", mtUser:"BRI009", asTgl:"2023-03-09", asUser:"verifikator.kep", catatan:"Take over disetujui.",
    pinjaman:{ tglPelunasan:"2023-03-01", awalKredit:"2023-03-03", akhirKredit:"2028-03-03",
      plafon:70000000, gajiPeserta:3500000, norekTab:"0107000318275", norekKredit:"0109000318275",
      noPk:"TO/2023/03/0007", nik:"3374011707670007", jnsTab:"Tabungan",
      cabangMitra:"KC Yogyakarta", angsuran:1250000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-CE318275.pdf", lampiranPernyataan:"Pernyataan-Kredit-CE318275.pdf" } },

  { ktpa:"BE399727", nrp:"557800", mitraAwal:"BANK WOORI SAUDARA", mitraPengajuan:"BANK BJB",
    nomorPensiun:"BE399727121060", nama:"SUDIRMAN", tglLahir:"1969-06-21", statusPensiun:"Y",
    tglPelunasan:"2023-01-05", toTgl:"2023-03-03", toUser:"BJB004",
    status:"Tertunda", mtTgl:"", mtUser:"", asTgl:"", asUser:"", catatan:"",
    pinjaman:{ tglPelunasan:"2023-01-05", awalKredit:"2023-03-03", akhirKredit:"2030-03-03",
      plafon:110000000, gajiPeserta:5500000, norekTab:"0108000399727", norekKredit:"0109000399727",
      noPk:"TO/2023/03/0008", nik:"3273012106690008", jnsTab:"Tabungan",
      cabangMitra:"KC Bandung", angsuran:1750000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE399727.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE399727.pdf" } },

  { ktpa:"BE344799", nrp:"515392", mitraAwal:"PT POS INDONESIA", mitraPengajuan:"KB BANK",
    nomorPensiun:"201211096020", nama:"HERU SUROTO", tglLahir:"1959-07-11", statusPensiun:"Y",
    tglPelunasan:"2023-03-02", toTgl:"2023-03-03", toUser:"BKPN005",
    status:"Diterima", mtTgl:"2023-03-07", mtUser:"POS006", asTgl:"2023-03-10", asUser:"verifikator.kep", catatan:"Take over disetujui.",
    pinjaman:{ tglPelunasan:"2023-03-02", awalKredit:"2023-03-03", akhirKredit:"2027-03-03",
      plafon:52000000, gajiPeserta:2600000, norekTab:"0109000344799", norekKredit:"0109100344799",
      noPk:"TO/2023/03/0009", nik:"3578011107590009", jnsTab:"Giro",
      cabangMitra:"KC Surabaya", angsuran:1050000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE344799.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE344799.pdf" } },

  { ktpa:"BE364978", nrp:"621820", mitraAwal:"BANK BRI", mitraPengajuan:"BANK SYARIAH INDONESIA",
    nomorPensiun:"201411062790", nama:"BAHTIAR", tglLahir:"1961-05-03", statusPensiun:"Y",
    tglPelunasan:"2023-03-02", toTgl:"2023-03-03", toUser:"bsi003",
    status:"Tertunda", mtTgl:"", mtUser:"", asTgl:"", asUser:"", catatan:"",
    pinjaman:{ tglPelunasan:"2023-03-02", awalKredit:"2023-03-03", akhirKredit:"2028-03-03",
      plafon:88000000, gajiPeserta:4400000, norekTab:"0110000364978", norekKredit:"0109000364978",
      noPk:"TO/2023/03/0010", nik:"1271010305610010", jnsTab:"Tabungan",
      cabangMitra:"KC Medan", angsuran:1500000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-BE364978.pdf", lampiranPernyataan:"Pernyataan-Kredit-BE364978.pdf" } }
];

/* ---------------------------------------------------------------------------
   11. PINJAMAN — TOP UP
   Penambahan plafon pada pinjaman yang flagging-nya masih berjalan. Mitranya
   tetap mitra yang sama — yang berubah hanya nilai kreditnya — jadi barisnya
   memakai bentuk yang sama dengan blok Flagging, ditambah `topUpKe` sebagai
   penanda top up keberapa untuk peserta tersebut.
   --------------------------------------------------------------------------- */
/* Perjalanan satu permintaan top up, sejalan dengan FTO_STATUS: "Tertunda"
   selama masih di antrean Persetujuan, lalu "Diterima" atau "Ditolak". */
const FTU_STATUS = ["Tertunda", "Diterima", "Ditolak"];

const DATA_FLAGGING_TOPUP = [
  { ind:"N", mitra:"BANK MANTAP", ktpa:"BE404972", nrp:"517141", nik:"3201042907620002",
    nomorPensiun:"201511053900", nama:"MOH. SUEB", tglLahir:"1961-11-29", topUpKe:1,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Diterima", tglSetuju:"2026-08-14 09:20:00", pengguna:"MANTAP002",
    pinjaman:{ tglPermohonan:"2026-08-12", awalKredit:"2026-08-14", akhirKredit:"2030-08-14", plafon:45000000, gajiPeserta:1500000,
      norekTab:"9301500322216", norekKredit:"9301500322216", noPk:"TU/2026/08/0001", nik:"3201042907620002",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:940000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU-BE404972.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-BE404972.pdf" } },

  { ind:"", mitra:"BANK WOORI SAUDARA", ktpa:"BZ143428", nrp:"196707181991031007", nik:"3277021807600003",
    nomorPensiun:"BZ143428111028", nama:"SUROSO", tglLahir:"1967-07-18", topUpKe:2,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Diterima", tglSetuju:"2026-06-30 14:05:00", pengguna:"WOORI011",
    pinjaman:{ tglPermohonan:"2026-06-26", awalKredit:"2026-06-30", akhirKredit:"2031-06-30", plafon:150000000, gajiPeserta:5000000,
      norekTab:"1987574317", norekKredit:"1987574317", noPk:"TU/2026/06/0002", nik:"3277021807600003",
      jnsTab:"Tabungan", cabangMitra:"KC Semarang", angsuran:3100000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-TU-BZ143428.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-BZ143428.pdf" } },

  { ind:"N", mitra:"BANK BRI", ktpa:"BE502785", nrp:"31940543120872", nik:"",
    nomorPensiun:"BE502785111022", nama:"SAMI'AN", tglLahir:"", topUpKe:1,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Ditolak", tglSetuju:"", pengguna:"",
    pinjaman:{ tglPermohonan:"2026-05-15", awalKredit:"2026-05-19", akhirKredit:"2041-05-19", plafon:260000000, gajiPeserta:10500000,
      norekTab:"0051010438675", norekKredit:"0051010842", noPk:"TU/2026/05/0003", nik:"",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:3400000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-TU-BE502785.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-BE502785.pdf" } },

  { ind:"", mitra:"BANK SMBC", ktpa:"BE416312", nrp:"615637", nik:"3171013012670001",
    nomorPensiun:"BE416312111200", nama:"ELDALIWAN", tglLahir:"1967-12-30", topUpKe:3,
    statusPinjaman:"Lunas", statusTagih:"Y", kategori:"Pelunasan dari Angsuran", status:"Diterima", tglSetuju:"2026-03-11 16:22:00", pengguna:"SMBC004",
    pinjaman:{ tglPermohonan:"2026-03-06", awalKredit:"2026-03-11", akhirKredit:"2029-03-11", plafon:110000000, gajiPeserta:4250000,
      norekTab:"0101000416312", norekKredit:"0109000416312", noPk:"TU/2026/03/0004", nik:"3171013012670001",
      jnsTab:"Tabungan", cabangMitra:"KC Jakarta Pusat", angsuran:2050000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU-BE416312.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-BE416312.pdf" } },

  { ind:"N", mitra:"BANK JATIM", ktpa:"BY124343", nrp:"196911071997032004", nik:"3301114711690004",
    nomorPensiun:"BY124343", nama:"MUSRIWATI", tglLahir:"1969-11-07", topUpKe:1,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Tertunda", tglSetuju:"", pengguna:"",
    pinjaman:{ tglPermohonan:"2026-08-20", awalKredit:"2026-08-25", akhirKredit:"2032-08-25", plafon:72000000, gajiPeserta:3600000,
      norekTab:"0201000124343", norekKredit:"0209000124343", noPk:"TU/2026/08/0005", nik:"3301114711690004",
      jnsTab:"Giro", cabangMitra:"KC Malang", angsuran:1180000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU-BY124343.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-BY124343.pdf" } },

  /* Riwayat top up KPA uji coba. TU100002 sudah sekali dan TU100003 sudah dua
     kali, jadi layar Tambahkan Top Up menghitung "Top Up Ke" jadi 2 dan 3. */
  { ind:"N", mitra:"BANK MANTAP", ktpa:"TU100002", nrp:"702345", nik:"3273010205730202",
    nomorPensiun:"201705020202", nama:"UJI TOPUP DUA", tglLahir:"1973-05-02", topUpKe:1,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Diterima", tglSetuju:"2026-07-08 10:15:00", pengguna:"MTP022",
    pinjaman:{ tglPermohonan:"2026-07-03", awalKredit:"2026-07-08", akhirKredit:"2032-07-08", plafon:120000000, gajiPeserta:4750000,
      norekTab:"0302000200002", norekKredit:"0309000200002", noPk:"TU/2026/07/2002", nik:"3273010205730202",
      jnsTab:"Giro", cabangMitra:"KC Bandung", angsuran:2050000, subKredit:"Kredit Multiguna",
      lampiranSp3r:"SP3R-TU-TU100002.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-TU100002.pdf" } },

  { ind:"", mitra:"PT POS INDONESIA", ktpa:"TU100003", nrp:"703456", nik:"3578010306710203",
    nomorPensiun:"201406030203", nama:"UJI TOPUP TIGA", tglLahir:"1971-06-03", topUpKe:1,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Diterima", tglSetuju:"2026-07-20 13:30:00", pengguna:"POS023",
    pinjaman:{ tglPermohonan:"2026-07-16", awalKredit:"2026-07-20", akhirKredit:"2033-07-20", plafon:160000000, gajiPeserta:6500000,
      norekTab:"0303000200003", norekKredit:"0309000200003", noPk:"TU/2026/07/2003", nik:"3578010306710203",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:2450000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU-TU100003-1.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-TU100003-1.pdf" } },

  { ind:"", mitra:"PT POS INDONESIA", ktpa:"TU100003", nrp:"703456", nik:"3578010306710203",
    nomorPensiun:"201406030203", nama:"UJI TOPUP TIGA", tglLahir:"1971-06-03", topUpKe:2,
    statusPinjaman:"Disetujui", statusTagih:"N", kategori:"", status:"Tertunda", tglSetuju:"", pengguna:"",
    pinjaman:{ tglPermohonan:"2026-08-19", awalKredit:"2026-08-24", akhirKredit:"2034-08-24", plafon:195000000, gajiPeserta:6500000,
      norekTab:"0303000200003", norekKredit:"0309000200003", noPk:"TU/2026/08/2004", nik:"3578010306710203",
      jnsTab:"Tabungan", cabangMitra:"KC Surabaya", angsuran:2800000, subKredit:"Kredit Pensiun",
      lampiranSp3r:"SP3R-TU-TU100003-2.pdf", lampiranPernyataan:"Pernyataan-Kredit-TU-TU100003-2.pdf" } }
];

/* ---------------------------------------------------------------------------
   12. PINJAMAN — PENAGIHAN
   Satu baris = satu batch penagihan yang dibuat untuk satu mitra bayar.
   `tglTagihan` adalah tanggal tagihannya diterbitkan, sedangkan `tglAwal` dan
   `tglAkhir` membatasi periode angsuran yang ditagih. `user`/`tglBuat` mencatat
   siapa membuatnya. Daftar peserta yang ikut tertagih ada di `peserta`, dan
   itulah yang dikumpulkan tab Peserta dari seluruh batch.

   Tiap peserta membawa dua identitas: dirinya sendiri (`ktpa`…`tglLahir`) dan
   peminjamnya (`pnNopens`, `pnNama`). Keduanya sama untuk peserta aktif dan
   pensiun sendiri; berbeda hanya pada pensiun waris, ketika yang meminjam
   adalah ahli waris — lihat pola yang sama di Check dan Booking Individu.
   --------------------------------------------------------------------------- */
const FPN_STATUS_PESERTA = ["Aktif", "Pensiun"];

/* Status penagihan per peserta: sudah diterbitkan tagihannya, sudah dibayar,
   atau gagal ditagih. `statusUser`/`statusTgl` mencatat perubahan terakhirnya. */
const FPN_STATUS_TAGIH = ["Ditagih", "Terbayar", "Gagal"];

const DATA_FLAGGING_PENAGIHAN = [
  { mitra:"BANK BJB", statusPeserta:"Semua", tglTagihan:"2018-09-18",
    tglAwal:"2017-12-01", tglAkhir:"2018-08-31", catatan:"", keterangan:"",
    user:"TiarX", tglBuat:"2018-09-18 13:32:00",
    peserta:[
      { ktpa:"BE399727", nrp:"557800", nomorPensiun:"201311047710", nama:"SUPARDI",
        tglLahir:"1959-11-04", statusPeserta:"Pensiun",
        pnNopens:"201311047710", pnNama:"SUPARDI",
        awalKredit:"2017-12-01", akhirKredit:"2022-12-01", plafon:70000000, angsuran:1250000,
        statusTagih:"Terbayar", statusUser:"TiarX", statusTgl:"2018-10-02" },
      { ktpa:"BE416312", nrp:"615637", nomorPensiun:"BE416312111200", nama:"ELDALIWAN",
        tglLahir:"1967-12-30", statusPeserta:"Pensiun",
        pnNopens:"BE416312111200", pnNama:"ELDALIWAN",
        awalKredit:"2018-01-15", akhirKredit:"2023-01-15", plafon:85000000, angsuran:1450000,
        statusTagih:"Terbayar", statusUser:"TiarX", statusTgl:"2018-10-02" }
    ] },

  { mitra:"BANK BRI", statusPeserta:"Aktif", tglTagihan:"2026-07-05",
    tglAwal:"2026-06-01", tglAkhir:"2026-06-30", catatan:"Tagihan angsuran Juni 2026.",
    keterangan:"Ditagihkan bersama potongan gaji periode Juni.",
    user:"ahmad.roji", tglBuat:"2026-07-05 09:14:00",
    peserta:[
      { ktpa:"BD316947", nrp:"544925", nomorPensiun:"", nama:"DODY ISWAHYUDIONO",
        tglLahir:"1961-10-16", statusPeserta:"Aktif",
        pnNopens:"", pnNama:"DODY ISWAHYUDIONO",
        awalKredit:"2026-07-01", akhirKredit:"2031-07-01", plafon:150000000, angsuran:1750000,
        statusTagih:"Terbayar", statusUser:"ahmad.roji", statusTgl:"2026-07-18" },
      { ktpa:"BE401859", nrp:"541451", nomorPensiun:"", nama:"TARYONO",
        tglLahir:"1962-06-20", statusPeserta:"Aktif",
        pnNopens:"", pnNama:"TARYONO",
        awalKredit:"2026-07-01", akhirKredit:"2031-07-01", plafon:90000000, angsuran:1320000,
        statusTagih:"Ditagih", statusUser:"ahmad.roji", statusTgl:"2026-07-05" },
      { ktpa:"BE502785", nrp:"31940543120872", nomorPensiun:"BE502785111022", nama:"SAMI'AN",
        tglLahir:"", statusPeserta:"Pensiun",
        pnNopens:"BE502785111022", pnNama:"SAMI'AN",
        awalKredit:"2025-10-15", akhirKredit:"2040-10-15", plafon:210000000, angsuran:2900000,
        statusTagih:"Gagal", statusUser:"ahmad.roji", statusTgl:"2026-07-20" }
    ] },

  { mitra:"BANK MANTAP", statusPeserta:"Pensiun", tglTagihan:"2026-07-06",
    tglAwal:"2026-06-01", tglAkhir:"2026-06-30", catatan:"Tagihan angsuran Juni 2026.",
    keterangan:"", user:"MANTAP002", tglBuat:"2026-07-06 10:48:00",
    peserta:[
      { ktpa:"BE404972", nrp:"517141", nomorPensiun:"201511053900", nama:"MOH. SUEB",
        tglLahir:"1961-11-29", statusPeserta:"Pensiun",
        pnNopens:"201511053900", pnNama:"MOH. SUEB",
        awalKredit:"2022-02-04", akhirKredit:"2028-02-04", plafon:30000000, angsuran:625000,
        statusTagih:"Terbayar", statusUser:"MANTAP002", statusTgl:"2026-07-19" }
    ] },

  { mitra:"PT POS INDONESIA", statusPeserta:"Pensiun", tglTagihan:"2026-08-04",
    tglAwal:"2026-07-01", tglAkhir:"2026-07-31", catatan:"",
    keterangan:"Menunggu konfirmasi rekap dari kantor cabang.",
    user:"POS003", tglBuat:"2026-08-04 15:05:00",
    peserta:[
      { ktpa:"CY104869", nrp:"197804081998032003", nomorPensiun:"PS-2019-004821", nama:"MADE WARDANI",
        tglLahir:"1978-04-08", statusPeserta:"Pensiun",
        pnNopens:"PS-2019-004821", pnNama:"MADE WARDANI",
        awalKredit:"2026-07-03", akhirKredit:"2031-07-03", plafon:60000000, angsuran:980000,
        statusTagih:"Ditagih", statusUser:"POS003", statusTgl:"2026-08-04" },
      /* Pensiun waris: yang meminjam adalah ahli warisnya, jadi Info Peminjam
         berbeda dari Info Peserta. */
      { ktpa:"CW661430", nrp:"087445", nomorPensiun:"PS-2006-000129", nama:"MOCHAMAD ZEIN",
        tglLahir:"1951-07-25", statusPeserta:"Pensiun",
        pnNopens:"PS-2006-000129-01", pnNama:"SITI AMINAH",
        awalKredit:"2026-06-19", akhirKredit:"2031-06-19", plafon:55000000, angsuran:740000,
        statusTagih:"Ditagih", statusUser:"POS003", statusTgl:"2026-08-04" }
    ] },

  { mitra:"BANK WOORI SAUDARA", statusPeserta:"Pensiun", tglTagihan:"2026-08-05",
    tglAwal:"2026-07-01", tglAkhir:"2026-07-31", catatan:"Tagihan angsuran Juli 2026.",
    keterangan:"", user:"WOORI011", tglBuat:"2026-08-05 08:37:00",
    peserta:[
      { ktpa:"BZ143428", nrp:"196707181991031007", nomorPensiun:"BZ143428111028", nama:"SUROSO",
        tglLahir:"1967-07-18", statusPeserta:"Pensiun",
        pnNopens:"BZ143428111028", pnNama:"SUROSO",
        awalKredit:"2025-10-24", akhirKredit:"2028-12-24", plafon:100000000, angsuran:2600000,
        statusTagih:"Terbayar", statusUser:"WOORI011", statusTgl:"2026-08-19" },
      { ktpa:"BY124343", nrp:"196911071997032004", nomorPensiun:"BY124343", nama:"MUSRIWATI",
        tglLahir:"1969-11-07", statusPeserta:"Pensiun",
        pnNopens:"BY124343", pnNama:"MUSRIWATI",
        awalKredit:"2025-10-20", akhirKredit:"2034-10-17", plafon:220000000, angsuran:1180000,
        statusTagih:"Ditagih", statusUser:"WOORI011", statusTgl:"2026-08-05" }
    ] }
];
