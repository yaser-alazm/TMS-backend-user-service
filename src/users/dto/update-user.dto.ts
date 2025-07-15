import { z } from 'zod';

export const UpdateUserSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  lastLogin: z.coerce.date().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
