# Telegram Clone (Next.js + Supabase)

To'liq funksiyali Telegram-uslubidagi chat web ilova skeleti.

## Texnologiyalar

- Next.js (App Router, TypeScript)
- Tailwind CSS v4
- Supabase Auth + Database + Realtime + Storage

## Funksiyalar

- Login/parol bilan ro'yxatdan o'tish va kirish
- Google OAuth orqali kirish
- Profilni sozlash (username, ism, avatar URL)
- Telegram uslubidagi 2-panel UI (chatlar + asosiy chat)
- Light/Dark mode toggle
- Foydalanuvchi qidirish va 1-on-1 chat ochish
- Realtime xabar yuborish (refreshsiz)
- Xabar statusi (single/double check ikonkalari)
- Xabarni edit va delete qilish
- Online / Last seen holati
- Group yaratish
- Fayl va rasm yuborish (Supabase Storage)
- Saved Messages (o'z-o'ziga yozish)

## 1) Supabase sozlash

1. Supabase project oching.
2. `supabase/schema.sql` ni SQL Editor'da ishga tushiring.
3. Authentication ichida:
   - Email provider yoqilgan bo'lsin.
   - Google provider sozlang (OAuth Client ID/Secret).
4. `.env.example` nusxasidan `.env.local` yarating:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hivreewokvdmtsyoekve.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_cu-W2Ygj3FCb7951kyditw_zDQuRVfy
```

## 2) Lokal ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda oching: `http://localhost:3000`

- `/auth` - login/register sahifasi
- `/` - asosiy chat
- `/profile` - profil sozlamalari

## Eslatma

- Group yaratish tugmasi chap panelning yuqori qismida.
- Group yaratishda username'larni vergul bilan kiriting.
- Saved Messages birinchi kirishda avtomatik yaratiladi.
- Message read status hozircha UI-level (single/double check) ko'rinishida berilgan; ishlab chiqarish uchun alohida `message_reads` update oqimini qo'shish tavsiya qilinadi.
