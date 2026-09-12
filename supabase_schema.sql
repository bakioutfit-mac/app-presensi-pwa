-- =======================================================
-- SCHEMA SQL PWA PRESENSI STAF - 3 PILLAR MANAGEMENT
-- (LAZYBLOOM, DERU OMBAK, SEA CAFE)
-- Jalankan skrip ini di SQL Editor Dashboard Supabase Anda
-- =======================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL ADMIN SETTINGS (KUNCI PIN ADMIN LEADER & ADMIN FINANCE)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) UNIQUE NOT NULL, -- 'leader' | 'finance'
    pin VARCHAR(10) NOT NULL,          -- 6 digit PIN (misal: 112233, 445566)
    name VARCHAR(100) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABEL OUTLETS CONFIG (KOORDINAT GPS LATITUDE & LONGITUDE 3 OUTLET)
CREATE TABLE IF NOT EXISTS public.outlets_config (
    id VARCHAR(50) PRIMARY KEY, -- 'lazybloom', 'deru-ombak', 'sea-cafe'
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 50 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABEL EMPLOYEES (STAF 3 OUTLET & ADMIN)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. LZY_0021, DRU_0015, SEA_0009
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    pin VARCHAR(10) NOT NULL DEFAULT '123456', -- 6 digit PIN staf
    role VARCHAR(30) NOT NULL DEFAULT 'staff', -- 'staff', 'admin_leader', 'admin_finance', 'admin'
    position VARCHAR(100) DEFAULT 'Barista',
    branch VARCHAR(100) DEFAULT 'LazyBloom', -- 'LazyBloom', 'Deru Ombak', 'Sea Cafe'
    birth_date VARCHAR(50) DEFAULT '21 November 1998',
    address TEXT DEFAULT 'Jl. Ir Moh Hatta, Candiareng Perumahan candi wanamas',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABEL ATTENDANCE (PRESENSI SELFIE & GPS)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    branch VARCHAR(100) DEFAULT 'LazyBloom',
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_photo TEXT,
    check_out_photo TEXT,
    check_in_lat NUMERIC,
    check_in_lng NUMERIC,
    check_out_lat NUMERIC,
    check_out_lng NUMERIC,
    status VARCHAR(30) DEFAULT 'Hadir', -- 'Hadir', 'Terlambat', 'Izin', 'Sakit'
    working_hours_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, attendance_date)
);

-- 6. TABEL LEAVES (IZIN / CUTI / SAKIT)
CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    branch VARCHAR(100) DEFAULT 'LazyBloom',
    leave_type VARCHAR(50) NOT NULL, -- 'Sakit', 'Cuti Tahunan', 'Izin Terlambat', 'Izin Pulang Cepat', 'Lainnya'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    late_duration_minutes INTEGER DEFAULT 0,
    reason TEXT,
    document_url TEXT,
    status VARCHAR(20) DEFAULT 'Disetujui', -- 'Menunggu', 'Disetujui', 'Ditolak'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABEL SHIFTS (JADWAL SHIFT KERJA)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    branch VARCHAR(100) DEFAULT 'LazyBloom',
    shift_date DATE NOT NULL,
    shift_name VARCHAR(50) NOT NULL, -- 'Shift Pagi (08:00 - 16:00)', 'Shift Siang (14:00 - 22:00)', 'Libur/Off'
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, shift_date)
);

-- 8. TABEL PAYSLIPS (SLIP GAJI 10 KOMPONEN RESMI OUTLET)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL, -- e.g. 'Agustus 2026', 'September 2026'
    period_start DATE,
    period_end DATE,
    -- 7 Komponen Pendapatan (6 Komponen Pokok & Tunjangan + Lembur + Perbantuan +Day):
    basic_salary NUMERIC NOT NULL DEFAULT 3500000,
    child_allowance NUMERIC NOT NULL DEFAULT 0,
    spouse_allowance NUMERIC NOT NULL DEFAULT 0,
    position_allowance NUMERIC NOT NULL DEFAULT 0,
    meal_allowance NUMERIC NOT NULL DEFAULT 0,
    overtime_pay NUMERIC NOT NULL DEFAULT 0,
    plus_day_count INTEGER NOT NULL DEFAULT 0, -- Jumlah hari kerja saat jadwal libur / event
    plus_day_pay NUMERIC NOT NULL DEFAULT 0, -- Total uang perbantuan (+Day) fleksibel
    plus_day_note TEXT, -- Catatan event/perbantuan
    -- 4 Komponen Potongan:
    meal_deduction NUMERIC NOT NULL DEFAULT 0,
    attendance_deduction NUMERIC NOT NULL DEFAULT 0,
    discipline_deduction NUMERIC NOT NULL DEFAULT 0, -- Denda flat Rp 10.000 / kejadian terlambat (toleransi 10 menit)
    cash_bon NUMERIC NOT NULL DEFAULT 0,
    -- Gaji Bersih:
    net_salary NUMERIC NOT NULL DEFAULT 3500000,
    is_released BOOLEAN NOT NULL DEFAULT false, -- true = bisa dibuka staf, false = bergembok
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_employee_period UNIQUE (employee_id, period)
);

-- 9. TABEL OVERTIMES (PENGAJUAN LEMBUR STAF DARI LEADER KE FINANCE)
CREATE TABLE IF NOT EXISTS public.overtimes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150),
    branch VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours NUMERIC NOT NULL DEFAULT 1,
    reason TEXT,
    nominal NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Diajukan Leader', -- 'Diajukan Leader', 'Disetujui Finance', 'Ditolak Finance'
    rejection_reason TEXT,
    approved_by VARCHAR(50),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =======================================================
-- STORAGE BUCKETS (Maksimal Foto 2MB Full HD)
-- =======================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('leave-documents', 'leave-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Idempotent: Drop if exists then create)
DROP POLICY IF EXISTS "Public Read Attendance Photos" ON storage.objects;
CREATE POLICY "Public Read Attendance Photos" ON storage.objects FOR SELECT USING (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Public Upload Attendance Photos" ON storage.objects;
CREATE POLICY "Public Upload Attendance Photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Public Read Leave Documents" ON storage.objects;
CREATE POLICY "Public Read Leave Documents" ON storage.objects FOR SELECT USING (bucket_id = 'leave-documents');

DROP POLICY IF EXISTS "Public Upload Leave Documents" ON storage.objects;
CREATE POLICY "Public Upload Leave Documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'leave-documents');

-- =======================================================
-- ROW LEVEL SECURITY (RLS) & IZINKAN AKSES ANON
-- =======================================================
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on admin_settings" ON public.admin_settings;
CREATE POLICY "Allow public all on admin_settings" ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on outlets_config" ON public.outlets_config;
CREATE POLICY "Allow public all on outlets_config" ON public.outlets_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on employees" ON public.employees;
CREATE POLICY "Allow public all on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on attendance" ON public.attendance;
CREATE POLICY "Allow public all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on leaves" ON public.leaves;
CREATE POLICY "Allow public all on leaves" ON public.leaves FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on shifts" ON public.shifts;
CREATE POLICY "Allow public all on shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on payslips" ON public.payslips;
CREATE POLICY "Allow public all on payslips" ON public.payslips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on overtimes" ON public.overtimes;
CREATE POLICY "Allow public all on overtimes" ON public.overtimes FOR ALL USING (true) WITH CHECK (true);

-- =======================================================
-- SEED DATA AWAL: ADMIN PIN & KOORDINAT 3 OUTLET
-- =======================================================

-- 1. PIN Default Admin Leader (112233) & Admin Finance (445566)
INSERT INTO public.admin_settings (role, pin, name, description)
VALUES 
(
    'leader', 
    '112233', 
    'Admin Leader', 
    'Akses Otorisasi: Jadwal Shift, Monitoring Kehadiran, Tambah Karyawan'
),
(
    'finance', 
    '445566', 
    'Admin Finance', 
    'Akses Otorisasi: Input & Kelola Gaji 3 Outlet, Pengaturan Titik GPS Lat/Lng'
)
ON CONFLICT (role) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- 2. Koordinat GPS Resmi 3 Cabang Outlet (LazyBloom, Deru Ombak, Sea Cafe)
INSERT INTO public.outlets_config (id, name, address, latitude, longitude, radius_meters)
VALUES
(
    'lazybloom', 
    'LazyBloom', 
    'Jl. Gandaria I No. 63, Kebayoran Baru, Jakarta Selatan', 
    -6.243500, 
    106.791500, 
    50
),
(
    'deru-ombak', 
    'Deru Ombak', 
    'Jl. Pantai Indah Kapuk No. 88, Penjaringan, Jakarta Utara', 
    -6.110500, 
    106.748200, 
    60
),
(
    'sea-cafe', 
    'Sea Cafe', 
    'Jl. Dermaga Pelabuhan Bahari No. 12, Ancol, Jakarta Utara', 
    -6.121800, 
    106.832200, 
    50
)
ON CONFLICT (id) DO UPDATE SET 
    latitude = EXCLUDED.latitude, 
    longitude = EXCLUDED.longitude, 
    radius_meters = EXCLUDED.radius_meters, 
    address = EXCLUDED.address;

-- 3. Akun Karyawan & Akun Admin 3 Pillar Management
INSERT INTO public.employees (
    employee_id, full_name, phone, pin, role, position, branch, birth_date, address
) VALUES 
-- Staf Outlet LazyBloom (Pilar Oranye)
(
    'LZY_0021', 
    'Fikril Bay', 
    '085775560400', 
    '123456', 
    'staff', 
    'Barista Senior', 
    'LazyBloom', 
    '21 November 1998', 
    'Jl. Ir Moh Hatta No. 12, Candiareng'
),
-- Staf Outlet Deru Ombak (Pilar Hijau)
(
    'DRU_0015', 
    'Bagas Pratama', 
    '081233445566', 
    '123456', 
    'staff', 
    'Head Kitchen', 
    'Deru Ombak', 
    '15 Maret 1997', 
    'Kawasan Wisata Bahari Blok A3, Pantai Indah'
),
-- Staf Outlet Sea Cafe (Pilar Biru)
(
    'SEA_0009', 
    'Rian Bahari', 
    '081998877665', 
    '123456', 
    'staff', 
    'Barista & Gelato', 
    'Sea Cafe', 
    '04 Juli 2000', 
    'Jl. Dermaga Pelabuhan No. 8'
),
-- Akun Admin Leader
(
    'ADM_LDR1', 
    'Admin Leader Operational', 
    '081122334455', 
    '112233', 
    'admin_leader', 
    'Operational Area Leader', 
    '3 Pillar HQ', 
    '10 Januari 1993', 
    'Jl. Pemuda No. 88, 3 Pillar HQ'
),
-- Akun Admin Finance
(
    'ADM_FIN1', 
    'Admin Finance Payroll', 
    '081199887766', 
    '445566', 
    'admin_finance', 
    'Finance & Payroll Manager', 
    '3 Pillar HQ', 
    '15 Mei 1994', 
    'Jl. Pemuda No. 88, 3 Pillar HQ'
)
ON CONFLICT (phone) DO NOTHING;

-- 4. Seed contoh slip gaji & shift untuk Fikril Bay (LazyBloom)
DO $$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id FROM public.employees WHERE phone = '085775560400' LIMIT 1;
    IF emp_id IS NOT NULL THEN
        -- Slip Agustus 2026 (Sudah Rilis - Insert jika belum ada)
        IF NOT EXISTS (SELECT 1 FROM public.payslips WHERE employee_id = emp_id AND period = 'Agustus 2026') THEN
            INSERT INTO public.payslips (employee_id, period, basic_salary, attendance_allowance, transport_allowance, overtime_pay, deductions, net_salary, is_released, payment_date)
            VALUES (emp_id, 'Agustus 2026', 3500000, 500000, 300000, 250000, 100000, 4450000, true, '2026-08-31');
        END IF;

        -- Slip September 2026 (Bergembok - Insert jika belum ada)
        IF NOT EXISTS (SELECT 1 FROM public.payslips WHERE employee_id = emp_id AND period = 'September 2026') THEN
            INSERT INTO public.payslips (employee_id, period, basic_salary, attendance_allowance, transport_allowance, overtime_pay, deductions, net_salary, is_released, payment_date)
            VALUES (emp_id, 'September 2026', 3500000, 500000, 300000, 0, 0, 4300000, false, NULL);
        END IF;

        -- Jadwal Shift
        INSERT INTO public.shifts (employee_id, branch, shift_date, shift_name, start_time, end_time, notes)
        VALUES 
        (emp_id, 'LazyBloom', CURRENT_DATE, 'Shift Pagi (08:00 - 16:00)', '08:00', '16:00', 'Shift Barista Utama'),
        (emp_id, 'LazyBloom', CURRENT_DATE + INTERVAL '1 day', 'Shift Pagi (08:00 - 16:00)', '08:00', '16:00', 'Shift Barista'),
        (emp_id, 'LazyBloom', CURRENT_DATE + INTERVAL '2 day', 'Shift Siang (14:00 - 22:00)', '14:00', '22:00', 'Closing Store'),
        (emp_id, 'LazyBloom', CURRENT_DATE + INTERVAL '3 day', 'Libur / Off', NULL, NULL, 'Hari Libur Mingguan')
        ON CONFLICT (employee_id, shift_date) DO NOTHING;
    END IF;
END $$;

-- 8. TABEL ATTENDANCE_CORRECTIONS (PENGAJUAN KOREKSI KETERLAMBATAN / SHIFT)
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    branch VARCHAR(100) DEFAULT 'LazyBloom',
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    original_status VARCHAR(50),
    original_penalty NUMERIC DEFAULT 10000,
    target_shift VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by VARCHAR(100),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on attendance_corrections" ON public.attendance_corrections;
CREATE POLICY "Allow public all on attendance_corrections" ON public.attendance_corrections FOR ALL USING (true) WITH CHECK (true);
