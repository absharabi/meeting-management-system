import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import User, { getDefaultPermissionsForRole, permissionModules, Role } from '../models/User';

const allowedPermissions = permissionModules;

const sanitizePermissions = (permissions: unknown): string[] => {
  if (!Array.isArray(permissions)) return getDefaultPermissionsForRole(Role.User);

  const sanitized = permissions
    .map((permission) => permission?.toString().trim())
    .filter((permission): permission is string => Boolean(permission))
    .map((permission) => allowedPermissions.find((allowed) => allowed.toLowerCase() === permission.toLowerCase()))
    .filter((permission): permission is string => Boolean(permission));

  return Array.from(new Set(sanitized));
};

const getCellValue = (row: Record<string, any>, keys: string[]): string => {
  const entry = Object.entries(row).find(([key]) => keys.includes(key.toLowerCase().replace(/\s+/g, '')));
  return entry?.[1]?.toString().trim() || '';
};

const parseStatus = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return !['inactive', 'disabled', 'false', 'no', '0'].includes(normalized);
};

const parseRole = (value: string): Role | null => {
  const role = Object.values(Role).find((item) => item.toLowerCase() === value.toLowerCase());
  return role || null;
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-googleId').sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const user = await User.findById(requestingUser.id).select('-googleId');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { name, department } = req.body;
    
    const user = await User.findByIdAndUpdate(
      requestingUser.id,
      { $set: { name, department } },
      { new: true }
    ).select('-googleId');
    
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

export const addUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, username, email, phone, employeeId, role, department, isActive } = req.body;
    const normalizedRole = parseRole(role) || Role.User;

    if (normalizedRole === Role.SuperAdmin) {
      res.status(400).json({ message: 'SuperAdmin accounts cannot be created from user management' });
      return;
    }

    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409).json({ message: 'User with this email already exists' });
      return;
    }

    const user = await User.create({
      name,
      username,
      email,
      phone,
      employeeId,
      role: normalizedRole,
      department,
      isActive,
      permissions: getDefaultPermissionsForRole(normalizedRole),
    });
    res.status(201).json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, username, phone, employeeId, role, department, isActive, permissions } = req.body;
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

    const updateData: any = { name, username, phone, employeeId, role, department, isActive };
    if (permissions !== undefined) {
      updateData.permissions = sanitizePermissions(permissions);
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
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
    const seenEmails = new Set<string>();

    for (const row of rows) {
      const email = getCellValue(row, ['email', 'emailaddress']).toLowerCase();
      const name = getCellValue(row, ['name', 'fullname']);
      const roleValue = getCellValue(row, ['role']);
      const role = parseRole(roleValue);
      const username = getCellValue(row, ['username', 'user']);
      const phone = getCellValue(row, ['phone', 'phonenumber', 'mobile']);
      const employeeId = getCellValue(row, ['employeeid', 'employee', 'staffid', 'userid']);
      const department = getCellValue(row, ['department', 'dept']);
      const status = getCellValue(row, ['status', 'active', 'isactive']);

      if (!email || !name || !roleValue) {
        results.errors.push(`Row skipped: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }

      if (!role || role === Role.SuperAdmin) {
        results.errors.push(`Invalid role "${roleValue}" for ${email}. Use Admin, User, or Reviewer.`);
        results.skipped++;
        continue;
      }

      if (!isValidEmail(email)) {
        results.errors.push(`Invalid email address: ${email}`);
        results.skipped++;
        continue;
      }

      if (seenEmails.has(email)) {
        results.errors.push(`Duplicate email in file: ${email}`);
        results.skipped++;
        continue;
      }
      seenEmails.add(email);

      const exists = await User.findOne({ email });
      if (exists) {
        results.errors.push(`User already exists: ${email}`);
        results.skipped++;
        continue;
      }

      await User.create({
        name,
        username,
        email,
        phone,
        employeeId,
        role,
        department,
        isActive: parseStatus(status),
        permissions: getDefaultPermissionsForRole(role),
      });
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

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { notificationPreferences } = req.body;

    const updated = await User.findByIdAndUpdate(
      requestingUser.id,
      { notificationPreferences },
      { new: true, runValidators: true }
    ).select('notificationPreferences');

    res.json(updated?.notificationPreferences);
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating preferences', error });
  }
};

export const toggleMuteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const meetingId = req.params.meetingId;

    const user = await User.findById(requestingUser.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMuted = user.mutedMeetings.some(id => id.toString() === meetingId);
    
    if (isMuted) {
      user.mutedMeetings = user.mutedMeetings.filter(id => id.toString() !== meetingId);
    } else {
      user.mutedMeetings.push(meetingId as any);
    }

    await user.save();
    res.json({ mutedMeetings: user.mutedMeetings });
  } catch (error) {
    res.status(500).json({ message: 'Server error while toggling mute', error });
  }
};
