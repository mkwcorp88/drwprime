# Changelog

All notable changes to DRW Prime will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Walk-in member feature untuk FO (rekam poin via WhatsApp tanpa perlu customer punya akun)
- API endpoint `/api/front-office/add-points-by-phone` untuk menambahkan poin via nomor WA
- Auto-merge logic yang transfer semua data walk-in member ke akun registered saat customer sign up
- Auto-format nomor WhatsApp (08xxx otomatis jadi 62xxx) di frontend & backend
- Simplified UI untuk rekam poin (all-in-one form tanpa multi-step)
- Smart auto-fill nama member berdasarkan lookup nomor WA
- Real-time points preview saat input nominal spending
- WhatsApp notification integration untuk inform customer tentang poin mereka

### Changed
- UI `/front-office/rekam-poin` sekarang menggunakan single-step form (lebih cepat)
- Phone number sekarang auto-normalize ke format internasional (62xxx) untuk WhatsApp compatibility
- Profile API (`/api/profile/route.ts`) sekarang handle auto-merge walk-in members
- Member lookup sekarang triggered on blur event (lebih smooth UX)

### Fixed
- TypeScript errors di profile route (Prisma.Decimal type handling)
- TypeScript errors di members route (Prisma.UserWhereInput type)
- Build errors terkait Prisma type definitions

### Documentation
- Added `WALK_IN_MEMBER_FEATURE.md` - Complete documentation (400+ lines)
- Added `UPDATE_PHONE_FORMAT_UI.md` - Update documentation untuk simplified UI
- Added `DEPLOYMENT_GUIDE.md` - Comprehensive deployment & testing guide
- Added `CHANGELOG.md` - Version history tracking

### Technical Details
- **Database**: Menggunakan `hasAccount` flag & nullable `clerkUserId` untuk identify walk-in members
- **Phone format**: Regex validation `/^62\d{9,13}$/` setelah normalization
- **Points calculation**: `Math.floor(amount / 10000)` - 1 poin per Rp 10.000
- **Auto-merge**: Atomic database transaction untuk data consistency (transfer spending records, reservations, transactions)
- **Security**: Admin-only access untuk FO endpoints via Clerk authentication

### Migration Notes
- No database migration required (skema sudah support dari sebelumnya)
- 100% backward compatible dengan existing data
- Existing members tidak terpengaruh
- No breaking changes

---

## [1.0.0] - 2026-07-01 (Previous Version)

### Added
- Initial release DRW Prime membership system
- QR code member system
- Points tracking & tier system (SILVER, GOLD, PLATINUM)
- Front office dashboard untuk scan QR & rekam transaksi
- Member profile & spending history
- Reservation system
- Admin dashboard

### Features
- Member registration via Clerk authentication
- QR code generation untuk member identification
- Tier calculation berdasarkan total spending
- Spending records tracking
- Points accumulation system
- Member analytics

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 1.1.0 (Unreleased) | 2026-07-16 | Walk-in member + auto-merge + simplified UI |
| 1.0.0 | 2026-07-01 | Initial release |

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

**No breaking changes!** Upgrade is seamless.

**Steps:**
1. Pull latest code from repository
2. Run `npm install` (if dependencies updated)
3. Run `npm run build` to verify
4. Deploy to production
5. Train FO staff dengan new features (optional tapi recommended)

**What changes for users:**
- FO staff: New simplified UI (akan langsung kelihatan)
- Members: No visible changes (backend only)
- Customers: Bisa dapet poin walau belum punya akun (marketing benefit!)

**Database:**
- No migration needed
- Existing data tetap aman
- New fields (`hasAccount`, nullable `clerkUserId`) already exist dari before

---

## Upcoming Features (Roadmap)

### Version 1.2.0 (Planned)
- [ ] Bulk import members via Excel/CSV
- [ ] WhatsApp invitation auto-send untuk walk-in members
- [ ] Member analytics dashboard (graphs & insights)
- [ ] Export reports (spending, members, points)

### Version 1.3.0 (Planned)
- [ ] Loyalty rewards system (redeem points untuk voucher)
- [ ] Birthday notification & special offers
- [ ] Referral program (invite friend = bonus points)
- [ ] Mobile app optimization

### Version 2.0.0 (Future)
- [ ] Multi-branch support
- [ ] Advanced CRM features
- [ ] Integration dengan payment gateway
- [ ] AI-powered customer insights

---

## Contributing

Untuk suggest new features atau report bugs, contact developer team.

---

## License

Proprietary - DRW Prime © 2026 MKW Corp

---

**Maintained by:** MKW Corp  
**Last Updated:** July 16, 2026
