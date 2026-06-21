# BTG Auto

BTG Auto adalah aplikasi berbasis antarmuka baris perintah (Command Line Interface/CLI) yang dirancang untuk melakukan otomatisasi proses pada game berbasis teks (text-based game). Aplikasi ini dibangun menggunakan runtime Node.js dengan memanfaatkan pustaka scraping dan HTTP client tingkat lanjut guna mensimulasikan aktivitas pembaruan komponen dalam game secara efisien dan aman.

---

## Persyaratan Sistem

Sebelum melakukan instalasi, pastikan lingkungan eksekusi Anda telah memenuhi spesifikasi minimum berikut:
* **Node.js**: Versi 22.0.0 atau yang lebih baru.
* **Package Manager**: npm (bawaan dari instalasi Node.js).
* **Lingkungan Sistem**: Perangkat PC (Linux/macOS/Windows) atau perangkat Android yang menggunakan aplikasi **Termux**.

---

## Panduan Instalasi pada Termux (Android)

Ikuti langkah-langkah di bawah ini secara berurutan untuk melakukan instalasi BTG Auto pada lingkungan Termux:

### 1. Mengonfigurasi Repositori Termux
Pastikan repositori Termux Anda diarahkan pada server mirror yang stabil dengan menjalankan perintah berikut, lalu pilih opsi yang sesuai:
```bash
termux-change-repo

```
### 2. Memperbarui Paket Sistem
Lakukan pembaruan indeks paket dan peningkatan versi paket sistem yang terinstal. Jika muncul konfirmasi selama proses berlangsung, masukkan pilihan y lalu tekan Enter:
```bash
pkg update && pkg upgrade -y

```
### 3. Menginstal Dependensi Utama
Instal pustaka Git untuk mengunduh kode sumber dan Node.js sebagai runtime eksekusi:
```bash
pkg install git nodejs -y

```
### 4. Menginstal BTG Auto Secara Global
Instal aplikasi ini langsung dari repositori GitHub secara global agar perintah eksekusi dapat diakses dari direktori mana pun di dalam sistem:
```bash
npm install -g https://github.com/brotherofijul/btgauto.git

```

## Panduan Mendapatkan Bearer Token
Aplikasi ini membutuhkan Bearer Token akun Anda untuk dapat melakukan interaksi dengan API server game. Token tersebut dapat diambil dengan mudah melalui perangkat Android menggunakan bantuan browser pihak ketiga yang mendukung injeksi skrip.
### 1. Pemasangan Ekstensi Skrip pada Browser
 1. Unduh dan instal aplikasi **Via Browser** melalui Google Play Store.
 2. Buka aplikasi Via Browser, kemudian masuk ke menu **Setelan**.
 3. Pilih menu **Skrip**, lalu tekan tombol tambah (**+**).
 4. Pilih opsi **Impor dari URL** dan masukkan tautan skrip berikut:
```text
https://github.com/brotherofijul/btgauto/raw/main/bearer-token-extractor.user.js

```

### 2. Pengambilan Token Akses
 1. Akses situs web game target Anda (contoh: diplomacia) melalui Via Browser, lalu lakukan proses login seperti biasa.
 2. Setelah berhasil masuk ke halaman utama game, skrip yang telah dipasang sebelumnya akan memunculkan sebuah bilah samping (*sidebar*) baru pada antarmuka web.
 3. Tekan tombol **Salin** yang tersedia pada bilah samping tersebut untuk menyalin Bearer Token Anda ke *clipboard*. Simpan token ini untuk digunakan pada tahap eksekusi perintah.
## Panduan Penggunaan
Setelah instalasi global berhasil dan Bearer Token telah didapatkan, Anda dapat menjalankan aplikasi menggunakan perintah btgauto diikuti dengan argumen serta opsi yang diperlukan.
### Argumen dan Opsi Perintah
```bash
btgauto -g <nama_game> -a <token> [opsi_tambahan]

```
| Opsi / Flag | Tipe Data | Deskripsi | Nilai Default | Status |
|---|---|---|---|---|
| -g, --game | string | Nama game target yang akan dijalankan (contoh: diplomacia) | *Tidak ada* | **Wajib** |
| -a, --authorization | string | Bearer Token autentikasi akun game Anda | *Tidak ada* | **Wajib** |
| -s, --skill | number | Pilihan jenis skill: 1 (Barak), 2 (Teknik Perang), 3 (Ilmuwan) | 3 | Opsional |
| -p, --pay | number | Pilihan metode pembayaran: 1 (Uang), 2 (Berlian) | 1 | Opsional |
| -d, --debug | *None* | Mengaktifkan pelacakan kesalahan detail (debug mode) | *False* | Opsional |
### Contoh Eksekusi Perintah
#### 1. Otomatisasi Standar
Menjalankan otomatisasi pada game diplomacia untuk menaikkan level skill **Ilmuwan** menggunakan metode pembayaran **Uang**:
```bash
btgauto -g diplomacia -a "ISI_BEARER_TOKEN_ANDA"

```
#### 2. Kustomisasi Parameter Skill dan Pembayaran
Menjalankan otomatisasi pada game diplomacia untuk menaikkan level skill **Teknik Perang** (-s 2) menggunakan metode pembayaran **Berlian** (-p 2):
```bash
btgauto -g diplomacia -a "ISI_BEARER_TOKEN_ANDA" -s 2 -p 2

```
#### 3. Eksekusi dengan Mode Pelacakan (Debug)
Menampilkan detail kesalahan struktur data atau respons mentah dari server jika terjadi kegagalan koneksi:
```bash
btgauto -g diplomacia -a "ISI_BEARER_TOKEN_ANDA" -d

```
## Mekanisme Kerja Sistem
Aplikasi ini bekerja menggunakan sistem siklus berkelanjutan (looping) dengan karakteristik sebagai berikut:
 1. **Siklus Otomatisasi**: Aplikasi mengirimkan permintaan pembaruan secara berkala ke API server target dengan membawa token autentikasi dan payload yang sesuai.
 2. **Pencatatan Log Progres**: Setiap kali proses peningkatan berhasil, terminal akan menampilkan informasi jenis skill, level saat ini, target level, serta durasi waktu tunggu bawaan game, contoh:
   [Ilmuwan]: 45 -> 46 (00:15:30)
 3. **Interval Acak (Anti-Bot Jitter)**: Untuk meminimalkan risiko deteksi bot oleh sistem keamanan server, aplikasi secara otomatis menambahkan waktu jeda acak (jitter) di luar waktu tunggu bawaan game sebelum mengeksekusi siklus berikutnya.
 4. **Manajemen Kesalahan (Error Handling)**: Jika terjadi gangguan jaringan atau kegagalan respons dari server, aplikasi tidak akan berhenti secara paksa, melainkan memasuki mode penundaan aman sebelum mencoba kembali secara otomatis.
 5. **Penghentian Aplikasi**: Eksekusi program dapat dihentikan secara aman kapan saja oleh pengguna dengan menekan kombinasi tombol Ctrl + C pada terminal.