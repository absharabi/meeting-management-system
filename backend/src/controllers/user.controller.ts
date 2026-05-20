import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import User, { Role } from '../models/User';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-googleId').sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, role, department } = req.body;
    const requestingUser = (req as any).user;

    if (role === Role.SuperAdmin && requestingUser.role !== Role.SuperAdmin) {
      res.status(403).json({ message: 'Only SuperAdmin can assign SuperAdmin role' });
      return;
    }

    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409).json({ message: 'User with this email already exists' });
      return;
    }

    const user = await User.create({ name, email, role, department });
    res.status(201).json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, role, department, isActive } = req.body;
    const requestingUser = (req as any).user;

    const target = await User.findById(req.params.id);
    if (!target) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (target.role === Role.SuperAdmin && requestingUser.role !== Role.SuperAdmin) {
      res.status(403).json({ message: 'Cannot modify a SuperAdmin' });
      return;
    }

    if (role === Role.SuperAdmin && requestingUser.role !== Role.SuperAdmin) {
      res.status(403).json({ message: 'Only SuperAdmin can assign SuperAdmin role' });
      return;
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, department, isActive },
      { new: true, runValidators: true }
    ).select('-googleId');

    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;

    const target = await User.findById(req.params.id);
    if (!target) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (target.role === Role.SuperAdmin) {
      res.status(403).json({ message: 'SuperAdmin cannot be deleted' });
      return;
    }

    if (target._id.toString() === requestingUser.id) {
      res.status(403).json({ message: 'Cannot delete your own account' });
      return;
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkAddUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows      = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

    if (!rows.length) {
      res.status(400).json({ message: 'Excel file is empty' });
      return;
    }

    const results = { added: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      const email      = row.email?.toString().toLowerCase().trim();
      const name       = row.name?.toString().trim();
      const role       = row.role?.toString().trim();
      const department = row.department?.toString().trim() || '';

      if (!email || !name || !role) {
        results.errors.push(`Row skipped: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }

      if (!Object.values(Role).includes(role as Role)) {
        results.errors.push(`Invalid role "${role}" for ${email}`);
        results.skipped++;
        continue;
      }

      const exists = await User.findOne({ email });
      if (exists) { results.skipped++; continue; }

      await User.create({ name, email, role, department });
      results.added++;
    }

    res.json({
      message: `Bulk upload complete. Added: ${results.added}, Skipped: ${results.skipped}`,
      details: results,
    });
  } catch {
    res.status(500).json({ message: 'Failed to process Excel file' });
  }
};