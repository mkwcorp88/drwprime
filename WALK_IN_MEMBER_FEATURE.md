# Fitur Walk-in Member & Auto-Merge Points

## 🎯 Tujuan Fitur

Mengatasi masalah customer yang belum daftar akun tapi sudah treatment di klinik. Dengan fitur ini:

1. **FO (Front Office) bisa menambahkan poin** untuk customer yang belum daftar akun (via nomor WhatsApp)
2. **Poin tersimpan di database** linked ke nomor WA customer
3. **Ketika customer daftar akun nanti**, semua poin & history spending akan **otomatis ter-merge** ke akun barunya

## 📋 Flow Lengkap

### Scenario 1: Customer Treatment Sebelum Daftar

```
1. Customer datang treatment (belum punya akun DRW Prime)
2. FO input:
   - Nomor WhatsApp: 628123456789
   - Nama: Jane Doe
   - Nominal spending: Rp 500.000
   - Treatment: Facial Acne (optional)

3. Sistem:
   ✅ Auto-create member baru (walk-in member, hasAccount=false)
   ✅ Hitung poin: 500.000 / 10.000 = 50 poin
   ✅ Simpan ke database: SpendingRecord + Update User.points
   ✅ Generate QR token untuk member
   ✅ Kirim WA notification (jika ada WhatsApp integration)

4. Customer pulang dengan 50 poin tercatat di sistem
```

### Scenario 2: Customer Daftar Akun (Auto-Merge)

```
1. Beberapa hari kemudian, customer daftar akun via app/website
2. Customer sign up dengan email & password (via Clerk)
3. Customer complete profile → input nomor WhatsApp yang sama: 628123456789

4. Sistem deteksi:
   ✅ Nomor WA 628123456789 sudah ada di database (walk-in member)
   ✅ Walk-in member ini belum punya Clerk account (clerkUserId = null)
   ✅ Trigger auto-merge!

5. Auto-Merge Process:
   ✅ Transfer semua SpendingRecord dari walk-in member ke akun baru
   ✅ Transfer semua Reservation dari walk-in member ke akun baru
   ✅ Transfer semua Transaction history
   ✅ Increment points & totalSpending
   ✅ Delete old walk-in member record
   ✅ Customer sekarang punya akun lengkap dengan history poin lengkap!

6. Customer bisa langsung lihat:
   - Total poin: 50 poin (dari treatment sebelumnya)
   - History spending: Rp 500.000 - Facial Acne
   - Membership tier: Silver/Gold/Platinum (based on spending)
```

## 🔧 Komponen Teknis

### 1. API Endpoint Baru

**`POST /api/front-office/add-points-by-phone`**

Endpoint all-in-one untuk FO menambahkan poin via nomor WhatsApp.

**Request Body:**
```json
{
  "phone": "628123456789",
  "firstName": "Jane",
  "lastName": "Doe",
  "amount": 500000,
  "treatment": "Facial Acne",
  "date": "2026-07-16"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Member baru berhasil didaftarkan dan 50 poin telah ditambahkan",
  "isNewMember": true,
  "pointsEarned": 50,
  "member": {
    "id": "cm...",
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "628123456789",
    "points": 50,
    "totalSpending": 500000,
    "hasAccount": false,
    "tier": "SILVER",
    "qrToken": "uuid..."
  },
  "spendingRecord": {
    "id": "sr...",
    "amount": 500000,
    "treatment": "Facial Acne",
    "spendingDate": "2026-07-16T00:00:00.000Z",
    "pointsEarned": 50
  },
  "tierUpgrade": null
}
```

**Fitur:**
- ✅ Auto-create member baru jika nomor WA belum terdaftar
- ✅ Update member existing jika nomor sudah ada
- ✅ Auto-calculate poin (1 poin per Rp 10.000)
- ✅ Auto-calculate membership tier (Silver/Gold/Platinum)
- ✅ Send WhatsApp notification (spending + tier upgrade)
- ✅ Generate QR token untuk member baru

**Validasi:**
- Phone format: `62xxxxxxxxx` (tanpa spasi/tanda)
- Amount: harus > 0
- firstName: wajib untuk member baru

**Location:** `/src/app/(frontend)/api/front-office/add-points-by-phone/route.ts`

---

### 2. Auto-Merge Logic di Profile Update

**File:** `/src/app/(frontend)/api/profile/route.ts`

**Trigger:** Ketika user pertama kali mengisi/update nomor phone di profile

**Logic:**
```typescript
1. Cek apakah phone number berubah
2. Jika phone berubah:
   a. Cari walk-in member dengan phone yang sama
   b. Jika ditemukan & belum punya Clerk account:
      - Transfer all spending records
      - Transfer all reservations (as customer & as referrer)
      - Transfer all transactions
      - Transfer all voucher redemptions
      - Transfer all event registrations
      - Transfer all bank accounts
      - Transfer all withdrawals
      - Increment points & totalSpending
      - Delete old walk-in member record
      - Log merge success
   c. Jika phone sudah dipakai akun lain (has Clerk):
      - Return error 409: "Nomor HP sudah digunakan"
```

**Database Transaction:**
Semua transfer dilakukan dalam 1 transaction untuk memastikan consistency.

---

### 3. UI Front Office

**Page:** `/front-office/rekam-poin`

**Fitur:**
- Tab 1: **Scan QR Member** (untuk member yang sudah punya QR)
- Tab 2: **Input Manual (WA/Nama)** ← **FITUR BARU**

**Flow Input Manual:**
```
1. FO input nomor WhatsApp (62xxx)
2. FO input nama customer (opsional jika sudah terdaftar)
3. Klik "Cari / Daftar Member"
4. Sistem:
   - Jika member sudah ada → tampilkan info member (poin, tier, spending)
   - Jika member baru → tampilkan form untuk daftar + rekam poin
5. FO input:
   - Nominal spending (required)
   - Treatment (optional)
6. Klik "Rekam Poin" atau "Daftar & Rekam Poin"
7. Success! Member dapat poin
```

**Improvements:**
- ✅ Auto-create member jika belum terdaftar (tidak perlu 2 langkah)
- ✅ Pakai API baru yang lebih efisien
- ✅ Tampilkan notifikasi tier upgrade
- ✅ Warning jika member belum punya akun (agar encourage mereka daftar)

**Location:** `/src/app/(frontend)/front-office/rekam-poin/page.tsx`

---

## 🗄️ Database Schema

### Model: User

**Key Fields untuk Walk-in Member:**
```prisma
model User {
  id                String         @id @default(cuid())
  clerkUserId       String?        @unique  // NULL untuk walk-in customer
  phone             String         @unique  // PRIMARY IDENTIFIER
  hasAccount        Boolean        @default(false)  // FALSE untuk walk-in
  qrToken           String?        @unique  // Auto-generated untuk semua member
  
  points            Int            @default(0)
  totalSpending     Decimal        @default(0)
  lastTransactionAt DateTime?
  
  spendingRecords   SpendingRecord[]
  // ... relations lainnya
}
```

**Indicator Walk-in Member:**
- `hasAccount = false`
- `clerkUserId = null`
- `phone` tetap required (unique identifier)

---

### Model: SpendingRecord

```prisma
model SpendingRecord {
  id                String    @id @default(cuid())
  userId            String
  amount            Decimal
  pointsEarned      Int
  treatment         String?
  spendingDate      DateTime
  recordedByClerkId String?   // Admin/FO yang input
  source            String    @default("front_office")  // scan | front_office
  
  user              User      @relation(...)
}
```

**Source values:**
- `"scan"` - via QR scan
- `"front_office"` - via manual input FO
- `"reservation"` - dari completed reservation

---

## 📊 Membership Tier Calculation

**Thresholds:**
```typescript
SILVER: Rp 0 - Rp 999.999
GOLD: Rp 1.000.000 - Rp 4.999.999
PLATINUM: Rp 5.000.000+
```

**Points Calculation:**
```typescript
1 poin = Rp 10.000 spending
Contoh: 
  - Rp 500.000 = 50 poin
  - Rp 1.250.000 = 125 poin
  - Rp 75.000 = 7 poin (pembulatan ke bawah)
```

**Auto-upgrade:**
Tier otomatis naik saat totalSpending mencapai threshold. Customer akan dapat notification WA saat tier upgrade.

---

## 🔒 Security & Validation

### Phone Number Validation
```
Format: 62xxxxxxxxx (10-14 digit)
Regex: /^62\d{9,13}$/
Contoh valid:
  ✅ 628123456789
  ✅ 6281234567890
Contoh invalid:
  ❌ 0812345678 (harus pakai 62)
  ❌ 62 812 345 6789 (tidak boleh spasi)
  ❌ +628123456789 (tidak pakai +)
```

### Duplicate Prevention
- Phone number **unique** di database
- Jika nomor sudah terdaftar dengan Clerk account → error 409
- Jika nomor sudah terdaftar sebagai walk-in → auto-merge

### Admin Authorization
Semua endpoint FO require:
```typescript
if (!(await isUserAdmin())) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## 🧪 Testing Checklist

### Test 1: Create Walk-in Member
```
✅ Input nomor WA baru: 628999999999
✅ Input nama: Test Customer
✅ Input spending: Rp 500.000
✅ Submit
✅ Verify: Member baru terbuat (id, phone, points=50, hasAccount=false)
✅ Verify: SpendingRecord terbuat (amount=500000, pointsEarned=50)
```

### Test 2: Add Points to Existing Walk-in
```
✅ Input nomor WA yang sama: 628999999999
✅ Input spending: Rp 300.000
✅ Submit
✅ Verify: Points bertambah (50 → 80)
✅ Verify: TotalSpending bertambah (500k → 800k)
```

### Test 3: Auto-Merge saat Sign Up
```
✅ Sign up akun baru via /sign-up
✅ Complete profile dengan phone: 628999999999
✅ Verify: User.hasAccount = true
✅ Verify: User.clerkUserId = <clerk_id>
✅ Verify: Points terbawa (80 poin)
✅ Verify: TotalSpending terbawa (Rp 800.000)
✅ Verify: SpendingRecord history lengkap (2 records)
✅ Verify: Old walk-in member deleted
```

### Test 4: Tier Upgrade Notification
```
✅ Walk-in member spending: Rp 900.000 (tier: SILVER)
✅ Add spending: Rp 200.000
✅ Verify: Tier upgrade to GOLD
✅ Verify: Notification sent (jika WA integration aktif)
```

### Test 5: Error Handling
```
✅ Phone format invalid (08123) → Error 400
✅ Amount = 0 → Error 400
✅ Phone sudah dipakai akun lain → Error 409
✅ Unauthorized access (non-admin) → Error 401
```

---

## 📱 WhatsApp Notification Integration

**Trigger notifications:**
1. **Spending Notification** - Setiap kali poin ditambahkan
2. **Tier Upgrade Notification** - Saat tier naik (Silver→Gold→Platinum)
3. **First Transaction** - Khusus untuk transaksi pertama member

**Message Template (Spending):**
```
✨ *Transaksi Berhasil Dicatat!*

Halo {{memberName}},
Terima kasih telah treatment di DRW Prime!

📋 *Detail Transaksi:*
• Treatment: {{treatment}}
• Nominal: Rp {{amount}}
• Poin diperoleh: +{{pointsEarned}}

💎 *Status Membership:*
• Total Poin: {{totalPoints}}
• Total Spending: Rp {{totalSpending}}
• Tier: {{tier}}

{{#isWalkIn}}
⚠️ Anda belum punya akun DRW Prime.
Daftar sekarang untuk akses fitur eksklusif:
https://drwprime.com/sign-up
{{/isWalkIn}}

Transaksi ke-{{transactionCount}} Anda.
Terima kasih! 🙏
```

**Implementation:** `/src/lib/whatsapp.ts`

---

## 🚀 Deployment Notes

### Build & Deploy
```bash
# Test build locally
npm run build

# Deploy to Vercel (auto via GitHub)
git add .
git commit -m "feat: add walk-in member with auto-merge points"
git push origin main
```

### Environment Variables
Tidak ada env var baru yang diperlukan. Fitur ini menggunakan:
- ✅ DATABASE_URL (sudah ada)
- ✅ CLERK_SECRET_KEY (sudah ada)
- ✅ WhatsApp API credentials (jika WA notification aktif)

### Database Migration
Tidak perlu migration baru. Fitur ini menggunakan schema yang sudah ada:
- ✅ User model (sudah support walk-in via hasAccount flag)
- ✅ SpendingRecord model (sudah ada)
- ✅ Transaction model (sudah ada)

---

## 📝 Best Practices untuk FO

### Do's ✅
1. **Selalu gunakan format phone 62xxx** (bukan 08xxx)
2. **Input nama lengkap** untuk member baru (untuk tracking)
3. **Input treatment detail** jika memungkinkan (untuk analytics)
4. **Verifikasi poin** setelah input (cek dashboard member)
5. **Encourage customer daftar akun** untuk benefit lebih

### Don'ts ❌
1. ❌ Jangan input nomor WA yang salah (akan create duplicate member)
2. ❌ Jangan skip nominal spending (wajib untuk hitung poin)
3. ❌ Jangan manual edit database (gunakan UI FO)
4. ❌ Jangan share akses FO ke non-admin

---

## 🔄 Future Enhancements

### Phase 2 (Planned)
- [ ] QR Scanner integration (hardware/camera)
- [ ] Bulk import spending via Excel
- [ ] Auto-send WA invitation untuk walk-in member
- [ ] Member detail modal di FO (view full history)
- [ ] Export member data ke Excel
- [ ] Dashboard analytics: walk-in vs registered members

### Phase 3 (Ideas)
- [ ] Loyalty rewards redemption via poin
- [ ] Birthday discount automation
- [ ] Member referral program untuk walk-in
- [ ] SMS notification (backup untuk WA)

---

## 🐛 Troubleshooting

### Issue: Member tidak ditemukan setelah input
**Solution:**
- Cek phone format (harus 62xxx, bukan 08xxx)
- Cek koneksi database
- Cek log API: `/api/front-office/add-points-by-phone`

### Issue: Auto-merge tidak jalan
**Solution:**
- Pastikan customer input phone yang SAMA persis
- Cek log: `[PROFILE-MERGE] Found walk-in member...`
- Verify walk-in member `clerkUserId = null`
- Cek database transaction log

### Issue: Duplicate member created
**Solution:**
- Database constraint akan prevent duplicate phone
- Jika terjadi, manual delete via database (bukan UI)
- Report ke developer untuk investigation

### Issue: Poin tidak sesuai
**Solution:**
- Formula: Math.floor(amount / 10000)
- Contoh: 575.000 → 57 poin (bukan 57.5)
- Jika salah input amount, tidak bisa di-undo via UI
- Harus manual adjust via database atau create correction record

---

## 📞 Contact & Support

**Developer:** MKW Corp
**Repository:** https://github.com/MKWcorp/drwprime
**Documentation:** `/WALK_IN_MEMBER_FEATURE.md`

**For support:**
- Technical issues → Create GitHub issue
- Business questions → Contact DRW Prime admin
- Emergency bugs → Contact developer directly

---

**Last Updated:** July 16, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
