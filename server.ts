import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, 'data');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const db = new Database(path.join(dbDir, 'attendance.db'));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    radius_meters INTEGER DEFAULT 100,
    start_in_time TEXT DEFAULT '06:30',
    end_in_time TEXT DEFAULT '08:00',
    start_out_time TEXT DEFAULT '16:00',
    end_out_time TEXT DEFAULT '18:00'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    office_id INTEGER,
    nip TEXT,
    photo_url TEXT,
    leave_quota INTEGER DEFAULT 12,
    FOREIGN KEY(office_id) REFERENCES offices(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 'IN' or 'OUT'
    timestamp TEXT,
    lat REAL,
    lng REAL,
    photo_url TEXT,
    is_late BOOLEAN,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, diterima, ditolak
    admin_reason TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendance_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    type TEXT, -- 'IN' or 'OUT'
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, verified, rejected
    verified_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(verified_by) REFERENCES users(id)
  );
`);

// Migration: Add office_id to users if missing
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const hasOfficeId = tableInfo.some(col => col.name === 'office_id');
  if (!hasOfficeId) {
    db.exec("ALTER TABLE users ADD COLUMN office_id INTEGER REFERENCES offices(id)");
    console.log("Migrated: Added office_id to users table");
  }
  const hasNip = tableInfo.some(col => col.name === 'nip');
  if (!hasNip) {
    db.exec("ALTER TABLE users ADD COLUMN nip TEXT");
    console.log("Migrated: Added nip to users table");
  }
  const hasPhotoUrl = tableInfo.some(col => col.name === 'photo_url');
  if (!hasPhotoUrl) {
    db.exec("ALTER TABLE users ADD COLUMN photo_url TEXT");
    console.log("Migrated: Added photo_url to users table");
  }
  const hasLeaveQuota = tableInfo.some(col => col.name === 'leave_quota');
  if (!hasLeaveQuota) {
    db.exec("ALTER TABLE users ADD COLUMN leave_quota INTEGER DEFAULT 12");
    console.log("Migrated: Added leave_quota to users table");
  }

  // Migration for leave_requests
  const leaveTableInfo = db.prepare("PRAGMA table_info(leave_requests)").all() as any[];
  const hasAdminReason = leaveTableInfo.some(col => col.name === 'admin_reason');
  if (!hasAdminReason) {
    db.exec("ALTER TABLE leave_requests ADD COLUMN admin_reason TEXT");
    console.log("Migrated: Added admin_reason to leave_requests table");
  }
  const hasIsRead = leaveTableInfo.some(col => col.name === 'is_read');
  if (!hasIsRead) {
    db.exec("ALTER TABLE leave_requests ADD COLUMN is_read BOOLEAN DEFAULT 0");
    console.log("Migrated: Added is_read to leave_requests table");
  }

  // Migration for attendance
  const attendanceTableInfo = db.prepare("PRAGMA table_info(attendance)").all() as any[];
  const hasNotes = attendanceTableInfo.some(col => col.name === 'notes');
  if (!hasNotes) {
    db.exec("ALTER TABLE attendance ADD COLUMN notes TEXT");
    console.log("Migrated: Added notes to attendance table");
  }
} catch (e) {
  console.error("Migration error:", e);
}

db.exec(`
  -- Seed Default Office if none exists
  INSERT OR IGNORE INTO offices (id, name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time)
  VALUES (1, 'Kantor Pusat', -6.2088, 106.8456, 100, '06:30', '08:00', '16:00', '18:00');

  -- Seed Users if not exists (Updated with office_id)
  INSERT OR IGNORE INTO users (id, name, role, department, office_id) VALUES 
  (1, 'Admin User', 'admin', 'IT', 1),
  (2, 'Budi Santoso', 'employee', 'Teaching', 1),
  (3, 'Siti Aminah', 'employee', 'Administration', 1),
  (4, 'Kepala Sekolah', 'headmaster', 'Management', 1),
  (5, 'Pengawas Dinas', 'dinas', 'External', 1);
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // --- API Routes ---

  // Get Offices
  app.get('/api/offices', (req, res) => {
    const stmt = db.prepare('SELECT * FROM offices');
    const offices = stmt.all();
    res.json(offices);
  });

  // Create Office
  app.post('/api/offices', (req, res) => {
    const { name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time } = req.body;
    const stmt = db.prepare(`
      INSERT INTO offices (name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time);
    res.json({ success: true, id: info.lastInsertRowid });
  });

  // Update Office
  app.put('/api/offices/:id', (req, res) => {
    const { id } = req.params;
    const { name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time } = req.body;
    const stmt = db.prepare(`
      UPDATE offices 
      SET name = ?, lat = ?, lng = ?, radius_meters = ?, start_in_time = ?, end_in_time = ?, start_out_time = ?, end_out_time = ?
      WHERE id = ?
    `);
    stmt.run(name, lat, lng, radius_meters, start_in_time, end_in_time, start_out_time, end_out_time, id);
    res.json({ success: true });
  });

  // Delete Office
  app.delete('/api/offices/:id', (req, res) => {
    const { id } = req.params;
    // Check if users are assigned
    const userCheck = db.prepare('SELECT COUNT(*) as count FROM users WHERE office_id = ?').get(id) as { count: number };
    if (userCheck.count > 0) {
      return res.status(400).json({ error: 'Cannot delete office with assigned users.' });
    }
    const stmt = db.prepare('DELETE FROM offices WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  });

  // Get Users (with Office info)
  app.get('/api/users', (req, res) => {
    const stmt = db.prepare(`
      SELECT u.*, o.name as office_name 
      FROM users u 
      LEFT JOIN offices o ON u.office_id = o.id
    `);
    const users = stmt.all();
    res.json(users);
  });

  // Assign User to Office
  app.put('/api/users/:id/assign', (req, res) => {
    const { id } = req.params;
    const { office_id } = req.body;
    const stmt = db.prepare('UPDATE users SET office_id = ? WHERE id = ?');
    stmt.run(office_id, id);
    res.json({ success: true });
  });

  // Register User
  app.post('/api/register', (req, res) => {
    const { name, office_id } = req.body;
    
    // Check if office has any users
    const count = db.prepare('SELECT COUNT(*) as count FROM users WHERE office_id = ?').get(office_id) as { count: number };
    const role = count.count === 0 ? 'admin' : 'employee';
    
    const stmt = db.prepare('INSERT INTO users (name, role, office_id) VALUES (?, ?, ?)');
    const info = stmt.run(name, role, office_id);
    
    // Return the new user
    const newUser = db.prepare(`
      SELECT u.*, o.name as office_name 
      FROM users u 
      LEFT JOIN offices o ON u.office_id = o.id
      WHERE u.id = ?
    `).get(info.lastInsertRowid);
    
    res.json(newUser);
  });

  // Submit Special Attendance (Admin)
  app.post('/api/attendance/special', (req, res) => {
    const { user_id, type, date, notes } = req.body;
    // type: 'SAKIT', 'IZIN', 'TUGAS'
    // timestamp: date + 'T08:00:00' (default morning time)
    const timestamp = `${date}T08:00:00`;
    
    const stmt = db.prepare(`
      INSERT INTO attendance (user_id, type, timestamp, lat, lng, photo_url, is_late, notes)
      VALUES (?, ?, ?, 0, 0, '', 0, ?)
    `);
    stmt.run(user_id, type, timestamp, notes);
    res.json({ success: true });
  });

  // Update User Details (including role)
  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, nip, photo_url, role } = req.body;
    
    let query = 'UPDATE users SET name = ?, nip = ?, photo_url = ?';
    const params = [name, nip, photo_url];
    
    if (role) {
      query += ', role = ?';
      params.push(role);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    const stmt = db.prepare(query);
    stmt.run(...params);
    res.json({ success: true });
  });

  // Submit Attendance
  app.post('/api/attendance', (req, res) => {
    const { user_id, type, lat, lng, photo_url } = req.body;
    const timestamp = new Date().toISOString();
    
    // Get user's office settings
    const user = db.prepare(`
      SELECT u.*, o.lat as office_lat, o.lng as office_lng, o.radius_meters,
             o.start_in_time, o.end_in_time, o.start_out_time, o.end_out_time
      FROM users u
      LEFT JOIN offices o ON u.office_id = o.id
      WHERE u.id = ?
    `).get(user_id) as any;

    if (!user || !user.office_id) {
      return res.status(400).json({ error: 'User not assigned to an office.' });
    }

    // Validate Time (Simple string comparison works for HH:MM format)
    // We assume server time is correct for the timezone or use UTC offset if needed.
    // For simplicity, we'll use the server's local time string HH:MM.
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    if (type === 'IN') {
       if (currentTime < user.start_in_time || currentTime > user.end_in_time) {
         return res.status(400).json({ error: `Absen Masuk hanya bisa dilakukan antara ${user.start_in_time} - ${user.end_in_time}` });
       }
    } else if (type === 'OUT') {
       if (currentTime < user.start_out_time || currentTime > user.end_out_time) {
         return res.status(400).json({ error: `Absen Pulang hanya bisa dilakukan antara ${user.start_out_time} - ${user.end_out_time}` });
       }
    }

    let is_late = false;
    // If strict blocking is enabled, they can't be late (recorded as late), they just can't attend.
    // But we can still mark late if we relax the blocking later.

    const stmt = db.prepare(`
      INSERT INTO attendance (user_id, type, timestamp, lat, lng, photo_url, is_late)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(user_id, type, timestamp, lat, lng, photo_url, is_late ? 1 : 0);
    res.json({ success: true, id: info.lastInsertRowid });
  });

  // Get Attendance History
  app.get('/api/attendance', (req, res) => {
    const { user_id, role, start_date, end_date } = req.query;
    
    let query = `
      SELECT a.*, u.name, u.role, u.department 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    }

    if (start_date) {
      query += ` AND date(a.timestamp) >= ?`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND date(a.timestamp) <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY a.timestamp DESC`;

    const stmt = db.prepare(query);
    const logs = stmt.all(...params);
    res.json(logs);
  });

  // --- Leave Requests ---
  app.get('/api/leaves', (req, res) => {
    const { user_id } = req.query;
    let query = `SELECT l.*, u.name, u.role FROM leave_requests l JOIN users u ON l.user_id = u.id WHERE 1=1`;
    const params = [];
    if (user_id) {
      query += ` AND l.user_id = ?`;
      params.push(user_id);
    }
    query += ` ORDER BY l.created_at DESC`;
    const stmt = db.prepare(query);
    res.json(stmt.all(...params));
  });

  app.post('/api/leaves', (req, res) => {
    const { user_id, start_date, end_date, reason } = req.body;
    const stmt = db.prepare(`INSERT INTO leave_requests (user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)`);
    stmt.run(user_id, start_date, end_date, reason);
    res.json({ success: true });
  });

  app.put('/api/leaves/:id', (req, res) => {
    const { id } = req.params;
    const { status, admin_reason } = req.body;
    const stmt = db.prepare(`UPDATE leave_requests SET status = ?, admin_reason = ?, is_read = 0 WHERE id = ?`);
    stmt.run(status, admin_reason, id);
    
    // If approved, decrement quota (simplified logic)
    if (status === 'diterima') {
       const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id) as any;
       // Calculate days difference
       const start = new Date(leave.start_date);
       const end = new Date(leave.end_date);
       const diffTime = Math.abs(end.getTime() - start.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
       
       db.prepare('UPDATE users SET leave_quota = leave_quota - ? WHERE id = ?').run(diffDays, leave.user_id);
    }
    res.json({ success: true });
  });

  app.put('/api/leaves/:id/read', (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare(`UPDATE leave_requests SET is_read = 1 WHERE id = ?`);
    stmt.run(id);
    res.json({ success: true });
  });

  // --- Attendance Corrections ---
  app.get('/api/corrections', (req, res) => {
    const { user_id } = req.query;
    let query = `SELECT c.*, u.name, u.role FROM attendance_corrections c JOIN users u ON c.user_id = u.id WHERE 1=1`;
    const params = [];
    if (user_id) {
      query += ` AND c.user_id = ?`;
      params.push(user_id);
    }
    query += ` ORDER BY c.created_at DESC`;
    const stmt = db.prepare(query);
    res.json(stmt.all(...params));
  });

  app.post('/api/corrections', (req, res) => {
    const { user_id, date, type, reason } = req.body;
    const stmt = db.prepare(`INSERT INTO attendance_corrections (user_id, date, type, reason) VALUES (?, ?, ?, ?)`);
    stmt.run(user_id, date, type, reason);
    res.json({ success: true });
  });

  app.put('/api/corrections/:id', (req, res) => {
    const { id } = req.params;
    const { status, verified_by } = req.body;
    const stmt = db.prepare(`UPDATE attendance_corrections SET status = ?, verified_by = ? WHERE id = ?`);
    stmt.run(status, verified_by, id);

    // If verified, insert into attendance log
    if (status === 'verified') {
      const correction = db.prepare('SELECT * FROM attendance_corrections WHERE id = ?').get(id) as any;
      // Construct timestamp from date + default time (e.g., 08:00 for IN, 17:00 for OUT)
      // This is a simplification. Ideally, user should specify time too.
      const time = correction.type === 'IN' ? '08:00:00' : '17:00:00';
      const timestamp = `${correction.date}T${time}`;
      
      const insertAtt = db.prepare(`
        INSERT INTO attendance (user_id, type, timestamp, lat, lng, photo_url, is_late)
        VALUES (?, ?, ?, 0, 0, '', 0)
      `);
      insertAtt.run(correction.user_id, correction.type, timestamp);
    }
    res.json({ success: true });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
