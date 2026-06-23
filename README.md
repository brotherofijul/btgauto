# BTG Auto

Alat otomatisasi untuk game berbasis teks. Dijalankan lewat antarmuka web — tinggal buka, isi token, tekan mulai.

---

## Persyaratan

- **Node.js** 22.0.0+
- **PC** (Linux/macOS/Windows) atau **Android via Termux**

---

## Instalasi di Termux

```bash
termux-change-repo
pkg update && pkg upgrade -y
pkg install git nodejs -y
npm install -g https://github.com/brotherofijul/btgauto.git
```

## Instalasi di PC

```bash
npm install -g https://github.com/brotherofijul/btgauto.git
```

Untuk update ke versi terbaru, jalankan ulang perintah instalasi di atas.

---

## Cara Mendapatkan Bearer Token

### Via Browser (Android)

1. Unduh **Via Browser** dari Play Store.
2. Buka **Setelan** → **Skrip** → tekan **+** → **Impor dari URL**:
   ```
   https://github.com/brotherofijul/btgauto/raw/main/bearer-token-extractor.user.js
   ```
3. Buka situs game lewat Via Browser, login seperti biasa.
4. Sidebar baru akan muncul — tekan **Salin** untuk menyimpan token.

### PC

Buka DevTools browser (F12) → tab **Network** → lakukan aksi di game → cari request dengan header `Authorization: Bearer ...` → salin tokennya.

---

## Penggunaan

Jalankan perintah ini di terminal:

```bash
btgauto
```

Browser akan otomatis terbuka. Kalau tidak, buka manual:

```
http://localhost:7823
```

Di layar utama:

- **Mode** — pilih game target (saat ini: Diplomacia).
- **2 Slot Akun** — masing-masing bisa diisi token berbeda dan berjalan bersamaan.
- **Token** — tempel bearer token yang sudah disalin.
- **Skill** — pilih yang ingin dinaikkan: Barak, Teknik Perang, atau Ilmuan.
- **Bayar** — pilih metode: Uang atau Diamond.
- **Log** — panel kanan menampilkan aktivitas secara langsung.

Tekan **Mulai** untuk memulai, **Stop** untuk menghentikan. Untuk mematikan server, tekan `Ctrl + C` di terminal.

### Statistik per Slot

| Kolom       | Arti                         |
| ----------- | ---------------------------- |
| **Current** | Level skill saat ini         |
| **Next**    | Level yang sedang dikerjakan |
| **Time**    | Hitung mundur sampai selesai |

Waktu dihitung dari server game. Jika halaman di-refresh, countdown tetap lanjut — tidak direset ulang.

---

## Cara Kerja

1. BTG Auto mengirim permintaan upgrade ke API game secara berulang sesuai cooldown.
2. Setiap upgrade berhasil muncul di panel log: `[Barak] Lv.2 → Lv.3`.
3. Jeda acak (jitter) ditambahkan di luar cooldown bawaan game untuk mengurangi risiko deteksi bot.
4. Jika koneksi gagal atau server error, BTG Auto tidak berhenti — tunggu sebentar lalu coba lagi otomatis.
5. Dua slot akun berjalan independen, bisa pakai token dan pengaturan berbeda secara bersamaan.
