-- A2: resepsiyon rolu. ADD VALUE ayni islemde kullanilmaz; veri degisikligi yok.
-- Geri alma: PostgreSQL enum degerini silmeyi desteklemez; kullanilmayan deger zararsizdir (receptionist atanmis kullanici yoksa).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'receptionist' AFTER 'manager';
