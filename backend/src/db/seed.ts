import { pool } from '../config/db';
import { hashPassword } from '../utils/password';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding staff users...');
    const adminPass = await hashPassword('Admin123!');
    const staffPass = await hashPassword('Staff123!');
    const { rows: staffRows } = await client.query(
      `INSERT INTO staff_users (name, email, password_hash, role) VALUES
        ('Amina Kessy', 'admin@rental.co.tz', $1, 'admin'),
        ('John Mwakalinga', 'staff@rental.co.tz', $2, 'staff')
       RETURNING id, name, role`,
      [adminPass, staffPass]
    );
    const admin = staffRows.find((s) => s.role === 'admin');
    const staffMember = staffRows.find((s) => s.role === 'staff');

    console.log('Seeding vehicles...');
    const { rows: vehicles } = await client.query(
      `INSERT INTO vehicles (make, model, plate_number, category, status, current_mileage, daily_rate_tzs, photos) VALUES
        ('Toyota', 'Land Cruiser Prado', 'T123ABC', 'SUV', 'available', 42000, 180000, '{}'),
        ('Toyota', 'Corolla', 'T456DEF', 'Sedan', 'available', 30500, 90000, '{}'),
        ('Toyota', 'Hiace', 'T789GHI', 'Van', 'booked', 61000, 150000, '{}'),
        ('Nissan', 'X-Trail', 'T321JKL', 'SUV', 'in_service', 55000, 140000, '{}'),
        ('Suzuki', 'Alto', 'T654MNO', 'Economy', 'available', 18000, 60000, '{}')
       RETURNING id, category, plate_number`
    );

    console.log('Seeding clients...');
    const clientPass = await hashPassword('Client123!');
    const { rows: clients } = await client.query(
      `INSERT INTO clients (full_name, phone, email, id_type, id_number, password_hash) VALUES
        ('Grace Mushi', '+255712345001', 'grace.mushi@example.com', 'national_id', 'NIDA-0001', $1),
        ('Peter Komba', '+255712345002', 'peter.komba@example.com', 'passport', 'P-0002', $1),
        ('Fatuma Said', '+255712345003', 'fatuma.said@example.com', 'national_id', 'NIDA-0003', $1)
       RETURNING id, full_name`,
      [clientPass]
    );

    console.log('Seeding system settings...');
    await client.query('UPDATE system_settings SET usd_to_tzs_rate = 2650, default_daily_rate_tzs = 100000 WHERE id = 1');

    console.log('Seeding a linked device for one client...');
    await client.query(
      `INSERT INTO client_devices (client_id, device_name, platform, device_identifier)
       VALUES ($1, 'Grace''s iPhone 14', 'ios', 'seed-device-grace-1')`,
      [clients[0].id]
    );

    const prado = vehicles.find((v) => v.category === 'SUV' && v.plate_number === 'T123ABC');
    const corolla = vehicles.find((v) => v.plate_number === 'T456DEF');
    const hiace = vehicles.find((v) => v.plate_number === 'T789GHI');
    const xtrail = vehicles.find((v) => v.plate_number === 'T321JKL');
    const alto = vehicles.find((v) => v.plate_number === 'T654MNO');

    console.log('Seeding bookings across statuses...');

    // 1. pending_documents — client requested, no docs yet
    const b1 = await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status)
       VALUES ($1,$2,'self_drive', CURRENT_DATE + 5, CURRENT_DATE + 8, 'Dar es Salaam', 'Dar es Salaam', false, 'TZS', 270000, 'pending_documents')
       RETURNING id`,
      [alto.id, clients[1].id]
    );

    // 2. documents_submitted — docs uploaded, awaiting verification
    const b2 = await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status, created_by_staff_id)
       VALUES ($1,$2,'driver_included', CURRENT_DATE + 2, CURRENT_DATE + 6, 'Arusha', 'Moshi', true, 'USD', 320, 'documents_submitted', $3)
       RETURNING id`,
      [xtrail.id, clients[2].id, staffMember.id]
    );
    await client.query(
      `INSERT INTO documents (booking_id, client_id, document_type, file_path, verified) VALUES
        ($1,$2,'id_document','/uploads/documents/seed/fatuma-id.jpg', false),
        ($1,$2,'driving_license','/uploads/documents/seed/fatuma-license.jpg', false)`,
      [b2.rows[0].id, clients[2].id]
    );

    // 3. confirmed — verified docs, contract generated, not yet checked in
    const b3 = await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status, created_by_staff_id)
       VALUES ($1,$2,'self_drive', CURRENT_DATE + 1, CURRENT_DATE + 4, 'Dar es Salaam', 'Dar es Salaam', false, 'TZS', 270000, 'confirmed', $3)
       RETURNING id`,
      [corolla.id, clients[0].id, staffMember.id]
    );
    await client.query(
      `INSERT INTO documents (booking_id, client_id, document_type, file_path, verified, verified_by, verified_at) VALUES
        ($1,$2,'id_document','/uploads/documents/seed/grace-id.jpg', true, $3, now()),
        ($1,$2,'driving_license','/uploads/documents/seed/grace-license.jpg', true, $3, now())`,
      [b3.rows[0].id, clients[0].id, admin.id]
    );
    await client.query(
      `INSERT INTO contracts (booking_id, pdf_file_path, signed) VALUES ($1, '/uploads/contracts/seed/booking3-contract.pdf', true)`,
      [b3.rows[0].id]
    );

    // 4. active — currently out with client, check-in recorded, deposit held
    const b4 = await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status, created_by_staff_id)
       VALUES ($1,$2,'self_drive', CURRENT_DATE - 1, CURRENT_DATE + 2, 'Dar es Salaam', 'Zanzibar', true, 'TZS', 540000, 'active', $3)
       RETURNING id`,
      [hiace.id, clients[1].id, staffMember.id]
    );
    await client.query(
      `INSERT INTO documents (booking_id, client_id, document_type, file_path, verified, verified_by, verified_at) VALUES
        ($1,$2,'id_document','/uploads/documents/seed/peter-id.jpg', true, $3, now()),
        ($1,$2,'driving_license','/uploads/documents/seed/peter-license.jpg', true, $3, now())`,
      [b4.rows[0].id, clients[1].id, admin.id]
    );
    await client.query(
      `INSERT INTO condition_reports (booking_id, type, photos, fuel_level, mileage, notes, recorded_by)
       VALUES ($1, 'check_in', '{}', 'full', 61000, 'No visible damage at pickup.', $2)`,
      [b4.rows[0].id, staffMember.id]
    );
    await client.query(
      `INSERT INTO deposits (booking_id, amount, status, recorded_by) VALUES ($1, 200000, 'held', $2)`,
      [b4.rows[0].id, staffMember.id]
    );

    // 5. completed — full lifecycle including check-out and deposit release
    const b5 = await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status, created_by_staff_id)
       VALUES ($1,$2,'self_drive', CURRENT_DATE - 10, CURRENT_DATE - 7, 'Dar es Salaam', 'Dar es Salaam', false, 'TZS', 540000, 'completed', $3)
       RETURNING id`,
      [prado.id, clients[2].id, admin.id]
    );
    await client.query(
      `INSERT INTO documents (booking_id, client_id, document_type, file_path, verified, verified_by, verified_at) VALUES
        ($1,$2,'id_document','/uploads/documents/seed/fatuma-id2.jpg', true, $3, now()),
        ($1,$2,'driving_license','/uploads/documents/seed/fatuma-license2.jpg', true, $3, now())`,
      [b5.rows[0].id, clients[2].id, admin.id]
    );
    await client.query(
      `INSERT INTO condition_reports (booking_id, type, photos, fuel_level, mileage, notes, recorded_by) VALUES
        ($1, 'check_in', '{}', 'full', 41000, 'Clean, no damage.', $2),
        ($1, 'check_out', '{}', 'half', 41500, 'Minor scuff on rear bumper.', $2)`,
      [b5.rows[0].id, admin.id]
    );
    await client.query(
      `INSERT INTO contracts (booking_id, pdf_file_path, signed) VALUES ($1, '/uploads/contracts/seed/booking5-contract.pdf', true)`,
      [b5.rows[0].id]
    );
    await client.query(
      `INSERT INTO deposits (booking_id, amount, status, reason, recorded_by) VALUES ($1, 200000, 'released', 'Vehicle returned in good condition', $2)`,
      [b5.rows[0].id, admin.id]
    );

    // 6. cancelled
    await client.query(
      `INSERT INTO bookings (vehicle_id, client_id, rental_type, start_date, end_date, pickup_region, dropoff_region, is_cross_region, quoted_currency, quoted_amount, status, created_by_staff_id)
       VALUES ($1,$2,'self_drive', CURRENT_DATE + 15, CURRENT_DATE + 18, 'Mwanza', 'Mwanza', false, 'TZS', 270000, 'cancelled', $3)`,
      [corolla.id, clients[1].id, staffMember.id]
    );

    console.log('Seeding maintenance logs...');
    await client.query(
      `INSERT INTO maintenance_logs (vehicle_id, service_type, mileage_at_service, next_service_due_mileage, date, notes, recorded_by) VALUES
        ($1, 'Oil change & filter', 55000, 62000, CURRENT_DATE - 20, 'Routine service', $2),
        ($3, 'Full service', 40000, 50000, CURRENT_DATE - 60, 'Brake pads replaced', $2)`,
      [xtrail.id, admin.id, prado.id]
    );

    console.log('Seeding activity log entries...');
    await client.query(
      `INSERT INTO activity_log (actor_staff_id, action, entity_type, description) VALUES
        ($1, 'seed', 'system', 'Seed data loaded'),
        ($2, 'booking_created', 'booking', 'Created sample bookings during seeding')`,
      [admin.id, staffMember.id]
    );

    console.log('\nSeed complete. Sample logins:');
    console.log('  Admin  -> admin@rental.co.tz / Admin123!');
    console.log('  Staff  -> staff@rental.co.tz / Staff123!');
    console.log('  Client -> grace.mushi@example.com / Client123!');
    console.log('  Client -> peter.komba@example.com / Client123!');
    console.log('  Client -> fatuma.said@example.com / Client123!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
